const { Client } = require('pg');

const ref = 'uuzhepbedmyvtztnbfiu';
const host = 'aws-0-ap-northeast-2.pooler.supabase.com';
const pass = 'Gamehub%404455';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const urls = [
  // 1. Using options=reference%3D<ref>
  `postgresql://postgres:${pass}@${host}:6543/postgres?sslmode=require&options=reference%3D${ref}`,
  
  // 2. Using options=project%3D<ref>
  `postgresql://postgres:${pass}@${host}:6543/postgres?sslmode=require&options=project%3D${ref}`
];

async function run() {
  for (let i = 0; i < urls.length; i++) {
    console.log(`\nTesting URL #${i + 1}:`, urls[i].replace(/:[^:]+@/, ':****@'));
    const client = new Client({
      connectionString: urls[i],
      connectionTimeoutMillis: 5000
    });
    
    try {
      await client.connect();
      console.log('🎉 SUCCESS!');
      const res = await client.query('SELECT NOW()');
      console.log('Result:', res.rows[0]);
      await client.end();
      return;
    } catch (err) {
      console.error('FAILED:', err.message);
      await client.end().catch(() => {});
    }
  }
}

run();
