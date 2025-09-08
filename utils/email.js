const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail', // Change if using another provider
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

exports.sendResetEmail = async (to, resetLink) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: 'Password Reset Request',
    html: `<p>You requested a password reset. Click the link below to reset your password:</p>
           <a href="${resetLink}">${resetLink}</a>
           <p>If you did not request this, please ignore this email.</p>`,
  });
}; 