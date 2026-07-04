const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const factory = require('./handlerFactory');
const Category = require('../models/categoryModel');
const catchAsync = require('../utils/catchAsync');

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

exports.uploadCategoryImage = upload.single('image');

exports.resizeCategoryImage = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  // Ensure directory exists
  fs.mkdirSync('public/img/categories', { recursive: true });

  const filename = `category-${Date.now()}.jpeg`;

  await sharp(req.file.buffer)
    .rotate()
    .resize(500, 500, {
      fit: 'cover',
    })
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/categories/${filename}`);

  req.body.image = filename;
  next();
});

exports.getCategory = factory.getOne(Category);
exports.getCategories = factory.getAll(Category);
exports.createCategory = factory.createOne(Category);
exports.updateCategory = factory.updateOne(Category);
exports.deleteCategory = factory.deleteOne(Category);
