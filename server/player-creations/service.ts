import {validateFishPng} from "../fish-png";
import { decodePlayerCreationPng, normalizeCreationPlacement, PLAYER_CREATION_MAX_SCENERY, validatePlayerCreationSource, validatePlayerCreationTitle, validCreationKind, type CreationPlacement, type PlayerCreationKind } from "../../lib/player-creations";
import { PLAYER_CREATIONS_DDL } from "./schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const RETAINED_REVISIONS = 11;
export class PlayerCreationError extends Error {
  constructor(readonly code: string, readonly status = 422) { super(code); }
}
type CreationRow = { creation_id: string; kind: PlayerCreationKind; title: string; created_at: number; updated_at: number; share_in_rooms: number; revision: number; state: "draft" | "ready"; draft_json: string; placement_json: string; current_object_key: string | null; current_sha256: string | null; current_byte_size: number | null };
export type CreationRecord = { id: string; kind: PlayerCreationKind; title: string; createdAt: number; updatedAt: number; shareInRooms: boolean; revision: number; state: "draft" | "ready"; source: unknown; placement: CreationPlacement; objectKey: string | null; sha256: string | null; byteSize: number | null };
async function sha256Bytes(value: Uint8Array): Promise<string> {
  const bytes = new Uint8Array(value.byteLength); bytes.set(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function record(row: CreationRow): CreationRecord {
  return { id: row.creation_id, kind: row.kind, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at, shareInRooms: row.share_in_rooms === 1, revision: row.revision, state: row.state, source: JSON.parse(row.draft_json).source, placement: normalizeCreationPlacement(JSON.parse(row.placement_json)), objectKey: row.current_object_key, sha256: row.current_sha256, byteSize: row.current_byte_size };
}

export type RoomCreationAsset = { participantId: string; id: string; kind: PlayerCreationKind; revision: number; objectKey: string; contentType: "image/png"; byteSize: number; placement: CreationPlacement; scale?: number };
export class PlayerCreationService {
  constructor(private readonly db: D1Database, private readonly storage?: R2Bucket, private readonly now: () => number = Date.now) {}

  async assertProfile(profileHash: string): Promise<boolean> {
    await this.db.batch(PLAYER_CREATIONS_DDL.map(sql => this.db.prepare(sql)));
    return Boolean(await this.db.prepare("SELECT 1 AS found FROM character_profiles WHERE token_hash = ?").bind(profileHash).first());
  }
  async list(profileHash: string): Promise<CreationRecord[]> {
    await this.db.batch(PLAYER_CREATIONS_DDL.map(sql => this.db.prepare(sql)));
    await this.cleanupDeleted(profileHash);
    const rows = await this.db.prepare("SELECT creation_id,kind,title,created_at,updated_at,share_in_rooms,revision,state,draft_json,placement_json,current_object_key,current_sha256,current_byte_size FROM player_creations WHERE profile_hash = ? AND deleted_at IS NULL ORDER BY CASE kind WHEN 'scenery' THEN 0 ELSE 1 END, created_at DESC, creation_id DESC LIMIT 40").bind(profileHash).all<CreationRow>();
    return rows.results.filter(row => validCreationKind(row.kind)).map(record);
  }
  async createDraft(profileHash: string, input: { kind: unknown; title?: unknown; source: unknown; placement?: unknown; shareInRooms?: unknown }): Promise<CreationRecord> {
    if (!validCreationKind(input.kind)) throw new PlayerCreationError("INVALID_KIND");
    const kind = input.kind, source = validatePlayerCreationSource(kind, input.source), title = validatePlayerCreationTitle(input.title), placement = normalizeCreationPlacement(input.placement);
    if (input.shareInRooms !== undefined && typeof input.shareInRooms !== "boolean") throw new PlayerCreationError("INVALID_SHARE_SETTING");
    const share = input.shareInRooms === true ? 1 : 0, now = this.now(), id = crypto.randomUUID();
    await this.db.batch(PLAYER_CREATIONS_DDL.map(sql => this.db.prepare(sql)));
    if (kind === "scenery") {
      const count = await this.db.prepare("SELECT COUNT(*) AS count FROM player_creations WHERE profile_hash = ? AND kind = 'scenery' AND deleted_at IS NULL").bind(profileHash).first<{ count: number }>();
      if (Number(count?.count ?? 0) >= PLAYER_CREATION_MAX_SCENERY) throw new PlayerCreationError("SCENERY_LIBRARY_FULL", 409);
    }
    const draft = JSON.stringify({ source });
    try {
      await this.db.prepare("INSERT INTO player_creations(creation_id,profile_hash,kind,title,created_at,updated_at,share_in_rooms,revision,state,draft_json,placement_json) VALUES(?,?,?,?,?,?,?,0,'draft',?,?)").bind(id, profileHash, kind, title, now, now, share, draft, JSON.stringify(placement)).run();
    } catch (error) { if (String(error).includes("SCENERY_LIBRARY_FULL")) throw new PlayerCreationError("SCENERY_LIBRARY_FULL", 409); throw error; }
    return { id, kind, title, createdAt: now, updatedAt: now, shareInRooms: share === 1, revision: 0, state: "draft", source, placement, objectKey: null, sha256: null, byteSize: null };
  }
  async saveDraft(profileHash: string, id: string, input: { expectedRevision: unknown; source: unknown; title?: unknown; placement?: unknown; shareInRooms?: unknown }): Promise<{ record: CreationRecord | null }> {
    if (!UUID.test(id) || !Number.isSafeInteger(input.expectedRevision) || Number(input.expectedRevision) < 0) throw new PlayerCreationError("INVALID_REVISION");
    const row = await this.getOwned(profileHash, id); if (!row) throw new PlayerCreationError("CREATION_NOT_FOUND", 404);
    const source = validatePlayerCreationSource(row.kind, input.source), title = input.title === undefined ? row.title : validatePlayerCreationTitle(input.title), placement = input.placement === undefined ? normalizeCreationPlacement(JSON.parse(row.placement_json)) : normalizeCreationPlacement(input.placement);
    if (input.shareInRooms !== undefined && typeof input.shareInRooms !== "boolean") throw new PlayerCreationError("INVALID_SHARE_SETTING");
    const share = input.shareInRooms === undefined ? row.share_in_rooms : input.shareInRooms ? 1 : 0, draft = JSON.stringify({ source }), now = this.now();
    const result = await this.db.prepare("UPDATE player_creations SET title = ?, updated_at = ?, share_in_rooms = ?, draft_json = ?, placement_json = ?, revision = revision + 1 WHERE profile_hash = ? AND creation_id = ? AND revision = ? AND deleted_at IS NULL").bind(title, now, share, draft, JSON.stringify(placement), profileHash, id, Number(input.expectedRevision)).run();
    if (Number(result.meta?.changes ?? 0) !== 1) return { record: null };
    return { record: { ...record(row), revision: Number(input.expectedRevision) + 1, title, updatedAt: now, shareInRooms: share === 1, source, placement } };
  }
  async commit(profileHash: string, id: string, input: { expectedRevision: unknown; idempotencyKey: unknown; rasterBase64: unknown; source?: unknown; placement?: unknown }): Promise<{ record: CreationRecord | null; replayed: boolean }> {
    if (!UUID.test(id) || !Number.isSafeInteger(input.expectedRevision) || Number(input.expectedRevision) < 0 || typeof input.idempotencyKey !== "string" || !UUID.test(input.idempotencyKey)) throw new PlayerCreationError("INVALID_REVISION");
    const row = await this.getOwned(profileHash, id); if (!row) throw new PlayerCreationError("CREATION_NOT_FOUND", 404);
    let raster: Uint8Array;
    try { raster = decodePlayerCreationPng(input.rasterBase64); await validateFishPng(raster); }
    catch { throw new PlayerCreationError("INVALID_TRANSPARENT_PNG"); }
    const sha256 = await sha256Bytes(raster), prior = await this.db.prepare("SELECT revision,sha256,object_key,byte_size FROM player_creation_revisions WHERE creation_id = ? AND idempotency_key = ?").bind(id, input.idempotencyKey).first<{ revision: number; sha256: string; object_key: string; byte_size: number }>();
    if (prior) {
      if (prior.sha256 !== sha256) throw new PlayerCreationError("IDEMPOTENCY_CONFLICT", 409);
      const latest = await this.getOwned(profileHash, id); if (!latest) throw new PlayerCreationError("CREATION_NOT_FOUND", 404);
      return { record: { ...record(latest), revision: prior.revision, state: "ready", objectKey: prior.object_key, sha256: prior.sha256, byteSize: prior.byte_size }, replayed: true };
    }
    const source = validatePlayerCreationSource(row.kind, input.source === undefined ? JSON.parse(row.draft_json).source : input.source), placement = input.placement === undefined ? normalizeCreationPlacement(JSON.parse(row.placement_json)) : normalizeCreationPlacement(input.placement);
    const revision = Number(input.expectedRevision) + 1, key = `player-creations/${id}/revision-${revision}-${input.idempotencyKey}-${sha256}.png`, now = this.now();
    if (!this.storage) throw new PlayerCreationError("PLAYER_CREATION_STORAGE_FAILED", 503);
    try {
      await this.storage.put(key, raster, { onlyIf: { etagDoesNotMatch: "*" }, httpMetadata: { contentType: "image/png", cacheControl: "private, max-age=0, no-store" }, customMetadata: { purpose: "player-creation", creationId: id, revision: String(revision), sha256 } });
      const stored = await this.storage.head(key); if (!stored || stored.size !== raster.byteLength) throw new Error("PLAYER_CREATION_STORAGE_FAILED");
    } catch { throw new PlayerCreationError("PLAYER_CREATION_STORAGE_FAILED", 503); }
    const result = await this.db.batch([
      this.db.prepare("UPDATE player_creations SET revision = ?, state = 'ready', updated_at = ?, draft_json = ?, placement_json = ?, current_object_key = ?, current_sha256 = ?, current_byte_size = ? WHERE profile_hash = ? AND creation_id = ? AND revision = ? AND deleted_at IS NULL").bind(revision, now, JSON.stringify({ source }), JSON.stringify(placement), key, sha256, raster.byteLength, profileHash, id, Number(input.expectedRevision)),
      this.db.prepare("INSERT INTO player_creation_revisions(creation_id,revision,idempotency_key,source_json,placement_json,object_key,sha256,byte_size,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE changes() = 1").bind(id, revision, input.idempotencyKey, JSON.stringify(source), JSON.stringify(placement), key, sha256, raster.byteLength, now),
    ]);
    if (Number(result[0]?.meta?.changes ?? 0) !== 1 || Number(result[1]?.meta?.changes ?? 0) !== 1) {if(!await this.db.prepare('SELECT 1 FROM player_creation_revisions WHERE object_key=?').bind(key).first())await this.storage.delete(key);return { record: null, replayed: false };}
    const committed = await this.getOwned(profileHash, id); if (!committed) throw new PlayerCreationError("CREATION_NOT_FOUND", 404);
    const old = await this.db.prepare("SELECT object_key FROM player_creation_revisions WHERE creation_id = ? ORDER BY revision DESC LIMIT -1 OFFSET ?").bind(id, RETAINED_REVISIONS).all<{ object_key: string }>();
    if (old.results.length) {
      await this.db.batch(old.results.map(item => this.db.prepare("DELETE FROM player_creation_revisions WHERE creation_id = ? AND object_key = ?").bind(id, item.object_key)));
      await Promise.all(old.results.map(item => this.storage!.delete(item.object_key).catch(() => {})));
    }
    return { record: record(committed), replayed: false };
  }
  async delete(profileHash:string,id:string,expectedRevision:unknown):Promise<boolean>{
    if(!UUID.test(id)||!Number.isSafeInteger(expectedRevision)||Number(expectedRevision)<0)throw new PlayerCreationError('INVALID_REVISION');
    const now=this.now();const result=await this.db.prepare('UPDATE player_creations SET deleted_at=?,updated_at=?,share_in_rooms=0 WHERE profile_hash=? AND creation_id=? AND revision=? AND deleted_at IS NULL').bind(now,now,profileHash,id,Number(expectedRevision)).run();
    if(Number(result.meta?.changes??0)!==1&&!await this.db.prepare('SELECT 1 AS deleted FROM player_creations WHERE profile_hash=? AND creation_id=? AND revision=? AND deleted_at IS NOT NULL').bind(profileHash,id,Number(expectedRevision)).first())return false;
    if(this.storage){for(const prefix of ['player-creations/'+id+'/', 'player-creations/'+profileHash+'/'+id+'/']){let cursor:string|undefined;do{const page=await this.storage.list({prefix,cursor,limit:100});if(page.objects.length)await this.storage.delete(page.objects.map(o=>o.key));cursor=page.truncated?page.cursor:undefined;}while(cursor);}}
    await this.db.batch([this.db.prepare("UPDATE player_creations SET title='',draft_json='{}',current_object_key=NULL,current_sha256=NULL,current_byte_size=NULL WHERE profile_hash=? AND creation_id=? AND deleted_at IS NOT NULL").bind(profileHash,id),this.db.prepare('DELETE FROM player_creation_revisions WHERE creation_id=?').bind(id)]);
    return true;
  }
  private async cleanupDeleted(profileHash:string){
    const rows=await this.db.prepare("SELECT creation_id,revision FROM player_creations WHERE profile_hash=? AND deleted_at IS NOT NULL AND (draft_json<>'{}' OR current_object_key IS NOT NULL) LIMIT 5").bind(profileHash).all<{creation_id:string;revision:number}>();
    for(const r of rows.results)try{await this.delete(profileHash,r.creation_id,r.revision);}catch{/* A later collection read retries inaccessible deleted media cleanup. */}
  }
  async getCurrentRaster(profileHash: string, id: string): Promise<{ body: ReadableStream<Uint8Array>; size: number } | null> {
    const row = await this.getOwned(profileHash, id);
    if (!row || row.state !== "ready" || !row.current_object_key || !row.current_byte_size || !this.storage) return null;
    const object = await this.storage.get(row.current_object_key);
    return object && object.size === row.current_byte_size ? { body: object.body, size: object.size } : null;
  }

  async listRoomCreations(profileHashByParticipant: ReadonlyMap<string, string>, excludeFishIds:readonly string[]=[]): Promise<RoomCreationAsset[]> {
    const owners = [...profileHashByParticipant.entries()].filter(([participantId, hash]) => participantId && /^[a-f0-9]{64}$/u.test(hash));
    if (!owners.length) return [];
    const unique = [...new Set(owners.map(([, hash]) => hash))], placeholders = unique.map(() => "?").join(","); const excluded=excludeFishIds.filter(id=>UUID.test(id)).slice(0,10);const exclusion=excluded.length?` AND (kind<>'fish' OR creation_id NOT IN (${excluded.map(()=>'?').join(',')}))`:"";
    const rows = await this.db.prepare(`SELECT * FROM (SELECT creation_id,profile_hash,kind,revision,current_object_key,current_byte_size,placement_json,created_at,ROW_NUMBER() OVER(PARTITION BY profile_hash,kind ORDER BY created_at DESC,creation_id DESC) AS owner_rank FROM player_creations WHERE profile_hash IN (${placeholders}) AND share_in_rooms = 1 AND deleted_at IS NULL AND state = 'ready' AND current_object_key IS NOT NULL${exclusion}) WHERE owner_rank<=CASE WHEN kind='scenery' THEN 5 ELSE 3 END ORDER BY created_at DESC,creation_id DESC`).bind(...unique,...excluded).all<{ creation_id: string; profile_hash: string; kind: PlayerCreationKind; revision: number; current_object_key: string; current_byte_size: number; placement_json: string; created_at: number }>();
    const participantFor = new Map<string, string>(); for (const [participantId, hash] of owners) if (!participantFor.has(hash)) participantFor.set(hash, participantId);
    const sceneryRanks = new Map<string, number>(); const fishRanks = new Map<string,number>();
    return rows.results.flatMap(row => {
      const participantId = participantFor.get(row.profile_hash);
      if (!participantId || !validCreationKind(row.kind)) return [];
      if(row.kind === "fish"){const rank=fishRanks.get(row.profile_hash)??0;if(rank>=3)return [];fishRanks.set(row.profile_hash,rank+1);}
      let scale: number | undefined;
      if (row.kind === "scenery") {
        const rank = sceneryRanks.get(row.profile_hash) ?? 0;
        if (rank >= 5) return [];
        sceneryRanks.set(row.profile_hash, rank + 1);
        scale = [1, 0.85, 0.72, 0.61, 0.52][rank];
      }
      return [{ participantId, id: row.creation_id, kind: row.kind, revision: row.revision, objectKey: row.current_object_key, contentType: "image/png" as const, byteSize: row.current_byte_size, placement: normalizeCreationPlacement(JSON.parse(row.placement_json)), ...(scale === undefined ? {} : { scale }) }];
    });
  }
  private async getOwned(profileHash: string, id: string): Promise<CreationRow | null> {
    return this.db.prepare("SELECT creation_id,kind,title,created_at,updated_at,share_in_rooms,revision,state,draft_json,placement_json,current_object_key,current_sha256,current_byte_size FROM player_creations WHERE profile_hash = ? AND creation_id = ? AND deleted_at IS NULL").bind(profileHash, id).first<CreationRow>();
  }
}
