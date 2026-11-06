"""Strict fixed witness for old twelve reads after optional person metadata repair.

No execution capability. The frozen calendar/qs55 importers retain their exact
boundaries; this successor independently binds the changed shared source graph.
"""
from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path
import re
import subprocess

from . import calendar_account_compatibility as calendar
from . import real_account_a1_evidence as receipts
from . import real_account_a3_evidence as shared
from . import real_account_a7_evidence as a7
from . import qs55_account_compatibility as qs55

BUNDLE = 'docs/live-probes/run95-person-account-source-compatibility-2026-11-06'
REFERENCE = BUNDLE + '/import.json'
IMPORT_SHA256 = '8b605752ae6c6c92b8dbe2db665a636e7521cae77e9fbe908d419924233940b4'
SOURCE_REVISION = 'd64a9dfcab577af00dde98c4c5eb93fab4a077af'
PARENT = calendar.PARENT
TOOLS = calendar.TOOLS
CHANGED_SOURCES = calendar.CHANGED_SOURCES | frozenset((
    'packages/bangumi-core/src/models/user.ts',
    'packages/bangumi-core/src/services/user-service.ts',
    'packages/bangumi-core/src/services/collection-entity-consistency-service.ts',
))
PROGRAMS = calendar.PROGRAMS | frozenset('scripts/acceptance/' + name for name in (
    'prepare-person-account-compiled.mjs', 'person-account-core-guard.mjs',
    'person-account-controller.mjs', 'person-account-fixture.mjs',
    'person-account-driver.mjs', 'run-person-account-closed-proof.py',
))
NATIVE_CORE = '/opt/bangumi/node_modules/.pnpm/@bangumi-agent-kit+bangumi-core@file+packages+bangumi-core_@types+better-sqlite3@7.6.13_@types+pg@8.20.4/node_modules/@bangumi-agent-kit/bangumi-core/dist/'
CHANGED_JS = frozenset((('core', 'services/user-service.js'),
    ('core', 'services/collection-entity-consistency-service.js'),
    ('renderer', 'render-service.js'), ('renderer', 'templates/CalendarCard.js')))
PERSON_CASES = ('unknown', 'empty', 'raw-label', 'list', 'join', 'png', 'parser-error', 'not-found')
PERSON_TOOLS = ('bangumi.get_person_collection',) * 3 + (
    'bangumi.list_person_collections', 'bangumi.get_collection_entity_consistency',
    'bangumi.render_collection_entity_consistency', 'bangumi.get_person_collection',
    'bangumi.get_person_collection')
_same = calendar._same_json
_integer = calendar._integer
_read = calendar._read
_fixed = calendar._fixed


def _historical(root):
    inputs, references, protected = calendar._historical(root)
    for name in calendar.PROGRAMS | {'scripts/acceptance/calendar_account_compatibility.py'}:
        protected[name] = hashlib.sha256(_read(root, name)).hexdigest()
    if len(protected) != 85 or not _fixed(root, protected):
        raise ValueError('Historical producer bytes changed')
    return inputs, references, protected


def _projection(proof):
    p = proof['projection']
    if (p['schema'] != 'person-account-compiled-projection/v1'
            or p['sourceRevision'] != SOURCE_REVISION or p['baselineRevision'] != a7.SOURCE_REVISION
            or p['typescript'] != '5.9.3' or any(p[k] is not True for k in (
                'parentProjectionExact', 'currentDistExact', 'allOtherEmittedJavaScriptUnchanged'))
            or set(p['sourceFiles']) != CHANGED_SOURCES
            or any(sha != proof['source']['sources'][name]['sha256'] for name, sha in p['sourceFiles'].items())
            or len(p['emittedFiles']) != 107 or len(p['files']) != 4):
        raise ValueError('Incomplete full compiler projection')
    emitted, changed = {}, {}
    for f in p['emittedFiles']:
        key = (f['package'], f['relative'])
        prefix = {'core': NATIVE_CORE, 'renderer': calendar.NATIVE_RENDERER}[key[0]]
        if (key in emitted or not f['relative'].endswith('.js') or
                any(part in ('', '.', '..') for part in f['relative'].split('/'))
                or f['parentPath'] != prefix + f['relative']
                or any(re.fullmatch('[a-f0-9]{64}', f[k]) is None for k in ('parentSha256', 'currentSha256'))
                or f['changed'] is not (key in CHANGED_JS)
                or (f['parentSha256'] != f['currentSha256']) is not f['changed']):
            raise ValueError('Emitted module inventory or delta changed')
        emitted[key] = f
    if {key for key, f in emitted.items() if f['changed']} != CHANGED_JS:
        raise ValueError('Missing emitted overlay')
    for f in p['files']:
        key = (f['package'], f['relative'])
        prior = emitted[key]
        if (key in changed or key not in CHANGED_JS or f['parentPath'] != prior['parentPath']
                or f['parentSha256'] != prior['parentSha256'] or f['emittedSha256'] != prior['currentSha256']
                or f['stagedName'] != key[0] + '-' + Path(key[1]).name):
            raise ValueError('Overlay disagrees with full compiler projection')
        changed[key] = f
    if set(changed) != CHANGED_JS:
        raise ValueError('Wrong overlays')
    return {package: {f['parentPath']: f['emittedSha256'] for f in changed.values()
                     if f['package'] == package} for package in ('core', 'renderer')}


def _network(trace, role, loaded):
    return (trace['schema'] == 'calendar-account-closed-guard/v1' and trace['role'] == role
        and all(trace[k] is True for k in ('started', 'hooksReady', 'compiledFilesVerified', 'finalized', 'cleanExit'))
        and all(_integer(trace[k], 0) for k in ('initialCached', 'attempts', 'finalCached', 'networkAttempts'))
        and trace['networkSurfaces'] == {} and trace['loadedRuntimeFiles'] == loaded
        and trace['fixtureFetchInstalled'] is (role == 'server')
        and (role == 'server' or _integer(trace['fixtureFetchCalls'], 0)))


def _core(trace, role, mode, expected, children):
    return (trace['schema'] == 'person-account-core-guard/v1' and trace['role'] == role
        and trace['mode'] == mode and trace['finalized'] is True
        and trace['verifiedFiles'] == expected
        and trace['loadedRuntimeFiles'] == (expected if role == 'server' else {})
        and _integer(trace['nodeChildrenPreloaded'], children))


def _closed(proof, inputs, modules):
    closed = proof['closedTwelve']
    if (closed['schema'] != 'calendar-account-closed-native-proof/v1' or closed['passed'] is not True
            or closed['qsVersion'] != '6.16.1' or not _integer(closed['fixtureRowsPerResponse'], 1)
            or not all(_integer(closed[k], 0) for k in ('actualAccountActions', 'modelCalls', 'clientMessages'))):
        return False
    runs = closed['runs']
    if ([r['mode'] for r in runs] != ['normal', 'require', 'import', 'preloaded', 'network-controller', 'network-server']
            or any(r['passed'] is not True or r['signal'] is not None for r in runs)):
        return False
    r = runs[0]; native = r['native']; provider = r['provider']
    if (not _integer(r['exitStatus'], 0) or native['schema'] != 'calendar-account-closed-compiled/v1'
            or any(native[k] is not True for k in ('passed', 'mcpClosed', 'workspaceRemoved', 'fakeStorage', 'episodeSelectionValidated'))
            or native['failureStage'] is not None or not _same(native['exactInputs'], inputs)
            or not all(_integer(native[k], 0) for k in ('realAccountActions', 'modelCalls', 'clientMessages'))
            or [x['name'] for x in native['results']] != [x['name'] for x in inputs]
            or any(x['ok'] is not True or x['nativePngDecoded'] is not x['name'].startswith('bangumi.render_') for x in native['results'])
            or not _network(r['controller'], 'controller', {}) or not _network(r['server'], 'server', modules['renderer'])
            or provider['schema'] != 'calendar-account-closed-provider/v1' or provider['privateCacheDisabled'] is not True
            or not all(_integer(provider[k], 0) for k in ('denied', 'assetAttempts', 'cacheWrites'))
            or not _integer(provider['renderCalls'], 5) or not 1 <= len(provider['calls']) <= 64
            or not _integer(r['server']['fixtureFetchCalls'], len(provider['calls']))):
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
    for r in runs[1:]:
        native = r['native']
        if (type(r['exitStatus']) is not int or r['exitStatus'] == 0 or native['passed'] is not False
                or native['workspaceRemoved'] is not True or native['results'] != []):
            return False
        if r['mode'] == 'preloaded':
            if r['server']['initialCached'] < 1 or r['server']['hooksReady'] is not False:
                return False
        elif r['mode'] in ('require', 'import'):
            if r['server']['attempts'] < 1:
                return False
        elif r['mode'] == 'network-controller':
            if r['controller']['networkAttempts'] < 1 or r['server'] is not None:
                return False
        elif r['server']['networkAttempts'] < 1:
            return False
    return all(_core(proof['closedCore'][role], role, 'normal', modules['core'], children)
               for role, children in (('driver', 6), ('controller', 1), ('server', 0)))


def _person(proof, modules):
    person = proof['person']; native = person['native']; provider = person['provider']
    if (native['schema'] != 'person-account-compiled-mcp/v1'
            or any(native[k] is not True for k in ('passed', 'fakeStorage', 'mcpClosed', 'workspaceRemoved'))
            or 'failureStage' in native
            or not all(_integer(native[k], 0) for k in ('realAccountActions', 'modelCalls', 'clientMessages'))
            or tuple(r['case'] for r in native['results']) != PERSON_CASES
            or tuple(r['name'] for r in native['results']) != PERSON_TOOLS
            or any(r['passed'] is not True for r in native['results'])
            or any(not _core(person['coreTraces'][role], role, 'person', modules['core'], children)
                   for role, children in (('controller', 1), ('server', 0)))
            or not _network(person['networkTraces']['controller'], 'controller', {})
            or not _network(person['networkTraces']['server'], 'server', modules['renderer'])
            or provider['schema'] != 'person-account-provider/v1' or provider['privateCacheDisabled'] is not True
            or not all(_integer(provider[k], 0) for k in ('denied', 'assetAttempts', 'cacheWrites'))
            or not _integer(provider['renderCalls'], 1)):
        return False
    expected = [{'kind': 'single', 'step': i} for i in range(3)] + [{'kind': 'persons', 'step': 3}]
    expected += [{'kind': kind, 'step': step} for step in (4, 5) for kind in (
        'subjects', 'characters', 'persons', 'subject-characters', 'subject-persons')]
    expected += [{'kind': 'single', 'step': i} for i in (6, 7)]
    png = native['results'][5]['png']
    return (_same(provider['calls'], expected)
        and _integer(person['networkTraces']['server']['fixtureFetchCalls'], len(expected))
        and png['pixelsDecoded'] is True and png['privateModeVerified'] is True
        and all(type(png[k]) is int and png[k] > 0 for k in ('width', 'height', 'bytes'))
        and png['width'] * png['height'] <= 28800000 and png['bytes'] <= 5242880
        and re.fullmatch('[a-f0-9]{64}', png['sha256']) is not None)


def _proof_matches(proof, inputs):
    try:
        if (proof['schema'] != 'person-account-closed-native-proof/v1'
                or any(proof[k] is not True for k in ('passed', 'closedPassed', 'personPassed',
                    'originalParentPreserved', 'containerRemoved', 'containerReadOnly'))
                or proof['sourceRevision'] != SOURCE_REVISION or proof['parentImageId'] != PARENT
                or proof['containerNetwork'] != 'none' or proof['originalInputsExpanded'] is not False
                or not _same(proof['exactInputs'], inputs)
                or not all(_integer(proof[k], 0) for k in ('realAccountActions', 'modelCalls', 'clientMessages', 'realDataMounts'))
                or not _integer(proof['codeMounts'], 4) or not _integer(proof['qaMounts'], 1)
                or set(proof['producerFiles']) != PROGRAMS):
            return False
        staged = proof['stagedPrograms']
        if (set(staged) != {Path(p).name for p in PROGRAMS if not p.endswith('.py')}
                or any(sha != proof['producerFiles']['scripts/acceptance/' + name] for name, sha in staged.items())):
            return False
        modules = _projection(proof)
        return _closed(proof, inputs, modules) and _person(proof, modules)
    except (KeyError, TypeError, ValueError, AttributeError, IndexError):
        return False


def person_compatible_account_sources(root: Path, catalog: list[dict]) -> dict[str, set[str]]:
    """Only the original twelve scoped observations, or no inherited account credit."""
    root = Path(root)
    try:
        raw = _read(root, REFERENCE)
        if hashlib.sha256(raw).hexdigest() != IMPORT_SHA256:
            return {}
        manifest = json.loads(raw)
        if (manifest['schema'] != 'bgk-person-closed-account-source-compatibility/v1'
                or manifest['kind'] != 'old-execution-with-closed-compiled-source-compatibility'
                or manifest['sourceBasisRevision'] != SOURCE_REVISION
                or manifest['executedBaselineRevision'] != a7.SOURCE_REVISION
                or manifest['parentImageId'] != PARENT or set(manifest['evidenceFiles']) != {'native-proof.json'}):
            return {}
        name = BUNDLE + '/native-proof.json'; raw = _read(root, name)
        if hashlib.sha256(raw).hexdigest() != manifest['evidenceFiles']['native-proof.json']:
            return {}
        if not _fixed(root, {REFERENCE: IMPORT_SHA256, name: hashlib.sha256(raw).hexdigest()}):
            return {}
        proof = json.loads(raw)
        receipts._git(root, 'merge-base', '--is-ancestor', SOURCE_REVISION, 'HEAD')
        inputs, references, protected = _historical(root)
        if (not _same(manifest['admittedTools'], inputs) or manifest['originalReferences'] != references
                or proof['originalReferences'] != references or proof['protectedFiles'] != protected
                or not _proof_matches(proof, inputs) or not _fixed(root, proof['producerFiles'])):
            return {}
        source = proof['source']; sources = source['sources']
        old = json.loads(_read(root, a7.BUNDLE + '/source-files.json'))
        if (len(sources) != 285 or set(sources) != set(old)
                or {n for n in sources if sources[n] != old[n]} != CHANGED_SOURCES
                or source['runtimeTreeSha256'] != manifest['runtimeTreeSha256']):
            return {}
        for name in sources:
            calendar._unalias(root, name)
        for name in shared.RUNTIME_PATHS:
            path = root / name
            if name in ('apps', 'packages'):
                if path.is_symlink() or not path.is_dir():
                    return {}
            elif name not in sources and (path.exists() or path.is_symlink()):
                return {}
        expected = json.loads(receipts._git(root, 'show', a7.SOURCE_REVISION + ':package.json'))
        expected['scripts'].pop('acceptance:check', None)
        for package in (source['rootPackage'], json.loads(receipts._git(root, 'show', 'HEAD:package.json')), json.loads(_read(root, 'package.json'))):
            package = copy.deepcopy(package); package['scripts'].pop('acceptance:check', None)
            if not _same(package, expected):
                return {}
        runtime_package = copy.deepcopy(expected); runtime_package.pop('scripts')
        if not shared._current_sources_match(root, manifest, sources, runtime_package):
            return {}
        if catalog != json.loads(_read(root, 'docs/tool-catalog.json')):
            return {}
        if {t['name'] for t in catalog if t['name'] in TOOLS and t.get('auth') != 'none' and t.get('risk') == 'read'} != TOOLS:
            return {}
        return {name: {ref, REFERENCE} | ({qs55.REFERENCE} if name in qs55.TOOLS else set()) for name, ref in references.items()}
    except (OSError, ValueError, KeyError, TypeError, AttributeError, subprocess.SubprocessError):
        return {}
