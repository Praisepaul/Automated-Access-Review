import { generateSync } from 'otplib';
import dotenv from 'dotenv';
dotenv.config({ override: true });

export const snykAdapter = {
    // FIX: This must match a real element that persists on the page
    // for the evidence wrapper to confirm the page is ready.
selector: 'body',

    async login(page) {
        console.log("[SNYK] Navigating to SSO Login...");
        await page.goto('https://app.us.snyk.io/login/sso');

        const snykEmailSelector = '[data-snyk-test="LoginSSOForm: SSO Input"]';
        await page.waitForSelector(snykEmailSelector, { timeout: 15000 });
        
        await page.click(snykEmailSelector);
        await page.fill(snykEmailSelector, process.env.JUMPCLOUD_EMAIL);
        await page.click('button[data-snyk-test="LoginSSOForm: action button"]');

        console.log("[SNYK] Redirected to JumpCloud. Authenticating...");

        await page.waitForSelector('input[name="email"]');
        await page.fill('input[name="email"]', process.env.JUMPCLOUD_EMAIL);
        await page.click('button[data-automation="loginButton"]');

        await page.waitForSelector('input[name="password"]');
        await page.fill('input[name="password"]', process.env.JUMPCLOUD_PASSWORD);
        await page.click('button[data-automation="loginButton"]');

        console.log("[SNYK] Handling JumpCloud MFA...");
        try {
            await page.waitForSelector('.TotpInput__totpInputContainer', { state: 'visible', timeout: 20000 });
            const mfaToken = String(generateSync({ secret: String(process.env.JUMPCLOUD_MFA_SECRET) }));
            const inputs = page.locator('.TotpInput__loginInput');
            for (let i = 0; i < 6; i++) {
                await inputs.nth(i).pressSequentially(mfaToken[i], { delay: 150 });
            }
        } catch (e) {
            console.warn("[SNYK] MFA step skipped.");
        }

        await page.waitForURL(url => url.href.includes('snyk.io'), { timeout: 30000 });
        console.log("Snyk Login successful");
    },

    async gotoUsers(page) {
  console.log("[SNYK] Navigating to Organization Members page...");

  await page.goto(
    'https://app.us.snyk.io/org/neospace-default/manage/members',
    { waitUntil: 'domcontentloaded' }
  );

  // 1. Confirm we are on the correct page (SPA-safe)
  await page.waitForURL(
    url => url.pathname.includes('/manage/members'),
    { timeout: 30000 }
  );

  console.log("[SNYK] Members page URL loaded. Stabilizing UI...");

  // 2. Hard stabilization wait (SPA + Vue + network)
  await page.waitForTimeout(5000);

  // 3. OPTIONAL: best-effort table check (non-blocking)
  const tableExists = await page
    .locator('#sortable-table')
    .first()
    .isVisible()
    .catch(() => false);

  // 4. Prepare viewport for evidence

  console.log("[SNYK] Proceeding with UI evidence capture.");
}

};