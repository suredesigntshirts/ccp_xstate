// Preloaded with --import (through NODE_OPTIONS, so every child process gets it too): Playwright cannot be found.
// require() and import() of the bare name or of a path into an install folder throw MODULE_NOT_FOUND, and the fs checks a
// test makes for those folders say they are not there, as on ci.yml's runner.
import fs from 'node:fs';
import Module, { registerHooks, syncBuiltinESMExports } from 'node:module';

// A bare specifier, or a path into one of the places this container installs Playwright.
const ROOTS = ['/opt/node-tools/node_modules/playwright', '/opt/node22/lib/node_modules/playwright', '/usr/local/lib/node_modules_global/playwright'];
const named = (s) => /^playwright(-core)?(\/|$)/.test(String(s)) || ROOTS.some((r) => String(s) === r || String(s).startsWith(`${r}/`) || String(s).startsWith(`${r}-core`));
const missing = (s) => Object.assign(new Error(`Cannot find module '${s}'`), { code: 'MODULE_NOT_FOUND' });
const resolve0 = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) { if (named(request)) throw missing(request); return resolve0.call(this, request, ...rest); };
registerHooks?.({ resolve(specifier, context, next) { if (named(specifier)) throw missing(specifier); return next(specifier, context); } });
for (const f of ['existsSync']) { const real = fs[f]; fs[f] = (p, ...a) => (named(p) ? false : real(p, ...a)); }
for (const f of ['statSync', 'lstatSync', 'accessSync']) {
  const real = fs[f];
  fs[f] = (p, ...a) => { if (named(p)) { if (a[0]?.throwIfNoEntry === false) return undefined; throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' }); } return real(p, ...a); };
}
syncBuiltinESMExports();
