import { EmbedBuilder } from "discord.js";

import { logger } from "../logger.js";

function truncate(value, maxLength = 1024) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function formatUserField(user) {
  const lines = [];

  if (user.globalName) {
    lines.push(`표시 이름: ${user.globalName}`);
  }

  lines.push(`계정명: @${user.username}`);
  lines.push(`멘션: <@${user.id}>`);

  return lines.join("\n");
}

function createSuccessEmbed({ guildName, roleName, user, clientIp, browser }) {
  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("디스코드 인증 로그")
    .addFields(
      { name: "상태", value: "성공" },
      { name: "유저", value: truncate(formatUserField(user)) },
      { name: "유저 ID", value: user.id },
      { name: "서버", value: truncate(guildName || "알 수 없음") },
      { name: "지급 역할", value: truncate(roleName || "알 수 없음") },
      { name: "IP", value: truncate(clientIp || "알 수 없음") },
      { name: "브라우저", value: truncate(browser || "알 수 없음") },
      { name: "사유", value: "디스코드 인증을 완료했습니다." }
    )
    .setTimestamp(new Date());
}

export function createVerificationLogService({ botClient, channelId }) {
  let cachedChannel = null;

  async function resolveChannel() {
    if (!channelId) {
      return null;
    }

    if (cachedChannel && cachedChannel.isTextBased() && typeof cachedChannel.send === "function") {
      return cachedChannel;
    }

    const channel = await botClient.channels.fetch(channelId);

    if (!channel || !channel.isTextBased() || typeof channel.send !== "function") {
      logger.warn("Verification log channel is not sendable.", { channelId });
      return null;
    }

    cachedChannel = channel;
    return channel;
  }

  return {
    async logSuccess(payload) {
      if (!channelId) {
        return false;
      }

      try {
        const channel = await resolveChannel();

        if (!channel) {
          return false;
        }

        await channel.send({
          embeds: [createSuccessEmbed(payload)],
          allowedMentions: {
            parse: []
          }
        });

        return true;
      } catch (error) {
        logger.warn("Failed to send verification success log.", {
          channelId,
          error: error instanceof Error ? error.message : String(error)
        });
        return false;
      }
    }
  };
}
