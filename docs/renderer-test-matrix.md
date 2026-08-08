# Renderer Test Matrix (R01 - R30)

| ID  | Feature / Requirement                         | Implementation Status | Test File                                  | Test Status |
| --- | --------------------------------------------- | --------------------- | ------------------------------------------ | ----------- |
| R01 | Subject Card PNG Render                       | Implemented           | `tests/render/render-cards.test.ts`        | Tested      |
| R02 | Search List Card PNG Render                   | Implemented           | `tests/render/render-cards.test.ts`        | Tested      |
| R03 | Cast Card PNG Render                          | Implemented           | `tests/render/render-cards.test.ts`        | Tested      |
| R04 | Collection Progress Card PNG Render           | Implemented           | `tests/render/render-cards.test.ts`        | Tested      |
| R05 | Calendar Card PNG Render                      | Implemented           | `tests/render/render-cards.test.ts`        | Tested      |
| R06 | Simplified & Traditional CJK Chinese Text     | Implemented           | `tests/render/render-cards.test.ts`        | Tested      |
| R07 | Japanese Text Rendering                       | Implemented           | `tests/render/render-cards.test.ts`        | Tested      |
| R08 | CJK rendering smoke test                      | Implemented           | `tests/render/render-cards.test.ts`        | Tested      |
| R09 | True Browser Zero-Network Isolation           | Implemented           | `tests/render/render-zero-network.test.ts` | Tested      |
| R10 | Localhost URL Blocked                         | Implemented           | `tests/render/render-ssrf-asset.test.ts`   | Tested      |
| R11 | Loopback 127.0.0.1 IP Blocked                 | Implemented           | `tests/render/render-ssrf-asset.test.ts`   | Tested      |
| R12 | Private IPv4 Ranges Blocked                   | Implemented           | `tests/render/render-ssrf-asset.test.ts`   | Tested      |
| R13 | IPv6 Loopback Blocked                         | Implemented           | `tests/render/render-ssrf-asset.test.ts`   | Tested      |
| R14 | IPv6 ULA & Link-Local Blocked                 | Implemented           | `tests/render/render-ssrf-asset.test.ts`   | Tested      |
| R15 | Cloud Metadata Endpoints Blocked              | Implemented           | `tests/render/render-ssrf-asset.test.ts`   | Tested      |
| R16 | Public -> Private Redirect Blocked            | Implemented           | `tests/render/render-ssrf-asset.test.ts`   | Tested      |
| R17 | Non-Image Content Rejected                    | Implemented           | `tests/render/render-ssrf-asset.test.ts`   | Tested      |
| R18 | Content-Type Spoofing Rejected                | Implemented           | `tests/render/render-ssrf-asset.test.ts`   | Tested      |
| R19 | Oversized Asset Rejected                      | Implemented           | `tests/render/render-ssrf-asset.test.ts`   | Tested      |
| R20 | SVG Image Format Rejected                     | Implemented           | `tests/render/render-ssrf-asset.test.ts`   | Tested      |
| R21 | Asset Fetch Fallback to Placeholder           | Implemented           | `tests/render/render-ssrf-asset.test.ts`   | Tested      |
| R22 | Concurrency Pool Active Context Limit         | Implemented           | `tests/render/render-pool-cache.test.ts`   | Tested      |
| R23 | Render Timeout Slot Release (Same Pool)       | Implemented           | `tests/render/render-pool-cache.test.ts`   | Tested      |
| R24 | Render Cache Browser Render Count Bypass      | Implemented           | `tests/render/render-pool-cache.test.ts`   | Tested      |
| R25 | Cache Key Varies with Theme                   | Implemented           | `tests/render/render-pool-cache.test.ts`   | Tested      |
| R26 | Cache Key Varies with VM Content              | Implemented           | `tests/render/render-pool-cache.test.ts`   | Tested      |
| R27 | Width Bounds Validation                       | Implemented           | `tests/render/render-pool-cache.test.ts`   | Tested      |
| R28 | Output PNG Byte Limit Enforcement             | Implemented           | `tests/render/render-pool-cache.test.ts`   | Tested      |
| R29 | BrowserPool Close Queue Rejection & Lifecycle | Implemented           | `tests/render/render-pool-cache.test.ts`   | Tested      |
| R30 | Total Render Deadline Enforcement             | Implemented           | `tests/render/render-pool-cache.test.ts`   | Tested      |
