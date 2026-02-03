import 'dotenv/config';
import { generateSync } from 'otplib';

export const jumpcloudAdapter = {
    // This targets the main scrollable list container from your HTML
    selector: '.ItemListPagination__itemList__1-159-1',

    async login(page) {
        console.log("[JUMPCLOUD] Navigating to Admin Login...");
        await page.goto('https://console.jumpcloud.com/login/admin');

        // 1. Email Step
        await page.waitForSelector('input[name="email"]');
        await page.fill('input[name="email"]', process.env.JUMPCLOUD_ADMIN_EMAIL);
        await page.click('button[data-automation="loginButton"]');

        // 2. Password Step
        await page.waitForSelector('input[name="password"]');
        await page.type('input[name="password"]', process.env.JUMPCLOUD_ADMIN_PASSWORD, {delay : 100});
        await page.click('button[data-automation="loginButton"]');

        // 3. MFA Step (Individual inputs)
        console.log("[JUMPCLOUD] Handling MFA digits...");
        await page.waitForSelector('.TotpInput__totpInputContainer', { timeout: 15000 });
        
        const token = generateSync({ secret: process.env.JUMPCLOUD_ADMIN_TOTP_SECRET });
    const digits = token.split('');
    const inputs = await page.$$('.TotpInput__totpInputContainer input');

    for (let i = 0; i < 6; i++) {
      await inputs[i].fill(digits[i]);
    }

        console.log("[JUMPCLOUD] Waiting for Dashboard load...");
        // Match the hash-route #/home
        await page.waitForURL(url => url.hash.includes('/home'), { timeout: 30000 });
        console.log("Login successful");
    },

    async gotoUsers(page) {
        console.log("[JUMPCLOUD] Navigating to Administrator Settings...");
        // Use the hash route directly
        await page.goto('https://console.jumpcloud.com/#/settings/administrators');
        
        // Wait for the specific list container you provided
        await page.waitForSelector(this.selector, { timeout: 30000 });

        // 4. Set Pagination to 50
        console.log("[JUMPCLOUD] Setting rows per page to 50...");
        const selectSelector = 'select[data-test-id="Select__select"]';
        await page.waitForSelector(selectSelector);
        await page.selectOption(selectSelector, '50');
        
        // Wait for list to refresh after changing pagination
        await page.waitForTimeout(3000);

        // 5. Handle Scrolling for the Screenshot
        console.log("[JUMPCLOUD] Preparing for full-list screenshot...");
        // We set the viewport very tall to prevent scrollbars in the evidence
        await page.setViewportSize({ width: 1920, height: 2500 });
        
        // Scroll the specific container to the bottom to trigger any lazy loading
        await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el) el.scrollTop = el.scrollHeight;
        }, this.selector);

        await page.waitForTimeout(2000);
    }
};