import { config } from "../config.js";

const DISCORD_API_BASE_URL = "https://discord.com/api/v10";
const SUCCESS_STATUSES = new Set([200, 201, 204]);

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

async function discordRequest(path, { method = "GET", headers = {}, json, form, body } = {}) {
  while (true) {
    const requestHeaders = { ...headers };
    let requestBody = body;

    if (json !== undefined) {
      requestHeaders["Content-Type"] = "application/json";
      requestBody = JSON.stringify(json);
    } else if (form !== undefined) {
      requestHeaders["Content-Type"] = "application/x-www-form-urlencoded";
      requestBody = new URLSearchParams(form).toString();
    }

    const response = await fetch(`${DISCORD_API_BASE_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: requestBody
    });

    const data = await readResponseBody(response);

    if (response.status !== 429) {
      return {
        ok: SUCCESS_STATUSES.has(response.status),
        status: response.status,
        data
      };
    }

    const retryAfterSeconds =
      typeof data?.retry_after === "number"
        ? data.retry_after
        : Number(response.headers.get("retry-after") || 1);

    await sleep(Math.ceil(retryAfterSeconds * 1000));
  }
}

export function buildAuthorizationUrl(state) {
  const params = new URLSearchParams({
    client_id: config.discord.clientId,
    redirect_uri: `${config.baseUrl}/callback`,
    response_type: "code",
    scope: "identify guilds.join",
    state
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code) {
  const result = await discordRequest("/oauth2/token", {
    method: "POST",
    form: {
      client_id: config.discord.clientId,
      client_secret: config.discord.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${config.baseUrl}/callback`
    }
  });

  if (!result.ok) {
    throw new Error(`Failed to exchange code for token (${result.status}).`);
  }

  return {
    accessToken: result.data.access_token,
    refreshToken: result.data.refresh_token || null
  };
}

export async function refreshAccessToken(refreshToken) {
  const result = await discordRequest("/oauth2/token", {
    method: "POST",
    form: {
      client_id: config.discord.clientId,
      client_secret: config.discord.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    }
  });

  if (!result.ok) {
    return null;
  }

  return {
    accessToken: result.data.access_token,
    refreshToken: result.data.refresh_token || refreshToken
  };
}

export async function fetchCurrentUser(accessToken) {
  const result = await discordRequest("/users/@me", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!result.ok) {
    throw new Error(`Failed to fetch user profile (${result.status}).`);
  }

  return {
    id: result.data.id,
    username: result.data.username
  };
}

export async function addGuildMember({ guildId, userId, accessToken }) {
  return discordRequest(`/guilds/${guildId}/members/${userId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${config.discord.botToken}`
    },
    json: {
      access_token: accessToken
    }
  });
}

export async function addGuildRole({ guildId, userId, roleId }) {
  return discordRequest(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${config.discord.botToken}`
    }
  });
}

export async function addGuildRoleWithRetry({ guildId, userId, roleId, retryDelayMs = 500 }) {
  let result = await addGuildRole({ guildId, userId, roleId });

  if (!result.ok && result.status === 404) {
    await sleep(retryDelayMs);
    result = await addGuildRole({ guildId, userId, roleId });
  }

  return result;
}

export function formatDiscordError(result) {
  if (!result) {
    return "unknown error";
  }

  if (typeof result.data === "string" && result.data.length > 0) {
    return result.data;
  }

  if (result.data?.message) {
    return `${result.data.message} (${result.status})`;
  }

  return `Discord API error (${result.status})`;
}
