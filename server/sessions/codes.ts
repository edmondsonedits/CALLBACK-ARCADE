export async function reserveCallbackCode(db:D1Database,code:string,owner:string,expires:number):Promise<boolean> {
  const now=Date.now();
  const result=await db.prepare(`INSERT INTO callback_code_registry(code,owner,expires_at) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM rooms WHERE code=?) AND NOT EXISTS(SELECT 1 FROM online_arcade_rooms WHERE code=?) AND NOT EXISTS(SELECT 1 FROM arcade_phone_rooms WHERE code=?) AND NOT EXISTS(SELECT 1 FROM callback_sessions WHERE code=?) AND NOT EXISTS(SELECT 1 FROM callback_session_games WHERE child_code=?) ON CONFLICT(code) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE callback_code_registry.expires_at<=?`).bind(code,owner,expires,code,code,code,code,code,now).run();
  return Number(result.meta.changes)===1;
}
