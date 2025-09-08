-- Orders table schema for QSR application
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    order_id VARCHAR(50) UNIQUE NOT NULL,
    branch_id INT NOT NULL,
    cafeteria_id INT NOT NULL,
    items JSON NOT NULL,
    item_amount DECIMAL(10, 2) NOT NULL,
    cgst_amount DECIMAL(10, 2) NOT NULL,
    sgst_amount DECIMAL(10, 2) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    qr_value TEXT,
    user_email VARCHAR(255),
    user_name VARCHAR(255),
    order_status ENUM('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled') DEFAULT 'pending',
    payment_status ENUM('pending', 'paid', 'failed') DEFAULT 'pending',
    branch_name VARCHAR(255),
    cafeteria_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_order_id (order_id),
    INDEX idx_branch_cafeteria (branch_id, cafeteria_id),
    INDEX idx_created_at (created_at),
    INDEX idx_order_status (order_status)
);

-- Order items table for detailed item tracking (optional, for normalized approach)
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    item_description TEXT,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    INDEX idx_order_id (order_id)
);
