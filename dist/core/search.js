// Korean-friendly fuzzy search.
// Players type names loosely, so a query matches when it is
//   - a prefix or substring of a name or alias,
//   - the initial consonants of a name ("ㄱㄷㅈㅁ" → 궤도 정밀 타격),
//   - the same characters in any order ("도밀타" → 궤도 정밀 타격),
//   - or a phrase in the code, summary or tags.
const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JAMO = /^[ㄱ-ㅎ]+$/;

// NFKC folds full-width characters but also turns typed consonants (ㄱ, U+3131)
// into conjoining jamo (U+1100); map those back so initial search keeps working.
export const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase()
  .replace(/[ᄀ-ᄒ]/g, char => INITIALS[char.charCodeAt(0) - 0x1100])
  .replace(/[\s\-·"'()/]/g, '');
export const initials = value => [...normalize(value)].map(char => {
  const code = char.charCodeAt(0) - 0xac00;
  return code >= 0 && code < 11172 ? INITIALS[Math.floor(code / 588)] : char;
}).join('');

/** Returns a scorer: 0 = no match, higher = better. */
export function scorer(query) {
  const q = normalize(query);
  if (!q) return () => 1;
  const chars = [...new Set(q)];
  const jamo = JAMO.test(q);
  // Any-order matching is for scrambled Korean syllables; on digits and
  // Latin letters it only adds noise ("500" would match "M-105").
  const anyOrder = chars.length > 1 && /[가-힣]/.test(q);
  return ({ names, text = [] }) => {
    let best = 0;
    for (const name of names.filter(Boolean)) {
      const n = normalize(name);
      if (n.startsWith(q)) return 6;
      if (n.includes(q)) best = Math.max(best, 5);
      // Initials from the start of a name ('ㄷㄱ' for 둔기 충격 완화) rank above initials found mid-name.
      else if (jamo && initials(name).includes(q)) best = Math.max(best, initials(name).startsWith(q) ? 4.5 : 4);
      else if (anyOrder && chars.every(char => n.includes(char))) best = Math.max(best, 3);
    }
    if (best) return best;
    return normalize(text.filter(Boolean).join(' ')).includes(q) ? 1 : 0;
  };
}

/** Filters and ranks; ties keep their original order. */
export function search(items, query, fields) {
  const score = scorer(query);
  return items.map((item, index) => ({ item, index, score: score(fields(item)) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(entry => entry.item);
}

// Legendary warbonds made with another game: that game's name also finds the warbond (in the search
// palette) and its weapons, stratagems and armor (in their own lists), keyed by warbond id (user decision 2026-11-23).
export const COLLAB_KEYWORDS = {
  'castellans-creed': ['워해머', '워해머 40K', 'Warhammer', 'Warhammer 40,000'],
  'righteous-revenants': ['킬존', 'Killzone'],
  'obedient-democracy-support-troopers': ['헤일로', 'Halo', 'ODST'],
};
export const collabKeywords = warbondId => COLLAB_KEYWORDS[warbondId] ?? [];

/** Searchable names of a primary, secondary or throwable: Korean, English with and without its code, the code, and aliases. */
export const personalNames = item => [item.name, item.en, item.en?.replace(/^\S+\s/, ''), item.code, ...(item.aliases || [])].filter(Boolean);

export const stratagemFields = item => ({ names: [item.name, item.en, ...(item.aliases || [])], text: [item.code, item.summary, ...(item.tags || []), ...(item.variants || []).map(variant => variant.name)] });
