import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder
} from "discord.js";

import { buildAuthorizationUrl } from "../../services/discordApi.js";
import { createSignedState } from "../../services/oauthState.js";

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

  const state = createSignedState({
    guildId: interaction.guildId,
    roleId: role.id
  });

  const authUrl = buildAuthorizationUrl(state);
  const embed = new EmbedBuilder()
    .setColor(0x4f9cf9)
    .setTitle("서버 인증")
    .setDescription(
      [
        "아래 버튼을 눌러 Discord 인증을 완료하세요.",
        `인증이 끝나면 ${role} 역할이 자동으로 지급됩니다.`
      ].join("\n")
    )
    .setFooter({
      text: "인증 정보는 서버 복구용으로 안전하게 저장됩니다."
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Discord 인증하기")
      .setStyle(ButtonStyle.Link)
      .setURL(authUrl)
  );

  await interaction.reply({
    embeds: [embed],
    components: [row]
  });
}

export default {
  data,
  execute
};
