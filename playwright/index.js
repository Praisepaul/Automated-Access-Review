import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import "dotenv/config";

export async function captureUserListEvidence(app, adapter, groups = []) {
  try {
    return await _capture(app, adapter, groups);
  } catch (e) {
    console.warn(`[${app.toUpperCase()}] UI evidence failed`);
    console.warn(e.message);
    return [];
  }
}

async function _capture(app, adapter, groups) {
  const browser = await chromium.launch({
    headless: false, //  ====================== true for headless mode ======================
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process' ,
      '--use-gl=desktop', // Helps with WebGL fingerprinting
      '--window-size=1920,1080',
      '--no-sandbox',
      //'--headless=new'      ====================== Uncomment for headless mode ======================
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 },
    deviceScaleFactor: 1,
  });

  // --- SELECTIVE STEALTH ---
  // We only hide the 'webdriver' property for Cloudflare.
  // This prevents JumpCloud from getting confused by fingerprint changes.
  if (app.toLowerCase() === "cloudflare") {
    console.log("[CLOUDFLARE] Applying lightweight stealth...");
    await context.addInitScript(() => {
      // Deletes the 'webdriver' property so Cloudflare doesn't see it
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
  }
const page = await context.newPage();
  let capturedPaths = [];

  try {
    await adapter.login(page);
    await page.waitForLoadState('load', { timeout: 60000 });

    if (app === "oci") {
      for (const g of groups) {
        // Capture and collect path
        const p = await captureOciGroup(page, adapter, g, app);
        capturedPaths.push(p);
      }
    } else {
      // Capture and collect path
      const p = await captureGenericTable(app, page, adapter);
      capturedPaths.push(p);
    }
    return capturedPaths; // Return the list of files to main.js

  } finally {
    await browser.close();
  }
}

async function captureGenericTable(app, page, adapter) {
  const dir = path.join(process.cwd(), "evidence", app);
  fs.mkdirSync(dir, { recursive: true });
  await adapter.gotoUsers(page);
  await page.waitForSelector(adapter.selector, { timeout: 60000 });
  await page.waitForTimeout(3000);

  const file = path.join(dir, `users.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file; // Return path
}

async function captureOciGroup(page, adapter, group, app) {
 const dir = path.join(process.cwd(), "evidence", app, group.name);
  fs.mkdirSync(dir, { recursive: true });
  await adapter.gotoGroupUsers(page, group.groupId, group.name);
  await page.waitForTimeout(2000);

  const file = path.join(dir, "users.png");
  await page.screenshot({ path: file, fullPage: false });
  return file; // Return path
}
