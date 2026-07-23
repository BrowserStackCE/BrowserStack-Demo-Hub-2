const fs = require('fs');
const path = require('path');
const dir = '/Users/yashdalwani/Documents/BrowserStack-Demo-Hub';
const svg = fs.readFileSync(path.join(dir, 'product-section-color-icons-v6.svg'), 'utf8');

// 1. Parse all gradient definitions
const gradDefs = {};
const gradDefRe = /<linearGradient id="(paint\d+_linear_1013_98)"[\s\S]*?<\/linearGradient>/g;
let m;
while ((m = gradDefRe.exec(svg)) !== null) {
  const id = m[0].match(/id="(paint\d+_linear_1013_98)"/)[1];
  gradDefs[id] = m[0];
}

// 2. Parse gradient y-positions to identify icon groups
const gradYRe = /<linearGradient id="(paint\d+_linear_1013_98)" x1="[\d.]+?" y1="([\d.]+?)"/g;
const grads = [];
while ((m = gradYRe.exec(svg)) !== null) grads.push({ id: m[1], y: parseFloat(m[2]) });

const iconGroups = [];
let group = [grads[0]];
for (let i = 1; i < grads.length; i++) {
  if (grads[i].y - grads[i - 1].y > 20) { iconGroups.push(group); group = [grads[i]]; }
  else group.push(grads[i]);
}
iconGroups.push(group);

// 3. Collect all drawable elements with their position in the SVG
const elemRe = /<(path|ellipse|circle|rect)(\s[^>]*)\/>/g;
const allElems = [];
while ((m = elemRe.exec(svg)) !== null) {
  allElems.push({ tag: m[0], pos: m.index });
}

// 4. For each icon group, find the SVG slice between first and last element referencing its paints
const iconNames = [
  'icon-01', 'icon-02', 'icon-03', 'icon-04-lca', 'icon-05', 'icon-06',
  'icon-07', 'icon-08', 'icon-09', 'icon-10', 'icon-11', 'icon-12',
  'icon-13', 'icon-14-live', 'icon-15', 'icon-16', 'icon-17', 'icon-18',
  'icon-19', 'icon-20', 'icon-21', 'icon-22', 'icon-23'
];

fs.mkdirSync(path.join(dir, 'icons'), { recursive: true });

iconGroups.forEach((grp, idx) => {
  const paintIds = new Set(grp.map(g => g.id));
  const minY = Math.min(...grp.map(g => g.y));
  const nextMinY = idx + 1 < iconGroups.length
    ? Math.min(...iconGroups[idx + 1].map(g => g.y))
    : 1677;
  const iconY = Math.max(0, minY - 14);
  const iconH = Math.min(44, nextMinY - iconY);

  // Find positions of elements referencing this icon's paints
  const myElems = allElems.filter(e => {
    for (const pid of paintIds) {
      if (e.tag.includes(pid)) return true;
    }
    return false;
  });

  if (myElems.length === 0) {
    console.log(`⚠ ${iconNames[idx]}: no elements found`);
    return;
  }

  const firstPos = myElems[0].pos;
  const lastElem = myElems[myElems.length - 1];
  const lastPos = lastElem.pos + lastElem.tag.length;

  // Grab all elements in the SVG between firstPos and lastPos (includes white overlays)
  const sliceElems = allElems.filter(e => e.pos >= firstPos && e.pos <= lastPos);

  // Collect gradient defs for this icon
  const prefix = 'i' + (idx + 1);
  let defsOut = grp.map(g => (gradDefs[g.id] || '')).join('\n    ')
    .replace(/paint(\d+)_linear_1013_98/g, prefix + '_p$1');
  let contentOut = sliceElems.map(e => e.tag).join('\n    ')
    .replace(/paint(\d+)_linear_1013_98/g, prefix + '_p$1');

  const out = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 ' + iconH.toFixed(1) + '" fill="none">',
    '  <defs>',
    '    ' + defsOut,
    '  </defs>',
    '  <g transform="translate(0,' + (-iconY).toFixed(1) + ')">',
    '    ' + contentOut,
    '  </g>',
    '</svg>'
  ].join('\n');

  const fname = path.join(dir, 'icons', iconNames[idx] + '.svg');
  fs.writeFileSync(fname, out);
  console.log('✓ ' + iconNames[idx] + '.svg  (' + sliceElems.length + ' elems, y=' + iconY.toFixed(0) + ')');
});