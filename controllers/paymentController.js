const razorpay = require('../config/razorpay');
const crypto = require('crypto');
const db = require('../db');

// Create Razorpay order
exports.createOrder = async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;

    if (!amount || !receipt) {
      return res.status(400).json({
        success: false,
        message: 'Amount and receipt are required'
      });
    }

    const options = {
      amount: amount * 100, // Convert to paise
      currency,
      receipt,
      payment_capture: 1,
      notes: {
        order_id: receipt,
        payment_for: 'QSR Food Order'
      }
    };

    const order = await razorpay.orders.create(options);
    
    return res.status(201).json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create payment order'
    });
  }
};

// Verify payment signature
exports.verifyPayment = async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      order_id // Our internal order ID
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification parameters'
      });
    }

    // Create signature for verification
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', 'TeowN3EqU6pBLIKjIoSikcTE')
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      // Update order payment status in database
      let order = null;
      if (order_id) {
        await db.execute(
          'UPDATE orders SET payment_status = ?, razorpay_order_id = ?, razorpay_payment_id = ?, razorpay_signature = ? WHERE order_id = ?',
          ['paid', razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id]
        );
        // Fetch the order after updating payment status
        const [orders] = await db.execute('SELECT * FROM orders WHERE order_id = ?', [order_id]);
        if (orders.length > 0) {
          order = orders[0];
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        payment_id: razorpay_payment_id,
        order
      });
    } else {
      // Update order payment status to failed
      if (order_id) {
        await db.execute(
          'UPDATE orders SET payment_status = ?, razorpay_signature = ? WHERE order_id = ?',
          ['failed', razorpay_signature, order_id]
        );
      }

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Payment verification failed'
    });
  }
};

// Get payment details
exports.getPaymentDetails = async (req, res) => {
  try {
    const { payment_id } = req.params;

    const payment = await razorpay.payments.fetch(payment_id);
    
    return res.status(200).json({
      success: true,
      payment
    });
  } catch (error) {
    console.error('Get payment details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch payment details'
    });
  }
};
