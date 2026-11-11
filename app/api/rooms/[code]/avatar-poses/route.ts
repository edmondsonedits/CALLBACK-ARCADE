import { authenticateRoom } from '../../../../../server/auth';
import { AvatarPoseService } from '../../../../../server/avatar/service';
import { getD1 } from '../../../../../server/database';
import { enforceRateLimit } from '../../../../../server/security';
import { requireSameOrigin } from '../../../../../server/http';

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const hint = request.headers.get('x-callback-role');
  const auth = await authenticateRoom(request, code, hint === 'player' ? ['player'] : hint === 'display' ? ['display'] : ['host', 'display', 'player']);
  if (auth instanceof Response) return auth;
  const limited = await enforceRateLimit(request, `avatar-read:${auth.state.id}:${auth.role}:${auth.id}`, 180); if (limited) return limited;
  return new AvatarPoseService(getD1()).snapshot(`room:${auth.state.id}`, auth.state.participants.filter(p => p.role === 'player' && !p.removedAt).map(p => p.id));
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const blocked = requireSameOrigin(request); if (blocked) return blocked;
  const { code } = await params;
  const auth = await authenticateRoom(request, code, ['player']);
  if (auth instanceof Response) return auth;
  const limited = await enforceRateLimit(request, `avatar-write:${auth.state.id}:${auth.id}`, 240); if (limited) return limited;
  return new AvatarPoseService(getD1()).publish(request, `room:${auth.state.id}`, auth.id);
}
