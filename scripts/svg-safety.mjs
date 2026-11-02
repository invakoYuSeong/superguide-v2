// Restricted, passive SVG profile shared by the downloader and Node-only integrity checks.
// No DTDs/entities, executable/embedded content, CSS imports/escapes, or network references.
import { pathToFileURL } from 'node:url';

export const MAX_SVG_BYTES = 50_000;
const elements = new Set(('svg g defs title desc path rect circle ellipse line polyline polygon '
  + 'text tspan textPath clipPath mask linearGradient radialGradient stop pattern marker symbol use style').split(' '));
const fail = message => { throw new Error(`Unsafe or invalid SVG: ${message}`); };
function unescapeXml(value) {
  if (/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);)/.test(value)) fail('unknown XML entity');
  return value.replace(/&([^;]+);/g, (_, entity) => {
    if (entity[0] !== '#') return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[entity];
    const code = entity[1] === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    if (!(code === 9 || code === 10 || code === 13 || code >= 32 && code <= 0x10ffff)
      || code >= 0xd800 && code <= 0xdfff || code === 0xfffe || code === 0xffff) fail('invalid XML character');
    return String.fromCodePoint(code);
  });
}
function passiveValue(value, css = false) {
  // Presentation attributes (fill, stroke, etc.) also accept CSS syntax.
  if (/[\\@]|\/\*|\*\//.test(value)) fail('CSS escapes, comments or imports');
  const remainder = value.replace(/url\(\s*(['"]?)(#[\w.:-]+)\1\s*\)/gi, '');
  if (/url\s*\(|(?:https?|ftp|data|javascript|vbscript|file):|\/\//i.test(remainder)) fail('external URL');
  if (css && [...remainder.matchAll(/([a-z-]+)\s*\(/gi)].some(match => !/^(?:rgb|rgba|hsl|hsla)$/i.test(match[1]))) {
    fail('unsupported CSS function (possible external resource)');
  }
}

export function validateSvg(bytes, metadata = {}) {
  if (!bytes.length || bytes.length > MAX_SVG_BYTES) fail(`size exceeds ${MAX_SVG_BYTES} bytes`);
  const xml = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '');
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/.test(xml)) fail('invalid XML character');
  const stack = [];
  let root, ended = false, offset = 0;
  while (offset < xml.length) {
    if (xml.startsWith('<!--', offset)) {
      if (stack.at(-1) === 'style') fail('comments inside style');
      const end = xml.indexOf('-->', offset + 4);
      if (end < 0 || xml.slice(offset + 4, end).includes('--')) fail('invalid XML comment');
      offset = end + 3;
      continue;
    }
    if (xml.startsWith('<?xml ', offset) && offset === 0) {
      const declaration = xml.slice(offset).match(/^<\?xml\s+version=['"]1\.0['"](?:\s+encoding=['"]UTF-8['"])?(?:\s+standalone=['"](?:yes|no)['"])?\s*\?>/i);
      if (!declaration) fail('unsupported XML declaration');
      offset += declaration[0].length;
      continue;
    }
    if (xml[offset] !== '<') {
      const end = xml.indexOf('<', offset);
      const text = xml.slice(offset, end < 0 ? xml.length : end);
      if (text.includes(']]>')) fail('invalid XML text');
      const decoded = unescapeXml(text);
      if (!stack.length && decoded.trim()) fail('text outside root');
      if (stack.at(-1) === 'style') passiveValue(decoded, true);
      offset = end < 0 ? xml.length : end;
      continue;
    }
    const close = xml.slice(offset).match(/^<\/([A-Za-z][\w.-]*)\s*>/);
    if (close) {
      if (stack.pop() !== close[1]) fail('mismatched closing tag');
      if (!stack.length) ended = true;
      offset += close[0].length;
      continue;
    }
    const open = xml.slice(offset).match(/^<([A-Za-z][\w.-]*)(?=[\s/>])/);
    if (!open || !elements.has(open[1])) fail('unsupported element or XML declaration');
    const tag = open[1];
    if (!stack.length && (root || ended || tag !== 'svg')) fail('expected one svg root');
    if (stack.at(-1) === 'style') fail('markup inside style');
    offset += open[0].length;
    const attrs = {};
    while (!/^\s*\/?>/.test(xml.slice(offset))) {
      const attr = xml.slice(offset).match(/^\s+([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/);
      if (!attr || Object.hasOwn(attrs, attr[1])) fail('invalid or duplicate attribute');
      const key = attr[1], local = key.split(':').at(-1).toLowerCase();
      const value = unescapeXml(attr[2] ?? attr[3]);
      if (local.startsWith('on') || local === 'base') fail('event handler or base URL');
      if (key === 'xmlns' && value !== 'http://www.w3.org/2000/svg') fail('non-SVG namespace');
      if (key !== 'xmlns' && !key.startsWith('xmlns:')) {
        if (local === 'href' && !/^#[\w.:-]+$/.test(value)) fail('external href');
        passiveValue(value, local === 'style');
      }
      attrs[key] = value;
      offset += attr[0].length;
    }
    const end = xml.slice(offset).match(/^\s*(\/?)>/);
    offset += end[0].length;
    if (!root) root = attrs;
    if (!end[1]) stack.push(tag);
    else if (!stack.length) ended = true;
  }
  if (!root || stack.length || !ended) fail('incomplete XML');
  const viewBox = root.viewBox?.trim().split(/[\s,]+/).map(Number);
  const length = value => /^\d*\.?\d+(?:px)?$/.test(value || '') ? Number(value.replace(/px$/, '')) : null;
  const width = metadata.width || length(root.width) || (viewBox?.length === 4 ? viewBox[2] : null);
  const height = metadata.height || length(root.height) || (viewBox?.length === 4 ? viewBox[3] : null);
  if (![width, height].every(n => Number.isFinite(n) && n > 0)) fail('missing or invalid dimensions');
  return { width, height };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  try {
    console.log(JSON.stringify(validateSvg(Buffer.concat(chunks), JSON.parse(process.argv[2] || '{}'))));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
