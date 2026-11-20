// Wiki page title of an enemy on the enemy view (its `source` link, without the section anchor).
export const pageTitle = enemy => decodeURIComponent(enemy.source.split('/wiki/')[1].split('#')[0]).replaceAll('_', ' ');
// A wiki infobox value that is not a plain number ("1.5 (body)") counts as unverified, never an error.
export const infoboxNumber = value => value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
// How an enemy calls reinforcements, read from its wiki Behavior/Spawning text: Terminid pheromones that
// cause a Bug Breach, an Automaton flare that calls a Bot Drop, an Illuminate holographic flare that calls
// Warp Ships. null when the page says none of these (or says it cannot call reinforcements).
export function reinforcementOf(page) {
  const text = `${page?.behavior ?? ''}\n${page?.spawning ?? ''}`;
  if (/release a cloud of pheromones[^.]*Bug Breach/i.test(text)) return 'breach';
  if (/fire a flare to call in/i.test(text)) return 'dropship';
  if (/flares that call in \[\[Warp Ship/i.test(text)) return 'warp';
  return null;
}
