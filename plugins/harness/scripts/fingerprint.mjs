// What a session starts with, gathered once at SessionStart: the Claude Code version, the plugin release and where
// it runs from, the settings in force against the repo's, the newest release, and the other plugins loaded.
// Every probe is capped so the hook stays inside its 5 s budget (ledger L-hook-time-budget), and every failure
// becomes a null or an 'unknown', never a throw.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { release, repoDir } from './host.mjs';

export const DEPTH_ENV = 'CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH';
export const TAG_PREFIX = 'harness-v';

const run = (cmd, args, ms) => new Promise((ok) => {
  execFile(cmd, args, { timeout: ms, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    (err, out) => ok(err ? null : out));
});

const readJson = (path) => {
  try {
    return { value: JSON.parse(readFileSync(path, 'utf8')) };
  } catch (error) {
    return { error: error.code === 'ENOENT' ? 'missing' : `unreadable (${error.message})` };
  }
};

/** The `x.y.z` of `claude --version`, or null. */
export async function claudeVersion(ms = 1000) {
  const out = await run('claude', ['--version'], ms);
  return out?.match(/\d+\.\d+\.\d+/)?.[0] ?? null;
}

/**
 * The newest release on the repo's origin, a tag harness-v<x.y.z> or a branch release/harness-v<x.y.z>:
 * { state: 'found', tag, version } (tag is the release's name), { state: 'none' } when origin has no release, or
 * { state: 'unknown' } when origin can't be asked within `ms`.
 */
export async function latestRelease(repo, ms = 2000) {
  const out = await Promise.race([
    run('git', ['-C', repo, 'ls-remote', 'origin', `refs/tags/${TAG_PREFIX}*`, `refs/heads/release/${TAG_PREFIX}*`], ms),
    new Promise((ok) => setTimeout(ok, ms + 100, null).unref())
  ]);
  if (out === null) return { state: 'unknown' };
  const versions = [...out.matchAll(new RegExp(`refs/(?:tags|heads/release)/${TAG_PREFIX}(\\d+\\.\\d+\\.\\d+)$`, 'gm'))].map((m) => m[1]);
  if (!versions.length) return { state: 'none' };
  const newest = versions.sort(byVersion).at(-1);
  return { state: 'found', tag: `${TAG_PREFIX}${newest}`, version: newest };
}

export function byVersion(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

/** The allow rules a settings object holds. */
export const allowRules = (settings) => (Array.isArray(settings?.autoMode?.allow) ? settings.autoMode.allow : []);

/** A short hash of a rule list, independent of order, so two sessions can be compared at a glance. */
export const rulesHash = (rules) =>
  createHash('sha256').update(JSON.stringify(rules.toSorted())).digest('hex').slice(0, 16);

/** The plugins other than the account's synced ones, read from ~/.claude/skills (local disk, one level). */
export function skillsDirPlugins(home) {
  const dir = join(home, '.claude', 'skills');
  const found = [];
  let names = [];
  try {
    names = readdirSync(dir);
  } catch {
    return found;
  }
  for (const name of names.toSorted()) {
    const manifest = readJson(join(dir, name, '.claude-plugin', 'plugin.json')).value;
    if (manifest) found.push({ name: manifest.name ?? name, version: manifest.version ?? null, from: 'skills-dir' });
  }
  return found;
}

/** Whether `child` is `parent` or inside it, by real paths. */
function inside(child, parent) {
  try {
    const c = realpathSync(child), p = realpathSync(parent);
    return c === p || c.startsWith(`${p}/`);
  } catch {
    return false;
  }
}

/** Everything the fingerprint and the self-check need, from the hook's input and the machine. */
export async function collect({ input = {}, env = process.env, root, home = env.HOME || homedir() } = {}) {
  const plugin = release(root);
  const repo = repoDir(env);
  const [claude, latest] = await Promise.all([claudeVersion(), latestRelease(repo)]);
  const user = readJson(join(home, '.claude', 'settings.json'));
  const repoSettings = readJson(join(repo, '.claude', 'settings.json'));
  let link = false;
  try {
    link = lstatSync(plugin.root).isSymbolicLink();
  } catch {}
  return {
    claude,
    model: input.model ?? null,
    start: input.source ?? null,
    cwd: input.cwd ?? process.cwd(),
    home,
    repo,
    plugin,
    pluginIsLink: link,
    pluginInRepo: inside(plugin.root, repo),
    latest,
    user,
    repoSettings,
    plugins: skillsDirPlugins(home),
    environment: {
      remote: env.CLAUDE_CODE_REMOTE ?? null,
      entrypoint: env.CLAUDE_CODE_ENTRYPOINT ?? null,
      container: env.CLAUDE_CODE_CONTAINER_ID ?? null
    }
  };
}

/** The session.fingerprint payload (docs/journal.md). */
export function fingerprint(facts) {
  const rules = allowRules(facts.user.value);
  const { name, version, tag, commit, root } = facts.plugin;
  return {
    claude_code: facts.claude,
    model: facts.model,
    start: facts.start,
    cwd: facts.cwd,
    plugin: { name, version, tag, commit, root },
    latest_release: facts.latest.state === 'found' ? facts.latest.version : facts.latest.state,
    settings: facts.user.value ? 'present' : facts.user.error,
    allow_rules: rules.length,
    rules_hash: rulesHash(rules),
    depth: facts.user.value?.env?.[DEPTH_ENV] ?? null,
    plugins: facts.plugins,
    environment: facts.environment
  };
}
