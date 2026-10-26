import { HEIGHT, WIDTH } from "./constants";

/**
 * Backing-store resolution as a multiple of the logical WIDTH x HEIGHT.
 * 1 renders at 480x270 and stretches it (very blurry text); the display's full
 * resolution is razor sharp. In between gives a soft, retro look. Try other
 * values without rebuilding via the URL, e.g. ?render=1.5
 */
const RENDER_SCALE = 1.5;

function renderScale(): number {
  const param = Number(
    new URLSearchParams(window.location.search).get("render"),
  );
  return param > 0 ? param : RENDER_SCALE;
}

/**
 * Sizes the canvas to fit the window, keeping the aspect ratio (integer scaling
 * whenever it fits). Games draw in logical units; a transform maps them onto a
 * backing store of RENDER_SCALE times that size, which the browser then
 * smoothly scales up to the on-screen size.
 */
export function createScreen(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D {
  const g = canvas.getContext("2d");
  if (!g) throw new Error("Canvas 2D context is not available");
  const render = renderScale();

  const resize = () => {
    const fit = Math.min(
      window.innerWidth / WIDTH,
      window.innerHeight / HEIGHT,
    );
    const scale = fit >= 1 ? Math.floor(fit) : fit;
    canvas.style.width = `${WIDTH * scale}px`;
    canvas.style.height = `${HEIGHT * scale}px`;

    // never exceed the real screen resolution
    const pixels = Math.min(render, scale * (window.devicePixelRatio || 1));
    canvas.width = Math.round(WIDTH * pixels);
    canvas.height = Math.round(HEIGHT * pixels);
    // resizing the canvas resets the context state
    g.setTransform(pixels, 0, 0, pixels, 0, 0);
    g.imageSmoothingEnabled = false;
  };
  window.addEventListener("resize", resize);
  resize();
  return g;
}
