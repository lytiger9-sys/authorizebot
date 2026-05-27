import express from "express";

import { logger } from "../logger.js";
import {
  addGuildMember,
  addGuildRoleWithRetry,
  exchangeCodeForTokens,
  fetchCurrentUser,
  formatDiscordError
} from "../services/discordApi.js";
import { parseSignedState } from "../services/oauthState.js";
import { renderFailurePage, renderSuccessPage } from "./pages.js";
import { getVerificationRequestMetadata } from "./requestMetadata.js";

function getRoleName(guild, roleId) {
  return guild?.roles.cache.get(roleId)?.name || "인증 역할";
}

export function createWebServer({ memberRepository, botClient, verificationLogService }) {
  const app = express();

  app.get("/", (_request, response) => {
    response.type("text/plain").send("newisz auth bot is running");
  });

  app.get("/healthz", (_request, response) => {
    response.json({ ok: true });
  });

  app.get("/callback", async (request, response) => {
    const code = typeof request.query.code === "string" ? request.query.code : null;
    const state = typeof request.query.state === "string" ? request.query.state : null;

    if (!code || !state) {
      response
        .status(400)
        .send(
          renderFailurePage({
            title: "잘못된 요청입니다.",
            description: "OAuth callback에 필요한 code 또는 state 값이 없습니다."
          })
        );
      return;
    }

    try {
      const oauthState = parseSignedState(state);
      const requestMetadata = getVerificationRequestMetadata(request);
      const tokens = await exchangeCodeForTokens(code);
      const user = await fetchCurrentUser(tokens.accessToken);
      const guild =
        botClient.guilds.cache.get(oauthState.guildId) ||
        (await botClient.guilds.fetch(oauthState.guildId));

      await memberRepository.upsertVerification({
        userId: user.id,
        username: user.username,
        sourceGuildId: oauthState.guildId,
        sourceRoleId: oauthState.roleId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      });

      const joinResult = await addGuildMember({
        guildId: oauthState.guildId,
        userId: user.id,
        accessToken: tokens.accessToken
      });

      if (![201, 204].includes(joinResult.status)) {
        logger.warn("Guild join failed after OAuth callback.", {
          userId: user.id,
          guildId: oauthState.guildId,
          error: formatDiscordError(joinResult)
        });

        response
          .status(502)
          .send(
            renderFailurePage({
              title: "서버 참여에 실패했습니다.",
              description:
                "인증 정보는 저장되었지만 서버에 자동 참여시키지 못했습니다. 봇 권한과 OAuth 설정을 확인해 주세요."
            })
          );
        return;
      }

      const roleResult = await addGuildRoleWithRetry({
        guildId: oauthState.guildId,
        userId: user.id,
        roleId: oauthState.roleId
      });

      if (!roleResult.ok) {
        logger.warn("Role assignment failed after OAuth callback.", {
          userId: user.id,
          guildId: oauthState.guildId,
          roleId: oauthState.roleId,
          error: formatDiscordError(roleResult)
        });

        response
          .status(502)
          .send(
            renderFailurePage({
              title: "역할 지급에 실패했습니다.",
              description:
                "인증 정보는 저장되었지만 역할 지급에 실패했습니다. 봇 역할 위치와 Manage Roles 권한을 확인해 주세요."
            })
          );
        return;
      }

      const roleName = getRoleName(guild, oauthState.roleId);

      response.send(
        renderSuccessPage({
          username: user.username,
          guildName: guild.name,
          roleName
        })
      );

      void verificationLogService?.logSuccess({
        guildName: guild.name,
        roleName,
        user,
        ...requestMetadata
      });
    } catch (error) {
      logger.error("OAuth callback failed.", {
        error: error instanceof Error ? error.message : String(error)
      });

      response
        .status(500)
        .send(
          renderFailurePage({
            title: "인증 처리 중 오류가 발생했습니다.",
            description: "로그를 확인한 뒤 설정 값을 다시 검토해 주세요."
          })
        );
    }
  });

  return app;
}
