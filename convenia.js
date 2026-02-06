import axios from "axios";
import dotenv from 'dotenv';
dotenv.config({ override: true });

export default async function conveniaUsers() {
    const users = new Set();
    const TOKEN = process.env.CONVENIA_TOKEN;
    const BASE_URL = "https://public-api.convenia.com.br/api/v3/employees";

    if (!TOKEN) {
        console.warn("[CONVENIA API] Missing CONVENIA_TOKEN in environment");
        return users;
    }

    try {
        let currentPage = 1;
        let lastPage = 1;

        console.log("[CONVENIA API] Fetching active employees...");

        do {
            const response = await axios.get(BASE_URL, {
                headers: {
                    'token': TOKEN,
                    'Accept': 'application/json'
                },
                params: {
                    paginate: 100, // Quantidade por página
                    page: currentPage
                }
            });

            const employees = response.data.data || [];
            
            for (const emp of employees) {
                // Filtramos apenas quem tem status 'Ativo'
                if (emp.status !== "Ativo") continue;

                let email = emp.email?.toLowerCase().trim();
            if (!email || email.startsWith("sys")) continue;

                users.add(email);
            }

            // Atualiza informações de paginação
            currentPage = response.data.current_page + 1;
            lastPage = response.data.last_page;

        } while (currentPage <= lastPage);

        console.log(`[CONVENIA API] Done. Found ${users.size} active employees.`);
        console.log(users);
        return users;

    } catch (err) {
        console.error(
            "[CONVENIA API] Error:", 
            err.response?.data?.message || err.message
        );
        return new Set();
    }
}

conveniaUsers();