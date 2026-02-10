import dotenv from 'dotenv';
import axios from "axios";
dotenv.config({ override: true });

/**
 * Fetch Postman team members via Postman Management API
 */
export default async function postmanUsers() {
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
                // Use X-Api-Key as confirmed by your test
                'X-Api-Key': API_KEY,
                'Accept': 'application/json'
            }
        });

        // The debug log showed the key is 'data'
        const resources = response.data.data || [];

        if (!Array.isArray(resources)) {
            console.warn("[POSTMAN API] resources is still not an array. Check raw output.");
            return users;
        }

        for (const user of resources) {
            // Postman usually provides email in user.email or user.attributes.email
            let email = (user.email || user.attributes?.email)?.toLowerCase().trim();

            if (!email || !email.includes("@")) continue;

            users.add(email);
        }
        console.log(users);
        console.log(`[POSTMAN API] Done. Found ${users.size} unique users.`);
        return users;

    } catch (err) {
        const errorDetail = err.response?.data?.error?.message || err.message;
        console.error(`[POSTMAN API] Error: ${errorDetail}`);
        return new Set();
    }
}

postmanUsers();