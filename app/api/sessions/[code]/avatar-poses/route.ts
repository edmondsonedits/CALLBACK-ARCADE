import { sessionService } from '../../../../../server/sessions/runtime';
import { AvatarPoseService } from '../../../../../server/avatar/service';
import { getD1 } from '../../../../../server/database';
import { enforceRateLimit } from '../../../../../server/security';
import { noStoreHeaders, requireSameOrigin } from '../../../../../server/http';

async function identity(request: Request, code: string, write: boolean) {
  const service = await sessionService();
  return service.avatarIdentity(request, code.toUpperCase(), write);
}
const unauthorized = () => Response.json({ error: { code: 'UNAUTHORIZED', message: 'Join this lobby first.' } }, { status: 401, headers: noStoreHeaders() });

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params; const auth = await identity(request, code, false);
  if (!auth) return unauthorized();
  const limited = await enforceRateLimit(request, `avatar-read:${auth.scope}:${auth.actorId}`, 180); if (limited) return limited;
  return new AvatarPoseService(getD1()).snapshot(auth.scope, auth.playerIds);
}
export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const blocked = requireSameOrigin(request); if (blocked) return blocked;
  const { code } = await params; const auth = await identity(request, code, true);
  if (!auth) return unauthorized();
  const limited = await enforceRateLimit(request, `avatar-write:${auth.scope}:${auth.actorId}`, 240); if (limited) return limited;
  return new AvatarPoseService(getD1()).publish(request, auth.scope, auth.actorId);
}
