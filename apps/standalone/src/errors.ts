import { BangumiError, isBangumiError, toPublicError } from '@bangumi-agent-kit/bangumi-transport';

export type StandaloneExitCode = 1 | 2 | 3 | 4 | 5;

export class StandaloneCliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: StandaloneExitCode = 1,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'StandaloneCliError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function getStandaloneExitCode(err: unknown): StandaloneExitCode {
  if (err instanceof StandaloneCliError) return err.exitCode;
  if (isBangumiError(err)) {
    switch (err.code) {
      case 'AUTH_REQUIRED':
      case 'AUTH_EXPIRED':
        return 3;
      case 'CONFIRMATION_REQUIRED':
      case 'CONFIRMATION_INVALID':
      case 'CONFIRMATION_EXPIRED':
        return 4;
      case 'RENDERER_UNAVAILABLE':
        return 5;
      case 'VALIDATION_ERROR':
        return 2;
      default:
        return 1;
    }
  }
  return 1;
}

export interface SafeErrorResult {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable?: boolean;
    nextAction?: string;
    confirmationId?: string;
  };
}

export function extractConfirmationId(message: string): string | undefined {
  return message.match(/\bcfm_[A-Za-z0-9_-]+\b/)?.[0];
}

export function toSafeErrorResult(err: unknown): SafeErrorResult {
  if (err instanceof StandaloneCliError) {
    return {
      ok: false,
      error: {
        code: 'USAGE_ERROR',
        message: err.message,
      },
    };
  }

  const publicError = toPublicError(err);
  const confirmationId = isBangumiError(err) ? extractConfirmationId(err.message) : undefined;
  return {
    ok: false,
    error: {
      code: publicError.code,
      message: publicError.message,
      retryable: publicError.retryable,
      nextAction: publicError.nextAction,
      confirmationId,
    },
  };
}

export function toConfirmationDetails(
  err: unknown,
): { confirmationId: string; summary: string; message: string } | undefined {
  if (!(err instanceof BangumiError) || err.code !== 'CONFIRMATION_REQUIRED') return undefined;
  const confirmationId = extractConfirmationId(err.message);
  if (!confirmationId) return undefined;
  const summary = err.message
    .replace(/^CONFIRMATION_REQUIRED:\s*/u, '')
    .replace(/\s*Confirmation ID:\s*cfm_[A-Za-z0-9_-]+.*$/u, '')
    .trim();
  return { confirmationId, summary, message: err.message };
}
