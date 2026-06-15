const { Client } = require('pg');
const { parse } = require('pg-connection-string');

const url = 'postgresql://postgres.uuzhepbedmyvtztnbfiu:Gamehub%404455@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true';

async function run() {
  console.log('Parsing connection string manually...');
  const config = parse(url);
  
  // Override ssl option explicitly
  config.ssl = {
    rejectUnauthorized: false
  };
  
  console.log('Config parsed:', {
    ...config,
    password: '****'
  });
  
  const client = new Client(config);
  try {
    await client.connect();
    console.log('🎉 SUCCESS! Connected successfully to the pooler!');
    const res = await client.query('SELECT NOW()');
    console.log('Result:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('FAILED:', err.message);
    await client.end().catch(() => {});
  }
}

run();
