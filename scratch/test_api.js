const https = require('https');

const url = 'https://uuzhepbedmyvtztnbfiu.supabase.co/rest/v1/';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1emhlcGJlZG15dnR6dG5iZml1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1Nzc0NDgsImV4cCI6MjA5NjE1MzQ0OH0.vg2edFWxGmfQX81DABdOqSSqxl3bDlqKVhPkaiecfBY';

const options = {
  headers: {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`
  }
};

console.log('Sending request to Supabase API...');
https.get(url, options, (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('Response body:', data);
  });
}).on('error', (err) => {
  console.error('Request failed:', err);
});
