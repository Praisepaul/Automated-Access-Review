import dotenv from 'dotenv';
dotenv.config({ override: true });

export const supabaseAdapter = {
    // Selector used by the evidence wrapper to confirm page is ready
    selector: 'table.group\\/table, .truncate', 

    async login(page) {
        console.log("[SUPABASE] Navigating to Sign-in...");
        await page.goto('https://supabase.com/dashboard/sign-in');

        await page.waitForTimeout(2000); 
        
        await page.waitForSelector('input#email', { timeout: 15000 });
        // 1. Enter Email with a "Fill and Verify" strategy
        console.log("[SUPABASE] Entering Email...");
        await page.click('input#email');
        await page.type('input#email', process.env.SUPABASE_EMAIL, { delay: 100 });

        // 2. Enter Password
        await page.click('input#password');
        await page.type('input#password', process.env.SUPABASE_PASSWORD, { delay: 100 });

        // 3. Click Sign In
        // We use the text "Sign in" because the ID is dynamic in your HTML
        await page.click('button:has-text("Sign in")');

        // 4. Handle possible MFA or redirect
        await page.waitForURL(url => url.href.includes('dashboard/projects') || url.href.includes('organizations'), { timeout: 30000 });
        console.log("Supabase Login successful");
    },

    async gotoUsers(page) {
        console.log("[SUPABASE] Navigating to Team Settings...");
        // Using the specific org URL you provided
        const teamUrl = `https://supabase.com/dashboard/org/${process.env.SUPABASE_ORG_ID}/team`;
        
        await page.goto(teamUrl, { waitUntil: 'domcontentloaded' });

        try {
            // 1. Wait for the 'Team' header to confirm we are on the right page
            await page.waitForSelector('h1:has-text("Team")', { timeout: 20000 });

            // 2. Wait for the table body to contain actual data (emails)
            // We look for a paragraph with a 'truncate' class which holds the emails
            await page.waitForSelector('p.truncate', { state: 'attached', timeout: 15000 });

            console.log("Supabase User list loaded.");
        } catch (e) {
            console.error("[SUPABASE] Table failed to load. Taking debug screenshot...");
            await page.screenshot({ path: './evidence/supabase_error.png' });
            throw e;
        }

        // 3. Stabilization
        await page.setViewportSize({ width: 1400, height: 2000 });
        
        // Supabase uses lazy loading for some table elements; a tiny scroll helps
        await page.evaluate(() => window.scrollBy(0, 200));
        await page.waitForTimeout(2000);
        await page.evaluate(() => window.scrollTo(0, 0));
    }
};

