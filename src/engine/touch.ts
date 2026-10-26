import type { Input } from "./input";

/** Fraction of the D-pad radius a finger must move from the center to press a direction. */
const PAD_DEADZONE = 0.35;

/** True on phones and tablets. ?touch=1 / ?touch=0 in the URL forces it either way. */
export function isTouchDevice(): boolean {
  const forced = new URLSearchParams(window.location.search).get("touch");
  if (forced === "1") return true;
  if (forced === "0") return false;
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}

function element(tag: string, className: string, text = ""): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

/**
 * On-screen controls for touch devices. They press virtual keys on `input`, so
 * games see exactly what the keyboard would send:
 *   D-pad = arrow keys (diagonals allowed), A = Space, II = Escape,
 *   and tapping the game screen = Enter.
 * `onGesture` runs on every touch, for things that need a user gesture (audio).
 */
export function attachTouchControls(input: Input, canvas: HTMLCanvasElement, onGesture: () => void): void {
  if (!isTouchDevice()) return;
  document.body.classList.add("touch");
  const root = element("div", "touch-controls");
  root.addEventListener("contextmenu", (e) => e.preventDefault());

  root.append(dpad(input, onGesture));
  root.append(button(input, onGesture, "A", "Space", "touch-btn touch-a"));
  root.append(button(input, onGesture, "II", "Escape", "touch-btn touch-pause"));
  document.body.append(root);

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onGesture();
    input.press("Enter");
  });
  canvas.addEventListener("pointerup", () => {
    onGesture();
    input.release("Enter");
  });
  canvas.addEventListener("pointercancel", () => input.release("Enter"));
}

function button(input: Input, onGesture: () => void, label: string, code: string, className: string): HTMLElement {
  const el = element("div", className, label);
  let pointer: number | null = null;
  const up = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    pointer = null;
    el.classList.remove("on");
    input.release(code);
    onGesture();
  };
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (pointer !== null) return;
    pointer = e.pointerId;
    el.setPointerCapture(e.pointerId);
    el.classList.add("on");
    input.press(code);
    onGesture();
  });
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  return el;
}

function dpad(input: Input, onGesture: () => void): HTMLElement {
  const pad = element("div", "touch-pad");
  const arrows: Record<string, HTMLElement> = {
    ArrowUp: element("span", "up", "▲"),
    ArrowLeft: element("span", "left", "◀"),
    ArrowRight: element("span", "right", "▶"),
    ArrowDown: element("span", "down", "▼"),
  };
  pad.append(...Object.values(arrows));

  let pointer: number | null = null;
  let held = new Set<string>();
  const setHeld = (next: Set<string>) => {
    for (const code of held) if (!next.has(code)) input.release(code);
    for (const code of next) if (!held.has(code)) input.press(code);
    held = next;
    for (const [code, el] of Object.entries(arrows)) el.classList.toggle("on", held.has(code));
  };
  const track = (e: PointerEvent) => {
    const r = pad.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const next = new Set<string>();
    if (dx < -PAD_DEADZONE) next.add("ArrowLeft");
    if (dx > PAD_DEADZONE) next.add("ArrowRight");
    if (dy < -PAD_DEADZONE) next.add("ArrowUp");
    if (dy > PAD_DEADZONE) next.add("ArrowDown");
    setHeld(next);
  };
  const end = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    pointer = null;
    setHeld(new Set());
    onGesture();
  };

  pad.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (pointer !== null) return;
    pointer = e.pointerId;
    pad.setPointerCapture(e.pointerId);
    track(e);
    onGesture();
  });
  pad.addEventListener("pointermove", (e) => {
    if (e.pointerId === pointer) track(e);
  });
  pad.addEventListener("pointerup", end);
  pad.addEventListener("pointercancel", end);
  return pad;
}
