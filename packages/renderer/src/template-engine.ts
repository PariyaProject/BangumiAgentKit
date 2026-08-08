import { RenderViewModel } from './view-models/index.js';

export function renderHtmlTemplate(viewModel: RenderViewModel): string {
  const baseCss = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      padding: 24px;
      width: 960px;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }
    .header { display: flex; gap: 24px; margin-bottom: 20px; }
    .cover { width: 160px; height: 220px; object-fit: cover; border-radius: 12px; }
    .title { font-size: 24px; font-weight: 700; color: #38bdf8; margin-bottom: 8px; }
    .subtitle { font-size: 16px; color: #94a3b8; margin-bottom: 12px; }
    .meta { font-size: 14px; color: #cbd5e1; display: flex; gap: 16px; margin-bottom: 12px; }
    .score { font-size: 28px; font-weight: 800; color: #fbbf24; }
    .tags { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    .tag { background: #334155; color: #e2e8f0; font-size: 12px; padding: 4px 10px; border-radius: 20px; }
    .summary { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-top: 16px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .grid-item { background: #0f172a; border-radius: 10px; padding: 12px; display: flex; gap: 12px; }
    .grid-item img { width: 60px; height: 80px; border-radius: 6px; object-fit: cover; }
    .footer { text-align: right; font-size: 12px; color: #64748b; margin-top: 16px; }
  `;

  let bodyContent = '';

  if (viewModel.template === 'subject-card') {
    const s = viewModel.subject;
    bodyContent = `
      <div class="card">
        <div class="header">
          ${s.imageUrl ? `<img class="cover" src="${s.imageUrl}" />` : '<div class="cover" style="background:#334155;"></div>'}
          <div>
            <div class="title">${s.nameCn || s.name}</div>
            <div class="subtitle">${s.name}</div>
            <div class="meta">
              <span>类型: ${s.type}</span>
              ${s.date ? `<span>首播: ${s.date}</span>` : ''}
              ${s.rank ? `<span>排名: #${s.rank}</span>` : ''}
            </div>
            ${s.score ? `<div class="score">★ ${s.score.toFixed(1)}</div>` : ''}
            <div class="tags">
              ${(s.tags || []).map((t) => `<span class="tag">${t}</span>`).join('')}
            </div>
          </div>
        </div>
        ${s.summary ? `<div class="summary">${s.summary}</div>` : ''}
        <div class="footer">${viewModel.sourceLabel}</div>
      </div>
    `;
  } else if (viewModel.template === 'search-list') {
    bodyContent = `
      <div class="card">
        <div class="title">搜索结果: "${viewModel.query}"</div>
        <div class="subtitle">共 ${viewModel.total} 项候选结果 (第 ${viewModel.page} 页)</div>
        <div class="grid" style="margin-top:20px;">
          ${viewModel.items
            .map(
              (item) => `
            <div class="grid-item">
              ${item.imageUrl ? `<img src="${item.imageUrl}" />` : ''}
              <div>
                <div style="font-weight:600; color:#38bdf8;">${item.nameCn || item.name}</div>
                <div style="font-size:12px; color:#94a3b8;">${item.name}</div>
                ${item.score ? `<div style="color:#fbbf24; margin-top:4px;">★ ${item.score}</div>` : ''}
              </div>
            </div>
          `,
            )
            .join('')}
        </div>
        <div class="footer">Bangumi Agent Kit</div>
      </div>
    `;
  } else if (viewModel.template === 'calendar') {
    bodyContent = `
      <div class="card">
        <div class="title">Bangumi 每日放送动画表</div>
        <div style="display:flex; flex-direction:column; gap:16px; margin-top:16px;">
          ${viewModel.days
            .map(
              (day) => `
            <div style="background:#0f172a; padding:12px; border-radius:10px;">
              <div style="font-weight:700; color:#38bdf8; margin-bottom:8px;">${day.weekdayCn}</div>
              <div style="display:flex; gap:12px; flex-wrap:wrap;">
                ${day.items.map((it) => `<span class="tag">${it.nameCn} ${it.score ? '★' + it.score : ''}</span>`).join('')}
              </div>
            </div>
          `,
            )
            .join('')}
        </div>
        <div class="footer">Bangumi Agent Kit</div>
      </div>
    `;
  } else {
    bodyContent = `<div class="card"><div class="title">${viewModel.template}</div></div>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>${baseCss}</style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
}
