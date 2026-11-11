import { sessionService } from '../../../../../server/sessions/runtime';
import { runtimeEnv } from '../../../../../server/database';

export async function POST(request: Request) {
  return (await sessionService()).validateSocketTicket(request, runtimeEnv().PARTY_SECRET ?? '');
}
