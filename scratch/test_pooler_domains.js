const dns = require('dns');

const hosts = [
  'uuzhepbedmyvtztnbfiu.pooler.supabase.com',
  'db.uuzhepbedmyvtztnbfiu.pooler.supabase.com',
  'ap-northeast-2.pooler.supabase.com',
  'aws-0-ap-northeast-2.pooler.supabase.com'
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
