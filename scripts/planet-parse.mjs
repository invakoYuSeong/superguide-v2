// Shared by build-planets.mjs and test-planets.mjs.
export const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// A game string as shown on the site: placeholders (#V_ONE, #V_TWO) filled from the
// wiki, italic tags and line-break escapes removed, the stray "초" after a percentage
// in the Korean Eagle rearm lines dropped. titleCase turns an all-caps name into "Pilot Shortage".
export function cleanGameText(text, values = {}, titleCase = false) {
  let out = text.replace(/#(V_ONE|V_TWO)/g, (match, key) => values?.[key] ?? match)
    .replace(/<\/?i(?:=\d+)?>/g, '').replace(/\\n/g, ' ').replace(/%초/g, '%').replace(/\s+/g, ' ').trim();
  if (titleCase && out === out.toUpperCase()) out = out.toLowerCase().replace(/(^|[\s&-])([a-z])/g, (_, gap, letter) => gap + letter.toUpperCase());
  return out;
}
