import {onlineService} from '../../../../../../server/arcade/online/runtime';
export async function GET(request:Request,context:{params:Promise<{code:string}>}){return (await onlineService()).snapshot(request,(await context.params).code.toUpperCase())}
