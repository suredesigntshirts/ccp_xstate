// Accept a stub brief for an item's open brief run, then deliver, so its build run is prepared with `task`.
// node brief.mjs <repo> <journal root> <item> <builder task>
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
const [repo, root, item, builderTask] = process.argv.slice(2);
const { spawn, bind, accept, deliver, waiting } = await import(pathToFileURL(join(repo, 'packages/engine/src/actors.js')).href);
const { github } = await import(pathToFileURL(join(repo, 'packages/engine/src/effects/index.js')).href);
const [w] = waiting(root, item).filter((r) => r.actor === 'brief');
spawn({ root, prompt: w.prompt, toolUseId: 'toolu_stub_brief' });
bind({ root, agentId: 'stub-brief', toolUseId: 'toolu_stub_brief' });
const gh = github({ api: process.env.CCP_GITHUB_API, env: {} });
console.log(JSON.stringify(await accept({ root, caller: 'stub-brief', run: w.run, result: { builder: builderTask, verifier: 'verify it' }, toolUseId: 'toolu_stub_brief_ret', github: gh })));
console.log(JSON.stringify(await deliver({ root, run: w.run, github: gh })));
console.log(JSON.stringify(waiting(root, item)));
