const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

pool.on('error', (err) => {
  console.error("❌ Unexpected database error:", err.message);
});

console.log("✅ Database pool initialized");

module.exports = pool;
