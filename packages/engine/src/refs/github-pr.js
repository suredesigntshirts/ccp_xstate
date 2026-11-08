// The github-pr ref kind: a ref { url, at } to a GitHub pull request at a commit. It counts when GitHub shows the PR
// with its head at `at` and the run's worktree is at that commit too. The host then stamps what it saw: the PR's key,
// its branch (when the head is in the PR's own repository), the commands that check it out, the files it touches
// under .github/ (gates) and whether every check suite at the head is green.
import { prRef } from '../effects/merge.js';
import { said } from '../messages.js';

export const kind = 'github-pr';
/** The fields this kind stamps on a ref, in the order it writes them. */
export const stamps = Object.freeze(['key', 'gates', 'green', 'checkout', 'branch']);
/** The stamped fields an agent is not shown. branch, the PR's branch on GitHub, is shown: a rebuild works on it. */
export const hidden = Object.freeze(['key', 'gates', 'green', 'checkout']);

const FILES_PAGE = 100; // github.files asks for one page of 100
const GREEN = ['success', 'neutral', 'skipped'];

/**
 * Check a ref against GitHub and the run's worktree. `github` is a client from effects/github.js ({ pull, files,
 * suites }); headOf reads a worktree's HEAD. Returns { stamp } (the fields to set, in the order they are set) or
 * { refused } (a catalogue render, messages.js said).
 */
export async function check(ref, { path, github, worktree, headOf }) {
  const pr = prRef(ref.url);
  if (!pr) return { refused: said('ref-no-pr', { path, url: ref.url }) };
  let now;
  try {
    now = await github.pull(pr);
  } catch (error) {
    return { refused: error.status === 404 ? said('ref-no-pr', { path, url: ref.url }) : said('ref-unreadable', { path, url: ref.url, error: String(error.message) }) };
  }
  if (now?.head?.sha !== ref.at) return { refused: said('ref-head', { path, url: ref.url, sha: String(now?.head?.sha ?? 'none'), at: ref.at }) };
  const head = headOf(worktree);
  if (head !== ref.at) return { refused: said('ref-worktree', { path, head, at: ref.at }) };
  const stamp = { key: `${pr.owner}/${pr.repo}#${pr.pullNumber}` };
  // The PR's branch, for a rebuild's worktree: only when the head is in the PR's own
  // repository, since a fork's branch is not on origin. GitHub gives head.repo null when the fork is gone.
  const from = now?.head?.repo;
  const own = from === undefined || (typeof from?.full_name === 'string' && from.full_name.toLowerCase() === `${pr.owner}/${pr.repo}`.toLowerCase());
  if (own && typeof now?.head?.ref === 'string' && now.head.ref) stamp.branch = now.head.ref;
  // The exact commands that put this head in a worktree: host-filled data.
  stamp.checkout = `git fetch origin pull/${pr.pullNumber}/head && git checkout --detach ${ref.at}`;
  // Fails closed: when the files cannot all be listed, the gates are unknown, and an
  // unknown gate is a touched gate, so the person's CI-change card is asked.
  let files = null;
  let unlisted = null;
  try {
    files = await github.files(pr);
  } catch (error) {
    unlisted = `GitHub could not list the PR's files (${error.message})`;
  }
  if (!unlisted && !Array.isArray(files)) unlisted = 'GitHub gave no file list';
  if (!unlisted && files.length >= FILES_PAGE) unlisted = `the PR has ${FILES_PAGE} or more files, more than one page`;
  const gates = unlisted
    ? [`(unknown: ${unlisted})`]
    : files.map((f) => f.filename).filter((f) => typeof f === 'string' && f.startsWith('.github/'));
  if (gates.length) stamp.gates = gates;
  const suites = (await github.suites({ owner: pr.owner, repo: pr.repo, sha: ref.at }))?.check_suites ?? [];
  if (suites.length && suites.every((x) => x.status === 'completed' && GREEN.includes(x.conclusion))) stamp.green = true;
  return { stamp };
}
