import dotenv from 'dotenv';
dotenv.config({ override: true });

export const resendAdapter = {
    // Selector for the members section to confirm the page is ready
    selector: 'section:has-text("Members"), .font-bold:has-text("Members")',

    async login(page) {
        console.log("[RESEND] Navigating to Login...");
        await page.goto('https://resend.com/login?method=password', { waitUntil: 'load' });

        // 1. Enter Email
        await page.waitForSelector('input#email', { timeout: 15000 });
        await page.click('input#email');
        await page.type('input#email', process.env.RESEND_EMAIL, {delay: 100});

        // 2. Enter Password
        await page.click('input#password');
        await page.type('input#password', process.env.RESEND_PASSWORD , {delay: 100});

        // 3. Click Log In
        const loginBtnSelector = 'button[type="submit"]:has-text("Log In")';
        
        console.log("[RESEND]  Submitting Login Form.");
        await page.waitForSelector(loginBtnSelector, { state: 'visible' });
        await page.click(loginBtnSelector);

        // 4. Wait for dashboard redirect
        await page.waitForURL(url => url.href.includes('resend.com/emails') || url.href.includes('settings'), { timeout: 30000 });
        console.log(" Resend Login successful");
    },

    async gotoUsers(page) {
        console.log("[RESEND] Navigating to Team Settings...");
        const teamUrl = 'https://resend.com/settings/team';
        
        await page.goto(teamUrl, { waitUntil: 'domcontentloaded' });

        try {
            // 1. Wait for the 'Members' section to appear
            await page.waitForSelector('section:has-text("Members")', { timeout: 20000 });

            await page.waitForSelector('p.text-sm.font-semibold', { state: 'attached', timeout: 15000 });

            console.log(" Resend member list visible.");
        } catch (e) {
            console.error("[RESEND] Team page failed to hydrate.");
            await page.screenshot({ path: './evidence/resend_error.png' });
            throw e;
        }

        // 3. Stabilization
        await page.setViewportSize({ width: 1400, height: 1800 });
        
        await page.evaluate(() => window.scrollBy(0, 300));
        await page.waitForTimeout(2000);
        await page.evaluate(() => window.scrollTo(0, 0));
    }
};