function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderLayout({ title, description, accentColor }) {
  return `<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #091018;
        --panel: rgba(17, 28, 41, 0.92);
        --border: rgba(255, 255, 255, 0.12);
        --text: #f5f7fb;
        --muted: #9fb0c5;
        --accent: ${accentColor};
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(circle at top, rgba(79, 156, 249, 0.22), transparent 42%),
          linear-gradient(160deg, #04070b, #0a1522 60%, #08111c);
        font-family: "Segoe UI", "Noto Sans KR", sans-serif;
        color: var(--text);
      }

      .panel {
        width: min(560px, 100%);
        padding: 32px;
        border-radius: 20px;
        background: var(--panel);
        border: 1px solid var(--border);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.05);
        color: var(--muted);
        font-size: 14px;
        letter-spacing: 0.04em;
      }

      h1 {
        margin: 20px 0 12px;
        font-size: clamp(28px, 6vw, 40px);
      }

      p {
        margin: 0;
        font-size: 16px;
        line-height: 1.7;
        color: var(--muted);
        white-space: pre-line;
      }
    </style>
  </head>
  <body>
    <main class="panel">
      <div class="badge">Discord OAuth</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
    </main>
  </body>
</html>`;
}

export function renderSuccessPage({ username, guildName, roleName }) {
  return renderLayout({
    title: "인증이 완료되었습니다.",
    description: `${username} 님의 인증 정보가 저장되었습니다.\n서버: ${guildName}\n지급 역할: ${roleName}\n이제 창을 닫아도 됩니다.`,
    accentColor: "#36d399"
  });
}

export function renderFailurePage({ title, description }) {
  return renderLayout({
    title,
    description,
    accentColor: "#ff6b6b"
  });
}
