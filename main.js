import dotenv from 'dotenv';
import './playwright/crowdstrike.js';
import './playwright/slack.js';
import https from 'https';
dotenv.config({ override: true });

import App from "./app.js";
import { listGroups, groupMembers, getJumpCloudUserName } from "./jumpcloud.js";
import { confirmApp, selectGroups, filterGroupsForApp } from "./groupSelector.js";

import slackUsers from "./slack.js";
import crowdstrikeUsers from "./crowdstrike.js";
import ociUsers from "./oci.js";
import cloudflareUsers from "./cloudflare.js";
import githubUsers from './github.js';
import netskopeUsers from "./netskope.js";
import openaiUsers from "./openai.js";
import snykUsers from './snyk.js';
import supabaseUsers from './supabase..js';
import jiraUsers from "./jira.js";
import confluenceUsers from './confluence.js';
import getOciKubernetesUsers from './kubernetes.js';
import chatgptUsers from './chatgpt.js';
import googleAdmins from './googleWorkspace.js';
import vexpensesUsers from './vexpense.js';
import cursorUsers from './cursor.js';
import mongodbUsers from './mongodb.js';
//import conveniaUsers from './convenia.js';
import lucidUsers from './lucid-chart.js';
import { sendSlackSummary } from './slack_notifier.js';

import writeCSV from "./report.js";
import { diffSets } from "./diff.js";
import { updateJiraTicket, createAccessTicket, getJiraTicketStatus } from './jira_ticket.js';

import { captureUserListEvidence } from "./playwright/index.js";
//import { ociAdapter } from './playwright/oci.js';
import { slackAdapter } from "./playwright/slack.js";
import { crowdstrikeAdapter } from "./playwright/crowdstrike.js";
//import { caniphishAdapter } from "./playwright/caniphish.js";
import { csatAdapter } from "./playwright/csat.js";
//import { cloudflareAdapter } from "./playwright/cloudflare.js";
import { jumpcloudAdapter } from './playwright/jumpcloud.js';
import { githubAdapter } from './playwright/github.js';
//import { netskopeAdapter } from './playwright/netskope.js';
import { openaiAdapter } from './playwright/openai.js';
import { snykAdapter } from './playwright/snyk.js';
import { supabaseAdapter } from './playwright/supabase.js';
import { resendAdapter } from './playwright/resend.js';
import { figmaAdapter } from './playwright/figma.js';
import {controlIdAdapter} from './playwright/controlID.js';
const agent = new https.Agent({
  rejectUnauthorized: false
});

// Auto mode: if true, skips confirmation prompts
const AUTO_MODE = true;
const FORCE_RUN = process.env.FORCE_RUN === 'true';

if (!process.env.NODE_EXTRA_CA_CERTS) {
  throw new Error('Missing trusted CA configuration');
}

// Example validation in main.js
function validateEnv() {
    const required = ['JUMPCLOUD_API_KEY', 'SLACK_WEBHOOK_URL', 'JIRA_API_TOKEN'];
    const missing = required.filter(k => !process.env[k]);
    if (missing.length > 0) {
        throw new Error(`CRITICAL: Missing required environment variables: ${missing.join(', ')}`);
    }
}

validateEnv();

const globalReport = [];

/* ============================
   FETCHERS
============================ */

const FETCHERS = {
  slack: slackUsers,
  crowdstrike: crowdstrikeUsers,
  cloudflare: cloudflareUsers,
  oci: ociUsers,
  github: githubUsers,
  netskope: netskopeUsers,
  openai: openaiUsers,
  snyk: snykUsers,
  supabase: supabaseUsers,
  jira: jiraUsers,
  confluence: confluenceUsers,
  kubernetes: getOciKubernetesUsers,
  chatgpt: chatgptUsers,
  googleWorkspace: googleAdmins,
  vexpense: vexpensesUsers,
  cursor: cursorUsers,
  lucid: lucidUsers,
  mongodb: mongodbUsers
};

/* ============================
   LOAD JUMPCLOUD GROUPS ONCE
============================ */

console.log("[INIT] Fetching JumpCloud groups...");
const ALL_JC_GROUPS = await listGroups();
console.log(`[INIT] Loaded ${ALL_JC_GROUPS.length} groups`);


/* ============================
   MAIN LOOP
============================ */

for (const app of Object.keys(App)) {
  let evidenceFiles = [];
  
  // 1. DEFINE NAMES EARLY
  // This ensures 'friendlyName' is available for the Jira check immediately
  const friendlyName = app.charAt(0).toUpperCase() + app.slice(1);
  console.log(`\n=== ${friendlyName.toUpperCase()} ===`);

  /* 2. PRE-CHECK JIRA STATUS */
  // This gates the entire app process (Prompts, Fetching, and Playwright)
  const currentTicketStatus = await getJiraTicketStatus(friendlyName);
  
  if (!FORCE_RUN) {
  if (currentTicketStatus === "IN PROGRESS" || currentTicketStatus === "CLOSED") {
    console.log(`[SKIP] ${friendlyName} is already ${currentTicketStatus}. Skipping process.`);
    continue;
  }
  } else {
    console.log(`[FORCE RUN] Ignoring current Jira status: ${currentTicketStatus}`);
  }

  /* 3. CONFIRMATION / AUTO_MODE */
  if (!AUTO_MODE) {
    if (!(await confirmApp(app))) {
      console.log(`Skipping ${app.toUpperCase()}`);
      continue;
    }
  } else if (app === "csat") {
    console.log("Skipping CSAT (AUTO_MODE enabled)");
    continue;
  }

  const cfg = App[app];

  /* 4. FILTER & SELECT GROUPS */
  const relevantGroups = filterGroupsForApp(app, ALL_JC_GROUPS, App);
  if (!relevantGroups.length) {
    console.log("No relevant JumpCloud groups found, skipping.");
    continue;
  }

  let selectedGroups = [];
  if (AUTO_MODE) {
    if (app === "oci" || app === "snyk") {
      selectedGroups = relevantGroups;
    } else {
      const index = app === "slack" ? 1 : 0;
      if (!relevantGroups[index]) {
        console.warn(`[AUTO_MODE] No group at index ${index} for ${app.toUpperCase()}, skipping`);
        continue;
      }
      selectedGroups = [relevantGroups[index]];
    }
  } else {
    selectedGroups = (app === "oci" || app === "snyk") 
      ? relevantGroups 
      : selectGroups(app, relevantGroups);
  }

  if (!selectedGroups.length) {
    console.log("No groups selected, skipping.");
    continue;
  }

  console.log("Selected groups:");
  selectedGroups.forEach(g => console.log(` - ${g.name} (${g.id})`));

  /* ============================
     OCI ACCESS REVIEW (Special Case)
  ============================ */
  if (app === "oci") {
    const ociResults = await ociUsers({ groups: selectedGroups });
    const ociCsvRows = [];
    const unauthorizedEmails = [];
    const missingEmails = [];

    for (const group of selectedGroups) {
      const expectedMembers = await groupMembers(group.id);
      const actualMembers = ociResults[group.name]?.users || new Set();
      const { unauthorized, missing } = diffSets(expectedMembers, actualMembers);

      unauthorized.forEach(u => {
        const email = typeof u === "string" ? u : u.email;
        ociCsvRows.push({ email, status: "unauthorized", group: group.name });
        unauthorizedEmails.push(`${email} (${group.name})`);
      });

      missing.forEach(u => {
        const email = typeof u === "string" ? u : u.email;
        ociCsvRows.push({ email, status: "missing", group: group.name });
        missingEmails.push(`${email} (${group.name})`);
      });
    }

    if (ociCsvRows.length) {
      const csvPath = `./evidence/api/oci/oci.csv`;
      await writeCSV({ app: "oci", group: "oci", rows: ociCsvRows });
      evidenceFiles.push(csvPath);
    }

    const ociUiGroups = Object.entries(ociResults).map(([name, v]) => ({ name, groupId: v.groupId }));
    //const screenshotPaths = await captureUserListEvidence("oci", ociAdapter, ociUiGroups);
    //evidenceFiles.push(...screenshotPaths);

if (!FORCE_RUN) {
        await updateJiraTicket("OCI", unauthorizedEmails, missingEmails, evidenceFiles);
    }    
    if (unauthorizedEmails.length > 0) {
      for (const entry of unauthorizedEmails) {
        const emailOnly = entry.split(' ')[0]; 
        const { name, email } = await getJumpCloudUserName(emailOnly);
        const jcGroup = selectedGroups[0]?.name || "Jumpcloud";
        await createAccessTicket(name, email, jcGroup);
      }
    }
    continue; // Move to next app in the loop
  }

  // Handle simple evidence-only bypass apps
  if (["censys", "exato", "framer", "adopt", "grafana"].includes(app)) {
    if (!FORCE_RUN) {
        await updateJiraTicket(friendlyName, [], [], []);
    }
    continue;
}

  /* ============================
     OTHER APPS (Slack, Snyk, etc.)
  ============================ */
  const expectedEmails = new Set();
  for (const g of selectedGroups) {
    const members = await groupMembers(g.id);
    members.forEach(m => expectedEmails.add(m.email));
  }

  if (cfg.evidenceOnly) {
    const adapterMap = { 
        //caniphish: caniphishAdapter, 
        csat: csatAdapter, 
        jumpcloud: jumpcloudAdapter, 
        resend: resendAdapter, 
        figma: figmaAdapter, 
        controlid: controlIdAdapter 
    };

    // Run Playwright and get both screenshots AND data
    const { screenshots, extractedUsers } = await captureUserListEvidence(app, adapterMap[app]);
    
    // If we extracted data, perform the comparison logic
    if (extractedUsers && extractedUsers.size > 0) {
        const { unauthorized, missing } = diffSets(expectedEmails, extractedUsers);

        globalReport.push({
                name: friendlyName,
                missingCount: missing.length,
                unauthorizedCount: unauthorized.length,
                unauthorizedList: unauthorized.map(u => typeof u === "string" ? u : u.email)
            });

        // --- Inside if (cfg.evidenceOnly) block ---
if (unauthorized.length) {
    // FIX: Map the objects to clean rows for the CSV
    const rows = unauthorized.map(u => ({ 
        email: typeof u === "string" ? u : u.email 
    }));
    
    // Ensure you use these 'rows' for the CSV
    const path = await writeCSV({ app, group: "unauthorized", rows: rows });
    if (path) evidenceFiles.push(path);
}

if (missing.length) {
    // FIX: Map for missing users too
    const rows = missing.map(m => ({ 
        email: typeof m === "string" ? m : m.email 
    }));
    
    const path = await writeCSV({ app, group: "missing", rows: rows });
    if (path) evidenceFiles.push(path);
}
        if (!FORCE_RUN) {
            await updateJiraTicket(friendlyName, unauthorized, missing, screenshots);
        } else {
            console.log(`[WEEKLY] Skipping parent ticket update for ${friendlyName}`);
        }
    // Inside your if (cfg.evidenceOnly) block
if (unauthorized.length > 0) {
    console.log(`[TICKET] Raising ${unauthorized.length} individual tickets for ${friendlyName}...`);
    for (const user of unauthorized) {
        // Ensure email is a clean string, not an object or a newline-string
        const emailToLookup = (typeof user === "string" ? user : user.email).split('\n')[0].trim();
        
        const { name, email } = await getJumpCloudUserName(emailToLookup);
        const jcGroup = selectedGroups[0]?.name || "Jumpcloud";
        
        // Ensure name and friendlyName are valid before calling Jira
        if (name && friendlyName) {
            await createAccessTicket(name, email, jcGroup);
        } else {
            console.warn(`[SKIP TICKET] Missing data for ${emailToLookup}`);
        }
    }
}
    } else {
if (!FORCE_RUN) {
            await updateJiraTicket(friendlyName, [], [], screenshots);
        }    }
    continue;
}

  const actual = await FETCHERS[app]({ groups: selectedGroups });
  const { unauthorized, missing } = diffSets(expectedEmails, actual);

  globalReport.push({
        name: friendlyName,
        missingCount: missing.length,
        unauthorizedCount: unauthorized.length,
        unauthorizedList: unauthorized.map(u => typeof u === "string" ? u : u.email)
    });

  // Write Reports
  if (unauthorized.length) {
    const path = await writeCSV({ app, group: "unauthorized", rows: unauthorized.map(u => ({ email: typeof u === "string" ? u : u.email })) });
    if (path) evidenceFiles.push(path);
  }

  if (missing.length) {
    const path = await writeCSV({ app, group: "missing", rows: missing.map(u => ({ email: typeof u === "string" ? u : u.email })) });
    if (path) evidenceFiles.push(path);
  }

  // Capture Screenshots
  const adapters = { slack: slackAdapter, crowdstrike: crowdstrikeAdapter, github: githubAdapter, snyk: snykAdapter, supabase: supabaseAdapter };

if (adapters[app]) {
    const result = await captureUserListEvidence(app, adapters[app]);
    // Fix: access the .screenshots array from the returned object
    if (result && result.screenshots) {
        evidenceFiles.push(...result.screenshots);
    }
}

  if (!FORCE_RUN) {
    console.log(`[COMPLIANCE] Monthly mode: Updating parent audit ticket for ${friendlyName}...`);
    await updateJiraTicket(friendlyName, unauthorized, missing, evidenceFiles);
} else {
    console.log(`[WEEKLY/MANUAL] Skipping ticket updates/attachments.`);
}

  if (unauthorized.length > 0) {
    for (const user of unauthorized) {
      const { name, email } = await getJumpCloudUserName(user);
      const jcGroup = selectedGroups[0]?.name || "Jumpcloud";
      await createAccessTicket(name, email, jcGroup);
    }
  }
}

console.log("\n Access review completed. Sending Slack summary...");
await sendSlackSummary(globalReport);