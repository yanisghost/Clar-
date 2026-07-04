const express = require('express');
const Product = require('../models/productModel');

const router = express.Router();

router.get('/products', async (req, res, next) => {
  try {
    const products = await Product.find(); // fetch all products
    res.render('products', { products }); // render Pug template
  } catch (err) {
    next(err);
  }
});

module.exports = router;
