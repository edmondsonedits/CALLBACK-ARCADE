import { readFile } from 'node:fs/promises';
import { isProductionDatabaseId } from './deployment.ts';
const config = JSON.parse(await readFile('wrangler.jsonc', 'utf8'));
if (process.argv.includes('--production') && !isProductionDatabaseId(config.d1_databases?.[0]?.database_id)) throw new Error('Production deploy blocked: set a real D1 database_id in wrangler.jsonc first.');
console.log('Deployment configuration is valid for the requested environment.');
