const { Pool } = require('pg');
const { parse } = require('pg-connection-string');
require('dotenv').config({ path: '.env.local' });

async function test() {
  const connectionString = process.env.DATABASE_URL;
  console.log('Testing pooler connection with URL:', connectionString.replace(/:[^:@]+@/, ':****@'));

  const config = parse(connectionString);
  if (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) {
    config.ssl = { rejectUnauthorized: false };
  }

  const pool = new Pool(config);
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('Success! Current time from DB:', res.rows[0]);
  } catch (err) {
    console.error('Connection failed:', err);
  } finally {
    await pool.end();
  }
}

test();
