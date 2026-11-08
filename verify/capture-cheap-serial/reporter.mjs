// A node:test reporter that writes one JSON line per finished test: its file, name, nesting, status and the time
// the runner reported it. record.mjs adds it beside the TAP reporter to each command of the test script.
export default async function* jsonl(source) {
  for await (const event of source) {
    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue;
    const d = event.data;
    if (d.details?.type === 'suite') continue;
    const status = event.type === 'test:fail' ? 'fail' : d.skip !== undefined ? 'skip' : d.todo !== undefined ? 'todo' : 'pass';
    yield `${JSON.stringify({ file: d.file, name: d.name, nesting: d.nesting, status, t: Date.now() })}\n`;
  }
}
