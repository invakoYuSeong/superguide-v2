// Minimal rendering helpers: an auto-escaping `html` template tag, so data
// text can never inject markup, plus a few shared UI fragments.
import { L, T } from '../core/i18n.js';

class Safe { constructor(text) { this.text = text; } toString() { return this.text; } }
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escape = value => String(value).replace(/[&<>"']/g, char => ESC[char]);
export const raw = text => new Safe(String(text));
// Shown text is looked up in the English dictionary (T is a no-op in Korean):
// text between tags and human-readable attributes. Other attribute values
// (data-*, value, class …) keep their raw text, because code reads them back.
const piece = (value, shown = true) => value == null || value === false ? '' : value instanceof Safe ? value.text
  : Array.isArray(value) ? value.map(item => piece(item, shown)).join('') : escape(shown ? T(value) : value);
const READABLE = /\s(?:aria-label|aria-valuetext|title|alt|placeholder)=["'][^"']*$/;
const shownAt = out => { const open = out.lastIndexOf('<'); return open <= out.lastIndexOf('>') || READABLE.test(out.slice(open)); };
export const html = (strings, ...values) => new Safe(strings.reduce((out, text, i) => {
  const next = out + text;
  return i < values.length ? next + piece(values[i], shownAt(next)) : next;
}, ''));

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
export function render(root, content) { root.innerHTML = piece(content); }

export const external = (url, label) => html`<a class="ext" href="${url}" target="_blank" rel="noopener noreferrer">${label}<span aria-hidden="true"> ↗</span></a>`;

// Stroke icons, 24px grid.
const ICONS = {
  warbonds: '<path d="M8 2.5h8l-2.5 6.5h-3z"/><circle cx="12" cy="15.5" r="6"/><path d="m12 12.4 1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z"/>',
  arsenal: '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/>',
  enemy: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2"/><path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5"/>',
  demolition: '<path d="M3 21h18M5 21V10l7-5 7 5v11"/><path d="m9 13 3 3 3-3M12 16V9"/>',
  factions: '<path d="M5 21V3.5M5 4h12.5l-2.5 4.5 2.5 4.5H5"/>',
  // Planet tab: operation modifiers, event effects, Gloom and exostorm (no wiki icons for these).
  'mod-callin': '<circle cx="11" cy="13" r="7.5"/><path d="M11 9v4l2.5 2M19 2.5v5M16.5 5h5"/>',
  'mod-cooldown': '<path d="M6.5 3h11M6.5 21h11M8 3v2.5c0 3 8 4 8 6.5s-8 3.5-8 6.5V21M16 3v2.5c0 3-8 4-8 6.5s8 3.5 8 6.5V21"/>',
  'mod-intel': '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 20 20 4"/>',
  'mod-civilians': '<circle cx="8" cy="7.5" r="2.5"/><circle cx="16" cy="7.5" r="2.5"/><path d="M3.5 20v-2.5a4.5 4.5 0 0 1 9 0V20M11.5 20v-2.5a4.5 4.5 0 0 1 9 0V20"/>',
  'mod-spores': '<circle cx="7" cy="8" r="2"/><circle cx="15" cy="6" r="1.5"/><circle cx="17" cy="13" r="2.5"/><circle cx="9" cy="15" r="1.5"/><circle cx="12.5" cy="20" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  'mod-shriekers': '<path d="M12 9c-1.5-3-5-4.5-9.5-4 1.5 2 2 4 1.5 6 2.5-.5 5 .5 6.5 2.5L12 17l1.5-3.5C15 11.5 17.5 10.5 20 11c-.5-2 0-4 1.5-6-4.5-.5-8 1-9.5 4z"/>',
  'mod-gunships': '<path d="M12 3v18M5 9h14M8.5 18h7M9.5 9 12 4l2.5 5"/><circle cx="5" cy="9" r="2"/><circle cx="19" cy="9" r="2"/>',
  'mod-leviathan': '<path d="M2.5 13h19l-3 4.5H5.5zM6 13V9.5h12V13M9 9.5V6h6v3.5"/>',
  'ev-stims': '<path d="m14 4 6 6M17 7l-9 9-3.5.5L5 13l9-9M8.5 12.5l3 3M3 21l3-3"/>',
  'ev-extraction': '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M4 21h16M7 17.5h10"/>',
  'ev-eagle': '<path d="M12 3c1 0 1.5 1.5 1.5 4v3.5l7 4v2l-7-2v3.5l2 1.5v1.5L12 20l-3.5 1v-1.5l2-1.5v-3.5l-7 2v-2l7-4V7c0-2.5.5-4 1.5-4z"/>',
  gloom: '<path d="M7 18.5h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5-1A4.5 4.5 0 0 0 7 18.5z"/>',
  exostorm: '<path d="M3.5 4h17M5.5 8h13M8 12h9M10 16h5M12 20h1.5"/>',
  // Status effects (planet tab).
  'status-acid': '<path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"/><circle cx="10" cy="15" r="1.5"/><circle cx="14" cy="12" r="1"/>',
  'status-bleed': '<path d="M8 4s-4 5-4 8a4 4 0 0 0 8 0c0-3-4-8-4-8zM17 10s-3 3.5-3 5.5a3 3 0 0 0 6 0c0-2-3-5.5-3-5.5z"/>',
  'status-fire': '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 1 1.5 1.5 2.5 3 3 0-3-1-5 0-8z"/>',
  'status-gas': '<path d="M4 10h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M6 18h5"/>',
  'status-stun': '<path d="M13 2 5 13h6l-1 9 8-11h-6z"/>',
  'status-poison': '<path d="M9 3h6M10 3v5l-5 9a2.5 2.5 0 0 0 2.2 3.7h9.6A2.5 2.5 0 0 0 19 17l-5-9V3M7.5 14h9"/>',
  'status-stagger': '<path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5 19 19M19 5l-3.5 3.5M8.5 15.5 5 19"/>',
  planets: '<circle cx="12" cy="12" r="6.5"/><path d="M3.5 15.5c-1.8 2.2-.9 3.6 2.2 3.3 3.4-.3 8.6-2.4 12.3-5.4 3.6-2.9 4.6-5.6 2.1-6.1"/>',
  gear: '<path d="M3 10.5h13.5l1.5-2h3v4h-4l-1 1.5H9.5l-1.5 5h-3l1-5H3z"/><path d="M11 14v2.5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  compare: '<rect x="3.5" y="5" width="7" height="14" rx="1"/><rect x="13.5" y="5" width="7" height="14" rx="1"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
};
export const icon = (name, size = 20) => raw(`<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`);

/** Stratagem call code as keycaps: ↑↓←→ */
export const keycaps = (input, size = '') => input ? html`<span class="keys ${size}" aria-label="${L('호출 코드', 'Stratagem code')} ${input}">${[...input].map(key => html`<kbd>${key}</kbd>`)}</span>` : '';

export const badge = (text, tone = '') => html`<span class="badge ${tone}">${text}</span>`;
