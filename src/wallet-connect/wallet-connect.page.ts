export interface IWalletConnectPageInput {
  title: string;
  heading: string;
  text: string;
  primaryLink?: string;
  primaryLabel?: string;
  autoRedirect: boolean;
}

const PAGE_STYLES = `
      :root {
        color-scheme: light;
        --bg: #0b1220;
        --panel: #111b31;
        --text: #f5f7fb;
        --muted: #b4c0d3;
        --accent: #7c5cff;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: radial-gradient(circle at top, #1c2b52 0%, var(--bg) 55%);
        color: var(--text);
        font: 16px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      main {
        width: min(92vw, 420px);
        padding: 28px;
        border-radius: 20px;
        background: rgba(17, 27, 49, 0.94);
        box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
      }
      h1 {
        margin: 0 0 12px;
        font-size: 28px;
        line-height: 1.15;
      }
      p {
        margin: 0 0 20px;
        color: var(--muted);
        white-space: pre-wrap;
        word-break: break-word;
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-height: 52px;
        border-radius: 14px;
        background: var(--accent);
        color: #fff;
        text-decoration: none;
        font-weight: 600;
      }
      .hint {
        margin-top: 14px;
        font-size: 13px;
      }
`;

export function renderWalletConnectPage(input: IWalletConnectPageInput): string {
  const safeTitle = escapeHtml(input.title);
  const safeHeading = escapeHtml(input.heading);
  const safeText = escapeHtml(input.text);
  const primaryAction =
    input.primaryLink && input.primaryLabel
      ? `<a class="button" href="${escapeAttribute(input.primaryLink)}">${escapeHtml(input.primaryLabel)}</a>`
      : '';
  const redirectScript =
    input.autoRedirect && input.primaryLink
      ? `<script>window.setTimeout(function(){ window.location.href = ${JSON.stringify(input.primaryLink)}; }, 150);</script>`
      : '';

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>${PAGE_STYLES}</style>
  </head>
  <body>
    <main>
      <h1>${safeHeading}</h1>
      <p>${safeText}</p>
      ${primaryAction}
      <p class="hint">После завершения можно вернуться в Telegram.</p>
    </main>
    ${redirectScript}
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("'", '&#39;');
}
