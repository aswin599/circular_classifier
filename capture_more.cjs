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

  // 1. Login
  console.log('Logging in...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
  const emailInput = await page.$('input[type="email"]');
  const passwordInput = await page.$('input[type="password"]');
  const submitBtn = await page.$('button[type="submit"]');
  if (emailInput && passwordInput && submitBtn) {
    await emailInput.type('circularclassifier@gmail.com');
    await passwordInput.type('admin');
    await submitBtn.click();
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 8000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
  }

  // 2. Ending Today view
  console.log('Navigating to ending today...');
  await page.goto('http://localhost:5173/?endingToday=true', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(__dirname, 'screenshot_ending_today.png') });
  console.log('Saved screenshot_ending_today.png');

  // 3. Search page
  console.log('Navigating to search page...');
  await page.goto('http://localhost:5173/search', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(__dirname, 'screenshot_search.png') });
  console.log('Saved screenshot_search.png');

  await browser.close();
  console.log('Finished capturing additional screenshots.');
})();
