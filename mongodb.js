import dotenv from "dotenv";
import axios from "axios";
dotenv.config({ override: true });

/**
 * Fetch MongoDB Atlas organization users via Atlas Admin API v2
 */
export default async function mongodbUsers() {
    const users = new Set();

    const CLIENT_ID = process.env.CLIENT_ID;
    const CLIENT_SECRET = process.env.CLIENT_SECRET;
    const ORG_ID = process.env.ORG_ID;

    if (!CLIENT_ID || !CLIENT_SECRET || !ORG_ID) {
        console.warn("[MONGODB API] Missing CLIENT_ID, CLIENT_SECRET, or ORG_ID");
        return users;
    }

    try {
        console.log("[MONGODB API] Fetching organization users...");

        // 1. Get OAuth token
        const authHeader = Buffer
            .from(`${CLIENT_ID}:${CLIENT_SECRET}`)
            .toString("base64");

        const authResponse = await axios.post(
            "https://cloud.mongodb.com/api/oauth/token",
            "grant_type=client_credentials",
            {
                headers: {
                    Authorization: `Basic ${authHeader}`,
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );

        const token = authResponse.data.access_token;
        if (!token) {
            console.warn("[MONGODB API] No access token returned");
            return users;
        }

        // 2. Fetch org users (ACTIVE + PENDING)
        const response = await axios.get(
            `https://cloud.mongodb.com/api/atlas/v2/orgs/${ORG_ID}/users`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    // REQUIRED for pending + active users
                    Accept: "application/vnd.atlas.2025-02-19+json"
                },
                params: {
                    itemsPerPage: 500,
                    includeCount: true
                }
            }
        );

        const resources = response.data?.results || [];

        if (!Array.isArray(resources)) {
            console.warn("[MONGODB API] results is not an array. Check raw output.");
            return users;
        }

        for (const user of resources) {
            let email = user.username?.toLowerCase().trim();

            if (!email || !email.includes("@neospace.ai") || email.startsWith("sys")) continue;

            users.add(email);
        }
        console.log(users);
        console.log(`[MONGODB API] Done. Found ${users.size} unique users.`);
        return users;

    } catch (err) {
        const status = err.response?.status;
        const detail =
            err.response?.data?.detail ||
            err.response?.data?.error ||
            err.message;

        console.error(`[MONGODB API] Error (${status || "unknown"}): ${detail}`);

        if (err.response?.data?.errorCode === "IP_ADDRESS_NOT_ON_ACCESS_LIST") {
            console.error("-> ACTION REQUIRED: Add your IP to the Organization API Access List.");
        }

        return new Set();
    }
}
