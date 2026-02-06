import axios from "axios";
import { createHash, randomBytes } from "crypto";
import dotenv from 'dotenv';
dotenv.config({ override: true });

/**
 * Fetch MongoDB Atlas Project Users
 * API: https://www.mongodb.com/docs/atlas/reference/api-resources/
 */
export default async function mongodbUsers() {
    const users = new Set();
    const PUBLIC_KEY = process.env.MONGODB_ATLAS_PUBLIC_KEY;
    const PRIVATE_KEY = process.env.MONGODB_ATLAS_PRIVATE_KEY;
    const PROJECT_ID = process.env.MONGODB_ATLAS_PROJECT_ID;

    if (!PUBLIC_KEY || !PRIVATE_KEY || !PROJECT_ID) {
        console.warn("[MONGODB API] Missing credentials in environment");
        return users;
    }

    try {
        // Atlas requires Digest Auth. Axios-Digest-Auth can be used, 
        // but for a simple fetch, we use standard axios with auth object.
        const response = await axios.get(
            `https://cloud.mongodb.com/api/atlas/v1.0/groups/${PROJECT_ID}/users`,
            {
                auth: {
                    username: PUBLIC_KEY,
                    password: PRIVATE_KEY
                },
                params: {
                    itemsPerPage: 100
                }
            }
        );

        const members = response.data.results || [];

        for (const member of members) {
            let email = member.emailAddress?.toLowerCase().trim();
            
            if (!email) continue;

            users.add(email);
        }

        console.log(`[MONGODB API] Done. Found ${users.size} active users.`);
        return users;

    } catch (err) {
        console.error(
            "[MONGODB API] Error:", 
            err.response?.data?.detail || err.message
        );
        return new Set();
    }
}