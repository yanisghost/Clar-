const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const User = require('../models/userModel');
const sendEmail = require('../utils/email');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const cookieOptions = {
  expires: new Date(
    Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
  ),
  httpOnly: true,
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
  res.cookie('jwt', token, cookieOptions);
  user.password = undefined;
  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  // Generate random 6-digit confirmation code
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  const codeExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAT: req.body.passwordChangedAT,
    role: 'user',
    homeAddress: req.body.homeAddress,
    phoneNumber: req.body.phoneNumber,
    wilaya: req.body.wilaya,
    baladia: req.body.baladia,
    isVerified: false,
    emailVerificationCode: verificationCode,
    emailVerificationExpires: codeExpires,
  });

  const message = `Welcome to Opzia Cosmetics!\n\nYour email verification code is: ${verificationCode}\n\nThis code is valid for 10 minutes.`;
  try {
    await sendEmail({
      email: newUser.email,
      subject: 'Confirm Your Email - Opzia Cosmetics',
      message,
    });

    res.status(201).json({
      status: 'success',
      message: 'Verification code sent to email.',
      email: newUser.email,
    });
  } catch (err) {
    // Delete unverified user if email fails so they can immediately retry
    await User.findByIdAndDelete(newUser._id);
    return next(new AppError('There was an error sending the verification email. Please try again.', 500));
  }
});

exports.verifyEmail = catchAsync(async (req, res, next) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return next(new AppError('Please provide email and verification code.', 400));
  }

  const user = await User.findOne({
    email: email.toLowerCase(),
    emailVerificationCode: code,
    emailVerificationExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new AppError('Verification code is invalid or has expired.', 400));
  }

  user.isVerified = true;
  user.emailVerificationCode = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  createSendToken(user, 200, res);
});

exports.resendVerificationCode = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  if (!email) {
    return next(new AppError('Please provide an email address.', 400));
  }

  const user = await User.findOne({ email: email.toLowerCase(), isVerified: false });
  if (!user) {
    return next(new AppError('No unverified user found with this email address.', 404));
  }

  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  user.emailVerificationCode = verificationCode;
  user.emailVerificationExpires = Date.now() + 10 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  const message = `Your new Opzia Cosmetics email verification code is: ${verificationCode}\n\nThis code is valid for 10 minutes.`;
  await sendEmail({
    email: user.email,
    subject: 'New Verification Code - Opzia Cosmetics',
    message,
  });

  res.status(200).json({
    status: 'success',
    message: 'Verification code resent successfully.',
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  //1) check if email and password exists
  if (!email || !password) {
    return next(new AppError('Please provide eamil and password', 400));
  }
  //2) check if user exists && password is correct

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // Check if email has been verified (exempt admin/managers created by admin panel)
  if (user.role === 'user' && !user.isVerified) {
    return res.status(403).json({
      status: 'fail',
      error: 'unverified',
      message: 'Your email has not been verified yet.',
      email: user.email,
    });
  }

  //3) check if everything ok , send token to client
  createSendToken(user, 200, res);
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1) getting token and check of it's there
  let token;
  console.log(req.headers.authorization);
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access', 401),
    );
  }
  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) check if user still exists
  const freshUser = await User.findById(decoded.id);
  if (!freshUser) {
    return next(
      new AppError('The token belonging to this token does no longer exist.'),
    );
  }
  //4) check if user changed password after the token was issued
  if (freshUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password ! Please log in again', 401),
    );
  }

  // Grant Access to protected Route
  req.user = freshUser;
  next();
});

exports.isLoggedIn = catchAsync(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
      const freshUser = await User.findById(decoded.id);
      if (freshUser && !freshUser.changedPasswordAfter(decoded.iat)) {
        req.user = freshUser;
      }
    } catch (err) {
      // Ignore invalid token verification errors for public endpoints
    }
  }
  next();
});

exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    console.log(roles);
    console.log(req.user.role);
    //roles ['admin' , 'lead-guide']. role = 'user'
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403),
      );
    }
    next();
  };

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  console.log(user);
  if (!user) {
    return next(new AppError('there is no user with email address', 404));
  }
  // 2) generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  //3 ) Send it to user's email
  const frontendURL = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetURL = `${frontendURL}/account/reset/${resetToken}`;

  const message = `Forgot your password? Reset your password by clicking this link:\n\n${resetURL}\n\nIf you didn't forget your password, please ignore this email!`;
  try {
    await sendEmail({
      email: user.email,
      subject: 'Your password reset token (valid for 10 min)',
      message,
    });

    res.status(200).json({
      status: 'success',
      message: 'Token send to email',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'There was an error sending the email. Try again later!',
        500,
      ),
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  //1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  // 2) if token has not expired , and there is user , set the new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();
  // 3) Update changedPasswordAt property for the user
  // 4) Log the user in , send JWT
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from the collection
  const user = await User.findById(req.user.id).select('+password');

  // 2) check if POSTed current password is correct
  const iscorrect = await user.correctPassword(
    req.body.passwordConfirm,
    user.password,
  );

  if (!iscorrect) return next(new AppError('The password does not match', 401));

  // 3) if so , update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.password;
  await user.save();
  // 4) Log user in , send Jwt
  createSendToken(user, 200, res);
});
