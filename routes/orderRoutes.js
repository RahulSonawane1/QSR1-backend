const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const orderController = require('../controllers/orderController');

const { placeOrder, getMyOrders, getAllOrders, updateOrderStatus, confirmOrderAfterPayment } = orderController;

// Confirm order after payment
router.post('/confirm', confirmOrderAfterPayment);

// Place a new order (JWT protected)
router.post('/', authMiddleware, placeOrder);

// Get all orders for the logged-in user (JWT protected)
router.get('/mine', authMiddleware, getMyOrders);

// Get all orders (admin, unprotected)
router.get('/all', getAllOrders);

// Update order status (admin, unprotected for now)
router.patch('/:order_id/status', updateOrderStatus);

// Public endpoint for QR code scan to get order details
router.get('/public/:orderId', orderController.getOrderByOrderId);

module.exports = router;
