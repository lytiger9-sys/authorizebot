import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AttachmentBuilder } from "discord.js";
import { gunzipSync, gzipSync } from "node:zlib";

import { logger } from "../logger.js";

const BACKUP_FILE_PREFIX = "newisz-auth-bot-backup";
const BACKUP_MAGIC = Buffer.from("NDBK1");

function toSqliteStringLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function normalizeChannelName(channelId) {
  return channelId ? `channel:${channelId}` : "disabled";
}

function makeStamp(date = new Date()) {
  const pad = (value, length = 2) => String(value).padStart(length, "0");

  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate())
  ].join("") + `-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}-${pad(date.getUTCMilliseconds(), 3)}Z`;
}

function getBackupFileName(date = new Date()) {
  return `${BACKUP_FILE_PREFIX}-${makeStamp(date)}.sqlite.enc`;
}

function isBackupAttachment(attachment) {
  return (
    typeof attachment.name === "string" &&
    attachment.name.startsWith(BACKUP_FILE_PREFIX) &&
    attachment.name.endsWith(".sqlite.enc")
  );
}

function deriveKey(secret, salt) {
  return crypto.scryptSync(secret, salt, 32);
}

function encryptBackupBytes(plaintextBytes, secret) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(secret, salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const compressed = gzipSync(plaintextBytes);
  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([BACKUP_MAGIC, salt, iv, tag, ciphertext]);
}

function decryptBackupBytes(ciphertextBytes, secret) {
  if (ciphertextBytes.length < BACKUP_MAGIC.length + 16 + 12 + 16) {
    throw new Error("Backup file is too small.");
  }

  const magic = ciphertextBytes.subarray(0, BACKUP_MAGIC.length);

  if (!magic.equals(BACKUP_MAGIC)) {
    throw new Error("Backup file header is invalid.");
  }

  const saltStart = BACKUP_MAGIC.length;
  const ivStart = saltStart + 16;
  const tagStart = ivStart + 12;
  const payloadStart = tagStart + 16;

  const salt = ciphertextBytes.subarray(saltStart, ivStart);
  const iv = ciphertextBytes.subarray(ivStart, tagStart);
  const tag = ciphertextBytes.subarray(tagStart, payloadStart);
  const encryptedPayload = ciphertextBytes.subarray(payloadStart);
  const key = deriveKey(secret, salt);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);

  decipher.setAuthTag(tag);

  const compressed = Buffer.concat([decipher.update(encryptedPayload), decipher.final()]);
  return gunzipSync(compressed);
}

async function downloadAttachment(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download backup attachment (${response.status}).`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function removeExistingSqliteFiles(sqlitePath) {
  const files = [sqlitePath, `${sqlitePath}-wal`, `${sqlitePath}-shm`, `${sqlitePath}-journal`];

  for (const filePath of files) {
    fs.rmSync(filePath, { force: true });
  }
}

function atomicWriteFile(targetPath, bytes) {
  const directory = path.dirname(targetPath);
  fs.mkdirSync(directory, { recursive: true });

  const tempPath = path.join(directory, `${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tempPath, bytes);
  removeExistingSqliteFiles(targetPath);
  fs.renameSync(tempPath, targetPath);
}

async function fetchLatestBackupAttachment(channel) {
  let before = null;

  while (true) {
    const messages = await channel.messages.fetch({
      limit: 100,
      before: before || undefined
    });

    if (messages.size === 0) {
      return null;
    }

    for (const message of messages.values()) {
      const attachment = message.attachments.find((item) => isBackupAttachment(item));

      if (attachment) {
        return {
          attachment,
          message
        };
      }
    }

    before = messages.last().id;
  }
}

export function createDatabaseBackupService({
  botClient,
  channelId,
  sqlitePath,
  backupSecret,
  getDatabase
}) {
  let cachedChannel = null;
  let backupQueue = Promise.resolve();

  async function resolveBackupChannel() {
    if (!channelId) {
      return null;
    }

    if (cachedChannel && typeof cachedChannel.send === "function" && cachedChannel.isTextBased()) {
      return cachedChannel;
    }

    const channel = await botClient.channels.fetch(channelId);

    if (!channel || !channel.isTextBased() || typeof channel.send !== "function") {
      logger.warn("Database backup channel is not sendable.", {
        channelId: normalizeChannelName(channelId)
      });
      return null;
    }

    cachedChannel = channel;
    return channel;
  }

  async function runSerialized(task) {
    const next = backupQueue.then(task, task);
    backupQueue = next.catch(() => null);
    return next;
  }

  async function buildEncryptedBackup() {
    const database = getDatabase?.();

    if (!database) {
      return {
        ok: false,
        reason: "database-not-ready"
      };
    }

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "newisz-db-backup-"));
    const snapshotPath = path.join(tempRoot, "snapshot.sqlite");

    try {
      database.exec(`VACUUM INTO ${toSqliteStringLiteral(snapshotPath.replaceAll("\\", "/"))}`);

      const snapshotBytes = fs.readFileSync(snapshotPath);
      const encryptedBytes = encryptBackupBytes(snapshotBytes, backupSecret);

      return {
        ok: true,
        encryptedBytes
      };
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }

  return {
    async backupCurrentDatabase({ reason = "auto" } = {}) {
      return runSerialized(async () => {
        if (!channelId) {
          return {
            ok: false,
            reason: "channel-not-configured"
          };
        }

        try {
          const channel = await resolveBackupChannel();

          if (!channel) {
            return {
              ok: false,
              reason: "channel-unavailable"
            };
          }

          const backupResult = await buildEncryptedBackup();

          if (!backupResult.ok) {
            return backupResult;
          }

          const fileName = getBackupFileName();
          const attachment = new AttachmentBuilder(backupResult.encryptedBytes, {
            name: fileName
          });

          const message = await channel.send({
            content: `DB backup (${reason}) - ${new Date().toISOString()}`,
            files: [attachment]
          });

          return {
            ok: true,
            fileName,
            messageId: message.id,
            channelId
          };
        } catch (error) {
          logger.warn("Database backup failed.", {
            channelId,
            error: error instanceof Error ? error.message : String(error)
          });

          return {
            ok: false,
            reason: "backup-failed"
          };
        }
      });
    },

    async restoreLatestBackup() {
      if (!channelId) {
        return {
          ok: false,
          reason: "channel-not-configured"
        };
      }

      try {
        const channel = await resolveBackupChannel();

        if (!channel || typeof channel.messages?.fetch !== "function") {
          return {
            ok: false,
            reason: "channel-unavailable"
          };
        }

        const latest = await fetchLatestBackupAttachment(channel);

        if (!latest) {
          return {
            ok: false,
            reason: "backup-not-found"
          };
        }

        const encryptedBytes = await downloadAttachment(latest.attachment.url);
        const decryptedBytes = decryptBackupBytes(encryptedBytes, backupSecret);
        atomicWriteFile(sqlitePath, decryptedBytes);

        logger.info("Database restored from encrypted backup.", {
          channelId,
          messageId: latest.message.id,
          fileName: latest.attachment.name
        });

        return {
          ok: true,
          fileName: latest.attachment.name,
          messageId: latest.message.id,
          channelId
        };
      } catch (error) {
        logger.warn("Database restore from backup failed.", {
          channelId: normalizeChannelName(channelId),
          error: error instanceof Error ? error.message : String(error)
        });

        return {
          ok: false,
          reason: "restore-failed"
        };
      }
    },

    async flush() {
      await backupQueue.catch(() => null);
    }
  };
}
