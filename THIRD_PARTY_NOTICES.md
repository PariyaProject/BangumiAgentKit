# Third-party notices and provenance

This file records the C3 distribution audit. It is intentionally conservative:
project-owned files are Apache-2.0, while upstream or dependency material
keeps its own terms.

## Direct runtime dependencies

The package metadata and lockfile are the version source of truth. The direct
runtime packages used by this workspace report these licenses in their package
metadata:

| Component                       | License    | Use                        |
| ------------------------------- | ---------- | -------------------------- |
| `better-sqlite3`                | MIT        | SQLite runtime             |
| `drizzle-orm`                   | Apache-2.0 | Storage mapping            |
| `pg`                            | MIT        | PostgreSQL runtime         |
| `fastify`                       | MIT        | OAuth/API listener         |
| `@modelcontextprotocol/sdk`     | MIT        | MCP transport              |
| `playwright`, `playwright-core` | Apache-2.0 | Optional Chromium renderer |
| `react`, `react-dom`            | MIT        | Renderer templates         |
| `sharp`                         | Apache-2.0 | PNG processing             |
| `zod`                           | MIT        | Input schemas              |
| `zod-to-json-schema`            | ISC        | MCP schema compatibility   |

The transitive dependency set includes MIT, Apache-2.0, BSD, ISC and other
licenses. The native Sharp distribution may include `libvips`, reported as
LGPL-3.0-or-later on this platform. Redistributors must preserve the notices
provided by those packages. Run `pnpm licenses list --prod` after dependency
updates and refresh this audit when the set changes materially.

## Bangumi API / OpenAPI provenance

`openapi/upstream/v0.yaml` is an upstream Bangumi API schema kept in the
repository for generated-client reproducibility. The checked-in schema does
not contain an explicit copyright or license declaration. It is therefore
listed as upstream material, not as Apache-2.0 project code. The project does
not remove or replace any upstream notice. `openapi/operation-overrides.yaml`
contains local risk annotations, and generated registries are derived build
artifacts; neither changes the upstream license status of the schema.

The semantic services and transport code in `packages/` are project-owned
implementations around that API contract. They do not copy upstream server
implementation code.

## Previous Bangumi / QQ projects

The repository audit found no copied source file or bundled asset from a
previous Bangumi QQ project. The NoneBot2/Claude example is project-owned
adapter code and declares its Python dependencies in its own setup metadata;
those dependencies are installed by operators and are not redistributed as
part of the Node packages. If future code is copied or adapted, record its
source and license here before merging it.

## Bundled assets

The renderer bundles TypeScript/React presentation templates and no third-party
font, image, or icon pack. User/Bangumi cover images are fetched at runtime by
the renderer asset policy and are not bundled in this repository.
