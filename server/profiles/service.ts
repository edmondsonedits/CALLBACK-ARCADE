import { sha256Hex } from "../crypto";
import { CharacterProfileSchema, defaultCharacterProfile, type CharacterProfile, type CharacterState } from "../../lib/character-profile";
import { PROFILE_DDL } from "./schema";
import { assertOwnedProfileFaceIds } from "../profile-faces/service";

export { PROFILE_DDL };
export interface StoredCharacterProfile { version: number; profile: CharacterProfile; created: boolean }

export class CharacterProfileService {
  constructor(private readonly db: D1Database, private readonly clock: () => number = Date.now) {}

  async get(token: string, candidate?: CharacterState): Promise<StoredCharacterProfile> {
    const tokenHash = await sha256Hex(token);
    await this.db.batch(PROFILE_DDL.map(sql => this.db.prepare(sql)));
    await this.db.prepare('DELETE FROM character_profiles WHERE token_hash IN(SELECT token_hash FROM character_profiles WHERE version=1 AND updated_at<? LIMIT 20)').bind(this.clock()-365*86400000).run();
    const existing = await this.db.prepare("SELECT version, profile_json FROM character_profiles WHERE token_hash = ?").bind(tokenHash).first<{ version: number; profile_json: string }>();
    if (existing) { await this.db.prepare('UPDATE character_profiles SET updated_at=? WHERE token_hash=?').bind(this.clock(),tokenHash).run();return { version: existing.version, profile: CharacterProfileSchema.parse(JSON.parse(existing.profile_json)), created: false }; }
    const profile = candidate ? defaultCharacterProfile(candidate) : defaultCharacterProfile();
    const inserted = await this.db.prepare("INSERT OR IGNORE INTO character_profiles (token_hash, version, profile_json, updated_at) VALUES (?, 1, ?, ?)").bind(tokenHash, JSON.stringify(profile), this.clock()).run();
    const row = await this.db.prepare("SELECT version, profile_json FROM character_profiles WHERE token_hash = ?").bind(tokenHash).first<{ version: number; profile_json: string }>();
    if (!row) throw new Error("PROFILE_CREATE_FAILED");
    return { version: row.version, profile: CharacterProfileSchema.parse(JSON.parse(row.profile_json)), created: Number(inserted.meta?.changes ?? 0) === 1 };
  }

  async save(token: string, expectedVersion: number, profile: unknown): Promise<number | null> {
    const validated = CharacterProfileSchema.parse(profile);
    const faceIds: string[] = [];
    const collectFaces = (value: unknown) => {
      if (Array.isArray(value)) { for (const item of value) collectFaces(item); return; }
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) { if (key === "photoFaceId" && typeof child === "string") faceIds.push(child); else collectFaces(child); }
    };
    collectFaces(validated);
    await assertOwnedProfileFaceIds(this.db, token, faceIds);
    const current=await this.get(token);
    if(current.version!==expectedVersion)return null;
    const canonical=CharacterProfileSchema.parse(defaultCharacterProfile()).default;
    if(JSON.stringify(validated.default)!==JSON.stringify(canonical))throw new Error('PROFILE_DEFAULT_IMMUTABLE');
    const legacyImport=expectedVersion===1&&current.profile.past.length===0&&validated.past.length===0&&JSON.stringify(validated.baseline)===JSON.stringify({avatarConfig:validated.avatarConfig,avatarPreset:validated.avatarPreset});
    if(!legacyImport&&JSON.stringify(validated.baseline)!==JSON.stringify(current.profile.baseline))throw new Error('PROFILE_BASELINE_IMMUTABLE');
    const tokenHash = await sha256Hex(token);
    const result = await this.db.prepare("UPDATE character_profiles SET version = version + 1, profile_json = ?, updated_at = ? WHERE token_hash = ? AND version = ?").bind(JSON.stringify(validated), this.clock(), tokenHash, expectedVersion).run();
    const changes = Number(result.meta?.changes ?? 0);
    return changes === 1 ? expectedVersion + 1 : null;
  }
}
