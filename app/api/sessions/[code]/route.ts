import { sessionService } from '../../../../server/sessions/runtime';
export async function GET(request:Request,{params}:{params:Promise<{code:string}>}){const {code}=await params;const service=await sessionService();return new URL(request.url).searchParams.get('lookup')==='1'?service.lookup(code.toUpperCase()):service.snapshot(request,code.toUpperCase());}
