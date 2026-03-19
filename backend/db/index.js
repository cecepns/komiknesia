const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'komiknesia',
  waitForConnections: true,
  connectionLimit: 30,
  queueLimit: 100,
  connectTimeout: 10000,
  acquireTimeout: 10000,
};

const db = mysql.createPool(dbConfig);

module.exports = db;

