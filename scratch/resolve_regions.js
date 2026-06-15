const dns = require('dns');

const regions = [
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'sa-east-1',
  'ca-central-1'
];

regions.forEach(region => {
  const host = `aws-0-${region}.pooler.supabase.com`;
  dns.lookup(host, (err, address, family) => {
    if (err) {
      // console.error(`DNS lookup failed for ${host}:`, err.message);
    } else {
      console.log(`Resolved ${host} to address: ${address} (family: IPv${family})`);
    }
  });
});
