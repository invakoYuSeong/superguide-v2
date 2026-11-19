// Wiki page title of an enemy on the enemy view (its `source` link, without the section anchor).
export const pageTitle = enemy => decodeURIComponent(enemy.source.split('/wiki/')[1].split('#')[0]).replaceAll('_', ' ');
