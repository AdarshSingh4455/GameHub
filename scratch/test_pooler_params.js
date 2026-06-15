const { Client } = require('pg');

const ref = 'uuzhepbedmyvtztnbfiu';
const host = 'aws-0-ap-northeast-2.pooler.supabase.com';
const pass = 'Gamehub%404455';

const urls = [
  `postgresql://postgres.${ref}:${pass}@${host}:6543/postgres?pgbouncer=true`,
  `postgresql://postgres.${ref}:${pass}@${host}:6543/postgres`,
  `postgresql://postgres.${ref}:${pass}@${host}:5432/postgres`,
  `postgresql://postgres.${ref}:${pass}@${host}:6543/postgres?sslmode=require`,
  `postgresql://postgres.${ref}:${pass}@${host}:6543/postgres?sslmode=no-verify`
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
      console.log('SUCCESS!');
      await client.end();
      return;
    } catch (err) {
      console.error('FAILED:', err.message);
      await client.end().catch(() => {});
    }
  }
}

run();
