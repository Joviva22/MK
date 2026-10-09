(function () {
'use strict';
const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const EMU = 914400;
const xml = (node) => new window.XMLSerializer().serializeToString(node);
function parse(text) {
  if (text.length > 10 * 1024 * 1024 || /<!DOCTYPE/i.test(text)) throw new Error('XML demasiado grande o no admitido.');
  const doc = new window.DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('La presentación contiene XML dañado.');
  return doc;
}
const all = (node, ns, tag) => Array.from(node.getElementsByTagNameNS(ns, tag));
const first = (node, ns, tag) => all(node, ns, tag)[0];
function resolve(part, target) {
  if (/^[a-z]+:/i.test(target)) return null;
  const parts = target.startsWith('/') ? [] : part.split('/').slice(0, -1);
  for (const segment of target.split('/')) { if (segment === '..') parts.pop(); else if (segment && segment !== '.') parts.push(segment); }
  return parts.join('/');
}
function relPath(part) { const list = part.split('/'); const name = list.pop(); return list.join('/') + '/_rels/' + name + '.rels'; }
function child(parent, ns, name, attrs = {}, text) {
  const node = parent.ownerDocument.createElementNS(ns, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  parent.appendChild(node); return node;
}
async function create() {
  await window.mdLoadLib('pptx');
  const deck = new window.PptxGenJS(); deck.layout = 'LAYOUT_WIDE'; deck.author = 'MK';
  const slide = deck.addSlide(); slide.background = { color: 'F6F8FC' };
  slide.addText('Nueva presentación', { x: 0.8, y: 1, w: 11.7, h: 1, fontSize: 36, bold: true, color: '234E70' });
  slide.addText('Escribe aquí el contenido de tu primera diapositiva.', { x: 0.8, y: 2.4, w: 11.7, h: 2.8, fontSize: 22, color: '334155' });
  return deck.write({ outputType: 'base64' });
}
async function load(base64, saved = null) {
  await window.mdLoadLib('zip');
  const zip = await window.JSZip.loadAsync(base64, { base64: true });
  const changes = { ...(saved?.changes || {}) }, media = { ...(saved?.media || {}) };
  let total = 0;
  for (const file of Object.values(zip.files)) { total += file._data?.uncompressedSize || 0; if (total > 100 * 1024 * 1024) throw new Error('La presentación descomprimida supera 100 MB.'); }
  async function read(path) { const text = changes[path] ?? await zip.file(path)?.async('string'); if (!text) throw new Error('Falta una parte de la presentación: ' + path); return parse(text); }
  const presentation = await read('ppt/presentation.xml');
  const relationships = await read('ppt/_rels/presentation.xml.rels');
  const types = await read('[Content_Types].xml');
  const size = first(presentation, P, 'sldSz');
  const width = Number(size?.getAttribute('cx') || 12192000) / EMU;
  const height = Number(size?.getAttribute('cy') || 6858000) / EMU;
  const ids = first(presentation, P, 'sldIdLst');
  if (!ids) throw new Error('No se encontró la lista de diapositivas.');
  const relations = new Map(all(relationships, REL, 'Relationship').map(node => [node.getAttribute('Id'), node]));
  const slides = [];
  for (const id of Array.from(ids.children)) {
    if (slides.length % 10 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    const rid = id.getAttributeNS(R, 'id'); const relation = relations.get(rid);
    const part = relation && resolve('ppt/presentation.xml', relation.getAttribute('Target'));
    if (!part || relation.getAttribute('TargetMode') === 'External') throw new Error('Relación de diapositiva inválida.');
    const doc = await read(part);
    const rels = changes[relPath(part)] || zip.file(relPath(part));
    const slideRels = rels ? await read(relPath(part)) : parse(`<Relationships xmlns="${REL}"/>`);
    slides.push({ id, rid, part, doc, rels: slideRels });
  }
  if (!slides.length || slides.length > 300) throw new Error('Admitimos presentaciones de 1 a 300 diapositivas.');
  function changed(slide) { changes[slide.part] = xml(slide.doc); }
  function structure() { changes['ppt/presentation.xml'] = xml(presentation); changes['ppt/_rels/presentation.xml.rels'] = xml(relationships); changes['[Content_Types].xml'] = xml(types); }
  function shape(slideIndex, id) {
    const slide = slides[slideIndex];
    const node = all(slide.doc, P, 'sp').concat(all(slide.doc, P, 'pic')).find(node => first(node, P, 'cNvPr')?.getAttribute('id') === String(id));
    if (!node) throw new Error('No se encontró el objeto.');
    return { slide, node };
  }
  function transform(node) { return first(node, A, 'xfrm'); }
  function dimensions(node) {
    const tx = transform(node), off = tx && first(tx, A, 'off'), ext = tx && first(tx, A, 'ext');
    return { x: Number(off?.getAttribute('x') || 0) / EMU, y: Number(off?.getAttribute('y') || 0) / EMU, w: Number(ext?.getAttribute('cx') || 6 * EMU) / EMU, h: Number(ext?.getAttribute('cy') || EMU) / EMU };
  }
  function textOf(node) { return all(node, A, 'p').map(p => all(p, A, 't').map(t => t.textContent).join('')).join('\n'); }
  function styles(node) {
    const run = first(node, A, 'rPr') || first(node, A, 'defRPr');
    const color = run && first(run, A, 'srgbClr');
    const fill = Array.from(first(node, P, 'spPr')?.children || []).find(c => c.localName === 'solidFill');
    const fillColor = fill && first(fill, A, 'srgbClr');
    const paragraph = first(node, A, 'pPr');
    return { size: Number(run?.getAttribute('sz') || 2200) / 100, bold: run?.getAttribute('b') === '1', italic: run?.getAttribute('i') === '1', color: color?.getAttribute('val') || '334155', fill: fillColor?.getAttribute('val'), align: ({ ctr: 'center', r: 'right', just: 'justify' })[paragraph?.getAttribute('algn')] || 'left' };
  }
  async function items(index) {
    const slide = slides[index]; const out = [];
    const tree = first(slide.doc, P, 'spTree');
    for (const node of Array.from(tree.children)) {
      if (!['sp', 'pic', 'graphicFrame'].includes(node.localName)) continue;
      const id = first(node, P, 'cNvPr')?.getAttribute('id');
      const entry = { id, ...dimensions(node), ...styles(node), kind: node.localName, text: textOf(node) };
      if (node.localName === 'pic') {
        const embed = first(node, A, 'blip')?.getAttributeNS(R, 'embed');
        const rel = all(slide.rels, REL, 'Relationship').find(r => r.getAttribute('Id') === embed);
        if (rel && rel.getAttribute('TargetMode') !== 'External') {
          const path = resolve(slide.part, rel.getAttribute('Target')); const file = path && zip.file(path);
          const ext = path?.split('.').pop().toLowerCase();
          const mime = ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' })[ext];
          if (mime && (media[path] || file)) entry.src = `data:${mime};base64,${media[path] || await file.async('base64')}`;
        }
      }
      if (node.localName === 'graphicFrame') entry.readOnly = true;
      out.push(entry);
    }
    return out;
  }
  function setText(index, id, text) {
    const { slide, node } = shape(index, id); let body = first(node, P, 'txBody');
    if (!body) { body = child(node, P, 'p:txBody'); child(body, A, 'a:bodyPr', { wrap:'square' }); child(body, A, 'a:lstStyle'); }
    const style = first(body, A, 'rPr')?.cloneNode(true);
    const paragraphStyle = first(body, A, 'pPr')?.cloneNode(true);
    all(body, A, 'p').forEach(p => p.remove());
    for (const line of String(text).split('\n')) {
      const paragraph = child(body, A, 'a:p'); if (paragraphStyle) paragraph.appendChild(paragraphStyle.cloneNode(true));
      const run = child(paragraph, A, 'a:r'); if (style) run.appendChild(style.cloneNode(true));
      child(run, A, 'a:t', {}, line);
    }
    changed(slide);
  }
  function setStyle(index, id, options) {
    const { slide, node } = shape(index, id);
    for (const run of all(node, A, 'r')) {
      let style = first(run, A, 'rPr'); if (!style) { style = run.ownerDocument.createElementNS(A, 'a:rPr'); run.insertBefore(style, run.firstChild); }
      for (const [key, attr] of [['bold', 'b'], ['italic', 'i'], ['size', 'sz']]) if (options[key] !== undefined) style.setAttribute(attr, String(key === 'size' ? options[key] * 100 : options[key] ? 1 : 0));
      if (options.color) { Array.from(style.children).filter(n => /Fill$/.test(n.localName)).forEach(n => n.remove()); child(child(style, A, 'a:solidFill'), A, 'a:srgbClr', { val: options.color.replace('#', '') }); }
    }
    if (options.align) for (const paragraph of all(node, A, 'p')) { let style = first(paragraph, A, 'pPr'); if (!style) { style = paragraph.ownerDocument.createElementNS(A, 'a:pPr'); paragraph.insertBefore(style, paragraph.firstChild); } style.setAttribute('algn', ({ left: 'l', center: 'ctr', right: 'r', justify: 'just' })[options.align]); }
    changed(slide);
  }
  function move(index, id, values) {
    const { slide, node } = shape(index, id); let tx = transform(node);
    if (!tx) { const props = first(node, P, 'spPr'); if (!props) return; tx = child(props, A, 'a:xfrm'); }
    let off = first(tx, A, 'off'); if (!off) off = child(tx, A, 'a:off', { x: 0, y: 0 });
    let ext = first(tx, A, 'ext'); if (!ext) ext = child(tx, A, 'a:ext', { cx: 6 * EMU, cy: EMU });
    for (const key of ['x', 'y']) if (Number.isFinite(values[key])) off.setAttribute(key, String(Math.round(values[key] * EMU)));
    for (const [key, attr] of [['w', 'cx'], ['h', 'cy']]) if (Number.isFinite(values[key]) && values[key] > 0) ext.setAttribute(attr, String(Math.round(values[key] * EMU)));
    changed(slide);
  }
  function addText(index, text = 'Nuevo texto') {
    const slide = slides[index]; const tree = first(slide.doc, P, 'spTree');
    const id = Math.max(1, ...all(slide.doc, P, 'cNvPr').map(n => Number(n.getAttribute('id')) || 0)) + 1;
    const sp = child(tree, P, 'p:sp'); const nv = child(sp, P, 'p:nvSpPr');
    child(nv, P, 'p:cNvPr', { id, name: `Texto ${id}` }); child(nv, P, 'p:cNvSpPr', { txBox: 1 }); child(nv, P, 'p:nvPr');
    const props = child(sp, P, 'p:spPr'); const tx = child(props, A, 'a:xfrm'); child(tx, A, 'a:off', { x: Math.round(0.8 * EMU), y: Math.round(1.2 * EMU) }); child(tx, A, 'a:ext', { cx: Math.round((width - 1.6) * EMU), cy: EMU });
    child(child(props, A, 'a:prstGeom', { prst: 'rect' }), A, 'a:avLst'); child(props, A, 'a:noFill'); child(child(props, A, 'a:ln'), A, 'a:noFill');
    const body = child(sp, P, 'p:txBody'); child(body, A, 'a:bodyPr', { wrap: 'square' }); child(body, A, 'a:lstStyle');
    const run = child(child(body, A, 'a:p'), A, 'a:r'); const style = child(run, A, 'a:rPr', { lang: 'es-ES', sz: 2400 }); child(child(style, A, 'a:solidFill'), A, 'a:srgbClr', { val: '234E70' }); child(run, A, 'a:t', {}, text);
    changed(slide); return String(id);
  }
  function removeItem(index, id) { const { slide, node } = shape(index, id); node.remove(); changed(slide); }
  function addSlide(index, duplicate = false) {
    if (slides.length >= 300) throw new Error('Máximo de 300 diapositivas.');
    const origin = slides[index];
    let number = 1; while (zip.file(`ppt/slides/slide${number}.xml`) || changes[`ppt/slides/slide${number}.xml`]) number++;
    const part = `ppt/slides/slide${number}.xml`; let ridNumber = 1;
    const used = all(relationships, REL, 'Relationship').map(n => n.getAttribute('Id'));
    while (used.includes(`rId${ridNumber}`)) ridNumber++;
    const rid = `rId${ridNumber}`;
    const doc = parse(xml(origin.doc)), rels = parse(xml(origin.rels));
    all(rels, REL, 'Relationship').filter(r => /\/notesSlide$/.test(r.getAttribute('Type'))).forEach(r => r.remove());
    if (!duplicate) { const tree = first(doc, P, 'spTree'); Array.from(tree.children).filter(n => !['nvGrpSpPr', 'grpSpPr'].includes(n.localName)).forEach(n => n.remove()); }
    const id = presentation.createElementNS(P, 'p:sldId'); id.setAttribute('id', String(Math.max(255, ...slides.map(s => Number(s.id.getAttribute('id')))) + 1)); id.setAttributeNS(R, 'r:id', rid);
    ids.insertBefore(id, origin.id.nextSibling);
    child(relationships.documentElement, REL, 'Relationship', { Id: rid, Type: R + '/slide', Target: `slides/slide${number}.xml` });
    child(types.documentElement, CT, 'Override', { PartName: '/' + part, ContentType: 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml' });
    const next = { id, rid, part, doc, rels }; slides.splice(index + 1, 0, next); changed(next); changes[relPath(part)] = xml(rels); structure();
    if (!duplicate) addText(index + 1, 'Nueva diapositiva');
    return index + 1;
  }
  function removeSlide(index) {
    if (slides.length === 1) throw new Error('La presentación necesita al menos una diapositiva.');
    const [slide] = slides.splice(index, 1); slide.id.remove(); all(relationships, REL, 'Relationship').find(r => r.getAttribute('Id') === slide.rid)?.remove(); structure();
  }
  function reorder(index, offset) {
    const target = index + offset; if (target < 0 || target >= slides.length) return index;
    const [slide] = slides.splice(index, 1); slides.splice(target, 0, slide); ids.replaceChildren(...slides.map(s => s.id)); structure(); return target;
  }
  function background(index, color) {
    const slide = slides[index]; const common = first(slide.doc, P, 'cSld'); let bg = first(common, P, 'bg'); if (bg) bg.remove();
    bg = slide.doc.createElementNS(P, 'p:bg'); common.insertBefore(bg, common.firstChild);
    child(child(child(bg, P, 'p:bgPr'), A, 'a:solidFill'), A, 'a:srgbClr', { val: color.replace('#', '') }); changed(slide);
  }
  function backgroundColor(index) { const bg = first(slides[index].doc, P, 'bg'); return bg && first(bg, A, 'srgbClr')?.getAttribute('val') || 'FFFFFF'; }
  async function addImage(index, source, ext) {
    if (!['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) throw new Error('Elige una imagen PNG, JPEG, GIF o WebP.');
    const slide = slides[index]; const path = `ppt/media/mk-${crypto.randomUUID()}.${ext}`; media[path] = source;
    const used = all(slide.rels, REL, 'Relationship').map(n => n.getAttribute('Id')); let n = 1; while (used.includes(`rId${n}`)) n++;
    child(slide.rels.documentElement, REL, 'Relationship', { Id: `rId${n}`, Type: R + '/image', Target: '../media/' + path.split('/').pop() });
    const id = Math.max(1, ...all(slide.doc, P, 'cNvPr').map(n => Number(n.getAttribute('id')) || 0)) + 1;
    const pic = child(first(slide.doc, P, 'spTree'), P, 'p:pic'); const nv = child(pic, P, 'p:nvPicPr'); child(nv, P, 'p:cNvPr', { id, name: 'Imagen ' + id }); child(nv, P, 'p:cNvPicPr'); child(nv, P, 'p:nvPr');
    const fill = child(pic, P, 'p:blipFill'); const blip = child(fill, A, 'a:blip'); blip.setAttributeNS(R, 'r:embed', `rId${n}`); child(child(fill, A, 'a:stretch'), A, 'a:fillRect');
    const props = child(pic, P, 'p:spPr'); const tx = child(props, A, 'a:xfrm'); child(tx, A, 'a:off', { x: EMU, y: EMU }); child(tx, A, 'a:ext', { cx: 4 * EMU, cy: 3 * EMU }); child(child(props, A, 'a:prstGeom', { prst: 'rect' }), A, 'a:avLst');
    if (!all(types, CT, 'Default').some(n => n.getAttribute('Extension') === ext)) child(types.documentElement, CT, 'Default', { Extension: ext, ContentType: ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/' + ext });
    changed(slide); changes[relPath(slide.part)] = xml(slide.rels); structure(); return String(id);
  }
  async function exportBase64() {
    const output = await window.JSZip.loadAsync(base64, { base64: true });
    for (const [path, text] of Object.entries(changes)) output.file(path, text);
    for (const [path, bytes] of Object.entries(media)) output.file(path, bytes, { base64: true });
    return output.generateAsync({ type: 'base64', compression: 'DEFLATE' });
  }
  const snapshot = () => ({ changes: { ...changes }, media: { ...media } });
  return { slides, width, height, items, textOf, setText, setStyle, move, addText, addImage, removeItem, addSlide, removeSlide, reorder, background, backgroundColor, exportBase64, snapshot };
}
window.mdPresentation = { create, load };
})();
