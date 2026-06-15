const https = require('https');
const ipaddr = require('ipaddr.js'); // Wait, is ipaddr.js installed? Let's write standard range checking or just fetch the file first and parse/grep it.

https.get('https://ip-ranges.amazonaws.com/ip-ranges.json', (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      const ipv6Prefixes = data.ipv6_prefixes;
      const target = '2406:da12:557:f801:92c5:d97a:df07:5afe';
      console.log('Searching for region of:', target);
      
      // Simple parse of target IPv6 to binary or match prefixes
      // Let's do a basic string match or manual prefix matching
      // Since most AWS prefixes are /36, /40, /48, let's print prefixes that start with "2406:da12:"
      const matches = ipv6Prefixes.filter(p => p.ipv6_prefix.startsWith('2406:da12'));
      console.log('Matching prefixes:');
      matches.forEach(m => {
        console.log(`- Prefix: ${m.ipv6_prefix}, Region: ${m.region}, Service: ${m.service}`);
      });
    } catch (err) {
      console.error('Error parsing JSON:', err);
    }
  });
}).on('error', (err) => {
  console.error('Fetch error:', err);
});
