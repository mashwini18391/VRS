/* ═══════════════════════════════════════════════════
   VRS Database — MySQL Connection Pool
   ═══════════════════════════════════════════════════ */

const mysql = require('mysql2/promise');

let pool = null;

/**
 * Get or create MySQL connection pool
 */
function getPool() {
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'vrs_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });

  console.log('✅ MySQL connection pool created');
  return pool;
}

/**
 * Execute a query
 */
async function query(sql, params = []) {
  const db = getPool();
  try {
    const [rows] = await db.execute(sql, params);
    return rows;
  } catch (err) {
    console.error('❌ Database query error:', err.message);
    throw err;
  }
}

/**
 * Check database connection
 */
async function checkConnection() {
  try {
    const db = getPool();
    const connection = await db.getConnection();
    console.log('✅ MySQL connected successfully');
    connection.release();
    return true;
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    return false;
  }
}

module.exports = { getPool, query, checkConnection };
