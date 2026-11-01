const DISCORD_GATEWAY_BOT_URL = "https://discord.com/api/v10/gateway/bot";

export async function checkDiscordGateway({ botToken, timeoutMs = 10_000 }) {
  let response;

  try {
    response = await fetch(DISCORD_GATEWAY_BOT_URL, {
      headers: {
        Authorization: `Bot ${botToken}`
      },
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error(`Discord Gateway API request timed out after ${timeoutMs}ms.`);
    }

    throw new Error(
      `Discord Gateway API request failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  await response.body?.cancel();

  if (!response.ok) {
    throw new Error(`Discord Gateway API returned HTTP ${response.status}.`);
  }

  return response.status;
}
