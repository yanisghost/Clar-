const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const path = require('path');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');

// Routes
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const packRoutes = require('./routes/packRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const statsRoutes = require('./routes/statisticsRoutes');
const discountRoutes = require('./routes/discountRoutes');
const viewRoutes = require('./routes/viewRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const shippingRoutes = require('./routes/shippingRoutes');
const couponRoutes = require('./routes/couponRoutes');
const cors = require('cors');
const checkoutController = require('./controllers/checkoutController');

const app = express();

// Enable CORS
app.use(cors());

// 1) Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: false, // Allow images to load cross-origin
  }),
);

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

const limiter = rateLimit({
  max: process.env.NODE_ENV === 'development' ? 50000 : 2000,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour',
});
app.use('/api', limiter);

// ── Yalidine Webhook ─────────────────────────────────────────────────────────────
// IMPORTANT: Must be mounted BEFORE express.json() so we receive the raw Buffer
// body needed for HMAC-SHA256 signature verification.
app.use(
  '/api/v1/webhooks/yalidine',
  express.raw({ type: 'application/json' }),
  webhookRoutes
);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true })); // ✅ Needed for Pug form submissions

app.use(
  mongoSanitize({
    replaceWith: '_',
  }),
);
app.use(xss());
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsAverage',
      'ratingsQuantity',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  }),
);

app.use(express.static(`${__dirname}/public`));

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// 2) View Engine Setup
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// 3) Pug Test Routes
app.use('/', viewRoutes);

// Show checkout page (cart items + discount input)
app.post('/checkout', checkoutController.checkoutPage);

// Confirm order (apply discount code)
app.post('/checkout/confirm', checkoutController.confirmOrder);

// 4) API Routes
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/packs', packRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/stats', statsRoutes);
app.use('/api/v1/discounts', discountRoutes);
app.use('/api/v1/shipping', shippingRoutes);
app.use('/api/v1/coupons', couponRoutes);

// 5) Catch-all handler
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

// Global error handler
app.use(globalErrorHandler);

module.exports = app;
