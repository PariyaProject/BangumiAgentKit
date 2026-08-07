export type BangumiErrorCode = 'VALIDATION_ERROR' | 'AUTH_REQUIRED' | 'AUTH_EXPIRED' | 'PERMISSION_DENIED' | 'NOT_FOUND' | 'RATE_LIMITED' | 'UPSTREAM_UNAVAILABLE' | 'NETWORK_ERROR' | 'PARSER_ERROR' | 'UNKNOWN_ERROR';
export declare class BangumiError extends Error {
    readonly code: BangumiErrorCode;
    readonly retryable: boolean;
    readonly upstreamStatus?: number | undefined;
    readonly nextAction?: string | undefined;
    constructor(code: BangumiErrorCode, message: string, retryable: boolean, upstreamStatus?: number | undefined, nextAction?: string | undefined);
    toJSON(): {
        ok: boolean;
        error: {
            code: BangumiErrorCode;
            message: string;
            retryable: boolean;
            upstreamStatus: number | undefined;
            nextAction: string | undefined;
        };
    };
}
//# sourceMappingURL=errors.d.ts.map