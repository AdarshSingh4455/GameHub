const { Pool } = require('pg');
const { parse } = require('pg-connection-string');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const sessionConnectionString = connectionString.replace(':6543/', ':5432/');
  const config = parse(sessionConnectionString);
  if (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) {
    config.ssl = { rejectUnauthorized: false };
  }

  const pool = new Pool(config);
  try {
    const res = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'users';
    `);
    console.log('Columns:');
    res.rows.forEach(r => {
      console.log(`- ${r.column_name}: ${r.data_type}`);
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
