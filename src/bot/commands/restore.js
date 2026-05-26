import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import { config } from "../../config.js";
import { restoreMembers } from "../../services/restoreService.js";

const data = new SlashCommandBuilder()
  .setName("복구")
  .setDescription("저장된 인증 사용자들을 현재 서버로 다시 초대합니다.")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName("source_server_id")
      .setDescription("인증 데이터를 가져올 원본 서버 ID")
      .setRequired(true)
  )
  .addRoleOption((option) =>
    option
      .setName("role")
      .setDescription("복구 직후 추가로 지급할 역할")
      .setRequired(false)
  );

function buildProgressMessage(summary, role) {
  return [
    `복구 진행 중: ${summary.processed}/${summary.total}`,
    `성공: ${summary.restored}`,
    `실패: ${summary.failed}`,
    `토큰 재발급: ${summary.refreshed}`,
    role ? `복구 후 역할 지급: ${role}` : "복구 후 역할 지급: 없음"
  ].join("\n");
}

function buildResultMessage(summary, role) {
  const lines = [
    "복구가 완료되었습니다.",
    `대상 인원: ${summary.total}`,
    `성공: ${summary.restored}`,
    `실패: ${summary.failed}`,
    `토큰 재발급: ${summary.refreshed}`,
    role ? `복구 후 역할 지급: ${role}` : "복구 후 역할 지급: 없음"
  ];

  if (summary.failures.length > 0) {
    const preview = summary.failures
      .slice(0, 5)
      .map((failure) => `- ${failure.username} (${failure.userId}): ${failure.error}`)
      .join("\n");

    lines.push("");
    lines.push("실패 예시");
    lines.push(preview);
  }

  return lines.join("\n");
}

async function execute(interaction, { memberRepository }) {
  const sourceGuildId = interaction.options.getString("source_server_id", true).trim();
  const role = interaction.options.getRole("role");
  const me = interaction.guild.members.me || (await interaction.guild.members.fetchMe());

  if (!/^\d{17,20}$/.test(sourceGuildId)) {
    await interaction.reply({
      content: "원본 서버 ID 형식이 올바르지 않습니다.",
      ephemeral: true
    });
    return;
  }

  if (role && (role.managed || role.position >= me.roles.highest.position)) {
    await interaction.reply({
      content: "복구 후 지급할 역할이 봇보다 높거나 연동 역할입니다.",
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const records = await memberRepository.listBySourceGuild(sourceGuildId);

  if (records.length === 0) {
    await interaction.editReply("해당 원본 서버 ID로 저장된 인증 사용자가 없습니다.");
    return;
  }

  await interaction.editReply(
    buildProgressMessage(
      {
        processed: 0,
        total: records.length,
        restored: 0,
        failed: 0,
        refreshed: 0
      },
      role ? role.toString() : null
    )
  );

  const summary = await restoreMembers({
    records,
    targetGuildId: interaction.guildId,
    targetRoleId: role?.id || null,
    memberRepository,
    delayMs: config.restoreDelayMs,
    onProgress: async (current) => {
      if (current.processed % 5 === 0 || current.processed === current.total) {
        await interaction.editReply(buildProgressMessage(current, role ? role.toString() : null));
      }
    }
  });

  await interaction.editReply(buildResultMessage(summary, role ? role.toString() : null));
}

export default {
  data,
  execute
};
