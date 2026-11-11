export const PRACTICE_GAME_IDS = [
  "sumo", "space-bash", "twisted-system", "snow-bash", "drain-bash", "jungle-bash",
  "roller-ruckus", "tie-breaker", "manic-panic", "rubble-alliance", "scratch-match", "sky-balls",
  "dragon-drop", "volt-vault", "mystery-beat", "tailblazer", "jungle-fox", "metal-fox",
  "paint-panic", "rhythm",
] as const;

export type PracticeGameId = (typeof PRACTICE_GAME_IDS)[number];

export type PracticeControl =
  | "joystick"
  | "jump"
  | "duck"
  | "action"
  | "left"
  | "right"
  | "lane-1"
  | "lane-2"
  | "lane-3"
  | "lane-4"
  | "fire"
  | "special"
  | "spray";

export interface PracticeGameManifest {
  readonly id: PracticeGameId;
  readonly title: string;
  readonly placeholder: boolean;
  readonly instructions: string;
  readonly controls: readonly PracticeControl[];
  readonly tuningVersion: string;
  readonly load: () => Promise<PracticeGameModule<unknown>>;
}

export interface PracticeInput {
  readonly sequence: number;
  readonly x: number;
  readonly y: number;
  readonly buttons: Readonly<Partial<Record<PracticeControl, boolean>>>;
  readonly pressed?: readonly PracticeControl[];
}

export interface PracticeGameModule<State = unknown, Snapshot = unknown> {
  readonly id: PracticeGameId;
  createState(playerId: string, seed: number): State;
  step(state: State, input: PracticeInput): State;
  snapshot(state: State): Snapshot;
  isTerminal(state: State): boolean;
}

export interface PracticeGameDefinition extends PracticeGameManifest {
  readonly load: () => Promise<PracticeGameModule<unknown>>;
}
