// utils/yalidine.js
// Yalidine / Guepex API client for Opzia backend.
// Docs: https://api.guepex.app/v1
// Auth: X-API-ID + X-API-TOKEN headers on every request.

const axios = require('axios');

// ─── Wilaya name → ID map (matches the WILAYAS list in the frontend) ──────────
const WILAYA_MAP = {
  Adrar: 1, Chlef: 2, Laghouat: 3, 'Oum El Bouaghi': 4, Batna: 5,
  'Béjaïa': 6, Biskra: 7, 'Béchar': 8, Blida: 9, Bouira: 10,
  Tamanrasset: 11, 'Tébessa': 12, Tlemcen: 13, Tiaret: 14,
  'Tizi Ouzou': 15, Alger: 16, Djelfa: 17, Jijel: 18, 'Sétif': 19,
  'Saïda': 20, Skikda: 21, 'Sidi Bel Abbès': 22, Annaba: 23,
  Guelma: 24, Constantine: 25, 'Médéa': 26, Mostaganem: 27, "M'Sila": 28,
  Mascara: 29, Ouargla: 30, Oran: 31, 'El Bayadh': 32, Illizi: 33,
  'Bordj Bou Arréridj': 34, 'Boumerdès': 35, 'El Tarf': 36, Tindouf: 37,
  Tissemsilt: 38, 'El Oued': 39, Khenchela: 40, 'Souk Ahras': 41,
  Tipaza: 42, Mila: 43, 'Aïn Defla': 44, 'Naâma': 45,
  'Aïn Témouchent': 46, 'Ghardaïa': 47, Relizane: 48,
  Timimoun: 49, 'Bordj Badji Mokhtar': 50, 'Ouled Djellal': 51,
  'Béni Abbès': 52, 'In Salah': 53, 'In Guezzam': 54, Touggourt: 55,
  Djanet: 56, "El M'Ghair": 57, 'El Meniaa': 58,
};

// ─── Axios instance ────────────────────────────────────────────────────────────
const yalidineClient = axios.create({
  baseURL: process.env.YALIDINE_API_URL || 'https://api.guepex.app/v1',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth headers are read per-request so updating config.env + restarting
// is all that is needed — no re-deploy required.
yalidineClient.interceptors.request.use((config) => {
  const id    = process.env.YALIDINE_API_ID;
  const token = process.env.YALIDINE_API_TOKEN;

  if (!id || id === 'your_api_id_here') {
    throw new Error('YALIDINE_API_ID is not set in config.env');
  }
  if (!token || token === 'your_api_token_here') {
    throw new Error('YALIDINE_API_TOKEN is not set in config.env');
  }

  config.headers['X-API-ID']    = id;
  config.headers['X-API-TOKEN'] = token;
  return config;
});

// ─── Helper: resolve wilaya ID from name ──────────────────────────────────────
function getWilayaId(wilayaName) {
  // Try exact match first
  if (WILAYA_MAP[wilayaName] !== undefined) return WILAYA_MAP[wilayaName];
  // Case-insensitive fallback
  const lower = wilayaName.toLowerCase();
  const found = Object.entries(WILAYA_MAP).find(
    ([name]) => name.toLowerCase() === lower
  );
  return found ? found[1] : null;
}

// ─── Helper: resolve wilaya name from ID ──────────────────────────────────────
function getWilayaName(wilayaId) {
  const found = Object.entries(WILAYA_MAP).find(([, id]) => id === wilayaId);
  return found ? found[0] : null;
}

/**
 * Get delivery fees from origin wilaya to destination wilaya,
 * resolved to the specific commune's pricing.
 *
 * @param {string} toWilayaName - destination wilaya name (as stored on order)
 * @param {string} toCommuneName - destination commune (baladia)
 * @returns {{ express_home: number, express_desk: number, retour_fee: number, cod_percentage: number } | null}
 */
async function getShippingFee(toWilayaName, toCommuneName) {
  if (process.env.YALIDINE_SANDBOX === 'true') {
    const toWilayaId = getWilayaId(toWilayaName) || 16;
    const isAlger = toWilayaId === 16;
    return {
      express_home: isAlger ? 400 : 700,
      express_desk: isAlger ? 300 : 450,
      economic_home: isAlger ? 350 : 600,
      economic_desk: isAlger ? 250 : 350,
      retour_fee: 100,
      cod_percentage: 1,
      insurance_percentage: 0.5,
      oversize_fee: 0,
      commune_name: toCommuneName || 'Commune Test',
      wilaya_name: toWilayaName,
    };
  }

  const fromWilayaId = parseInt(process.env.YALIDINE_FROM_WILAYA_ID || '16', 10);
  const toWilayaId = getWilayaId(toWilayaName);

  if (!toWilayaId) {
    throw new Error(`Unknown wilaya: "${toWilayaName}"`);
  }

  const { data } = await yalidineClient.get('/fees/', {
    params: { from_wilaya_id: fromWilayaId, to_wilaya_id: toWilayaId },
  });

  // data.per_commune is keyed by commune_id: { commune_id, commune_name, express_home, express_desk, ... }
  const communes = Object.values(data.per_commune || {});

  if (communes.length === 0) {
    return { express_home: null, express_desk: null, retour_fee: data.retour_fee, cod_percentage: data.cod_percentage };
  }

  // Find by commune name (case-insensitive, accent-tolerant)
  const normalise = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normTarget = normalise(toCommuneName);

  let match = communes.find((c) => normalise(c.commune_name) === normTarget);

  // Fallback: first commune in the destination wilaya if no exact match
  if (!match) {
    match = communes[0];
    console.warn(
      `[Yalidine] No exact commune match for "${toCommuneName}" in "${toWilayaName}". Using first commune: "${match.commune_name}"`
    );
  }

  return {
    express_home: match.express_home,
    express_desk: match.express_desk,
    economic_home: match.economic_home,
    economic_desk: match.economic_desk,
    retour_fee: data.retour_fee,
    cod_percentage: data.cod_percentage,
    insurance_percentage: data.insurance_percentage,
    oversize_fee: data.oversize_fee,
    commune_name: match.commune_name,
    wilaya_name: data.to_wilaya_name,
  };
}

/**
 * Create a parcel in Yalidine for the given Opzia order.
 *
 * @param {Object} order - Mongoose order document
 * @returns {{ tracking: string, label: string, import_id: number }}
 */
async function createParcel(order) {
  if (process.env.YALIDINE_SANDBOX === 'true') {
    const tracking = `SANDBOX-${order._id.toString().slice(-6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    return {
      tracking,
      label: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      labels: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      import_id: Math.floor(100000 + Math.random() * 900000),
    };
  }

  const fromWilayaName = getWilayaName(
    parseInt(process.env.YALIDINE_FROM_WILAYA_ID || '16', 10)
  ) || 'Alger';

  // Build a product description from the order
  const productList = [
    ...(order.products || []).map((p) => p.name || 'Produit'),
    ...(order.packs || []).map((p) => p.name || 'Pack'),
  ].join(', ') || 'Produit Opzia';

  // Split customerName into firstname/familyname
  const nameParts = (order.customerName || 'Client Opzia').trim().split(/\s+/);
  const firstname = nameParts[0] || 'Client';
  const familyname = nameParts.slice(1).join(' ') || 'Opzia';

  // Price to collect from receiver (0 if already paid by card/dahabia/cib)
  const paidMethods = ['dahabia', 'cib', 'card', 'paypal'];
  const isPrepaid = paidMethods.includes(order.paymentMethod);
  const priceToCollect = isPrepaid ? 0 : Math.round(order.totalAmount || 0);

  const parcelPayload = [
    {
      order_id: order._id.toString(),
      from_wilaya_name: fromWilayaName,
      firstname,
      familyname,
      contact_phone: order.phoneNumber,
      address: order.homeAddress,
      to_commune_name: order.baladia,
      to_wilaya_name: order.wilaya,
      product_list: productList.slice(0, 200), // API limit
      price: priceToCollect,
      do_insurance: false,
      declared_value: Math.round(order.totalAmount || 0),
      length: 20,
      width: 15,
      height: 10,
      weight: 1,
      freeshipping: false,          // buyer pays delivery (COD)
      is_stopdesk: order.shippingMethod === 'stopdesk',
      has_exchange: false,
      product_to_collect: null,
    },
  ];

  const { data } = await yalidineClient.post('/parcels/', parcelPayload);

  const orderId = order._id.toString();
  const result = data[orderId];

  if (!result || !result.success) {
    const msg = result?.message || 'Yalidine parcel creation failed';
    throw new Error(`[Yalidine] ${msg}`);
  }

  return {
    tracking: result.tracking,
    label: result.label,
    labels: result.labels,
    import_id: result.import_id,
  };
}

/**
 * Get the latest status history entry for a given tracking number.
 *
 * @param {string} tracking - e.g. "yal-123456"
 * @returns {Object|null} - latest history entry or null
 */
async function getParcelLatestStatus(tracking) {
  if (process.env.YALIDINE_SANDBOX === 'true') {
    return {
      tracking,
      date_status: new Date().toISOString().replace('T', ' ').substring(0, 19),
      status: 'En préparation',
      wilaya: 'Alger',
      commune: 'Bab El Oued',
      reason: null
    };
  }

  const { data } = await yalidineClient.get(`/histories/${tracking}`);
  const entries = data?.data || [];
  if (entries.length === 0) return null;
  // Sorted descending by date_status by default, so first entry is latest
  return entries[0];
}

// ─── Status mapping: Yalidine → Opzia ─────────────────────────────────────────
const YALIDINE_TO_OPZIA_STATUS = {
  'Livré': 'delivered',
  'Annulé': 'cancelled',
  'Sorti en livraison': 'shipped',
  'Expédié': 'shipped',
  'Vers Wilaya': 'shipped',
  'En transit': 'shipped',
  'Retourné au vendeur': 'cancelled',
};

/**
 * Map a Yalidine delivery status string to an Opzia order status string.
 * Returns null if there's no meaningful mapping.
 *
 * @param {string} yalidineStatus
 * @returns {string|null}
 */
function mapYalidineStatusToOpzia(yalidineStatus) {
  return YALIDINE_TO_OPZIA_STATUS[yalidineStatus] || null;
}

/**
 * Delete/Cancel a parcel in Yalidine.
 * Only possible if last_status is "En préparation".
 *
 * @param {string} tracking - tracking number
 * @returns {Promise<boolean>} - true if successfully deleted
 */
async function deleteParcel(tracking) {
  if (process.env.YALIDINE_SANDBOX === 'true') {
    return true;
  }

  const { data } = await yalidineClient.delete(`/parcels/${tracking}`);

  // Handle array of objects: [ { tracking, deleted: true } ]
  if (Array.isArray(data)) {
    const item = data.find((x) => x.tracking === tracking) || data[0];
    return !!item?.deleted;
  }

  // Handle keyed object or flat object response
  if (data && typeof data === 'object') {
    if (data.deleted !== undefined) return !!data.deleted;
    if (data[tracking] && data[tracking].deleted !== undefined) {
      return !!data[tracking].deleted;
    }
  }

  return false;
}

module.exports = {
  getShippingFee,
  createParcel,
  getParcelLatestStatus,
  deleteParcel,
  mapYalidineStatusToOpzia,
  getWilayaId,
};
