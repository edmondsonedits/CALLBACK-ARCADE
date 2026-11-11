export type ArcadeInputKind = "position" | "tap";
export type ArcadePlayerInput =
  | { kind: "position"; playerId: string; seq: number; x: number; y: number; receivedAt: number }
  | { kind: "tap"; playerId: string; seq: number; receivedAt: number };
export interface ArcadePublicSnapshot { v: 1; gameId: string; tick: number; state: unknown }
export interface ArcadeGameContext { now: number; emit: (event: Record<string, unknown>) => void }
export interface ArcadeViewer { role: "host" | "player" | "spectator"; playerId: string | null }
export const MIN_ARCADE_PLAYERS = 2;
export const MAX_ARCADE_PLAYERS = 16;
export interface ArcadeGameModule {
  readonly id: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly inputKinds: readonly ArcadeInputKind[];
  readonly inputCooldownMs: number;
  readonly snapshotEveryTicks?: number;
  readonly persistEveryTicks?: number;
  readonly persistInputImmediately?: boolean;
  readonly restoreLatestInputOnLoad?: boolean;
  createState(seed?: string, now?: number, playerIds?: readonly string[]): unknown;
  validateInput?(state: unknown, input: ArcadePlayerInput, now: number): boolean;
  applyInput(state: unknown, input: ArcadePlayerInput, context: ArcadeGameContext): unknown;
  step?(state: unknown, fixedStepMs: number, context: ArcadeGameContext): unknown;
  snapshot(state: unknown, tick: number, viewer: ArcadeViewer): ArcadePublicSnapshot;
  finalResult?(state: unknown): unknown;
  pause?(state: unknown, now: number): unknown;
  resume?(state: unknown, now: number): unknown;
}
