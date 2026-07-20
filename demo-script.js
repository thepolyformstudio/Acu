const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP_URL = 'https://acudex.web.app';
const OUTPUT_DIR = path.join(__dirname, 'demo-screenshots');

const DEMO_EMAIL = 'demo@acudemo.com';
const DEMO_PASS = 'Demo123!';

const VIEWPORT = { width: 1440, height: 900 };

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function clickByText(page, text, tag = 'button') {
  return page.evaluate(([t, tg]) => {
    const items = document.querySelectorAll(tg);
    for (const item of items) {
      if (item.textContent.trim().includes(t)) { item.click(); return true; }
    }
    return false;
  }, [text, tag]);
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: VIEWPORT,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  const screenshot = async (name) => {
    await sleep(1500);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${name}.png`), fullPage: false });
    console.log(`  ✓ ${name}.png`);
  };

  try {
    // 1. Landing Page
    console.log('1. Landing page...');
    await page.goto(APP_URL, { waitUntil: 'load', timeout: 60000 });
    await screenshot('01-landing');

    // 2. Sign In
    console.log('2. Signing in...');
    await sleep(1000);

    const emailInput = await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await emailInput.click();
    await emailInput.type(DEMO_EMAIL, { delay: 50 });

    const passwordInput = await page.waitForSelector('input[type="password"]', { timeout: 5000 });
    await passwordInput.click();
    await passwordInput.type(DEMO_PASS, { delay: 50 });

    const submitBtn = await page.waitForSelector('button[type="submit"]', { timeout: 5000 });
    await submitBtn.click();
    console.log('   waiting for auth...');
    await sleep(4000);

    // 3. Skip Drive onboarding
    console.log('3. Skipping Drive onboarding...');
    const skipClicked = await clickByText(page, 'Skip');
    if (!skipClicked) {
      await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const b of btns) {
          if (b.textContent.includes('Skip')) { b.click(); return; }
        }
      });
    }
    await sleep(2000);

    // 4. Dashboard
    console.log('4. Dashboard...');
    await screenshot('02-dashboard');

    // 5. Debug: check sidebar buttons
    const sidebarDebug = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('aside button')).map(b => ({
        text: b.textContent.trim(),
        visible: b.offsetParent !== null,
        rect: b.getBoundingClientRect(),
      }));
    });
    console.log('   Sidebar buttons:', JSON.stringify(sidebarDebug, null, 2));

    // 6. AcuLibrary
    console.log('6. AcuLibrary...');
    const libCliked = await clickByText(page, 'AcuLibrary');
    console.log(`   clicked library: ${libCliked}`);
    await sleep(2000);
    await screenshot('03-library');

    // 7. AcuSlide
    console.log('7. AcuSlide...');
    await clickByText(page, 'AcuSlide');
    await sleep(2000);
    await screenshot('04-slides');

    // 8. AcuExam
    console.log('8. AcuExam...');
    await clickByText(page, 'AcuExam');
    await sleep(2000);
    await screenshot('05-exam');

    // 9. Pricing
    console.log('9. Pricing...');
    await clickByText(page, 'Pricing');
    await sleep(2000);
    await screenshot('06-pricing');

    // 10. Settings
    console.log('10. Settings...');
    await page.keyboard.press('Escape');
    await sleep(500);
    const settingsClicked = await clickByText(page, 'Settings');
    console.log(`   clicked settings: ${settingsClicked}`);
    await sleep(2000);
    await screenshot('07-settings');

    console.log('\n✅ All screenshots captured in demo-screenshots/');
  } catch (err) {
    console.error('Error:', err.message);
    await screenshot('error-state');
  } finally {
    await browser.close();
  }
}

main();
