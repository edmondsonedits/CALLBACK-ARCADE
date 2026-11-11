import { sessionService } from '../../../../../server/sessions/runtime';
import { enforceRateLimit } from '../../../../../server/security';

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  // A full household shares an IP; per-actor limits apply after authentication.
  const limited = await enforceRateLimit(request, 'session-socket-ticket', 240);
  if (limited) return limited;
  return (await sessionService()).socketTicket(request, (await params).code.toUpperCase());
}
