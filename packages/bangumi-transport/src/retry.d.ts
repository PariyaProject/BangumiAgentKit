export interface RetryOptions {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
}
export declare function withRetry<T>(fn: () => Promise<T>, isReadOnly: boolean, options?: RetryOptions): Promise<T>;
//# sourceMappingURL=retry.d.ts.map