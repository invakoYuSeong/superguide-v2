// Reads cooldown facts out of the wikitext saved by fetch-stratagem-stats.mjs.
// Shared by build-stratagem-stats.mjs and test-stratagem-stats.mjs.
export const field = (text, key) => {
  const match = new RegExp(`\\|\\s*${key}\\s*=\\s*([^\\n|}]*)`).exec(text || '');
  return match ? match[1].trim() : '';
};
// "480s", "66.5", "Unlimited", "N/A", "Unknown" -> number, 'unlimited' or null.
export const value = text => {
  if (/^(unlimited|inf)$/i.test(text)) return 'unlimited';
  const match = /^(\d+(?:\.\d+)?)\s*s?$/i.exec(text);
  return match ? Number(match[1]) : null;
};

export function statsOf(entry) {
  if (!entry || entry.missing) return null;
  const table = entry.statsTable, box = entry.infobox;
  const cooldown = value(field(table, 'cooldown')) ?? value(field(box, 'base_cooldown'));
  return {
    type: field(box, 'stratagem_type') || null,
    cooldown: typeof cooldown === 'number' ? cooldown : null,
    callIn: value(field(table, 'call_time')),
    callInModules: value(field(table, 'call_time_upgraded')),
    uses: value(field(table, 'uses')),
    rearm: value(field(table, 'rearm_time')),
    revision: entry.revision,
  };
}
