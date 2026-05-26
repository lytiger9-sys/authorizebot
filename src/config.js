import "dotenv/config";
import path from "node:path";

function requireEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function parseNumber(name, fallback) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }

  return parsed;
}

export const config = {
  discord: {
    botToken: requireEnv("DISCORD_BOT_TOKEN"),
    clientId: requireEnv("DISCORD_CLIENT_ID"),
    clientSecret: requireEnv("DISCORD_CLIENT_SECRET"),
    commandGuildId: process.env.DISCORD_COMMAND_GUILD_ID?.trim() || null
  },
  sqlitePath: path.resolve(
    process.cwd(),
    process.env.SQLITE_PATH?.trim() || "./data/newisz-auth-bot.sqlite"
  ),
  baseUrl: requireEnv("BASE_URL").replace(/\/+$/, ""),
  stateSecret: requireEnv("STATE_SECRET"),
  port: parseNumber("PORT", 10000),
  restoreDelayMs: parseNumber("RESTORE_DELAY_MS", 700),
  oauthStateMaxAgeMs: 10 * 60 * 1000
};
