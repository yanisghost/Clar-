// utils/yalidineProvider.js
const axios = require('axios');

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

const yalidineClient = axios.create({
  baseURL: process.env.YALIDINE_API_URL || 'https://api.guepex.app/v1',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

function getWilayaId(wilayaName) {
  if (WILAYA_MAP[wilayaName] !== undefined) return WILAYA_MAP[wilayaName];
  const lower = wilayaName.toLowerCase();
  const found = Object.entries(WILAYA_MAP).find(
    ([name]) => name.toLowerCase() === lower
  );
  return found ? found[1] : null;
}

const YALIDINE_TO_OPZIA_STATUS = {
  'Livré': 'delivered',
  'Annulé': 'cancelled',
  'Sorti en livraison': 'shipped',
  'Expédié': 'shipped',
  'Vers Wilaya': 'shipped',
  'En transit': 'shipped',
  'Retourné au vendeur': 'cancelled',
};

class YalidineProvider {
  static async createParcel(order) {
    if (process.env.YALIDINE_SANDBOX === 'true') {
      return {
        tracking: `yal-mock-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        label: 'https://yalidine.app/app/bordereau.php?tracking=mock',
      };
    }

    const toWilayaId = getWilayaId(order.wilaya);
    if (!toWilayaId) {
      throw new Error(`Invalid destination wilaya: ${order.wilaya}`);
    }

    const fromWilayaId = parseInt(process.env.YALIDINE_FROM_WILAYA_ID || '16', 10);
    const productNames = [
      ...order.products.map((p) => `${p.name} (x${p.quantity})`),
      ...order.packs.map((p) => `${p.name} (x${p.quantity})`),
    ].join(', ');

    const payload = [
      {
        order_id: order._id.toString(),
        from_wilaya_name: Object.entries(WILAYA_MAP).find(([, id]) => id === fromWilayaId)?.[0] || 'Alger',
        firstname: order.customerName.split(' ')[0] || 'Client',
        familyname: order.customerName.split(' ').slice(1).join(' ') || 'Opzia',
        contact_phone: order.phoneNumber,
        address: order.homeAddress,
        to_commune_name: order.baladia,
        to_wilaya_name: order.wilaya,
        product_list: productNames.substring(0, 80) || 'Opzia Cosmetics',
        price: order.totalAmount,
        do_insurance: false,
        declared_value: order.totalAmount,
        height: 10,
        width: 15,
        length: 20,
        weight: 1,
        freeshipping: order.shippingFee === 0,
        is_stopdesk: order.shippingMethod === 'stopdesk',
        has_exchange: false,
      },
    ];

    if (order.shippingMethod === 'stopdesk' && order.stopDeskId) {
      payload[0].stopdesk_id = parseInt(order.stopDeskId, 10);
    }

    const { data } = await yalidineClient.post('/parcels/', payload);
    const result = data[order._id.toString()];
    if (!result || !result.success) {
      throw new Error(result?.message || 'Failed to create parcel on Yalidine API');
    }
    return {
      tracking: result.tracking,
      label: result.label,
    };
  }

  static async deleteParcel(tracking) {
    if (process.env.YALIDINE_SANDBOX === 'true') {
      return true;
    }
    const { data } = await yalidineClient.delete(`/parcels/${tracking}`);
    if (Array.isArray(data)) {
      const item = data.find((x) => x.tracking === tracking) || data[0];
      return !!item?.deleted;
    }
    if (data && typeof data === 'object') {
      if (data.deleted !== undefined) return !!data.deleted;
      if (data[tracking] && data[tracking].deleted !== undefined) {
        return !!data[tracking].deleted;
      }
    }
    return false;
  }

  static async getParcelLatestStatus(tracking) {
    if (process.env.YALIDINE_SANDBOX === 'true') {
      return {
        status: 'En préparation',
        location: 'Alger',
        reason: null,
        timestamp: new Date(),
      };
    }
    const { data } = await yalidineClient.get(`/histories/${tracking}`);
    const entries = data?.data || [];
    if (entries.length === 0) return null;
    const latest = entries[0];
    return {
      status: latest.status,
      location: latest.wilaya_name || latest.commune_name || '',
      reason: latest.reason || null,
      timestamp: latest.date_status ? new Date(latest.date_status.replace(' ', 'T')) : new Date(),
    };
  }

  static mapStatusToOpzia(status) {
    return YALIDINE_TO_OPZIA_STATUS[status] || null;
  }
}

module.exports = YalidineProvider;
