# Run #95 `render_subject_card` offline preflight

Date: 2026-10-21
Scope: `bangumi.render_subject_card`, Agent/MCP matrix evidence preparation only.

## Reproducible fixture

- Registered profile: `render-subject-card-offline-agent-mcp-v1`.
- Exact arguments: `subjectId=990901`, `includeCollection=false`.
- The renderer used the real `ToolRegistry`, `RenderService`, and `ArtifactStore` boundary with a synthetic Subject fixture. Its only permitted request was `GET /v0/subjects/990901`; the fixture rejected any duplicate, authenticated, collection, or other request.
- The synthetic Subject intentionally has no cover URL. The asset resolver guard recorded zero calls, so no external image host was contacted.
- Render target: 360 CSS px at device scale factor 2; `bangumi-light` theme and `warm-editorial` pack.

## Render receipt and visual review

The retained PNG is [subject-card-warm-editorial-360x2.png](assets/run95-render-subject-card-offline-agent-mcp-v1/subject-card-warm-editorial-360x2.png), 720 × 1,576 px, 257,734 bytes, SHA-256 `75a2de6d4b7c606d2cb84f1efbcbf98864046315bd0d9f635313e1c4b48d5d89`. Its dimensions and PNG signature were checked. The receipt manifest is [manifest.json](assets/run95-render-subject-card-offline-agent-mcp-v1/manifest.json).

The final image was opened at full resolution. The mixed Japanese/Chinese title wraps into two lines without clipping; the title, subtitle, metadata, rating panel, and footer remain separated. The intentionally absent cover uses the renderer's “暂无封面” treatment. This preflight does not establish live Bangumi data, account personalization, client delivery, or visual acceptance of every renderer template.

This capture was made from a dirty pre-commit working tree at base `e867b2f6a22d50148493a028d93bff14ee602707`. The manifest explicitly marks it as not bound to an exact reviewed Candidate. The profile remains uninvoked and no one-shot claim has been acquired.

## Command

```sh
pnpm build
node scripts/acceptance/render-subject-card-offline-preflight.mjs
```

Result: `PASS`; one local fixture request, zero asset resolutions, valid 720 × 1,576 PNG.
