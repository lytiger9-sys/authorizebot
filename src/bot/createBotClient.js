import { Client, Events, GatewayIntentBits } from "discord.js";

import { logger } from "../logger.js";
import { registerCommands } from "./registerCommands.js";
import authPanelCommand from "./commands/authPanel.js";
import restoreCommand from "./commands/restore.js";
import dbBackupCommand from "./commands/dbbackup.js";

const commands = [authPanelCommand, restoreCommand, dbBackupCommand];

export function createBotClient(dependencies) {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  const commandMap = new Map(commands.map((command) => [command.data.name, command]));

  client.once(Events.ClientReady, async (readyClient) => {
    try {
      logger.info("Discord bot logged in.", {
        user: readyClient.user.tag
      });

      await registerCommands(readyClient, commands);
    } catch (error) {
      logger.error("Failed to register slash commands.", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = commandMap.get(interaction.commandName);

    if (!command) {
      return;
    }

    const requiredDependencies = command.requiredDependencies || [];
    const missingDependencies = requiredDependencies.filter((name) => !dependencies[name]);

    if (missingDependencies.length > 0) {
      const message = "기능이 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.";

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(message).catch(() => null);
        return;
      }

      await interaction.reply({
        content: message,
        ephemeral: true
      }).catch(() => null);
      return;
    }

    try {
      await command.execute(interaction, dependencies);
    } catch (error) {
      logger.error("Unhandled command error.", {
        command: interaction.commandName,
        error: error instanceof Error ? error.message : String(error)
      });

      const message = "명령 처리 중 오류가 발생했습니다. 로그를 확인해 주세요.";

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(message).catch(() => null);
        return;
      }

      await interaction.reply({
        content: message,
        ephemeral: true
      }).catch(() => null);
    }
  });

  return client;
}
