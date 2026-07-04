const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1) Create a transporter
  let transporter;

  if (process.env.EMAIL_HOST && process.env.EMAIL_USERNAME && process.env.EMAIL_PASSWORD) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 2525,
      secure: Number(process.env.EMAIL_PORT) === 465, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  } else {
    // Development Mock/Fallback: Print to console so developer can see the code/token
    console.log('====================================');
    console.log('✉️  DEVELOPMENT EMAIL FALLBACK:');
    console.log(`To: ${options.email}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Message:\n${options.message}`);
    console.log('====================================');
    return;
  }

  // 2) Define the email options
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Opzia Cosmetics <no-reply@opzia.com>',
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  // 3) Actually send the email
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
