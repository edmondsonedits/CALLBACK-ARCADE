import { sessionService } from '../../../server/sessions/runtime';
import { enforceRateLimit } from '../../../server/security';
export async function POST(request:Request){const limited=await enforceRateLimit(request,'create-session',10);if(limited)return limited;return (await sessionService()).create(request);}
