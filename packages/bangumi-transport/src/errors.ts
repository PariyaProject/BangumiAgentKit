export type BangumiErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTH_REQUIRED'
  | 'AUTH_EXPIRED'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'NETWORK_ERROR'
  | 'PARSER_ERROR'
  | 'UNKNOWN_ERROR'
  | 'CONFIRMATION_REQUIRED'
  | 'CONFIRMATION_INVALID'
  | 'CONFIRMATION_EXPIRED'
  | 'RAW_WRITE_OPERATION_DISABLED'
  | 'WRITE_RESULT_UNKNOWN'
  | 'STORAGE_ERROR'
  | 'OAUTH_EXCHANGE_FAILED';

export class BangumiError extends Error {
  constructor(
    public readonly code: BangumiErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly upstreamStatus?: number,
    public readonly nextAction?: string
  ) {
    const fullMessage = message.startsWith(code) ? message : `${code}: ${message}`;
    super(fullMessage);
    this.name = 'BangumiError';
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      ok: false,
      error: {
        code: this.code,
        message: this.message,
        retryable: this.retryable,
        upstreamStatus: this.upstreamStatus,
        nextAction: this.nextAction,
      },
    };
  }
}
