# Cloudflare setup

The static responsive catalog and typed Worker API share a Cloudflare Worker. D1 stores manifest metadata only; source HTML remains in Git. Production Cloudflare provisioning is pending.

## Local

Use Node 22.13+ and npm:

```sh
npm ci
npm run catalog:generate
npm run db:migrate
npm run db:seed
npm run dev
```

The configs pin `compatibility_date` to `2026-08-22`, the latest runtime date supported by the pinned Wrangler release. Local Wrangler settings live in `wrangler.local.jsonc`; generated database files and logs are ignored under `.wrangler/` and `.local/`. `npm run build` performs a local dry-run build. Run `npm test`, `npm run typecheck`, and `npm run catalog:check` before review.

## Production setup (manual)

1. Authenticate the Wrangler CLI: `node scripts/run-wrangler.mjs login`.
2. Create the intended production database: `node scripts/run-wrangler.mjs d1 create arcade-catalog`.
3. Copy the returned real database UUID into `d1_databases[0].database_id` in `wrangler.jsonc`.
4. Check the production ID before any remote operation: `node --experimental-strip-types scripts/deploy-preflight.ts --production`.
5. Apply schema and seed: `node scripts/run-wrangler.mjs d1 migrations apply arcade-catalog --remote -c wrangler.jsonc`, then `node scripts/run-wrangler.mjs d1 execute arcade-catalog --remote --file=db/seed.sql -c wrangler.jsonc`.
6. Review and then deploy with `npm run deploy:production`. That is the only package production deploy path; it runs the strict ID guard before Wrangler deploys.

No provisioning or deployment was performed for this scaffold. The placeholder ID in production config and local-only configuration are rejected by the deploy guard. Cloudflare credentials remain in Wrangler's ignored local configuration directory or Cloudflare-managed secrets, never in Git. After a future deploy, confirm health reports `database: connected` and `catalog: current`.

Do not run `wrangler deploy` directly for production. Do not deploy until provisioning, real-ID configuration, seed, review, and explicit release decision are complete. Party Sites are outside this repo and unchanged.
