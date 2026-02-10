import axios from "axios";
import dotenv from 'dotenv';
dotenv.config({ override: true });

/**
 * Busca usuários no Lucidchart via API v1
 * API: https://users.lucid.app/users
 */
export default async function lucidUsers() {
    const users = new Set();
    const API_TOKEN = process.env.LUCID_API_TOKEN;

    if (!API_TOKEN) {
        console.warn("[LUCID API] Missing LUCID_API_TOKEN");
        return users;
    }

    try {
        // O Lucid espera o token como Bearer
        const authHeader = `Bearer ${API_TOKEN}`;

        const response = await axios.get('https://api.lucid.co/users?pageSize=30', {
            headers: {
                'Authorization': authHeader,
                'Accept': 'application/json',
                'Lucid-Request-As':'admin',
                'Lucid-Api-Version':'1'
            }
        });

        // O Lucid retorna um array de objetos de usuário
        const members = response.data || [];

        for (const member of members) {
            let email = member.email?.toLowerCase().trim();
            
            // Filtros básicos de segurança e automação
            if (!email || email.startsWith("sys"))continue;


            users.add(email);
        }

        console.log(`[LUCID API] Done. Found ${users.size} active users.`);
        return users;

    } catch (err) {
        const status = err.response?.status;
        const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
        
        console.error(`[LUCID API] Error (${status}): ${detail}`);
        
        if (status === 401) {
            console.error("-> Tip: Check if your LUCID_API_TOKEN is valid and has 'Account Admin' scope.");
        }
        
        return new Set();
    }
}

lucidUsers(); 