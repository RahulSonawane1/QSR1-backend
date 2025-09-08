const db = require('../db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendResetEmail } = require('../utils/email');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

exports.register = async (req, res) => {
  try {
    const { fullName, employeeId, email, phone, password, branch } = req.body;
    if (!fullName || !employeeId || !email || !phone || !password || !branch) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    // Check if user exists (by employeeId or email)
    const [existingRows] = await db.query(
      'SELECT * FROM users WHERE employeeId = ? OR email = ? LIMIT 1',
      [employeeId, email]
    );
    if (existingRows.length > 0) {
      return res.status(409).json({ success: false, message: 'Employee ID or Email already registered.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO users (fullName, employeeId, email, phone, password, branch) VALUES (?, ?, ?, ?, ?, ?)',
      [fullName, employeeId, email, phone, hashedPassword, branch]
    );
    res.json({ success: true, message: 'Registration successful.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.', error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { employeeId, password } = req.body;
    if (!employeeId || !password) {
      return res.status(400).json({ success: false, message: 'Employee ID and password are required.' });
    }
    const [rows] = await db.query('SELECT * FROM users WHERE employeeId = ? LIMIT 1', [employeeId]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid Employee ID or password.' });
    }
    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid Employee ID or password.' });
    }
    let branchId = 1;
    try {
      const [branchRows] = await db.query('SELECT id FROM branches WHERE name = ? LIMIT 1', [user.branch]);
      if (branchRows.length > 0) {
        branchId = branchRows[0].id;
      }
    } catch (err) {
      console.error('Error fetching branchId:', err);
    }
    const token = jwt.sign({ employeeId: user.employeeId }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        employeeId: user.employeeId,
        fullName: user.fullName,
        email: user.email,
        branch: user.branch,
        branchId
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.', error: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  const { employeeId } = req.body;
  if (!employeeId) {
    return res.status(400).json({ message: 'Employee ID is required.' });
  }
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE employeeId = ? LIMIT 1', [employeeId]);
    if (rows.length > 0) {
      const user = rows[0];
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 3600000); // 1 hour
      await db.query(
        'UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE employeeId = ?',
        [token, expires, user.employeeId]
      );
      const resetLink = `http://192.168.1.8:4000/reset-password.html?token=${token}`;
      console.log('Sending reset email to:', user.email, 'with link:', resetLink);
      try {
        await sendResetEmail(user.email, resetLink);
        console.log('Reset email sent successfully.');
      } catch (emailErr) {
        console.error('Error sending reset email:', emailErr);
      }
    } else {
      console.log('No user found for employeeId:', employeeId);
    }
    res.json({ message: 'If the Employee ID exists, you will receive password reset instructions shortly.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
};

exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ message: 'Token and new password are required.' });
  }
  try {
    const [rows] = await db.query(
      'SELECT * FROM users WHERE resetPasswordToken = ? AND resetPasswordExpires > NOW() LIMIT 1',
      [token]
    );
    if (rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired token.' });
    }
    const user = rows[0];
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      'UPDATE users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE employeeId = ?',
      [hashedPassword, user.employeeId]
    );
    res.json({ message: 'Password has been reset successfully.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
}; 