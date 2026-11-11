import type { AvatarConfig } from '../../lib/contracts';

// Run in the same D1 batch as the winning child-room mutation. Identity comes
// from the authenticated player row, never a client-supplied session/member ID.
export function sessionAvatarUpdate(database:D1Database, change:{roomId:string;actionId:string;actorId:string;version:number;avatarConfig:AvatarConfig;avatarPreset:string|null}):D1PreparedStatement {
 return database.prepare(`UPDATE callback_session_members SET avatar_json=?, avatar_preset=? WHERE EXISTS (
  SELECT 1 FROM players p JOIN rooms r ON r.id=p.room_id
  JOIN callback_session_games g ON g.child_kind='main' AND g.child_code=r.code AND g.active=1
  JOIN callback_sessions s ON s.code=g.session_code AND s.active_id=g.id AND s.stage='PLAYING'
  WHERE p.id=? AND p.room_id=? AND p.removed_at IS NULL
    AND p.token_hash=callback_session_members.token_hash AND g.session_code=callback_session_members.session_code
    AND r.last_action_id=? AND r.version=?
 )`).bind(JSON.stringify(change.avatarConfig),change.avatarPreset,change.actorId,change.roomId,change.actionId,change.version);
}
