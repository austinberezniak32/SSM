// End-to-end browser smoke test against a running dev server.
// Usage: node scripts/browser-smoke.mjs [baseUrl] [passcode]
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:3477';
const passcode = process.argv[3] || 'test123';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
// the pre-login /api/me probe legitimately 401s; everything else is a failure
page.on('console', m => {
  if (m.type() === 'error' && !m.text().includes('401')) errors.push('console: ' + m.text());
});

await page.goto(base);
await page.waitForSelector('#loginScreen:not(.hidden)');
console.log('login screen shown');

await page.fill('#loginName', 'Smoke Tester');
await page.fill('#loginPass', passcode);
await page.click('#loginScreen button');
await page.waitForSelector('#loginScreen.hidden', { state: 'attached', timeout: 5000 });
console.log('logged in');

await page.waitForSelector('.job-card', { timeout: 5000 });
const jobCount = await page.locator('.job-card').count();
console.log('jobs rendered:', jobCount);
await page.screenshot({ path: 'scripts/smoke-jobs.png' });

// open first job -> shop page -> send-to-field flow visible
await page.click('.job-card');
await page.waitForSelector('#page-job.active');
console.log('job overview open, header:', await page.textContent('#hdrTitle'));
await page.click('.loc-tile.shop');
await page.waitForSelector('#page-shop.active');
console.log('shop page open');
await page.screenshot({ path: 'scripts/smoke-shop.png' });

// slips tab + filter
await page.click('#bottomNav .bnav-btn:nth-child(2)');
await page.waitForSelector('#page-slips.active');
const slipCount = await page.locator('#slipsList .receipt-card').count();
console.log('slips rendered:', slipCount);

// expand a slip's line items
await page.click('#slipsList .rc-header');
console.log('line items visible:', await page.locator('#slipsList .rc-item-row').first().isVisible());

// settings
await page.click('#bottomNav .bnav-btn:nth-child(3)');
await page.waitForSelector('#page-settings.active');
console.log('scanner status:', (await page.textContent('#scanStatus')).trim().slice(0, 60));
await page.screenshot({ path: 'scripts/smoke-settings.png' });

// manual receipt via modal on jobs tab
await page.click('#bottomNav .bnav-btn:nth-child(1)');
await page.click('text=Add PO');
await page.fill('#po-num', 'H02000-001');
await page.fill('#po-desc', 'Smoke test valve');
await page.click('#modal-addPO .modal-footer .btn-primary');
await page.waitForSelector('.toast', { timeout: 5000 });
console.log('PO added, toast shown');
await page.waitForSelector('#modal-addPO:not(.open)', { state: 'attached' });

// PO lookup path in scan modal
await page.click('text=Scan Packing Slip');
await page.fill('#scanPO', 'H02000-001');
await page.click('.po-lookup button.btn');
await page.waitForSelector('#luQty');
await page.fill('#luBy', 'Smoke Tester');
await page.click('text=Confirm Receipt');
await page.waitForSelector('text=logged.');
console.log('PO lookup receipt logged');

// second receipt on the same PO — should group in the slips list
await page.fill('#scanPO', 'H02000-001');
await page.click('.po-lookup button.btn');
await page.waitForSelector('#luQty');
await page.click('text=Confirm Receipt');
await page.waitForTimeout(800);
await page.click('#modal-scan .modal-close');
await page.click('#bottomNav .bnav-btn:nth-child(2)');
await page.waitForSelector('#slipsList .po-group', { timeout: 5000 });
console.log('duplicate-PO receipts grouped');

// edit flow: expand a receipt, change its job assignment
await page.locator('#slipsList .rc-header').first().click();
await page.locator('button:has-text("Edit details")').locator('visible=true').first().click();
await page.waitForSelector('#modal-editReceipt.open');
await page.fill('#er-job', 'H09999');
await page.click('text=Save Changes');
await page.waitForSelector('#modal-editReceipt:not(.open)', { state: 'attached' });
await page.waitForSelector('#slipsList :text("H09999")', { timeout: 5000 });
console.log('receipt edited and reassigned to H09999');

if (errors.length) {
  console.error('JS ERRORS:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('SMOKE PASS — no JS errors');
await browser.close();
