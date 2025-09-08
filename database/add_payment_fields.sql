-- Add Razorpay payment fields to orders table
ALTER TABLE orders 
ADD COLUMN razorpay_order_id VARCHAR(100),
ADD COLUMN razorpay_payment_id VARCHAR(100),
ADD COLUMN payment_method VARCHAR(50) DEFAULT 'razorpay',
ADD INDEX idx_razorpay_order_id (razorpay_order_id),
ADD INDEX idx_payment_status (payment_status);
