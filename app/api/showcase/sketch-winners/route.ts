import { ensureDatabase } from '../../../../server/database';
import { listSketchShowcase } from '../../../../server/sketch-showcase';
export async function GET(request: Request) {
  await ensureDatabase();
  const value = new URL(request.url).searchParams.get('offset') ?? '0';
  const offset = /^\d{1,6}$/u.test(value) ? Number(value) : 0;
  return Response.json(await listSketchShowcase(offset), { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
