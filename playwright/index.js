import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import "dotenv/config";

// index.js (Refactored)

export async function captureUserListEvidence(app, adapter, groups = []) {
  try {
    return await _capture(app, adapter, groups);
  } catch (e) {
    console.warn(`[${app.toUpperCase()}] UI evidence failed`);
    console.warn(e.message);
    // Return empty results on failure
    return { screenshots: [], extractedUsers: new Set() };
  }
}

async function _capture(app, adapter, groups) {
  const browser = await chromium.launch({
    headless: true, // Set to true for production
    args: [
      '--disable-blink-features=AutomationControlled', 
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--headless=new'
    ]
  });

  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await context.newPage();
  
  let result = { screenshots: [], extractedUsers: new Set() };

  try {
    await adapter.login(page);
    await page.waitForLoadState('load', { timeout: 60000 });

    if (app === "oci") {
      // OCI logic remains specific to groups
      for (const g of groups) {
        const p = await captureOciGroup(page, adapter, g, app);
        result.screenshots.push(p);
      }
    } else {
      // GENERIC CAPTURE: Now handles screenshot + data extraction
      const { file, users } = await captureGenericTable(app, page, adapter);
      result.screenshots.push(file);
      result.extractedUsers = users;
    }
    return result; 

  } finally {
    await browser.close();
  }
}

async function captureGenericTable(app, page, adapter) {
  const dir = path.join(process.cwd(), "evidence", app);
  fs.mkdirSync(dir, { recursive: true });
  
  await adapter.gotoUsers(page);
  
  // Wait for the selector defined in the adapter (e.g., caniphishAdapter.selector)
  await page.waitForSelector(adapter.selector, { timeout: 60000 });
  await page.waitForTimeout(3000);

  // --- DATA EXTRACTION STEP ---
  let users = new Set();
  if (typeof adapter.extractUsers === 'function') {
      users = await adapter.extractUsers(page);
      console.log(`[${app.toUpperCase()}] Scraped Users:`, Array.from(users));
  }

  const file = path.join(dir, `users.png`);
  await page.screenshot({ path: file, fullPage: false });
  
  return { file, users }; 
}
