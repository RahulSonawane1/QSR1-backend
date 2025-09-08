const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');

// Add new branch
router.post('/branches', menuController.addBranch);

// Fetch all branches
router.get('/branches', menuController.getBranches);

// Add new cafeteria
router.post('/cafeterias', menuController.addCafeteria);

// Fetch all cafeterias
router.get('/cafeterias', (req, res) => {
  menuController.getCafeterias(req, res, (rows) => {
    // Map branch_id to branchId for frontend compatibility
    const cafeterias = rows.map(c => ({ ...c, branchId: c.branch_id }));
    res.json({ success: true, cafeterias });
  });
});

// Add new menu category
router.post('/menu-categories', menuController.addMenuCategory);

// Fetch menu categories (for a cafeteria)
router.get('/menu-categories', menuController.getMenuCategories);

// Add new menu item
router.post('/menu-items', menuController.addMenuItem);

// Fetch menu items (for a cafeteria)
router.get('/menu-items', menuController.getMenuItems);

// Delete a menu item
router.delete('/menu-items/:id', menuController.deleteMenuItem);

// Update a menu item
router.put('/menu-items/:id', menuController.updateMenuItem);

// Delete a cafeteria
router.delete('/cafeterias/:id', menuController.deleteCafeteria);

// Update a cafeteria
router.put('/cafeterias/:id', menuController.updateCafeteria);

module.exports = router;
