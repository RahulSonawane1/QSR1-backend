const db = require('../db');

// Fetch all branches
exports.getBranches = async (req, res) => {
  try {
    const [branches] = await db.execute('SELECT id, name FROM branches');
    return res.json({ success: true, branches });
  } catch (error) {
    console.error('Get branches error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Add a new branch
exports.addBranch = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Branch name is required' });
    const [result] = await db.execute('INSERT INTO branches (name) VALUES (?)', [name]);
    return res.status(201).json({ success: true, branchId: result.insertId });
  } catch (error) {
    console.error('Add branch error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Fetch all cafeterias
exports.getCafeterias = async (req, res) => {
  try {
    const [cafeteriasRaw] = await db.execute('SELECT id, branch_id, name, image_url FROM cafeterias');
    // Map all snake_case fields to camelCase for frontend
    const cafeterias = cafeteriasRaw.map(c => ({
      id: c.id,
      branchId: c.branch_id,
      name: c.name,
      imageUrl: c.image_url
    }));
    return res.json({ success: true, cafeterias });
  } catch (error) {
    console.error('Get cafeterias error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Add a new cafeteria
exports.addCafeteria = async (req, res) => {
  try {
    const { branchId, name, image_url } = req.body;
    if (!branchId || !name) return res.status(400).json({ success: false, message: 'Branch and cafeteria name are required' });
    const [result] = await db.execute('INSERT INTO cafeterias (branch_id, name, image_url) VALUES (?, ?, ?)', [branchId, name, image_url || null]);
    return res.status(201).json({ success: true, cafeteriaId: result.insertId });
  } catch (error) {
    console.error('Add cafeteria error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Add a new menu category (cafeteria-specific)
exports.addMenuCategory = async (req, res) => {
  try {
    const { name, key, image, cafeteriaId } = req.body;
    if (!name || !key || !cafeteriaId) return res.status(400).json({ success: false, message: 'Name, key, and cafeteriaId are required' });
    const [result] = await db.execute('INSERT INTO menu_categories (name, `key`, image, cafeteria_id) VALUES (?, ?, ?, ?)', [name, key, image || null, cafeteriaId]);
    return res.status(201).json({ success: true, categoryId: result.insertId });
  } catch (error) {
    console.error('Add menu category error:', error);
    return res.status(500).json({ success: false, message: error.sqlMessage || error.message || 'Internal server error' });
  }
};

// Fetch menu categories for a cafeteria
exports.getMenuCategories = async (req, res) => {
  try {
    const cafeteriaId = req.query.cafeteriaId;
    if (!cafeteriaId) return res.status(400).json({ success: false, message: 'cafeteriaId is required' });
    const [categories] = await db.execute('SELECT id, name, `key`, image, cafeteria_id as cafeteriaId FROM menu_categories WHERE cafeteria_id = ?', [cafeteriaId]);
    return res.json({ success: true, categories });
  } catch (error) {
    console.error('Get menu categories error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Fetch menu items for a cafeteria
exports.getMenuItems = async (req, res) => {
  try {
    const cafeteriaId = req.query.cafeteriaId;
    if (!cafeteriaId) return res.status(400).json({ success: false, message: 'cafeteriaId is required' });
    const [menuItems] = await db.execute(`
      SELECT 
        mi.id, 
        mi.name, 
        mi.description, 
        mi.price, 
        mi.image_url as imageUrl, 
        mi.category_id as categoryId, 
        mi.cafeteria_id as cafeteriaId, 
        mi.cgst, 
        mi.sgst,
        mc.key as categoryKey
      FROM menu_items mi
      LEFT JOIN menu_categories mc ON mi.category_id = mc.id
      WHERE mi.cafeteria_id = ?
    `, [cafeteriaId]);
    return res.json({ success: true, menuItems });
  } catch (error) {
    console.error('Get menu items error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Add a new menu item (cafeteria-specific)
exports.addMenuItem = async (req, res) => {
  try {
    const { name, description, price, image_url, categoryId, cafeteriaId, cgst, sgst } = req.body;
    console.log('Adding menu item:', { name, categoryId, cafeteriaId }); // Log the input
    if (!name || !price || !categoryId || !cafeteriaId) return res.status(400).json({ success: false, message: 'Name, price, categoryId, and cafeteriaId are required' });
    const [result] = await db.execute('INSERT INTO menu_items (name, description, price, image_url, category_id, cafeteria_id, cgst, sgst) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [name, description || '', price, image_url || null, categoryId, cafeteriaId, cgst || 0, sgst || 0]);
    return res.status(201).json({ success: true, menuItemId: result.insertId });
  } catch (error) {
    console.error('Add menu item error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Delete a menu item
exports.deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.execute('DELETE FROM menu_items WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }
    return res.json({ success: true, message: 'Menu item deleted successfully' });
  } catch (error) {
    console.error('Delete menu item error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Update a menu item
exports.updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, image_url, categoryId, cafeteriaId, cgst, sgst } = req.body;
    if (!name || !price || !categoryId || !cafeteriaId) {
      return res.status(400).json({ success: false, message: 'Name, price, categoryId, and cafeteriaId are required' });
    }
    const [result] = await db.execute(
      'UPDATE menu_items SET name = ?, description = ?, price = ?, image_url = ?, category_id = ?, cafeteria_id = ?, cgst = ?, sgst = ? WHERE id = ?',
      [name, description || '', price, image_url || null, categoryId, cafeteriaId, cgst || 0, sgst || 0, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }
    return res.json({ success: true, message: 'Menu item updated successfully' });
  } catch (error) {
    console.error('Update menu item error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Delete a cafeteria
exports.deleteCafeteria = async (req, res) => {
  try {
    const { id } = req.params;
    // First delete all menu items associated with this cafeteria
    await db.execute('DELETE FROM menu_items WHERE cafeteria_id = ?', [id]);
    // Then delete all menu categories associated with this cafeteria
    await db.execute('DELETE FROM menu_categories WHERE cafeteria_id = ?', [id]);
    // Finally delete the cafeteria
    const [result] = await db.execute('DELETE FROM cafeterias WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Cafeteria not found' });
    }
    return res.json({ success: true, message: 'Cafeteria and all associated items deleted successfully' });
  } catch (error) {
    console.error('Delete cafeteria error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Update a cafeteria
exports.updateCafeteria = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, image_url, branchId } = req.body;
    if (!name || !branchId) {
      return res.status(400).json({ success: false, message: 'Name and branchId are required' });
    }
    const [result] = await db.execute(
      'UPDATE cafeterias SET name = ?, image_url = ?, branch_id = ? WHERE id = ?',
      [name, image_url || null, branchId, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Cafeteria not found' });
    }
    return res.json({ success: true, message: 'Cafeteria updated successfully' });
  } catch (error) {
    console.error('Update cafeteria error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
