const { Client } = require('pg');

const ref = 'uuzhepbedmyvtztnbfiu';
const host = 'aws-0-ap-northeast-2.pooler.supabase.com';
const pass = 'Gamehub%404455';

async function run() {
  console.log('Testing with username: postgres.uuzhepbedmyvtztnbfiu and SSL...');
  
  const client = new Client({
    host: host,
    port: 6543,
    user: `postgres.${ref}`,
    password: decodeURIComponent(pass),
    database: 'postgres',
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    console.log('SUCCESS with SSL!');
    const res = await client.query('SELECT NOW()');
    console.log('Result:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('FAILED:', err.message);
    await client.end().catch(() => {});
  }
}

run();
