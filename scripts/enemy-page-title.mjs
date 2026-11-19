// Wiki page title of an enemy on the enemy view (its `source` link, without the section anchor).
export const pageTitle = enemy => decodeURIComponent(enemy.source.split('/wiki/')[1].split('#')[0]).replaceAll('_', ' ');
// A wiki infobox value that is not a plain number ("1.5 (body)") counts as unverified, never an error.
export const infoboxNumber = value => value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
