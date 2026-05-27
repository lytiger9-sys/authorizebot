import { config } from "./config.js";
import { createMemberRepository } from "./database/memberRepository.js";
import { logger } from "./logger.js";
import { createBotClient } from "./bot/createBotClient.js";
import { createVerificationLogService } from "./services/verificationLogService.js";
import { createWebServer } from "./web/createWebServer.js";

const { database, repository: memberRepository } = await createMemberRepository({
  sqlitePath: config.sqlitePath
});

const botClient = createBotClient({ memberRepository });
await botClient.login(config.discord.botToken);

const verificationLogService = createVerificationLogService({
  botClient,
  channelId: config.discord.verificationLogChannelId
});

const app = createWebServer({ memberRepository, botClient, verificationLogService });
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
