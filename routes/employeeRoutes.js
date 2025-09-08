const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');

// Upload Excel file and import directly to database
router.post('/upload-excel', employeeController.uploadExcel);

// Export employees to Excel
router.get('/export', employeeController.exportEmployees);

// Get employee statistics
router.get('/stats', employeeController.getEmployeeStats);

module.exports = router;
