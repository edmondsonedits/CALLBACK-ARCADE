import type { PracticeControl } from "./types";

export interface NormalizedAxes { readonly x: number; readonly y: number }
export interface JoystickBounds { readonly left: number; readonly top: number; readonly width: number; readonly height: number }

const keyAliases: Readonly<Record<PracticeControl, readonly string[]>> = {
  joystick: [], jump: [" ", "j"], duck: ["shift", "k"], action: [" ", "e"], left: ["arrowleft", "a"], right: ["arrowright", "d"],
  "lane-1": ["1", "a", "d"], "lane-2": ["2", "f"], "lane-3": ["3", "j"], "lane-4": ["4", "k"],
  fire: [" ", "f"], special: ["shift", "q"], spray: [" ", "e"],
};

export function practiceInputForKeys(keys: ReadonlySet<string>, controls: readonly PracticeControl[]): {
  readonly x: number;
  readonly y: number;
  readonly buttons: Readonly<Partial<Record<PracticeControl, boolean>>>;
} {
  const normalized = new Set([...keys].map((key) => key.toLowerCase()));
  const hasJoystick = controls.includes("joystick");
  let x = hasJoystick ? Number(normalized.has("d") || normalized.has("arrowright")) - Number(normalized.has("a") || normalized.has("arrowleft")) : 0;
  let y = hasJoystick ? Number(normalized.has("s") || normalized.has("arrowdown")) - Number(normalized.has("w") || normalized.has("arrowup")) : 0;
  if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
  const buttons: Partial<Record<PracticeControl, boolean>> = {};
  for (const control of controls) {
    if (control === "joystick") continue;
    buttons[control] = keyAliases[control].some((key) => normalized.has(key));
    if (!hasJoystick && control === "left") x = Number(buttons.left) * -1;
    if (!hasJoystick && control === "right") x = Math.max(x, Number(buttons.right));
  }
  return { x, y, buttons };
}

export function joystickInputFromPoint(clientX: number, clientY: number, bounds: JoystickBounds): NormalizedAxes {
  if (bounds.width <= 0 || bounds.height <= 0) return { x: 0, y: 0 };
  const radius = Math.min(bounds.width, bounds.height) * 0.38;
  const dx = clientX - bounds.left - bounds.width / 2;
  const dy = clientY - bounds.top - bounds.height / 2;
  const length = Math.hypot(dx, dy);
  const factor = length > radius ? radius / length : 1;
  return { x: dx * factor / radius, y: dy * factor / radius };
}
