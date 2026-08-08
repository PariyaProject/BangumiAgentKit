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

export const BANGUMI_ERROR_CODES = new Set<BangumiErrorCode>([
  'VALIDATION_ERROR',
  'AUTH_REQUIRED',
  'AUTH_EXPIRED',
  'PERMISSION_DENIED',
  'NOT_FOUND',
  'RATE_LIMITED',
  'UPSTREAM_UNAVAILABLE',
  'NETWORK_ERROR',
  'PARSER_ERROR',
  'UNKNOWN_ERROR',
  'CONFIRMATION_REQUIRED',
  'CONFIRMATION_INVALID',
  'CONFIRMATION_EXPIRED',
  'RAW_WRITE_OPERATION_DISABLED',
  'WRITE_RESULT_UNKNOWN',
  'STORAGE_ERROR',
  'OAUTH_EXCHANGE_FAILED',
  'KEY_VERSION_UNAVAILABLE',
  'INTERNAL_ERROR',
]);

const PUBLIC_ERROR_POLICY: Partial<
  Record<
    BangumiErrorCode,
    {
      message: string;
      preserveNextAction?: boolean;
    }
  >
> = {
  VALIDATION_ERROR: {
    message: '输入参数无效，请检查调用参数。',
  },
  AUTH_REQUIRED: {
    message: '需要先绑定 Bangumi 账号。',
    preserveNextAction: true,
  },
  AUTH_EXPIRED: {
    message: 'Bangumi 登录凭证已失效，请重新授权。',
    preserveNextAction: true,
  },
  PERMISSION_DENIED: {
    message: '当前账号没有执行此操作所需的权限。',
  },
  NOT_FOUND: {
    message: '未找到请求的资源。',
  },
  RATE_LIMITED: {
    message: '请求频率超出限制，请稍后重试。',
  },
  CONFIRMATION_REQUIRED: {
    message: '此操作需要确认后才能执行。',
    preserveNextAction: true,
  },
  CONFIRMATION_INVALID: {
    message: '确认信息无效，请重新发起操作。',
  },
  CONFIRMATION_EXPIRED: {
    message: '确认已过期，请重新发起操作。',
  },
  RAW_WRITE_OPERATION_DISABLED: {
    message: 'Raw 写操作当前未启用，请使用语义写工具。',
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
  if (err instanceof BangumiError) {
    return true;
  }
  if (typeof err === 'object' && err !== null) {
    const candidate = err as Record<string, unknown>;
    return (
      candidate.name === 'BangumiError' &&
      typeof candidate.code === 'string' &&
      BANGUMI_ERROR_CODES.has(candidate.code as BangumiErrorCode) &&
      typeof candidate.retryable === 'boolean' &&
      typeof candidate.message === 'string'
    );
  }
  return false;
}

export function toPublicError(err: unknown): PublicErrorInfo {
  if (isBangumiError(err)) {
    const policy = PUBLIC_ERROR_POLICY[err.code];
    if (policy) {
      return {
        code: err.code,
        message: policy.message,
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
