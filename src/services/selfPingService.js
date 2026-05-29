import cron from "node-cron";

import { logger } from "../logger.js";

const SELF_PING_CRON = "*/4 * * * *";

async function pingBaseUrl(baseUrl) {
  const targetUrl = new URL("/healthz", baseUrl).toString();
  const response = await fetch(targetUrl, {
    signal: AbortSignal.timeout(10_000)
  });

  if (!response.ok) {
    throw new Error(`Self ping failed with status ${response.status}.`);
  }

  return targetUrl;
}

export function createSelfPingService({ baseUrl }) {
  const task = cron.schedule(
    SELF_PING_CRON,
    async () => {
      try {
        await pingBaseUrl(baseUrl);
      } catch (error) {
        logger.warn("Self ping failed.", {
          url: new URL("/healthz", baseUrl).toString(),
          error: error instanceof Error ? error.message : String(error)
        });
      }
    },
    {
      name: "self-ping",
      noOverlap: true
    }
  );

  logger.info("Self ping scheduled.", {
    baseUrl,
    everyMinutes: 4
  });

  return {
    stop() {
      task.stop();
    },

    destroy() {
      task.destroy();
    }
  };
}
