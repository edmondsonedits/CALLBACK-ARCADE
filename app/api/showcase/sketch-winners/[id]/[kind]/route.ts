import { ensureDatabase } from '../../../../../../server/database';
import { readSketchShowcaseMedia } from '../../../../../../server/sketch-showcase';
export async function GET(_request: Request, context: {params:Promise<{id:string;kind:string}>}) {
  await ensureDatabase();
  const {id,kind}=await context.params;
  const media=await readSketchShowcaseMedia(id,kind);
  const headers={ 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'same-origin' };
  if(!media)return new Response('Artwork unavailable.',{status:404,headers});
  return new Response(media.object.body,{headers:{...headers,'Content-Type':media.info.contentType,'Content-Length':String(media.info.byteSize)}});
}
