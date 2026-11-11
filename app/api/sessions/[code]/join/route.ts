import { sessionService } from '../../../../../server/sessions/runtime';
import { enforceRateLimit } from '../../../../../server/security';
export async function POST(request:Request,{params}:{params:Promise<{code:string}>}){const limited=await enforceRateLimit(request,'session-join',40);if(limited)return limited;return (await sessionService()).join(request,(await params).code.toUpperCase());}
