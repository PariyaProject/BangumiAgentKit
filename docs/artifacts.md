# Artifact Store & Renderer Security

BangumiAgentKit provides image card rendering for Bangumi subjects, cast lists, collection progress, search results, and daily calendars.

## Artifact Lifecycle

1. **Generation**: Render presentation tools (`bangumi.render_subject_card`, etc.) construct ViewModels and invoke `RenderService` (using Playwright / Chromium).
2. **Storage**: Rendered PNG buffers are saved atomically to `LocalArtifactStore` (`BANGUMI_ARTIFACT_DIR`, defaulting to `~/.bangumi-agent-kit/artifacts`).
3. **ArtifactRef**: Tools return light JSON references:
   ```json
   {
     "artifact": {
       "id": "art_40393c0458397b8f8517e41a66d7f9cb",
       "mimeType": "image/png",
       "width": 960,
       "height": 600,
       "expiresAt": "2026-08-10T10:00:00.000Z"
     }
   }
   ```
4. **Security & Path Traversal**: Artifact IDs strictly enforce `^art_[A-Za-z0-9_-]+$`. Absolute paths, parent directory traversal (`../`), and caller-supplied filenames are rejected.
5. **TTL Cleanup**: Expired artifacts are automatically pruned based on `BANGUMI_ARTIFACT_TTL_MINUTES` (default: 1440 minutes / 24 hours).
