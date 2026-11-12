"""Strict fixed witness for old twelve reads after bounded native entity pages.

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
from . import person_account_compatibility as prior
from . import real_account_a1_evidence as receipts
from . import real_account_a3_evidence as shared
from . import real_account_a7_evidence as a7
from . import qs55_account_compatibility as qs55

BUNDLE = 'docs/live-probes/run95-entity-page-account-source-compatibility-2026-11-06'
REFERENCE = BUNDLE + '/import-corrected.json'
PROOF_FILE = 'native-proof-corrected.json'
IMPORT_SHA256 = '11b4199ba3806b205b9e96ced944f19f60b947bee58fb39e2813ef0be99b0871'
SOURCE_REVISION = '855ed639905969a5a4369a3a9aec912f45658085'
SERIES_PRESENTER_REFERENCE = 'docs/live-probes/run95-series-presenter-account-compatibility-2026-11-07.json'
SERIES_PRESENTER_RECEIPT_SHA256 = '4bc241e379363bbfece3d018fddcf059f460c974e0de7f8cd0026d33a833ea6e'
SERIES_PRESENTER_PATH = 'apps/mcp/src/result-presenter.ts'
DISCOVERY_DATE_REFERENCE = 'docs/live-probes/run95-discovery-date-account-compatibility-2026-11-08.json'
DISCOVERY_DATE_RECEIPT_SHA256 = 'cc47be13f1e4d1a3c1f7eed1d847611db1ad51c34b7cbc951e43a737283a7310'
DISCOVERY_DATE_PATHS = (
    SERIES_PRESENTER_PATH, 'packages/discovery/src/compiler.ts', 'packages/discovery/src/engine.ts',
)
PARENT = calendar.PARENT
TOOLS = calendar.TOOLS
ADDED_SOURCE = 'packages/bangumi-openapi/src/native-collection-page-client.ts'
CHANGED_SOURCES = prior.CHANGED_SOURCES | frozenset((
    'packages/bangumi-openapi/src/index.ts', 'packages/bangumi-openapi/src/generated/index.ts',
    ADDED_SOURCE, 'packages/tools/src/definitions/read-tools.ts',
    'packages/bangumi-transport/src/http-client.ts', 'docs/tool-catalog.json'))
PROGRAMS = calendar.PROGRAMS | frozenset('scripts/acceptance/' + name for name in (
    'prepare-entity-page-compiled.mjs', 'entity-page-source-guard.mjs',
    'entity-page-controller.mjs', 'entity-page-fixture.mjs',
    'entity-page-driver.mjs', 'run-entity-page-closed-proof.py'))
NATIVE = {
    'core': prior.NATIVE_CORE,
    'transport': '/opt/bangumi/node_modules/.pnpm/@bangumi-agent-kit+bangumi-transport@file+packages+bangumi-transport/node_modules/@bangumi-agent-kit/bangumi-transport/dist/',
    'renderer': calendar.NATIVE_RENDERER,
    'openapi': '/opt/bangumi/node_modules/.pnpm/@bangumi-agent-kit+bangumi-openapi@file+packages+bangumi-openapi/node_modules/@bangumi-agent-kit/bangumi-openapi/dist/',
    'tools': '/opt/bangumi/node_modules/.pnpm/@bangumi-agent-kit+tools@file+packages+tools_@types+better-sqlite3@7.6.13_@types+node@22.20.1_@types+pg@8.20.4/node_modules/@bangumi-agent-kit/tools/dist/',
}
ADDED_JS = ('openapi', 'native-collection-page-client.js')
CHANGED_JS = prior.CHANGED_JS | frozenset((('openapi', 'index.js'), ('openapi', 'generated/index.js'),
    ADDED_JS, ('tools', 'definitions/read-tools.js'), ('transport', 'http-client.js')))
PAGE_CASES = ('bounded-person', 'observed-followup', 'hydration-gap', 'empty-collection', 'empty-page',
    'wrong-echo', 'unavailable', 'too-many-rows', 'oversized-body', 'declared-oversized-body', 'rejecting-stream-cancel')
PAGE_TOOLS = ('bangumi.list_person_collections', 'bangumi.get_person_collection',
    'bangumi.list_character_collections', 'bangumi.list_person_collections', 'bangumi.list_person_collections',
    'bangumi.list_person_collections', 'bangumi.list_character_collections',
    'bangumi.list_person_collections', 'bangumi.list_person_collections',
    'bangumi.list_person_collections', 'bangumi.list_character_collections')
PAGE_INPUTS = ({'maxItems': 1, 'offset': 0}, {'personId': 20}, {'maxItems': 2, 'offset': 1},
    {'maxItems': 1, 'offset': 9}, {'maxItems': 1, 'offset': 1}, *({'maxItems': 1, 'offset': 0},) * 6)
_same = calendar._same_json
_integer = calendar._integer
_read = calendar._read
_fixed = calendar._fixed


def _historical(root):
    inputs, references, protected = prior._historical(root)
    for name in prior.PROGRAMS | {'scripts/acceptance/person_account_compatibility.py',
                                 prior.REFERENCE, prior.BUNDLE + '/native-proof.json'}:
        protected[name] = hashlib.sha256(_read(root, name)).hexdigest()
    protected.update({
        BUNDLE + '/import.json': '2343dc13c760429a77e264b1e9971a39aca2c40f2abf5097c80d1c191ce64fbe',
        BUNDLE + '/native-proof.json': 'c67f1d71e3d43ff83ab050349f3fcec23bfbda5a9e0f839a763244bccab47fa6',
    })
    if len(protected) != 96 or not _fixed(root, protected):
        raise ValueError('Historical producer bytes changed')
    return inputs, references, protected


def _projection(proof):
    p = proof['projection']
    if (p['schema'] != 'entity-page-compiled-projection/v2'
            or p['sourceRevision'] != SOURCE_REVISION or p['baselineRevision'] != a7.SOURCE_REVISION
            or p['typescript'] != '5.9.3' or any(p[k] is not True for k in (
                'parentProjectionExact', 'currentDistExact', 'allOtherEmittedJavaScriptUnchanged', 'newParentModuleAbsent'))
            or set(p['sourceFiles']) != CHANGED_SOURCES - {'docs/tool-catalog.json'}
            or any(sha != proof['source']['sources'][name]['sha256'] for name, sha in p['sourceFiles'].items())
            or len(p['emittedFiles']) != 136 or len(p['files']) != 9):
        raise ValueError('Incomplete full compiler projection')
    emitted, changed = {}, {}
    for f in p['emittedFiles']:
        key = (f['package'], f['relative'])
        is_new = key == ADDED_JS
        if (key in emitted or not f['relative'].endswith('.js') or
                any(part in ('', '.', '..') for part in f['relative'].split('/'))
                or f['parentPath'] != NATIVE[key[0]] + f['relative']
                or re.fullmatch('[a-f0-9]{64}', f['currentSha256']) is None
                or f['added'] is not is_new
                or (is_new and f['parentSha256'] is not None)
                or (not is_new and re.fullmatch('[a-f0-9]{64}', f['parentSha256']) is None)
                or f['changed'] is not (key in CHANGED_JS)
                or (f['parentSha256'] != f['currentSha256']) is not f['changed']):
            raise ValueError('Emitted module inventory or delta changed')
        emitted[key] = f
    if {key for key, f in emitted.items() if f['changed']} != CHANGED_JS:
        raise ValueError('Missing emitted overlay')
    for f in p['files']:
        key = (f['package'], f['relative'])
        item = emitted[key]
        if (key in changed or key not in CHANGED_JS or f['parentPath'] != item['parentPath']
                or f['parentSha256'] != item['parentSha256'] or f['emittedSha256'] != item['currentSha256']
                or f['added'] is not (key == ADDED_JS)
                or f['stagedName'] != key[0] + '--' + key[1].replace('/', '--')):
            raise ValueError('Overlay disagrees with full compiler projection')
        changed[key] = f
    if set(changed) != CHANGED_JS:
        raise ValueError('Wrong overlays')
    modules = {package: {f['parentPath']: f['emittedSha256'] for f in changed.values()
                        if f['package'] == package} for package in NATIVE}
    modules['all'] = {f['parentPath']: f['emittedSha256'] for f in changed.values()}
    return modules


def _network(trace, role, loaded):
    return (trace['schema'] == 'calendar-account-closed-guard/v1' and trace['role'] == role
        and all(trace[k] is True for k in ('started', 'hooksReady', 'compiledFilesVerified', 'finalized', 'cleanExit'))
        and all(_integer(trace[k], 0) for k in ('initialCached', 'attempts', 'finalCached', 'networkAttempts'))
        and trace['networkSurfaces'] == {} and trace['loadedRuntimeFiles'] == loaded
        and trace['fixtureFetchInstalled'] is (role == 'server')
        and (role == 'server' or _integer(trace['fixtureFetchCalls'], 0)))


def _source_trace(trace, role, mode, modules, children):
    loaded = modules['all'] if role == 'server' else modules['openapi'] | modules['transport'] if role == 'controller' else {}
    return (trace['schema'] == 'entity-page-source-guard/v2' and trace['role'] == role
        and trace['mode'] == mode and trace['finalized'] is True
        and trace['verifiedFiles'] == modules['all'] and trace['loadedRuntimeFiles'] == loaded
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
    return all(_source_trace(proof['closedCore'][role], role, 'normal', modules, children)
               for role, children in (('driver', 6), ('controller', 1), ('server', 0)))


def _pages(proof, modules):
    page = proof['page']; native = page['native']; provider = page['provider']
    if (native['schema'] != 'entity-page-compiled-mcp/v2'
            or any(native[k] is not True for k in ('passed', 'fakeStorage', 'mcpClosed', 'workspaceRemoved'))
            or 'failureStage' in native
            or not all(_integer(native[k], 0) for k in ('realAccountActions', 'modelCalls', 'clientMessages'))
            or tuple(r['case'] for r in native['results']) != PAGE_CASES
            or tuple(r['name'] for r in native['results']) != PAGE_TOOLS
            or not _same(tuple(r['input'] for r in native['results']), PAGE_INPUTS)
            or any(r['passed'] is not True for r in native['results'])
            or any(not _source_trace(page['coreTraces'][role], role, 'entity-page', modules, children)
                   for role, children in (('controller', 1), ('server', 0)))
            or not _network(page['networkTraces']['controller'], 'controller', {})
            or not _network(page['networkTraces']['server'], 'server', modules['renderer'])
            or not _integer(page['networkTraces']['server']['fixtureFetchCalls'], 11)
            or provider['schema'] != 'entity-page-provider/v2'
            or not all(_integer(provider[k], 0) for k in ('denied', 'assetAttempts', 'renderCalls'))
            or not _integer(provider['offeredBytes'], 262145) or provider['bodyCancelled'] is not True
            or not _integer(provider['headerBodyCancelled'], 1) or not _integer(provider['rejectingCancelAttempts'], 1)
            or not _same(provider['abortedSteps'], list(range(11)))):
        return False
    expected = [{'kind': 'single', 'step': i} if i == 1 else
        {'kind': 'characters' if i in (2, 6, 10) else 'persons', 'step': i,
         'limit': str(data['maxItems']), 'offset': str(data['offset'])} for i, data in enumerate(PAGE_INPUTS)]
    if not _same(provider['calls'], expected):
        return False
    results = native['results']
    followup = results[1]
    if (not _integer(followup['selectedFromStep'], 0) or not _integer(followup['id'], 20)
            or followup['careerUnknown'] is not True):
        return False
    expected_pages = {
        0: (4, 1, 0, [20], True, 1, None),
        2: (5, 2, 1, [30], True, 3, None),
        3: (0, 1, 9, [], False, None, 'collection_empty'),
        4: (3, 1, 1, [], True, 2, 'page_empty'),
    }
    for i, values in expected_pages.items():
        total, limit, offset, ids, more, next_offset, empty = values
        if not _same(results[i]['page'], dict(total=total, limit=limit, offset=offset, ids=ids,
                hasMore=more, nextOffset=next_offset, empty=empty, stableSnapshot=False, invalidRows=0)):
            return False
    return [r['errorCode'] for r in results[5:]] == ['PARSER_ERROR', 'UPSTREAM_UNAVAILABLE', 'PARSER_ERROR', 'RESPONSE_TOO_LARGE', 'RESPONSE_TOO_LARGE', 'RESPONSE_TOO_LARGE']


def _proof_matches(proof, inputs):
    try:
        if (proof['schema'] != 'entity-page-closed-native-proof/v2'
                or any(proof[k] is not True for k in ('passed', 'closedPassed', 'pagePassed',
                    'originalParentPreserved', 'firstCandidateWitnessPreserved', 'containerRemoved', 'containerReadOnly'))
                or proof['sourceRevision'] != SOURCE_REVISION or proof['parentImageId'] != PARENT
                or proof['containerNetwork'] != 'none' or proof['originalInputsExpanded'] is not False
                or not _same(proof['exactInputs'], inputs)
                or not all(_integer(proof[k], 0) for k in ('realAccountActions', 'modelCalls', 'clientMessages', 'realDataMounts'))
                or not _integer(proof['codeMounts'], 9) or not _integer(proof['qaMounts'], 1)
                or set(proof['producerFiles']) != PROGRAMS):
            return False
        staged = proof['stagedPrograms']
        if (set(staged) != {Path(p).name for p in PROGRAMS if not p.endswith('.py')}
                or any(sha != proof['producerFiles']['scripts/acceptance/' + name] for name, sha in staged.items())):
            return False
        modules = _projection(proof)
        return _closed(proof, inputs, modules) and _pages(proof, modules)
    except (KeyError, TypeError, ValueError, AttributeError, IndexError):
        return False


def _discovery_date_source_matches(root, manifest, sources, runtime_package, inventory_sha):
    raw = _read(root, DISCOVERY_DATE_REFERENCE, 4096)
    if (hashlib.sha256(raw).hexdigest() != DISCOVERY_DATE_RECEIPT_SHA256
            or not _fixed(root, {DISCOVERY_DATE_REFERENCE: DISCOVERY_DATE_RECEIPT_SHA256})):
        return False
    successor = json.loads(raw)
    base, fix = successor['baseRevision'], successor['fixRevision']
    comparison = successor['compiledComparison']
    changed = successor['changedSources']
    if (successor['schema'] != 'bgk-discovery-date-account-compatibility/v1'
            or successor['priorSeriesReceiptSha256'] != SERIES_PRESENTER_RECEIPT_SHA256
            or successor['priorRuntimeTreeSha256'] != manifest['runtimeTreeSha256']
            or successor['compiledInventorySha256'] != inventory_sha
            or successor['compiledModules'] != 136
            or successor['accountEvidenceAdded'] != 0
            or set(changed) != set(DISCOVERY_DATE_PATHS)
            or comparison['base'] != base or comparison['source'] != fix
            or comparison['sealedUnchanged'] != 136
            or set(comparison['changed']) != {
                'apps/mcp/dist/result-presenter.js', 'packages/discovery/dist/compiler.js',
                'packages/discovery/dist/engine.js'}):
        return False
    receipts._git(root, 'merge-base', '--is-ancestor', base, fix)
    receipts._git(root, 'merge-base', '--is-ancestor', fix, 'HEAD')
    if tuple(receipts._git(root, 'diff', '--name-only', base, fix, '--', *shared.RUNTIME_PATHS).splitlines()) != DISCOVERY_DATE_PATHS:
        return False
    base_tree = receipts._git(root, 'ls-tree', '-r', base, '--', *shared.RUNTIME_PATHS).strip()
    if hashlib.sha256(base_tree.encode()).hexdigest() != manifest['runtimeTreeSha256']:
        return False
    return shared._current_sources_match(
        root, {**manifest, 'runtimeTreeSha256': successor['currentRuntimeTreeSha256']},
        {**sources, **changed}, runtime_package,
    )


def _successor_source_references(root, manifest, sources, runtime_package, projection):
    """Apply the existing seal through the two exact runtime successors."""
    raw = _read(root, SERIES_PRESENTER_REFERENCE, 4096)
    if (hashlib.sha256(raw).hexdigest() != SERIES_PRESENTER_RECEIPT_SHA256
            or not _fixed(root, {SERIES_PRESENTER_REFERENCE: SERIES_PRESENTER_RECEIPT_SHA256})):
        return set()
    successor = json.loads(raw)
    modules = projection['emittedFiles']
    inventory = json.dumps(modules, sort_keys=True, separators=(',', ':')).encode()
    inventory_sha = hashlib.sha256(inventory).hexdigest()
    if (successor['schema'] != 'bgk-series-presenter-account-compatibility/v1'
            or successor['presenterPath'] != SERIES_PRESENTER_PATH
            or successor['priorProofSha256'] != manifest['evidenceFiles'][PROOF_FILE]
            or successor['priorRuntimeTreeSha256'] != manifest['runtimeTreeSha256']
            or successor['priorPresenter'] != sources[SERIES_PRESENTER_PATH]
            or successor['compiledModules'] != len(modules)
            or successor['compiledInventorySha256'] != inventory_sha
            or successor['accountEvidenceAdded'] != 0):
        return set()
    base, fix = successor['baseRevision'], successor['fixRevision']
    receipts._git(root, 'merge-base', '--is-ancestor', base, fix)
    receipts._git(root, 'merge-base', '--is-ancestor', fix, 'HEAD')
    if receipts._git(root, 'diff', '--name-only', base, fix, '--', *shared.RUNTIME_PATHS).splitlines() != [
            SERIES_PRESENTER_PATH]:
        return set()
    base_tree = receipts._git(root, 'ls-tree', '-r', base, '--', *shared.RUNTIME_PATHS).strip()
    if hashlib.sha256(base_tree.encode()).hexdigest() != manifest['runtimeTreeSha256']:
        return set()
    manifest = {**manifest, 'runtimeTreeSha256': successor['currentRuntimeTreeSha256']}
    sources = {**sources, SERIES_PRESENTER_PATH: successor['currentPresenter']}
    if shared._current_sources_match(root, manifest, sources, runtime_package):
        return {SERIES_PRESENTER_REFERENCE}
    if _discovery_date_source_matches(root, manifest, sources, runtime_package, inventory_sha):
        return {SERIES_PRESENTER_REFERENCE, DISCOVERY_DATE_REFERENCE}
    return set()


def entity_page_compatible_account_sources(root: Path, catalog: list[dict]) -> dict[str, set[str]]:
    """Only the original twelve scoped observations, or no inherited account credit."""
    root = Path(root)
    try:
        raw = _read(root, REFERENCE)
        if hashlib.sha256(raw).hexdigest() != IMPORT_SHA256:
            return {}
        manifest = json.loads(raw)
        if (manifest['schema'] != 'bgk-entity-page-closed-account-source-compatibility/v2'
                or manifest['kind'] != 'old-execution-with-closed-compiled-source-compatibility'
                or manifest['sourceBasisRevision'] != SOURCE_REVISION
                or manifest['executedBaselineRevision'] != a7.SOURCE_REVISION
                or manifest['parentImageId'] != PARENT or set(manifest['evidenceFiles']) != {PROOF_FILE}):
            return {}
        name = BUNDLE + '/' + PROOF_FILE; raw = _read(root, name)
        if hashlib.sha256(raw).hexdigest() != manifest['evidenceFiles'][PROOF_FILE]:
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
        if (len(sources) != 286 or set(sources) != set(old) | {ADDED_SOURCE}
                or {n for n in sources if sources[n] != old.get(n)} != CHANGED_SOURCES
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
        compatibility = {REFERENCE}
        if not shared._current_sources_match(root, manifest, sources, runtime_package):
            successors = _successor_source_references(root, manifest, sources, runtime_package, proof['projection'])
            if not successors:
                return {}
            compatibility.update(successors)
        if catalog != json.loads(_read(root, 'docs/tool-catalog.json')):
            return {}
        if {t['name'] for t in catalog if t['name'] in TOOLS and t.get('auth') != 'none' and t.get('risk') == 'read'} != TOOLS:
            return {}
        return {name: {ref} | compatibility | ({qs55.REFERENCE} if name in qs55.TOOLS else set())
                for name, ref in references.items()}
    except (OSError, ValueError, KeyError, TypeError, AttributeError, subprocess.SubprocessError):
        return {}
