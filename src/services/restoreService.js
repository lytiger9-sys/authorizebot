import {
  addGuildMember,
  addGuildRoleWithRetry,
  formatDiscordError,
  refreshAccessToken,
  sleep
} from "./discordApi.js";

function isSuccessfulStatus(status) {
  return status === 201 || status === 204;
}

async function restoreSingleMember({
  record,
  targetGuildId,
  targetRoleId,
  memberRepository
}) {
  let refreshed = false;
  let accessToken = record.accessToken;
  let refreshToken = record.refreshToken;

  let joinResult = await addGuildMember({
    guildId: targetGuildId,
    userId: record.userId,
    accessToken
  });

  if (!isSuccessfulStatus(joinResult.status) && refreshToken) {
    const nextTokens = await refreshAccessToken(refreshToken);

    if (nextTokens) {
      refreshed = true;
      accessToken = nextTokens.accessToken;
      refreshToken = nextTokens.refreshToken;

      await memberRepository.updateTokens({
        userId: record.userId,
        sourceGuildId: record.sourceGuildId,
        accessToken,
        refreshToken
      });

      joinResult = await addGuildMember({
        guildId: targetGuildId,
        userId: record.userId,
        accessToken
      });
    }
  }

  if (!isSuccessfulStatus(joinResult.status)) {
    return {
      restored: false,
      refreshed,
      error: formatDiscordError(joinResult)
    };
  }

  if (targetRoleId) {
    const roleResult = await addGuildRoleWithRetry({
      guildId: targetGuildId,
      userId: record.userId,
      roleId: targetRoleId
    });

    if (!roleResult.ok) {
      return {
        restored: false,
        refreshed,
        error: formatDiscordError(roleResult)
      };
    }
  }

  await memberRepository.markRestore({
    userId: record.userId,
    sourceGuildId: record.sourceGuildId,
    targetGuildId
  });

  return {
    restored: true,
    refreshed,
    error: null
  };
}

export async function restoreMembers({
  records,
  targetGuildId,
  targetRoleId,
  memberRepository,
  delayMs,
  onProgress
}) {
  const summary = {
    total: records.length,
    processed: 0,
    restored: 0,
    failed: 0,
    refreshed: 0,
    failures: []
  };

  for (const record of records) {
    const result = await restoreSingleMember({
      record,
      targetGuildId,
      targetRoleId,
      memberRepository
    });

    summary.processed += 1;

    if (result.restored) {
      summary.restored += 1;
    } else {
      summary.failed += 1;
      summary.failures.push({
        userId: record.userId,
        username: record.username,
        error: result.error
      });
    }

    if (result.refreshed) {
      summary.refreshed += 1;
    }

    if (onProgress) {
      await onProgress({ ...summary });
    }

    if (summary.processed < summary.total && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return summary;
}
