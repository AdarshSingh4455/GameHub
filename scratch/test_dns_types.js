const dns = require('dns');

const host = 'db.uuzhepbedmyvtztnbfiu.supabase.co';

dns.resolve4(host, (err, addresses) => {
  if (err) {
    console.error('resolve4 failed:', err.message);
  } else {
    console.log('resolve4 addresses:', addresses);
  }
});

dns.resolve6(host, (err, addresses) => {
  if (err) {
    console.error('resolve6 failed:', err.message);
  } else {
    console.log('resolve6 addresses:', addresses);
  }
});

dns.resolveCname(host, (err, addresses) => {
  if (err) {
    console.error('resolveCname failed:', err.message);
  } else {
    console.log('resolveCname addresses:', addresses);
  }
});
