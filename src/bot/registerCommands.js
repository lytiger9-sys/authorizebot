import { config } from "../config.js";
import { logger } from "../logger.js";

export async function registerCommands(client, commands) {
  const commandPayload = commands.map((command) => command.data.toJSON());

  if (config.discord.commandGuildId) {
    const guild = await client.guilds.fetch(config.discord.commandGuildId);
    await guild.commands.set(commandPayload);
    logger.info("Registered guild slash commands.", {
      guildId: config.discord.commandGuildId,
      count: commandPayload.length
    });
    return;
  }

  await client.application.commands.set(commandPayload);
  logger.info("Registered global slash commands.", {
    count: commandPayload.length
  });
}
