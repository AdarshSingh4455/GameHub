const dns = require('dns');

const domains = [
  'db.uuzhepbedmyvtztnbfiu.supabase.co',
  'uuzhepbedmyvtztnbfiu.supabase.co'
];

domains.forEach(domain => {
  console.log(`\n--- Querying DNS for ${domain} ---`);
  
  dns.resolveTxt(domain, (err, records) => {
    if (err) {
      console.log(`TXT query failed for ${domain}:`, err.message);
    } else {
      console.log(`TXT records for ${domain}:`, records);
    }
  });

  dns.resolveSrv(domain, (err, records) => {
    if (err) {
      console.log(`SRV query failed for ${domain}:`, err.message);
    } else {
      console.log(`SRV records for ${domain}:`, records);
    }
  });

  dns.resolveAny(domain, (err, records) => {
    if (err) {
      console.log(`ANY query failed for ${domain}:`, err.message);
    } else {
      console.log(`ANY records for ${domain}:`, records);
    }
  });
});
