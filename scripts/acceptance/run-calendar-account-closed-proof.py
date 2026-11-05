"""Fresh fake compiled-MCP witness for twelve bounded historical inputs.

No execution profile, original producer, credentials, product service or real
data is invoked. Two compiled modules are mounted read-only over the retained
native image; baseline compiler output must first match that exact image.
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from acceptance import real_account_a1_evidence as receipts
from acceptance import real_account_a3_evidence as shared
from acceptance import real_account_a7_evidence as a7
from acceptance import qs55_account_compatibility as qs55

PARENT = 'sha256:9c0784bff3ef39fa5c30639f07e3b86b4be634c2cecf854679e9920f9517014a'
BASE = a7.SOURCE_REVISION
SOURCES = {'packages/renderer/src/render-service.ts', 'packages/renderer/src/templates/CalendarCard.tsx'}
PROGRAMS = [
    'calendar-account-closed-controller.mjs', 'calendar-account-closed-driver.mjs',
    'calendar-account-closed-fixture.mjs', 'calendar-account-closed-guard.mjs',
    'calendar-account-closed-preloaded.cjs', 'prepare-calendar-account-compiled.mjs',
    'run-calendar-account-closed-proof.py',
]
INSPECT = r'''const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),m=require('node:module');
const runtime=m.createRequire('/opt/bangumi/package.json'),tools=m.createRequire(runtime.resolve('@bangumi-agent-kit/tools'));
const renderer=tools.resolve('@bangumi-agent-kit/renderer'),base=path.dirname(renderer);
const files=['render-service.js','templates/CalendarCard.js'].map(relative=>{const p=fs.realpathSync(path.join(base,relative));return {relative,path:p,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),bytes:fs.statSync(p).size};});
console.log(JSON.stringify({schema:'calendar-account-parent-runtime/v1',node:process.version,registerHooks:typeof m.registerHooks,files}));'''


def digest(data):
    return hashlib.sha256(data).hexdigest()


def command(*args, timeout=60, check=True, **kwargs):
    return subprocess.run(args, capture_output=True, text=True, check=check,
                          timeout=timeout, **kwargs)


def git(*args):
    return command('git', '-C', str(ROOT), *args).stdout.strip()


def capture_inputs_and_protected():
    """Only sealed tracked evidence and producer bytes, never runtime/account data."""
    for bundle, expected in ((qs55.BUNDLE, qs55.IMPORT_SHA256), (a7.BUNDLE, a7.IMPORT_SHA256)):
        if digest(receipts._read_regular(ROOT, bundle + '/import.json')) != expected:
            raise ValueError('Original import anchor changed')
    protected = json.loads((ROOT / qs55.BUNDLE / 'frozen-files.json').read_bytes())
    if len(protected) != 53:
        raise ValueError('Frozen53 inventory changed')
    inputs, references = [], {}
    for name in sorted(protected):
        if name.endswith('/import.json') and '/run95-a1-' not in name:
            manifest = json.loads((ROOT / name).read_bytes())
            label = Path(name).parent.name.split('-')[1]
            for item in manifest['admittedTools']:
                inputs.append(item)
                references[item['name']] = str(Path(name).parent / (label + '-result.json'))
    for bundle in (qs55.BUNDLE, a7.BUNDLE):
        manifest_name = bundle + '/import.json'
        protected[manifest_name] = digest((ROOT / manifest_name).read_bytes())
        manifest = json.loads((ROOT / manifest_name).read_bytes())
        for name, expected in manifest['evidenceFiles'].items():
            protected[bundle + '/' + name] = expected
        if bundle == a7.BUNDLE:
            inputs.extend(manifest['admittedTools'])
            references[a7.TOOL] = a7.REFERENCE
    proof = json.loads((ROOT / qs55.BUNDLE / 'native-proof.json').read_bytes())
    protected.update(proof['producerFiles'])
    for name in ('scripts/acceptance/qs55_account_compatibility.py', 'scripts/acceptance/real_account_a7_evidence.py', 'scripts/acceptance/native_tim_calendar_evidence.py'):
        protected[name] = digest((ROOT / name).read_bytes())
    if (len(inputs) != 12 or len(references) != 12 or
            set(references) != qs55.TOOLS | {a7.TOOL} or not qs55._fixed_files(ROOT, protected)):
        raise ValueError('Historical input/evidence inventory changed')
    return inputs, references, protected


def source_snapshot():
    git('merge-base', '--is-ancestor', BASE, 'HEAD')
    if any((ROOT / name).is_symlink() or not (ROOT / name).is_dir() for name in ('apps', 'packages')):
        raise ValueError('Runtime root aliases are not admitted')
    tree = git('ls-tree', '-r', 'HEAD', '--', *shared.RUNTIME_PATHS)
    sources = {}
    for line in tree.splitlines():
        metadata, name = line.split('\t', 1)
        mode, kind, blob = metadata.split()
        raw = receipts._read_regular(ROOT, name, shared.MAX_SOURCE_BYTES)
        if mode not in ('100644', '100755') or kind != 'blob' or hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() != blob:
            raise ValueError('Runtime Git/disk drift')
        sources[name] = {'gitBlob': blob, 'sha256': digest(raw)}
    previous = json.loads((ROOT / a7.BUNDLE / 'source-files.json').read_bytes())
    if len(sources) != 285 or set(sources) != set(previous) or {n for n in sources if sources[n] != previous[n]} != SOURCES:
        raise ValueError('Runtime delta exceeds two renderer files')
    historical_package = json.loads(git('show', BASE + ':package.json'))
    historical_package['scripts'].pop('acceptance:check', None)
    disk = json.loads(receipts._read_regular(ROOT, 'package.json'))
    head = json.loads(git('show', 'HEAD:package.json'))
    for value in (disk, head):
        value['scripts'].pop('acceptance:check', None)
        if value != historical_package:
            raise ValueError('Root runtime package drift')
    runtime_package = json.loads(receipts._read_regular(ROOT, 'package.json'))
    runtime_package.pop('scripts')
    manifest = {'runtimeTreeSha256': digest(tree.encode())}
    if not shared._current_sources_match(ROOT, manifest, sources, runtime_package):
        raise ValueError('Dynamic runtime paths changed')
    for name in shared.RUNTIME_PATHS:
        if name not in ('apps', 'packages') and name not in sources and ((ROOT / name).exists() or (ROOT / name).is_symlink()):
            raise ValueError('Absent optional config appeared')
    return {**manifest, 'sources': sources, 'rootPackage': disk}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--prepare-only', action='store_true')
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError('Use a fresh output path')
    if not args.prepare_only and git('status', '--porcelain'):
        raise ValueError('Commit the producer before executing the native witness')
    source = source_snapshot()
    inputs, references, protected = capture_inputs_and_protected()
    revision = git('rev-parse', 'HEAD')
    producer_files = {'scripts/acceptance/' + n: digest(receipts._read_regular(ROOT, 'scripts/acceptance/' + n)) for n in PROGRAMS}
    if not args.prepare_only and not qs55._fixed_files(ROOT, producer_files):
        raise ValueError('Producer Git/disk drift')
    identity = command('docker', 'image', 'inspect', PARENT, '--format', '{{.Id}}').stdout.strip()
    if identity != PARENT:
        raise ValueError('Native parent identity changed')
    parent = json.loads(command('docker', 'run', '--rm', '--pull=never', '--network', 'none', '--read-only', '--memory', '256m', '--pids-limit', '128', '--entrypoint', 'node', PARENT, '-e', INSPECT).stdout)
    if parent['registerHooks'] != 'function':
        raise ValueError('Native module identity hooks unavailable')
    name = 'run95-calendar-account-fake-' + uuid.uuid4().hex[:12]
    with tempfile.TemporaryDirectory(prefix='calendar-account-closed-') as temporary:
        owned = Path(temporary)
        metadata = owned / 'parent.json'; metadata.write_text(json.dumps(parent))
        compiled = owned / 'compiled'
        command('node', str(ROOT / 'scripts/acceptance/prepare-calendar-account-compiled.mjs'), str(compiled), str(metadata), timeout=120)
        projection = json.loads((compiled / 'compiled.json').read_bytes())
        if args.prepare_only:
            result = {'schema': 'calendar-account-closed-preparation/v1', 'prepared': True, 'nativeExecuted': False, 'sourceRevision': git('rev-parse', 'HEAD'), 'projection': projection, 'inputCount': len(inputs), 'protectedFiles': len(protected), 'source': source}
        else:
            qa = owned / 'qa'; qa.mkdir()
            for program in PROGRAMS:
                if program.endswith(('.mjs', '.cjs')):
                    shutil.copyfile(ROOT / 'scripts/acceptance' / program, qa / program)
            (qa / 'inputs.json').write_text(json.dumps(inputs))
            runtime_files = {item['parentPath']: item['emittedSha256'] for item in projection['files']}
            (qa / 'runtime-files.json').write_text(json.dumps(runtime_files))
            mounts = ['--mount', f'type=bind,src={qa},dst=/qa,readonly']
            for item in projection['files']:
                mounts += ['--mount', f"type=bind,src={compiled / item['stagedName']},dst={item['parentPath']},readonly"]
            launched = None
            try:
                launched = command('docker', 'run', '--rm', '--pull=never', '--name', name,
                    '--label', 'io.pariya.calendar-account-fake=' + name,
                    '--network', 'none', '--read-only', '--user', '10001:10001', '--cap-drop', 'ALL',
                    '--security-opt', 'no-new-privileges', '--tmpfs', '/tmp:rw,size=768m,mode=1777',
                    '--shm-size=256m', '--memory=1g', '--pids-limit=512', *mounts,
                    '--entrypoint', 'node', PARENT, '/qa/calendar-account-closed-driver.mjs', timeout=300, check=False)
                result = json.loads(launched.stdout)
            except (subprocess.TimeoutExpired, ValueError):
                result = {'schema': 'calendar-account-closed-native-proof/v1', 'passed': False, 'failureCode': 'NATIVE_TIMEOUT_OR_INVALID_REPORT'}
            finally:
                remaining = command('docker', 'container', 'ls', '-a', '--filter', 'label=io.pariya.calendar-account-fake=' + name, '--filter', 'name=^/' + name + '$', '--format', '{{.ID}}').stdout.strip()
                if remaining:
                    command('docker', 'container', 'rm', '-f', remaining)
            remaining = command('docker', 'container', 'ls', '-a', '--filter', 'name=^/' + name + '$', '--format', '{{.ID}}').stdout.strip()
            parent_preserved = command('docker', 'image', 'inspect', PARENT, '--format', '{{.Id}}').stdout.strip() == PARENT
            if (remaining or not parent_preserved or not qs55._fixed_files(ROOT, protected)
                    or not qs55._fixed_files(ROOT, producer_files) or source != source_snapshot()
                    or git('rev-parse', 'HEAD') != revision):
                raise ValueError('Independent source/protected/cleanup readback failed')
            staged_programs = {p.name: digest(p.read_bytes()) for p in qa.iterdir() if p.suffix in ('.mjs', '.cjs')}
            if any(sha != producer_files['scripts/acceptance/' + name] for name, sha in staged_programs.items()):
                raise ValueError('Staged producer differs from sealed source')
            result.update(sourceRevision=revision, source=source,
                exactInputs=inputs, originalReferences=references, projection=projection,
                parentImageId=PARENT, originalParentPreserved=parent_preserved, containerRemoved=not remaining,
                containerNetwork='none', containerReadOnly=True, realDataMounts=0, codeMounts=2, qaMounts=1,
                protectedFiles=protected,
                producerFiles=producer_files, stagedPrograms=staged_programs)
            result['passed'] = result.get('passed') is True and launched is not None and launched.returncode == 0
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x') as stream:
        stream.write(json.dumps(result, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'preparedOnly': args.prepare_only, 'passed': result.get('passed'), 'nativeExecuted': not args.prepare_only, 'output': str(args.output)}))
    return 0 if args.prepare_only or result.get('passed') is True else 1


if __name__ == '__main__':
    raise SystemExit(main())
