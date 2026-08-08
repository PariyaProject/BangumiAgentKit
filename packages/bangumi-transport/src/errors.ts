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
  | 'OAUTH_EXCHANGE_FAILED'
  | 'KEY_VERSION_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export class BangumiError extends Error {
  constructor(
    public readonly code: BangumiErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly upstreamStatus?: number,
    public readonly nextAction?: string,
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

const PUBLIC_ERROR_POLICY: Partial<
  Record<
    BangumiErrorCode,
    {
      message: string | ((err: BangumiError) => string);
      preserveNextAction?: boolean;
    }
  >
> = {
  VALIDATION_ERROR: {
    message: (err) => err.message,
  },
  AUTH_REQUIRED: {
    message: (err) => err.message,
    preserveNextAction: true,
  },
  AUTH_EXPIRED: {
    message: (err) => err.message,
    preserveNextAction: true,
  },
  PERMISSION_DENIED: {
    message: (err) => err.message,
  },
  NOT_FOUND: {
    message: (err) => err.message,
  },
  RATE_LIMITED: {
    message: '请求频率超出限制，请稍后重试。',
  },
  CONFIRMATION_REQUIRED: {
    message: (err) => err.message,
    preserveNextAction: true,
  },
  CONFIRMATION_INVALID: {
    message: (err) => err.message,
  },
  CONFIRMATION_EXPIRED: {
    message: (err) => err.message,
  },
  RAW_WRITE_OPERATION_DISABLED: {
    message: (err) => err.message,
  },
  WRITE_RESULT_UNKNOWN: {
    message: '写入结果未知，请先查询当前状态，不要自动重试。',
  },
  NETWORK_ERROR: {
    message: '网络请求失败，请稍后重试。',
  },
  UPSTREAM_UNAVAILABLE: {
    message: 'Bangumi 上游服务暂不可用，请稍后重试。',
  },
  PARSER_ERROR: {
    message: '响应解析失败。',
  },
  KEY_VERSION_UNAVAILABLE: {
    message: '密钥版本不可用，请重新绑定或更新凭据。',
  },
  OAUTH_EXCHANGE_FAILED: {
    message: 'OAuth 授权码兑换失败，请重新进行授权。',
  },
};

export interface PublicErrorInfo {
  code: string;
  message: string;
  retryable?: boolean;
  nextAction?: string;
}

export function isBangumiError(err: unknown): err is BangumiError {
  return (
    err instanceof BangumiError ||
    (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'BangumiError')
  );
}

export function toPublicError(err: unknown): PublicErrorInfo {
  if (isBangumiError(err)) {
    const policy = PUBLIC_ERROR_POLICY[err.code];
    if (policy) {
      const msg = typeof policy.message === 'function' ? policy.message(err) : policy.message;
      return {
        code: err.code,
        message: msg,
        retryable: err.retryable,
        nextAction: policy.preserveNextAction ? err.nextAction : undefined,
      };
    }
  }
  return {
    code: 'INTERNAL_ERROR',
    message: '内部服务发生错误',
    retryable: false,
  };
}
