const { Client } = require('pg');

const ref = 'uuzhepbedmyvtztnbfiu';
const host = 'aws-0-ap-northeast-2.pooler.supabase.com';
const pass = 'Gamehub%404455';

const testCases = [
  { url: `postgresql://postgres.${ref}:${pass}@${host}:6543/postgres?pgbouncer=true`, desc: 'Port 6543 with pgbouncer=true' },
  { url: `postgresql://postgres.${ref}:${pass}@${host}:6543/postgres`, desc: 'Port 6543 without pgbouncer=true' },
  { url: `postgresql://postgres.${ref}:${pass}@${host}:5432/postgres`, desc: 'Port 5432' }
];

async function run() {
  for (const tc of testCases) {
    console.log(`\nTesting: ${tc.desc}`);
    const client = new Client({
      connectionString: tc.url,
      ssl: {
        rejectUnauthorized: false
      },
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
