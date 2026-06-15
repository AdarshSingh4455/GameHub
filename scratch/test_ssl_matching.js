const { Client } = require('pg');

const ref = 'uuzhepbedmyvtztnbfiu';
const host = 'aws-0-ap-northeast-2.pooler.supabase.com';
const pass = 'Gamehub%404455';

async function run() {
  // Test 1: EXACT duplication of URL #4 from test_pooler_params.js
  console.log('\n--- Test 1: URL #4 (no options) ---');
  const client1 = new Client({
    connectionString: `postgresql://postgres.${ref}:${pass}@${host}:6543/postgres?sslmode=require`,
    connectionTimeoutMillis: 5000
  });
  try {
    await client1.connect();
    console.log('SUCCESS!');
    await client1.end();
  } catch (err) {
    console.error('FAILED:', err.message);
    await client1.end().catch(() => {});
  }

  // Test 2: URL #4 with rejectUnauthorized: false in constructor
  console.log('\n--- Test 2: URL #4 with rejectUnauthorized: false ---');
  const client2 = new Client({
    connectionString: `postgresql://postgres.${ref}:${pass}@${host}:6543/postgres?sslmode=require`,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 5000
  });
  try {
    await client2.connect();
    console.log('SUCCESS!');
    const res = await client2.query('SELECT NOW()');
    console.log('Result:', res.rows[0]);
    await client2.end();
  } catch (err) {
    console.error('FAILED:', err.message);
    await client2.end().catch(() => {});
  }
}

run();
