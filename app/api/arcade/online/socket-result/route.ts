import {onlineSocketBroker} from '../../../../../server/arcade/online/runtime';
export async function POST(request:Request){return (await onlineSocketBroker()).result(request)}
