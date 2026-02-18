import crypto from 'crypto';

// Minimal TOTP generator to bypass otplib issues
function generateTOTP(secret) {
    const key = b32Decode(secret);
    const epoch = Math.floor(Date.now() / 1000);
    const time = Buffer.alloc(8);
    time.writeBigInt64BE(BigInt(Math.floor(epoch / 30)));

    const hmac = crypto.createHmac('sha1', key).update(time).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000;
    return code.toString().padStart(6, '0');
}

function b32Decode(s) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bin = '';
    for (let char of s) {
        let val = alphabet.indexOf(char.toUpperCase());
        bin += val.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let i = 0; i < bin.length; i += 8) {
        bytes.push(parseInt(bin.substr(i, 8), 2));
    }
    return Buffer.from(bytes.slice(0, Math.floor(bin.length / 8)));
}

export const githubAdapter = {
    selector: '#org-members-table',

    async login(page) {
        console.log("[GITHUB] Navigating to login...");
        await page.goto('https://github.com/login');

        await page.fill('input[name="login"]', process.env.NEO_GITHUB_ADMIN_EMAIL);
        await page.fill('input[name="password"]', process.env.NEO_GITHUB_ADMIN_PASSWORD);
        await page.click('input[type="submit"]');

        // 1. Improved Menu Click
        console.log("[GITHUB] Waiting for 2FA screen...");
        const moreOptionsBtn = page.locator('button:has-text("More options")');
        await moreOptionsBtn.waitFor({ state: 'visible', timeout: 15000 });
        
        // Sometimes GitHub needs a real human-like click
        await moreOptionsBtn.click({ delay: 500 }); 

        // 2. Click Authenticator App
        console.log("[GITHUB] Selecting Authenticator App...");
        const authAppLink = page.locator('a:has-text("Authenticator app")');
        await authAppLink.waitFor({ state: 'attached' });
        await authAppLink.click({ force: true });

        // 3. Native TOTP Generation
        const token = generateTOTP(process.env.NEO_GITHUB_ADMIN_TOTP_SECRET);
        console.log(`[GITHUB] Generated TOTP: ${token}`);

        await page.waitForSelector('#app_totp');
        await page.type('#app_totp', token, { delay: 100 });

        await page.waitForURL('https://github.com/', { timeout: 30000 });
        console.log("GitHub Login successful");
    },

    async gotoUsers(page) {
        console.log("[GITHUB] Starting multi-page screenshot capture...");
        const screenshots = [];
        let hasNextPage = true;
        let pageNum = 1;

        await page.goto('https://github.com/orgs/neospace-ai/people');

        while (hasNextPage) {
            console.log(`[GITHUB] Capturing Page ${pageNum}...`);
            await page.waitForSelector(this.selector, { timeout: 20000 });
            
            // Stabilize UI and Scroll
            await page.setViewportSize({ width: 1400, height: 2000 });
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(1000);

            // 1. Take screenshot of the current page
            // Note: We use pageNum in the filename to avoid overwriting
            const screenshotPath = `./evidence/github/github_page_${pageNum}.png`;
            await page.screenshot({ path: screenshotPath, fullPage: true });
            screenshots.push(screenshotPath);

            // 2. Check for "Next" button
            const nextButton = page.locator('a.next_page');
            const isDisabled = await nextButton.evaluate(node => 
                node.classList.contains('disabled') || node.getAttribute('aria-disabled') === 'true'
            ).catch(() => true);

            if (!isDisabled && await nextButton.isVisible()) {
    console.log(`[GITHUB] Moving to Page ${pageNum + 1}...`);
    
    await nextButton.click();
    
    const nextPageNum = pageNum + 1;
    await page.waitForURL(url => url.searchParams.get('page') === String(nextPageNum), { 
        timeout: 10000 
    });

    await page.waitForSelector(`.pagination em.current:has-text("${nextPageNum}")`, { 
        state: 'visible',
        timeout: 10000 
    });

    await page.waitForSelector(this.selector);
    
    pageNum++;
    console.log(`[GITHUB] Page ${pageNum} loaded successfully.`);
} else {
    hasNextPage = false;
    console.log("[GITHUB] Reached the last page.");
}
        }

        return screenshots;
    }
};