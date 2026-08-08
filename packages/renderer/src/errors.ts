export type RendererErrorCode =
  | 'RENDER_VALIDATION_ERROR'
  | 'RENDER_TEMPLATE_NOT_FOUND'
  | 'RENDER_TIMEOUT'
  | 'RENDER_BROWSER_ERROR'
  | 'RENDER_OUTPUT_TOO_LARGE'
  | 'ASSET_URL_BLOCKED'
  | 'ASSET_FETCH_FAILED'
  | 'ASSET_TOO_LARGE'
  | 'ASSET_INVALID_IMAGE'
  | 'RENDERER_CLOSED';

export class RendererError extends Error {
  readonly code: RendererErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: RendererErrorCode, message: string, details?: Record<string, unknown>) {
    super(`[${code}] ${message}`);
    this.name = 'RendererError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
