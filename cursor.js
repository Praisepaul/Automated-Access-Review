import axios from "axios";
import dotenv from 'dotenv';
dotenv.config({ override: true });

export default async function cursorUsers() {
    const users = new Set();
    const API_KEY = process.env.CURSOR_API_KEY;

    if (!API_KEY) {
        console.warn("[CURSOR API] Missing CURSOR_API_KEY");
        return users;
    }

    try {
        // Construct Basic Auth header manually for reliability
        const authHeader = `Basic ${Buffer.from(`${API_KEY}:`).toString('base64')}`;

        const response = await axios.get('https://api.cursor.com/teams/members', {
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/json'
            }
        });

        const members = response.data.teamMembers || [];

        for (const member of members) {
            let email = member.email?.toLowerCase().trim();
            if (!email || email.startsWith("sys")) continue;
            users.add(email);
        }
        console.log(users);
        console.log(`[CURSOR API] Done. Found ${users.size} active users.`);
        return users;

    } catch (err) {
        // Enhanced Error Logging
        const status = err.response?.status;
        const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
        
        console.error(`[CURSOR API] Error (${status}): ${detail}`);
        
        if (status === 401) {
            console.error("-> Tip: Check if your CURSOR_API_KEY is active and has 'Team Admin' permissions.");
        }
        
        return new Set();
    }
}
