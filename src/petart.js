(function () {
'use strict';

// Arte de las mascotas de MK (SVG 64×64, piso en y=60): criaturas PROPIAS,
// nada de personajes con marca registrada. Siete líneas normales de 3
// etapas y cuatro legendarias (una etapa, con aura). Lo usa pet.js.

const SPECIES = {
  fuego: { names: ['Chispi', 'Chispón', 'Brasadrake'], type: 'Fuego', body: 'biped', acc: 'flame', main: '#ff8a3d', belly: '#ffd89a', dark: '#c9502a', extra: '#ffcf3d', extra2: '#fff3b0' },
  agua: { names: ['Gotín', 'Olaquín', 'Marejón'], type: 'Agua', body: 'drop', main: '#4aa8ff', belly: '#cfe9ff', dark: '#2b72c4', extra: '#8fd3ff' },
  planta: { names: ['Brotito', 'Hojarín', 'Robleón'], type: 'Planta', body: 'bean', acc: 'leaf', main: '#6cc070', belly: '#e0f5cf', dark: '#3d8a44', extra: '#ff7eb6', leaf: '#8bd35f', leaf2: '#a5e27a' },
  electrico: { names: ['Voltín', 'Voltarón', 'Tronador'], type: 'Eléctrico', body: 'biped', acc: 'bolt', main: '#ffd23f', belly: '#fff5c2', dark: '#b8860b', extra: '#fff7a8', extra2: '#ffffff' },
  hielo: { names: ['Copito', 'Escarchín', 'Glaciarca'], type: 'Hielo', body: 'drop', main: '#9fe3ff', belly: '#f2fbff', dark: '#4fa9d6', extra: '#e3f8ff' },
  roca: { names: ['Guijarro', 'Peñasco', 'Montarón'], type: 'Roca', body: 'bean', acc: 'rock', main: '#a38b6d', belly: '#e6d8c3', dark: '#6b5842', extra: '#ffcf3d', leaf: '#8d8d8d', leaf2: '#b3b3b3' },
  fantasma: { names: ['Sombrín', 'Espectrín', 'Umbralord'], type: 'Fantasma', body: 'ghost', main: '#9b7cf0', belly: '#d9ccff', dark: '#5b3fb8', extra: '#ff6bd6' }
};

const LEGENDS = {
  aurorix: { names: ['Aurorix', 'Aurorix', 'Aurorix'], type: 'Legendario · Luz', legendary: true, variant: 'aurorix', main: '#fff4d1', belly: '#ffffff', dark: '#d9a520', extra: '#ffcc33' },
  tempusio: { names: ['Tempusio', 'Tempusio', 'Tempusio'], type: 'Legendario · Tiempo', legendary: true, variant: 'tempusio', main: '#3b4cc0', belly: '#c9d2ff', dark: '#1f2a7a', extra: '#ffd166' },
  titanor: { names: ['Titanor', 'Titanor', 'Titanor'], type: 'Legendario · Tierra', legendary: true, variant: 'titanor', main: '#7a6a4f', belly: '#d9ccb0', dark: '#4a3f2e', extra: '#6cc070' },
  nebulia: { names: ['Nebulia', 'Nebulia', 'Nebulia'], type: 'Legendario · Cosmos', legendary: true, variant: 'nebulia', main: '#6b3fa0', belly: '#e5ccff', dark: '#3d1f66', extra: '#ff7eb6' }
};

const ALL = { ...SPECIES, ...LEGENDS };

function face(cx, cy, mood, scale) {
  const s = scale || 1;
  const dx = 6.5 * s;
  const r = 3.1 * s;
  let eyes;
  if (mood === 'sleep') {
    eyes = `<path d="M${cx - dx - r} ${cy} q${r} ${r * 0.8} ${2 * r} 0 M${cx + dx - r} ${cy} q${r} ${r * 0.8} ${2 * r} 0" stroke="#2b2b2b" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  } else {
    eyes = [cx - dx, cx + dx].map((x) => `<g class="pet-eye"><circle cx="${x}" cy="${cy}" r="${r}" fill="#2b2b2b"/><circle cx="${x + r * 0.35}" cy="${cy - r * 0.4}" r="${r * 0.35}" fill="#fff"/></g>`).join('');
  }
  const my = cy + 6 * s;
  let mouth;
  if (mood === 'sad') mouth = `<path d="M${cx - 3 * s} ${my + 2 * s} q${3 * s} ${-3 * s} ${6 * s} 0" stroke="#2b2b2b" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M${cx + dx + 1} ${cy + 3 * s} q1.5 3 0 4.5 q-1.5 -1.5 0 -4.5z" fill="#7cc4ff"/>`;
  else if (mood === 'happy') mouth = `<path d="M${cx - 3.5 * s} ${my - 1} q${3.5 * s} ${5 * s} ${7 * s} 0z" fill="#8a2f2f"/>`;
  else mouth = `<path d="M${cx - 2.5 * s} ${my} q${2.5 * s} ${2.5 * s} ${5 * s} 0" stroke="#2b2b2b" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  const blush = `<ellipse cx="${cx - dx - 3 * s}" cy="${cy + 4 * s}" rx="${2.2 * s}" ry="${1.3 * s}" fill="#ff6b8a" opacity="0.35"/><ellipse cx="${cx + dx + 3 * s}" cy="${cy + 4 * s}" rx="${2.2 * s}" ry="${1.3 * s}" fill="#ff6b8a" opacity="0.35"/>`;
  return eyes + mouth + blush;
}

function feet(y, spread, c) {
  return `<ellipse cx="${32 - spread}" cy="${y}" rx="5" ry="3" fill="${c}"/><ellipse cx="${32 + spread}" cy="${y}" rx="5" ry="3" fill="${c}"/>`;
}

function flame(x, y, s, c1, c2) {
  return `<path class="pet-flame" d="M${x} ${y - 9 * s} C${x + 5 * s} ${y - 3 * s} ${x + 6 * s} ${y + 1 * s} ${x} ${y + 3 * s} C${x - 6 * s} ${y + 1 * s} ${x - 4 * s} ${y - 4 * s} ${x} ${y - 9 * s}Z" fill="${c1}"/><path d="M${x} ${y - 4 * s} C${x + 2.5 * s} ${y - 1 * s} ${x + 2.5 * s} ${y + 1.5 * s} ${x} ${y + 2.5 * s} C${x - 2.5 * s} ${y + 1.5 * s} ${x - 2 * s} ${y - 1 * s} ${x} ${y - 4 * s}Z" fill="${c2}"/>`;
}

function bolt(x, y, s, c1) {
  return `<path class="pet-flame" d="M${x + 1 * s} ${y - 10 * s} L${x - 4 * s} ${y - 1 * s} L${x} ${y - 1 * s} L${x - 2 * s} ${y + 6 * s} L${x + 5 * s} ${y - 4 * s} L${x + 1 * s} ${y - 4 * s} Z" fill="${c1}" stroke="#b8860b" stroke-width="0.8" stroke-linejoin="round"/>`;
}

function tip(acc, x, y, s, c) {
  return acc === 'bolt' ? bolt(x, y, s, c.extra) : flame(x, y, s, c.extra, c.extra2);
}

function leaf(x, y, angle, size, col) {
  return `<path transform="translate(${x} ${y}) rotate(${angle}) scale(${size})" d="M0 0 C4 -6 10 -7 14 -6 C12 -1 6 3 0 0Z" fill="${col}" stroke="rgba(0,0,0,0.15)" stroke-width="0.6"/>`;
}

function shard(x, y, angle, size, col) {
  return `<path transform="translate(${x} ${y}) rotate(${angle}) scale(${size})" d="M0 0 L5 -9 L11 -7 L13 -1 Z" fill="${col}" stroke="rgba(0,0,0,0.25)" stroke-width="0.6"/>`;
}

function part(acc, x, y, angle, size, col) {
  return acc === 'rock' ? shard(x, y, angle, size, col) : leaf(x, y, angle, size, col);
}

// Bípedo con cola (Fuego, Eléctrico).
function drawBiped(stage, mood, c) {
  const acc = c.acc;
  const ears = acc === 'bolt'
    ? ['M20 27 L14 11 L26 21Z M44 27 L50 11 L38 21Z', 'M19 24 L11 5 L27 17Z M45 24 L53 5 L37 17Z']
    : ['M21 26 L19 15 L27 22Z M43 26 L45 15 L37 22Z', 'M20 24 L15 9 L27 19Z M44 24 L49 9 L37 19Z'];
  if (stage === 1) {
    return feet(57, 7, c.dark) +
      `<ellipse cx="32" cy="43" rx="16" ry="15" fill="${c.main}"/><ellipse cx="32" cy="48" rx="9" ry="7.5" fill="${c.belly}"/>` +
      (acc === 'bolt' ? `<path d="M22 32 L18 22 L27 29Z M42 32 L46 22 L37 29Z" fill="${c.dark}"/>` : '') +
      tip(acc, 32, 27, 0.9, c) + face(32, 40, mood, 0.95);
  }
  if (stage === 2) {
    return `<path d="M46 48 C56 46 58 38 55 32" stroke="${c.main}" stroke-width="5" fill="none" stroke-linecap="round"/>` + tip(acc, 55, 30, 0.8, c) +
      feet(58, 8, c.dark) +
      `<path d="${ears[0]}" fill="${c.dark}"/>` +
      `<ellipse cx="32" cy="41" rx="17" ry="18" fill="${c.main}"/><ellipse cx="32" cy="47" rx="10" ry="9" fill="${c.belly}"/>` +
      face(32, 36, mood, 1);
  }
  return `<path d="M20 36 C6 26 4 16 8 12 C12 20 16 24 22 28Z M44 36 C58 26 60 16 56 12 C52 20 48 24 42 28Z" fill="${c.dark}" opacity="0.9"/>` +
    `<path d="M48 50 C60 50 63 40 60 33" stroke="${c.main}" stroke-width="6" fill="none" stroke-linecap="round"/>` + tip(acc, 60, 31, 1, c) +
    feet(59, 9, c.dark) +
    `<path d="${ears[1]}" fill="${acc === 'bolt' ? c.dark : '#f4e3c0'}"/>` +
    `<ellipse cx="32" cy="39" rx="20" ry="20" fill="${c.main}"/><ellipse cx="32" cy="46" rx="12" ry="11" fill="${c.belly}"/>` +
    `<path d="M22 28 l7 2 M42 28 l-7 2" stroke="${c.dark}" stroke-width="1.6" stroke-linecap="round"/>` +
    face(32, 34, mood, 1.05);
}

// Gota (Agua, Hielo).
function drawDrop(stage, mood, c) {
  const ice = c === SPECIES.hielo;
  const sparkle = ice ? '<path d="M50 14 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5z" fill="#fff" opacity="0.9"/>' : '';
  if (stage === 1) {
    return feet(58, 7, c.dark) +
      `<path d="M32 22 C40 33 48 39 48 47 A16 13 0 0 1 16 47 C16 39 24 33 32 22Z" fill="${c.main}"/><ellipse cx="32" cy="50" rx="9" ry="6" fill="${c.belly}"/>` +
      `<ellipse cx="27" cy="33" rx="2.5" ry="4" fill="#fff" opacity="0.5"/>` + (ice ? '<path d="M30 21 l2 -6 l2 6z" fill="#fff"/>' : '') + face(32, 42, mood, 0.95);
  }
  if (stage === 2) {
    return `<path d="M46 50 C55 50 58 44 60 40 C56 42 54 38 55 34 C52 40 50 44 45 45Z" fill="${c.dark}"/>` +
      feet(58, 8, c.dark) +
      `<path d="M30 22 L38 10 L40 24Z" fill="${ice ? '#ffffff' : c.dark}" ${ice ? `stroke="${c.dark}" stroke-width="0.8"` : ''}/>` +
      `<ellipse cx="32" cy="42" rx="17" ry="17" fill="${c.main}"/><ellipse cx="32" cy="48" rx="10" ry="8" fill="${c.belly}"/>` +
      `<path d="M15 44 C9 42 8 38 10 35 C13 38 15 39 17 40Z M49 44 C55 42 56 38 54 35 C51 38 49 39 47 40Z" fill="${c.extra}"/>` +
      sparkle + face(32, 38, mood, 1);
  }
  return `<path d="M47 50 C58 52 62 44 64 38 C59 41 57 36 58 31 C54 39 51 44 45 45Z" fill="${c.dark}"/>` +
    feet(59, 9, c.dark) +
    `<path d="M22 22 L24 8 L30 20Z M30 20 L33 5 L37 20Z M37 21 L42 9 L44 23Z" fill="${c.extra}" ${ice ? `stroke="${c.dark}" stroke-width="0.8"` : ''}/>` +
    `<ellipse cx="32" cy="40" rx="20" ry="20" fill="${c.main}"/><ellipse cx="32" cy="47" rx="12" ry="10" fill="${c.belly}"/>` +
    `<path d="M12 44 C4 42 2 34 5 29 C9 34 12 36 15 38Z M52 44 C60 42 62 34 59 29 C55 34 52 36 49 38Z" fill="${c.extra}"/>` +
    `<path d="M24 52 q2 2 4 0 M36 52 q2 2 4 0" stroke="${c.dark}" stroke-width="1" fill="none"/>` +
    sparkle + face(32, 35, mood, 1.05);
}

// Poroto con hojas o piedras (Planta, Roca).
function drawBean(stage, mood, c) {
  const a = c.acc;
  const rock = a === 'rock';
  const marks = rock ? `<path d="M22 50 l4 -3 M40 44 l3 3 M28 30 l3 1" stroke="${c.dark}" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>` : '';
  if (stage === 1) {
    return feet(57, 7, c.dark) +
      (rock ? '' : `<path d="M32 30 C32 26 33 22 35 19" stroke="${c.dark}" stroke-width="1.8" fill="none"/>`) +
      part(a, rock ? 29 : 35, rock ? 31 : 20, -30, 0.9, c.leaf) + part(a, 34, 21, 200, 0.7, c.leaf) +
      `<ellipse cx="32" cy="44" rx="15" ry="14" fill="${c.main}"/><ellipse cx="32" cy="49" rx="8.5" ry="7" fill="${c.belly}"/>` +
      marks + face(32, 41, mood, 0.95);
  }
  if (stage === 2) {
    return feet(58, 8, c.dark) +
      part(a, 32, 25, -60, 1.1, c.leaf) + part(a, 32, 25, 240, 1.1, c.leaf) + part(a, 32, 24, -95, 0.8, c.leaf2) +
      `<ellipse cx="32" cy="42" rx="17" ry="17" fill="${c.main}"/><ellipse cx="32" cy="48" rx="10" ry="8" fill="${c.belly}"/>` +
      part(a, 16, 43, 160, 0.8, c.leaf) + part(a, 48, 43, 20, 0.8, c.leaf) +
      marks + face(32, 38, mood, 1);
  }
  const top = rock
    ? `<g transform="translate(43 20)"><path d="M-3 3 L0 -5 L3 3Z" fill="${c.extra}"/><circle r="1.5" fill="#fff"/></g>`
    : `<g transform="translate(43 20)"><circle r="3" cx="0" cy="-3" fill="${c.extra}"/><circle r="3" cx="3" cy="0" fill="${c.extra}"/><circle r="3" cx="0" cy="3" fill="${c.extra}"/><circle r="3" cx="-3" cy="0" fill="${c.extra}"/><circle r="2" fill="#ffe066"/></g>`;
  return feet(59, 9, c.dark) +
    part(a, 32, 22, -40, 1.3, c.leaf) + part(a, 32, 22, 220, 1.3, c.leaf) + part(a, 32, 21, -80, 1.1, c.leaf2) + part(a, 32, 21, 260, 1.1, c.leaf2) + part(a, 32, 20, -115, 0.9, c.leaf) +
    top +
    `<ellipse cx="32" cy="40" rx="20" ry="20" fill="${c.main}"/><ellipse cx="32" cy="47" rx="12" ry="10" fill="${c.belly}"/>` +
    `<path d="M26 47 l3 4 M38 47 l-3 4 M32 45 v6" stroke="${c.dark}" stroke-width="1" opacity="0.5"/>` +
    part(a, 13, 42, 170, 1, c.leaf) + part(a, 51, 42, 10, 1, c.leaf) +
    marks + face(32, 35, mood, 1.05);
}

// Fantasma: flota, sin patas, borde ondulado.
function drawGhost(stage, mood, c) {
  const r = [0, 14, 17, 20][stage];
  const cy = [0, 40, 38, 36][stage];
  const bottom = cy + r + 4;
  const w = r;
  const wave = `M${32 - w} ${cy} A${w} ${w} 0 0 1 ${32 + w} ${cy} L${32 + w} ${bottom} q-${w / 4} -5 -${w / 2} 0 q-${w / 4} 5 -${w / 2} 0 q-${w / 4} -5 -${w / 2} 0 q-${w / 4} 5 -${w / 2} 0 Z`;
  let extra = '';
  if (stage >= 2) extra += `<path d="M${32 - w + 3} ${cy - w + 6} L${32 - w} ${cy - w - 4} L${32 - w + 9} ${cy - w + 2}Z M${32 + w - 3} ${cy - w + 6} L${32 + w} ${cy - w - 4} L${32 + w - 9} ${cy - w + 2}Z" fill="${c.dark}"/>`;
  if (stage === 3) extra += `<path d="M22 ${cy - w + 1} L26 ${cy - w - 7} L32 ${cy - w - 2} L38 ${cy - w - 7} L42 ${cy - w + 1}Z" fill="${c.extra}"/><path d="M${32 - w - 2} ${cy + 6} q-8 2 -10 8 M${32 + w + 2} ${cy + 6} q8 2 10 8" stroke="${c.main}" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.85"/>`;
  return `<ellipse cx="32" cy="61" rx="10" ry="2" fill="${c.dark}" opacity="0.25"/>` +
    `<g opacity="0.93">${extra}<path d="${wave}" fill="${c.main}"/><ellipse cx="32" cy="${cy + 6}" rx="${w * 0.55}" ry="${w * 0.45}" fill="${c.belly}" opacity="0.7"/></g>` +
    face(32, cy - 1, mood, [0, 0.95, 1, 1.05][stage]);
}

// Legendarios: cuerpo grande con aura y un rasgo propio cada uno.
function drawLegend(mood, c) {
  const v = c.variant;
  let back = '';
  let front = '';
  if (v === 'aurorix') {
    back = `<ellipse cx="32" cy="12" rx="11" ry="3" fill="none" stroke="${c.extra}" stroke-width="2"/>` +
      `<path d="M18 38 C2 30 0 16 6 8 C10 18 14 24 22 30Z M46 38 C62 30 64 16 58 8 C54 18 50 24 42 30Z" fill="#fff" stroke="${c.extra}" stroke-width="1"/>`;
    front = `<path d="M32 42 l2 4 l4 0.5 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 l4 -0.5z" fill="${c.extra}"/>`;
  } else if (v === 'tempusio') {
    back = `<path d="M16 34 C4 30 2 20 8 14 C10 22 14 26 20 28Z M48 34 C60 30 62 20 56 14 C54 22 50 26 44 28Z" fill="${c.dark}"/><path d="M28 16 l4 -9 l4 9z" fill="${c.extra}"/>`;
    front = `<circle cx="32" cy="46" r="7" fill="#fff" stroke="${c.extra}" stroke-width="1.5"/><path d="M32 46 v-4.5 M32 46 l3.5 2" stroke="#1f2a7a" stroke-width="1.3" stroke-linecap="round"/>`;
  } else if (v === 'titanor') {
    back = `<path d="M14 28 L22 12 L30 24 L36 8 L44 22 L50 14 L52 30Z" fill="${c.dark}"/><path d="M34 10 l2 -4 l2 4z" fill="#fff"/>`;
    front = `<path d="M22 44 h8 v6 h-8z M34 44 h8 v6 h-8z" fill="${c.dark}" opacity="0.5"/><path d="M40 20 C44 14 50 14 52 18 C48 18 44 20 42 24Z" fill="${c.extra}"/>`;
  } else {
    back = `<circle cx="32" cy="36" r="27" fill="${c.extra}" opacity="0.12"/><path d="M16 36 C4 26 6 14 12 10 C13 20 18 26 22 30Z M48 36 C60 26 58 14 52 10 C51 20 46 26 42 30Z" fill="${c.dark}"/>`;
    front = '<circle cx="24" cy="46" r="1.2" fill="#fff"/><circle cx="40" cy="44" r="1.5" fill="#fff"/><circle cx="33" cy="52" r="1" fill="#fff"/><path d="M44 50 l1 2 l2 0.3 l-1.6 1.4 l0.5 2 l-1.9 -1 l-1.9 1 l0.5 -2 l-1.6 -1.4 l2 -0.3z" fill="#ffe066"/>';
  }
  return `<circle class="pet-aura" cx="32" cy="38" r="26" fill="${c.extra}" opacity="0.18"/>` + back +
    feet(59, 9, c.dark) +
    `<ellipse cx="32" cy="39" rx="19" ry="20" fill="${c.main}"/><ellipse cx="32" cy="46" rx="12" ry="11" fill="${c.belly}"/>` +
    front + face(32, 34, mood, 1.05);
}

function drawSpecies(key, stage, mood, shiny) {
  const c = ALL[key] || SPECIES.fuego;
  let body;
  if (c.legendary) body = drawLegend(mood, c);
  else if (c.body === 'drop') body = drawDrop(stage, mood, c);
  else if (c.body === 'bean') body = drawBean(stage, mood, c);
  else if (c.body === 'ghost') body = drawGhost(stage, mood, c);
  else body = drawBiped(stage, mood, c);
  return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true" class="${shiny ? 'pet-shiny' : ''}"><ellipse class="pet-shadow" cx="32" cy="61" rx="14" ry="2.5" fill="rgba(0,0,0,0.18)"/><g class="pet-body">${body}</g></svg>`;
}

// Huevo: normal (manchas) o legendario (dorado); progress 0..1 lo agrieta.
function drawEgg(legendary, progress) {
  const main = legendary ? '#ffe28a' : '#fff8ec';
  const spot = legendary ? '#ffb703' : '#9ad0f5';
  const edge = legendary ? '#d9a520' : '#c8b89a';
  const cracks = progress > 0.4 ? `<path d="M22 34 l4 3 l3 -4 l4 4 l3 -3" stroke="#6b5842" stroke-width="1" fill="none"/>` : '';
  const cracks2 = progress > 0.75 ? `<path d="M30 20 l2 4 l-2 3 M38 42 l3 3 l-1 4" stroke="#6b5842" stroke-width="1" fill="none"/>` : '';
  const glow = legendary ? `<ellipse cx="32" cy="38" rx="24" ry="26" fill="#ffcc33" opacity="0.18"/><path d="M50 14 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5z" fill="#fff"/>` : '';
  return `<svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">${glow}<ellipse cx="32" cy="61" rx="12" ry="2.5" fill="rgba(0,0,0,0.18)"/>` +
    `<path d="M32 12 C44 12 50 30 50 42 C50 53 42 60 32 60 C22 60 14 53 14 42 C14 30 20 12 32 12Z" fill="${main}" stroke="${edge}" stroke-width="1.2"/>` +
    `<ellipse cx="25" cy="30" rx="4" ry="5" fill="${spot}"/><ellipse cx="40" cy="44" rx="5" ry="4" fill="${spot}"/><ellipse cx="34" cy="22" rx="2.5" ry="2" fill="${spot}"/>` +
    cracks + cracks2 + '</svg>';
}

window.mdPetArt = { SPECIES, LEGENDS, ALL, drawSpecies, drawEgg };

})();
