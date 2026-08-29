import fs from 'node:fs';

const [tool, ...args] = process.argv.slice(2);
const statePath = process.env.HARNESS_MOCK_STATE;
if (!statePath) throw new Error('HARNESS_MOCK_STATE is required');

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
state.calls ??= [];
state.calls.push({ tool, args });

function save() {
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

function output(value = '') {
  save();
  process.stdout.write(typeof value === 'string' ? value : JSON.stringify(value));
}

function fail(message) {
  save();
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function stdin() {
  return fs.readFileSync(0, 'utf8');
}

function flagValue(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function mockIssue() {
  return {
    number: state.runIssueNumber ?? 1,
    title: state.runIssueTitle ?? 'Mock run',
    body: state.runBody,
    state: state.runIssueState ?? 'OPEN',
    url: 'https://example.test/issues/1',
    createdAt: state.runIssueCreatedAt ?? '2026-08-01T00:00:00.000Z',
    updatedAt: state.runIssueUpdatedAt ?? '2026-08-01T00:00:00.000Z',
    closedAt:
      (state.runIssueState ?? 'OPEN') === 'CLOSED'
        ? (state.runIssueClosedAt ?? '2026-08-01T00:00:00.000Z')
        : null,
  };
}

if (tool === 'gh') {
  const [group, action] = args;
  if (group === '--version') output('gh version mock');
  else if (group === 'auth' && action === 'status') output('authenticated');
  else if (group === 'repo' && action === 'view') output({ nameWithOwner: 'mock/repo' });
  else if (group === 'issue' && action === 'list') {
    const requestedState = flagValue('--state') ?? 'open';
    if (state.issues) {
      output(
        state.issues.filter(
          (issue) => requestedState === 'all' || issue.state.toLowerCase() === requestedState,
        ),
      );
    } else if (requestedState === 'open') {
      output(state.openIssues ?? (state.runIssueState === 'CLOSED' ? [] : [mockIssue()]));
    } else if (requestedState === 'closed') {
      output(state.closedIssues ?? (state.runIssueState === 'CLOSED' ? [mockIssue()] : []));
    } else {
      output(state.runIssueState ? [mockIssue()] : []);
    }
  } else if (group === 'issue' && action === 'create') {
    state.runBody = stdin();
    state.runIssueTitle = flagValue('--title');
    state.runIssueState = 'OPEN';
    state.runIssueNumber ??= 2;
    output(`https://example.test/issues/${state.runIssueNumber}`);
  } else if (group === 'issue' && action === 'view') {
    output({
      number: Number(args[2]),
      title: state.runIssueTitle ?? 'Mock run',
      body: state.runBody,
      state: state.runIssueState ?? 'OPEN',
      url: 'https://example.test/issues/1',
    });
  } else if (group === 'issue' && action === 'edit') {
    state.runBody = stdin();
    output('updated');
  } else if (group === 'issue' && action === 'close') {
    state.runIssueState = 'CLOSED';
    output('closed');
  } else if (group === 'pr' && action === 'view') {
    output({
      number: Number(args[2]),
      title: 'Mock Epoch',
      body: state.prBody,
      state: state.prState ?? 'OPEN',
      isDraft: state.draft ?? false,
      url: 'https://example.test/pull/42',
      headRefName: state.featureBranch,
      headRefOid: state.featureHeadSha,
      baseRefName: state.baseBranch,
      mergeStateStatus: 'CLEAN',
      statusCheckRollup: state.checks ?? [],
      mergeCommit: state.mergeCommit ? { oid: state.mergeCommit } : null,
    });
  } else if (group === 'pr' && action === 'list') {
    output(state.openPrs ?? []);
  } else if (group === 'pr' && action === 'edit') {
    state.prBody = stdin();
    output('updated');
  } else if (group === 'pr' && action === 'ready') {
    state.draft = false;
    output('ready');
  } else if (group === 'pr' && action === 'merge') {
    if (state.mergeAllowed === false) fail('merge permission denied');
    else {
      state.prState = 'MERGED';
      state.mergeCommit = state.mergeSha;
      state.baseSha = state.mergeSha;
      if (state.mergeResponseLostAfterSuccess) fail('GraphQL EOF after merge acceptance');
      else output('merged');
    }
  } else fail(`unsupported gh call: ${args.join(' ')}`);
} else if (tool === 'git') {
  const [command, ...rest] = args;
  if (command === 'status' && rest.some((arg) => arg.startsWith('--porcelain'))) {
    output(state.dirty ?? '');
  } else if (command === 'branch' && rest[0] === '--show-current') output(state.branch);
  else if (command === 'branch' && rest[0] === '--list') {
    output(state.localFeatureExists === false ? '' : `  ${state.featureBranch}`);
  } else if (command === 'branch' && rest[0] === '-d') {
    state.localFeatureExists = false;
    output(`Deleted branch ${rest[1]}`);
  } else if (command === 'rev-parse') {
    const ref = rest[0];
    if (ref === 'HEAD') {
      output(state.branch === state.baseBranch ? state.baseSha : state.featureHeadSha);
    } else if (ref === `origin/${state.baseBranch}`) output(state.baseSha);
    else if (ref === `origin/${state.featureBranch}`) output(state.featureHeadSha);
    else fail(`unknown ref: ${ref}`);
  } else if (command === 'fetch') output();
  else if (command === 'diff' && rest.includes('--name-only')) {
    output((state.changedPaths ?? []).join('\n'));
  } else if (command === 'log') output((state.commitSubjects ?? []).join('\n'));
  else if (command === 'merge-base' && rest[0] === '--is-ancestor') {
    if (state.candidateIsAncestor === false) fail('not ancestor');
    else output();
  } else if (command === 'switch') {
    state.branch = rest[0];
    output(`Switched to ${rest[0]}`);
  } else if (command === 'pull') output('Already up to date');
  else if (command === 'ls-remote') {
    output(
      state.remoteFeatureExists === false
        ? ''
        : `${state.featureHeadSha}\trefs/heads/${state.featureBranch}`,
    );
  } else if (command === 'push' && rest.includes('--delete')) {
    state.remoteFeatureExists = false;
    output('deleted');
  } else if (command === 'push') output('pushed');
  else if (command === 'rev-list') output('1');
  else fail(`unsupported git call: ${args.join(' ')}`);
} else {
  fail(`unsupported tool: ${tool}`);
}
