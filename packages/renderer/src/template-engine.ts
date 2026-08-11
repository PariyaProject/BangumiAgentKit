import ReactDOMServer from 'react-dom/server';
import { RenderViewModel } from './view-models/index.js';
import { getThemeTokens, RenderThemeName } from './themes/index.js';
import { getTemplate } from './templates/TemplateRegistry.js';

export function renderHtmlTemplate(
  viewModel: RenderViewModel,
  themeName: RenderThemeName = 'bangumi-dark',
  resolvedImages?: Record<string, string>,
  width?: number,
): string {
  const theme = getThemeTokens(themeName);
  const template = getTemplate(viewModel.template);

  const reactElement = template.render(viewModel, theme, resolvedImages, width);
  const staticMarkup = ReactDOMServer.renderToStaticMarkup(reactElement);

  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none';" />`;

  const resetCss = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      background-color: ${theme.background};
      color: ${theme.text};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Meiryo", sans-serif;
      -webkit-font-smoothing: antialiased;
    }
  `;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${cspMeta}
  <style>${resetCss}</style>
</head>
<body>
  ${staticMarkup}
</body>
</html>`;
}
