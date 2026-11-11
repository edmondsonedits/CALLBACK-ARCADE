import {sessionService} from '../../../../server/sessions/runtime';
import {enforceRateLimit} from '../../../../server/security';
export async function POST(request:Request){const limited=await enforceRateLimit(request,'session-mirror-join',5);if(limited)return limited;return (await sessionService()).joinMirror(request);}
