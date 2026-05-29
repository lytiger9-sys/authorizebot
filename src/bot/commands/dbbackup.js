import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

const data = new SlashCommandBuilder()
  .setName("dbbackup")
  .setDescription("현재 SQLite DB를 백업 채널에 업로드합니다.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

async function execute(interaction, { dbBackupService }) {
  await interaction.deferReply({ ephemeral: true });

  const result = await dbBackupService.backupCurrentDatabase({
    reason: "manual-command"
  });

  if (!result.ok) {
    const message =
      result.reason === "channel-not-configured"
        ? "백업 채널이 설정되지 않았습니다. `DISCORD_DB_BACKUP_CHANNEL_ID`를 확인해 주세요."
        : result.reason === "database-not-ready"
          ? "DB가 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요."
          : "DB 백업 업로드에 실패했습니다. 봇 로그를 확인해 주세요.";

    await interaction.editReply(message);
    return;
  }

  await interaction.editReply(
    `DB 백업이 완료되었습니다.\n파일: ${result.fileName}\n채널: <#${result.channelId}>`
  );
}

export default {
  data,
  execute,
  requiredDependencies: ["dbBackupService"]
};
