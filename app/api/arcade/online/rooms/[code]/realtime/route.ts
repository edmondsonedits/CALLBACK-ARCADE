import { partyBroker } from '../../../../../../../server/party/runtime';
export async function POST(request:Request,{params}:{params:Promise<{code:string}>}){return (await partyBroker()).ticket(request,(await params).code);}
