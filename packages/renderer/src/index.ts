export * from './errors.js';
export { COLLECTION_COMPLETION_UNRESOLVED_CAVEAT } from '@bangumi-agent-kit/discovery';
export * from './view-models/index.js';
export * from './view-model-builders/index.js';
export * from './themes/index.js';
export {
  RenderService,
  RENDERER_VERSION,
  computeRenderCacheKey,
  canonicalizeJson,
  extractImageUrls,
} from './render-service.js';
export type { RenderResult, RenderOptions } from './render-service.js';
export type { RenderTypographyOptions } from './typography.js';
export {
  MAX_RENDER_FONT_SIZE_SCALE,
  MIN_RENDER_FONT_SIZE_SCALE,
  normalizeRenderTypographyOptions,
} from './typography.js';
export { AssetResolver } from './asset-resolver.js';
export { NodeAssetHttpTransport } from './asset-transport.js';
export type {
  AssetHttpTransport,
  AssetHttpTransportOptions,
  AssetHttpTransportResponse,
  ApprovedAddress,
} from './asset-transport.js';
export { renderHtmlTemplate } from './template-engine.js';

export * from './artifact-store.js';

export const MODULE_NAME = 'renderer';
