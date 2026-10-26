/**
 * The project palette. Sprite pictures are written as rows of characters, and
 * each character below stands for one color. Dark navy backgrounds with bright
 * neon accents keep every gameplay object easy to tell from its surroundings.
 */
export const PALETTE: Record<string, string> = {
  // neutrals
  k: "#05050f",
  K: "#12122a",
  n: "#2e2e4e",
  N: "#4a4a78",
  s: "#8a8aa6",
  S: "#c4c4da",
  w: "#f4f4f4",
  // red
  r: "#ff5a5a",
  R: "#a8283c",
  q: "#ffa0a0",
  // orange
  o: "#ff9a3a",
  O: "#b0551a",
  a: "#ffc880",
  // yellow
  y: "#ffd84a",
  Y: "#a8841c",
  x: "#fff0a0",
  // green
  g: "#6cff7a",
  e: "#3fbf5a",
  G: "#1f7a3a",
  h: "#b6ffbf",
  // cyan
  c: "#4ad7ff",
  C: "#1f7a9e",
  u: "#aef0ff",
  // blue
  b: "#4a6bdc",
  B: "#243a8c",
  l: "#9ab0ff",
  // purple
  p: "#c06cff",
  P: "#5a2f9a",
  v: "#e0b0ff",
  // pink
  m: "#ff7ab8",
  M: "#a8306a",
  z: "#ffc0dc",
  // brown
  t: "#c48a2c",
  T: "#6a4414",
  j: "#e8c070",
};

type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
}

/** Blends two colors: t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
}

export const lighten = (hex: string, t: number): string => mix(hex, "#ffffff", t);
export const darken = (hex: string, t: number): string => mix(hex, "#000000", t);

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const lin = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
