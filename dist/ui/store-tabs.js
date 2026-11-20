// The Store tab's two pages: warbonds (#/warbonds) and the Superstore (#/superstore), and what their boards share.
import { html } from './dom.js';
import { L } from '../core/i18n.js';

export const storeTabs = active => html`<nav class="store-tabs" aria-label="${L('스토어', 'Store')}">
  <a href="#/warbonds" aria-current="${active === 'warbonds' ? 'page' : 'false'}">${L('전쟁 채권', 'Warbonds')}</a>
  <a href="#/superstore" aria-current="${active === 'superstore' ? 'page' : 'false'}">${L('슈퍼 스토어', 'Superstore')}</a>
</nav>`;

// Marks one board tile by its data-cell key and scrolls it into view; clears any earlier mark.
export function markTile(scope, cell) {
  for (const el of scope.querySelectorAll('.wb-tile[data-focus]')) el.removeAttribute('data-focus');
  const target = /^\d+-\d+$/.test(cell || '') && scope.querySelector(`.wb-tile[data-cell="${cell}"]`);
  if (!target) return;
  target.setAttribute('data-focus', '');
  target.scrollIntoView({ block: 'center' });
}
