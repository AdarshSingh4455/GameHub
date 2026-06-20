const { Client } = require('pg');

const ref = 'uuzhepbedmyvtztnbfiu';
const host = 'aws-1-ap-northeast-2.pooler.supabase.com';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const passwords = [
  'Gamehub@4455',
  'GameHub@4455',
  'gameHub@4455',
  'gamehub@4455'
];

async function run() {
  for (const pass of passwords) {
    console.log(`\nTesting password: ${pass}`);
    const encodedPass = encodeURIComponent(pass);
    const url = `postgresql://postgres.${ref}:${encodedPass}@${host}:6543/postgres?sslmode=require`;
    
    const client = new Client({
      connectionString: url,
      connectionTimeoutMillis: 5000
    });
    
    try {
      await client.connect();
      console.log(`🎉 SUCCESS! Password is: ${pass}`);
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
