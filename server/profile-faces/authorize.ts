import { apiError } from '../../lib/contracts';
import { getCookie, noStoreHeaders } from '../http';
import { assertOwnedProfileFaceIds } from './service';

/** Check at the HTTP boundary; engine code never trusts a client-supplied asset ID. */
export async function authorizePhotoFace(request: Request, faceId: string | undefined, db: D1Database): Promise<Response | null> {
  if (!faceId) return null;
  const token = getCookie(request, 'callback_profile');
  const rejected = () => new Response(JSON.stringify({error:{code:'PROFILE_FACE_NOT_OWNED',message:'Choose a face from your own saved character, or use the drawn face.'}}), {status:422,headers:noStoreHeaders({'Content-Type':'application/json'})});
  if (!token || token.length < 40 || token.length > 64) return rejected();
  try { await assertOwnedProfileFaceIds(db, token, [faceId]); return null; }
  catch (error) { return error instanceof Error && error.message === 'PROFILE_FACE_NOT_OWNED' ? rejected() : apiError('PROFILE_FACE_UNAVAILABLE','Your cartoon face could not be checked. Try again shortly.',503); }
}
