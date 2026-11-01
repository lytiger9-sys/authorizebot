import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SeparatorBuilder,
  SlashCommandBuilder,
  TextDisplayBuilder
} from "discord.js";

import { config } from "../../config.js";

const data = new SlashCommandBuilder()
  .setName("인증패널")
  .setDescription("인증 버튼과 역할 지급 안내가 포함된 패널을 전송합니다.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addRoleOption((option) =>
    option
      .setName("role")
      .setDescription("인증이 끝난 뒤 지급할 역할")
      .setRequired(true)
  );

async function execute(interaction) {
  const role = interaction.options.getRole("role", true);
  const me = interaction.guild.members.me || (await interaction.guild.members.fetchMe());

  if (role.managed) {
    await interaction.reply({
      content: "연동 역할은 지급용 역할로 사용할 수 없습니다.",
      ephemeral: true
    });
    return;
  }

  if (role.position >= me.roles.highest.position) {
    await interaction.reply({
      content: "봇보다 높은 역할이거나 같은 위치의 역할은 지급할 수 없습니다.",
      ephemeral: true
    });
    return;
  }

  const authUrl = new URL("/authorize", config.baseUrl);
  authUrl.searchParams.set("guildId", interaction.guildId);
  authUrl.searchParams.set("roleId", role.id);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Discord 인증하기")
      .setStyle(ButtonStyle.Link)
      .setURL(authUrl.toString())
  );

  const panel = new ContainerBuilder()
    .setAccentColor(0x5865f2)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("# 서버 인증\n아래 버튼을 눌러 Discord 인증을 진행해 주세요.")
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `인증을 완료하면 ${role} 역할이 지급됩니다.\n\n인증 정보는 서버 복구를 위해 안전하게 저장됩니다.`
      )
    )
    .addActionRowComponents(row);

  await interaction.reply({
    components: [panel],
    flags: MessageFlags.IsComponentsV2
  });
}

export default {
  data,
  execute
};
