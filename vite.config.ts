import { sites } from "@openai/sites-vite-plugin";
import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json" with { type: "json" };
import { qaBindings } from "./scripts/qa-config.mjs";
import path from "node:path";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const ignoredDevPaths = ["**/.logs/**", "**/.wrangler/**", "**/.next/**", "**/dist/**", "**/test-results/**"];

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  // Availability checks must run before static Arcade entry files are served.
  assets: { binding: "ASSETS", run_worker_first: ["/arcade-games/*"], html_handling: "none" as const },
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      watch: isCodexSeatbeltSandbox
        ? { useFsEvents: false, usePolling: true, ignored: ignoredDevPaths }
        : { ignored: ignoredDevPaths },
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        ...(process.env.CALLBACK_QA_MANAGED === "1" ? { configPath: process.env.CALLBACK_QA_CONFIG_PATH } : {}),
        // Isolated browser QA may use disposable storage instead of slow disk-backed emulation.
        persistState: process.env.CALLBACK_QA_EPHEMERAL !== "1",
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: { ...localBindingConfig, ...(process.env.CALLBACK_QA_MANAGED === "1" ? { main: path.resolve("worker/index.ts"), vars: qaBindings(process.env.PARTY_WORKER_URL, process.env.CALLBACK_QA_PARTY_SECRET) } : {}) },
      }),
    ],
  };
});
