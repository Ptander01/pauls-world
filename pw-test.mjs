import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://localhost:5175');
await page.waitForTimeout(1500);

await page.click('button:has-text("Books")');
await page.waitForTimeout(400);
await page.screenshot({ path: '/tmp/pw-books-mode.png' });

await page.click('button[title="Romans"]');
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/pw-book-selected.png' });

await page.click('.bdp-close');
await page.waitForTimeout(500);
await page.screenshot({ path: '/tmp/pw-book-closed.png' });

await browser.close();
