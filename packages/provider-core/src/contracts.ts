export const SOURCE_CLASSES = [
  'official_v0',
  'official_legacy',
  'structured_web',
  'website_embedded',
  'website_html',
  'snapshot',
  'derived',
] as const;

export type SourceClass = (typeof SOURCE_CLASSES)[number];

export interface SourceDescriptor {
  class: SourceClass;
  provider: string;
  operation?: string;
  version?: string;
  experimental?: boolean;
}

export const SOURCE_V0: SourceDescriptor = Object.freeze({
  class: 'official_v0',
  provider: 'bangumi',
  version: 'v0',
});

export const SOURCE_LEGACY: SourceDescriptor = Object.freeze({
  class: 'official_legacy',
  provider: 'bangumi',
  version: 'legacy',
});

export const SOURCE_DERIVED: SourceDescriptor = Object.freeze({
  class: 'derived',
  provider: 'bangumi-agent-kit',
});

export type Confidence = 'high' | 'medium' | 'low';
export type FreshnessState = 'fresh' | 'stale' | 'unknown';
export type AuthScope = 'public' | 'principal' | 'account';

export interface FreshnessMetadata {
  state: FreshnessState;
  expiresAt?: string;
  sourceAgeMs?: number;
}

export interface EvidenceEntity {
  type: string;
  id: string | number;
}

export interface EvidenceRef {
  source: SourceDescriptor;
  retrievedAt: string;
  entity?: EvidenceEntity;
  fieldPath?: string;
  freshness?: FreshnessMetadata;
  authScope?: AuthScope;
  confidence?: Confidence;
  formula?: string;
}

export type CoverageState = 'complete' | 'partial' | 'unknown' | 'not_applicable';

export interface Coverage {
  state: CoverageState;
  requested?: number;
  scanned?: number;
  matched?: number;
  returned?: number;
  missing?: number;
  reason?: string;
}

export type CapabilityState =
  | 'ok'
  | 'partial'
  | 'stale'
  | 'conflict'
  | 'auth_required'
  | 'permission_denied'
  | 'unavailable'
  | 'not_computable'
  | 'unsupported'
  | 'upstream_error';

export interface ConflictCandidate<T = unknown> {
  source: SourceDescriptor;
  value: T;
  evidence?: EvidenceRef[];
}

export interface CapabilityConflict<T = unknown> {
  state: 'conflict';
  candidates: ConflictCandidate<T>[];
  reason: string;
  resolution?: string;
}

export type WarningCode =
  | 'PARTIAL_PAGE_SCAN'
  | 'STALE_SOURCE'
  | 'SOURCE_DISAGREEMENT'
  | 'EXPERIMENTAL_SOURCE'
  | 'FORMULA_EMPIRICALLY_VERIFIED'
  | 'MISSING_FIELD'
  | 'MISSING_DATE'
  | 'AUTH_SCOPE_LIMITED'
  | 'SCHEMA_DRIFT'
  | 'SOURCE_DISABLED'
  | 'SOURCE_NOT_CONFIGURED'
  | 'UPSTREAM_NOT_FOUND'
  | 'UPSTREAM_TIMEOUT';

export interface CapabilityWarning {
  code: WarningCode;
  message: string;
  source?: SourceDescriptor;
  fieldPath?: string;
}

/** Field-level evidence keeps normal data ergonomic while retaining auditability. */
export type FieldEvidence = Record<string, EvidenceRef[]>;

export interface CapabilityResult<T> {
  state: CapabilityState;
  data?: T;
  evidence?: FieldEvidence;
  coverage?: Coverage;
  retrievedAt?: string;
  warnings?: CapabilityWarning[];
  conflicts?: CapabilityConflict[];
}

const SECRET_KEYS = /^(?:accessToken|refreshToken|token|password|clientSecret|authorization|headers?|ciphertext|authTag|iv|principalId)$/iu;

function assertSafeObject(value: unknown, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeObject(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEYS.test(key)) {
      throw new Error(`Unsafe provider evidence field at ${path}.${key}`);
    }
    assertSafeObject(child, `${path}.${key}`);
  }
}

/** Runtime guard for provider adapters before evidence enters diagnostics or model output. */
export function assertSafeEvidence(value: EvidenceRef | CapabilityResult<unknown>): void {
  assertSafeObject(value, 'provider');
}

export function createEvidenceRef(input: EvidenceRef): EvidenceRef {
  assertSafeEvidence(input);
  return { ...input, source: { ...input.source }, entity: input.entity && { ...input.entity } };
}

export function warning(
  code: WarningCode,
  message: string,
  details: Omit<CapabilityWarning, 'code' | 'message'> = {},
): CapabilityWarning {
  return { code, message, ...details };
}
