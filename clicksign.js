import axios from "axios";
import dotenv from 'dotenv';
dotenv.config({ override: true });

export default async function clicksignUsers() {
    const users = new Set();
    const API_KEY = process.env.CLICKSIGN_API_KEY;
    // Updated to v3 to match your successful PowerShell command
    const BASE_URL = "https://app.clicksign.com/api/v3";

    if (!API_KEY) {
        console.warn("[CLICKSIGN API] Missing CLICKSIGN_API_KEY");
        return users;
    }

    try {
        console.log("[CLICKSIGN API] Fetching users via v3 API...");

        const response = await axios.get(`${BASE_URL}/users`, {
            headers: {
                'Authorization': API_KEY,
                'Content-Type': 'application/vnd.api+json',
                'Accept': 'application/json'
            }
        });

        // v3 uses the JSON:API format: response.data.data is an array
        const members = response.data.data || [];

        for (const member of members) {
            // Path: member.attributes.email
            let email = member.attributes?.email?.toLowerCase().trim();
            
            if (!email || email.startsWith("sys")) continue;

            // Normalization for Access Review correlation
            if (email.endsWith("@finspace.ai")) {
                email = email.replace("@finspace.ai", "@neospace.ai");
            }
            
            users.add(email);
        }

        console.log(`[CLICKSIGN API] Done. Found ${users.size} members.`);
        console.log(users);
        return users;

    } catch (err) {
        // Detailed error logging for v3
        const detail = err.response?.data?.errors?.[0]?.detail || err.message;
        console.error(`[CLICKSIGN API] Error: ${detail}`);
        return new Set();
    }
}

clicksignUsers();