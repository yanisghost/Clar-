const mongoose = require('mongoose');
const slugify = require('slugify');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A product must have a name'],
      unique: true,
      trim: true,
      maxlength: [
        100,
        'A product name must have less or equal than 100 characters',
      ],
      minlength: [
        3,
        'A product name must have more or equal than 3 characters',
      ],
    },
    slug: String,
    description: {
      type: String,
      trim: true,
      required: [true, 'A product must have a description'],
    },
    price: {
      type: Number,
      required: [true, 'A product must have a price'],
    },
    costPrice: {
      type: Number,
      required: [true, 'A product must have a cost price'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'A product must belong to a category'],
    },
    stock: {
      type: Number,
      required: [true, 'A product must have stock quantity'],
      min: [0, 'Stock cannot be negative'],
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      set: (val) => Math.round(val * 10) / 10,
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    imageCover: {
      type: String,
      required: [true, 'A product must have a cover image'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now,
      select: false,
    },
    active: {
      type: Boolean,
      default: true,
      select: false,
    },

    // 🔥 Discounts: automatic or code-based
    discounts: [
      {
        code: { type: String, trim: true }, // optional if requiresCode = false
        discountPrice: {
          type: Number,
          validate: {
            validator: function (val) {
              const parent = this.ownerDocument();
              return parent && val < parent.price;
            },
            message: 'Discount price ({VALUE}) should be below regular price',
          },
        },
        discountStart: Date,
        discountEnd: Date,
        active: { type: Boolean, default: true },
        requiresCode: { type: Boolean, default: true }, // NEW flag
      },
    ],
    linkedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ✅ Virtual field for profit margin
productSchema.virtual('profit').get(function () {
  return this.price - this.costPrice;
});

// ✅ Virtual: calculate best available discount
productSchema.virtual('finalPrice').get(function () {
  const now = Date.now();
  if (this.discounts && this.discounts.length > 0) {
    // find automatic discount first (requiresCode = false)
    const autoDiscount = this.discounts.find(
      (d) =>
        d.active &&
        !d.requiresCode &&
        d.discountPrice < this.price &&
        (!d.discountStart || now >= d.discountStart) &&
        (!d.discountEnd || now <= d.discountEnd),
    );
    if (autoDiscount) return autoDiscount.discountPrice;
  }
  return this.price;
});

// ✅ Virtual: discount percentage (first valid one)
productSchema.virtual('discountPercent').get(function () {
  const now = Date.now();
  if (this.discounts && this.discounts.length > 0) {
    const validDiscount = this.discounts.find(
      (d) =>
        d.active &&
        d.discountPrice < this.price &&
        (!d.discountStart || now >= d.discountStart) &&
        (!d.discountEnd || now <= d.discountEnd),
    );
    if (validDiscount) {
      return Math.round(
        ((this.price - validDiscount.discountPrice) / this.price) * 100,
      );
    }
  }
  return 0;
});

// ✅ DOCUMENT MIDDLEWARE: create slug from name
productSchema.pre('save', function () {
  this.slug = slugify(this.name, { lower: true });
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
