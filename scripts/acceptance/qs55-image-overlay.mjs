// Build-time, QA-only overlay. Never mutates a host dependency store/runtime.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
const root = '/opt/bangumi';
const beforeVersion = 'node_modules/.pnpm/qs@6.16.0/';
const afterVersion = 'node_modules/.pnpm/qs@6.16.1/';
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
function inventory() {
  const result = {};
  function walk(relative) {
    const filename = path.join(root, relative),
      stat = fs.lstatSync(filename);
    if (stat.isSymbolicLink())
      result[relative] = { mode: stat.mode & 0o777, link: fs.readlinkSync(filename) };
    else if (stat.isDirectory())
      for (const name of fs.readdirSync(filename).sort()) walk(path.join(relative, name));
    else if (stat.isFile())
      result[relative] = { mode: stat.mode & 0o777, sha256: digest(fs.readFileSync(filename)) };
    else throw Error('QS55_NONREGULAR_IMAGE');
  }
  walk('');
  return result;
}
const before = inventory();
const manifest = JSON.parse(fs.readFileSync('/patch/artifact-6.16.1.json', 'utf8'));
const oldManifest = JSON.parse(fs.readFileSync('/patch/artifact-6.16.0.json', 'utf8'));
for (const [name, hash] of Object.entries(oldManifest.files)) {
  if (before[beforeVersion + 'node_modules/qs/' + name]?.sha256 !== hash)
    throw Error('QS55_PARENT_ARTIFACT');
}
// OverlayFS lower-layer directories cannot always be renamed (EXDEV).
fs.cpSync(path.join(root, beforeVersion), path.join(root, afterVersion), {
  recursive: true,
  dereference: false,
  verbatimSymlinks: true,
});
fs.rmSync(path.join(root, beforeVersion), { recursive: true });
const target = path.join(root, afterVersion, 'node_modules/qs');
fs.rmSync(target, { recursive: true });
fs.mkdirSync(target);
for (const [name, hash] of Object.entries(manifest.files)) {
  const data = fs.readFileSync(path.join('/patch/payload', name));
  if (digest(data) !== hash || path.isAbsolute(name) || name.split('/').includes('..'))
    throw Error('QS55_ARTIFACT');
  fs.mkdirSync(path.dirname(path.join(target, name)), { recursive: true });
  fs.writeFileSync(path.join(target, name), data, { mode: 0o644 });
}
let linksChanged = 0;
for (const [name, value] of Object.entries(before)) {
  if (!value.link?.includes('qs@6.16.0/')) continue;
  const filename = path.join(root, name.replace(beforeVersion, afterVersion));
  fs.unlinkSync(filename);
  fs.symlinkSync(value.link.replaceAll('qs@6.16.0/', 'qs@6.16.1/'), filename);
  linksChanged++;
}
const after = inventory(),
  expected = {};
for (const [name, value] of Object.entries(before)) {
  if (name.startsWith(beforeVersion + 'node_modules/qs/')) continue;
  expected[name.replace(beforeVersion, afterVersion)] = value.link
    ? { ...value, link: value.link.replaceAll('qs@6.16.0/', 'qs@6.16.1/') }
    : value;
}
for (const [name, hash] of Object.entries(manifest.files))
  expected[afterVersion + 'node_modules/qs/' + name] = { mode: 0o644, sha256: hash };
if (!isDeepStrictEqual(after, expected) || linksChanged < 2)
  throw Error('QS55_UNRELATED_IMAGE_DELTA');
const canonical = (value) =>
  JSON.stringify(
    Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en'))),
  );
fs.writeFileSync(
  '/qs55-image-delta.json',
  JSON.stringify({
    schema: 'qs55-image-delta/v1',
    beforeInventorySha256: digest(canonical(before)),
    afterInventorySha256: digest(canonical(after)),
    beforeEntries: Object.keys(before).length,
    afterEntries: Object.keys(after).length,
    onlyQsArtifactAndResolutionLinksChanged: true,
    linksChanged,
    publishedFiles: Object.keys(manifest.files).length,
    runtimeDependenciesUnchanged: true,
  }),
);
