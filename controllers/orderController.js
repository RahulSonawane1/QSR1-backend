const db = require('../db');

// Generate unique order ID in ORD001 format
const generateOrderId = async () => {
  // Get the highest existing order number (only 3-digit format: ORD001, ORD002, etc.)
  const [result] = await db.query(
    "SELECT order_id FROM orders WHERE order_id REGEXP '^ORD[0-9]{3}$' ORDER BY CAST(SUBSTRING(order_id, 4) AS UNSIGNED) DESC LIMIT 1"
  );
  
  let nextNumber = 1;
  if (result.length > 0) {
    const lastOrderId = result[0].order_id;
    const lastNumber = parseInt(lastOrderId.substring(3));
    nextNumber = lastNumber + 1;
  }
  
  // Format as ORD001, ORD002, etc.
  const orderId = `ORD${nextNumber.toString().padStart(3, '0')}`;
  return orderId;
};

// Place a new order
exports.placeOrder = async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    // console.log('Received request body:', req.body);
    const {
      branchId,
      cafeteriaId,
      cart,
      itemAmount,
      cgstAmount,
      sgstAmount,
      total,
      qrValue,
      userEmail,
      userName
    } = req.body;

    if (!branchId || !cafeteriaId || !cart || !itemAmount || !cgstAmount || !sgstAmount || !total) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Generate unique order ID on server side
    const orderId = await generateOrderId();
    // console.log('Generated order ID:', orderId);

    // Defensive: coalesce all values to null if missing
    const safeEmployeeId = employeeId ?? null;
    const safeOrderId = orderId ?? null;
    const safeBranchId = branchId ?? null;
    const safeCafeteriaId = cafeteriaId ?? null;

    const safeCart = cart ? JSON.stringify(cart) : null;
    const safeItemAmount = itemAmount ?? null;
    const safeCgstAmount = cgstAmount ?? null;
    const safeSgstAmount = sgstAmount ?? null;
    const safeTotal = total ?? null;
    const safeQrValue = qrValue ?? null;
    const safeUserEmail = userEmail ?? null;
    const safeUserName = userName ?? null;
    // console.log('Order values:', safeEmployeeId, safeOrderId, safeBranchId, safeCafeteriaId, safeCart, safeItemAmount, safeCgstAmount, safeSgstAmount, safeTotal, safeQrValue, safeUserEmail, safeUserName);
    
    // Debug: Check if branch and cafeteria exist
    const [branchCheck] = await db.query('SELECT id, name FROM branches WHERE id = ?', [safeBranchId]);
    const [cafeteriaCheck] = await db.query('SELECT id, name FROM cafeterias WHERE id = ?', [safeCafeteriaId]);
    // console.log('Branch check:', branchCheck);
    // console.log('Cafeteria check:', cafeteriaCheck);
    // Fetch branch and cafeteria names for denormalized storage
    let branchNameToStore = null;
    let cafeteriaNameToStore = null;
    if (safeBranchId) {
      const [branchRows] = await db.query('SELECT name FROM branches WHERE id = ?', [safeBranchId]);
      if (branchRows.length > 0) branchNameToStore = branchRows[0].name;
    }
    if (safeCafeteriaId) {
      const [cafeteriaRows] = await db.query('SELECT name FROM cafeterias WHERE id = ?', [safeCafeteriaId]);
      if (cafeteriaRows.length > 0) cafeteriaNameToStore = cafeteriaRows[0].name;
    }
    // Respond with order details for payment initiation.
    return res.status(200).json({ success: true, order: { ...req.body, orderId } });
  } catch (error) {
    console.error('Order placement error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Confirm order after payment success
exports.confirmOrderAfterPayment = async (req, res) => {
  // console.log('DEBUG: /api/orders/confirm called with body:', req.body);

  try {
    const { order, payment_id } = req.body;
    const {
      employeeId,
      orderId,
      branchId,
      cafeteriaId,
      cart,
      itemAmount,
      cgstAmount,
      sgstAmount,
      total,
      qrValue,
      userEmail,
      userName
    } = order;

    // Defensive: coalesce all values to null if missing
    const safeEmployeeId = employeeId ?? null;
    const safeOrderId = orderId ?? null;
    const safeBranchId = branchId ?? null;
    const safeCafeteriaId = cafeteriaId ?? null;

    const safeCart = cart ? JSON.stringify(cart) : null;
    const safeItemAmount = itemAmount ?? null;
    const safeCgstAmount = cgstAmount ?? null;
    const safeSgstAmount = sgstAmount ?? null;
    const safeTotal = total ?? null;
    const safeQrValue = qrValue ?? null;
    const safeUserEmail = userEmail ?? null;
    const safeUserName = userName ?? null;

    // Fetch branch and cafeteria names for denormalized storage
    let branchNameToStore = null;
    let cafeteriaNameToStore = null;
    if (safeBranchId) {
      const [branchRows] = await db.query('SELECT name FROM branches WHERE id = ?', [safeBranchId]);
      if (branchRows.length > 0) branchNameToStore = branchRows[0].name;
    }
    if (safeCafeteriaId) {
      const [cafeteriaRows] = await db.query('SELECT name FROM cafeterias WHERE id = ?', [safeCafeteriaId]);
      if (cafeteriaRows.length > 0) cafeteriaNameToStore = cafeteriaRows[0].name;
    }
    // console.log('DEBUG: About to insert into orders with values:', {
    //   safeEmployeeId, safeOrderId, safeBranchId, branchNameToStore, safeCafeteriaId, cafeteriaNameToStore,
    //   safeCart, safeItemAmount, safeCgstAmount, safeSgstAmount, safeTotal, safeQrValue, safeUserEmail, safeUserName
    // });
    const [result] = await db.execute(
      `INSERT INTO orders (
  employeeId, order_id, branch_id, branch_name, cafeteria_id, cafeteria_name, items, item_amount, cgst_amount, sgst_amount, total_amount, qr_value, user_email, user_name, payment_status
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        safeEmployeeId,        // 1
        safeOrderId,           // 2
        safeBranchId,          // 3
        branchNameToStore,     // 4
        safeCafeteriaId,       // 5
        cafeteriaNameToStore,  // 6
        safeCart,              // 7
        safeItemAmount,        // 8
        safeCgstAmount,        // 9
        safeSgstAmount,        // 10
        safeTotal,             // 11
        safeQrValue,           // 12
        safeUserEmail,         // 13
        safeUserName,          // 14
        'paid'                 // 15
      ]
    );
    // console.log('DEBUG: Insert result:', result);
    return res.status(201).json({ 
      success: true, 
      message: 'Order confirmed after payment.',
      order: {
        orderId,
        branchId: safeBranchId,
        cafeteriaId: safeCafeteriaId,
        cart: JSON.parse(safeCart),
        itemAmount: safeItemAmount,
        cgstAmount: safeCgstAmount,
        sgstAmount: safeSgstAmount,
        total: safeTotal,
        qrValue: safeQrValue,
        userEmail: safeUserEmail,
        userName: safeUserName
      }
    });
  } catch (error) {
    console.error('Order placement error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Update order status for a given order_id
exports.updateOrderStatus = async (req, res) => {
  try {
    const { order_id } = req.params;
    const { order_status } = req.body;
    const allowedStatuses = ['pending', 'preparing', 'ready', 'delivered'];
    if (!allowedStatuses.includes(order_status)) {
      return res.status(400).json({ success: false, message: 'Invalid order status' });
    }
    // Map 'delivered' to 'completed' for DB
    const dbStatus = order_status === 'delivered' ? 'completed' : order_status;
    const [result] = await db.execute(
      'UPDATE orders SET order_status = ? WHERE order_id = ?',
      [dbStatus, order_id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    // Return updated order
    const [orders] = await db.execute('SELECT * FROM orders WHERE order_id = ?', [order_id]);
    let updatedOrder = orders[0];
    // Map 'completed' back to 'delivered' for API response
    if (updatedOrder && updatedOrder.order_status === 'completed') {
      updatedOrder.order_status = 'delivered';
    }
    return res.status(200).json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('Update order status error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get all orders for admin
exports.getAllOrders = async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT 
        o.*,
        b.name as branch_name,
        c.name as cafeteria_name
      FROM orders o
      LEFT JOIN branches b ON o.branch_id = b.id
      LEFT JOIN cafeterias c ON o.cafeteria_id = c.id
      ORDER BY o.id DESC
    `);
    function toCamelCase(row) {
      let cart = [];
      try {
        if (Array.isArray(row.items)) {
          cart = row.items;
        } else if (typeof row.items === 'string') {
          cart = JSON.parse(row.items);
        } else {
          cart = [];
        }
      } catch (err) {
        console.error('Failed to parse order.items for order', row.id, row.items);
        cart = [];
      }
      return {
        id: row.id,
        orderId: row.order_id,
        branchId: row.branch_id,
        branchName: row.branch_name,
        cafeteriaId: row.cafeteria_id,
        cafeteriaName: row.cafeteria_name,
        cart,
        itemAmount: Number(row.item_amount),
        cgstAmount: Number(row.cgst_amount),
        sgstAmount: Number(row.sgst_amount),
        total: Number(row.total_amount),
        qrValue: row.qr_value,
        userEmail: row.user_email,
        userName: row.user_name,
        orderTime: row.created_at,
        orderStatus: row.order_status === 'completed' ? 'delivered' : row.order_status
      };
    }
    const parsedOrders = orders.map(toCamelCase);
    return res.json({ success: true, orders: parsedOrders });
  } catch (error) {
    console.error('Get all orders error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get order details by orderId (public, for QR)
exports.getOrderByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Missing orderId' });
    }
    const [orders] = await db.query(`
      SELECT 
        o.*, b.name as branch_name, c.name as cafeteria_name
      FROM orders o
      LEFT JOIN branches b ON o.branch_id = b.id
      LEFT JOIN cafeterias c ON o.cafeteria_id = c.id
      WHERE o.order_id = ?
      LIMIT 1
    `, [orderId]);
    if (!orders || orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const row = orders[0];
    let cart = [];
    try {
      if (Array.isArray(row.items)) cart = row.items;
      else if (typeof row.items === 'string') cart = JSON.parse(row.items);
    } catch (err) { cart = []; }
    const order = {
      id: row.id,
      orderId: row.order_id,
      branchId: row.branch_id,
      branchName: row.branch_name,
      cafeteriaId: row.cafeteria_id,
      cafeteriaName: row.cafeteria_name,
      cart,
      itemAmount: Number(row.item_amount),
      cgstAmount: Number(row.cgst_amount),
      sgstAmount: Number(row.sgst_amount),
      total: Number(row.total_amount),
      qrValue: row.qr_value,
      userEmail: row.user_email,
      userName: row.user_name,
      orderTime: row.created_at,
      orderStatus: row.order_status === 'completed' ? 'delivered' : row.order_status
    };
    return res.json({ success: true, order });
  } catch (error) {
    console.error('Get order by orderId error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get all orders for the logged-in user
exports.getMyOrders = async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Employee ID missing from token.' });
    }
    const [orders] = await db.query(`
      SELECT 
        o.*,
        b.name as branch_name,
        c.name as cafeteria_name
      FROM orders o
      LEFT JOIN branches b ON o.branch_id = b.id
      LEFT JOIN cafeterias c ON o.cafeteria_id = c.id
      WHERE o.employeeId = ?
      ORDER BY o.id DESC
    `, [employeeId]);
    // console.log('Fetched orders from DB:', orders);
    // Convert snake_case DB columns to camelCase for frontend
    function toCamelCase(row) {
      let cart = [];
      try {
        if (Array.isArray(row.items)) {
          cart = row.items;
        } else if (typeof row.items === 'string') {
          cart = JSON.parse(row.items);
        } else {
          cart = [];
        }
      } catch (err) {
        console.error('Failed to parse order.items for order', row.id, row.items);
        cart = [];
      }
      return {
        id: row.id,
        orderId: row.order_id,
        branchId: row.branch_id,
        branchName: row.branch_name,
        cafeteriaId: row.cafeteria_id,
        cafeteriaName: row.cafeteria_name,
        cart,
        itemAmount: Number(row.item_amount),
        cgstAmount: Number(row.cgst_amount),
        sgstAmount: Number(row.sgst_amount),
        total: Number(row.total_amount),
        qrValue: row.qr_value,
        userEmail: row.user_email,
        userName: row.user_name,
        orderTime: row.created_at,
        orderStatus: row.order_status === 'completed' ? 'delivered' : row.order_status
      };
    }
    const parsedOrders = orders.map(toCamelCase);
    return res.json({ success: true, orders: parsedOrders });
  } catch (error) {
    console.error('Get my orders error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
