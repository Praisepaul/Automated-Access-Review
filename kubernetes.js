import common from "oci-common";
import identity from "oci-identity";

// List of Policy OCIDs you provided
const policyOcids = [
    "ocid1.policy.oc1..aaaaaaaa3rubqppb47oiybead7umm2fzgbhy3o63rrhio347y4ygxmdbjyta",
    "ocid1.policy.oc1..aaaaaaaaxhmviqjti6xf32gug74bvczb7ju2zofhs423q2mpyptzi2lpwtga",
    "ocid1.policy.oc1..aaaaaaaam344u4p67xrltp4lkhqbynzx724oqpcxqcslkb4nvm27ka7ludlq",
    "ocid1.policy.oc1..aaaaaaaa7cof6223ozxszz2rfmv2zxmhry5sqgojobkb2wqszjbnndnw4nma",
    "ocid1.policy.oc1..aaaaaaaackirrawf7b3nxg4xtpqgwrfa4ox3xuylzb3kgkpjb4pmwpnhlula",
    "ocid1.policy.oc1..aaaaaaaavydjjejzxnk2gogti3vfgyoe7xysfs3tch4jmbmqty2pdnvyymyq",
    "ocid1.policy.oc1..aaaaaaaanakfi2p7wd2psjjiosssk7pfdinbn6bdzyeflisn2px3zvx2wbia",
    "ocid1.policy.oc1..aaaaaaaag4rsrkfcumln7fyugfhhkrlnagjgtrftcjjpbkf6w4qcq3eea2nq"
];

const provider = new common.ConfigFileAuthenticationDetailsProvider();
const identityClient = new identity.IdentityClient({ authenticationDetailsProvider: provider });

export default async function getOciKubernetesUsers() {
    const uniqueUsers = new Map(); // Use Map to deduplicate by email
    const uniqueGroups = new Set();

    console.log("[OCI API] Analyzing policies for Kubernetes access...");

    try {
        for (const policyId of policyOcids) {
            const policyRes = await identityClient.getPolicy({ policyId });
            
            // Extract group names from statements like "Allow group AdminGroup to..."
            policyRes.policy.statements.forEach(statement => {
                const match = statement.match(/group\s+([^\s]+)/i);
                if (match && match[1]) uniqueGroups.add(match[1]);
            });
        }

        console.log(`[OCI API] Found ${uniqueGroups.size} groups in policies. Fetching members...`);

        // Resolve group names to members
        for (const groupName of uniqueGroups) {
            console.log(`[OCI API] Processing group: ${groupName}`);
            // 1. Get Group OCID from Name
            const listGroupsRes = await identityClient.listGroups({ 
                compartmentId: provider.getTenantId(),
                name: groupName 
            });

            if (listGroupsRes.items.length > 0) {
                const groupId = listGroupsRes.items[0].id;

                // 2. List Users in Group
                const membersRes = await identityClient.listUserGroupMemberships({ 
                    compartmentId: provider.getTenantId(),
                    groupId: groupId 
                });

                for (const membership of membersRes.items) {
                    const userRes = await identityClient.getUser({ userId: membership.userId });
                    const u = userRes.user;

                    // Filter for active human users at neospace.ai
                    if (u.lifecycleState === "ACTIVE" && u.email && u.email.endsWith("@neospace.ai")) {
                        uniqueUsers.set(u.email.toLowerCase(), u.name);
                    }
                }
            }
        }

        // Return as a Set of emails just like your other fetchers
        const finalSet = new Set(uniqueUsers.keys());
        console.log(`[OCI API] Done. Found ${finalSet.size} unique Kubernetes admins.`);
        console.log([...finalSet]);
        return finalSet;

    } catch (err) {
        console.error("[OCI API] Error:", err.message);
        return new Set();
    }
}