// The start-of-session self-check: is this session running what the setup script should have given it? Each check
// is pure over the facts fingerprint.mjs collected, and says what is wrong in one plain sentence, so a thread knows
// at once to label its results or ask for a new thread (plan/decisions/2026-10-30-setup-script-vs-sessionstart.md).
// It only checks. It never writes settings: a session placing its own rules is what L-rules-before-session warns of.
import { DEPTH_ENV, allowRules, byVersion } from './fingerprint.mjs';
import { messages } from './host.mjs';

// Every sentence is an entry of the message catalogue; a check gives its values.
const { render } = await messages();

export const WANT_DEPTH = '3';

const pass = (id, detail) => ({ id, status: 'pass', detail });
const fail = (id, sentence) => ({ id, status: 'fail', detail: sentence });
const unknown = (id, sentence) => ({ id, status: 'unknown', detail: sentence });

export const CHECKS = {
  settings(f) {
    if (f.user.value) return pass('settings', render('check-settings-pass'));
    return fail('settings', render('check-settings-fail', { error: String(f.user.error) }));
  },

  rules(f) {
    if (!f.repoSettings.value) return unknown('rules', render('check-rules-unknown', { repo: String(f.repo), error: String(f.repoSettings.error) }));
    const want = allowRules(f.repoSettings.value);
    const have = new Set(allowRules(f.user.value));
    const missing = want.filter((r) => !have.has(r));
    if (!missing.length) return pass('rules', render('check-rules-pass', { count: want.length }));
    return fail('rules', render('check-rules-fail', { missing: missing.length, count: want.length }));
  },

  depth(f) {
    const depth = f.user.value?.env?.[DEPTH_ENV];
    if (depth === WANT_DEPTH) return pass('depth', render('check-depth-pass', { depth: WANT_DEPTH }));
    return fail('depth', render('check-depth-fail', { depth: String(depth ?? 'unset (1)'), want: WANT_DEPTH }));
  },

  files(f) {
    const { checked, missing } = f.files;
    if (!missing.length) return pass('files', render('check-files-pass', { count: checked }));
    const list = missing.map((m) => render('check-files-item', { file: String(m.file), by: String(m.by) })).join(', ');
    return fail('files', render('check-files-fail', { root: String(f.plugin.root), list }));
  },

  copy(f) {
    if (f.plugin.installed && !f.pluginIsLink && !f.pluginInRepo) return pass('copy', render('check-copy-pass', { root: String(f.plugin.root) }));
    return fail('copy', render('check-copy-fail', { root: String(f.plugin.root) }));
  },

  release(f) {
    const mine = f.plugin.version;
    if (f.latest.state === 'unknown') return unknown('release', render('check-release-unknown', { version: String(mine) }));
    if (f.latest.state === 'none') return unknown('release', render('check-release-none', { version: String(mine), commit: String(f.plugin.commit ?? 'unknown') }));
    // An install of a commit that is not itself a release (tag null) is behind only if it lacks the newest release.
    if (byVersion(mine, f.latest.version) < 0 && !f.plugin.tag && f.latest.contained !== false) {
      if (f.latest.contained) return pass('release', render('check-release-contained', { commit: String(f.plugin.commit?.slice(0, 12)), version: String(mine), tag: String(f.latest.tag) }));
      return unknown('release', render('check-release-uncertain', { commit: String(f.plugin.commit?.slice(0, 12) ?? 'unknown'), version: String(mine), tag: String(f.latest.tag) }));
    }
    if (byVersion(mine, f.latest.version) < 0) {
      return fail('release', render('check-release-behind', { version: String(mine), latest: String(f.latest.version) }));
    }
    return pass('release', render('check-release-pass', { version: String(mine), tag: String(f.latest.tag) }));
  }
};

/** Runs every check. `passed` is false when any check failed; an unknown doesn't fail the self-check. */
export function selfcheck(facts) {
  const checks = Object.values(CHECKS).map((check) => check(facts));
  return { passed: checks.every((c) => c.status !== 'fail'), checks };
}

/** The line the session sees: a pass with the release, or each failed check's sentence. */
export function summary(result, plugin) {
  const label = { name: String(plugin.name), version: String(plugin.version) };
  const release = plugin.tag ? render('release-label', { ...label, tag: String(plugin.tag) }) : render('release-label-untagged', label);
  const failed = result.checks.filter((c) => c.status === 'fail');
  const unsure = result.checks.filter((c) => c.status === 'unknown');
  if (!failed.length) {
    const counts = { release, passed: result.checks.length - unsure.length, total: result.checks.length };
    return unsure.length ? render('self-check-passed-unchecked', { ...counts, unchecked: unsure.map((c) => c.detail).join(' ') }) : render('self-check-passed', counts);
  }
  return render('self-check-failed', { release, failed: failed.map((c) => c.detail).join(' ') });
}
