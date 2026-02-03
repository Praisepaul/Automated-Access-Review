import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { generateSync } from 'otplib';
import 'dotenv/config';

puppeteer.use(StealthPlugin());

// Helper for delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function captureCloudflareStealth() {
    console.log("[CLOUDFLARE] Launching Undetected Puppeteer Instance...");
    
    const browser = await puppeteer.launch({ 
        headless: false, 
        defaultViewport: { width: 1280, height: 800 },
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-infobars'
        ] 
    });

    const page = await browser.newPage();

    try {
        console.log("[CLOUDFLARE] Navigating to login...");
        await page.goto('https://dash.cloudflare.com/login', { waitUntil: 'networkidle2' });

        // 1. Fill Credentials
        await page.waitForSelector('#email');
        await page.type('#email', process.env.CLOUDFLARE_EMAIL, { delay: 100 });
        await page.type('#password', process.env.CLOUDFLARE_PASSWORD, { delay: 100 });

        console.log("[CLOUDFLARE] Monitoring for Turnstile Challenge...");

        // 2. PIERCE THE SHADOW DOM VIA UPDATED COORDINATES
        const containerSelector = '[data-testid="challenge-widget-container"]';
        await page.waitForSelector(containerSelector, { visible: true, timeout: 20000 });
        
        const container = await page.$(containerSelector);
        const box = await container.boundingBox();

        if (box) {
            console.log("[CLOUDFLARE] Container located. Preparing human-like interaction...");
            
            // NEW COORDINATES: 
            // x + 45: Moves deeper into the checkbox to avoid border-detection
            // y: stays centered in the 65px height
            const clickX = box.x + 45; 
            const clickY = box.y + (box.height / 2);

            // Move mouse in a slow, curved human-like path to avoid "teleport" detection
            await page.mouse.move(clickX, clickY, { steps: 35 });
            
            // CRITICAL DELAY: Wait 3 seconds for the spinner/heartbeat to settle 
            // before clicking. Clicking too early triggers the infinite loop.
            await delay(3000); 
            
            await page.mouse.click(clickX, clickY);
            console.log(`[CLOUDFLARE] Clicked coordinates: ${Math.round(clickX)}, ${Math.round(clickY)}`);
        }

        // 3. MONITOR THE LOGIN BUTTON
        const loginBtnSelector = 'button[data-testid="login-submit-button"]';
        console.log("[CLOUDFLARE] Waiting for success signal (Green Check)...");

        // Wait for the button to become enabled (Success state)
        await page.waitForFunction((sel) => {
            const btn = document.querySelector(sel);
            return btn && !btn.disabled;
        }, { timeout: 60000 }, loginBtnSelector);

        console.log("[CLOUDFLARE] Success! Button enabled. Proceeding to MFA...");
        await page.click(loginBtnSelector);

        // 4. MFA Phase
        await page.waitForSelector('#twofactor_token', { timeout: 20000 });
        const token = String(generateSync({ secret: process.env.CLOUDFLARE_MFA_SECRET }));
        await page.type('#twofactor_token', token, { delay: 50 });
        await page.click('button[data-testid="two-factor-login-submit-button"]');

        // 5. Navigation & Capture
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        
        // Dynamic URL check to handle account redirects
        const currentUrl = page.url();
        const accountId = currentUrl.split('/')[3]; 
        
        console.log(`[CLOUDFLARE] Navigating to members for Account: ${accountId}`);
        await page.goto(`https://dash.cloudflare.com/${accountId}/members`, { waitUntil: 'networkidle2' });
        
        await page.waitForSelector('table', { timeout: 20000 });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        // Ensure evidence directory exists
        const evidenceDir = './evidence/cloudflare';
        await page.screenshot({ path: `${evidenceDir}/users-${timestamp}.png`, fullPage: true });
        
        console.log("[CLOUDFLARE] Evidence captured successfully! ✅");

    } catch (err) {
        console.error("[CLOUDFLARE] Error during capture:", err.message);
        // Leave browser open on error so you can manually click if it's stuck
        await delay(10000); 
    } finally {
        await browser.close();
    }
}

 captureCloudflareStealth();