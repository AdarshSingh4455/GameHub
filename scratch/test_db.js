const { Pool } = require('pg');
const { parse } = require('pg-connection-string');
require('dotenv').config({ path: '.env.local' });

async function test() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not defined in env');
    return;
  }

  // Use the session port 5432 or default to verify tables
  const sessionConnectionString = connectionString.replace(':6543/', ':5432/');
  console.log('Testing connection with URL:', sessionConnectionString.replace(/:[^:@]+@/, ':****@'));

  const config = parse(sessionConnectionString);
  if (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) {
    config.ssl = { rejectUnauthorized: false };
  }

  const pool = new Pool(config);
  try {
    const res = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log('Tables in database:');
    if (res.rows.length === 0) {
      console.log('  (No tables found)');
    } else {
      res.rows.forEach(row => console.log('  -', row.table_name));
    }
  } catch (err) {
    console.error('Database connection error:', err);
  } finally {
    await pool.end();
  }
}

test();
