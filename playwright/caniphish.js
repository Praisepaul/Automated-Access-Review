import 'dotenv/config';
import { generateSync } from 'otplib';

export const caniphishAdapter = {
  userDataDir: "playwright/profiles/caniphish",
  headless: false,
  name: "CANIPHISH",
  dashboardUrl: "https://caniphish.com/platform/settings?queryType=ManageTenant",
  
  // Unique selector for CanIPhish dashboard content
  selector: "table, .table-responsive, #tenant-settings-container",

  async isLoggedIn(page) {
    return page.url().includes("/platform/") && !page.url().includes("/Auth/Login");
  },

  async login(page) {
    console.log("[CANIPHISH] Opening login page...");
    await page.goto("https://caniphish.com/Auth/Login", { waitUntil: "domcontentloaded" });

    // 1. SSO Modal
    console.log("[CANIPHISH] Opening SSO Modal...");
    await page.waitForSelector('#ssoButton', { state: 'attached' });
    await page.click('#ssoButton');

    // 2. Identification Modal
    console.log("[CANIPHISH] Entering email for identification...");
    await page.waitForSelector('#ssoSigninEmail', { state: 'attached' });
    // Use fill for the identification modal
    await page.type('#ssoSigninEmail', process.env.JUMPCLOUD_EMAIL, { delay: 100 });
    await page.click('#ssoSigninButton', { force: true });

    // --- JumpCloud Workflow ---
    console.log("[CANIPHISH] Redirected to JumpCloud. Entering credentials...");

    // 4. JumpCloud Email
    const emailSelector = 'input[name="email"]';
    await page.waitForSelector(emailSelector);
    await page.click(emailSelector); // Focus the field
    await page.type(emailSelector, process.env.JUMPCLOUD_EMAIL, { delay: 100 });
    
    // Crucial: Trigger validation by tabbing away or clicking outside
    await page.keyboard.press('Tab'); 
    
    // Now wait for the button to be enabled before clicking
    const loginBtn = 'button[data-automation="loginButton"]';
    await page.waitForFunction((sel) => {
        const btn = document.querySelector(sel);
        return btn && !btn.disabled;
    }, loginBtn);
    await page.click(loginBtn);

    // 5. JumpCloud Password
    const passSelector = 'input[name="password"]';
    await page.waitForSelector(passSelector);
    await page.type(passSelector, process.env.JUMPCLOUD_PASSWORD, { delay: 100 });
    
    // Ensure button is enabled for password step too
    await page.waitForFunction((sel) => {
        const btn = document.querySelector(sel);
        return btn && !btn.disabled;
    }, loginBtn);
    await page.click(loginBtn);

    // 6. JumpCloud MFA Input
    console.log("[CANIPHISH] Handling JumpCloud MFA...");
    try {
      await page.waitForSelector('.TotpInput__totpInputContainer', { state: 'visible', timeout: 20000 });

      const mfaToken = generateSync({ secret: process.env.JUMPCLOUD_MFA_SECRET });
      // Use the simpler locator logic
      const inputs = page.locator('.TotpInput__loginInput');

      for (let i = 0; i < 6; i++) {
        // Use fill for each box to ensure characters are registered
        await inputs.nth(i).fill(mfaToken[i]);
      }

      console.log("[CANIPHISH] MFA submitted, waiting for redirect...");

      // 7. Wait for redirect back to the platform
      await page.waitForURL(
        url => url.href.includes("caniphish.com/platform"),
        { timeout: 60000 }
      );

      console.log("[CANIPHISH] Login successful!");

    } catch (error) {
      console.error("[CANIPHISH] SSO login sequence failed:", error.message);
      throw error;
    }
  },

  async gotoUsers(page) {
    console.log("[CANIPHISH] Navigating to Tenant settings...");
    await page.goto(this.dashboardUrl, { waitUntil: "networkidle" });
    // Allow for SPA data fetching and table rendering
    await page.waitForSelector('table', { timeout: 15000 });
    await page.waitForTimeout(5000); 
  },

  /**
   * Scrapes the user list directly from the table in the UI
   * @returns {Promise<Set<string>>}
   */
  async extractUsers(page) {
    console.log("[CANIPHISH] Scraping user list from UI...");
    
    // Scrape email addresses from the table rows
    const emails = await page.$$eval('table tbody tr', (rows) => {
      return rows.map(row => {
        // Adjust child index (e.g., :nth-child(2)) based on the actual table column
        const emailCell = row.querySelector('td:nth-child(2)'); 
        return emailCell ? emailCell.innerText.trim().toLowerCase() : null;
      }).filter(e => e && e.includes('@'));
    });

    return new Set(emails);
  },

  async loggedInCheck(page) {
    await page.waitForFunction(() => 
      window.location.href.includes("/platform/") && 
      !document.body.innerText.includes("Login"), 
      { timeout: 30000 }
    );
  }
};