const { Client } = require('pg');

const regions = [
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-northeast-3',
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
    console.log(`Testing region: ${region} (${host})...`);
    
    const client = new Client({
      connectionString: url,
      connectionTimeoutMillis: 5000
    });
    
    try {
      await client.connect();
      console.log(`\n🎉 SUCCESS! Connected to Supabase pooler in region: ${region}`);
      const res = await client.query('SELECT NOW()');
      console.log('Server time:', res.rows[0]);
      await client.end();
      return;
    } catch (err) {
      const errMsg = err.message.toLowerCase();
      // If the DNS lookup itself failed, it's not the right region pooler host
      if (errMsg.includes('enotfound') || errMsg.includes('econnrefused')) {
        console.log(`   DNS or Refused connection error: ${err.message.trim()}`);
      } else if (errMsg.includes('tenant') || errMsg.includes('not found')) {
        console.log(`   Failed: ${err.message.trim()}`);
      } else {
        // This means we reached the tenant/region, but something else failed (e.g. auth error, etc.)
        console.log(`👉 Potential region match found in ${region}, but connection error: ${err.message}`);
        await client.end().catch(() => {});
      }
    }
  }
  console.log('\n❌ No regions succeeded.');
}

run();
