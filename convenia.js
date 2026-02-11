import axios from "axios";
import dotenv from 'dotenv';
dotenv.config({ override: true });

export default async function conveniaUsers() {
    const users = new Set();
    const TOKEN = process.env.CONVENIA_TOKEN;
    const BASE_URL = "https://public-api.convenia.com.br/api/v3/employees";

    if (!TOKEN) {
        console.warn("[CONVENIA API] Missing CONVENIA_TOKEN");
        return users;
    }

    try {
        let currentPage = 1;
        let hasMore = true;

        console.log("[CONVENIA API] Fetching all employees...");

        while (hasMore) {
            const response = await axios.get(BASE_URL, {
                headers: {
                    'token': TOKEN,
                    'Accept': 'application/json'
                },
                params: {
                    page: currentPage,
                    limit: 100 // Fetching maximum allowed per page for efficiency
                }
            });

            const employees = response.data.data || [];

            if (employees.length === 0) {
                hasMore = false;
                break;
            }

            for (const emp of employees) {
                // Convenia usually provides corporate email in 'email' 
                // or personal in 'personal_email'. We prioritize work email.
                let email = (emp.email || emp.personal_email || "").toLowerCase().trim();

                // Status check: Only include active employees (usually status 1 or 'active')
                // Adjust this if your debug data showed a different status field
                if (!email || email.startsWith("sys")) continue;
                
                // Exclude dismissed employees if the field exists
                if (emp.dismissal_date) continue;

                users.add(email);
            }

            console.log(`[CONVENIA API] Processed page ${currentPage} (Found ${employees.length} entries)`);
            
            // Pagination Check: If we received fewer items than the limit, it's the last page
            if (employees.length < 100) {
                hasMore = false;
            } else {
                currentPage++;
            }
        }

        console.log(`[CONVENIA API] Done. Found ${users.size} unique active employees.`);
        return users;

    } catch (err) {
        console.error(
            "[CONVENIA API] Error:", 
            err.response?.data?.message || err.message
        );
        return new Set();
    }
}