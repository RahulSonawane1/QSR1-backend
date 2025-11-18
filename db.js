const mysql = require('mysql2/promise');
require('dotenv').config();

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database : process.env.DB_DATABASE,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

(async () => {
    try{
        const conn = await db.getConnection();
        await conn.ping();
        console.log("Connected to AWS RDS MySQL");
        conn.release();
    }
    catch(err) {
        console.error("MySQL connection error: ",err.message);
        console.error("DB_HOST:", process.env.DB_HOST);
    }
})();

module.exports = db;
