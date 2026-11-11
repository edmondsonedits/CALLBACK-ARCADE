import {authenticateRoom} from '../../../../../../server/auth';
import {roomCreationAssets} from '../../../../../../server/player-creations/room-manifest';
import {runtimeEnv} from '../../../../../../server/database';
import {noStoreHeaders} from '../../../../../../server/http';
export async function GET(request:Request,context:{params:Promise<{code:string;id:string}>}){
 const {code,id}=await context.params;const auth=await authenticateRoom(request,code,['host','display','player']);if(auth instanceof Response)return auth;
 const asset=(await roomCreationAssets(auth.state)).find(a=>a.id===id);if(!asset)return new Response(null,{status:404,headers:noStoreHeaders()});
 const object=await runtimeEnv().MEDIA?.get(asset.objectKey);if(!object||object.size!==asset.byteSize)return new Response(null,{status:404,headers:noStoreHeaders()});
 return new Response(object.body,{headers:noStoreHeaders({'Content-Type':'image/png','Content-Length':String(object.size),'X-Content-Type-Options':'nosniff'})});
}
