const dotenv = require('dotenv');

dotenv.config({ path: './config.env' });

const initPaymentCheckCron = require('./utils/cronJobs');

const mongoose = require('mongoose');
const app = require('./app');
const catchAsync = require('./utils/catchAsync');

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD,
);

const connect = catchAsync(async (DB) => {
  await mongoose.connect(DB);
  console.log('DBconnection successful!');
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  connect(DB);
  initPaymentCheckCron();
  console.log(`app is running at port ${port}`);
});
