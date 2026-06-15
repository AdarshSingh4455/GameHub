const { Pool } = require('pg');
const { parse } = require('pg-connection-string');
require('dotenv').config({ path: '.env.local' });

async function countRows() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not defined in env');
    return;
  }

  const sessionConnectionString = connectionString.replace(':6543/', ':5432/');
  const config = parse(sessionConnectionString);
  if (!connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) {
    config.ssl = { rejectUnauthorized: false };
  }

  const pool = new Pool(config);
  try {
    const gamesRes = await pool.query('SELECT COUNT(*) FROM "Game"');
    const achievementsRes = await pool.query('SELECT COUNT(*) FROM "Achievement"');
    
    console.log('--- Row Counts after Seeding ---');
    console.log('Games count:', gamesRes.rows[0].count);
    console.log('Achievements count:', achievementsRes.rows[0].count);
    console.log('--------------------------------');
  } catch (err) {
    console.error('Database connection error:', err);
  } finally {
    await pool.end();
  }
}

countRows();
