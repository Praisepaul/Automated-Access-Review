import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config({ override: true });

export default async function googleAdmins() {
    const users = new Set();

    try {
        const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        
        if (!privateKey || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
            throw new Error("Missing credentials in .env");
        }

        const auth = new google.auth.JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: privateKey,
            scopes: ['https://www.googleapis.com/auth/admin.directory.user.readonly'],
            subject: process.env.GOOGLE_ADMIN_EMAIL,
        });

        // --- THE RELIABLE FIX ---
        // 'directory_v1' is the specific identifier for the User/Group API
        const adminClient = google.admin({ version: 'directory_v1', auth });
        // ------------------------

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
