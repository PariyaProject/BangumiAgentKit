"""Reproduce qs55 native compatibility QA; no real data or external network.

Requires the locally retained parent image and a previously downloaded official
tarball. Output is a sanitized operator observation, not an execution signature.
"""
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[2]
PARENT = 'pariya-agent/agy-bangumi-standard-full:2ec9b165-security-qa'
PARENT_ID = 'sha256:cbd0f4c2b5b28c70295cf35211474c8898cbf33b143be8e8351554e91f010083'
OLD_SOURCE = '2ec9b165900f538aeafd3ce897528b58d759f31b'
CONTRACT = ROOT / 'docs/research/run95-qs55-security-compatibility-contract-2026-10-28'
INTEGRITY = 'sha512-5Px6J7rfHBAGUhNQ3es4YzcOdBBw0SDcVtThJml4RdnKw4tKs2epA0kPZ+K8X+WiHktT93RHVcQ/3ym5aTCgtg=='
PROGRAMS = {'qs55-controller.mjs': 'controller.mjs', 'qs55-driver.mjs': 'driver.mjs',
            'qs55-fixture.mjs': 'fixture.mjs', 'qs55-preloaded.cjs': 'preloaded.cjs',
            'qs55-trace.mjs': 'trace.mjs'}


def command(*args, **kwargs):
    return subprocess.run(args, check=True, capture_output=True, text=True,
                          timeout=kwargs.pop('timeout', 60), **kwargs).stdout.strip()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--tarball', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError('Use a new owned output path; no observations are overwritten')
    data = args.tarball.read_bytes()
    if len(data) > 2 * 1024 * 1024 or 'sha512-' + base64.b64encode(hashlib.sha512(data).digest()).decode() != INTEGRITY:
        raise ValueError('Official artifact integrity mismatch')
    if command('docker', 'image', 'inspect', PARENT, '--format', '{{.Id}}') != PARENT_ID:
        raise ValueError('Original QA parent image drift')
    revision = command('git', 'rev-parse', 'HEAD', cwd=ROOT)
    frozen = json.loads((CONTRACT / 'frozen-a1-a6-files.json').read_text())
    if len(frozen) != 53 or any(digest((ROOT / p).read_bytes()) != h for p, h in frozen.items()):
        raise ValueError('Frozen A1-A6 bytes changed')
    # A runtime replacement cannot smuggle another graph into the old image.
    old_lock = subprocess.check_output(['git', 'show', OLD_SOURCE + ':pnpm-lock.yaml'], cwd=ROOT)
    old_integrity = json.loads((CONTRACT / 'artifact-6.16.0.json').read_text())['integrity']
    if (ROOT / 'pnpm-lock.yaml').read_bytes() != old_lock.replace(b'6.16.0', b'6.16.1').replace(old_integrity.encode(), INTEGRITY.encode()):
        raise ValueError('Lock has changes beyond the exact qs patch')
    inputs = []
    for bundle in (ROOT / p for p in sorted(frozen) if p.endswith('/import.json')):
        if 'run95-a1-' not in str(bundle):
            inputs.extend(json.loads(bundle.read_text())['admittedTools'])
    if len(inputs) != 11 or len({t['name'] for t in inputs}) != 11:
        raise ValueError('Closed old input inventory changed')
    image = 'pariya-agent/qs55-isolated-qa:' + revision[:12]
    container = 'run95-qs55-fake-' + uuid.uuid4().hex[:12]
    with tempfile.TemporaryDirectory(prefix='qs55-fake-qa-') as temp:
        owned = Path(temp); context = owned / 'image'; context.mkdir(); qa = owned / 'qa'; qa.mkdir()
        manifest = json.loads((CONTRACT / 'artifact-6.16.1.json').read_text())
        extracted = set()
        with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
            for item in archive:
                parts = Path(item.name).parts
                if not parts or parts[0] != 'package' or '..' in parts or item.issym() or item.islnk():
                    raise ValueError('Invalid artifact path')
                if item.isdir():
                    continue
                name = '/'.join(parts[1:])
                if not item.isfile() or name not in manifest['files'] or name in extracted or item.size > 1024 * 1024:
                    raise ValueError('Unexpected artifact member')
                payload = archive.extractfile(item).read()
                if digest(payload) != manifest['files'][name]:
                    raise ValueError('Artifact member digest mismatch')
                target = context / 'payload' / name; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(payload)
                extracted.add(name)
        if extracted != set(manifest['files']):
            raise ValueError('Missing published file')
        for name in ('artifact-6.16.0.json', 'artifact-6.16.1.json'):
            shutil.copyfile(CONTRACT / name, context / name)
        shutil.copyfile(ROOT / 'scripts/acceptance/qs55-image-overlay.mjs', context / 'overlay.mjs')
        dockerfile = f'''FROM {PARENT}
USER root
COPY . /patch/
RUN node /patch/overlay.mjs && rm -rf /patch
LABEL org.opencontainers.image.revision="{revision}" io.pariya.qa-only="qs55" io.pariya.compiled-parent-revision="{OLD_SOURCE}"
'''
        (context / 'Dockerfile').write_text(dockerfile)
        command('docker', 'build', '--network', 'none', '--pull=false', '-t', image, str(context), timeout=120)
        before_image = json.loads(command('docker', 'image', 'inspect', image))[0]
        for source, target in PROGRAMS.items():
            shutil.copyfile(ROOT / 'scripts/acceptance' / source, qa / target)
        (qa / 'inputs.json').write_text(json.dumps(inputs, sort_keys=True, indent=2) + '\n')
        try:
            output = command('docker', 'run', '--rm', '--name', container, '--network', 'none', '--read-only',
                             '--label', 'io.pariya.qs55-fake=' + container,
                             '--tmpfs', '/tmp:rw,size=512m,mode=1777', '--shm-size=256m', '--memory=1g', '--pids-limit=512',
                             '--mount', f'type=bind,src={qa},dst=/qa,readonly', '--entrypoint', 'node', before_image['Id'],
                             '/qa/driver.mjs', timeout=300)
        finally:
            remaining = command('docker', 'container', 'ls', '-a', '--filter', 'label=io.pariya.qs55-fake=' + container,
                                '--filter', 'name=^/' + container + '$', '--format', '{{.ID}}')
            if remaining:
                command('docker', 'container', 'rm', '-f', remaining)
        result = json.loads(output)
        if result.get('passed') is not True:
            raise ValueError('Native proof failed')
        # Independent readback, not the controller's cleanup boolean alone.
        remaining = command('docker', 'container', 'ls', '-a', '--filter', 'name=^/' + container + '$', '--format', '{{.ID}}')
        if remaining or command('docker', 'image', 'inspect', PARENT, '--format', '{{.Id}}') != PARENT_ID:
            raise ValueError('Container cleanup or original parent drift')
        producer_names = [*PROGRAMS, 'qs55-image-overlay.mjs', 'run-qs55-isolated-proof.py']
        result.update(sourceBasisRevision=revision, compiledParentRevision=OLD_SOURCE, parentImageId=PARENT_ID,
                      patchedImageId=before_image['Id'], dockerfileSha256=digest(dockerfile.encode()),
                      originalParentPreserved=True, containerRemoved=True,
                      producerFiles={'scripts/acceptance/' + n: digest((ROOT / 'scripts/acceptance' / n).read_bytes()) for n in producer_names},
                      generatedPrograms={p.name: digest(p.read_bytes()) for p in sorted(qa.iterdir())})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x') as stream:
        stream.write(json.dumps(result, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'passed': True, 'tools': 11, 'nativePngs': 5, 'forcedChildLoadControls': 3,
                      'realAccountActions': 0, 'output': str(args.output)}))


if __name__ == '__main__':
    main()
