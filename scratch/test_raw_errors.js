const { Client } = require('pg');

const regions = [
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-north-1',
  'sa-east-1',
  'ca-central-1'
];

async function run() {
  const ref = 'uuzhepbedmyvtztnbfiu';
  const pass = 'Gamehub%404455';
  
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const url = `postgresql://postgres.${ref}:${pass}@${host}:6543/postgres?pgbouncer=true`;
    
    const client = new Client({
      connectionString: url,
      connectionTimeoutMillis: 4000
    });
    
    try {
      await client.connect();
      console.log(`${region}: SUCCESS`);
      await client.end();
    } catch (err) {
      console.log(`${region}: code=${err.code}, message="${err.message.trim()}"`);
      await client.end().catch(() => {});
    }
  }
}

run();
