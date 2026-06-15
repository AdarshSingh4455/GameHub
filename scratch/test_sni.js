const { Client } = require('pg');

const ref = 'uuzhepbedmyvtztnbfiu';
const host = 'aws-0-ap-northeast-2.pooler.supabase.com';
const pass = 'Gamehub%404455';

async function run() {
  console.log('Testing with SNI routing...');
  
  // Connect to pooler host, but set SNI to the project's db hostname
  const client = new Client({
    host: host,
    port: 6543,
    user: 'postgres',
    password: decodeURIComponent(pass),
    database: 'postgres',
    ssl: {
      rejectUnauthorized: false,
      servername: `${ref}.supabase.co` // Or db.ref.supabase.co
    },
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    console.log('SUCCESS with SNI!');
    const res = await client.query('SELECT NOW()');
    console.log('Result:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('FAILED with ref.supabase.co SNI:', err.message);
    await client.end().catch(() => {});
    
    // Try db.ref.supabase.co SNI
    console.log('\nRetrying with db.ref.supabase.co SNI...');
    const client2 = new Client({
      host: host,
      port: 6543,
      user: 'postgres',
      password: decodeURIComponent(pass),
      database: 'postgres',
      ssl: {
        rejectUnauthorized: false,
        servername: `db.${ref}.supabase.co`
      },
      connectionTimeoutMillis: 5000
    });
    
    try {
      await client2.connect();
      console.log('SUCCESS with db SNI!');
      const res = await client2.query('SELECT NOW()');
      console.log('Result:', res.rows[0]);
      await client2.end();
    } catch (err2) {
      console.error('FAILED with db.ref.supabase.co SNI:', err2.message);
      await client2.end().catch(() => {});
    }
  }
}

run();
