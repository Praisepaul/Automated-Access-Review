import 'dotenv/config'; 
import axios from "axios";

export default async function cloudflareUsers() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!accountId) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID is not set");
  }

  const users = new Set();
  let page = 1;

  while (true) {
    const r = await axios.get(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/members`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        params: {
          page,
          per_page: 100
        }
      }
    );

    if (!r.data?.success) {
      throw new Error("Cloudflare API error fetching members");
    }

    const members = r.data.result || [];
    if (!members.length) break;

    for (const m of members) {
      const email = m.user?.email?.toLowerCase();
      if (email) users.add(email);
    }

    if (members.length < 100) break;
    page++;
  }

  return users;
}