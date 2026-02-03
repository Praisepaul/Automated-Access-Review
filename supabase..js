import axios from "axios";

/**
 * Filter out service accounts or technical users based on email patterns.
 */
function isServiceAccountEmail(email) {
  const servicePatterns = ["sys_", "integration", "automation", "supabase-admin"];
  return servicePatterns.some(pattern => email.includes(pattern));
}

export default async function supabaseUsers(debug = false) {
  const users = new Set();
  const ORG_ID = process.env.SUPABASE_ORG_ID;
  const TOKEN = process.env.SUPABASE_API_TOKEN;

  if (!ORG_ID || !TOKEN) {
    console.warn("[SUPABASE] Missing ORG_ID or API_TOKEN in environment");
    return users;
  }

  try {
    const response = await axios.get(
      `https://api.supabase.com/v1/organizations/${ORG_ID}/members`,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: "application/json"
        }
      }
    );

    // Supabase returns an array of member objects
    const members = response.data || [];

    for (const m of members) {
      // The Supabase API usually returns 'email' and 'user_id'
      const email = m.email?.toLowerCase().trim();

      if (!email || !email.includes("@")) continue;
      
      // Apply exclusions
      if (isServiceAccountEmail(email)) continue;

      // Note: If you want to filter by invited status, 
      // you can check m.is_invited (boolean)
      
      users.add(email);
    }

    if (debug) {
      console.log("[SUPABASE] Users found:", [...users]);
    }

    return users;
  } catch (err) {
    console.error(
      "[SUPABASE] API Failure:", 
      err.response?.data || err.message
    );
    return new Set();
  }
}