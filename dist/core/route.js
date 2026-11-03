// Every screen state lives in the URL hash, so any view can be linked or shared:
//   #/warbonds[/<warbond>]?t=<tier>&item=<gear|arsenal|armor>/<id>&m=<mode>   (the main page: an empty or unknown hash opens it)
//   #/arsenal[/<stratagem>]?c=<category>&ap=<band>&q=<text>
//   #/gear[/<weapon>]?cat=<group>&type=<type>&q=<text> | #/gear?tab=loadout&p=&s=&g=&st=&f= | #/gear?tab=armor&w=<weight>&a=<armor>
//   #/enemy[/<enemy>]?w=<weapon>&m=<mode>&shield=1
//   #/demolition?s=<structure> | #/demolition?w=<stratagem>&m=<mode>
//   #/factions[/<guide>]
export const VIEWS = ['warbonds', 'arsenal', 'gear', 'enemy', 'demolition', 'factions'];
export const HOME = 'warbonds';
// Hashes used by the previous site keep working.
const LEGACY = { catalog: 'arsenal', combat: 'enemy', demolition: 'demolition', factions: 'factions' };

export function parseRoute(hash) {
  const text = String(hash || '').replace(/^#/, '');
  if (LEGACY[text]) return { view: LEGACY[text], id: null, query: {} };
  const [path, search = ''] = text.split('?');
  const decode = part => { try { return decodeURIComponent(part); } catch { return part; } };
  const [view, id = null] = path.replace(/^\/+/, '').split('/').map(decode);
  return {
    view: VIEWS.includes(view) ? view : HOME,
    id: VIEWS.includes(view) && id ? id : null,
    query: Object.fromEntries(new URLSearchParams(search)),
  };
}

export function formatRoute({ view = HOME, id = null, query = {} }) {
  const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value != null && value !== '' && value !== false));
  const search = params.toString();
  return `#/${view}${id ? `/${encodeURIComponent(id)}` : ''}${search ? `?${search}` : ''}`;
}
