import { noStoreHeaders } from '../http';

/** Parent membership, rather than a second child join, provisions session seats. */
export async function sessionChildJoinError(db: D1Database, kind: 'main' | 'online', code: string): Promise<Response | null> {
  const child = await db.prepare('SELECT session_code FROM callback_session_games WHERE child_kind=? AND child_code=? ORDER BY created_at DESC LIMIT 1').bind(kind, code).first<{session_code:string}>();
  if (!child) return null;
  return Response.json({ error: { code: 'SESSION_JOIN_REQUIRED', message: `Join Callback lobby ${child.session_code} to enter this game.`, detail: { joinUrl: `/session/${child.session_code}/play` } } }, { status: 409, headers: noStoreHeaders() });
}
