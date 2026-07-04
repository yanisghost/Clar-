const multer = require('multer');
const sharp = require('sharp');
const Product = require('../models/productModel');
const factory = require('./handlerFactory');
const catchAsync = require('../utils/catchAsync');

// 1. Multer setup (store in memory for sharp)
const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload only images.'), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

// Middleware: upload single cover + multiple images
exports.uploadProductImages = upload.fields([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 3 },
]);

// 2. Image processing with sharp
exports.resizeProductImages = catchAsync(async (req, res, next) => {
  if (!req.files && !req.body.imageOrder) return next();

  const savedFiles = [];

  // Cover image
  if (req.files && req.files.imageCover && req.files.imageCover.length > 0) {
    const filename = `product-${Date.now()}-cover.jpeg`;
    await sharp(req.files.imageCover[0].buffer)
      .rotate()
      .resize(1000, 1000, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toFormat('jpeg')
      .jpeg({ quality: 95, mozjpeg: true })
      .toFile(`public/img/products/${filename}`);

    savedFiles.push({ field: 'imageCover', index: 0, filename });
  }

  // Other images
  if (req.files && req.files.images && req.files.images.length > 0) {
    await Promise.all(
      req.files.images.map(async (file, i) => {
        const filename = `product-${Date.now()}-${i + 1}.jpeg`;
        await sharp(file.buffer)
          .rotate()
          .resize(1000, 1000, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toFormat('jpeg')
          .jpeg({ quality: 95, mozjpeg: true })
          .toFile(`public/img/products/${filename}`);

        savedFiles.push({ field: 'images', index: i, filename });
      })
    );
  }

  // Reorder / reconstruct final imageCover and images array
  if (req.body.imageOrder) {
    let order;
    try {
      order = typeof req.body.imageOrder === 'string'
        ? JSON.parse(req.body.imageOrder)
        : req.body.imageOrder;
    } catch (e) {
      order = req.body.imageOrder;
    }

    if (Array.isArray(order)) {
      const finalImages = order
        .map((item) => {
          if (item.startsWith('server:')) {
            return item.replace('server:', '');
          } else if (item.startsWith('file:')) {
            const parts = item.replace('file:', '').split(':');
            const field = parts[0];
            const index = parseInt(parts[1], 10);
            const matched = savedFiles.find(
              (sf) => sf.field === field && sf.index === index
            );
            return matched ? matched.filename : null;
          } else if (item.startsWith('fileIndex:')) {
            const index = parseInt(item.replace('fileIndex:', ''), 10);
            const matched = savedFiles.find(
              (sf) => sf.field === 'images' && sf.index === index
            );
            return matched ? matched.filename : null;
          }
          return null;
        })
        .filter(Boolean);

      if (finalImages.length > 0) {
        req.body.imageCover = finalImages[0];
        req.body.images = finalImages.slice(1);
      } else {
        req.body.imageCover = undefined;
        req.body.images = [];
      }
    }
  } else {
    // Fallback: update cover and gallery if uploaded
    const coverMatch = savedFiles.find((sf) => sf.field === 'imageCover');
    if (coverMatch) {
      req.body.imageCover = coverMatch.filename;
    }
    const galleryMatches = savedFiles.filter((sf) => sf.field === 'images');
    if (galleryMatches.length > 0) {
      req.body.images = galleryMatches.map((gm) => gm.filename);
    }
  }

  next();
});

// Apply discount to a product (admin only)

exports.createProduct = factory.createOne(Product);
exports.getAllProducts = factory.getAll(Product);
exports.getProduct = factory.getOne(Product, [
  { path: 'category', select: 'name' },
  { path: 'linkedProducts' },
]);
exports.deleteProduct = factory.deleteOne(Product);
exports.updateProduct = factory.updateOne(Product);
