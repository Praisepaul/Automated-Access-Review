import axios from "axios";
import dotenv from 'dotenv';
dotenv.config({ override: true });

/**
 * Busca membros da equipe no VExpenses
 */
export default async function vexpensesUsers() {
    const users = new Set();
    const API_TOKEN = process.env.VEXPENSES_API_KEY;

    if (!API_TOKEN) {
        console.warn("[VEXPENSES API] Missing VEXPENSES_API_KEY in environment");
        return users;
    }

    try {
        const response = await axios.get('https://api.vexpenses.com/v2/team-members', {
            headers: {
                'Accept': 'application/json',
                'Authorization': API_TOKEN
            }
        });

        // O VExpenses retorna os dados em um array chamado 'data'
        const members = response.data.data || [];

        for (const member of members) {
            let email = member.email?.toLowerCase().trim();
            
            if (!email || !email.endsWith("@neospace.ai") || email.includes("test")) continue;

            users.add(email);
        }

        console.log(`[VEXPENSES API] Done. Found ${users.size} active users.`);
        return users;

    } catch (err) {
        console.error(
            "[VEXPENSES API] Error:", 
            err.response?.data?.message || err.message
        );
        return new Set();
    }
}
