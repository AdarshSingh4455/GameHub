const { Client } = require('pg');

async function run() {
  const host = 'aws-0-ap-northeast-2.pooler.supabase.com';
  const pass = 'Gamehub%404455';
  
  // Test with username "postgres" (no tenant suffix)
  const url = `postgresql://postgres:${pass}@${host}:6543/postgres?pgbouncer=true`;
  console.log('Testing with username: postgres');
  
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 5000
  });
  
  try {
    await client.connect();
    console.log('SUCCESS!');
    await client.end();
  } catch (err) {
    console.error('FAILED:', err.message);
    await client.end().catch(() => {});
  }
}

run();
