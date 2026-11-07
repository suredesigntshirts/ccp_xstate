// A small JavaScript scanner that removes comments and respects strings, template literals (with nested ${}),
// regex literals and division. Whitespace outside literals collapses to one '\n' when the run holds a newline, else
// one ' ', so a comment rewrapped over fewer lines does not count as a code change while ASI-relevant newlines stay.
const KEYWORDS_BEFORE_REGEX = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw',
  'case', 'do', 'else', 'yield', 'await']);
const isIdent = (c) => /[A-Za-z0-9_$\u0080-￿]/.test(c);

export function strip(src) {
  let out = '';
  let i = 0;
  let last = ''; // last significant token kind: 'id' (identifier/number/keyword word), 'close' ()]}), 'op', ''
  let lastWord = '';
  const braces = []; // stack: 'tpl' for a ${ inside a template, 'brace' for a plain {
  let ws = '';
  const flushWs = () => { if (ws) { out += ws.includes('\n') ? '\n' : ' '; ws = ''; } };
  const regexAllowed = () => last === '' || last === 'op' || (last === 'id' && KEYWORDS_BEFORE_REGEX.has(lastWord));
  function readTemplate() { // at the char after ` or after the } closing a ${...}
    let s = '';
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') { s += c + src[i + 1]; i += 2; continue; }
      if (c === '`') { s += c; i++; return { s, done: true }; }
      if (c === '$' && src[i + 1] === '{') { s += '${'; i += 2; braces.push('tpl'); return { s, done: false }; }
      s += c; i++;
    }
    throw new Error('unterminated template');
  }
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (/\s/.test(c)) { ws += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2);
      if (end < 0) throw new Error('unterminated block comment');
      ws += src.slice(i, end + 2).includes('\n') ? '\n' : ' ';
      i = end + 2; continue;
    }
    if (i === 0 && c === '#' && n === '!') { while (i < src.length && src[i] !== '\n') i++; continue; }
    flushWs();
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; if (src[j] === '\n') throw new Error('newline in string'); j++; }
      out += src.slice(i, j + 1); i = j + 1; last = 'id'; lastWord = ''; continue;
    }
    if (c === '`') { i++; const t = readTemplate(); out += '`' + t.s; last = t.done ? 'id' : 'op'; lastWord = ''; continue; }
    if (c === '/' && regexAllowed()) {
      let j = i + 1; let cls = false;
      while (j < src.length) {
        const d = src[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '\n') throw new Error('newline in regex at ' + i);
        if (cls) { if (d === ']') cls = false; } else if (d === '[') cls = true; else if (d === '/') break;
        j++;
      }
      j++;
      while (j < src.length && /[a-z]/.test(src[j])) j++;
      out += src.slice(i, j); i = j; last = 'id'; lastWord = ''; continue;
    }
    if (isIdent(c)) {
      let j = i; while (j < src.length && isIdent(src[j])) j++;
      lastWord = src.slice(i, j); out += lastWord; i = j; last = 'id'; continue;
    }
    if (c === '{') { braces.push('brace'); out += c; i++; last = 'op'; continue; }
    if (c === '}') {
      const top = braces.pop();
      if (top === 'tpl') { i++; const t = readTemplate(); out += '}' + t.s; last = t.done ? 'id' : 'op'; lastWord = ''; continue; }
      out += c; i++; last = 'close'; continue;
    }
    if (c === ')' || c === ']') { out += c; i++; last = 'close'; continue; }
    out += c; i++; last = 'op'; lastWord = '';
  }
  return out.replace(/\s+$/, '');
}
