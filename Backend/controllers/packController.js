const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const Pack = require('../models/packModel');
const factory = require('./handlerFactory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

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
exports.uploadPackImages = upload.fields([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 3 },
]);

// 2. Image processing with sharp (for create)
exports.resizePackImages = catchAsync(async (req, res, next) => {
  if (!req.files && !req.body.imageOrder) return next();

  const savedFiles = [];

  // Cover image
  if (req.files && req.files.imageCover && req.files.imageCover.length > 0) {
    const filename = `pack-${Date.now()}-cover.jpeg`;
    await sharp(req.files.imageCover[0].buffer)
      .resize(800, 800)
      .toFormat('jpeg')
      .jpeg({ quality: 90 })
      .toFile(`public/img/packs/${filename}`);

    savedFiles.push({ field: 'imageCover', index: 0, filename });
  }

  // Gallery images
  if (req.files && req.files.images && req.files.images.length > 0) {
    await Promise.all(
      req.files.images.map(async (file, i) => {
        const filename = `pack-${Date.now()}-${i + 1}.jpeg`;
        await sharp(file.buffer)
          .resize(800, 800)
          .toFormat('jpeg')
          .jpeg({ quality: 90 })
          .toFile(`public/img/packs/${filename}`);

        savedFiles.push({ field: 'images', index: i, filename });
      }),
    );
  }

  // Reconstruct based on imageOrder
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

// 3. Update pack images with cleanup
exports.updatePackImages = catchAsync(async (req, res, next) => {
  if (!req.files && !req.body.imageOrder) return next();

  // Fetch existing pack to clean old images
  const pack = await Pack.findById(req.params.id);
  if (!pack) return next(new AppError('No pack found with that ID', 404));

  const savedFiles = [];

  // Cover image
  if (req.files && req.files.imageCover && req.files.imageCover.length > 0) {
    const filename = `pack-${Date.now()}-cover.jpeg`;
    await sharp(req.files.imageCover[0].buffer)
      .resize(800, 800)
      .toFormat('jpeg')
      .jpeg({ quality: 90 })
      .toFile(`public/img/packs/${filename}`);

    savedFiles.push({ field: 'imageCover', index: 0, filename });
  }

  // Gallery images
  if (req.files && req.files.images && req.files.images.length > 0) {
    await Promise.all(
      req.files.images.map(async (file, i) => {
        const filename = `pack-${Date.now()}-${i + 1}.jpeg`;
        await sharp(file.buffer)
          .resize(800, 800)
          .toFormat('jpeg')
          .jpeg({ quality: 90 })
          .toFile(`public/img/packs/${filename}`);

        savedFiles.push({ field: 'images', index: i, filename });
      }),
    );
  }

  // Reorder / reconstruct final imageCover and images array
  let finalImages = [];
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
      finalImages = order
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
    const galleryMatches = savedFiles.filter((sf) => sf.field === 'images');

    req.body.imageCover = coverMatch ? coverMatch.filename : pack.imageCover;
    req.body.images = galleryMatches.length > 0 ? galleryMatches.map((gm) => gm.filename) : pack.images;
    finalImages = [req.body.imageCover, ...(req.body.images || [])].filter(Boolean);
  }

  // Cleanup: Delete old images that are no longer part of the final pack images
  const keptImages = new Set(finalImages);
  const allOldImages = [pack.imageCover, ...(pack.images || [])].filter(Boolean);
  allOldImages.forEach((img) => {
    if (!keptImages.has(img)) {
      const oldImgPath = path.join(__dirname, `../public/img/packs/${img}`);
      fs.unlink(oldImgPath, (err) => {
        if (err) console.error('Failed to delete old unused pack image:', err.message);
      });
    }
  });

  next();
});

// Middleware to parse stringified JSON fields (like products or discounts) from multipart/form-data
exports.parseJsonFields = (req, res, next) => {
  if (req.body.products && typeof req.body.products === 'string') {
    try {
      req.body.products = JSON.parse(req.body.products);
    } catch (e) {
      // Allow parse failure to pass or log, mongoose will validate if it fails
    }
  }
  if (req.body.discounts && typeof req.body.discounts === 'string') {
    try {
      req.body.discounts = JSON.parse(req.body.discounts);
    } catch (e) {
      // Allow parse failure
    }
  }
  next();
};

// 4. CRUD using factory
exports.createPack = factory.createOne(Pack);
exports.getAllPacks = factory.getAll(Pack);
exports.getPack = factory.getOne(Pack);
exports.deletePack = factory.deleteOne(Pack);
exports.updatePack = factory.updateOne(Pack);

