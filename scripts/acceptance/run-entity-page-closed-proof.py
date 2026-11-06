"""Source-bound fake compiled-MCP proof; never a live account execution profile."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import uuid

if not __debug__:
    raise SystemExit('Compiled-source witness requires assertions enabled.')
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from acceptance import real_account_a1_evidence as receipts
from acceptance import real_account_a3_evidence as shared
from acceptance import real_account_a7_evidence as a7
from acceptance import qs55_account_compatibility as qs55
from acceptance import person_account_compatibility as prior

PARENT = 'sha256:9c0784bff3ef39fa5c30639f07e3b86b4be634c2cecf854679e9920f9517014a'
BASE = a7.SOURCE_REVISION
SOURCES = prior.CHANGED_SOURCES | {
    'packages/bangumi-openapi/src/index.ts', 'packages/bangumi-openapi/src/generated/index.ts',
    'packages/bangumi-openapi/src/native-collection-page-client.ts',
    'packages/tools/src/definitions/read-tools.ts', 'docs/tool-catalog.json'}
ADDED_SOURCE = 'packages/bangumi-openapi/src/native-collection-page-client.ts'
NEW_PROGRAMS = ['prepare-entity-page-compiled.mjs', 'entity-page-source-guard.mjs',
    'entity-page-controller.mjs', 'entity-page-fixture.mjs', 'entity-page-driver.mjs',
    'run-entity-page-closed-proof.py']
spec = importlib.util.spec_from_file_location('frozen_calendar_producer', ROOT / 'scripts/acceptance/run-calendar-account-closed-proof.py')
frozen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(frozen)  # Definitions only; never invokes the frozen producer.
PROGRAMS = sorted(set(NEW_PROGRAMS + frozen.PROGRAMS))
INSPECT = r'''const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),m=require('node:module');
const runtime=m.createRequire('/opt/bangumi/package.json'),tools=m.createRequire(runtime.resolve('@bangumi-agent-kit/tools'));
const files=[];
for(const [name,pkg] of [['core','@bangumi-agent-kit/bangumi-core'],['renderer','@bangumi-agent-kit/renderer'],['openapi','@bangumi-agent-kit/bangumi-openapi'],['tools','@bangumi-agent-kit/tools']]){
 const base=path.dirname(tools.resolve(pkg));
 function walk(dir){for(const d of fs.readdirSync(dir,{withFileTypes:true})){
  const p=path.join(dir,d.name);if(d.isDirectory())walk(p);else if(d.isFile()&&p.endsWith('.js')){
   if(files.length>=512)throw Error('PARENT_FILE_LIMIT');const raw=fs.readFileSync(p);
   files.push({package:name,relative:path.relative(base,p),path:fs.realpathSync(p),sha256:crypto.createHash('sha256').update(raw).digest('hex'),bytes:raw.length});
  }
 }}walk(base);
}
const api=files.find(f=>f.package==='openapi'&&f.relative==='index.js');
const added=path.join(path.dirname(api.path),'native-collection-page-client.js');
if(fs.existsSync(added))throw Error('ECP_PARENT_NEW_MODULE_EXISTS');
console.log(JSON.stringify({schema:'entity-page-parent-runtime/v1',node:process.version,registerHooks:typeof m.registerHooks,files,absentFiles:[{package:'openapi',relative:'native-collection-page-client.js',path:added}]}));'''


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def command(*args, timeout=60, check=True):
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=check)
    if len(result.stdout.encode()) > 8 * 1024 * 1024 or len(result.stderr.encode()) > 1024 * 1024:
        raise ValueError('ECP_PROGRAM_OUTPUT_LIMIT')
    return result


def git(*args):
    return command('git', '-C', str(ROOT), *args).stdout.strip()


def source_snapshot():
    git('merge-base', '--is-ancestor', BASE, 'HEAD')
    for name in ('apps', 'packages'):
        if (ROOT / name).is_symlink() or not (ROOT / name).is_dir():
            raise ValueError('ECP_RUNTIME_ROOT_ALIAS')
    tree = git('ls-tree', '-r', 'HEAD', '--', *shared.RUNTIME_PATHS)
    current = {}
    for line in tree.splitlines():
        metadata, name = line.split('\t', 1)
        mode, kind, blob = metadata.split()
        raw = receipts._read_regular(ROOT, name, shared.MAX_SOURCE_BYTES)
        if mode not in ('100644', '100755') or kind != 'blob' or hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() != blob:
            raise ValueError('ECP_RUNTIME_GIT_DISK_DRIFT')
        current[name] = {'gitBlob': blob, 'sha256': digest(raw)}
    prior = json.loads((ROOT / a7.BUNDLE / 'source-files.json').read_bytes())
    if len(current) != 286 or set(current) != set(prior) | {ADDED_SOURCE} or {name for name in current if current[name] != prior.get(name)} != SOURCES:
        raise ValueError('ECP_RUNTIME_DELTA')
    historical = json.loads(git('show', BASE + ':package.json'))
    historical['scripts'].pop('acceptance:check', None)
    package = json.loads(receipts._read_regular(ROOT, 'package.json'))
    tracked = json.loads(git('show', 'HEAD:package.json'))
    for value in (package, tracked):
        value['scripts'].pop('acceptance:check', None)
        if value != historical:
            raise ValueError('ECP_RUNTIME_PACKAGE_DRIFT')
    root_package = json.loads(receipts._read_regular(ROOT, 'package.json')); root_package.pop('scripts')
    manifest = {'runtimeTreeSha256': digest(tree.encode())}
    if not shared._current_sources_match(ROOT, manifest, current, root_package):
        raise ValueError('ECP_DYNAMIC_RUNTIME_DRIFT')
    for name in shared.RUNTIME_PATHS:
        if name not in ('apps', 'packages') and name not in current and ((ROOT / name).exists() or (ROOT / name).is_symlink()):
            raise ValueError('ECP_ABSENT_CONFIG_APPEARED')
    return {**manifest, 'sources': current, 'rootPackage': package}


def owned_container(image, args, mounts=(), *, memory='1g', timeout=300):
    name = 'run95-entity-page-fake-' + uuid.uuid4().hex[:12]
    cmd = ['docker', 'run', '--rm', '--pull=never', '--name', name, '--network', 'none', '--read-only',
        '--user', '10001:10001', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
        '--tmpfs', '/tmp:rw,size=768m,mode=1777', '--shm-size=256m', '--memory', memory, '--pids-limit', '512']
    for source, target in mounts:
        if any(c in str(source) for c in (',', '\n')):
            raise ValueError('ECP_MOUNT_PATH')
        cmd += ['--mount', f'type=bind,src={source},dst={target},readonly']
    cmd += ['--entrypoint', 'node', image, *args]
    primary, result, removal = None, None, None
    try:
        result = command(*cmd, timeout=timeout, check=False)
    except BaseException as error:
        primary = error
    try:
        command('docker', 'rm', '-f', name, timeout=15, check=False)
    except BaseException as error:
        removal = error
    absent_error = None
    try:
        if command('docker', 'ps', '-aq', '--filter', 'name=^/' + name + '$', timeout=15).stdout.strip():
            raise ValueError('ECP_OWNED_CONTAINER_REMAINS')
    except BaseException as error:
        absent_error = error
    if primary:
        raise primary
    if removal is not None and not isinstance(removal, Exception):
        raise removal
    if absent_error:
        raise absent_error
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--prepare-only', action='store_true')
    args = parser.parse_args()
    if args.output.exists() or args.output.is_symlink():
        raise ValueError('ECP_OUTPUT_ALREADY_EXISTS')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    if not args.prepare_only and git('status', '--porcelain'):
        raise ValueError('ECP_COMMIT_PRODUCER_BEFORE_NATIVE')
    source, revision = source_snapshot(), git('rev-parse', 'HEAD')
    inputs, references, protected = prior._historical(ROOT)
    for file in prior.PROGRAMS | {'scripts/acceptance/person_account_compatibility.py', prior.REFERENCE, prior.BUNDLE + '/native-proof.json'}:
        protected[file] = digest(prior._read(ROOT, file))
    if not qs55._fixed_files(ROOT, protected):
        raise ValueError('ECP_HISTORICAL_BYTES_DRIFT')
    programs = {'scripts/acceptance/' + name: digest(receipts._read_regular(ROOT, 'scripts/acceptance/' + name)) for name in PROGRAMS}
    if command('docker', 'image', 'inspect', PARENT, '--format', '{{.Id}}').stdout.strip() != PARENT:
        raise ValueError('ECP_NATIVE_PARENT_CHANGED')
    parent_run = owned_container(PARENT, ['-e', INSPECT], memory='256m', timeout=30)
    if parent_run.returncode:
        raise ValueError('ECP_PARENT_INSPECTION_FAILED')
    parent = json.loads(parent_run.stdout)
    with tempfile.TemporaryDirectory(prefix='entity-page-compiled-') as temporary:
        owned = Path(temporary); parent_file = owned / 'parent.json'; parent_file.write_text(json.dumps(parent))
        compiled = owned / 'compiled'
        command('node', str(ROOT / 'scripts/acceptance/prepare-entity-page-compiled.mjs'), str(compiled), str(parent_file), timeout=180)
        projection = json.loads((compiled / 'compiled.json').read_bytes())
        if args.prepare_only:
            result = {'schema': 'entity-page-closed-preparation/v1', 'prepared': True,
                'nativeExecuted': False, 'source': source, 'projection': projection,
                'inputCount': len(inputs), 'protectedFiles': len(protected)}
        else:
            if not qs55._fixed_files(ROOT, programs):
                raise ValueError('ECP_PRODUCER_GIT_DISK_DRIFT')
            qa = owned / 'qa'; qa.mkdir()
            for name in PROGRAMS:
                if name.endswith(('.mjs', '.cjs')):
                    (qa / name).write_bytes(receipts._read_regular(ROOT, 'scripts/acceptance/' + name))
            (qa / 'inputs.json').write_text(json.dumps(inputs))
            renderer_files = {file['parentPath']: file['emittedSha256'] for file in projection['files'] if file['package'] == 'renderer'}
            entity_files = {file['parentPath']: file['emittedSha256'] for file in projection['files']}
            (qa / 'runtime-files.json').write_text(json.dumps(renderer_files))
            (qa / 'entity-runtime-files.json').write_text(json.dumps(entity_files))
            mounts = [(qa, '/qa')] + [(compiled / file['stagedName'], file['parentPath']) for file in projection['files']]
            native = owned_container(PARENT, ['/qa/entity-page-driver.mjs'], mounts, timeout=420)
            try:
                result = json.loads(native.stdout)
            except ValueError:
                result = {'schema': 'entity-page-closed-native-proof/v1', 'passed': False,
                    'failureCode': 'NATIVE_ENTRY_OR_INVALID_REPORT', 'nativeExitStatus': native.returncode,
                    'knownErrorCodes': sorted(set(re.findall(r'(?:ECP|C12)_[A-Z_]+', native.stderr)))[:8]}
            if (git('rev-parse', 'HEAD') != revision or source_snapshot() != source
                    or not qs55._fixed_files(ROOT, protected) or not qs55._fixed_files(ROOT, programs)
                    or command('docker', 'image', 'inspect', PARENT, '--format', '{{.Id}}').stdout.strip() != PARENT):
                raise ValueError('ECP_INDEPENDENT_READBACK_FAILED')
            staged = {file.name: digest(file.read_bytes()) for file in qa.iterdir()
                if file.suffix in ('.mjs', '.cjs')}
            if any(value != programs['scripts/acceptance/' + name] for name, value in staged.items()):
                raise ValueError('ECP_STAGED_PRODUCER_DRIFT')
            result.update(sourceRevision=revision, source=source, projection=projection,
                exactInputs=inputs, originalReferences=references, parentImageId=PARENT,
                originalParentPreserved=True, containerRemoved=True, containerNetwork='none',
                containerReadOnly=True, realDataMounts=0, codeMounts=8, qaMounts=1,
                protectedFiles=protected, producerFiles=programs, stagedPrograms=staged)
            result['passed'] = result.get('passed') is True and native.returncode == 0
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x') as stream:
        stream.write(json.dumps(result, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'preparedOnly': args.prepare_only, 'passed': result.get('passed'),
        'nativeExecuted': not args.prepare_only, 'output': str(args.output)}))
    return 0 if args.prepare_only or result.get('passed') is True else 1


if __name__ == '__main__':
    raise SystemExit(main())
