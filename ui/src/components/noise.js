/**
 * Lightweight 3D value noise — no external dependency.
 * Good enough for organic strand motion; not mathematically pure Perlin.
 */

const PERM = new Uint8Array(512);
const GRAD = [
  [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
  [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
  [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1],
];

// Seed the permutation table
(function seed() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
})();

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(a, b, t) { return a + t * (b - a); }
function dot3(g, x, y, z) { return g[0]*x + g[1]*y + g[2]*z; }

function noise3D(x, y, z) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const zf = z - Math.floor(z);
  const u = fade(xf), v = fade(yf), w = fade(zf);
  const A  = PERM[X] + Y,     AA = PERM[A] + Z,     AB = PERM[A+1] + Z;
  const B  = PERM[X+1] + Y,   BA = PERM[B] + Z,     BB = PERM[B+1] + Z;
  const g = (h) => GRAD[h % 12];
  return lerp(
    lerp(
      lerp(dot3(g(PERM[AA]), xf, yf, zf),     dot3(g(PERM[BA]), xf-1, yf, zf), u),
      lerp(dot3(g(PERM[AB]), xf, yf-1, zf),   dot3(g(PERM[BB]), xf-1, yf-1, zf), u),
      v
    ),
    lerp(
      lerp(dot3(g(PERM[AA+1]), xf, yf, zf-1),   dot3(g(PERM[BA+1]), xf-1, yf, zf-1), u),
      lerp(dot3(g(PERM[AB+1]), xf, yf-1, zf-1), dot3(g(PERM[BB+1]), xf-1, yf-1, zf-1), u),
      v
    ),
    w
  );
}

/** Multi-octave fractal noise — layered for organic richness. */
export function fbm(x, y, z, octaves = 4, lacunarity = 2.0, gain = 0.5) {
  let val = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    val += amp * noise3D(x * freq, y * freq, z * freq);
    max += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return val / max; // normalized to ~[-1, 1]
}
