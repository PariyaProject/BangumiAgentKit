import ReactDOMServer from 'react-dom/server';
import { RenderViewModel } from './view-models/index.js';
import {
  DEFAULT_RENDER_DESIGN_PACK,
  DEFAULT_RENDER_THEME,
  getThemeTokens,
  RenderDesignPackName,
  RenderThemeName,
} from './themes/index.js';
import { getTemplate } from './templates/TemplateRegistry.js';
import {
  DEFAULT_RESOLVED_RENDER_TYPOGRAPHY,
  normalizeFontFamilyStack,
  renderFontFamilyStack,
  type ResolvedRenderTypography,
  scaleInlineFontSizeDeclarations,
} from './typography.js';

export function renderHtmlTemplate(
  viewModel: RenderViewModel,
  themeName: RenderThemeName = DEFAULT_RENDER_THEME,
  resolvedImages?: Record<string, string>,
  width?: number,
  designPack: RenderDesignPackName = DEFAULT_RENDER_DESIGN_PACK,
  typography: ResolvedRenderTypography = DEFAULT_RESOLVED_RENDER_TYPOGRAPHY,
): string {
  const baseTheme = getThemeTokens(themeName, designPack);
  const theme = {
    ...baseTheme,
    design: {
      ...baseTheme.design,
      bodyFontFamily: renderFontFamilyStack('body', baseTheme.design.bodyFontFamily, typography),
      displayFontFamily: renderFontFamilyStack(
        'display',
        baseTheme.design.displayFontFamily,
        typography,
      ),
    },
  };
  const template = getTemplate(viewModel.template);

  const reactElement = template.render(viewModel, theme, resolvedImages, width);
  const staticMarkup = scaleInlineFontSizeDeclarations(
    ReactDOMServer.renderToStaticMarkup(reactElement),
    typography.fontSizeScale,
  );

  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none';" />`;

  const fontFacesCss = typography.fontFaces
    .map((face) => {
      const family = normalizeFontFamilyStack(face.family);
      if (
        !/^data:font\/(?:otf|ttf|woff|woff2);base64,[A-Za-z0-9+/=]+$/.test(face.dataUrl) ||
        !['opentype', 'truetype', 'woff', 'woff2'].includes(face.format)
      ) {
        throw new Error('Resolved renderer font face is invalid.');
      }
      return `@font-face{font-family:${family};src:url("${face.dataUrl}") format("${face.format}");font-style:normal;font-weight:400;font-display:block;}`;
    })
    .join('\n');

  const resetCss = `
    ${fontFacesCss}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      background-color: ${theme.background};
      color: ${theme.text};
      font-family: ${theme.design.bodyFontFamily};
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
