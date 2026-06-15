const { Client } = require('pg');

async function run() {
  console.log('Testing connection to local PostgreSQL on port 5432...');
  
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'Gamehub@4455',
    database: 'postgres',
    connectionTimeoutMillis: 3000
  });
  
  try {
    await client.connect();
    console.log('🎉 SUCCESS! Connected to local PostgreSQL on port 5432!');
    const res = await client.query('SELECT NOW()');
    console.log('Result:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('FAILED to connect to local PostgreSQL:', err.message);
    await client.end().catch(() => {});
  }
}

run();
