const { Client } = require('pg');

const ip = '2406:da12:557:f801:92c5:d97a:df07:5afe';
const url = `postgresql://postgres:Gamehub%404455@[${ip}]:5432/postgres`;

async function run() {
  console.log('Connecting to IPv6 directly:', url.replace(/:[^:]+@/, ':****@'));
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 10000
  });
  
  try {
    await client.connect();
    console.log('SUCCESS! Connected directly via IPv6!');
    const res = await client.query('SELECT NOW()');
    console.log('Server time:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('FAILED:', err.message);
    await client.end().catch(() => {});
  }
}

run();
