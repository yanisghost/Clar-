const mongoose = require('mongoose');
const slugify = require('slugify');

const packSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A pack must have a name'],
      unique: true,
      trim: true,
    },
    slug: String,
    description: {
      type: String,
      trim: true,
      required: [true, 'A pack must have a description'],
    },

    // Embedded product snapshots with quantity
    products: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        name: String,
        price: Number,
        costPrice: Number,
        imageCover: String,
        quantity: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
        },
      },
    ],

    // Pack images
    imageCover: {
      type: String,
      required: [true, 'A pack must have a cover image'],
    },
    images: [String],

    // Admin sets the deal price
    packPrice: {
      type: Number,
      required: [true, 'A pack must have a deal price'],
    },

    // Auto-calculated: sum of product prices * quantities
    originalPrice: { type: Number },

    // ✅ Admin sets profit manually
    profit: {
      type: Number,
      required: [true, 'A pack must have a profit value'],
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
    active: {
      type: Boolean,
      default: true,
    },

    // 🔥 Multiple Discount Codes (automatic + code-based)
    discounts: [
      {
        requiresCode: { type: Boolean, default: false }, // NEW
        code: { type: String, trim: true },
        discountPrice: {
          type: Number,
          validate: {
            validator: function (val) {
              const parent = this.ownerDocument();
              return parent && val < parent.packPrice;
            },
            message: 'Discount price ({VALUE}) should be below pack price',
          },
        },
        discountStart: Date,
        discountEnd: Date,
        active: { type: Boolean, default: true },
      },
    ],
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtuals
packSchema.virtual('finalPrice').get(function () {
  const now = Date.now();
  if (this.discounts && this.discounts.length > 0) {
    // Automatic discount (requiresCode = false)
    const autoDiscount = this.discounts.find(
      (d) =>
        !d.requiresCode &&
        d.active &&
        d.discountPrice < this.packPrice &&
        (!d.discountStart || now >= d.discountStart) &&
        (!d.discountEnd || now <= d.discountEnd),
    );
    if (autoDiscount) return autoDiscount.discountPrice;
  }
  return this.packPrice;
});

packSchema.virtual('savings').get(function () {
  if (this.originalPrice && this.finalPrice) {
    return Math.round((this.originalPrice - this.finalPrice) * 100) / 100;
  }
  return 0;
});

packSchema.virtual('savingsPercent').get(function () {
  if (this.originalPrice && this.finalPrice) {
    return Math.round(
      ((this.originalPrice - this.finalPrice) / this.originalPrice) * 100,
    );
  }
  return 0;
});

// Slug + originalPrice calculation
packSchema.pre('save', function () {
  this.slug = slugify(this.name, { lower: true });

  // Calculate original price from embedded product snapshots (with quantity)
  this.originalPrice = this.products.reduce(
    (sum, p) => sum + p.price * p.quantity,
    0,
  );
});

const Pack = mongoose.model('Pack', packSchema);
module.exports = Pack;
