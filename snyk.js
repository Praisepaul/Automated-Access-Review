import dotenv from 'dotenv';
import axios from "axios";
dotenv.config({ override: true });

/**
 * Fetches Snyk Group members and returns a Set of unique emails.
 */
export default async function snykUsers(debug = false) {
    const GROUP_ID = 'c30490bc-d19f-4c56-9e2d-88a52eb8e5c9';
    // Use the US-02 regional endpoint as per your previous success
    const BASE_URL = `https://api.us.snyk.io/v1/group/${process.env.GROUP_ID}/members`;

    try {
        console.log("[SNYK API] Fetching group members via V1 API...");

        const response = await axios.get(BASE_URL, {
            headers: {
                'Authorization': `token ${process.env.SNYK_API_TOKEN}`,
                'Accept': 'application/json'
            }
        });

        const allUsers = new Set();
        const members = response.data || [];

        for (const member of members) {
    // 1. Extract and normalize
    const identity = member.email?.toLowerCase().trim();

    // 2. THE FIX: Strict Validation before any processing/logging
    // We check if identity exists, isn't the string "undefined", and matches your domain
    if (!identity || identity === "undefined" || !identity.endsWith("@neospace.ai")) {
        continue; // Skip service accounts/invalid users immediately
    }

    // 3. Log only if it passed the check
    if (debug) {
        console.log(`[DEBUG] Processing Snyk User: ${identity} (${member.name})`);
    }

    allUsers.add(identity);
}
        console.log(`[SNYK API] Done. Found ${allUsers.size} matching members.`);
        return allUsers;

    } catch (err) {
        // Detailed error logging for Snyk's specific error format
        const errorDetail = err.response?.data?.error || err.message;
        console.error("[SNYK API] Error:", errorDetail);
        return new Set();
    }
}