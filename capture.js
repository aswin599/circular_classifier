const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const FIG = path.join(__dirname, '_figs');
fs.mkdirSync(FIG, { recursive: true });
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  const shot = (name) => page.screenshot({ path: path.join(FIG, name + '.png') });
  const goto = async (url) => {
    await page.goto(BASE + url, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(900);
  };
  const waitSel = async (sel) => {
    try { await page.waitForSelector(sel, { timeout: 8000 }); } catch (e) { console.log('selector timeout:', sel); }
    await sleep(600);
  };

  await goto('/register'); await waitSel('form'); await shot('register');

  await goto('/login'); await waitSel('form'); await shot('login');

  await page.type('form input:first-of-type', 'admin@tce.edu');
  await page.type('form input[type="password"]', 'Admin@12345');
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForFunction(() => location.pathname === '/', { timeout: 10000 }),
  ]);
  await sleep(1400);
  await waitSel('tbody tr');
  await shot('dashboard');

  await goto('/?endingToday=true'); await waitSel('tbody tr, [class*="empty"]'); await shot('dashboard_ending');

  await goto('/circulars/c1'); await waitSel('h1'); await sleep(800); await shot('detail');

  await goto('/circulars/c2'); await waitSel('h1'); await sleep(600); await shot('detail2');

  await goto('/search'); await waitSel('input[type="text"]');
  await page.type('input[type="text"]', 'exam');
  await sleep(1200);
  await waitSel('tbody tr, [class*="result"]');
  await shot('search');

  await goto('/admin/categories'); await waitSel('h1'); await sleep(700); await shot('admin_categories');

  await goto('/admin/users'); await waitSel('h1'); await sleep(700); await shot('admin_users');

  await browser.close();
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });
