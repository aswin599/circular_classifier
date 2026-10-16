const puppeteer = require('puppeteer-core');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1400,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  // Login
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  await page.type('input[type="email"]', 'circularclassifier@gmail.com');
  await page.type('input[type="password"]', 'admin');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 2500));

  // Search
  await page.goto('http://localhost:5173/search', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(__dirname, 'screenshot_search.png') });
  console.log('Saved screenshot_search.png');

  // Ending today
  await page.goto('http://localhost:5173/?endingToday=true', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(__dirname, 'screenshot_ending_today.png') });
  console.log('Saved screenshot_ending_today.png');

  await browser.close();
  console.log('All extra screenshots done!');
})();
