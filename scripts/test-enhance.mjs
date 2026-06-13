import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:3477');
await page.fill('#loginName', 'Enh');
await page.fill('#loginPass', 'test123');
await page.click('#loginScreen button');
await page.waitForSelector('#loginScreen.hidden', { state: 'attached' });
await page.click('text=Scan Packing Slip');
// feed the faint slip through the real handleScan pipeline (scan API will 503 locally,
// but the error box previews the enhanced image)
await page.setInputFiles('#scanFileInput', 'scripts/faint-slip.jpg');
await page.waitForSelector('#scanResult img', { timeout: 10000 });
await page.locator('#scanResult img').screenshot({ path: 'scripts/enhanced-slip.png' });
console.log('captured enhanced output');
await browser.close();
