import 'dotenv/config';
import { generateSync } from 'otplib';

export const cloudflareAdapter = {
  name: "CLOUDFLARE",
  dashboardUrl: "https://dash.cloudflare.com/login",
  // Selector for the members table you provided
  selector: 'table[role="table"], h1:has-text("Members")',

  async login(page) {
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });
    console.log("[CLOUDFLARE] Navigating to login (Stealth Enabled)...");
    await page.goto(this.dashboardUrl, { waitUntil: "domcontentloaded" });

    try {
      await page.waitForSelector('#email', { state: 'visible', timeout: 30000 });
    } catch (e) {
      // If headless is still getting blocked, Cloudflare might be showing a 
      // full-page "Checking your browser" screen.
      console.log("[CLOUDFLARE] Initial field not found. Checking for full-page challenge...");
      await page.waitForTimeout(5000); 
      await page.reload(); // Sometimes a reload clears the headless block
      await page.waitForSelector('#email', { state: 'visible', timeout: 30000 });
    }
    
    // 1. Enter Credentials
    await page.waitForSelector('#email');
    await page.fill('#email', process.env.CLOUDFLARE_EMAIL);
    await page.fill('#password', process.env.CLOUDFLARE_PASSWORD);

    // 2. THE AUTOMATIC BYPASS
    console.log("[CLOUDFLARE] Monitoring Turnstile challenge...");
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    // Wait for the button. If it's disabled, we know there's a captcha.
    const loginBtn = page.getByTestId('login-submit-button');
    
    // Give it a few seconds to see if it auto-solves thanks to Stealth
    await page.waitForTimeout(3000);

    const isBlocked = await loginBtn.isDisabled();
    await page.waitForTimeout(3000);
   if (isBlocked) {
        console.log("[CLOUDFLARE] Captcha detected.");
        
        try {
            const containerSelector = '[data-testid="challenge-widget-container"]';
            await page.waitForSelector(containerSelector, { state: 'visible', timeout: 20000 });
            
            const container = await page.$(containerSelector);
            const box = await container.boundingBox();
            
            if (box) {
                // Point A: Initial hover to "wake up" the widget (center)
                // Point B: The actual checkbox (x+45)
                const clickX = box.x + 45; 
                const clickY = box.y + (box.height / 2);

                // 1. Move to center first to mimic human focus
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
                await delay(2000); 

                // 2. Slow, curved movement to the actual checkbox
                await page.mouse.move(clickX, clickY, { steps: 35 });

                // 3. Final hesitation before clicking (Crucial to avoid bot detection)
                await delay(2000);
                await page.mouse.click(clickX, clickY);
                
                console.log(`[CLOUDFLARE] Clicked coordinates: ${Math.round(clickX)}, ${Math.round(clickY)}`);
            }
        } catch (err) {
            console.log("[CLOUDFLARE] Auto-click failed, waiting for manual help or auto-solve...");
        }
    }

    // 3. Wait for the button to enable
    await page.waitForFunction(() => {
        const btn = document.querySelector('button[data-testid="login-submit-button"]');
        return btn && !btn.disabled;
    }, { timeout: 45000 });

    await loginBtn.click();

    // 4. TOTP Verification
    await page.waitForSelector('#twofactor_token');
    const token = generateSync({ secret: process.env.CLOUDFLARE_MFA_SECRET });
    await page.fill('#twofactor_token', token);
    await page.click('button[data-testid="two-factor-login-submit-button"]');
    
    // 5. Select Neospace Account
    await page.waitForSelector('text="Neospace"');
    await page.click('text="Neospace"');
  },

  async gotoUsers(page) {
    // We use the ID from the HTML you provided: a7b167e22d517a2054c054d1b5149694
    const membersUrl = page.url().split('/').slice(0, 4).join('/') + '/members';
    
    console.log(`[CLOUDFLARE] Navigating to members page...`);
    await page.goto(membersUrl, { waitUntil: "domcontentloaded" });

    // Wait for the specific table with the member list
    try {
      await page.waitForSelector('table[role="table"]', { timeout: 20000 });
      // Buffer for the "Active" badges to render
      await page.waitForTimeout(3000); 
    } catch (e) {
      console.warn("[CLOUDFLARE] Members table not detected, taking fallback screenshot.");
    }
  }
};

