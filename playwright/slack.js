import 'dotenv/config';
import { generateSync } from 'otplib';

export const slackAdapter = {
  userDataDir: "playwright/profiles/slack",
  headless: false,
  name: "SLACK",
  dashboardUrl: "https://app.slack.com/manage/E08D7Q2A73R/people",
  
  async isLoggedIn(page) {
    try {
        // Look for the "People" header or the Org Admin table
        await page.waitForSelector('[data-qa="org_members_table_header"]', { timeout: 8000 });
        return true;
    } catch (e) {
        return false; // Selector not found, must login
    }
  },

  selector: [
    '[data-qa="org_members_table"]',
    '[data-qa="org_members_table_container"]',
    '[data-qa="org_members_table_body"]',
    '[data-qa="org_members_table_header"]',
    'table',
  ].join(","),

  async login(page) {
    console.log("[SLACK] Opening People admin page");
    await page.goto("https://app.slack.com/manage/E08D7Q2A73R/people");

    // 1. Click "Sign in with JumpCloud"
    const samlBtn = '#enterprise_member_guest_account_signin_link_JumpCloud';
    await page.waitForSelector(samlBtn);
    await page.click(samlBtn);

    // 2. JumpCloud Email
    await page.waitForSelector('input[name="email"]');
    await page.type('input[name="email"]', process.env.JUMPCLOUD_EMAIL, {delay: 100});
    await page.click('button[data-automation="loginButton"]');

    // 3. JumpCloud Password
    await page.waitForSelector('input[name="password"]');
    await page.type('input[name="password"]', process.env.JUMPCLOUD_PASSWORD, {delay: 100});
    await page.click('button[data-automation="loginButton"]');

    // 4. MFA Input
    console.log("[SLACK] Handling MFA input...");

    try {
      // Wait for the 6-digit input boxes to appear
      await page.waitForSelector('.TotpInput__totpInputContainer', { state: 'visible', timeout: 20000 });

      const mfaToken = String(generateSync({ secret: String(process.env.JUMPCLOUD_MFA_SECRET) }));
      const inputs = page.locator('.TotpInput__loginInput');

      console.log("[SLACK] Entering TOTP digits...");
      for (let i = 0; i < 6; i++) {
        await inputs.nth(i).pressSequentially(mfaToken[i], { delay: 150 });
      }

      console.log("[SLACK] MFA submitted, waiting for Slack dashboard...");

      // FIX: Instead of waitForNavigation, we wait for Slack's specific UI to appear.
      // This is much faster and avoids the timeout error.
      await page.waitForFunction(() => {
        return document.body.innerText.includes("People") || 
               document.querySelector('[data-qa="org_members_table_header"]');
      }, { timeout: 30000 });

      console.log("[SLACK] Redirect successful.");

    } catch (error) {
      console.error("[SLACK] Login sequence failed:", error.message);
      throw error;
    }
  },

  async gotoUsers(page) {
    console.log("[SLACK] Waiting for admin UI");
    // Ensure we are on a management URL
    await page.waitForURL(
      url => url.href.includes("/manage/") || url.href.includes("enterprise.slack.com"),
      { timeout: 60000 }
    );

    // Apply Admin Filter
    const filterBtn = '[data-qa="org_members_table_header-filter-button"]';
    await page.waitForSelector(filterBtn, { timeout: 30000 });
    await page.click(filterBtn);
    await page.click('text=Org Admins & Owners');

    // Wait for the table to refresh with the filtered data
    await page.waitForFunction(() => document.body.innerText.includes("Org Admins"));
    console.log("[SLACK] Admin filter applied");
  },

  async loggedInCheck(page) {
    await page.waitForFunction(() => document.body.innerText.includes("People"), { timeout: 30000 });
  }
};
