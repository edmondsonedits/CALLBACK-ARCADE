import rawCatalog from '../catalog/games.json' with { type: 'json' };
import { handleRequest } from './routes.ts';
import type { Env } from './routes.ts';
import { validateCatalog, type GameCatalog } from './catalog.ts';
const catalog: GameCatalog = (() => {
  const errors = validateCatalog(rawCatalog);
  if (errors.length) throw new Error(`bundled catalog is invalid: ${errors.join('; ')}`);
  return rawCatalog as unknown as GameCatalog;
})();
export { handleRequest };
export default { fetch: (request: Request, env: Env) => handleRequest(request, { ...env, CATALOG: env.CATALOG ?? catalog }) };
