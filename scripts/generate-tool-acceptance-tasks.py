#!/usr/bin/env python3
"""Generate the per-tool Bangumi acceptance checklist from the catalog and tests."""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'docs/tool-catalog.json'
OUTPUT = ROOT / 'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md'


def test_source() -> str:
    chunks = []
    for path in (ROOT / 'tests').rglob('*'):
        if path.suffix in {'.ts', '.tsx', '.js', '.mjs'} and path.is_file():
            chunks.append(path.read_text(encoding='utf-8', errors='ignore'))
    return '\n'.join(chunks)


def direct_execute_names(source: str) -> set[str]:
    names = set(re.findall(
        r"(?:reads|auth|renderTools|tools|registry|toolMap|writeTools|readTools)\.get\('([^']+)'\)",
        source,
    ))
    names.update(re.findall(
        r"(?:executeTool|execute|registerTool)\(\s*['\"](bangumi\.[a-z_]+)['\"]",
        source,
    ))
    return names


def status(tool: dict, direct: set[str]) -> tuple[str, str, str, str, str, str]:
    name = tool['name']
    schema = '✅'
    source = '✅'
    execute = '✅' if name in direct else '⬜'
    # Only query_subjects has a durable, named live public-API evidence record
    # in the repository. Other public tools remain intentionally unclaimed.
    live_public = '◐' if name == 'bangumi.query_subjects' else '⬜'
    auth = '—' if tool.get('auth') == 'none' else '⬜'
    # Existing QQ tests validate the compact profile as a surface, not each
    # individual tool's real call. Keep this column conservative.
    qq = '⬜'
    return schema, source, execute, live_public, auth, qq


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
    source = test_source()
    direct = direct_execute_names(source)
    names = {item['name'] for item in catalog}
    missing_source = sorted(name for name in names if name not in source)
    if missing_source:
        raise SystemExit('Missing test source references: ' + ', '.join(missing_source))

    direct_count = sum(item['name'] in direct for item in catalog)
    live_count = sum(item['name'] == 'bangumi.query_subjects' for item in catalog)
    auth_count = sum(item.get('auth') != 'none' for item in catalog)
    lines = [
        '# BangumiAgentKit 逐项验收任务清单',
        '',
        '> 生成自 `docs/tool-catalog.json` 与 `tests/`。这张表故意区分“结构覆盖”和“真实执行”：目录/Schema/源码引用全勾选，不代表 96 个工具都已经逐个调用过。',
        '',
        '## 总览',
        '',
        f'- [x] 工具目录与注册表/Schema 精确一致：{len(catalog)}/{len(catalog)}。',
        f'- [x] 每个工具有测试源码引用：{len(catalog)}/{len(catalog)}。',
        f'- [ ] 每个工具都有直接 `execute` 夹具：{direct_count}/{len(catalog)}；仍有 {len(catalog) - direct_count} 项待补。',
        f'- [ ] 每个工具都有真实公开 API 证据：当前明确记录 {live_count}/{len(catalog)}。',
        f'- [ ] 需要账号的工具完成真实 OAuth/账号验收：{auth_count} 项目前不能用本地 mock 代替。',
        '- [ ] QQ/TIM 逐工具端到端验收：当前只有 compact profile 的整体消息链证据，不把它误写成 96 个工具逐一通过。',
        '',
        '状态说明：`✅` 已有当前证据；`◐` 有有限/间接证据；`⬜` 尚未完成；`—` 不适用。',
        '',
        '| 工具 | Auth | Risk | 目录/Schema | 测试源引用 | 直接 execute 夹具 | 真实公开 API | 账号认证 | QQ/TIM | 下一步 |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ]
    for item in catalog:
        schema, source_ref, execute, live, auth, qq = status(item, direct)
        next_step = []
        if execute == '⬜':
            next_step.append('补直接夹具')
        if live == '⬜' and item.get('auth') == 'none':
            next_step.append('补公开 API')
        if auth == '⬜':
            next_step.append('准备账号验收')
        if qq == '⬜':
            next_step.append('评估是否进入 QQ')
        lines.append(
            f"| `{item['name']}` | `{item.get('auth')}` | `{item.get('risk')}` "
            f"| {schema} | {source_ref} | {execute} | {live} | {auth} | {qq} | {'；'.join(next_step)} |"
        )

    lines.extend([
        '',
        '## 认证验收任务',
        '',
        '- [ ] 用真实 Bangumi OAuth 完成 `auth_start` → 回调 → `auth_status`。',
        '- [ ] 用真实账号完成 `auth_list_accounts`、`auth_switch_account`，验证多账号隔离。',
        '- [ ] 在明确确认下完成 `auth_remove_account` / `auth_disconnect`，记录回滚与审计结果。',
        '- [ ] 用真实账号验证所有 `auth: required` 的读工具、写工具和私有 render 工具。',
        '- [ ] 对写入/破坏性工具只使用测试账号和明确二次确认，不把 mock 成功当作线上成功。',
        '',
        '## QQ/TIM 语音输入任务',
        '',
        '- [ ] 确认机器人账号已在 NapCat 登录并处于 `QQ_READY`。',
        '- [ ] 在机器人**私聊**中按住 TIM 麦克风发送一条 5–10 秒普通中文语音；不要发送 WAV 文件卡片，也不要发送音乐。',
        '- [ ] 语音内容建议固定为：`这是 Pariya 语音输入验收，请回复我听到的最后四个字：语音验收通过。`',
        '- [ ] 检查 OneBot 入站段是 `record`，不是 `file`；检查 `pariya.read_media` 收到 `audio/wav`。',
        '- [ ] 检查模型回答是否正确理解语音内容，并记录一次成功即可证明传输/识别路径；不同编码、长语音和长期稳定性另列观察。',
        '',
        '这份清单完成前，不再把“完整工具覆盖”简称为“所有工具都真实测试过”。',
    ])
    OUTPUT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(json.dumps({'catalog': len(catalog), 'direct_execute': direct_count,
                      'live_public': live_count, 'auth_required_or_optional': auth_count,
                      'output': str(OUTPUT)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
