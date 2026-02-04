import axios from "axios";

export default async function figmaUsers(debug = false) {
    const users = new Set();
    const TEAM_ID = process.env.FIGMA_TEAM_ID;
    const TOKEN = process.env.FIGMA_TOKEN; // Personal Access Token

    try {
        console.log(`[FIGMA] Fetching members for team ${TEAM_ID}...`);
        
        // On Professional plans, we use the Team Members endpoint
        const response = await axios.get(`https://api.figma.com/v1/teams/${TEAM_ID}/members`, {
            headers: { 'X-Figma-Token': TOKEN }
        });

        const members = response.data.members || [];

        for (const m of members) {
            let email = m.email?.toLowerCase().trim();
            if (!email) continue;

            // Domain normalization (Legacy support)
            if (email.endsWith("@finspace.ai")) {
                email = email.replace("@finspace.ai", "@neospace.ai");
            }

            users.add(email);
        }

        if (debug) console.log("[FIGMA] Users:", [...users]);
        return users;
    } catch (err) {
        // If API fails (common on some Pro tiers), return empty set
        console.error("[FIGMA] API Error:", err.response?.data?.message || err.message);
        return new Set();
    }
}