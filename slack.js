import axios from "axios";

function isServiceAccountEmail(email) {
  return (
    email.startsWith("sys_") ||
    email.includes("integration") ||
    email.includes("falcon")
  );
}

export default async function slackUsers() {
  const users = new Set();
  let cursor;

  try {
    do {
      const r = await axios.get(
        "https://slack.com/api/users.list",
        {
          headers: {
            Authorization: `Bearer ${process.env.SLACK_TOKEN}`
          },
          params: {
            limit: 200,
            team_id: process.env.SLACK_ENTERPRISE_ID,
            ...(cursor ? { cursor } : {})
          }
        }
      );

      if (!r.data.ok) {
        console.warn("[SLACK] API error:", r.data.error);
        break;
      }

      for (const m of r.data.members || []) {
        if (m.deleted || m.is_bot) continue;

        const isPrivileged =
          m.enterprise_user?.is_owner ||
          m.enterprise_user?.is_admin ||
          m.is_primary_owner;

        if (!isPrivileged) continue;

        const email = m.profile?.email?.toLowerCase().trim();
        if (!email) continue;

        // Explicit policy: exclude non-human service accounts
        if (isServiceAccountEmail(email)) continue;

        users.add(email);
      }

      cursor = r.data.response_metadata?.next_cursor || null;

    } while (cursor);
  } catch {
    console.warn("[SLACK] Fetch failed, returning partial results");
  }

  return users;
}
