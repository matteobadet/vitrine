// Moteur low-poly : les formes sont des champs de hauteur triangules
// (Delaunay) puis ombres facette par facette selon une lumiere unique.

export type Vec = [number, number];
type V3 = [number, number, number];

export interface Poly {
  pts: Vec[];
  mat: string;
  s: number;
  a: number;
}

const SH = 12;
const AL = 4;

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix: number, iy: number, seed: number) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed + 1, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function noise2(x: number, y: number, seed: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x: number, y: number, seed: number) {
  let s = 0;
  let amp = 0.5;
  let f = 1;
  let norm = 0;
  for (let i = 0; i < 3; i++) {
    s += amp * noise2(x * f, y * f, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return s / norm;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function norm3(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

const LIGHT = norm3([-0.5, -0.72, 0.48]);

// --- Delaunay (Bowyer-Watson) ---

interface Tri {
  a: number;
  b: number;
  c: number;
  x: number;
  y: number;
  r: number;
}

function circum(p: Vec[], a: number, b: number, c: number): Tri {
  const [ax, ay] = p[a];
  const [bx, by] = p[b];
  const [cx, cy] = p[c];
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by)) || 1e-9;
  const a2 = ax * ax + ay * ay;
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;
  const x = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
  const y = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
  return { a, b, c, x, y, r: (ax - x) ** 2 + (ay - y) ** 2 };
}

export function delaunay(pts: Vec[]): [number, number, number][] {
  const n = pts.length;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const dm = Math.max(maxX - minX, maxY - minY) * 10;
  const mx = (minX + maxX) / 2;
  const my = (minY + maxY) / 2;
  const p: Vec[] = pts.concat([
    [mx - dm, my - dm],
    [mx, my + dm],
    [mx + dm, my - dm],
  ]);
  let tris: Tri[] = [circum(p, n, n + 1, n + 2)];
  for (let i = 0; i < n; i++) {
    const [px, py] = p[i];
    const good: Tri[] = [];
    const edges = new Map<string, [number, number]>();
    for (const t of tris) {
      if ((px - t.x) ** 2 + (py - t.y) ** 2 <= t.r) {
        for (const [u, v] of [
          [t.a, t.b],
          [t.b, t.c],
          [t.c, t.a],
        ] as [number, number][]) {
          const k = u < v ? `${u},${v}` : `${v},${u}`;
          if (edges.has(k)) edges.delete(k);
          else edges.set(k, [u, v]);
        }
      } else {
        good.push(t);
      }
    }
    for (const [u, v] of edges.values()) good.push(circum(p, u, v, i));
    tris = good;
  }
  return tris.filter((t) => t.a < n && t.b < n && t.c < n).map((t) => [t.a, t.b, t.c]);
}

// --- geometrie ---

export function inside(poly: Vec[], x: number, y: number) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

function edgeDist(poly: Vec[], px: number, py: number) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j];
    const [bx, by] = poly[i];
    const dx = bx - ax;
    const dy = by - ay;
    const l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx - px, ay + t * dy - py));
  }
  return best;
}

function resample(poly: Vec[], step: number): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const k = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 0; j < k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
  }
  return out;
}

// --- facettage d'une forme ---

export interface Shape {
  outline: Vec[];
  step: number;
  z: (x: number, y: number) => number;
  mat: string;
  seed: number;
  alt?: (x: number, y: number) => number;
  bias?: number;
  gain?: number;
  jitter?: number;
  // ombrer avec la pente au centre de la facette plutot qu'avec son plan :
  // les faces entre deux aretes prennent une teinte nette et uniforme
  centroidShade?: boolean;
}

export function facet(sh: Shape): Poly[] {
  const r = mulberry(sh.seed);
  const { outline, step } = sh;
  const pts: Vec[] = resample(outline, step * 0.8).map(([x, y]) => [x + (r() - 0.5) * 0.8, y + (r() - 0.5) * 0.8]);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of outline) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const rowH = step * 0.866;
  let row = 0;
  for (let y = y0 + rowH * 0.5; y < y1; y += rowH, row++) {
    const off = (row % 2) * step * 0.5;
    for (let x = x0 + off; x < x1; x += step) {
      const px = x + (r() - 0.5) * step * 0.6;
      const py = y + (r() - 0.5) * step * 0.6;
      if (!inside(outline, px, py)) continue;
      if (edgeDist(outline, px, py) < step * 0.4) continue;
      pts.push([px, py]);
    }
  }
  const bias = sh.bias ?? 0.55;
  const gain = sh.gain ?? 0.8;
  const jit = sh.jitter ?? 0.05;
  const res: Poly[] = [];
  for (const [ia, ib, ic] of delaunay(pts)) {
    const A = pts[ia];
    const B = pts[ib];
    const C = pts[ic];
    const cx = (A[0] + B[0] + C[0]) / 3;
    const cy = (A[1] + B[1] + C[1]) / 3;
    if (!inside(outline, cx, cy)) continue;
    let nrm: V3;
    if (sh.centroidShade) {
      const e = 1.5;
      const fx = (sh.z(cx + e, cy) - sh.z(cx - e, cy)) / (2 * e);
      const fy = (sh.z(cx, cy + e) - sh.z(cx, cy - e)) / (2 * e);
      nrm = norm3([-fx, -fy, 1]);
    } else {
      const za = sh.z(A[0], A[1]);
      const zb = sh.z(B[0], B[1]);
      const zc = sh.z(C[0], C[1]);
      const u: V3 = [B[0] - A[0], B[1] - A[1], zb - za];
      const v: V3 = [C[0] - A[0], C[1] - A[1], zc - za];
      nrm = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      if (nrm[2] < 0) nrm = [-nrm[0], -nrm[1], -nrm[2]];
      nrm = norm3(nrm);
    }
    const d = nrm[0] * LIGHT[0] + nrm[1] * LIGHT[1] + nrm[2] * LIGHT[2];
    const s = clamp01(bias + gain * (d - 0.55) + (r() - 0.5) * jit * 2);
    const a = sh.alt ? clamp01(sh.alt(cx, cy)) : 0;
    res.push({ pts: [A, B, C], mat: sh.mat, s, a });
  }
  return res;
}

// --- primitives ---

export interface Peak {
  x: number;
  h: number;
  k: number;
}

export function mountainRange(o: {
  x0: number;
  x1: number;
  base: number;
  peaks: Peak[];
  jag: number;
  seed: number;
  mat: string;
  step: number;
  noise?: number;
  bias?: number;
  gain?: number;
}) {
  const H = (x: number) => {
    let m = 0;
    for (const p of o.peaks) m = Math.max(m, p.h - Math.abs(x - p.x) * p.k);
    return m;
  };
  const r = mulberry(o.seed + 7);
  const xs: number[] = [];
  for (let x = o.x0; x < o.x1; x += 14 + r() * 22) xs.push(x);
  for (const p of o.peaks) if (p.x > o.x0 && p.x < o.x1) xs.push(p.x);
  xs.push(o.x1);
  xs.sort((a, b) => a - b);
  const maxH = Math.max(...o.peaks.map((p) => p.h));
  const outline: Vec[] = [[o.x0, o.base + 4]];
  for (const x of xs) {
    const h = H(x);
    const isPeak = o.peaks.some((p) => Math.abs(p.x - x) < 0.01);
    const j = isPeak ? 0 : (r() - 0.5) * o.jag * Math.min(1, h / 60);
    outline.push([x, o.base - Math.max(0, h + j)]);
  }
  outline.push([o.x1, o.base + 4]);
  const nz = o.noise ?? 14;
  // chaque sommet a une arete centrale et deux aretes diagonales : les faces
  // entre deux aretes sont franchement eclairees ou a l'ombre
  const rr = mulberry(o.seed + 13);
  const ridges = o.peaks.flatMap((p) => {
    const T: Vec = [p.x, o.base - p.h];
    const aL = -(0.5 + rr() * 0.35);
    const aR = 0.45 + rr() * 0.35;
    return [
      { T, d: [0, 1] as Vec, L: p.h * 1.4, h: p.h * 1.35, k: p.k * 1.35 },
      { T, d: [Math.sin(aL), Math.cos(aL)] as Vec, L: p.h * 1.3, h: p.h * 1.24, k: p.k * 1.6 },
      { T, d: [Math.sin(aR), Math.cos(aR)] as Vec, L: p.h * 1.3, h: p.h * 1.24, k: p.k * 1.6 },
    ];
  });
  const z = (x: number, y: number) => {
    let m = -Infinity;
    for (const rd of ridges) {
      const qx = x - rd.T[0];
      const qy = y - rd.T[1];
      const t = Math.max(0, Math.min(rd.L, qx * rd.d[0] + qy * rd.d[1]));
      const v = rd.h - Math.hypot(qx - t * rd.d[0], qy - t * rd.d[1]) * rd.k + t * 0.3;
      if (v > m) m = v;
    }
    return m + (fbm(x / 140, y / 140, o.seed) - 0.5) * nz;
  };
  const polys = facet({
    outline,
    step: o.step,
    z,
    mat: o.mat,
    seed: o.seed,
    alt: (_x, y) => (o.base - y) / maxH,
    bias: o.bias,
    gain: o.gain,
    jitter: 0.07,
    centroidShade: true,
  });
  return { polys, outline };
}

export interface Puff {
  x: number;
  y: number;
  r: number;
}

export function cloud(puffs: Puff[], flat: number, seed: number, step = 20, mat = 'c', gain = 0.9): Poly[] {
  const top = Math.min(...puffs.map((p) => p.y - p.r));
  const x0 = Math.min(...puffs.map((p) => p.x - p.r));
  const x1 = Math.max(...puffs.map((p) => p.x + p.r));
  const envelope = (x: number) => {
    let y = flat;
    for (const p of puffs) {
      const dx = x - p.x;
      if (Math.abs(dx) < p.r) y = Math.min(y, p.y - Math.sqrt(p.r * p.r - dx * dx));
    }
    return y;
  };
  const outline: Vec[] = [];
  const n = Math.max(12, Math.round((x1 - x0) / 9));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    outline.push([x, Math.min(flat, envelope(x))]);
  }
  outline.push([x1, flat], [x0, flat]);
  const z = (x: number, y: number) => {
    let m = 0;
    for (const p of puffs) m = Math.max(m, Math.sqrt(Math.max(0, p.r * p.r - (x - p.x) ** 2 - (y - p.y) ** 2)));
    return m * 1.1 + 0.2 * (y - top) + (fbm(x / 40, y / 40, seed) - 0.5) * 12;
  };
  return facet({
    outline,
    step,
    z,
    mat,
    seed,
    alt: (_x, y) => (flat - y) / (flat - top),
    bias: 0.62,
    gain,
  });
}

export function band(o: {
  top: (x: number) => number;
  x0: number;
  x1: number;
  bottom: number;
  step: number;
  seed: number;
  mat: string;
  depth?: number;
  noise?: number;
  rim?: number;
  bias?: number;
  gain?: number;
}): Poly[] {
  const outline: Vec[] = [];
  for (let x = o.x0; x <= o.x1 + 0.1; x += o.step * 0.7) outline.push([x, o.top(x)]);
  outline.push([o.x1, o.bottom], [o.x0, o.bottom]);
  const dep = o.depth ?? 14;
  const rim = o.rim ?? 80;
  return facet({
    outline,
    step: o.step,
    z: (x, y) => dep * Math.sqrt(Math.max(0, y - o.top(x))) + (fbm(x / 80, y / 80, o.seed) - 0.5) * (o.noise ?? 30),
    mat: o.mat,
    seed: o.seed,
    alt: (x, y) => 1 - (y - o.top(x)) / rim,
    bias: o.bias,
    gain: o.gain,
  });
}

export function dome(o: { cx: number; base: number; w: number; h: number; seed: number; mat: string; step: number }): Poly[] {
  const r = mulberry(o.seed + 3);
  const outline: Vec[] = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const t = (Math.PI * i) / N;
    const k = i === 0 || i === N ? 1 : 0.9 + r() * 0.18;
    outline.push([o.cx - o.w * Math.cos(t), o.base - o.h * Math.sin(t) * k]);
  }
  return facet({
    outline,
    step: o.step,
    z: (x, y) =>
      o.h * 1.2 * Math.sqrt(Math.max(0, 1 - ((x - o.cx) / o.w) ** 2 - ((o.base - y) / (o.h * 1.15)) ** 2)) +
      (fbm(x / 30, y / 30, o.seed) - 0.5) * 6,
    mat: o.mat,
    seed: o.seed,
    alt: (_x, y) => (o.base - y) / o.h,
    bias: 0.55,
    gain: 0.9,
  });
}

export function pine(x: number, base: number, h: number, w: number, seed: number, mat = 't', tiers = 4, tone = 0): Poly[] {
  const r = mulberry(seed);
  const out: Poly[] = [];
  const tw = Math.max(2, w * 0.09);
  out.push({
    pts: [
      [x - tw, base],
      [x - tw, base - h * 0.16],
      [x + tw, base - h * 0.16],
      [x + tw, base],
    ],
    mat: 'w',
    s: 0.25,
    a: 0,
  });
  const top = base - h;
  const body = h * 0.88;
  const layers: Poly[][] = [];
  for (let k = 0; k < tiers; k++) {
    const f = (k + 1) / tiers;
    const yb = top + body * (0.3 + 0.7 * f);
    const ya = k === 0 ? top : top + body * (0.3 + 0.7 * (k / tiers)) - body * 0.2;
    const wk = w * (0.35 + 0.65 * f);
    const droop = (body / tiers) * 0.22;
    const A: Vec = [x + (r() - 0.5) * 1.5, ya];
    const BL: Vec = [x - wk, yb];
    const BR: Vec = [x + wk, yb - droop * 0.2];
    const P1: Vec = [x - wk * 0.52, yb - droop];
    const M: Vec = [x + (r() - 0.5) * wk * 0.2, yb - droop * 0.35];
    const P2: Vec = [x + wk * 0.5, yb - droop * 0.8];
    const j = () => (r() - 0.5) * 0.1 + tone;
    const a = 1 - f * 0.7;
    layers.push([
      { pts: [A, BL, P1], mat, s: 0.82 + j(), a },
      { pts: [A, P1, M], mat, s: 0.62 + j(), a },
      { pts: [A, M, P2], mat, s: 0.4 + j(), a },
      { pts: [A, P2, BR], mat, s: 0.18 + j(), a },
    ]);
  }
  // les etages hauts recouvrent la base des etages bas
  for (let k = layers.length - 1; k >= 0; k--) out.push(...layers[k]);
  return out;
}

export function leaf(bx: number, by: number, len: number, angle: number, width: number, mat: string, seed: number): Poly[] {
  const r = mulberry(seed);
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  const px = -dy;
  const py = dx;
  const at = (t: number, side: number, wf: number): Vec => [
    bx + dx * len * t + px * width * wf * side,
    by + dy * len * t + py * width * wf * side,
  ];
  const C = [at(0, 0, 0), at(0.35, 0, 0), at(0.7, 0, 0), at(1, 0, 0)];
  const L = [at(0.22, -1, 0.9), at(0.52, -1, 1), at(0.84, -1, 0.55)];
  const R = [at(0.22, 1, 0.9), at(0.52, 1, 1), at(0.84, 1, 0.55)];
  const j = () => (r() - 0.5) * 0.12;
  const lit = angle < 0 ? 0.78 : 0.62;
  const dark = angle < 0 ? 0.36 : 0.22;
  return [
    { pts: [C[0], L[0], C[1]], mat, s: lit + j(), a: 0 },
    { pts: [C[1], L[0], L[1]], mat, s: lit - 0.1 + j(), a: 0.4 },
    { pts: [C[1], L[1], C[2]], mat, s: lit + j(), a: 0.5 },
    { pts: [C[2], L[1], L[2]], mat, s: lit - 0.08 + j(), a: 0.8 },
    { pts: [C[2], L[2], C[3]], mat, s: lit + 0.05 + j(), a: 1 },
    { pts: [C[0], C[1], R[0]], mat, s: dark + j(), a: 0 },
    { pts: [C[1], R[1], R[0]], mat, s: dark + 0.08 + j(), a: 0.4 },
    { pts: [C[1], C[2], R[1]], mat, s: dark + j(), a: 0.5 },
    { pts: [C[2], R[2], R[1]], mat, s: dark + 0.06 + j(), a: 0.8 },
    { pts: [C[2], C[3], R[2]], mat, s: dark + j(), a: 1 },
  ];
}

export function fan(x: number, base: number, n: number, len: number, spread: number, width: number, mat: string, seed: number): Poly[] {
  const r = mulberry(seed);
  const out: Poly[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    const ang = t * spread + (r() - 0.5) * 0.15;
    out.push(...leaf(x + t * 10, base, len * (0.75 + r() * 0.35) * (1 - Math.abs(t) * 0.4), ang, width, mat, seed + i * 13));
  }
  return out;
}

export function lupin(x: number, base: number, h: number, seed: number, mat = 'p'): Poly[] {
  const r = mulberry(seed);
  const out: Poly[] = [];
  out.push(...fan(x, base, 3, h * 0.3, 1.8, h * 0.04, 'e', seed + 5));
  const lean = (r() - 0.5) * h * 0.12;
  out.push({
    pts: [
      [x - 1.5, base],
      [x + lean * 0.4 - 1, base - h * 0.4],
      [x + lean * 0.4 + 1, base - h * 0.4],
      [x + 1.5, base],
    ],
    mat: 'e',
    s: 0.3,
    a: 0,
  });
  const N = 7;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const y = base - h * (0.35 + 0.63 * t);
    const cxp = x + lean * (0.4 + 0.6 * t * t);
    const sz = h * 0.075 * (1 - t * 0.65);
    const a = t;
    out.push({ pts: [[cxp, y], [cxp - sz, y + sz * 0.7], [cxp - sz * 0.25, y - sz * 0.6]], mat, s: 0.78 + (r() - 0.5) * 0.1, a });
    out.push({ pts: [[cxp, y], [cxp + sz * 0.25, y - sz * 0.6], [cxp + sz, y + sz * 0.7]], mat, s: 0.32 + (r() - 0.5) * 0.1, a });
    out.push({ pts: [[cxp - sz * 0.25, y - sz * 0.6], [cxp + sz * 0.25, y - sz * 0.6], [cxp, y - sz * 1.15]], mat, s: 0.58, a });
  }
  return out;
}

// --- rendu ---

type Ramp = string[];
interface Mat {
  day: [Ramp, Ramp];
  night: [Ramp, Ramp];
}

const MATS: Record<string, Mat> = {
  // montagnes lointaines
  f: {
    day: [
      ['#5d5b9e', '#7572b6', '#948bcb', '#b7a6dc', '#d6c1e8'],
      ['#7c69ad', '#a680bd', '#d99eb7', '#f3bba6', '#ffdcc2'],
    ],
    night: [
      ['#10163a', '#181f48', '#212a58', '#2c3769', '#38447b'],
      ['#151b42', '#1f2752', '#2d3868', '#44528a', '#6574a8'],
    ],
  },
  // montagnes intermediaires
  m: {
    day: [
      ['#433f86', '#57539c', '#726bb3', '#9489c9', '#b5a5db'],
      ['#5e4a93', '#8a63a8', '#c67f9f', '#eca08f', '#fbc9a8'],
    ],
    night: [
      ['#0b1030', '#11173c', '#1a2149', '#242d5b', '#30396d'],
      ['#10153a', '#191f48', '#262f5e', '#374378', '#4f5f96'],
    ],
  },
  // nuages
  c: {
    day: [
      ['#8aa0d6', '#a6b9e4', '#c3d1ef', '#dfe7f7', '#f4f7fd'],
      ['#b3c1e8', '#cdd8f1', '#e5ecf8', '#f5f7fc', '#ffffff'],
    ],
    night: [
      ['#1a1f40', '#232a50', '#2f3763', '#3c4577', '#4b558a'],
      ['#212849', '#2c355c', '#3b4671', '#535f8a', '#7280a6'],
    ],
  },
  // collines vertes
  h: {
    day: [
      ['#1b6444', '#27794c', '#379454', '#57b058', '#84ca5c'],
      ['#2a7646', '#419c4f', '#68bd55', '#96d85c', '#c7ee79'],
    ],
    night: [
      ['#081a15', '#0c231b', '#112d22', '#17382a', '#1f4533'],
      ['#0b2019', '#112b21', '#18382a', '#224a36', '#2f6046'],
    ],
  },
  // prairie de premier plan
  g: {
    day: [
      ['#155538', '#1f6a41', '#2d824a', '#469e52', '#6eba58'],
      ['#237043', '#37904b', '#5bb151', '#89cf58', '#b8e56e'],
    ],
    night: [
      ['#061510', '#091c15', '#0e251b', '#133022', '#1a3c2b'],
      ['#08190f', '#0d2418', '#143021', '#1c402c', '#28553b'],
    ],
  },
  // lac
  l: {
    day: [
      ['#3a58a8', '#4565b6', '#5372c2', '#6381cd', '#7591d8'],
      ['#8a97db', '#9ea7e3', '#b4b6ea', '#c9c5ef', '#dcd3f4'],
    ],
    night: [
      ['#09122f', '#0c1637', '#101b40', '#15214a', '#1b2855'],
      ['#18214c', '#1f2a58', '#283464', '#324072', '#3e4e82'],
    ],
  },
  // ilot / rochers verts
  i: {
    day: [
      ['#1f6a5c', '#2b8370', '#3f9e84', '#62ba9c', '#93d3b9'],
      ['#2b7d66', '#3f9a7c', '#5cb693', '#89d0ad', '#bce6cb'],
    ],
    night: [
      ['#07191a', '#0b2223', '#102c2c', '#163737', '#1e4443'],
      ['#0a1f1f', '#0f2929', '#153533', '#1d4541', '#295a53'],
    ],
  },
  // roche
  r: {
    day: [
      ['#3a2f3f', '#4e4152', '#665566', '#7f6a78', '#9a8290'],
      ['#47384a', '#624d5d', '#826672', '#a5857f', '#c6a58e'],
    ],
    night: [
      ['#0f1128', '#161933', '#1e2240', '#282d50', '#343a62'],
      ['#13162f', '#1c203c', '#282e4f', '#394168', '#515b85'],
    ],
  },
  // pierres de cairn / feu
  s: {
    day: [
      ['#5f5a70', '#76718a', '#918aa2', '#afa6bb', '#cdc3d4'],
      ['#6d657c', '#8a8098', '#aa9cb0', '#cab9c2', '#e6d6d6'],
    ],
    night: [
      ['#1a1b2c', '#222437', '#2c2f45', '#373b55', '#444a67'],
      ['#1e1f32', '#282a3f', '#343850', '#444a66', '#5a6182'],
    ],
  },
  // sapins
  t: {
    day: [
      ['#123f2e', '#175039', '#1f6444', '#2b7a51', '#3c9160'],
      ['#174a33', '#1f5f3e', '#2a784a', '#3b9156', '#55a966'],
    ],
    night: [
      ['#04110c', '#061610', '#091c14', '#0d2419', '#122e20'],
      ['#051410', '#081a14', '#0c2219', '#112c20', '#183929'],
    ],
  },
  // sapins lointains (brume)
  u: {
    day: [
      ['#3c6a72', '#4a7a80', '#5b8b8f', '#6f9c9e', '#86aeae'],
      ['#44737a', '#548487', '#679595', '#7ea7a4', '#98bab4'],
    ],
    night: [
      ['#0c1a24', '#10202b', '#152733', '#1a2f3c', '#213946'],
      ['#0e1d27', '#13242f', '#182c38', '#1f3643', '#284350'],
    ],
  },
  // bois
  w: {
    day: [
      ['#3b2419', '#4d2f20', '#613c28', '#774b32', '#8e5c3e'],
      ['#3b2419', '#4d2f20', '#613c28', '#774b32', '#8e5c3e'],
    ],
    night: [
      ['#120b08', '#170e0a', '#1d120d', '#241711', '#2c1c15'],
      ['#120b08', '#170e0a', '#1d120d', '#241711', '#2c1c15'],
    ],
  },
  // toile de tente
  n: {
    day: [
      ['#9e3a1c', '#bf4f25', '#dc6a33', '#ef8b45', '#fbad5f'],
      ['#a8421e', '#c95a29', '#e57838', '#f6994c', '#ffbe6c'],
    ],
    night: [
      ['#3a1811', '#4b2016', '#5f2a1b', '#763622', '#8e442b'],
      ['#401b12', '#532318', '#692e1e', '#823b26', '#9c4a30'],
    ],
  },
  // interieur de tente (s'illumine la nuit)
  k: {
    day: [
      ['#2a1712', '#331c15', '#3d2218', '#48291c', '#553121'],
      ['#2a1712', '#331c15', '#3d2218', '#48291c', '#553121'],
    ],
    night: [
      ['#c9722a', '#df8a34', '#f0a241', '#f9bb55', '#ffd271'],
      ['#c9722a', '#df8a34', '#f0a241', '#f9bb55', '#ffd271'],
    ],
  },
  // lupins
  p: {
    day: [
      ['#41309b', '#5640b7', '#6f55cf', '#8f74e3', '#b49cf3'],
      ['#4f36a8', '#6849c3', '#8563da', '#a888ec', '#cbb2fa'],
    ],
    night: [
      ['#15113a', '#1b1548', '#221b58', '#2c236b', '#382d80'],
      ['#18133f', '#1f184e', '#281f60', '#332974', '#40348a'],
    ],
  },
  // feuilles corail
  o: {
    day: [
      ['#7f2841', '#a13852', '#c64f66', '#e2717c', '#f39c96'],
      ['#8c2d46', '#b03f58', '#d4596c', '#ec7f85', '#f9aba0'],
    ],
    night: [
      ['#260e1c', '#301224', '#3c172d', '#4a1e38', '#5a2744'],
      ['#2a0f1f', '#351428', '#431a32', '#52223e', '#642c4b'],
    ],
  },
  // feuillage de premier plan
  e: {
    day: [
      ['#17563a', '#217045', '#2e8b4f', '#48a85a', '#72c465'],
      ['#1f6640', '#2d834b', '#40a055', '#63bd5e', '#94d56d'],
    ],
    night: [
      ['#061610', '#091d15', '#0d261c', '#133224', '#1b402e'],
      ['#071a13', '#0b2219', '#112d21', '#183b2b', '#224c37'],
    ],
  },
};

function hex(h: string): V3 {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(c: V3) {
  return '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

function mix(a: V3, b: V3, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function ramp(stops: Ramp, s: number): V3 {
  const x = s * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  return mix(hex(stops[i]), hex(stops[i + 1]), x - i);
}

function matColor(mat: string, night: boolean, s: number, a: number) {
  const m = MATS[mat];
  const [lo, hi] = night ? m.night : m.day;
  return toHex(mix(ramp(lo, s), ramp(hi, s), a));
}

export class Scene {
  private out: string[] = [];
  private used = new Set<string>();

  raw(s: string) {
    this.out.push(s);
  }

  polys(ps: Poly[], attrs = '') {
    if (!ps.length) return;
    this.out.push(`<g${attrs}>`);
    for (const p of ps) {
      const si = Math.max(0, Math.min(SH - 1, Math.round(clamp01(p.s) * (SH - 1))));
      const ai = Math.max(0, Math.min(AL - 1, Math.floor(clamp01(p.a) * AL)));
      const cls = p.mat + si.toString(36) + ai;
      this.used.add(cls);
      const pts = p.pts.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(' ');
      this.out.push(`<polygon class="${cls}" points="${pts}"/>`);
    }
    this.out.push('</g>');
  }

  svg() {
    return this.out.join('');
  }

  css() {
    let day = '';
    let night = '';
    for (const cls of this.used) {
      const mat = cls[0];
      const s = parseInt(cls[1], 36) / (SH - 1);
      const a = parseInt(cls[2], 10) / (AL - 1);
      const cd = matColor(mat, false, s, a);
      const cn = matColor(mat, true, s, a);
      day += `.lp-svg .${cls}{fill:${cd};stroke:${cd}}`;
      night += `.lp-scene[data-mode=night] .${cls}{fill:${cn};stroke:${cn}}`;
    }
    return day + night;
  }
}
