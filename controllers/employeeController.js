const db = require('../db');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Expected column names for users table
const EXPECTED_COLUMNS = [
  'fullName',
  'employeeId', 
  'email',
  'phone',
  'password',
  'branch'
];

// Validate Excel columns match expected schema
const validateExcelColumns = (columns) => {
  const normalizedColumns = columns.map(col => col.trim());
  const missingColumns = EXPECTED_COLUMNS.filter(col => !normalizedColumns.includes(col));
  const extraColumns = normalizedColumns.filter(col => !EXPECTED_COLUMNS.includes(col));
  
  return {
    isValid: missingColumns.length === 0,
    missingColumns,
    extraColumns,
    normalizedColumns
  };
};

// Upload and validate Excel file
exports.uploadExcel = [
  upload.single('excelFile'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'No file uploaded' 
        });
      }

      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Excel file must contain at least a header row and one data row'
        });
      }

      // Get headers (first row)
      const headers = jsonData[0];
      const validation = validateExcelColumns(headers);

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Excel columns do not match required format',
          missingColumns: validation.missingColumns,
          extraColumns: validation.extraColumns,
          expectedColumns: EXPECTED_COLUMNS
        });
      }

      // Convert data rows to objects
      const employees = jsonData.slice(1).map(row => {
        const employee = {};
        headers.forEach((header, index) => {
          employee[header.trim()] = row[index] || '';
        });
        return employee;
      });

      // Validate employee data
      const validationErrors = [];
      employees.forEach((employee, index) => {
        const rowNumber = index + 2; // +2 because index starts at 0 and we skip header
        
        if (!employee.fullName || !employee.employeeId || !employee.email || !employee.phone || !employee.password || !employee.branch) {
          validationErrors.push(`Row ${rowNumber}: Missing required fields`);
        }
        
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (employee.email && !emailRegex.test(employee.email)) {
          validationErrors.push(`Row ${rowNumber}: Invalid email format`);
        }
        
        // Basic phone validation
        if (employee.phone && !/^\d{10}$/.test(employee.phone.toString().replace(/\D/g, ''))) {
          validationErrors.push(`Row ${rowNumber}: Phone number must be 10 digits`);
        }
      });

      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Data validation failed',
          errors: validationErrors
        });
      }

      // Check for duplicate employee IDs in the file
      const employeeIds = employees.map(emp => emp.employeeId);
      const duplicateIds = employeeIds.filter((id, index) => employeeIds.indexOf(id) !== index);
      
      if (duplicateIds.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Duplicate employee IDs found in file',
          duplicateIds: [...new Set(duplicateIds)]
        });
      }

      // Check for existing employee IDs in database
      const existingEmployeeIds = await checkExistingEmployees(employeeIds);
      
      if (existingEmployeeIds.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Some employee IDs already exist in database',
          existingEmployeeIds
        });
      }

      // Hash passwords and insert directly to database
      const employeesWithHashedPasswords = await Promise.all(
        employees.map(async (employee) => {
          const hashedPassword = await bcrypt.hash(employee.password, 10);
          return {
            ...employee,
            password: hashedPassword
          };
        })
      );

      // Bulk insert employees
      const insertQuery = `
        INSERT INTO users (fullName, employeeId, email, phone, password, branch) 
        VALUES ?
      `;
      
      const values = employeesWithHashedPasswords.map(emp => [
        emp.fullName,
        emp.employeeId,
        emp.email,
        emp.phone,
        emp.password,
        emp.branch
      ]);

      await db.query(insertQuery, [values]);

      res.json({
        success: true,
        message: `Successfully imported ${employees.length} employees to database!`,
        importedCount: employees.length,
        employees: employees.slice(0, 5) // Return first 5 for preview
      });

    } catch (error) {
      console.error('Excel upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing Excel file',
        error: error.message
      });
    }
  }
];

// Check existing employees in database
const checkExistingEmployees = async (employeeIds) => {
  try {
    const placeholders = employeeIds.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT employeeId FROM users WHERE employeeId IN (${placeholders})`,
      employeeIds
    );
    return rows.map(row => row.employeeId);
  } catch (error) {
    console.error('Error checking existing employees:', error);
    throw error;
  }
};


// Get employee statistics
exports.getEmployeeStats = async (req, res) => {
  try {
    const [totalCount] = await db.query('SELECT COUNT(*) as total FROM users');
    const [branchStats] = await db.query(`
      SELECT branch, COUNT(*) as count 
      FROM users 
      GROUP BY branch 
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      totalEmployees: totalCount[0].total,
      branchStats: branchStats
    });

  } catch (error) {
    console.error('Employee stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching employee statistics'
    });
  }
};

// Bulk import employees to database
exports.importEmployees = [
  upload.single('excelFile'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'No file uploaded' 
        });
      }

      // Parse Excel file again (in case of direct import)
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      const headers = jsonData[0];
      const employees = jsonData.slice(1).map(row => {
        const employee = {};
        headers.forEach((header, index) => {
          employee[header.trim()] = row[index] || '';
        });
        return employee;
      });

      // Hash passwords and prepare data for insertion
      const employeesWithHashedPasswords = await Promise.all(
        employees.map(async (employee) => {
          const hashedPassword = await bcrypt.hash(employee.password, 10);
          return {
            ...employee,
            password: hashedPassword
          };
        })
      );

      // Bulk insert employees
      const insertQuery = `
        INSERT INTO users (fullName, employeeId, email, phone, password, branch) 
        VALUES ?
      `;
      
      const values = employeesWithHashedPasswords.map(emp => [
        emp.fullName,
        emp.employeeId,
        emp.email,
        emp.phone,
        emp.password,
        emp.branch
      ]);

      await db.query(insertQuery, [values]);

      res.json({
        success: true,
        message: `Successfully imported ${employees.length} employees`,
        importedCount: employees.length
      });

    } catch (error) {
      console.error('Employee import error:', error);
      res.status(500).json({
        success: false,
        message: 'Error importing employees',
        error: error.message
      });
    }
  }
];

// Export employees to Excel
exports.exportEmployees = async (req, res) => {
  try {
    // Fetch all employees from database (excluding passwords)
    const [rows] = await db.query(`
      SELECT fullName, employeeId, email, phone, branch
      FROM users 
      ORDER BY employeeId ASC
    `);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No employees found'
      });
    }

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=employees_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    res.send(excelBuffer);

  } catch (error) {
    console.error('Employee export error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting employees',
      error: error.message
    });
  }
};

