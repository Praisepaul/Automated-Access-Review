import dotenv from "dotenv";
dotenv.config({ override: true });
import fs from "fs";

export const controlIdAdapter = {
    loginUrl: "https://idsecure.com.br/auth/login",
    adminsUrl: "https://idsecure.com.br/access/edit/1",
    operatorsTabSelector: 'a.nav-link[data-toggle="tab"]',
    // ADDED: This defines the selector the script was missing
    selector: 'table tbody tr', 

    async login(page) {
        console.log("[CONTROLID] Navigating to login...");
        await page.goto(this.loginUrl, { waitUntil: "domcontentloaded" });

        const userSelectors = ['input[name="username"]', 'input[name="email"]', '#email'];
        const passSelectors = ['input[name="password"]', '#password', '#senha'];

        const findFirstVisible = async (selectors) => {
            for (const s of selectors) {
                const el = await page.$(s);
                if (el) return s;
            }
            return null;
        };

        const userSel = await findFirstVisible(userSelectors);
        const passSel = await findFirstVisible(passSelectors);

        if (!userSel || !passSel) {
            throw new Error("[CONTROLID] Login fields not found.");
        }

        console.log("[CONTROLID] Filling credentials...");
        await page.click(userSel);
        await page.fill(userSel, "");
        await page.type(userSel, process.env.CONTROLID_USER, { delay: 100 });

        await page.click(passSel);
        await page.fill(passSel, "");
        await page.type(passSel, process.env.CONTROLID_PASSWORD, { delay: 100 });

        const loginButtonCandidates = ['button[type="submit"]', 'button:has-text("Entrar")'];

        let clicked = false;
        for (const b of loginButtonCandidates) {
            const btn = await page.$(b);
            if (btn) {
                await page.click(b);
                clicked = true;
                break;
            }
        }

        await page.waitForTimeout(3000);
        await page.waitForURL((url) => !url.href.includes("/auth/login"), { timeout: 30000 });
        console.log("[CONTROLID] Login confirmado. URL atual:", page.url());
    },

    async gotoUsers(page) {
        // Ensure evidence directory exists
        const dir = './evidence/controlid';
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }

        console.log("[CONTROLID] Navigating to access list...");
        await page.goto("https://idsecure.com.br/access", { waitUntil: "networkidle" });

        console.log("[CONTROLID] Waiting table...");
        await page.waitForSelector(this.selector, { timeout: 30000 });

        console.log("[CONTROLID] Clicking second row edit button...");
        await page.waitForSelector('a[href="/access/edit/1"]', { timeout: 30000 });
        await page.click('a[href="/access/edit/1"]');
        await page.waitForLoadState("networkidle");

        console.log('[CONTROLID] Clicking "Operadores" tab...');
        await page.click('a.nav-link:has-text("Operadores")');

        // --- STABILIZATION ---
        // Wait for the table rows specifically under the Operadores tab
        await page.waitForSelector(this.selector, { state: 'visible', timeout: 15000 });
        
        // Match the viewport pattern from your other working apps
        await page.setViewportSize({ width: 1400, height: 1800 });

        // Trigger hydration/lazy loading
        await page.evaluate(() => window.scrollBy(0, 300));
        await page.waitForTimeout(2000); 
        await page.evaluate(() => window.scrollTo(0, 0));

        const screenshotPath = `${dir}/controlid_operators.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`[CONTROLID] Screenshot saved to: ${screenshotPath}`);
        
        return screenshotPath;
    },
    /**
     * Scrapes the operator emails from the UI table for comparison
     * @returns {Promise<Set<string>>}
     */
    async extractUsers(page) {
        console.log("[CONTROLID] Extracting users from Operadores table...");
        
        // Wait for the rows to be present in the DOM
        await page.waitForSelector(this.selector, { timeout: 10000 });

        const emails = await page.$$eval(this.selector, (rows) => {
            return rows.map(row => {
                // In IDSecure, emails are typically in the 2nd or 3rd column
                // Adjust nth-child(2) if your specific table layout differs
                const emailCell = row.querySelector('td:nth-child(2)'); 
                return emailCell ? emailCell.innerText.trim().toLowerCase() : null;
            }).filter(e => e && e.includes('@'));
        });

        const userSet = new Set(emails);
        console.log(`[CONTROLID] Scraped ${userSet.size} operators from UI.`);
        return userSet;
    }
};