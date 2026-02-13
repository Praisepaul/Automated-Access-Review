import 'dotenv/config';
import { generateSync } from 'otplib';

export const jumpcloudAdapter = {
    // UPDATED: New selector based on your HTML (v1-162-2)
    selector: '[data-test-id="AdministratorsList__itemList"]',
    rowSelector: '[data-test-id="AdministratorRow__itemRow"]',

    async login(page) {
        // ... (Keep your existing login logic exactly as it is)
        console.log("[JUMPCLOUD] Navigating to Admin Login...");
        await page.goto('https://console.jumpcloud.com/login/admin');

        await page.waitForSelector('input[name="email"]');
        await page.fill('input[name="email"]', process.env.JUMPCLOUD_ADMIN_EMAIL);
        await page.click('button[data-automation="loginButton"]');

        await page.waitForSelector('input[name="password"]');
        await page.type('input[name="password"]', process.env.JUMPCLOUD_ADMIN_PASSWORD, {delay : 100});
        await page.click('button[data-automation="loginButton"]');

        console.log("[JUMPCLOUD] Handling MFA digits...");
        await page.waitForSelector('.TotpInput__totpInputContainer', { timeout: 15000 });
        
        const token = generateSync({ secret: process.env.JUMPCLOUD_ADMIN_TOTP_SECRET });
        const digits = token.split('');
        const inputs = await page.$$('.TotpInput__totpInputContainer input');

        for (let i = 0; i < 6; i++) {
          await inputs[i].fill(digits[i]);
        }

        await page.waitForURL(url => url.hash.includes('/home'), { timeout: 30000 });
        console.log("Login successful");
    },

    async gotoUsers(page) {
        console.log("[JUMPCLOUD] Navigating to Administrator Settings...");
        await page.goto('https://console.jumpcloud.com/#/settings/administrators');
        
        // Handle Tour Guide
        try {
            const closeButton = page.locator('button[data-tour-guide-interactive="true"]').first();
            if (await closeButton.isVisible({ timeout: 5000 })) {
                await closeButton.click({ force: true });
                await page.waitForTimeout(1000);
            }
        } catch (e) {
            console.log("[JUMPCLOUD] No Tour Guide appeared.");
        }

        // UPDATED: Wait for the new versioned selector
        await page.waitForSelector(this.selector, { timeout: 30000 });

        // Set Pagination to 50 or 100
        const selectSelector = 'select[data-test-id="Select__select"]';
        await page.waitForSelector(selectSelector);
        await page.selectOption(selectSelector, '100'); 
        
        await page.waitForTimeout(3000);
        await page.setViewportSize({ width: 1920, height: 3000 });
        
        // Scroll the container to hydrate virtual list
        await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el) el.scrollTop = el.scrollHeight;
        }, this.selector);

        await page.waitForTimeout(2000);
    },

    /**
     * Extracts emails from the new JumpCloud table structure
     * Filters for @neospace.ai only
     */
    async extractUsers(page) {
        console.log("[JUMPCLOUD] Extracting users from new UI table...");

        const emails = await page.$$eval(this.rowSelector, (rows) => {
            return rows.map(row => {
                // The email is specifically in Col 2 based on your HTML
                const emailCell = row.querySelector('.AdministratorRow__col2');
                if (!emailCell) return null;
                
                // Clean up the text (JumpCloud often includes "Email " label inside the span)
                const rawText = emailCell.innerText.toLowerCase();
                const cleanEmail = rawText.replace('email', '').trim();
                
                return cleanEmail.includes('@') ? cleanEmail : null;
            }).filter(e => e !== null);
        });

        // Final filtering for internal domain
        const internalAdmins = new Set(
            emails
            .filter(email => email.endsWith("@neospace.ai"))
            .filter(email => email !== 'fujimoto+jc@neospace.ai')
        );

        console.log(`[JUMPCLOUD] Scraped ${internalAdmins.size} internal admins.`);
        return internalAdmins;
    }
};