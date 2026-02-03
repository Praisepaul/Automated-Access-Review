import 'dotenv/config';
import { generateSync } from 'otplib';

export const crowdstrikeAdapter = {
  name: "CROWDSTRIKE",
  userDataDir: "playwright/profiles/crowdstrike",
  dashboardUrl: "https://falcon.us-2.crowdstrike.com/users-v2", // Use your working URL
  selector: '[data-test-selector="users-table"], table',

  async login(page) {
    console.log("[CROWDSTRIKE] Starting automated login...");
    await page.goto(this.dashboardUrl, { waitUntil: "domcontentloaded" });

    // Step 1: Email
    await page.waitForSelector('[data-test-selector="email"]');
    await page.type('[data-test-selector="email"]', process.env.CROWDSTRIKE_EMAIL, {delay: 100});
    
    // FORCE CLICK here to bypass the "glow" div intercepting the pointer
    await page.click('[data-test-selector="continue"]', { force: true });

    // Step 2: Password
    await page.waitForSelector('[data-test-selector="password"]');
    await page.type('[data-test-selector="password"]', process.env.CROWDSTRIKE_PASSWORD, {delay: 100});
    
    // FORCE CLICK here as well
    await page.click('[data-test-selector="submit"]', { force: true });

    // Step 3: MFA
    console.log("[CROWDSTRIKE] Handling MFA...");
    await page.waitForSelector('[name="verification-code-input-0"]');
    const token = generateSync({ secret: process.env.CROWDSTRIKE_MFA_SECRET });
    
    for (let i = 0; i < 6; i++) {
      // Use fill for MFA digits to be faster and more reliable
      await page.fill(`[name="verification-code-input-${i}"]`, token[i]);
    }
    
    // Click submit and WAIT for the URL to change
    await Promise.all([
      page.click('[data-test-selector="mfa-code-submit"]', { force: true }),
      page.waitForURL(url => !url.href.includes('login'), { timeout: 60000 })
    ]);
    
    console.log("[CROWDSTRIKE] Session established.");
  },

  async loggedInCheck(page, timeout = 15000) {
    await page.waitForURL(
      url => url.href.includes("/hub") || url.href.includes("/users-v2"),
      { timeout }
    );
  },
async gotoUsers(page) {
    console.log("[CROWDSTRIKE] Navigating to Users page");
    // Change "networkidle" to "load" to avoid the timeout you saw in the logs
    await page.goto(this.dashboardUrl, { waitUntil: "load" });
    // Specific wait for the table to ensure SPA rendering is done
    await page.waitForSelector(this.selector, { timeout: 30000 });
  }
};
