export const ROOM_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function randomRoomCode(randomValues: (array: Uint8Array) => Uint8Array = (array) => crypto.getRandomValues(array)): string { const bytes = randomValues(new Uint8Array(4)); return Array.from(bytes, (byte) => ROOM_ALPHABET[byte % ROOM_ALPHABET.length]).join(""); }
export function randomToken(): string { const bytes = crypto.getRandomValues(new Uint8Array(32)); return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""); }
export function randomUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function stableHash(input: string): number { let hash = 2166136261; for (let index = 0; index < input.length; index += 1) { hash ^= input.charCodeAt(index); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
export function deterministicShuffle<T>(items: readonly T[], seed: string): T[] { const copy = [...items]; let state = stableHash(seed) || 1; for (let index = copy.length - 1; index > 0; index -= 1) { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; const swapIndex = (state >>> 0) % (index + 1); [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]; } return copy; }
export const makeId = (prefix: string) => `${prefix}_${randomUuid().replaceAll("-", "")}`;
