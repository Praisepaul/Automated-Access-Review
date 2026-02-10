import dotenv from 'dotenv';
dotenv.config({ override: true });

export const figmaAdapter = {
    selector: '.multi_select_list--scrollContent--OTNO2',

    async login(page) {
        const teamUrl = "https://www.figma.com/files/team/1306224741251954525/team-admin-console/members?fuid=1602682857944585555";
        
        console.log("[FIGMA] Navigating to Login...");
        await page.goto(teamUrl);

        // Figma login is often inside a shadow DOM or slow to hydrate.
        // We wait for the email field specifically.
        try {
            await page.waitForSelector('input#email', { state: 'visible', timeout: 15000 });
            
            console.log("[FIGMA] Login form detected. Entering credentials...");

            // 1. Enter Email
            // We click first to ensure focus, then type like a human
            await page.click('input#email');
            await page.fill('input#email', ''); // Clear just in case
            await page.type('input#email', process.env.FIGMA_EMAIL, { delay: 100 });

            // 2. Enter Password
            // Note: Figma sometimes uses 'input[name="password"]' if the ID is shadow-hidden
            const passSelector = 'input#current-password';
            await page.click(passSelector);
            await page.type(passSelector, process.env.FIGMA_PASSWORD, { delay: 100 });
            
            // 3. Click Login
            // Targeting the button by text to be safe
            await page.click('button:has-text("Log in")');

            console.log("[FIGMA] Login submitted. Waiting for dashboard...");
            
            // Wait for the URL to change away from login
            await page.waitForURL(url => !url.href.includes('login'), { timeout: 30000 });
            
        } catch (e) {
            // If the selectors fail, it might be an iframe
            console.error("[FIGMA] Could not find login fields. Attempting frame-based recovery...");
            const frame = page.frames().find(f => f.url().includes('auth'));
            if (frame) {
                await frame.fill('#email', process.env.FIGMA_USER);
                await frame.fill('#current-password', process.env.FIGMA_PASSWORD);
                await frame.click('button[type="submit"]');
            } else {
                throw new Error("Figma login fields not reachable: " + e.message);
            }
        }
    },

    async gotoUsers(page) {
        console.log("[FIGMA] Navigating to Members page...");
        const membersUrl = "https://www.figma.com/files/team/1306224741251954525/team-admin-console/members?fuid=1602682857944585555";
        
        await page.goto(membersUrl, { waitUntil: 'networkidle' });

        console.log("[FIGMA] Waiting for table to load...");
        const rowSelector = '[data-testid="multi-select-list-table-trackable-row"]';
        await page.waitForSelector(rowSelector, { timeout: 30000 });

        // 1. Expand viewport height to fit all users
        // 19 users typically need around 2000px to be safe with Figma's header/spacing
        console.log("[FIGMA] Resizing viewport to capture all members...");
        await page.setViewportSize({ width: 1920, height: 2500 });

        // 2. Scroll the specific scrollable container
        // Figma uses a specific div for scrolling, not the body
        const scrollContainer = '.multi_select_list--scrollContent--OTNO2';
        try {
            await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (el) el.scrollTop = el.scrollHeight;
            }, scrollContainer);
            
            // Short wait for virtual list to render bottom rows
            await page.waitForTimeout(1000);
            
            // Scroll back to top so the screenshot looks professional
            await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (el) el.scrollTop = 0;
            }, scrollContainer);
        } catch (e) {
            console.warn("[FIGMA] Scroll container not found, using window scroll fallback.");
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        }

        // 3. Final stabilization wait
        await page.waitForTimeout(3000);
        console.log("[FIGMA] Viewport expanded and list stabilized.");
    }
};