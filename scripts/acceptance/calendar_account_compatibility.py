"""Closed source compatibility for twelve old reads; no execution capability.

This fixed operator anchor retains old execution and applicable dependency refs.
It does not admit old calendar pixels, discover credentials or execute a runner.
"""
from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess

from . import real_account_a1_evidence as receipts
from . import real_account_a3_evidence as shared
from . import real_account_a7_evidence as a7
from . import qs55_account_compatibility as qs55

BUNDLE = 'docs/live-probes/run95-calendar-account-source-compatibility-2026-11-05'
REFERENCE = BUNDLE + '/import.json'
IMPORT_SHA256 = '0a0b69c9409aa4b2a45af3c24a4415420c69f4bfc2c7389561f290e8b65296ee'
SOURCE_REVISION = '99c863d17f21d314de7f4357fdcfd8e808fb323e'
PARENT = 'sha256:9c0784bff3ef39fa5c30639f07e3b86b4be634c2cecf854679e9920f9517014a'
TOOLS = qs55.TOOLS | {a7.TOOL}
CHANGED_SOURCES = frozenset(('packages/renderer/src/render-service.ts', 'packages/renderer/src/templates/CalendarCard.tsx'))
PROGRAMS = frozenset('scripts/acceptance/' + name for name in (
    'calendar-account-closed-contract.mjs', 'calendar-account-closed-controller.mjs',
    'calendar-account-closed-driver.mjs', 'calendar-account-closed-fixture.mjs',
    'calendar-account-closed-guard.mjs', 'calendar-account-closed-preloaded.cjs',
    'prepare-calendar-account-compiled.mjs', 'run-calendar-account-closed-proof.py',
))
OLD_READERS = ('scripts/acceptance/qs55_account_compatibility.py',
               'scripts/acceptance/real_account_a7_evidence.py',
               'scripts/acceptance/native_tim_calendar_evidence.py')
NATIVE_RENDERER = '/opt/bangumi/node_modules/.pnpm/@bangumi-agent-kit+renderer@file+packages+renderer_@types+better-sqlite3@7.6.13_@types+node@22.20.1_@types+pg@8.20.4/node_modules/@bangumi-agent-kit/renderer/dist/'
PARENT_JS = {
    'render-service.js': '9a6954a849c618cd6aaef468e9da6e9ba36f37ddf9cc6a7509163616dd3cdce9',
    'templates/CalendarCard.js': '3f59f2c966bb3520315544dbb3ff5eb5917a7f15fa2596b7df8b28dd29b4cd9b',
}


def _same_json(left, right):
    return json.dumps(left, sort_keys=True, separators=(',', ':')) == json.dumps(right, sort_keys=True, separators=(',', ':'))


def _integer(value, expected):
    return type(value) is int and value == expected


def _unalias(root, name):
    path = PurePosixPath(name)
    if (not name or not path.parts or path.is_absolute() or str(path) != name or any(p in ('.', '..', '.git') for p in path.parts)
            or any(c in name for c in ('\\', '\0', '\n', '\r', ':'))):
        raise ValueError('Noncanonical evidence path')
    current = root
    for part in path.parts[:-1]:
        current /= part
        if current.is_symlink() or not current.is_dir():
            raise ValueError('Evidence directory alias')


def _read(root, name, maximum=shared.MAX_SOURCE_BYTES):
    _unalias(root, name)
    return receipts._read_regular(root, name, maximum)


def _fixed(root, files):
    for name in files:
        _unalias(root, name)
    return qs55._fixed_files(root, files)


def _historical(root):
    protected = {}
    loaded = {}
    for bundle, anchor in ((qs55.BUNDLE, qs55.IMPORT_SHA256), (a7.BUNDLE, a7.IMPORT_SHA256)):
        name = bundle + '/import.json'
        raw = _read(root, name)
        if hashlib.sha256(raw).hexdigest() != anchor:
            raise ValueError('Original import changed')
        protected[name] = anchor
        loaded[bundle] = json.loads(raw)
        for relative, digest in loaded[bundle]['evidenceFiles'].items():
            protected[bundle + '/' + relative] = digest
    frozen = json.loads(_read(root, qs55.BUNDLE + '/frozen-files.json'))
    if len(frozen) != 53:
        raise ValueError('Frozen inventory changed')
    protected.update(frozen)
    old_proof = json.loads(_read(root, qs55.BUNDLE + '/native-proof.json'))
    protected.update(old_proof['producerFiles'])
    for name in OLD_READERS:
        # The fixed native proof below binds these values too; a future helper
        # edit must not inherit the original compatibility observation.
        protected[name] = hashlib.sha256(_read(root, name)).hexdigest()
    if len(protected) != 76 or not _fixed(root, protected):
        raise ValueError('Historical Git/disk bytes changed')
    inputs, references = [], {}
    for name in sorted(frozen):
        if name.endswith('/import.json') and '/run95-a1-' not in name:
            manifest = json.loads(_read(root, name))
            label = Path(name).parent.name.split('-')[1]
            for item in manifest['admittedTools']:
                inputs.append(item)
                references[item['name']] = str(Path(name).parent / (label + '-result.json'))
    inputs.extend(loaded[a7.BUNDLE]['admittedTools'])
    references[a7.TOOL] = a7.REFERENCE
    if len(inputs) != 12 or set(references) != TOOLS:
        raise ValueError('Historical input inventory changed')
    return inputs, references, protected


def _proof_matches(proof, inputs):
    """Falsifiable semantics in addition to the fixed file seal."""
    try:
        if (proof['schema'] != 'calendar-account-closed-native-proof/v1' or proof['passed'] is not True
                or proof['sourceRevision'] != SOURCE_REVISION or proof['qsVersion'] != '6.16.1'
                or proof['parentImageId'] != PARENT or proof['originalParentPreserved'] is not True
                or proof['containerRemoved'] is not True or proof['containerReadOnly'] is not True
                or proof['containerNetwork'] != 'none' or not _integer(proof['realDataMounts'], 0)
                or not _integer(proof['codeMounts'], 2) or not _integer(proof['qaMounts'], 1)
                or not _integer(proof['actualAccountActions'], 0) or not _integer(proof['modelCalls'], 0)
                or not _integer(proof['clientMessages'], 0) or not _integer(proof['fixtureRowsPerResponse'], 1)
                or not _same_json(proof['exactInputs'], inputs) or set(proof['producerFiles']) != PROGRAMS):
            return False
        projection = proof['projection']
        if (projection['schema'] != 'calendar-account-compiled-projection/v1'
                or projection['sourceRevision'] != SOURCE_REVISION or projection['baselineRevision'] != a7.SOURCE_REVISION
                or projection['typescript'] != '5.9.3' or projection['parentProjectionExact'] is not True
                or projection['currentDistExact'] is not True or len(projection['files']) != 2
                or {f['source'] for f in projection['files']} != CHANGED_SOURCES):
            return False
        runtime_files = {}
        for item in projection['files']:
            emitted = item['source'].replace('/src/', '/dist/').replace('.tsx', '.js').replace('.ts', '.js')
            relative = emitted.split('/dist/')[1]
            if (item['emitted'] != emitted or item['parentPath'] != NATIVE_RENDERER + relative
                    or item['parentSha256'] != PARENT_JS[relative]
                    or item['sourceSha256'] != proof['source']['sources'][item['source']]['sha256']):
                return False
            runtime_files[item['parentPath']] = item['emittedSha256']
        staged = proof['stagedPrograms']
        if set(staged) != {Path(p).name for p in PROGRAMS if not p.endswith('.py')}:
            return False
        if any(sha != proof['producerFiles']['scripts/acceptance/' + name] for name, sha in staged.items()):
            return False
        runs = proof['runs']
        if [r['mode'] for r in runs] != ['normal', 'require', 'import', 'preloaded', 'network-controller', 'network-server'] or any(r['passed'] is not True for r in runs):
            return False
        normal = runs[0]
        native = normal['native']
        if (not _integer(normal['exitStatus'], 0) or normal['signal'] is not None
                or native['schema'] != 'calendar-account-closed-compiled/v1' or native['passed'] is not True
                or native['mcpClosed'] is not True or native['workspaceRemoved'] is not True
                or native['fakeStorage'] is not True or native['episodeSelectionValidated'] is not True
                or native['failureStage'] is not None or not _same_json(native['exactInputs'], inputs)
                or not all(_integer(native[key], 0) for key in ('realAccountActions', 'modelCalls', 'clientMessages'))
                or [r['name'] for r in native['results']] != [i['name'] for i in inputs]
                or any(r['ok'] is not True or r['nativePngDecoded'] is not r['name'].startswith('bangumi.render_') for r in native['results'])):
            return False
        for role in ('controller', 'server'):
            trace = normal[role]
            if (trace['schema'] != 'calendar-account-closed-guard/v1' or trace['role'] != role
                    or any(trace[key] is not True for key in ('started', 'hooksReady', 'compiledFilesVerified', 'finalized', 'cleanExit'))
                    or not all(_integer(trace[key], 0) for key in ('initialCached', 'attempts', 'finalCached', 'networkAttempts'))
                    or trace['networkSurfaces'] != {}):
                return False
        if (normal['server']['loadedRuntimeFiles'] != runtime_files
                or normal['server']['fixtureFetchInstalled'] is not True
                or normal['controller']['fixtureFetchInstalled'] is not False
                or not _integer(normal['controller']['fixtureFetchCalls'], 0)):
            return False
        provider = normal['provider']
        if (provider['schema'] != 'calendar-account-closed-provider/v1' or provider['privateCacheDisabled'] is not True
                or not all(_integer(provider[k], 0) for k in ('denied', 'assetAttempts', 'cacheWrites'))
                or not _integer(provider['renderCalls'], 5) or not 1 <= len(provider['calls']) <= 64
                or not _integer(normal['server']['fixtureFetchCalls'], len(provider['calls']))):
            return False
        steps = set()
        for call in provider['calls']:
            step = call['step']
            if type(step) is not int or not 0 <= step < 12 or call['kind'] not in ('collections', 'episodes', 'calendar'):
                return False
            if call['kind'] == 'calendar':
                if not any(word in inputs[step]['name'] for word in ('backlog', 'schedule', 'dashboard')):
                    return False
            elif type(call['limit']) is not int or not 1 <= call['limit'] <= 2:
                return False
            steps.add(step)
        if steps != set(range(12)) or [c for c in provider['calls'] if c['step'] == 11] != [{'kind': 'episodes', 'step': 11, 'limit': 1}]:
            return False
        for run in runs[1:]:
            native = run['native']
            if (type(run['exitStatus']) is not int or run['exitStatus'] == 0 or run['signal'] is not None
                    or native['passed'] is not False or native['workspaceRemoved'] is not True or native['results'] != []):
                return False
            if run['mode'] == 'preloaded':
                if run['server']['initialCached'] < 1 or run['server']['hooksReady'] is not False:
                    return False
            elif run['mode'] in ('require', 'import'):
                if run['server']['attempts'] < 1:
                    return False
            elif run['mode'] == 'network-controller':
                if run['controller']['networkAttempts'] < 1 or run['server'] is not None:
                    return False
            elif run['server']['networkAttempts'] < 1:
                return False
        return True
    except (KeyError, TypeError, ValueError, AttributeError):
        return False


def calendar_compatible_account_sources(root: Path, catalog: list[dict]) -> dict[str, set[str]]:
    """Return original twelve observations with fixed compatibility chain, or none."""
    root = Path(root)
    try:
        raw = _read(root, REFERENCE)
        if hashlib.sha256(raw).hexdigest() != IMPORT_SHA256:
            return {}
        manifest = json.loads(raw)
        if (manifest['schema'] != 'bgk-calendar-closed-account-source-compatibility/v1'
                or manifest['kind'] != 'old-execution-with-closed-compiled-source-compatibility'
                or manifest['sourceBasisRevision'] != SOURCE_REVISION
                or manifest['executedBaselineRevision'] != a7.SOURCE_REVISION or manifest['parentImageId'] != PARENT
                or set(manifest['evidenceFiles']) != {'native-proof.json', 'failed-first-native-proof.json'}):
            return {}
        loaded, fixed = {}, {REFERENCE: IMPORT_SHA256}
        for name, sha in manifest['evidenceFiles'].items():
            data = _read(root, BUNDLE + '/' + name)
            if hashlib.sha256(data).hexdigest() != sha:
                return {}
            fixed[BUNDLE + '/' + name] = sha
            loaded[name] = json.loads(data)
        if not _fixed(root, fixed) or loaded['failed-first-native-proof.json']['passed'] is not False:
            return {}
        receipts._git(root, 'merge-base', '--is-ancestor', SOURCE_REVISION, 'HEAD')
        inputs, references, protected = _historical(root)
        proof = loaded['native-proof.json']
        if (not _same_json(manifest['admittedTools'], inputs) or manifest['originalReferences'] != references
                or proof['originalReferences'] != references or proof['protectedFiles'] != protected
                or not _proof_matches(proof, inputs) or not _fixed(root, proof['producerFiles'])):
            return {}
        source = proof['source']
        sources = source['sources']
        old = json.loads(_read(root, a7.BUNDLE + '/source-files.json'))
        if (len(sources) != 285 or set(sources) != set(old)
                or {n for n in sources if sources[n] != old[n]} != CHANGED_SOURCES
                or source['runtimeTreeSha256'] != manifest['runtimeTreeSha256']):
            return {}
        for name in sources:
            _unalias(root, name)
        for name in shared.RUNTIME_PATHS:
            path = root / name
            if name in ('apps', 'packages'):
                if path.is_symlink() or not path.is_dir():
                    return {}
            elif name not in sources and (path.exists() or path.is_symlink()):
                return {}
        expected_package = json.loads(receipts._git(root, 'show', a7.SOURCE_REVISION + ':package.json'))
        expected_package['scripts'].pop('acceptance:check', None)
        for package in (source['rootPackage'], json.loads(receipts._git(root, 'show', 'HEAD:package.json')), json.loads(_read(root, 'package.json'))):
            package = copy.deepcopy(package)
            package['scripts'].pop('acceptance:check', None)
            if not _same_json(package, expected_package):
                return {}
        runtime_package = copy.deepcopy(expected_package)
        runtime_package.pop('scripts')
        if not shared._current_sources_match(root, manifest, sources, runtime_package):
            return {}
        if catalog != json.loads(_read(root, 'docs/tool-catalog.json')):
            return {}
        if {t['name'] for t in catalog if t['name'] in TOOLS and t.get('auth') != 'none' and t.get('risk') == 'read'} != TOOLS:
            return {}
        return {name: {ref, REFERENCE} | ({qs55.REFERENCE} if name in qs55.TOOLS else set()) for name, ref in references.items()}
    except (OSError, ValueError, KeyError, TypeError, AttributeError, subprocess.SubprocessError):
        return {}
