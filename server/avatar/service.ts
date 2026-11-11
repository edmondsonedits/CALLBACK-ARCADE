import { AVATAR_POSE_TTL_MS, avatarPoseRequestSchema, avatarPoseSchema, type AvatarPoseSnapshot } from '../../lib/avatar-live';
import { noStoreHeaders, readJson, requireSameOrigin } from '../http';

// The caller supplies a cookie-authenticated scope and actor. No IDs from request JSON.
export class AvatarPoseService {
  constructor(private db: D1Database, private clock: () => number = Date.now) {}

  async publish(request: Request, scope: string, playerId: string): Promise<Response> {
    const blocked = requireSameOrigin(request); if (blocked) return blocked;
    const input = await readJson(request); if (input instanceof Response) return input;
    const parsed = avatarPoseRequestSchema.safeParse(input);
    if (!parsed.success) return Response.json({ error: { code: 'INVALID_POSE', message: 'Choose a valid puppet pose.' } }, { status: 422, headers: noStoreHeaders() });
    const now = this.clock();
    await this.db.prepare(`INSERT INTO avatar_live_poses(scope,player_id,sequence,pose_json,expires_at) VALUES(?,?,?,?,?)
      ON CONFLICT(scope,player_id) DO UPDATE SET sequence=excluded.sequence,pose_json=excluded.pose_json,expires_at=excluded.expires_at
      WHERE excluded.sequence>avatar_live_poses.sequence OR avatar_live_poses.expires_at<=?`)
      .bind(scope, playerId, parsed.data.sequence, JSON.stringify(parsed.data.pose), now + AVATAR_POSE_TTL_MS, now).run();
    // Read-time expiry and normal room cleanup handle disconnected characters.
    return new Response(null, { status: 204, headers: noStoreHeaders() });
  }

  async snapshot(scope: string, allowedIds: readonly string[]): Promise<Response> {
    const serverTime = this.clock();
    const rows = allowedIds.length ? (await this.db.prepare(`SELECT player_id,sequence,pose_json,expires_at FROM avatar_live_poses WHERE scope=? AND expires_at>? AND player_id IN (${allowedIds.map(() => '?').join(',')}) LIMIT 10`)
      .bind(scope, serverTime, ...allowedIds).all<{ player_id: string; sequence: number; pose_json: string; expires_at: number }>()).results : [];
    const poses: AvatarPoseSnapshot['poses'] = [];
    for (const row of rows) {
      if (!allowedIds.includes(row.player_id)) continue;
      try {
        const parsed = avatarPoseSchema.safeParse(JSON.parse(row.pose_json));
        if (parsed.success) poses.push({ playerId: row.player_id, sequence: row.sequence, pose: parsed.data, expiresAt: row.expires_at });
      } catch { /* A corrupt cosmetic row cannot interrupt the game. */ }
    }
    return Response.json({ poses, serverTime } satisfies AvatarPoseSnapshot, { headers: noStoreHeaders() });
  }
}
