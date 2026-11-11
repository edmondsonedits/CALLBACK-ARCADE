import { partyBroker } from '../../../../server/party/runtime';
export async function POST(request:Request){return (await partyBroker()).result(request);}
