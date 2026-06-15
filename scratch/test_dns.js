const dns = require('dns');

const hosts = [
  'google.com',
  'db.uuzhepbedmyvtztnbfiu.supabase.co',
  'aws-0-us-east-1.pooler.supabase.com',
  'uuzhepbedmyvtztnbfiu.supabase.co'
];

hosts.forEach(host => {
  dns.lookup(host, (err, address, family) => {
    if (err) {
      console.error(`DNS lookup failed for ${host}:`, err.message);
    } else {
      console.log(`Resolved ${host} to address: ${address} (family: IPv${family})`);
    }
  });
});
