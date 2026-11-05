import { readFileSync } from 'node:fs';
const rows = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => JSON.parse(l));
let last = null;
for (const r of rows) if (r.type === 'assistant') for (const c of r.message?.content ?? []) {
  if (c.type === 'text' && c.text.trim()) last = c.text;
  if (c.type === 'tool_use' && c.name === 'SubagentHandback') last = c.input.message;
}
process.stdout.write(String(last).trim());
