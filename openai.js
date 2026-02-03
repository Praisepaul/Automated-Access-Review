import axios from "axios";
import dotenv from 'dotenv';
dotenv.config({ override: true });

export default async function openaiUsers(debug = false) {
    console.log("[OPENAI API] Fetching member list...");
    const emails = new Set();
    let hasMore = true;
    let after = null;

    const HEADERS = {
        'Authorization': `Bearer ${process.env.OPENAI_ADMIN_KEY}`,
        'Content-Type': 'application/json'
    };

    try {
        while (hasMore) {
            const response = await axios.get('https://api.openai.com/v1/organization/users', {
                headers: HEADERS,
                params: {
                    limit: 100, // Maximize per-page results
                    after: after
                }
            });

            const data = response.data.data || [];
            
            if (data.length === 0) {
                hasMore = false;
            } else {
                for (const user of data) {
                    // Extract email, name, and role as requested
                    if (user.email) {
                        emails.add(user.email.toLowerCase().trim());
                    }
                }

                console.log(`[OPENAI API] Retrieved ${data.length} users...`);

                // OpenAI uses the ID of the last object as the cursor for the next page
                after = data[data.length - 1].id;
                
                // If the API returns fewer than the limit, we've reached the end
                if (data.length < 100) {
                    hasMore = false;
                }
            }
        }
        
        console.log(`[OPENAI API] Total users found: ${emails.size}`);
    } catch (err) {
        console.error("[OPENAI API] Error fetching members:", err.response?.data || err.message);
        console.warn("[OPENAI API] API failure, returning empty set");
        return new Set();
    }

    return emails;
}