import axios from "axios";

const BASE_V1 = "https://console.jumpcloud.com/api";
const BASE_V2 = "https://console.jumpcloud.com/api/v2";
const USER_CACHE = new Map();

const HEADERS = {
  "x-api-key": process.env.JUMPCLOUD_API_KEY,
  "x-org-id": process.env.JUMPCLOUD_ORG_ID,
  "Content-Type": "application/json",
  "Accept": "application/json"
};

/**
 * Helper to check if a JumpCloud user is active.
 */
function isUserActive(user) {
    // activated must be true AND suspended must be false
    return user.activated === true && user.suspended === false;
}

export async function listGroups() {
  const allGroups = [];
  const limit = 100;
  let skip = 0;

  while (true) {
    const r = await axios.get(`${BASE_V2}/usergroups`, {
      headers: HEADERS,
      params: { limit, skip }
    });

    if (!Array.isArray(r.data) || r.data.length === 0) break;
    allGroups.push(...r.data);
    skip += r.data.length;
    if (r.data.length < limit) break;
  }
  return allGroups;
}

export async function groupMembers(groupId, debug = false) {
  const userIds = [];
  let skip = 0;
  const limit = 100;

  while (true) {
    const r = await axios.get(`${BASE_V2}/usergroups/${groupId}/members`, {
      headers: HEADERS,
      params: { limit, skip }
    });

    if (!r.data?.length) break;

    r.data.forEach(m => {
      const t = m.to?.type;
      const id = m.to?.id;
      if ((t === "user" || t === "systemuser") && id) {
        userIds.push(id);
      }
    });

    skip += r.data.length;
    if (r.data.length < limit) break;
  }

  if (debug) console.log(`[JUMPCLOUD] Found ${userIds.length} IDs for group ${groupId}`);
  if (!userIds.length) return [];

  const members = [];

  for (const id of userIds) {
    try {
      let u;
      if (USER_CACHE.has(id)) {
        u = USER_CACHE.get(id);
      } else {
        const r = await axios.get(`${BASE_V1}/systemusers/${id}`, { headers: HEADERS });
        u = r.data;
        USER_CACHE.set(id, u);
      }

      // --- STATUS FILTER ADDED HERE ---
      if (!isUserActive(u)) {
          if (debug) console.log(`[JUMPCLOUD] Skipping suspended/inactive user: ${u.email}`);
          continue; 
      }

      const email = (u.email || u.username || "").toLowerCase().trim();
      const name = `${u.firstname || ''} ${u.lastname || ''}`.trim() || email;

      if (!email || u.system) continue;

      members.push({ email, name });
    } catch {
      console.warn(`[JUMPCLOUD] Failed to resolve user ${id}`);
    }
  }

  return members;
}

export async function getJumpCloudUserName(input) {
    let email;
    let fallbackName;

    if (typeof input === "string") {
        email = input;
    } else if (input && typeof input === "object") {
        email = input.email || input.username;
        fallbackName = input.name;
    }

    if (typeof email !== "string") {
        return { name: "", email: "" };
    }

    const searchEmail = email.toLowerCase().trim();

    for (const user of USER_CACHE.values()) {
        const cachedEmail = (user.email || user.username || "").toLowerCase().trim();
        if (cachedEmail === searchEmail) {
            // Check status even in cache
            if (!isUserActive(user)) continue;

            const name =
                `${user.firstname || ""} ${user.lastname || ""}`.trim() ||
                fallbackName ||
                searchEmail;

            return { name, email: searchEmail };
        }
    }

    try {
        const response = await axios.get(`${BASE_V1}/systemusers`, {
            headers: HEADERS,
            params: { filter: `email:eq:${searchEmail}` }
        });

        const user = response.data.results?.[0];

        // --- STATUS FILTER ADDED HERE ---
        if (user && isUserActive(user)) {
            USER_CACHE.set(user.id || searchEmail, user);
            const name =
                `${user.firstname || ""} ${user.lastname || ""}`.trim() ||
                fallbackName ||
                searchEmail;

            return { name, email: searchEmail };
        }
    } catch (err) {
        console.error(`[JUMPCLOUD] Global search failed for ${searchEmail}: ${err.message}`);
    }

    return {
        name: fallbackName || searchEmail,
        email: searchEmail
    };
}