import {onlineSocketBroker} from '../../../../../../../server/arcade/online/runtime';
export async function POST(request:Request,context:{params:Promise<{code:string}>}){return (await onlineSocketBroker()).ticket(request,(await context.params).code.toUpperCase())}
