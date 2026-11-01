import { config } from "./config.js";
import { createMemberRepository } from "./database/memberRepository.js";
import { logger } from "./logger.js";
import { Events } from "discord.js";
import { createBotClient } from "./bot/createBotClient.js";
import { createVerificationLogService } from "./services/verificationLogService.js";
import { createDatabaseBackupService } from "./services/databaseBackupService.js";
import { createSelfPingService } from "./services/selfPingService.js";
import { createWebServer } from "./web/createWebServer.js";
import { checkDiscordGateway } from "./services/discordGatewayCheck.js";

const runtime = {
  memberRepository: null,
  verificationLogService: null,
  dbBackupService: null,
  database: null
};

const botClient = createBotClient(runtime);
const app = createWebServer({ runtime, botClient });
const server = app.listen(config.port, "0.0.0.0", () => {
  logger.info("Web server started.", { port: config.port });
  runtime.selfPingService = createSelfPingService({
    baseUrl: config.baseUrl
  });
});

let shuttingDown = false;

async function startServices() {
  logger.info("Checking Discord Gateway API connectivity.");
  const gatewayStatus = await checkDiscordGateway({
    botToken: config.discord.botToken
  });
  logger.info("Discord Gateway API check succeeded.", { status: gatewayStatus });

  logger.info("Discord bot login starting.");
  await botClient.login(config.discord.botToken);
  logger.info("Discord bot login request completed.", {
    ready: botClient.isReady()
  });

  if (!botClient.isReady()) {
    await new Promise((resolve) => {
      botClient.once(Events.ClientReady, resolve);
    });
  }

  runtime.dbBackupService = createDatabaseBackupService({
    botClient,
    channelId: config.discord.dbBackupChannelId,
    sqlitePath: config.sqlitePath,
    backupSecret: config.stateSecret,
    getDatabase: () => runtime.database
  });

  if (!config.discord.dbBackupChannelId) {
    logger.warn("Database backup channel is not configured.");
  }

  const restoreResult = await runtime.dbBackupService.restoreLatestBackup();

  if (restoreResult.ok) {
    logger.info("Database restore completed from backup channel.", {
      channelId: restoreResult.channelId,
      fileName: restoreResult.fileName
    });
  } else if (
    restoreResult.reason === "backup-not-found" ||
    restoreResult.reason === "channel-not-configured" ||
    restoreResult.reason === "channel-unavailable"
  ) {
    logger.info("Database restore was skipped.", {
      reason: restoreResult.reason
    });
  } else {
    logger.warn("Database restore failed.", {
      reason: restoreResult.reason
    });
  }

  const repositoryResult = await createMemberRepository({
    sqlitePath: config.sqlitePath
  });

  runtime.database = repositoryResult.database;
  runtime.memberRepository = repositoryResult.repository;
  runtime.verificationLogService = createVerificationLogService({
    botClient,
    channelId: config.discord.verificationLogChannelId
  });

  logger.info("Application services initialized.");
}

startServices().catch((error) => {
  logger.error("Application startup failed.", {
    error: error instanceof Error ? error.stack || error.message : String(error)
  });
  process.exitCode = 1;
});

function closeServer(serverInstance) {
  return new Promise((resolve, reject) => {
    serverInstance.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info("Shutdown requested.", { signal });
  runtime.selfPingService?.stop();

  await closeServer(server).catch((error) => {
    logger.warn("Web server close failed.", {
      error: error instanceof Error ? error.message : String(error)
    });
  });

  await runtime.dbBackupService?.flush().catch((error) => {
    logger.warn("Database backup flush failed.", {
      error: error instanceof Error ? error.message : String(error)
    });
  });

  runtime.selfPingService?.destroy();
  botClient.destroy();
  runtime.database?.close();
  process.exit(0);
}

process.on("SIGINT", () => {
  shutdown("SIGINT").catch((error) => {
    logger.error("Shutdown failed.", {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM").catch((error) => {
    logger.error("Shutdown failed.", {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception.", {
    error: error instanceof Error ? error.stack || error.message : String(error)
  });
});

process.on("unhandledRejection", (error) => {
  logger.error("Unhandled rejection.", {
    error: error instanceof Error ? error.stack || error.message : String(error)
  });
});
