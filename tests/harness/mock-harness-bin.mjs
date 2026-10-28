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
  process.stdout.write(
    typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value),
  );
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
    url: state.runIssueUrl ?? 'https://example.test/issues/1',
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
  else if (group === 'api' && action === 'user') output({ login: 'fixture-operator' });
  else if (group === 'api' && /^repos\/\{owner\}\/\{repo\}\/issues\/comments\/\d+$/u.test(action)) {
    const comment = state.historyComments?.find(value => value.id === Number(action.split('/').at(-1)));
    if (comment) output(comment); else fail('HTTP 404 Not Found');
  } else if (group === 'api' && /^repos\/\{owner\}\/\{repo\}\/issues\/\d+\/comments(?:\?|$)/u.test(action)) {
    state.historyComments ??= [];
    if (flagValue('--method') === 'POST') {
      const { body } = JSON.parse(stdin());
      const comment = { id: state.historyComments.length + 1, body,
        user: { login: 'fixture-operator' }, issue_url: state.historyIssueApiUrl };
      state.historyComments.push(comment);
      if (state.loseHistoryPostResponse) {
        delete state.loseHistoryPostResponse; fail('lost POST response');
      } else output(comment);
    } else {
      const page = Number(new URL('https://mock/' + action).searchParams.get('page') ?? 1);
      output(state.historyComments.slice((page - 1) * 100, page * 100));
    }
  }
  else if (group === 'run' && action === 'view') {
    const run = state.workflowRuns?.[args[2]];
    if (run) output(run);
    else fail('unknown mocked workflow run');
  } else if (
    group === 'api' &&
    action === 'repos/{owner}/{repo}/labels' &&
    flagValue('--method') === 'POST' &&
    flagValue('--input') === '-'
  ) {
    const label = JSON.parse(stdin());
    state.repositoryLabels ??= {};
    if (state.repositoryLabels[label.name])
      fail('HTTP 422 Validation Failed: label already exists');
    else {
      state.repositoryLabels[label.name] = label;
      if (label.name.endsWith('-terminal') && state.concurrentPrBodyOnTerminalLabelCreate) {
        state.prBody = state.concurrentPrBodyOnTerminalLabelCreate;
        delete state.concurrentPrBodyOnTerminalLabelCreate;
      }
      output(label);
    }
  } else if (group === 'api' && /^repos\/\{owner\}\/\{repo\}\/labels\//u.test(action)) {
    const name = decodeURIComponent(action.split('/').at(-1));
    const label = state.repositoryLabels?.[name];
    if (!label) fail('HTTP 404 Not Found');
    else output(label);
  } else if (group === 'label' && action === 'list') {
    output(Object.values(state.repositoryLabels ?? {}));
  } else if (group === 'api' && flagValue('--method') === 'PATCH' && flagValue('--input') === '-') {
    const payload = JSON.parse(stdin());
    if (/^repos\/\{owner\}\/\{repo\}\/issues\/\d+$/u.test(action)) {
      if (state.failIssuePatchAt) {
        state.issuePatchAttempts = (state.issuePatchAttempts ?? 0) + 1;
        if (state.issuePatchAttempts === state.failIssuePatchAt) {
          delete state.failIssuePatchAt;
          fail('simulated issue body update failure');
          process.exit(1);
        }
      }
      state.runBody = payload.body;
      output('updated');
    } else if (/^repos\/\{owner\}\/\{repo\}\/pulls\/\d+$/u.test(action)) {
      if (state.failNextPullRequestPatch === true) {
        state.failNextPullRequestPatch = false;
        fail('simulated pull request body update failure');
        process.exit(1);
      }
      const pullNumber = action.match(/\/(\d+)$/u)?.[1];
      if (state.prs?.[pullNumber]) state.prs[pullNumber].body = payload.body;
      else state.prBody = payload.body;
      output('updated');
    } else fail(`unsupported GitHub API mutation: ${action}`);
  } else if (group === 'issue' && action === 'list') {
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
    if (state.runBodiesByView || state.runStatesByView) {
      state.issueViewCount = (state.issueViewCount ?? 0) + 1;
      state.runBody = state.runBodiesByView?.[state.issueViewCount] ?? state.runBody;
      state.runIssueState = state.runStatesByView?.[state.issueViewCount] ?? state.runIssueState;
    }
    output({
      number: Number(args[2]),
      title: state.runIssueTitle ?? 'Mock run',
      body: state.runBody,
      state: state.runIssueState ?? 'OPEN',
      url: state.runIssueUrl ?? 'https://example.test/issues/1',
    });
  } else if (group === 'issue' && action === 'edit') {
    state.runBody = stdin();
    output('updated');
  } else if (group === 'issue' && action === 'close') {
    state.runIssueState = 'CLOSED';
    output('closed');
  } else if (group === 'pr' && action === 'view') {
    const pullNumber = String(Number(args[2]));
    const pr = state.prs?.[pullNumber];
    output({
      number: Number(pullNumber),
      title: 'Mock Epoch',
      body: pr?.body ?? state.prBody,
      state: pr?.state ?? state.prState ?? 'OPEN',
      isDraft: pr?.draft ?? state.draft ?? false,
      url: 'https://example.test/pull/42',
      headRefName: pr?.headRefName ?? state.featureBranch,
      headRefOid: pr?.headRefOid ?? state.featureHeadSha,
      baseRefName: pr?.baseRefName ?? state.baseBranch,
      baseRefOid: pr?.baseRefOid ?? state.baseSha,
      mergeStateStatus: 'CLEAN',
      statusCheckRollup: pr?.checks ?? state.checks ?? [],
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
    } else if (ref === '--git-common-dir') output(state.gitCommonDirectory ?? '.git');
    else if (ref === `origin/${state.baseBranch}`) output(state.baseSha);
    else if (ref === `origin/${state.featureBranch}`)
      output(state.remoteTrackingFeatureSha ?? state.featureHeadSha);
    else fail(`unknown ref: ${ref}`);
  } else if (command === 'fetch') {
    const refspec = rest.at(-1);
    if (
      refspec === `refs/heads/${state.featureBranch}:refs/remotes/origin/${state.featureBranch}`
    ) {
      state.remoteTrackingFeatureSha = state.featureHeadSha;
    }
    output();
  } else if (command === 'diff' && rest.includes('--name-only')) {
    const range = rest.find((arg) => arg.includes('...'));
    output(
      (range === state.candidateRefreshRange
        ? (state.candidateRefreshPaths ?? [])
        : (state.changedPaths ?? [])
      ).join('\n'),
    );
  } else if (command === 'log') output((state.commitSubjects ?? []).join('\n'));
  else if (command === 'ls-tree') output((state.treePaths ?? []).join('\n'));
  else if (command === 'show' && state.gitObjects?.[rest[0]] !== undefined)
    output(Buffer.from(state.gitObjects[rest[0]], 'base64'));
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
