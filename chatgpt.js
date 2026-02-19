import dotenv from 'dotenv';
import axios from "axios";
dotenv.config({ override: true });

/**
 * Fetch OpenAI Project users via Administration API
 */
export default async function chatgptUsers() {
    const users = new Set();
    const API_KEY = process.env.OPENAI_ADMIN_KEY;
    const PROJECT_ID = process.env.OPENAI_PROJECT_ID;

    if (!API_KEY || !PROJECT_ID) {
        console.warn("[OPENAI API] Missing OPENAI_ADMIN_KEY or PROJECT_ID in environment");
        return users;
    }

    let after = null;
    let hasMore = true;

    try {
        console.log(`[OPENAI API] Fetching users for project: ${PROJECT_ID}...`);

        while (hasMore) {
            const response = await axios.get(`https://api.openai.com/v1/organization/projects/${PROJECT_ID}/users`, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    limit: 20,
                    ...(after ? { after } : {})
                }
            });

            const members = response.data.data || [];

            for (const member of members) {
                let email = member.email?.toLowerCase().trim();
                
                // 1. Basic validation
                if (!email || !email.includes("@")) continue;

                // 2. DOMAIN MAPPING: Convert finspace.ai to neospace.ai
                // This prevents false positives if JumpCloud only has the new domain
                if (email.includes("@finspace.ai")) {
                    email = email.replace("@finspace.ai", "@neospace.ai");
                }


                // 3. Exclude automation accounts
                if (email.startsWith("sys_")) continue;

                users.add(email);
            }

            // Handle Pagination
            hasMore = response.data.has_more;
            after = response.data.last_id;
        }

        console.log(`[OPENAI API] Done. Found ${users.size} unique users.`);
        
        return users;

    } catch (err) {
        console.error(
            "[OPENAI API] Error:", 
            err.response?.data?.error?.message || err.message
        );
        return new Set();
    }
}