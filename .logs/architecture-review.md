# Architecture review — 2026-08-21

Reviewed the existing Sites/Vinext Worker, D1/R2 bindings, D1 compare-and-swap room engine, polling synchronization, D1-leased AI jobs, server-side OpenAI adapters, memory graph, security boundaries, repository history, and test record. Compared Sites, direct Cloudflare, Supabase, Convex, Firebase, Vercel plus realtime, and hosted Node/Socket.IO using current official documentation.

Decision: keep the current Site available, make the existing Git repository canonical in a private GitHub remote, add cloud CI next, and postpone Durable Objects/WebSockets/Workflows until measured coordination or job-reliability triggers justify migration. No deployment, database, secret, or production-state changes were made.
