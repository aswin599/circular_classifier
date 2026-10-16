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

  // 1. Login Page
  console.log('Navigating to login page...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(__dirname, 'screenshot_login.png') });
  console.log('Saved screenshot_login.png');

  // 2. Perform Login as Admin (HOD)
  try {
    const emailInput = await page.$('input[type="email"]');
    const passwordInput = await page.$('input[type="password"]');
    const submitBtn = await page.$('button[type="submit"]');

    if (emailInput && passwordInput && submitBtn) {
      await emailInput.type('circularclassifier@gmail.com');
      await passwordInput.type('admin');
      await submitBtn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 8000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 3000));
      console.log('Logged in! Current URL:', page.url());
      await page.screenshot({ path: path.join(__dirname, 'screenshot_dashboard.png') });
      console.log('Saved screenshot_dashboard.png');

      // Click on first circular card or item if available to show detail modal or view
      const firstItem = await page.$('.cursor-pointer, [data-testid="circular-card"], a[href*="circular"], div[role="button"]');
      if (firstItem) {
        try {
          await firstItem.click();
          await new Promise(r => setTimeout(r, 1500));
          await page.screenshot({ path: path.join(__dirname, 'screenshot_detail.png') });
          console.log('Saved screenshot_detail.png');
        } catch (e) {
          console.log('Detail click failed:', e.message);
        }
      }
    }
  } catch (err) {
    console.error('Error during login:', err.message);
  }

  await browser.close();
  console.log('Done capturing screenshots!');
})();
