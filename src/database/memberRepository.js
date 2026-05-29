import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

function toIsoString(date = new Date()) {
  return date.toISOString();
}

export async function createMemberRepository({ sqlitePath }) {
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });

  const database = new DatabaseSync(sqlitePath);

  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS verified_members (
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      source_guild_id TEXT NOT NULL,
      source_role_id TEXT,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_restore_at TEXT,
      last_restore_guild_id TEXT,
      PRIMARY KEY (user_id, source_guild_id)
    );

    CREATE INDEX IF NOT EXISTS idx_verified_members_source_guild_updated_at
    ON verified_members (source_guild_id, updated_at DESC);
  `);

  const upsertVerificationStatement = database.prepare(`
    INSERT INTO verified_members (
      user_id,
      username,
      source_guild_id,
      source_role_id,
      access_token,
      refresh_token,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, source_guild_id) DO UPDATE SET
      username = excluded.username,
      source_role_id = excluded.source_role_id,
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      updated_at = excluded.updated_at
  `);

  const findVerificationStatement = database.prepare(`
    SELECT 1
    FROM verified_members
    WHERE user_id = ? AND source_guild_id = ?
    LIMIT 1
  `);

  const listBySourceGuildStatement = database.prepare(`
    SELECT
      user_id AS userId,
      username,
      source_guild_id AS sourceGuildId,
      source_role_id AS sourceRoleId,
      access_token AS accessToken,
      refresh_token AS refreshToken,
      created_at AS createdAt,
      updated_at AS updatedAt,
      last_restore_at AS lastRestoreAt,
      last_restore_guild_id AS lastRestoreGuildId
    FROM verified_members
    WHERE source_guild_id = ?
    ORDER BY updated_at DESC
  `);

  const updateTokensStatement = database.prepare(`
    UPDATE verified_members
    SET access_token = ?, refresh_token = ?, updated_at = ?
    WHERE user_id = ? AND source_guild_id = ?
  `);

  const markRestoreStatement = database.prepare(`
    UPDATE verified_members
    SET last_restore_at = ?, last_restore_guild_id = ?, updated_at = ?
    WHERE user_id = ? AND source_guild_id = ?
  `);

  return {
    database,
    repository: {
      async upsertVerification({
        userId,
        username,
        sourceGuildId,
        sourceRoleId,
        accessToken,
        refreshToken
      }) {
        const now = toIsoString();
        const existing = findVerificationStatement.get(userId, sourceGuildId);

        upsertVerificationStatement.run(
          userId,
          username,
          sourceGuildId,
          sourceRoleId || null,
          accessToken,
          refreshToken || null,
          now,
          now
        );

        return {
          created: !existing
        };
      },

      async listBySourceGuild(sourceGuildId) {
        return listBySourceGuildStatement.all(sourceGuildId);
      },

      async updateTokens({ userId, sourceGuildId, accessToken, refreshToken }) {
        updateTokensStatement.run(
          accessToken,
          refreshToken || null,
          toIsoString(),
          userId,
          sourceGuildId
        );
      },

      async markRestore({ userId, sourceGuildId, targetGuildId }) {
        const now = toIsoString();

        markRestoreStatement.run(now, targetGuildId, now, userId, sourceGuildId);
      }
    }
  };
}
