import fs from "fs";
import common from "oci-common";
import identity from "oci-identity";
import "dotenv/config";

export default async function ociUsers({ groups }) {
  if (!groups || !groups.length) {
    console.log("[OCI] No groups provided, skipping.");
    return {};
  }

  const privateKey = fs.readFileSync(
    process.env.OCI_PRIVATE_KEY_PATH,
    "utf8"
  );

  const provider = new common.SimpleAuthenticationDetailsProvider(
    process.env.OCI_TENANCY_OCID,
    process.env.OCI_USER_OCID,
    process.env.OCI_FINGERPRINT,
    privateKey,
    null,
    null
  );

  const client = new identity.IdentityClient({
    authenticationDetailsProvider: provider
  });

  client.endpoint = `https://identity.${process.env.OCI_REGION}.oraclecloud.com`;

  const allGroups = await client.listGroups({
    compartmentId: process.env.OCI_TENANCY_OCID
  });

  const results = {};

  for (const g of groups) {
    const groupName = g.name;

    const ociGroup = allGroups.items.find(
      og => og.name === groupName
    );

    if (!ociGroup) {
      console.warn(`[OCI] Group not found in OCI: ${groupName}`);
      continue;
    }

    const users = new Set();
    let page;

    do {
      const r = await client.listUserGroupMemberships({
        compartmentId: process.env.OCI_TENANCY_OCID,
        groupId: ociGroup.id,
        limit: 1000,
        page
      });

      const userDetails = await Promise.all(
        (r.items || []).map(m =>
          client.getUser({ userId: m.userId }).catch(() => null)
        )
      );

      for (const u of userDetails) {
        if (!u || u.user.lifecycleState !== "ACTIVE") continue;

        const email =
          u.user.email?.toLowerCase() ||
          (u.user.name?.includes("@") ? u.user.name.toLowerCase() : null);

        if (email) users.add(email);
      }

      page = r.opcNextPage;
    } while (page);

    results[groupName] = {
      groupId: ociGroup.id,
      users
    };
  }

  return results;
}
