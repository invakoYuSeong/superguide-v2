// The Store tab's two pages: warbonds (#/warbonds) and the Superstore (#/superstore).
import { html } from './dom.js';
import { L } from '../core/i18n.js';

export const storeTabs = active => html`<nav class="store-tabs" aria-label="${L('스토어', 'Store')}">
  <a href="#/warbonds" aria-current="${active === 'warbonds' ? 'page' : 'false'}">${L('전쟁 채권', 'Warbonds')}</a>
  <a href="#/superstore" aria-current="${active === 'superstore' ? 'page' : 'false'}">${L('슈퍼 스토어', 'Superstore')}</a>
</nav>`;
