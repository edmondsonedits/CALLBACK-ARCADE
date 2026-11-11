import {onlineService} from '../../../../../../../server/arcade/online/runtime';
export async function POST(request:Request,context:{params:Promise<{code:string}>}){return (await onlineService()).input(request,(await context.params).code.toUpperCase())}
