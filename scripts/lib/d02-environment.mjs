import os from 'node:os';

const RUNTIME_ENVIRONMENT_KEYS = [
  'PATH',
  'HOME',
  'USERPROFILE',
  'CODEX_HOME',
  'TMPDIR',
  'TMP',
  'TEMP',
  'LANG',
  'LC_ALL',
  'TERM',
  'NO_COLOR',
  'CI',
  'XDG_CONFIG_HOME',
  'XDG_CACHE_HOME',
  'XDG_DATA_HOME',
  'SYSTEMROOT',
  'WINDIR',
  'COMSPEC',
];

const ALLOWED_ENVIRONMENT_KEYS = new Set([
  ...RUNTIME_ENVIRONMENT_KEYS,
  'GIT_CONFIG_GLOBAL',
  'GIT_CONFIG_SYSTEM',
  'GIT_CONFIG_NOSYSTEM',
]);

function setGitIsolation(environment) {
  environment.GIT_CONFIG_GLOBAL = os.devNull;
  environment.GIT_CONFIG_SYSTEM = os.devNull;
  environment.GIT_CONFIG_NOSYSTEM = '1';
  return environment;
}

export function createD02ChildEnvironment(source = process.env) {
  const environment = {};
  for (const key of RUNTIME_ENVIRONMENT_KEYS) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0) environment[key] = value;
  }
  setGitIsolation(environment);
  if (!environment.PATH || (!environment.HOME && !environment.USERPROFILE)) {
    throw new Error('D02 requires PATH and a home directory to launch the isolated Luna runtime.');
  }
  if (!isD02ChildEnvironmentVerified(environment)) {
    throw new Error('D02 child environment failed its explicit allowlist check.');
  }
  return environment;
}

export function isD02ChildEnvironmentVerified(environment) {
  if (!environment || typeof environment !== 'object' || Array.isArray(environment)) return false;
  if (
    Object.entries(environment).some(
      ([key, value]) => !ALLOWED_ENVIRONMENT_KEYS.has(key) || typeof value !== 'string',
    ) ||
    !environment.PATH ||
    (!environment.HOME && !environment.USERPROFILE)
  )
    return false;
  return (
    environment.GIT_CONFIG_GLOBAL === os.devNull &&
    environment.GIT_CONFIG_SYSTEM === os.devNull &&
    environment.GIT_CONFIG_NOSYSTEM === '1'
  );
}

export function restrictD02ProcessEnvironment(target = process.env) {
  const environment = createD02ChildEnvironment(target);
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, environment);
  return isD02ChildEnvironmentVerified(target);
}
