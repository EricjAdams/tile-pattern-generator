require('dotenv').config(); // 1. Must be at the very top to load your .env file
const mysql = require("mysql2");

const db = mysql.createConnection({
  // 2. Map the variables from your .env file here
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, 
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }
  console.log("Connected to MySQL via Environment Variables");
});

module.exports = db;