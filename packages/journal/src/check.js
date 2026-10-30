// The journal check (plan item obs-journal-vs-world): compares the journal with facts from outside it, a session's
// own event log and GitHub's merged PRs, and lists what doesn't match. It reads what it is given and writes nothing;
// bin/journal-check.js fetches, prints and records the check row. docs/journal.md, "The journal check", says how.

// A tool_result that Claude Code wrote without running the tool (a blocked or malformed call). No hook fires for
// these, so no capture can journal them (seen 2026-10-30, verify/obs-live-capture: "Blocked: standalone sleep").
const NOT_RUN = /^\s*<tool_use_error>/;

const textOf = (content) =>
  typeof content === 'string' ? content
    : Array.isArray(content) ? content.map((c) => (typeof c === 'string' ? c : c?.text ?? '')).join('\n') : '';

// The message inside one event, for both shapes: a Claude Code transcript line ({ type, message, timestamp }) and a
// list_events event ({ created_at, assistant|user: { internal_anthropic_catchall: { message, timestamp } } }).
function unwrap(event) {
  for (const role of ['assistant', 'user']) {
    const inner = event?.[role]?.internal_anthropic_catchall ?? event?.[role];
    if (inner?.message) return { message: inner.message, at: inner.timestamp ?? event.created_at ?? null, meta: inner };
  }
  if (event?.message) return { message: event.message, at: event.timestamp ?? null, meta: event };
  return null;
}

/**
 * The events in a text: JSONL of transcript lines or list_events events, or JSON of one list_events page
 * ({ data } or { ccr: { data } }), an array of pages, or an array of events. Unreadable lines are counted.
 */
export function parseEvents(text) {
  const out = { events: [], bad: 0 };
  const take = (value) => {
    if (Array.isArray(value)) return value.forEach(take);
    const page = value?.ccr ?? value;
    if (Array.isArray(page?.data)) return page.data.forEach(take);
    if (value && typeof value === 'object') out.events.push(value);
  };
  const trimmed = text.trim();
  if (!trimmed) return out;
  try {
    take(JSON.parse(trimmed));
    return out;
  } catch {
    // Not one JSON value: read it as JSONL.
  }
  for (const line of trimmed.split('\n')) {
    if (!line.trim()) continue;
    try {
      take(JSON.parse(line));
    } catch {
      out.bad++;
    }
  }
  return out;
}

/**
 * Every tool call an event log shows, keyed by tool use id: { id, tool, at, result } where result is 'ran' (a
 * tool_result came back from running it), 'not-run' (Claude Code answered without running it) or 'pending' (no
 * result yet, such as the call running this check).
 */
export function toolUses(events) {
  const calls = new Map();
  const results = new Map();
  for (const event of events) {
    const got = unwrap(event);
    const content = got?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type === 'tool_use' && typeof block.id === 'string' && !calls.has(block.id)) {
        calls.set(block.id, { id: block.id, tool: block.name ?? null, at: got.at });
      } else if (block?.type === 'tool_result' && typeof block.tool_use_id === 'string') {
        results.set(block.tool_use_id, NOT_RUN.test(textOf(block.content)) ? 'not-run' : 'ran');
      }
    }
  }
  for (const call of calls.values()) call.result = results.get(call.id) ?? 'pending';
  return calls;
}

const time = (at) => (at ? Date.parse(at) : NaN);

/**
 * The session diff. `rows` are the session's journal rows, `events` its event log. Returns the calls that ran with
 * no tool.call row (missing), the calls no hook could see (notRun) or that hadn't finished (pending), and the
 * tool.call rows inside the log's time span whose tool use id the log doesn't have (unfound). Rows outside the span
 * are counted, not judged: a paged log may not reach them.
 */
export function checkSession({ rows, events, slackMs = 5000 }) {
  const calls = toolUses(events);
  const toolRows = rows.filter((r) => r.kind === 'tool.call');
  const journalled = new Set(toolRows.map((r) => r.source.ref));
  const times = [...calls.values()].map((c) => time(c.at)).filter(Number.isFinite);
  const from = times.length ? Math.min(...times) - slackMs : -Infinity;
  const to = times.length ? Math.max(...times) + slackMs : Infinity;
  const missing = [], notRun = [], pending = [];
  for (const call of calls.values()) {
    if (journalled.has(call.id)) continue;
    (call.result === 'ran' ? missing : call.result === 'not-run' ? notRun : pending).push(call);
  }
  const unfound = [];
  let outside = 0;
  for (const row of toolRows) {
    if (calls.has(row.source.ref)) continue;
    const at = time(row.at);
    if (at < from || at > to) outside++;
    else unfound.push({ id: row.id, ref: row.source.ref, tool: row.payload?.tool ?? null, at: row.at });
  }
  return { calls: calls.size, rows: toolRows.length, missing, notRun, pending, unfound, outside };
}

/** A PR as the check uses it, from a GitHub REST pull request object. */
export const prOf = (repo, pr) => ({
  repo,
  number: pr.number,
  title: pr.title ?? null,
  mergedAt: pr.merged_at ?? null,
  head: pr.head?.sha ?? null,
  sha: pr.merge_commit_sha ?? null,
  url: pr.html_url ?? null,
});

/** The pr.merge rows' key: owner/repo#number. */
export const mergeKey = (repo, number) => `${String(repo).toLowerCase()}#${number}`;

/**
 * The merge diff. `prs` are the closed PRs GitHub returned for `repos`, as prOf() makes them; `rows` the journal
 * rows. A merge is explained by a pr.merge row naming its repo and number. Returns the merges since `since` with no
 * such row (unexplained), and the pr.merge rows since `since` for those repos that GitHub doesn't show as merged, or
 * shows merged at another sha (unfound).
 */
export function checkMerges({ rows, prs, repos, since = null }) {
  const after = (at) => !since || time(at) >= time(since);
  const watched = new Set(repos.map((r) => r.toLowerCase()));
  const mergeRows = rows.filter((r) => r.kind === 'pr.merge' && watched.has(String(r.payload?.repo).toLowerCase()));
  const byKey = new Map(mergeRows.map((r) => [mergeKey(r.payload.repo, r.payload.number), r]));
  const merged = prs.filter((p) => p.mergedAt && after(p.mergedAt));
  const unexplained = merged.filter((p) => !byKey.has(mergeKey(p.repo, p.number)));
  const onGitHub = new Map(prs.filter((p) => p.mergedAt).map((p) => [mergeKey(p.repo, p.number), p]));
  const unfound = [];
  for (const row of mergeRows) {
    if (!after(row.at)) continue;
    const pr = onGitHub.get(mergeKey(row.payload.repo, row.payload.number));
    const ref = `${row.payload.repo}#${row.payload.number}`;
    if (!pr) unfound.push({ id: row.id, ref, at: row.at, why: 'GitHub shows no merge of this PR' });
    else if (row.payload.sha && pr.sha && row.payload.sha !== pr.sha) {
      unfound.push({ id: row.id, ref, at: row.at, why: `GitHub merged it as ${pr.sha}, the row says ${row.payload.sha}` });
    }
  }
  return { merges: merged.length, rows: mergeRows.length, unexplained, unfound };
}

/** The counts a journal.check row carries. */
export function counts({ session, merges }) {
  return {
    ...(session && {
      calls: session.calls,
      callRows: session.rows,
      missing: session.missing.length,
      notRun: session.notRun.length,
      pending: session.pending.length,
      unfoundCalls: session.unfound.length,
      outside: session.outside,
    }),
    ...(merges && {
      merges: merges.merges,
      mergeRows: merges.rows,
      unexplained: merges.unexplained.length,
      unfoundMerges: merges.unfound.length,
    }),
  };
}

/** True when the check found nothing missing or unexplained. Calls no hook could see don't count against it. */
export const clean = ({ session, merges, bad = [] }) =>
  !bad.length && !session?.missing.length && !session?.unfound.length && !merges?.unexplained.length && !merges?.unfound.length;

/** The report as plain lines. */
export function report({ session, merges, bad = [] }) {
  const out = [];
  if (session) {
    out.push(`Session: ${session.calls} tool calls in the event log, ${session.rows} tool.call rows in the journal.`);
    out.push(`  ${session.missing.length} missing from the journal${session.missing.length ? ':' : '.'}`);
    for (const c of session.missing) out.push(`    ${c.id}  ${c.tool}  ${c.at ?? ''}`);
    out.push(`  ${session.unfound.length} rows whose call the event log doesn't have${session.unfound.length ? ':' : '.'}`);
    for (const r of session.unfound) out.push(`    row ${r.id}  ${r.ref}  ${r.tool}  ${r.at}`);
    if (session.notRun.length) {
      out.push(`  ${session.notRun.length} calls Claude Code answered without running, which no hook sees (not counted):`);
      for (const c of session.notRun) out.push(`    ${c.id}  ${c.tool}`);
    }
    if (session.pending.length) out.push(`  ${session.pending.length} calls with no result yet (not counted): ${session.pending.map((c) => c.id).join(', ')}`);
    if (session.outside) out.push(`  ${session.outside} tool.call rows fall outside the event log's time span (not judged).`);
  }
  if (merges) {
    out.push(`GitHub: ${merges.merges} merged PRs, ${merges.rows} pr.merge rows.`);
    out.push(`  ${merges.unexplained.length} merges with no journal row${merges.unexplained.length ? ':' : '.'}`);
    for (const p of merges.unexplained) out.push(`    ${p.repo}#${p.number}  merged ${p.mergedAt}  head ${p.head}  merge ${p.sha}  ${p.title ?? ''}`);
    out.push(`  ${merges.unfound.length} pr.merge rows GitHub doesn't bear out${merges.unfound.length ? ':' : '.'}`);
    for (const r of merges.unfound) out.push(`    row ${r.id}  ${r.ref}  ${r.why}`);
  }
  if (bad.length) {
    out.push(`${bad.length} journal lines couldn't be read:`);
    for (const b of bad) out.push(`    ${b.path}:${b.line}  ${b.reason}`);
  }
  return out;
}
