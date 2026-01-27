import { test as base, expect, devices } from '@playwright/test';
import fs from 'fs';

const BASE_URL = 'http://localhost:3000'; // Change if needed

const TEST_USER = {
  email: 'admin@fanscout.com',
  password: 'admin!'
};

async function login(page) {
  // Wait for login modal if present
  if (await page.locator('#authModalOverlay').isVisible({ timeout: 5000 }).catch(() => false)) {
    await page.fill('#loginEmail', TEST_USER.email);
    await page.fill('#loginPassword', TEST_USER.password);
    await page.click('#loginFormElement button[type=submit]');
    // Wait for modal to disappear
    await expect(page.locator('#authModalOverlay')).not.toBeVisible({ timeout: 10000 });
  }
}

// MOBILE TESTS
const testMobile = base.extend({
  contextOptions: async ({}, use) => {
    await use({ ...devices['iPhone 12'] });
  },
});

testMobile.describe('FanScout Mobile View', () => {
  testMobile('should show bottom tab navigation', async ({ page }) => {
    await page.goto(BASE_URL);
    await login(page);
    await expect(page.locator('.tab-bar')).toBeVisible();
    await expect(page.locator('.tab-item')).toHaveCount(5);
  });

  testMobile('should open and close login modal', async ({ page }) => {
    await page.goto(BASE_URL);
    // If already logged in, log out for this test (implement if needed)
    // Open login modal
    await page.click('text=Login');
    await expect(page.locator('#authModalOverlay')).toBeVisible();
    await page.click('#authModalOverlay .modal-close');
    await expect(page.locator('#authModalOverlay')).not.toBeVisible();
  });

  testMobile('should open athlete detail modal from grid', async ({ page }, testInfo) => {
    await page.goto(BASE_URL);
    await login(page);
    try {
      // Wait for prospect items to load and click the first one
      const firstProspect = page.locator('.prospect-item').first();
      await expect(firstProspect).toBeVisible({ timeout: 10000 });
      await firstProspect.click();
      await expect(page.locator('#athleteDetailModal')).toBeVisible();
      await page.click('#athleteDetailModal .modal-close');
    } catch (e) {
      await page.screenshot({ path: `test-results/athlete-detail-modal-fail.png`, fullPage: true });
      const html = await page.content();
      fs.writeFileSync('test-results/athlete-detail-modal-fail.html', html);
      throw e;
    }
  });

  testMobile('should open chat and send a message', async ({ page }, testInfo) => {
    await page.goto(BASE_URL);
    await login(page);
    try {
      // Click the header messages button to open messages
      const messagesBtn = page.locator('#headerMessagesBtn');
      await expect(messagesBtn).toBeVisible({ timeout: 10000 });
      await messagesBtn.click();
      await expect(page.locator('.messages-page')).toBeVisible({ timeout: 10000 });
      // Open first message
      const firstMessage = page.locator('.message-item').first();
      await expect(firstMessage).toBeVisible({ timeout: 10000 });
      await firstMessage.click();
      await expect(page.locator('#chatPage')).toBeVisible();
      await page.fill('#fullScreenChatInput', 'Test message');
      await page.click('#fullScreenSendChatBtn');
      // Check that the last sent message contains 'Test message'
      const lastSent = page.locator('.chat-message-modern.sent').last();
      await expect(lastSent).toContainText('Test message');
    } catch (e) {
      await page.screenshot({ path: `test-results/chat-send-message-fail.png`, fullPage: true });
      const html = await page.content();
      fs.writeFileSync('test-results/chat-send-message-fail.html', html);
      throw e;
    }
  });

  testMobile('should show and interact with Explore page', async ({ page }) => {
    await page.goto(BASE_URL);
    await login(page);
    // Navigate to Explore tab
    const exploreTab = page.locator('.tab-bar .tab-item[data-page=explore]');
    await expect(exploreTab).toBeVisible({ timeout: 10000 });
    await exploreTab.click();
    // Assert Explore page is visible
    await expect(page.locator('.explore-page')).toBeVisible();
    // Assert prospects list exists in the DOM
    const prospectsListCount = await page.locator('#prospectsList').count();
    expect(prospectsListCount).toBeGreaterThan(0);
  });

  testMobile('should show and interact with Offers page', async ({ page }) => {
    await page.goto(BASE_URL);
    await login(page);
    // Navigate to Offers tab
    const offersTab = page.locator('.tab-bar .tab-item[data-page=offers]');
    await expect(offersTab).toBeVisible({ timeout: 10000 });
    await offersTab.click();
    // Assert Offers page is visible
    await expect(page.locator('.offers-page')).toBeVisible();
    // Interact with search
    await page.fill('#offersSearchInput', 'a');
    // Open filter menu
    await page.click('#offersFilterBtn');
    // Interact with sport filter
    await page.selectOption('#offerSportFilter', 'nba');
    // Interact with min/max price
    await page.fill('#offerMinPrice', '10');
    await page.fill('#offerMaxPrice', '1000');
    // Interact with sort
    await page.selectOption('#offerSort', 'price-desc');
    // Interact with Buying/Selling pills
    const buyingPill = page.locator('.pills-container .pill[data-filter=buying]');
    await buyingPill.click();
    await expect(buyingPill).toHaveClass(/active/);
    const sellingPill = page.locator('.pills-container .pill[data-filter=selling]');
    await sellingPill.click();
    await expect(sellingPill).toHaveClass(/active/);
  });
});

// DESKTOP TESTS
const testDesktop = base.extend({
  contextOptions: async ({}, use) => {
    await use({ viewport: { width: 1280, height: 900 } });
  },
});

testDesktop.describe('FanScout Desktop View', () => {
  testDesktop('should show sidebar or desktop navigation', async ({ page }) => {
    await page.goto(BASE_URL);
    await login(page);
    // Adjust selector if you implement a sidebar
    // await expect(page.locator('.desktop-sidebar')).toBeVisible();
    // For now, just check the tab bar is hidden
    await expect(page.locator('.tab-bar')).not.toBeVisible();
  });
  // Add more desktop-specific tests as needed
}); 