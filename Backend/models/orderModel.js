const mongoose = require('mongoose');
const Product = require('./productModel'); // Import Product model

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    customerName: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    wilaya: { type: String, required: true },
    baladia: { type: String, required: true },
    homeAddress: { type: String, required: true },

    // Products purchased
    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        name: String, // ✅ add this
        quantity: { type: Number, required: true, min: 1 },
        costPrice: { type: Number, required: true },
        finalPrice: { type: Number, required: true }, // ✅ actual charged price
        profit: { type: Number, required: true },
      },
    ],

    // Packs purchased
    packs: [
      {
        pack: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Pack',
          required: true,
        },
        name: String,
        finalPrice: { type: Number, required: true }, // ✅ actual charged price
        packPrice: Number, // optional reference
        discountPrice: Number,
        originalPrice: { type: Number, required: true },
        savings: Number,
        savingsPercent: Number,
        profit: { type: Number, required: true },
        quantity: { type: Number, required: true, min: 1, default: 1 },
        products: [
          {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
            name: String,
            price: Number,
            costPrice: Number,
            imageCover: String,
            quantity: Number,
          },
        ],
      },
    ],

    totalAmount: { type: Number },
    totalProfit: { type: Number },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },

    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'paypal', 'dahabia', 'cib', 'other'],
      default: 'cash',
    },

    paymentRef: {
      type: String,
      unique: true,
      sparse: true,
    },

    paymentUrl: {
      type: String,
    },

    couponCode: { type: String },
    couponDiscount: { type: Number, default: 0 },

    // ── Yalidine / Guepex delivery fields ──────────────────────────────────
    shippingFee: { type: Number, default: 0 },
    shippingMethod: {
      type: String,
      enum: ['home', 'stopdesk'],
      default: 'home',
    },
    yalidineTracking: { type: String, sparse: true },
    yalidineStatus: { type: String },
    yalidineLabelUrl: { type: String },

    // ── Generic Shipping / Multi-Carrier fields ────────────────────────────
    shipping: {
      provider: {
        type: String,
        enum: ['yalidine', 'nord_and_back', 'manual'],
        default: 'yalidine',
      },
      trackingNumber: { type: String },
      status: { type: String, default: 'draft' },
      labelUrl: { type: String },
      history: [
        {
          status: { type: String },
          location: { type: String },
          reason: { type: String },
          timestamp: { type: Date, default: Date.now },
        },
      ],
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

// ✅ Auto-calculate totals before saving
orderSchema.pre('save', function () {
  // Products
  this.products.forEach((item) => {
    item.profit = (item.finalPrice - item.costPrice) * item.quantity;
  });

  const productAmount = this.products.reduce(
    (sum, item) => sum + item.finalPrice * item.quantity,
    0,
  );
  const productProfit = this.products.reduce(
    (sum, item) => sum + item.profit,
    0,
  );

  // Packs
  const packAmount = this.packs
    ? this.packs.reduce((sum, pack) => sum + pack.finalPrice * pack.quantity, 0)
    : 0;
  const packProfit = this.packs
    ? this.packs.reduce((sum, pack) => sum + (pack.profit || 0), 0)
    : 0;

  this.totalAmount = productAmount + packAmount + (this.shippingFee || 0) - (this.couponDiscount || 0);
  this.totalProfit = Math.max(0, productProfit + packProfit - (this.couponDiscount || 0));
  this.updatedAt = Date.now();
});

// ✅ Middleware: reset totals when status changes to cancelled, and restore them when un-cancelled
orderSchema.pre(/^findOneAndUpdate$/, async function () {
  try {
    const update = this.getUpdate();
    console.log('[Order Middleware] Hook triggered. Update object:', JSON.stringify(update));
    if (!update) return;

    const getUpdateField = (field) => {
      if (update[field] !== undefined) return update[field];
      if (update.$set && update.$set[field] !== undefined) return update.$set[field];
      return undefined;
    };

    const setUpdateField = (field, value) => {
      if (update[field] !== undefined || !update.$set) {
        update[field] = value;
      }
      if (update.$set) {
        update.$set[field] = value;
      }
    };

    const status = getUpdateField('status');
    console.log('[Order Middleware] Target status:', status);

    if (status === 'cancelled') {
      console.log('[Order Middleware] Setting totals to 0 for cancellation');
      setUpdateField('totalAmount', 0);
      setUpdateField('totalProfit', 0);
    } else if (status && status !== 'cancelled') {
      const query = this.getQuery();
      console.log('[Order Middleware] Restoring totals. Fetching original doc for query:', JSON.stringify(query));
      
      const docToUpdate = await this.model.findOne(query);
      if (!docToUpdate) {
        console.log('[Order Middleware] Original document not found in DB.');
        return;
      }
      
      console.log('[Order Middleware] Original document status in DB:', docToUpdate.status);
      
      if (docToUpdate.status === 'cancelled') {
        const productAmount = (docToUpdate.products || []).reduce(
          (sum, item) => sum + (item.finalPrice || 0) * (item.quantity || 1),
          0,
        );
        const productProfit = (docToUpdate.products || []).reduce(
          (sum, item) => sum + (item.profit || 0),
          0,
        );
        const packAmount = (docToUpdate.packs || []).reduce(
          (sum, pack) => sum + (pack.finalPrice || 0) * (pack.quantity || 1),
          0,
      );
        const packProfit = (docToUpdate.packs || []).reduce(
          (sum, pack) => sum + (pack.profit || 0),
          0,
        );

        const totalAmount = productAmount + packAmount + (docToUpdate.shippingFee || 0) - (docToUpdate.couponDiscount || 0);
        const totalProfit = Math.max(0, productProfit + packProfit - (docToUpdate.couponDiscount || 0));

        console.log(`[Order Middleware] Recalculated totalAmount: ${totalAmount}, totalProfit: ${totalProfit}`);

        setUpdateField('totalAmount', totalAmount);
        setUpdateField('totalProfit', totalProfit);
      }
    }
  } catch (err) {
    console.error('[Order Middleware] Error in pre-findOneAndUpdate hook:', err);
  }
});

// ✅ Middleware: decrease stock when status changes to confirmed
orderSchema.post(/^findOneAndUpdate$/, async function (doc) {
  if (doc && doc.status === 'confirmed') {
    // Handle individual products
    await Promise.all(
      doc.products.map(async (item) => {
        const productDoc = await Product.findById(item.product);
        if (!productDoc) return;

        if (productDoc.stock < item.quantity) {
          throw new Error(`Not enough stock for product ${productDoc.name}`);
        }

        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: -item.quantity },
        });
      }),
    );

    // Handle packs
    if (doc.packs && doc.packs.length > 0) {
      await Promise.all(
        doc.packs.flatMap((pack) =>
          pack.products.map(async (p) => {
            const productDoc = await Product.findById(p.productId);
            if (!productDoc) return;

            if (productDoc.stock < p.quantity) {
              throw new Error(
                `Not enough stock for product ${p.name} in pack ${pack.name}`,
              );
            }

            await Product.findByIdAndUpdate(p.productId, {
              $inc: { stock: -p.quantity },
            });
          }),
        ),
      );
    }
  }
});

// ✅ Middleware: restore stock when order is deleted
orderSchema.post(/^findOneAndDelete$/, async function (doc) {
  if (doc) {
    // Restore stock for products
    await Promise.all(
      doc.products.map(async (item) => {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.quantity },
        });
      }),
    );

    // Restore stock for packs
    if (doc.packs && doc.packs.length > 0) {
      await Promise.all(
        doc.packs.flatMap((pack) =>
          pack.products.map(async (p) => {
            await Product.findByIdAndUpdate(p.productId, {
              $inc: { stock: p.quantity },
            });
          }),
        ),
      );
    }
  }
});

orderSchema.index({ status: 1, paymentRef: 1 });

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
