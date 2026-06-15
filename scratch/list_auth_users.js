const { Pool } = require('pg');
const { parse } = require('pg-connection-string');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not defined');
    return;
  }
  const sessionConnectionString = connectionString.replace(':6543/', ':5432/');
  const config = parse(sessionConnectionString);
  if (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) {
    config.ssl = { rejectUnauthorized: false };
  }

  const pool = new Pool(config);
  try {
    const res = await pool.query(`
      SELECT id, email, confirmed_at, last_sign_in_at
      FROM auth.users;
    `);
    console.log('Auth Users:');
    res.rows.forEach(r => {
      console.log(`- ID: ${r.id}, Email: ${r.email}, Confirmed: ${r.confirmed_at}, LastSignIn: ${r.last_sign_in_at}`);
    });
  } catch (err) {
    console.error('Error querying auth.users:', err);
  } finally {
    await pool.end();
  }
}

main();
