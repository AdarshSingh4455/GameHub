const { Client } = require('pg');

const regions = [
  'ap-south-2',
  'ap-southeast-3',
  'ap-southeast-4',
  'ca-west-1',
  'eu-central-2',
  'eu-south-1',
  'eu-south-2',
  'me-central-1',
  'me-south-1',
  'af-south-1'
];

async function run() {
  const ref = 'uuzhepbedmyvtztnbfiu';
  const pass = 'Gamehub%404455';
  
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const url = `postgresql://postgres.${ref}:${pass}@${host}:6543/postgres?pgbouncer=true`;
    console.log(`Testing region: ${region} (${host})...`);
    
    const client = new Client({
      connectionString: url,
      connectionTimeoutMillis: 5000
    });
    
    try {
      await client.connect();
      console.log(`\n🎉 SUCCESS! Connected to Supabase pooler in region: ${region}`);
      await client.end();
      return;
    } catch (err) {
      console.log(`   Failed: ${err.message.trim()}`);
      await client.end().catch(() => {});
    }
  }
  console.log('\n❌ No regions succeeded.');
}

run();
