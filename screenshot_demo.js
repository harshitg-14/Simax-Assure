const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'demo_screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // Login
  await page.goto('http://localhost:3000/login');
  await page.waitForSelector('input[type="text"], input[placeholder*="sername"], input[name="username"]', { timeout: 10000 });
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await page.waitForTimeout(2000);

  // 1. Dashboard
  await page.screenshot({ path: path.join(OUT, '01_dashboard.png'), fullPage: false });
  console.log('Dashboard screenshot done');

  // 2. Scroll down to see forecast
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, '02_dashboard_forecast.png'), fullPage: false });
  console.log('Forecast screenshot done');

  // 3. Expenditure
  await page.goto('http://localhost:3000/expenditure');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, '03_expenditure.png'), fullPage: false });
  console.log('Expenditure screenshot done');

  // 4. Approvals
  await page.goto('http://localhost:3000/approvals');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, '04_approvals.png'), fullPage: false });
  console.log('Approvals screenshot done');

  // 5. Reports
  await page.goto('http://localhost:3000/reports');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, '05_reports.png'), fullPage: false });
  console.log('Reports screenshot done');

  // 6. Audit Trail
  await page.goto('http://localhost:3000/audit');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, '06_audit.png'), fullPage: false });
  console.log('Audit screenshot done');

  // 7. Budget Revisions
  await page.goto('http://localhost:3000/revisions');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, '07_revisions.png'), fullPage: false });
  console.log('Revisions screenshot done');

  // 8. Assurance Monitor
  await page.goto('http://localhost:3000/assurance');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, '08_assurance.png'), fullPage: false });
  console.log('Assurance screenshot done');

  await browser.close();
  console.log('All screenshots saved to:', OUT);
})();
