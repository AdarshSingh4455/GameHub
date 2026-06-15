const { Client } = require('pg');

const ref = 'uuzhepbedmyvtztnbfiu';
const host = 'aws-0-ap-northeast-2.pooler.supabase.com';
const pass = 'Gamehub%404455';
const url = `postgresql://postgres.${ref}:${pass}@${host}:6543/postgres?pgbouncer=true`;

async function run() {
  console.log('Connecting with SSL (rejectUnauthorized: false) to:', url.replace(/:[^:]+@/, ':****@'));
  const client = new Client({
    connectionString: url,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 5000
  });
  
  try {
    await client.connect();
    console.log('🎉 SUCCESS! Connected successfully via SSL + Pooler!');
    const res = await client.query('SELECT NOW()');
    console.log('Server time:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('FAILED:', err.message);
    await client.end().catch(() => {});
  }
}

run();
