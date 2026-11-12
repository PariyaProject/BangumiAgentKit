import { profileExecutionModelMatches as priorModelMatches } from './native-entity-page-profile.mjs';
import { G03_MODEL_PROFILE_ID, isG03ModelProfile } from './native-g03-date-png-profile.mjs';
import {
  RELATION_MODEL_PROFILE_ID,
  isRelationModelProfile,
} from './native-relation-model-profile.mjs';

/** Exact new workload; frozen prior execution modules and model pins remain unchanged. */
export const profileExecutionModelMatches = (profile) =>
  profile?.id === RELATION_MODEL_PROFILE_ID
    ? isRelationModelProfile(profile)
    : profile?.id === G03_MODEL_PROFILE_ID
      ? isG03ModelProfile(profile)
      : priorModelMatches(profile);
