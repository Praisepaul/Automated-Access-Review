import axios from "axios";

const BASE = process.env.CS_BASE_URL;

async function getToken() {
  const r = await axios.post(
    `${BASE}/oauth2/token`,
    new URLSearchParams({
      client_id: process.env.CS_CLIENT_ID,
      client_secret: process.env.CS_CLIENT_SECRET
    })
  );
  return r.data.access_token;
}

export default async function crowdstrikeUsers(debug = false) {
  try{
  const token = await getToken();

  const idsRes = await axios.get(
    `${BASE}/user-management/queries/users/v1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      },
      params: { limit: 500 }
    }
  );

  if (!idsRes.data.resources?.length) {
    return new Set();
  }

  const detailsRes = await axios.post(
    `${BASE}/user-management/entities/users/GET/v1`,
    { ids: idsRes.data.resources },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    }
  );

  const users = new Set();

  for (const u of detailsRes.data.resources || []) {
    const email = u.email || u.login || u.uid;

    if (!email || !email.includes("@")) continue;
    if (email.startsWith("sys_")) continue;
    if (u.first_name === "Falcon") continue;
    if (u.status !== "active") continue;

    users.add(email.toLowerCase());
  }

  if (debug) {
    console.log("[CROWDSTRIKE] Users returned:", [...users]);
  }

  return users;
}catch(err){
  console.warn("[CROWDSTRIKE] API failure, returning empty set");
    return new Set();;
}
}
