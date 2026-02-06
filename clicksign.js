import axios from "axios";
import dotenv from 'dotenv';
dotenv.config({ override: true });

/**
 * Busca membros da conta Clicksign (Gestão de Acesso)
 */
export default async function clicksignUsers() {
    const users = new Set();
    const API_KEY = process.env.CLICKSIGN_API_KEY;
    const BASE_URL = process.env.CLICKSIGN_BASE_URL || "https://app.clicksign.com";

    if (!API_KEY) {
        console.warn("[CLICKSIGN API] Missing CLICKSIGN_API_KEY");
        return users;
    }

    try {

        // ENDPOINT CORRETO: /api/v3/members (Lista a organização)
        const response = await axios.get(`${BASE_URL}/api/v3/members`, {
            headers: {
                'Authorization': API_KEY,
                'Content-Type': 'application/vnd.api+json',
                'Accept': 'application/json'
            }
        });

        const members = response.data.data || [];

        for (const member of members) {
            // No padrão JSON:API da Clicksign, o e-mail está em attributes.email
            let email = member.attributes?.email?.toLowerCase().trim();

            users.add(email);
        }

        console.log(`[CLICKSIGN API] Done. Found ${users.size} members.`);
        return users;

    } catch (err) {
        // Tratamento de erro específico para JSON:API
        const detail = err.response?.data?.errors?.[0]?.detail || err.message;
        console.error(`[CLICKSIGN API] Error: ${detail}`);
        return new Set();
    }
}

clicksignUsers();