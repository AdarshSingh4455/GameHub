const { Client } = require('pg');

const ref = 'uuzhepbedmyvtztnbfiu';
const host = 'aws-0-ap-northeast-2.pooler.supabase.com';
const pass = 'Gamehub%404455';

async function run() {
  const ports = [5432, 6543];
  
  for (const port of ports) {
    console.log(`\nTesting connection to ${host}:${port}...`);
    const url = `postgresql://postgres.${ref}:${pass}@${host}:${port}/postgres?sslmode=disable`;
    const client = new Client({
      connectionString: url,
      connectionTimeoutMillis: 5000
    });
    
    try {
      await client.connect();
      console.log(`SUCCESS on port ${port}!`);
      const res = await client.query('SELECT NOW()');
      console.log('Result:', res.rows[0]);
      await client.end();
    } catch (err) {
      console.error(`FAILED on port ${port}:`, err.message);
      await client.end().catch(() => {});
    }
  }
}

run();
