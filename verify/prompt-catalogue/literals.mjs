// The base commit's template literals (b5613ba, main before this item) for the catalogue entries the hook scenario
// and the direct calls do not reach, copied verbatim from that commit's code, each as a function of the values the
// code gave it; beside each, the entry and the slot values the head's code gives for the same values (read from the
// head's call sites). Values carry <, &, quotes and $ so that any escaping shows.
const v = { run: 'i-1:2.build', agent: 'ag-<1>', call: 'tu-&1', boundCall: 'tu-"2"', path: 'result.pr', url: 'https://github.com/o/r/pull/7', sha: 'a'.repeat(40), at: 'b'.repeat(40), error: 'fetch failed <&> $1', fields: 'key, branch', k: 'issue', where: 'result.issue.title is "x", the input\'s issue.title is "y"', mine: '0.1.27', latest: '0.1.32', tag: 'harness-v0.1.32', root: '/root/.claude/skills/ccp-harness', file: 'lib/engine/messages.md', by: 'scripts/host.mjs', repo: '/home/user/ccp_xstate', detail: 'one. two.' };
const REFUSAL_CAP = 10;
const WANT_DEPTH = 2;

export const LITERALS = [
  ['bind-mismatch', { agent: v.agent, call: v.call, run: v.run, boundCall: v.boundCall }, `bind-mismatch: agent ${v.agent} came from Agent call ${v.call}, but was bound to run ${v.run} of call ${v.boundCall}`],
  ['already-failed-refused', { run: v.run, cap: REFUSAL_CAP }, `run ${v.run} failed: its result was refused ${REFUSAL_CAP} times`],
  ['already-failed-stopped', { run: v.run }, `run ${v.run} failed: its actor stopped without returning`],
  ['cannot-start-already-started', { run: v.run }, `already-started: run ${v.run} already has its Agent call; it can't be failed from here`],
  ['reserved', { path: v.path, fields: v.fields }, `${v.path} sets ${v.fields}: the host sets these from what it sees`],
  ['restated', { field: v.k, differences: v.where }, `result.${v.k} is not the input's ${v.k}: whatever it carries must repeat the input exactly (it may leave out keys its schema does not require): ${v.where}`],
  ['ref-no-pr', { path: v.path, url: v.url }, `${v.path}: ${v.url}: GitHub shows no such PR`],
  ['ref-unreadable', { path: v.path, url: v.url, error: v.error }, `${v.path}: ${v.url}: GitHub could not be read (${v.error})`],
  ['ref-head', { path: v.path, url: v.url, sha: v.sha, at: v.at }, `${v.path}: GitHub shows ${v.url} at ${v.sha}, not ${v.at}`],
  ['ref-head', { path: v.path, url: v.url, sha: 'none', at: v.at }, `${v.path}: GitHub shows ${v.url} at none, not ${v.at}`],
  ['ref-worktree', { path: v.path, head: v.sha, at: v.at }, `${v.path}: your worktree is at ${v.sha}, not ${v.at}`],
  ['ref-page', { path: v.path, url: v.url }, `${v.path}: the page at ${v.url} does not contain the quoted text`],
  ['wrong-caller-unbound', { run: v.run }, `run ${v.run} has no agent bound; only the agent its Agent call started may return`],
  ['no-return', { how: 'SubagentStop' }, `the actor ended (SubagentStop) without returning its result, after being sent back once`],
  ['no-return-after-handback', { how: 'SubagentStop, after a handback' }, `the actor ended (SubagentStop, after a handback) without returning its result`],
  ['inputs-none', {}, '(none)'],
  ['notice-behind', { mine: v.mine, latest: v.latest, tag: v.tag }, `ccp-harness: this session runs release ${v.mine}, but ${v.latest} (${v.tag}) is out. Plugins load only when a session starts, so this session keeps ${v.mine}; finish or hand off the current step, then a new thread runs ${v.latest}.`],
  ['check-settings-pass', {}, '~/.claude/settings.json is present'],
  ['check-settings-fail', { error: 'missing' }, `~/.claude/settings.json is missing, so the setup script did not run in this container; start a new thread to get one that ran it.`],
  ['check-rules-unknown', { repo: v.repo, error: 'unreadable' }, `The repo's settings at ${v.repo}/.claude/settings.json are unreadable, so the allow rules could not be compared.`],
  ['check-rules-pass', { count: 12 }, `all 12 of the repo's allow rules are in force`],
  ['check-rules-fail', { missing: 3, count: 12 }, `3 of the repo's 12 allow rules are not in ~/.claude/settings.json, so auto mode may refuse what they cover; start a new thread after the setup script runs.`],
  ['check-depth-pass', { depth: WANT_DEPTH }, `subagent depth is ${WANT_DEPTH}`],
  ['check-depth-fail', { depth: 'unset (1)', want: WANT_DEPTH }, `Subagent depth is unset (1), not ${WANT_DEPTH}, so subagents can't start their own subagents.`],
  ['check-files-pass', { count: 31 }, `all 31 files the plugin's hooks and skills need are present`],
  ['check-files-item', { file: v.file, by: v.by }, `${v.file} (needed by ${v.by})`],
  ['check-files-fail', { root: v.root, list: `${v.file} (needed by ${v.by}), a.js (needed by b.js)` }, `The plugin at ${v.root} is missing ${v.file} (needed by ${v.by}), a.js (needed by b.js), so part of it can't run; a new thread gets a fresh copy of the release, and if it is missing there too the release itself is broken.`],
  ['check-copy-pass', { root: v.root }, `running the installed copy at ${v.root}`],
  ['check-copy-fail', { root: v.root }, `The plugin runs from ${v.root}, which is not an installed release copy, so edits to the repo could change it under a running session.`],
  ['check-release-unknown', { version: v.mine }, `The newest release could not be read from origin in time, so release ${v.mine} was not compared with it.`],
  ['check-release-none', { version: v.mine, commit: 'unknown' }, `Origin has no harness release yet, so release ${v.mine} (commit unknown) was not compared with one.`],
  ['check-release-contained', { commit: v.sha.slice(0, 12), version: v.mine, tag: v.tag }, `commit ${v.sha.slice(0, 12)} (manifest version ${v.mine}) already contains the newest release, ${v.tag}`],
  ['check-release-uncertain', { commit: 'unknown', version: v.mine, tag: v.tag }, `This session runs commit unknown (manifest version ${v.mine}), not a release, and the clone can't tell whether it contains ${v.tag}.`],
  ['check-release-behind', { version: v.mine, latest: v.latest }, `This session runs release ${v.mine} but ${v.latest} is out, so it runs older code; a new thread will load the newer release.`],
  ['check-release-pass', { version: v.mine, tag: v.tag }, `release ${v.mine} is the newest (${v.tag})`],
  ['check-journal-pass', { path: '/j/sessions/s.jsonl' }, `journalling to /j/sessions/s.jsonl`],
  ['check-journal-fail', { path: '/j/s.jsonl', error: v.error }, `The journal at /j/s.jsonl could not be written (${v.error}), so this session's rows are lost.`],
  ['release-label', { name: 'ccp-harness', version: v.mine, tag: v.tag }, `ccp-harness ${v.mine} (${v.tag})`],
  ['release-label-untagged', { name: 'ccp-harness', version: v.mine }, `ccp-harness ${v.mine}`],
  ['self-check-passed', { release: `ccp-harness ${v.mine}`, passed: 6, total: 7 }, `ccp-harness ${v.mine}: self-check passed (6 of 7 checks).`],
  ['self-check-passed-unchecked', { release: `ccp-harness ${v.mine}`, passed: 6, total: 7, unchecked: v.detail }, `ccp-harness ${v.mine}: self-check passed (6 of 7 checks). Not checked: ${v.detail}`],
  ['self-check-failed', { release: `ccp-harness ${v.mine}`, failed: v.detail }, `ccp-harness ${v.mine}: self-check FAILED. ${v.detail}`],
  ['self-check-missing-file', { root: v.root, file: 'scripts/fingerprint.mjs' }, `ccp-harness: self-check FAILED. The plugin at ${v.root} is missing scripts/fingerprint.mjs, so the session-start self-check could not run; a new thread gets a fresh copy of the release, and if it is missing there too the release itself is broken.`],
  ['self-check-cannot-load', { root: v.root, error: v.error }, `ccp-harness: self-check FAILED. The plugin at ${v.root} could not load its scripts (${v.error}), so the session-start self-check could not run; a new thread gets a fresh copy of the release, and if it is missing there too the release itself is broken.`],
  ['self-check-timeout', {}, 'ccp-harness: the session-start self-check ran out of time, so no fingerprint was journalled for this session.'],
  ['self-check-crashed', { error: v.error }, `ccp-harness: the session-start self-check crashed (${v.error}), so nothing was journalled for this session.`],
  ['bound', { context: 'Run i-1:2.build, worktree /w of /r, branch b.' }, `bound: you are an invoked actor; this call did not run. Read this, then make it again.\nRun i-1:2.build, worktree /w of /r, branch b.`],
  ['waiting', { lines: '- brief for a:0.brief: Agent tool with prompt exactly "ccp-run a:0.brief"' }, `ccp-harness: actor runs prepared and waiting for their agent:\n- brief for a:0.brief: Agent tool with prompt exactly "ccp-run a:0.brief"`]
];
