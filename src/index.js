import { config } from "./config.js";
import { createMemberRepository } from "./database/memberRepository.js";
import { logger } from "./logger.js";
import { Events } from "discord.js";
import { createBotClient } from "./bot/createBotClient.js";
import { createVerificationLogService } from "./services/verificationLogService.js";
import { createDatabaseBackupService } from "./services/databaseBackupService.js";
import { createWebServer } from "./web/createWebServer.js";

const runtime = {};
const botClient = createBotClient(runtime);
await botClient.login(config.discord.botToken);

if (!botClient.isReady()) {
  await new Promise((resolve) => {
    botClient.once(Events.ClientReady, resolve);
  });
}

const dbBackupService = createDatabaseBackupService({
  botClient,
  channelId: config.discord.dbBackupChannelId,
  sqlitePath: config.sqlitePath,
  backupSecret: config.stateSecret,
  getDatabase: () => runtime.database
});

if (!config.discord.dbBackupChannelId) {
  logger.warn("Database backup channel is not configured.");
}

const restoreResult = await dbBackupService.restoreLatestBackup();

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

const { database, repository: memberRepository } = await createMemberRepository({
  sqlitePath: config.sqlitePath
});

runtime.database = database;
runtime.memberRepository = memberRepository;
runtime.dbBackupService = dbBackupService;

const verificationLogService = createVerificationLogService({
  botClient,
  channelId: config.discord.verificationLogChannelId
});

const app = createWebServer({
  memberRepository,
  botClient,
  verificationLogService,
  dbBackupService
});
const server = app.listen(config.port, () => {
  logger.info("Web server started.", { port: config.port });
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
  logger.info("Shutdown requested.", { signal });
  await closeServer(server);
  await dbBackupService.flush();
  botClient.destroy();
  database.close();
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
