// Reads the booster infobox (warbond, page, medal cost, list order) and cleans the
// game's text markup. Shared by build-boosters.mjs and test-boosters.mjs.
export function boosterFacts(text) {
  const field = key => new RegExp(`\\|\\s*${key}\\s*=\\s*([^\\n]*)`).exec(text)?.[1].trim() ?? '';
  const source = field('source');
  return {
    warbond: /\|([^\]|]+)\]\]/.exec(source)?.[1].trim() ?? null,
    page: Number(/Tooltip\|P(\d+)/.exec(source)?.[1]) || null,
    cost: Number(/Medals\|(\d+)/i.exec(field('cost'))?.[1]) || null,
    order: Number(field('order')) || null,
  };
}

// "<c=#COLOR>#VALUE</c>" placeholders and colour/italic tags out of a game string.
export const gameText = (text, value) => text.replace(/#VALUE/g, value ?? '#VALUE').replace(/<\/?[ci](?:=[^>]*)?>/g, '');
