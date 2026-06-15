import puppeteer from 'puppeteer';

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const [page] = await browser.pages();
  try {
    console.log('Navigating to register page...');
    const res = await page.goto('http://localhost:3000/register', { waitUntil: 'networkidle2' });
    console.log('Response status:', res ? res.status() : 'No response');
    console.log('Current URL:', page.url());
    const title = await page.title();
    console.log('Page Title:', title);
    const body = await page.evaluate(() => document.body.innerHTML);
    console.log('Body HTML length:', body.length);
    console.log('First 500 chars of body:', body.substring(0, 500));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}
run();
