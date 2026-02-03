import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config({ override: true });

// Minimal TOTP generator for OpenAI
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
        if (val === -1) continue;
        bin += val.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let i = 0; i < bin.length; i += 8) {
        bytes.push(parseInt(bin.substr(i, 8), 2));
    }
    return Buffer.from(bytes.slice(0, Math.floor(bin.length / 8)));
}

export const openaiAdapter = {
    // Selector for the members table/list on the people page
    selector: '.contents', 

    async login(page) {
        console.log("[OPENAI] Navigating to login...");
        await page.goto('https://platform.openai.com/login');

        // 1. Enter Email
        await page.waitForSelector('input[name="email"]', { timeout: 15000 });
        await page.type('input[name="email"]', process.env.OPENAI_EMAIL, {delay : 100});
        await page.click('button[name="intent"][value="email"]');

        // 3. Handle TOTP MFA
        console.log("[OPENAI] Handling TOTP MFA...");
        await page.waitForSelector('input[name="code"]', { timeout: 15000 });
        
        const token = generateTOTP(process.env.OPENAI_MFA_SECRET);
        console.log(`[OPENAI] Generated TOTP: ${token}`);
        
        await page.fill('input[name="code"]', token);
        // Click the final "Continue" button for verification
        await page.click('button[name="intent"][value="verify"]');

        // 4. Verification of Login & Organization Entry
        await page.waitForURL(url => url.href.includes('openai.com'), { timeout: 30000 });
        console.log("✅ OpenAI Login successful");
        
        // Ensure we are in the platform environment
        await page.goto('https://platform.openai.com/chat');
        await page.waitForLoadState('networkidle');
    },

    async gotoUsers(page) {
        console.log("[OPENAI] Navigating to Organization People settings...");
        const peopleUrl = 'https://platform.openai.com/settings/proj_QHQX1IN005cDQhCDKUtLdR4y/people/members';
        await page.goto(peopleUrl);
        
        // Wait for the specific list or table to render
        await page.waitForSelector('table', { timeout: 30000 });

        // Stabilize for screenshot
        console.log("[OPENAI] Stabilizing for screenshot...");
        await page.setViewportSize({ width: 1400, height: 2500 });
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000);
    }
};