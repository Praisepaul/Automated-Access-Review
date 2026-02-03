import dotenv from 'dotenv';
import axios from "axios";
dotenv.config({ override: true });

/**
 * Fetch Confluence users belonging to the specific Admin group via Atlassian REST API v3
 */
export default async function confluenceUsers(debug = false) {
    const domain = process.env.JIRA_TEAM_NAME;
    const groupId = process.env.JIRA_ADMIN_GROUP_ID; // Your confirmed Admin Group ID
    const users = new Set();
    
    // Auth string: email:API_TOKEN encoded in Base64
    const auth = Buffer.from(
        `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`
    ).toString('base64');

    let startAt = 0;
    const maxResults = 50;
    let isLast = false;

    try {
        console.log("[CONFLUENCE API] Fetching group members...");

        while (!isLast) {
            const response = await axios.get(
                `https://${domain}.atlassian.net/rest/api/3/group/member`,
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Accept': 'application/json'
                    },
                    params: {
                        groupId: groupId,
                        startAt: startAt,
                        maxResults: maxResults
                    }
                }
            );

            const results = response.data.values || [];

            for (const user of results) {
                // Ignore inactive users or non-human accounts
                if (!user.active || user.accountType !== 'atlassian') continue;

                const email = user.emailAddress?.toLowerCase().trim();

                if (debug) {
                    console.log(`[DEBUG] Processing Confluence User: ${user.displayName} (${email})`);
                }

                // Only add users from your organization's domain
                if (email && email.endsWith("@neospace.ai")) {
                    users.add(email);
                }
            }

            // Pagination check
            if (results.length < maxResults || response.data.isLast) {
                isLast = true;
            } else {
                startAt += maxResults;
            }
        }

        console.log(`[CONFLUENCE API] Done. Found ${users.size} active administrators.`);
        return users;

    } catch (err) {
        console.error("[CONFLUENCE API] Error:", err.response?.data?.errorMessages || err.message);
        return new Set();
    }
}