/** Rows of a delimited table as objects keyed by the header row. */
export function parse(text, sep = ',') {
  const [head, ...rows] = text.trim().split(/\r?\n/).map((l) => l.split(sep));
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
