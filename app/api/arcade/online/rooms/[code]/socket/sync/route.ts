import {onlineSocketBroker} from '../../../../../../../../server/arcade/online/runtime';
export async function POST(request:Request,context:{params:Promise<{code:string}>}){return (await onlineSocketBroker()).sync(request,(await context.params).code.toUpperCase())}
