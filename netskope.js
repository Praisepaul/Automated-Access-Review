import dotenv from 'dotenv';
import axios from "axios";
dotenv.config({ override: true });

export default async function netskopeUsers(debug = false) {
    const tenant = "neospaceai"; 
    const BASE_URL = `https://${tenant}.goskope.com/api/v2/platform/administration/scim/Users`;
    
    const filterStr = 'urn:ietf:params:scim:schemas:netskope:2.0:user[provisionedBy eq "LOCAL" and (recordType eq "USER" or recordType eq "SERVICE_ACCOUNT")]';

    try {
        console.log("[NETSKOPE API] Fetching admins via Platform API...");

        const response = await axios.get(BASE_URL, {
            headers: {
                'Authorization': `Bearer ${process.env.NETSKOPE_API_TOKEN}`,
                'Accept': 'application/json'
            },
            params: {
                filter: filterStr,
                count: 500 
            }
        });

        const users = new Set();
        const resources = response.data.Resources || [];

        for (const user of resources) {
            // THE FIX: Use userName because emails array is empty in this API
            const identity = user.userName?.toLowerCase().trim();
            
            if (debug) {
                console.log(`[DEBUG] Processing: ${identity}`);
            }

            // 1. Check if the userName is an email and belongs to the domain
            if (identity && identity.endsWith("@neospace.ai")) {
                users.add(identity);
            } 
            // 2. Fallback: Check the emails array just in case some records have it
            else if (user.emails && user.emails.length > 0) {
                for (const emailObj of user.emails) {
                    const e = emailObj.value?.toLowerCase().trim();
                    if (e && e.endsWith("@neospace.ai")) {
                        users.add(e);
                    }
                }
            }
        }

        console.log(`[NETSKOPE API] Done. Found ${users.size} matching admins.`);
        return users;

    } catch (err) {
        console.error("[NETSKOPE API] Error:", err.response?.data?.detail || err.message);
        return new Set();
    }
}