import { getD1 } from '../../../../server/database';
import { createPhoneService } from '../../../../server/arcade-phone/service';
import {reserveCallbackCode} from '../../../../server/sessions/codes';

async function route(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  try {
    return await createPhoneService(getD1(),Date.now,code=>reserveCallbackCode(getD1(),code,'legacy-phone',Date.now()+86400000)).handle(request, path);
  } catch (error) {
    // Log only database exception text, never request bodies, cookies or credentials.
    const cause = error instanceof Error ? error.cause : undefined;
    console.error('Arcade phone service failed:', error instanceof Error ? error.message : 'Unknown error', cause instanceof Error ? cause.message : '');
    return Response.json({ error: { code: 'SERVICE_UNAVAILABLE', message: 'The room service is temporarily unavailable. Please retry.' } }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '1' } });
  }
}
export const POST = route;
export const GET = route;
export const PUT = route;
export const PATCH = route;
export const DELETE = route;
export const OPTIONS = route;
export const HEAD = route;
