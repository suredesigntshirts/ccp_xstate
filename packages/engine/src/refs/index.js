// The ref kinds: a ref is an output value { url, at } that the host checks against the world before a result counts.
// A workflow names each ref's kind in its marks (meta.marks, marks.js), and each kind is a checker
// module here that says what counts and which fields it stamps on the ref. Nothing else in the engine knows a kind's
// policy: accept (run/accept.js) runs the checker and sets the fields it returns.
import * as githubPr from './github-pr.js';
import * as webPage from './web-page.js';

/** Every ref kind by name. */
export const REF_KINDS = Object.freeze({ [githubPr.kind]: githubPr, [webPage.kind]: webPage });

const union = (part) => Object.freeze([...new Set(Object.values(REF_KINDS).flatMap((k) => k[part]))]);
/** The fields the host stamps on a ref, of any kind: an agent may not set them. */
export const STAMPED = union('stamps');
/** The stamped fields an agent is not shown. */
export const HIDDEN = union('hidden');
