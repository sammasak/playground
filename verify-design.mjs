import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

await page.goto('http://localhost:4321/playground');
await page.waitForLoadState('networkidle');

console.log('=== Upload Section Visual Verification ===\n');

// Check upload card exists
const uploadCard = await page.locator('#upload-card');
console.log('✓ Upload card exists:', await uploadCard.count() === 1);

// Check WASM icon exists
const wasmIcon = await page.locator('#upload-card .bot-lang-wasm');
console.log('✓ WASM icon exists:', await wasmIcon.count() === 1);

// Check WIT spec link
const witLink = await page.locator('#upload-card a[href*="bot.wit"]');
console.log('✓ WIT spec link exists:', await witLink.count() === 1);
const witHref = await witLink.getAttribute('href');
console.log('  Link URL:', witHref);

// Check Browse Files button
const browseBtn = await page.locator('#upload-wasm-btn');
console.log('✓ Browse Files button exists:', await browseBtn.count() === 1);
const btnText = await browseBtn.textContent();
console.log('  Button text:', btnText);

// Check hidden file input
const fileInput = await page.locator('#wasm-file-input');
console.log('✓ File input exists:', await fileInput.count() === 1);
const inputHidden = await fileInput.evaluate(el => el.style.display === 'none');
console.log('  Input is hidden:', inputHidden);

// Check error div is hidden
const errorDiv = await page.locator('#upload-error');
console.log('✓ Error div exists:', await errorDiv.count() === 1);
const errorHidden = await errorDiv.evaluate(el => el.style.display === 'none');
console.log('  Error is hidden:', errorHidden);

// Check uploaded bots section is hidden
const uploadedSection = await page.locator('#uploaded-bots-section');
console.log('✓ Uploaded bots section exists:', await uploadedSection.count() === 1);
const sectionHidden = await uploadedSection.evaluate(el => el.style.display === 'none');
console.log('  Section is hidden:', sectionHidden);

// Check card styling consistency
console.log('\n=== Styling Consistency ===\n');
const exampleCard = await page.locator('.bot-card').first();
const uploadCardEl = await page.locator('#upload-card');

const exampleBorder = await exampleCard.evaluate(el => window.getComputedStyle(el).border);
const uploadBorder = await uploadCardEl.evaluate(el => window.getComputedStyle(el).border);
console.log('✓ Borders match:', exampleBorder === uploadBorder);

const examplePadding = await exampleCard.evaluate(el => window.getComputedStyle(el).padding);
const uploadPadding = await uploadCardEl.evaluate(el => window.getComputedStyle(el).padding);
console.log('✓ Padding match:', examplePadding === uploadPadding);

const exampleRadius = await exampleCard.evaluate(el => window.getComputedStyle(el).borderRadius);
const uploadRadius = await uploadCardEl.evaluate(el => window.getComputedStyle(el).borderRadius);
console.log('✓ Border radius match:', exampleRadius === uploadRadius);

// Check WASM icon color
const wasmBg = await wasmIcon.evaluate(el => window.getComputedStyle(el).backgroundColor);
console.log('✓ WASM icon background:', wasmBg);
console.log('  Expected: rgb(101, 79, 240)');
console.log('  Match:', wasmBg === 'rgb(101, 79, 240)');

// Take screenshots
await page.screenshot({ path: '/home/lukas/playground/upload-section-full.png', fullPage: true });
console.log('\n✓ Screenshot saved: upload-section-full.png');

await uploadCardEl.screenshot({ path: '/home/lukas/playground/upload-card-detail.png' });
console.log('✓ Screenshot saved: upload-card-detail.png');

console.log('\n=== Testing Complete ===');
await browser.close();
