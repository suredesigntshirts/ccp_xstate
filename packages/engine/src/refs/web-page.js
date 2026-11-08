// The web-page ref kind: a ref { url, at } to a web page that holds the quoted text `at`. It counts when the page
// answers 2xx and its body, whitespace folded, contains the text. It stamps nothing.
import { said } from '../messages.js';

export const kind = 'web-page';
export const stamps = Object.freeze([]);
export const hidden = Object.freeze([]);

const flat = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();

/** Check a ref against the page. `web` is a client ({ get(url) -> { status, body } }). Returns { stamp } or { refused }. */
export async function check(ref, { path, web }) {
  let page = null;
  try {
    page = await web.get(ref.url);
  } catch (error) {
    page = { status: 0, body: String(error?.message ?? error) };
  }
  if (!(page?.status >= 200 && page?.status <= 299) || !flat(page.body).includes(flat(ref.at))) {
    return { refused: said('ref-page', { path, url: ref.url }) };
  }
  return { stamp: {} };
}
