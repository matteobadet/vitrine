import { Scene, band, cloud, dome, facet, fan, fbm, lupin, mountainRange, mulberry, pine } from './lowpoly';
import type { Poly, Puff, Vec } from './lowpoly';

export type Variant = 'lake' | 'summit' | 'bivouac';

const W = 1440;
const H = 800;

function stops(c: string[]) {
  return c.map((col, i) => `<stop offset="${(i / (c.length - 1)).toFixed(2)}" stop-color="${col}"/>`).join('');
}

function sky(day: string[], night: string[], hazeDay: string, hazeNight: string) {
  return `<defs>
<linearGradient id="skyD" x1="0" y1="0" x2="0" y2="1">${stops(day)}</linearGradient>
<linearGradient id="skyN" x1="0" y1="0" x2="0" y2="1">${stops(night)}</linearGradient>
<linearGradient id="hazeD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hazeDay}" stop-opacity="0"/><stop offset="1" stop-color="${hazeDay}" stop-opacity="0.75"/></linearGradient>
<linearGradient id="hazeN" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hazeNight}" stop-opacity="0"/><stop offset="1" stop-color="${hazeNight}" stop-opacity="0.75"/></linearGradient>
<radialGradient id="sunGlow"><stop offset="0" stop-color="#fff4d6" stop-opacity="0.95"/><stop offset="0.35" stop-color="#ffe2b8" stop-opacity="0.45"/><stop offset="1" stop-color="#ffd6b0" stop-opacity="0"/></radialGradient>
<radialGradient id="moonGlow"><stop offset="0" stop-color="#e9ecff" stop-opacity="0.55"/><stop offset="1" stop-color="#e9ecff" stop-opacity="0"/></radialGradient>
<radialGradient id="fireGlow"><stop offset="0" stop-color="#ffb24d" stop-opacity="0.9"/><stop offset="0.5" stop-color="#ff8a3d" stop-opacity="0.35"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#skyD)"/>
<rect class="dn-night" width="${W}" height="${H}" fill="url(#skyN)"/>`;
}

function haze(y: number, h: number) {
  return `<rect class="dn-day" x="0" y="${y}" width="${W}" height="${h}" fill="url(#hazeD)"/><rect class="dn-night" x="0" y="${y}" width="${W}" height="${h}" fill="url(#hazeN)"/>`;
}

function sun(x: number, y: number, r = 42) {
  return `<g class="dn-day"><circle cx="${x}" cy="${y}" r="${r * 4}" fill="url(#sunGlow)"/><circle cx="${x}" cy="${y}" r="${r}" fill="#fff4dc"/></g>`;
}

function moonStars(mx: number, my: number, n: number, seed: number, maxY: number) {
  const r = mulberry(seed);
  let s = `<g class="dn-night"><circle cx="${mx}" cy="${my}" r="130" fill="url(#moonGlow)"/><circle cx="${mx}" cy="${my}" r="36" fill="#f2efe4"/>`;
  s += `<circle cx="${mx - 10}" cy="${my - 8}" r="7" fill="#dcd8cc" opacity="0.7"/><circle cx="${mx + 12}" cy="${my + 9}" r="5" fill="#dcd8cc" opacity="0.6"/><circle cx="${mx + 4}" cy="${my - 16}" r="3" fill="#dcd8cc" opacity="0.6"/>`;
  for (let i = 0; i < n; i++) {
    const x = r() * W;
    const y = r() * maxY;
    const rad = 0.7 + r() * 1.6;
    const tw = r() < 0.45 ? ` class="tw" style="animation-delay:${(r() * 4).toFixed(2)}s"` : '';
    s += `<circle${tw} cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rad.toFixed(1)}" fill="#f4f1ff"/>`;
  }
  return s + '</g>';
}

function puffRow(x0: number, x1: number, topY: number, spread: number, rMin: number, rMax: number, seed: number): Puff[] {
  const r = mulberry(seed);
  const out: Puff[] = [];
  for (let x = x0; x < x1; x += rMin * 0.9 + r() * rMin * 0.6) {
    const rad = rMin + r() * (rMax - rMin);
    out.push({ x, y: topY + rad + (r() - 0.5) * spread, r: rad });
  }
  return out;
}

function glints(x0: number, x1: number, y0: number, y1: number, n: number, seed: number) {
  const r = mulberry(seed);
  let s = '<g class="glints">';
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0);
    const y = y0 + r() * (y1 - y0);
    const w = 6 + r() * 14;
    s += `<polygon class="gl" style="animation-delay:${(r() * 5).toFixed(2)}s" points="${x.toFixed(0)},${y.toFixed(0)} ${(x + w).toFixed(0)},${(y + 1.5).toFixed(0)} ${(x + w * 0.4).toFixed(0)},${(y + 3).toFixed(0)}"/>`;
  }
  return s + '</g>';
}

function tent(x: number, base: number, w: number, h: number): { polys: Poly[]; raw: string } {
  const F: Vec = [x, base - h];
  const FL: Vec = [x - w / 2, base];
  const FR: Vec = [x + w / 2, base];
  const B: Vec = [x + w * 0.55, base - h * 0.92];
  const BR: Vec = [x + w * 1.05, base - 5];
  const D: Vec = [x, base - h * 0.6];
  const DL: Vec = [x - w * 0.16, base];
  const DR: Vec = [x + w * 0.16, base];
  const flap: Vec = [x - w * 0.3, base - h * 0.16];
  const polys: Poly[] = [
    { pts: [F, B, FR], mat: 'n', s: 0.34, a: 1 },
    { pts: [B, BR, FR], mat: 'n', s: 0.22, a: 0.3 },
    { pts: [F, FL, DL, D], mat: 'n', s: 0.86, a: 1 },
    { pts: [F, D, DR, FR], mat: 'n', s: 0.64, a: 1 },
    { pts: [D, DL, DR], mat: 'k', s: 0.5, a: 0 },
    { pts: [D, DL, flap], mat: 'n', s: 0.98, a: 0 },
  ];
  const raw = `<ellipse cx="${x + w * 0.3}" cy="${base + 3}" rx="${w * 0.95}" ry="${h * 0.08}" fill="#10172a" opacity="0.28"/>`;
  const ropes = `<g stroke="#2d2233" stroke-width="1.6" opacity="0.55"><line x1="${F[0]}" y1="${F[1]}" x2="${x - w * 0.62}" y2="${base + 4}"/><line x1="${B[0]}" y1="${B[1]}" x2="${x + w * 1.4}" y2="${base + 2}"/></g>`;
  return { polys, raw: raw + ropes };
}

function campfire(x: number, y: number, k = 1): { under: string; stones: Poly[]; logs: Poly[]; flames: string } {
  const under = `<ellipse class="dn-day" cx="${x}" cy="${y + 8 * k}" rx="${110 * k}" ry="${30 * k}" fill="url(#fireGlow)" opacity="0.55"/><ellipse class="dn-night" cx="${x}" cy="${y + 8 * k}" rx="${190 * k}" ry="${55 * k}" fill="url(#fireGlow)"/>`;
  const stones: Poly[] = [];
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * Math.PI * 2;
    const sx = x + Math.cos(t) * 46 * k;
    const sy = y + 14 * k + Math.sin(t) * 12 * k;
    stones.push(...dome({ cx: sx, base: sy + 6 * k, w: 12 * k, h: 9 * k, seed: 900 + i, mat: 's', step: 7 * k }));
  }
  const logs: Poly[] = [
    { pts: [[x - 40 * k, y + 12 * k], [x + 34 * k, y - 6 * k], [x + 38 * k, y + 2 * k], [x - 36 * k, y + 20 * k]], mat: 'w', s: 0.55, a: 0 },
    { pts: [[x - 36 * k, y - 4 * k], [x + 40 * k, y + 14 * k], [x + 36 * k, y + 22 * k], [x - 40 * k, y + 4 * k]], mat: 'w', s: 0.35, a: 0 },
    { pts: [[x - 38 * k, y + 8 * k], [x + 38 * k, y + 8 * k], [x + 38 * k, y + 15 * k], [x - 38 * k, y + 15 * k]], mat: 'w', s: 0.75, a: 0 },
  ];
  const flames = `<g transform="translate(${x} ${y}) scale(${k * 1.25})">
<g class="flames">
<path class="flame flame-1" d="M0 4 C -16 -10 -9 -34 0 -54 C 9 -34 16 -10 0 4 Z" fill="#d9431f"/>
<path class="flame flame-2" d="M-11 4 C -20 -8 -14 -24 -9 -38 C -2 -22 3 -8 -11 4 Z" fill="#f06a2a"/>
<path class="flame flame-3" d="M11 4 C 2 -8 9 -24 13 -36 C 20 -20 22 -6 11 4 Z" fill="#f06a2a"/>
<path class="flame flame-4" d="M0 3 C -8 -6 -5 -18 0 -28 C 5 -18 8 -6 0 3 Z" fill="#ffd166"/>
</g>
<g class="embers" fill="#ffc24d">
<circle class="ember ember-1" cx="-6" cy="-32" r="2.2"/><circle class="ember ember-2" cx="8" cy="-26" r="1.8"/>
<circle class="ember ember-3" cx="-2" cy="-42" r="1.6"/><circle class="ember ember-4" cx="14" cy="-36" r="1.5"/>
</g>
<g class="sparks" fill="#ffd166">
<circle class="spark spark-1" cx="-4" cy="-22" r="1.8"/><circle class="spark spark-2" cx="10" cy="-20" r="1.6"/>
<circle class="spark spark-3" cx="-14" cy="-16" r="1.5"/><circle class="spark spark-4" cx="16" cy="-24" r="1.4"/>
<circle class="spark spark-5" cx="0" cy="-30" r="1.7"/><circle class="spark spark-6" cx="6" cy="-14" r="1.3"/>
</g>
</g>`;
  return { under, stones, logs, flames };
}

function sway(S: Scene, polys: Poly[], seed: number) {
  const r = mulberry(seed);
  S.polys(polys, ` class="sway" style="animation-delay:-${(r() * 5).toFixed(2)}s"`);
}

// ---------------------------------------------------------------------------
// Accueil : vallee avec lac, ilot de sapins, bivouac sur la rive droite

function lake(): Scene {
  const S = new Scene();
  S.raw(sky(['#6c99e4', '#a3b6ed', '#d3bfea', '#f5cfd6'], ['#060a22', '#141b47', '#2c2c63', '#44396f'], '#f3d0dc', '#3a3470'));
  S.raw(sun(1215, 150));
  S.raw(moonStars(1215, 140, 90, 5, 430));

  S.polys(cloud([{ x: 300, y: 318, r: 34 }, { x: 350, y: 300, r: 46 }, { x: 405, y: 316, r: 32 }], 340, 11), ' class="drift"');
  S.polys(cloud([{ x: 1285, y: 262, r: 30 }, { x: 1330, y: 245, r: 42 }, { x: 1380, y: 262, r: 28 }], 280, 12), ' class="drift d2"');

  const far = mountainRange({
    x0: -40,
    x1: 1480,
    base: 575,
    peaks: [
      { x: 80, h: 230, k: 0.95 },
      { x: 290, h: 300, k: 1.0 },
      { x: 380, h: 250, k: 1.4 },
      { x: 540, h: 260, k: 1.1 },
      { x: 700, h: 340, k: 1.05 },
      { x: 790, h: 300, k: 1.45 },
      { x: 935, h: 425, k: 0.95 },
      { x: 1015, h: 360, k: 1.4 },
      { x: 1125, h: 395, k: 1.1 },
      { x: 1255, h: 330, k: 1.2 },
      { x: 1410, h: 280, k: 1.0 },
    ],
    jag: 26,
    seed: 21,
    mat: 'f',
    step: 52,
    noise: 14,
  });
  S.polys(far.polys);
  S.raw(haze(380, 200));

  S.polys(
    cloud(
      [
        { x: 520, y: 522, r: 30 },
        { x: 575, y: 500, r: 42 },
        { x: 635, y: 490, r: 50 },
        { x: 698, y: 506, r: 38 },
        { x: 745, y: 524, r: 26 },
      ],
      552,
      32,
    ),
    ' class="drift d3"',
  );
  S.polys(
    cloud(
      [
        { x: 1000, y: 516, r: 28 },
        { x: 1052, y: 494, r: 44 },
        { x: 1112, y: 484, r: 52 },
        { x: 1172, y: 502, r: 38 },
        { x: 1218, y: 520, r: 26 },
      ],
      548,
      34,
    ),
    ' class="drift"',
  );

  const midL = mountainRange({
    x0: -40,
    x1: 600,
    base: 612,
    peaks: [
      { x: 110, h: 210, k: 0.85 },
      { x: 320, h: 150, k: 1.0 },
      { x: 480, h: 105, k: 1.1 },
    ],
    jag: 18,
    seed: 41,
    mat: 'm',
    step: 44,
    noise: 12,
  });
  S.polys(midL.polys);
  const midR = mountainRange({
    x0: 1200,
    x1: 1480,
    base: 612,
    peaks: [
      { x: 1340, h: 180, k: 0.95 },
      { x: 1460, h: 150, k: 1 },
    ],
    jag: 18,
    seed: 42,
    mat: 'm',
    step: 44,
    noise: 12,
  });
  S.polys(midR.polys);

  // rive lointaine
  S.polys(
    band({
      top: (x) => 600 - 16 * (0.5 + 0.5 * Math.sin(x / 95) + 0.3 * Math.sin(x / 37 + 1)),
      x0: -20,
      x1: 1460,
      bottom: 628,
      step: 26,
      seed: 51,
      mat: 'h',
      depth: 7,
      rim: 22,
    }),
  );
  for (let i = 0, rr = mulberry(52); i < 34; i++) {
    const x = rr() * 1440;
    if (x > 760 && x < 1000) continue;
    S.polys(pine(x, 606 + rr() * 6, 34 + rr() * 30, 11 + rr() * 5, 520 + i, 'u', 2));
  }

  // lac + reflet des sommets
  const lakeOutline: Vec[] = [
    [-20, 618],
    [1460, 618],
    [1460, 790],
    [-20, 790],
  ];
  S.polys(
    facet({
      outline: lakeOutline,
      step: 52,
      z: (x, y) => (fbm(x / 140, y / 30, 61) - 0.5) * 34,
      mat: 'l',
      seed: 61,
      alt: (_x, y) => 1 - (y - 618) / 110,
      bias: 0.55,
      gain: 1.1,
      jitter: 0.06,
    }),
  );
  const refl = far.outline.map(([x, y]) => `${Math.round(x)},${Math.round(2 * 618 - y)}`).join(' ');
  S.raw(
    `<clipPath id="lakeClip"><rect x="0" y="618" width="${W}" height="180"/></clipPath><g clip-path="url(#lakeClip)"><polygon class="dn-day" points="${refl}" fill="#c9b6e8" opacity="0.28"/><polygon class="dn-night" points="${refl}" fill="#2c3366" opacity="0.4"/></g>`,
  );
  S.raw(glints(420, 1100, 628, 715, 34, 62));

  // ilot de sapins
  S.polys(dome({ cx: 840, base: 684, w: 140, h: 62, seed: 71, mat: 'i', step: 22 }));
  S.polys(dome({ cx: 955, base: 690, w: 86, h: 42, seed: 72, mat: 'i', step: 20 }));
  S.polys(dome({ cx: 760, base: 692, w: 70, h: 28, seed: 73, mat: 'i', step: 18 }));
  S.polys(pine(790, 648, 118, 30, 81, 't', 4));
  S.polys(pine(842, 640, 176, 40, 82, 't', 5));
  S.polys(pine(893, 646, 140, 34, 83, 't', 4));
  S.polys(pine(950, 660, 98, 26, 84, 't', 4));

  // prairie de premier plan : haute a gauche (sous le texte), basse au centre, remonte a droite
  const fg = (x: number) => {
    if (x < 560) return 668 + (x / 560) * 42 + 8 * Math.sin(x / 70);
    if (x < 1000) return 712 + 32 * Math.sin(((x - 560) / 440) * Math.PI);
    return 712 - (x - 1000) * 0.14 + 6 * Math.sin(x / 55);
  };
  S.polys(band({ top: fg, x0: -20, x1: 1460, bottom: 812, step: 44, seed: 91, mat: 'g', depth: 16, noise: 40, rim: 70 }));

  // bivouac sur la rive droite
  const t = tent(1245, 680, 150, 118);
  S.raw(t.raw);
  S.polys(t.polys);
  const fire = campfire(1095, 718, 0.9);
  S.raw(fire.under);
  S.polys(fire.stones);
  S.polys(fire.logs);
  S.raw(fire.flames);
  S.polys(dome({ cx: 1165, base: 732, w: 30, h: 20, seed: 95, mat: 'r', step: 12 }));

  // grands sapins qui cadrent la droite
  S.polys(pine(1380, 790, 330, 78, 101, 't', 5));
  S.polys(pine(1448, 805, 400, 92, 102, 't', 6));
  S.polys(pine(1330, 740, 170, 44, 103, 't', 4));

  // fleurs de premier plan
  const fr = mulberry(111);
  for (let i = 0; i < 7; i++) sway(S, lupin(1150 + i * 30 + fr() * 14, 805, 120 + fr() * 70, 120 + i), 120 + i);
  sway(S, fan(760, 812, 6, 120, 2.0, 11, 'o', 131), 131);
  sway(S, fan(880, 815, 5, 95, 1.8, 10, 'o', 132), 132);
  sway(S, fan(1030, 812, 5, 80, 1.9, 9, 'e', 133), 133);
  for (let i = 0; i < 4; i++) sway(S, lupin(40 + i * 45 + fr() * 12, 805, 100 + fr() * 60, 140 + i), 140 + i);
  sway(S, fan(260, 815, 6, 110, 2.1, 11, 'o', 151), 151);
  return S;
}

// ---------------------------------------------------------------------------
// A propos : sommet au-dessus d'une mer de nuages, cairn et drapeau

function summit(): Scene {
  const S = new Scene();
  S.raw(sky(['#5987dc', '#98afeb', '#dcbcdc', '#ffd4b2'], ['#050920', '#121943', '#262a5e', '#3b3469'], '#ffd8c2', '#34306a'));
  S.raw(sun(1060, 468, 50));
  S.raw(moonStars(1370, 105, 110, 6, 470));

  const far = mountainRange({
    x0: -40,
    x1: 1480,
    base: 560,
    peaks: [
      { x: 160, h: 220, k: 1.3 },
      { x: 350, h: 280, k: 1.2 },
      { x: 430, h: 230, k: 1.6 },
      { x: 760, h: 290, k: 1.25 },
      { x: 870, h: 345, k: 1.25 },
      { x: 950, h: 290, k: 1.7 },
      { x: 1200, h: 395, k: 1.1 },
      { x: 1300, h: 320, k: 1.45 },
      { x: 1430, h: 250, k: 1.2 },
    ],
    jag: 30,
    seed: 201,
    mat: 'f',
    step: 50,
    noise: 14,
  });
  S.polys(far.polys);
  S.raw(haze(360, 190));

  S.polys(cloud(puffRow(-80, 1540, 430, 70, 38, 84, 211), 700, 212, 34, 'c', 0.5), ' class="drift d3"');

  const midA = mountainRange({
    x0: 480,
    x1: 800,
    base: 610,
    peaks: [
      { x: 610, h: 200, k: 1.3 },
      { x: 700, h: 150, k: 1.6 },
    ],
    jag: 20,
    seed: 221,
    mat: 'm',
    step: 40,
    noise: 12,
  });
  S.polys(midA.polys);
  const midB = mountainRange({
    x0: 900,
    x1: 1300,
    base: 620,
    peaks: [
      { x: 1050, h: 230, k: 1.2 },
      { x: 1140, h: 175, k: 1.55 },
      { x: 1220, h: 120, k: 1.5 },
    ],
    jag: 20,
    seed: 222,
    mat: 'm',
    step: 40,
    noise: 12,
  });
  S.polys(midB.polys);

  S.polys(cloud(puffRow(-80, 1540, 548, 70, 36, 80, 231), 800, 232, 32, 'c', 0.5), ' class="drift"');

  // arete sommitale au premier plan
  const ridge: Vec[] = [
    [560, 812],
    [640, 764],
    [730, 738],
    [810, 716],
    [890, 692],
    [960, 664],
    [1010, 646],
    [1060, 634],
    [1110, 644],
    [1170, 656],
    [1235, 642],
    [1300, 620],
    [1362, 632],
    [1420, 624],
    [1470, 642],
    [1470, 812],
  ];
  const cones = [
    { x: 1060, h: 180, k: 0.9 },
    { x: 1300, h: 195, k: 0.8 },
    { x: 820, h: 90, k: 0.7 },
  ];
  const Hc = (x: number) => Math.max(0, ...cones.map((c) => c.h - Math.abs(x - c.x) * c.k));
  S.polys(
    facet({
      outline: ridge,
      step: 40,
      z: (x, y) => 1.3 * Hc(x) + 0.35 * (y - 812) + (fbm(x / 70, y / 70, 241) - 0.5) * 60,
      mat: 'r',
      seed: 241,
      alt: (_x, y) => (812 - y) / 190,
    }),
  );
  const left: Vec[] = [
    [-30, 812],
    [-30, 712],
    [70, 700],
    [190, 716],
    [310, 738],
    [430, 758],
    [560, 780],
    [660, 812],
  ];
  S.polys(
    facet({
      outline: left,
      step: 40,
      z: (x, y) => 0.5 * (y - 812) - Math.abs(x - 70) * 0.3 + (fbm(x / 70, y / 70, 242) - 0.5) * 60,
      mat: 'r',
      seed: 242,
      alt: (_x, y) => (812 - y) / 110,
    }),
  );

  // cairn et drapeau
  const cairn: [number, number, number, number][] = [
    [1060, 640, 34, 18],
    [1058, 624, 27, 15],
    [1062, 611, 21, 12],
    [1059, 600, 15, 10],
    [1061, 592, 9, 7],
  ];
  cairn.forEach(([cx, base, w, h], i) => S.polys(dome({ cx, base, w, h, seed: 250 + i, mat: 's', step: 9 })));
  S.raw(
    `<line x1="1112" y1="648" x2="1112" y2="566" stroke="#4d3526" stroke-width="3" stroke-linecap="round"/><polygon class="flag" points="1113,568 1162,580 1113,594" fill="#e2587a"/><polygon class="flag" points="1113,581 1162,580 1113,594" fill="#b83f60"/>`,
  );

  // touffes d'herbe alpine et edelweiss
  const gr = mulberry(261);
  for (let i = 0; i < 16; i++) {
    const x = 640 + gr() * 820;
    const y = 700 + gr() * 90;
    if (x > 1030 && x < 1130 && y < 700) continue;
    sway(S, fan(x, y, 4, 22 + gr() * 18, 1.6, 3, 'e', 270 + i), 270 + i);
  }
  let flowers = '<g class="edel">';
  for (let i = 0; i < 10; i++) {
    const x = 700 + gr() * 740;
    const y = 715 + gr() * 80;
    const pts: string[] = [];
    for (let k = 0; k < 10; k++) {
      const ang = (k / 10) * Math.PI * 2;
      const rad = k % 2 ? 2.2 : 6;
      pts.push(`${(x + Math.cos(ang) * rad).toFixed(1)},${(y + Math.sin(ang) * rad).toFixed(1)}`);
    }
    flowers += `<polygon points="${pts.join(' ')}" fill="#f6f2e8"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.8" fill="#e7c54b"/>`;
  }
  S.raw(flowers + '</g>');
  sway(S, fan(120, 812, 6, 120, 2.0, 11, 'o', 281), 281);
  for (let i = 0; i < 3; i++) sway(S, lupin(220 + i * 40, 812, 110 + i * 25, 290 + i), 290 + i);

  S.raw(
    `<g class="birds dn-day" fill="none" stroke="#3b3560" stroke-width="2" stroke-linecap="round"><path d="M880 250 q8 -8 16 0 q8 -8 16 0"/><path d="M925 228 q6 -6 12 0 q6 -6 12 0"/><path d="M840 276 q5 -5 10 0 q5 -5 10 0"/></g>`,
  );
  return S;
}

// ---------------------------------------------------------------------------
// Contact : bivouac dans une clairiere, foret dense, feu de camp

function bivouac(): Scene {
  const S = new Scene();
  S.raw(sky(['#5a93e2', '#9fc2ef', '#d7d3ef', '#f6d4d0'], ['#050a1f', '#111a42', '#23285a', '#39336a'], '#f4d6dc', '#342f68'));
  S.raw(sun(1300, 120, 36));
  S.raw(moonStars(1300, 110, 100, 7, 420));

  S.polys(cloud([{ x: 1150, y: 230, r: 28 }, { x: 1192, y: 212, r: 40 }, { x: 1240, y: 230, r: 28 }], 250, 311), ' class="drift"');
  S.polys(cloud([{ x: 780, y: 200, r: 24 }, { x: 815, y: 188, r: 32 }, { x: 852, y: 202, r: 22 }], 218, 312), ' class="drift d2"');

  const far = mountainRange({
    x0: -40,
    x1: 1480,
    base: 560,
    peaks: [
      { x: 300, h: 230, k: 1.0 },
      { x: 500, h: 190, k: 1.2 },
      { x: 850, h: 300, k: 1.0 },
      { x: 1010, h: 410, k: 0.85 },
      { x: 1090, h: 355, k: 1.3 },
      { x: 1290, h: 290, k: 1.0 },
      { x: 1460, h: 230, k: 1.0 },
    ],
    jag: 26,
    seed: 321,
    mat: 'f',
    step: 52,
    noise: 14,
  });
  S.polys(far.polys);
  S.raw(haze(380, 200));

  // foret lointaine (brume) puis foret moyenne
  const r1 = mulberry(331);
  for (let x = -20; x < 1470; x += 14 + r1() * 16) S.polys(pine(x, 588 + r1() * 6, 44 + r1() * 36, 12 + r1() * 5, 3300 + Math.round(x), 'u', 2));
  S.polys(band({ top: (x) => 590 + 6 * Math.sin(x / 60), x0: -20, x1: 1460, bottom: 640, step: 30, seed: 332, mat: 'h', depth: 6, rim: 20 }));
  const r2 = mulberry(341);
  for (let x = -20; x < 1470; x += 22 + r2() * 34) {
    if (r2() < 0.18) continue;
    const clearing = x > 760 && x < 1280;
    const h = (clearing ? 62 : 92) + r2() * (clearing ? 46 : 90) + 26 * Math.sin(x / 140);
    const tone = (r2() - 0.5) * 0.24;
    S.polys(pine(x, 632 + r2() * 12, h, h * (0.22 + r2() * 0.06), 3400 + Math.round(x), 't', 3 + Math.round(r2()), tone));
  }
  const r5 = mulberry(345);
  for (let x = -40; x < 1480; x += 34 + r5() * 30) {
    if (x > 560 && x < 1300) continue;
    const h = 170 + r5() * 90;
    S.polys(pine(x, 668 + r5() * 14, h, h * 0.25, 3500 + Math.round(x), 't', 5, (r5() - 0.5) * 0.2));
  }

  // clairiere
  const fg = (x: number) => 652 + 10 * Math.sin(x / 80) + 6 * Math.sin(x / 31 + 2) - (x > 700 ? 0 : (700 - x) * 0.02);
  S.polys(band({ top: fg, x0: -20, x1: 1460, bottom: 812, step: 46, seed: 351, mat: 'g', depth: 16, noise: 40, rim: 70 }));

  // bivouac
  const t = tent(1120, 722, 190, 150);
  S.raw(t.raw);
  S.polys(t.polys);
  S.polys([
    { pts: [[1010, 724], [1004, 690], [1016, 670], [1040, 668], [1050, 690], [1046, 724]], mat: 'o', s: 0.6, a: 0.5 },
    { pts: [[1016, 670], [1040, 668], [1036, 682], [1020, 684]], mat: 'o', s: 0.85, a: 1 },
    { pts: [[1046, 724], [1050, 690], [1040, 668], [1036, 700]], mat: 'o', s: 0.3, a: 0.3 },
  ]);
  const fire = campfire(900, 732, 1.05);
  S.raw(fire.under);
  S.polys(fire.stones);
  S.polys(fire.logs);
  S.raw(fire.flames);
  S.polys([
    { pts: [[760, 768], [852, 752], [856, 764], [764, 780]], mat: 'w', s: 0.7, a: 0 },
    { pts: [[764, 780], [856, 764], [856, 770], [766, 786]], mat: 'w', s: 0.3, a: 0 },
    { pts: [[965, 782], [1040, 790], [1038, 802], [962, 794]], mat: 'w', s: 0.65, a: 0 },
  ]);

  // lucioles (nuit)
  const r3 = mulberry(361);
  let ff = '<g class="dn-night">';
  for (let i = 0; i < 26; i++) {
    ff += `<circle class="ff" style="animation-delay:-${(r3() * 6).toFixed(2)}s" cx="${(600 + r3() * 840).toFixed(0)}" cy="${(560 + r3() * 200).toFixed(0)}" r="${(1.4 + r3() * 1.4).toFixed(1)}" fill="#fff2a6"/>`;
  }
  S.raw(ff + '</g>');

  // grands sapins qui cadrent la scene
  S.polys(pine(-10, 830, 460, 112, 371, 't', 6));
  S.polys(pine(120, 820, 380, 94, 372, 't', 6));
  S.polys(pine(1350, 822, 400, 100, 373, 't', 6));
  S.polys(pine(1450, 835, 470, 116, 374, 't', 6));

  // fougeres et fleurs
  sway(S, fan(1250, 815, 7, 110, 2.2, 10, 'e', 381), 381);
  sway(S, fan(640, 815, 6, 95, 2.0, 10, 'e', 382), 382);
  const r4 = mulberry(391);
  for (let i = 0; i < 5; i++) sway(S, lupin(1270 + i * 28 + r4() * 10, 812, 100 + r4() * 60, 392 + i), 392 + i);
  sway(S, fan(560, 815, 5, 85, 1.8, 9, 'o', 399), 399);
  return S;
}

// abscisse (repere 1440) a garder au centre quand l'ecran est plus etroit que la scene
const FOCUS: Record<Variant, number> = { lake: 1060, summit: 1090, bivouac: 1010 };

export function buildScene(v: Variant) {
  const S = v === 'lake' ? lake() : v === 'summit' ? summit() : bivouac();
  return { svg: S.svg(), css: S.css(), focus: FOCUS[v] };
}
