const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const path = require('path');
const menuRoutes = require('./routes/menuRoutes');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '../client')));

// Use auth routes
app.use('/api/orders', orderRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/employees', employeeRoutes);
app.use(authRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});