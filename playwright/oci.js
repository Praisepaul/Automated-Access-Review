import "dotenv/config";
import { generateSync } from 'otplib';

export const ociAdapter = {
  userDataDir: "./.oci-profile",
  headless: false,
  // OCI table rows often use this class
  selector: '.oj-table-body-row, [role="row"], table',

  async login(page) {
    console.log("[OCI] Starting automated login...");
    await page.goto(`https://cloud.oracle.com/?region=${process.env.OCI_REGION}`, { waitUntil: "domcontentloaded" });

    // --- Phase 1: Cloud Account Name ---
    const accountInput = '#cloudAccountName';
    await page.waitForSelector(accountInput);
    await page.click(accountInput);
    await page.focus(accountInput);
    await page.type(accountInput, "neospaceai", { delay: 100 });
    await page.click('#cloudAccountButton', { force: true });

    // --- Phase 2: Credentials ---
    console.log("[OCI] Entering credentials...");
    const userField = '#idcs-signin-basic-signin-form-username';
    await page.waitForSelector(userField);
    await page.type(userField, process.env.OCI_EMAIL, { delay: 100 });

    // Using attribute selector for special characters in ID
    const passField = 'input[id="idcs-signin-basic-signin-form-password|input"]';
    await page.waitForSelector(passField);
    await page.type(passField, process.env.OCI_PASSWORD, { delay: 100 });

    await page.click('#idcs-signin-basic-signin-form-submit button');

    // --- Phase 3: MFA Passcode ---
    console.log("[OCI] Waiting for MFA passcode field...");
    const mfaInput = 'input[id="idcs-mfa-mfa-auth-passcode-input|input"]';
    await page.waitForSelector(mfaInput, { timeout: 30000 });

    const token = generateSync({ secret: process.env.OCI_MFA_SECRET });
    console.log("[OCI] Entering MFA Token:", token);
    await page.type(mfaInput, token);

    const verifyBtn = '#idcs-mfa-mfa-auth-totp-submit-button button';
    await page.waitForSelector(verifyBtn);
    await page.click(verifyBtn);

    // --- Phase 4: Handle Post-MFA Redirects ---
    console.log("[OCI] Waiting for session stabilization...");
    // Wait for the Oracle dashboard to appear before forcing navigation
    await page.waitForLoadState('load'); 
    await page.waitForTimeout(5000); 

    const identityHome = 
      `https://cloud.oracle.com/identity/domains/` +
      `${process.env.OCI_DOMAIN_OCID}` +
      `/users?region=${process.env.OCI_REGION}`;

    console.log("[OCI] Navigating to Identity console...");
    await page.goto(identityHome, { waitUntil: "domcontentloaded" });
  },

  async loggedInCheck(page) {
    console.log("[OCI] Verifying Identity console readiness");
    await page.waitForURL(
      url => url.href.includes("/identity/domains/"),
      { timeout: 3000 }
    );
    console.log("[OCI] Identity console is ready");
  },

  async gotoGroupUsers(page, groupId, groupName) {
    await this.loggedInCheck(page);

    const groupUrl =
      `https://cloud.oracle.com/identity/domains/` +
      `${process.env.OCI_DOMAIN_OCID}` +
      `/groups/${groupId}/group-users` +
      `?region=${process.env.OCI_REGION}`;

    console.log(`[OCI] Navigating to group users: ${groupName}`);
    // Match your manual script's waitUntil
    await page.goto(groupUrl, { waitUntil: "domcontentloaded" });

    console.log(`[OCI] Group page loaded: ${groupName}`);
    // Oracle JET takes time to fetch JSON and render rows
    await page.waitForTimeout(8000); 
  }
};
