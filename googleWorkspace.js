import { google } from 'googleapis';
import 'dotenv/config';
export default async function googleAdmins() {
    const users = new Set();

    try {
        let auth;
        
        // 1. Prefer the full JSON if you uploaded it
        if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
            const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
            auth = new google.auth.JWT({
                email: credentials.client_email,
                key: credentials.private_key,
                scopes: ['https://www.googleapis.com/auth/admin.directory.user.readonly'],
                subject: process.env.GOOGLE_ADMIN_EMAIL,
            });
        } 
        // 2. Fallback to individual keys
        else {
            const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
            if (!privateKey || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
                throw new Error("Missing Google credentials (JSON or Key/Email)");
            }
            auth = new google.auth.JWT({
                email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                key: privateKey,
                scopes: ['https://www.googleapis.com/auth/admin.directory.user.readonly'],
                subject: process.env.GOOGLE_ADMIN_EMAIL,
            });
        }

        const adminClient = google.admin({ version: 'directory_v1', auth });
        console.log("[GOOGLE API] Fetching workspace administrators...");
        
        const response = await adminClient.users.list({
            customer: 'my_customer',
            maxResults: 500,
        });

        const accounts = response.data.users || [];
        for (const user of accounts) {
            if (user.isAdmin || user.isDelegatedAdmin) {
                const email = user.primaryEmail?.toLowerCase().trim();
                if (email) users.add(email);
            }
        }

        console.log(`[GOOGLE API] Done. Found ${users.size} admins.`);
        return users;

    } catch (err) {
        console.error("[GOOGLE API] Critical Error:", err.message);
        return new Set();
    }
}