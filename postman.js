import dotenv from 'dotenv';
import axios from "axios";
dotenv.config({ override: true });

/**
 * Fetch Postman team members via Postman Management API
 * Endpoint: https://api.getpostman.com/users
 */
export default async function postmanUsers(debug = false) {
    const users = new Set();
    const API_KEY = process.env.POSTMAN_API_KEY;

    if (!API_KEY) {
        console.warn("[POSTMAN API] Missing POSTMAN_API_KEY in environment");
        return users;
    }

    try {
        console.log("[POSTMAN API] Fetching team members...");

        const response = await axios.get('https://api.getpostman.com/users', {
            headers: {
                'X-API-Key': API_KEY,
                'Accept': 'application/json'
            }
        });

        // Postman returns { users: [...] }
        const resources = response.data.users || [];

        for (const user of resources) {
            // Postman user object fields: email, fullName, status
            const email = user.email?.toLowerCase().trim();
            const status = user.status?.toLowerCase();

            if (debug) {
                console.log(`[DEBUG] Processing Postman User: ${user.fullName} (${email}) - Status: ${status}`);
            }

            // 1. Basic validation: must be an email
            if (!email || !email.includes("@")) continue;

            // 2. Filter for your organization's domain
            if (!email.endsWith("@neospace.ai")) continue;

            // 3. Exclude service accounts or automation users
            if (email.startsWith("sys_") || email.includes("integration")) continue;

            // 4. Only include active users (Postman uses 'active' or 'pending')
            // 'pending' users are invited but haven't joined yet
            if (status !== 'active') continue;

            users.add(email);
        }

        console.log(`[POSTMAN API] Done. Found ${users.size} active matching users.`);
        return users;

    } catch (err) {
        console.error(
            "[POSTMAN API] Error:", 
            err.response?.data?.error?.message || err.message
        );
        return new Set();
    }
}