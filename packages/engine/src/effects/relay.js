// The thread as a command-line host reaches it. A host process can't call the thread's
// tools, so the session that has them posts the card the host asks for (`bin/host.js show` lists the ask run under
// pending) and records the card's id with `bin/host.js card`. The host's card effect waits until that record exists,
// then finishes with the card's id as its ref, and the tap wake naming that id is the answer (wake.js). Nothing here
// answers a card: a record only says which card was put up, and the platform's tap wake is what moves the item.
// Closing is the same in reverse: when the item leaves the state that asked, the
// run's stop waits until that session has withdrawn the card (close_decision) and recorded it with `bin/host.js closed`.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { cardFile, closedFile } from '../names.js';

// Where a card's records live is names.js's: cardFile and closedFile.
export { cardFile, closedFile };

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
};

/**
 * A hearth client for effects/index.js over the posted-card records: ready(effect) says whether the card was put up,
 * card() and find() read its id. Posts have no record, so a post effect stays pending. For the stop of an ask run,
 * ready says whether there is nothing to close (no card was recorded) or the card's withdrawal was recorded, and
 * close() reads the card's id.
 */
export function relay({ root }) {
  const posted = (key) => {
    const record = readJson(cardFile(root, key));
    return record?.ref ? { ref: record.ref } : null;
  };
  return {
    ready: (effect) => (effect.type === 'stop'
      ? !existsSync(cardFile(root, effect.run)) || existsSync(closedFile(root, effect.run))
      : effect.actor === 'ask' && existsSync(cardFile(root, effect.id))),
    card: async ({ key }) => posted(key),
    find: async (key) => posted(key),
    close: async ({ key }) => posted(key)
  };
}

// The stop effect of an ask run that is not ended yet, if any.
const openStop = (host, runId) =>
  [...host.effects.values()].find(({ effect, phase }) => effect.type === 'stop' && effect.run === runId && !['done', 'refused', 'failed', 'unknown'].includes(phase))?.effect ?? null;

/**
 * Record that the card for an item's open ask run was put up as `ref`. Refused (throws) when the run is not an open
 * ask run of this item, or a record for it already exists: a card is put up once.
 */
export function recordCard({ host, effect: effectId, ref, at = new Date().toISOString() }) {
  if (typeof ref !== 'string' || !ref.trim()) throw new Error('the card needs its id (--ref)');
  const run = host.runs.get(effectId);
  if (!run && [...host.effects.values()].some(({ effect }) => effect.type === 'stop' && effect.run === effectId)) {
    throw new Error(`${effectId} was stopped: ${host.item} left the state that asked, so nothing will read this card; withdraw the card you put up (close_decision with no choice)`);
  }
  if (!run || run.actor !== 'ask') throw new Error(`${effectId} is not an open ask run of ${host.item}`);
  const file = cardFile(host.root, effectId);
  if (existsSync(file)) throw new Error(`a card for ${effectId} is already recorded`);
  const record = { effect: effectId, ref: ref.trim(), question: run.input?.question ?? null, choices: run.input?.choices ?? null, at };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.${process.pid}`, `${JSON.stringify(record, null, 2)}\n`);
  renameSync(`${file}.${process.pid}`, file);
  return record;
}

/**
 * Record that the card for an ask run the item stopped was withdrawn in the thread. Refused (throws) when the run has
 * no stop waiting, no card was recorded for it, or its withdrawal is already recorded.
 */
export function recordClosed({ host, effect: effectId, at = new Date().toISOString() }) {
  const stop = openStop(host, effectId);
  if (!stop) throw new Error(`${effectId} has no stop waiting in ${host.item}: its card is not to be closed`);
  const card = readJson(cardFile(host.root, effectId));
  if (!card?.ref) throw new Error(`no card was recorded for ${effectId}: there is nothing to close`);
  const file = closedFile(host.root, effectId);
  if (existsSync(file)) throw new Error(`the card for ${effectId} is already recorded closed`);
  const record = { effect: effectId, ref: card.ref, stop: stop.id, at };
  writeFileSync(`${file}.${process.pid}`, `${JSON.stringify(record, null, 2)}\n`);
  renameSync(`${file}.${process.pid}`, file);
  return record;
}
