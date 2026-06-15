const { Client } = require('pg');

const ref = 'uuzhepbedmyvtztnbfiu';
const host = 'aws-0-ap-northeast-2.pooler.supabase.com';

const configs = [
  { user: `postgres.${ref}`, pass: 'Gamehub', desc: 'User with Gamehub' },
  { user: `postgres.${ref}`, pass: 'Gamehub@4455', desc: 'User with Gamehub@4455' },
  { user: 'postgres', pass: 'Gamehub', desc: 'Plain postgres with Gamehub' },
  { user: 'postgres', pass: 'Gamehub@4455', desc: 'Plain postgres with Gamehub@4455' }
];

async function run() {
  for (const config of configs) {
    console.log(`\nTesting config: ${config.desc}`);
    const encodedPass = encodeURIComponent(config.pass);
    const url = `postgresql://${config.user}:${encodedPass}@${host}:6543/postgres?pgbouncer=true`;
    
    const client = new Client({
      connectionString: url,
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
