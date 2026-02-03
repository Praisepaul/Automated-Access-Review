import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ override: true });

export default async function githubUsers() {
    const GITHUB_MAP = {
    "gustavodebsNeo": "gustavo@neospace.ai",
    "IsaacMirandaCamargos": "isaac@neospace.ai",
    "LeandroEFCarijo": "leandro.carrijo@neospace.ai",
    "marcodourado-ctrl": "marco.dourado@neospace.ai",
    "neospace-ansible": "ansible@neospace.ai", 
};
    console.log("[GITHUB API] Fetching members and attempting to resolve emails...");
    const emailMap = new Set();
    const org = "neospace-ai";

    const HEADERS = {
        'Authorization': `Bearer ${process.env.GITHUB_PAT}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'NodeJS-Access-Review'
    };

    try {
        // 1. Get the list of all members (usernames)
        const membersResp = await axios.get(`https://api.github.com/orgs/${org}/members?per_page=100`, { headers: HEADERS });
        const members = membersResp.data;

        console.log(`[GITHUB API] Found ${members.length} members. Resolving emails...`);
        
        for (const member of members) {
            if (GITHUB_MAP[member.login]) {
                emailMap.add(GITHUB_MAP[member.login].toLowerCase().trim());
                continue;
            }

            try {
                // 2. Fetch detailed profile for each user to get their email
                const userResp = await axios.get(`https://api.github.com/users/${member.login}`, { headers: HEADERS });
                const userData = userResp.data;

                if (userData.email) {
                    emailMap.add(userData.email.toLowerCase().trim());
                } else {
                    // FALLBACK: If email is hidden, we use a placeholder or log it
                    // In a non-SAML org, GitHub strictly protects private emails.
                    console.warn(`[GITHUB API] Could not find email for ${member.login} (User has email set to private)`);
                    // We add the username as a fallback so they aren't totally "missing" 
                    // from your unauthorized checks if you know their username pattern.
                    emailMap.add(`${member.login}@github.com`); 
                }
            } catch (e) {
                console.error(`[GITHUB API] Failed to fetch details for ${member.login}`);
            }
        }
    } catch (err) {
        console.error("[GITHUB API] Error:", err.response?.data || err.message);
    }

    return emailMap;
}