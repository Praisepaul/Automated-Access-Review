import dotenv from 'dotenv';
import { generateSync } from 'otplib';

dotenv.config({ override: true });

export const netskopeAdapter = {
    // Selector for the admin table container
    selector: '[data-testid="admin-users-table"]',

    async login(page) {
        console.log("[NETSKOPE] Navigating to dashboard (expecting JumpCloud redirect)...");
        await page.goto('https://neospaceai.goskope.com/ns#/dashboard');

        // 1. JumpCloud Email
        console.log("[NETSKOPE] Handling JumpCloud SSO Login...");
        await page.waitForSelector('input[name="email"]');
        await page.type('input[name="email"]', process.env.JUMPCLOUD_EMAIL, { delay: 100 });
        await page.click('button[data-automation="loginButton"]');

        // 2. JumpCloud Password
        await page.waitForSelector('input[name="password"]');
        await page.type('input[name="password"]', process.env.JUMPCLOUD_PASSWORD, { delay: 100 });
        await page.click('button[data-automation="loginButton"]');

        // 3. MFA Input
        console.log("[NETSKOPE] Handling MFA...");
        await page.waitForSelector('.TotpInput__totpInputContainer', { state: 'visible', timeout: 20000 });

        const mfaToken = String(generateSync({ secret: String(process.env.JUMPCLOUD_MFA_SECRET) }));
        const inputs = page.locator('.TotpInput__loginInput');

        for (let i = 0; i < 6; i++) {
            await inputs.nth(i).pressSequentially(mfaToken[i], { delay: 150 });
        }

        console.log("[NETSKOPE] MFA submitted, waiting for Netskope dashboard...");
        // Wait for redirect back to Netskope
        await page.waitForURL(url => url.href.includes('goskope.com/ns#/dashboard'), { timeout: 40000 });
        console.log(" Netskope Login successful");
    },

    async gotoUsers(page) {
        console.log("[NETSKOPE] Navigating to Administrator settings...");
        await page.goto('https://neospaceai.goskope.com/ns#/settings/admins');
        
        // Wait for the table to appear
        await page.waitForSelector(this.selector, { timeout: 30000 });

        // Stabilize the UI
        console.log("[NETSKOPE] Preparing for full-list screenshot...");
        
        // Set a tall viewport to avoid scrollbars in the screenshot
        // Based on your HTML, you have ~13 admins, 2000px height is plenty.
        await page.setViewportSize({ width: 1600, height: 2000 });
        
        // Brief wait for any dynamic status badges to load
        await page.waitForTimeout(3000);
    }
};