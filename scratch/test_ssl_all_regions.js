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

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function run() {
  const ref = 'uuzhepbedmyvtztnbfiu';
  const pass = 'Gamehub%404455';
  
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const url = `postgresql://postgres.${ref}:${pass}@${host}:6543/postgres?sslmode=require`;
    console.log(`Testing region: ${region} (${host})...`);
    
    const client = new Client({
      connectionString: url,
      connectionTimeoutMillis: 4000
    });
    
    try {
      await client.connect();
      console.log(`\n🎉 SUCCESS! Connected to Supabase pooler in region: ${region}`);
      const res = await client.query('SELECT NOW()');
      console.log('Server time:', res.rows[0]);
      await client.end();
      return;
    } catch (err) {
      const msg = err.message;
      if (msg.includes('ENOTFOUND') || msg.includes('EADDRNOTAVAIL') || msg.includes('ECONNREFUSED')) {
        console.log(`   DNS or network error: ${msg}`);
      } else {
        console.log(`   Connection error: ${msg}`);
      }
      await client.end().catch(() => {});
    }
  }
  console.log('\n❌ No regions succeeded.');
}

run();
