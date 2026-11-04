// `node --test scripts/inspector/test/` runs this file (Node 22 resolves a folder to its index.js); npm test finds
// export.test.mjs by its own glob. Either way the same tests run once.
import './export.test.mjs';
