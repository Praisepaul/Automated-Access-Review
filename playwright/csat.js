import 'dotenv/config';
import readline from 'readline';

export const csatAdapter = {
  name: "CSAT",
  dashboardUrl: "https://csat.cisecurity.org/", 
  // Selector targets the user list headers and the middle-aligned list containers
  selector: '.ui.middle.aligned.list, .ui.sub.header',

  async login(page) {
    console.log("[CSAT] Navigating to login...");
    await page.goto("https://csat.cisecurity.org/accounts/login/", { waitUntil: "domcontentloaded" });

    // 1. Enter Credentials
    await page.waitForSelector('#id_username');
    await page.fill('#id_username', process.env.CSAT_EMAIL);
    await page.fill('#id_password', process.env.CSAT_PASSWORD);
    
    // 2. Click Login
    console.log("[CSAT] Submitting credentials...");
    await page.click('input[type="submit"][value="Login"]');

    // 3. Handle Email OTP
    console.log("[CSAT] Waiting for OTP page...");
    await page.waitForSelector('#otp', { timeout: 15000 });

    // 4. MANUAL PAUSE: Get OTP from Terminal
    const otpCode = await this.askForOTP();
    
    console.log(`[CSAT] Entering OTP: ${otpCode}`);
    await page.fill('#otp', otpCode);

    // 5. Submit OTP
    await page.click('input[type="submit"][value="Verify OTP"]', { force: true });

    // 6. Wait for landing page
    await page.waitForURL(url => url.pathname === '/' || url.href.includes('assessments'), { timeout: 30000 });
    console.log("[CSAT] Login Successful! ✅");
  },

  async askForOTP() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise(resolve => {
      rl.question('\n[ACTION REQUIRED] Please check your email and enter the CSAT OTP: ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  },

  async gotoUsers(page) {
    const adminUrl = "https://csat.cisecurity.org/accounts/administration/";
    console.log(`[CSAT] Navigating to Administration: ${adminUrl}`);
    
    // Switched to domcontentloaded per your request
    await page.goto(adminUrl, { waitUntil: "domcontentloaded" });
    
    console.log("[CSAT] Waiting for Active Users list to render...");
    try {
      // Specifically wait for the list container found in your HTML
      await page.waitForSelector('.ui.middle.aligned.list', { timeout: 15000 });
      
      // Essential buffer for CSAT as it loads user avatars and labels (Owner, etc.)
      await page.waitForTimeout(4000); 
    } catch (e) {
      console.warn("[CSAT] User list did not appear in time, taking fallback screenshot...");
    }
  }
};