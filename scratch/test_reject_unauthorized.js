const { Client } = require('pg');

const ref = 'uuzhepbedmyvtztnbfiu';
const host = 'aws-0-ap-northeast-2.pooler.supabase.com';
const pass = 'Gamehub%404455';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function run() {
  console.log('Testing with NODE_TLS_REJECT_UNAUTHORIZED = 0...');
  
  const client = new Client({
    connectionString: `postgresql://postgres.${ref}:${pass}@${host}:6543/postgres?sslmode=require`,
    connectionTimeoutMillis: 5000
  });
  
  try {
    await client.connect();
    console.log('🎉 SUCCESS! Connected to Supabase pooler!');
    const res = await client.query('SELECT NOW()');
    console.log('Result:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('FAILED:', err.message);
    await client.end().catch(() => {});
  }
}

run();
