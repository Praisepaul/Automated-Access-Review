// contaAzulClient.js

const TOKEN_URL = "https://auth.contaazul.com/oauth2/token";
const API_BASE_URL = "https://api.contaazul.com";

const CLIENT_ID = process.env.CONTA_AZUL_CLIENT_ID;
const CLIENT_SECRET = process.env.CONTA_AZUL_CLIENT_SECRET;

// 🔐 Replace with DB / secrets manager in production
let tokenStore = {
  accessToken: process.env.CONTA_AZUL_ACCESS_TOKEN,
  refreshToken: process.env.CONTA_AZUL_REFRESH_TOKEN,
  expiresAt: Date.now() + 60 * 60 * 1000 // fallback
};

function basicAuthHeader() {
  const credentials = Buffer
    .from(`${CLIENT_ID}:${CLIENT_SECRET}`)
    .toString("base64");

  return {
    Authorization: `Basic ${credentials}`
  };
}

async function refreshAccessToken() {
  console.log("🔄 Refreshing Conta Azul access token...");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokenStore.refreshToken
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      ...basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }

  const data = await response.json();

  tokenStore.accessToken = data.access_token;
  tokenStore.refreshToken = data.refresh_token || tokenStore.refreshToken;
  tokenStore.expiresAt = Date.now() + data.expires_in * 1000;

  console.log("✅ Token refreshed");
}

async function getValidAccessToken() {
  // Refresh if token expires in < 2 minutes
  if (Date.now() >= tokenStore.expiresAt - 120_000) {
    await refreshAccessToken();
  }

  return tokenStore.accessToken;
}

async function contaAzulRequest(method, endpoint, options = {}) {
  let token = await getValidAccessToken();

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    },
    ...options
  });

  // Retry once on 401
  if (response.status === 401) {
    await refreshAccessToken();

    token = tokenStore.accessToken;

    const retry = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      },
      ...options
    });

    if (!retry.ok) {
      throw new Error(`API error after retry: ${retry.status}`);
    }

    return retry.json();
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  return response.json();
}

module.exports = {
  contaAzulRequest
};
