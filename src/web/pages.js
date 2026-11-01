function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderLayout({ title, description, status }) {
  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; font-family: "Noto Sans KR", "Malgun Gothic", sans-serif; color: #252525; background: #fff; }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh; margin: 0; padding: 0 24px;
        display: flex; justify-content: center; align-items: flex-start;
        background: #fff;
      }

      .panel {
        width: min(640px, 100%); margin: 14vh 0 48px; padding: 0;
      }

      .eyebrow { margin: 0 0 16px; color: #777; font-size: 13px; letter-spacing: .02em;
      }

      h1 {
        margin: 0 0 24px; font-size: clamp(26px, 5vw, 34px); font-weight: 600; letter-spacing: -.04em;
      }

      p {
        margin: 0; font-size: 15px; line-height: 1.9; color: #555; white-space: pre-line;
      }

      .rule { height: 1px; margin: 28px 0 20px; border: 0; background: #e8e8e8;
      }
    </style>
  </head>
  <body>
    <main class="panel">
      <p class="eyebrow">NEWISZ · 계정 인증</p>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      <hr class="rule" />
      <p class="eyebrow">${status === "success" ? "인증 절차가 끝났습니다." : "문제가 계속되면 서버 관리자에게 문의해 주세요."}</p>
    </main>
  </body>
</html>`;
}

export function renderSuccessPage({ username, guildName, roleName }) {
  return renderLayout({
    title: "인증이 완료되었습니다.",
    description: `${username} 님의 인증 정보가 저장되었습니다.\n서버: ${guildName}\n지급 역할: ${roleName}\n이제 창을 닫아도 됩니다.`,
    status: "success"
  });
}

export function renderFailurePage({ title, description }) {
  return renderLayout({
    title,
    description,
    status: "failure"
  });
}
