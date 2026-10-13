const { chromium } = require('playwright');
const path = require('path');

const projectDir = __dirname;
const outputDir = path.join(projectDir, 'demo-video');
const appUrl = `file://${path.join(projectDir, 'index.html').replace(/\\/g, '/')}`;

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const show = async (page, selector, ms = 1200) => {
    await page.locator(selector).scrollIntoViewIfNeeded().catch(() => {});
    await pause(ms);
};

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        recordVideo: { dir: outputDir, size: { width: 390, height: 844 } }
    });
    const page = await context.newPage();
    await page.goto(appUrl);
    await page.waitForLoadState('networkidle').catch(() => {});
    await pause(1800);

    // Beranda, carousel, search, and filters
    await page.locator('.banner-arrow-next').click();
    await pause(1000);
    await page.locator('.banner-arrow-prev').click();
    await pause(800);
    await page.locator('#page-beranda .search-bar input').fill('Laut Bercerita');
    await pause(1000);
    await page.locator('#page-beranda .search-bar input').fill('');
    await page.locator('.filter-btn-square').click();
    await pause(1200);
    await page.locator('.filter-sheet-footer button').first().click().catch(() => {});
    await pause(700);
    await page.keyboard.press('Escape');
    await pause(900);

    // Open the reader from the "lanjut baca" card
    await page.locator('.reading-card').click();
    await pause(1400);
    await page.locator('#page-ebook-reader .ebook-reader-page').hover();
    await pause(1000);
    await page.locator('#page-ebook-reader .icon-btn').first().click().catch(() => {});
    await pause(1000);

    // Rak Saya tabs
    await page.locator('.nav-item').nth(1).click();
    await pause(1100);
    await page.locator('#page-rak-saya .sub-tab').nth(1).click();
    await pause(900);
    await page.locator('#page-rak-saya .sub-tab').nth(2).click();
    await pause(900);

    // Komunitas tabs
    await page.locator('.nav-item').nth(2).click();
    await pause(1100);
    await page.locator('#page-komunitas .sub-tab').nth(1).click();
    await pause(900);
    await page.locator('#page-komunitas .sub-tab').nth(2).click();
    await pause(900);

    // Profil and return home
    await page.locator('.nav-item').nth(3).click();
    await pause(1100);
    await page.locator('.nav-item').first().click();
    await pause(1400);

    await context.close();
    await browser.close();
    console.log(`Demo video saved in: ${outputDir}`);
})();
