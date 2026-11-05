/** First letter upper case. */
export function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Lower case, words joined by dashes. */
export function slugify(s) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** At most n characters, with an ellipsis when cut. */
export function truncate(s, n) {
  return s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1))}\u2026`;
}
