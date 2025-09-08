const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');

// Create Razorpay order
router.post('/create-order', authMiddleware, paymentController.createOrder);

// Verify payment
router.post('/verify', authMiddleware, paymentController.verifyPayment);

// Get payment details
router.get('/details/:payment_id', authMiddleware, paymentController.getPaymentDetails);

module.exports = router;
