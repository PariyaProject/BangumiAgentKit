import {
  type CapabilityResult,
  type SourceClass,
  type SourceDescriptor,
  type WarningCode,
  warning,
} from './contracts.js';

export type SourceAvailability = 'enabled' | 'disabled' | 'not_configured';

export interface SourcePolicy {
  [sourceClass: string]: SourceAvailability;
  official_v0: SourceAvailability;
  official_legacy: SourceAvailability;
  structured_web: SourceAvailability;
  website_embedded: SourceAvailability;
  website_html: SourceAvailability;
  snapshot: SourceAvailability;
  derived: SourceAvailability;
}

export const DEFAULT_SOURCE_POLICY: SourcePolicy = Object.freeze({
  official_v0: 'enabled',
  official_legacy: 'enabled',
  structured_web: 'disabled',
  website_embedded: 'disabled',
  website_html: 'disabled',
  snapshot: 'not_configured',
  derived: 'enabled',
});

export const CALENDAR_FIELD_POLICY = Object.freeze({
  membership: 'official_legacy',
  weekday: 'official_legacy',
  subject: 'official_v0',
  subjectStats: 'official_v0',
} satisfies Record<string, SourceClass>);

export function sourceAvailability(
  sourceClass: SourceClass,
  policy: SourcePolicy = DEFAULT_SOURCE_POLICY,
): SourceAvailability {
  return policy[sourceClass] ?? 'not_configured';
}

export function isSourceEnabled(
  sourceClass: SourceClass,
  policy: SourcePolicy = DEFAULT_SOURCE_POLICY,
): boolean {
  return sourceAvailability(sourceClass, policy) === 'enabled';
}

/**
 * Fallback selection is intentionally explicit. The default policy has no
 * structured-web or HTML fallback for an official provider failure.
 */
export function selectFallbackSources(
  _capability: string,
  _primary: SourceClass,
  _policy: SourcePolicy = DEFAULT_SOURCE_POLICY,
): SourceClass[] {
  return [];
}

function disabledWarning(source: SourceDescriptor, availability: SourceAvailability) {
  const code: WarningCode =
    availability === 'not_configured' ? 'SOURCE_NOT_CONFIGURED' : 'SOURCE_DISABLED';
  return warning(code, `Source ${source.class} is ${availability}.`, { source });
}

export function sourceUnavailableResult<T>(
  source: SourceDescriptor,
  policy: SourcePolicy = DEFAULT_SOURCE_POLICY,
): CapabilityResult<T> {
  const availability = sourceAvailability(source.class, policy);
  if (availability === 'enabled') {
    return {
      state: 'unavailable',
      warnings: [
        warning('SOURCE_NOT_CONFIGURED', `No provider is registered for ${source.class}.`, {
          source,
        }),
      ],
    };
  }
  return {
    state: availability === 'not_configured' ? 'not_computable' : 'unsupported',
    warnings: [disabledWarning(source, availability)],
  };
}
