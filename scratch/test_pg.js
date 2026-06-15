const { Client } = require('pg');

const urls = [
  // 1. Original format, but URL-encoded password
  'postgresql://postgres:Gamehub%404455@db.uuzhepbedmyvtztnbfiu.supabase.co:5432/postgres',
  
  // 2. Pooler format with URL-encoded password
  'postgresql://postgres.uuzhepbedmyvtztnbfiu:Gamehub%404455@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
  
  // 3. Pooler format with port 5432 (Session mode)
  'postgresql://postgres.uuzhepbedmyvtztnbfiu:Gamehub%404455@aws-0-us-east-1.pooler.supabase.com:5432/postgres',

  // 4. Raw password pooler
  'postgresql://postgres.uuzhepbedmyvtztnbfiu:Gamehub@4455@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true'
];

async function testUrl(url, index) {
  console.log(`\n--- Testing Connection String #${index + 1} ---`);
  // Mask password for logging
  const masked = url.replace(/:[^:]+@/, ':****@');
  console.log('URL:', masked);
  
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    console.log('SUCCESS!');
    const res = await client.query('SELECT NOW()');
    console.log('Result:', res.rows[0]);
    await client.end();
    return true;
  } catch (err) {
    console.error('FAILED:', err.message);
    try {
      await client.end();
    } catch (e) {}
    return false;
  }
}

async function run() {
  for (let i = 0; i < urls.length; i++) {
    const success = await testUrl(urls[i], i);
    if (success) {
      console.log(`\nFound working URL: ${urls[i]}`);
      break;
    }
  }
}

run();
