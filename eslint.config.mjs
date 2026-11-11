import { defineConfig, globalIgnores } from "eslint/config";
import eslint from "@eslint/js";
import next from "@next/eslint-plugin-next";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  globalIgnores([
    ".next/**",
    "dist/**",
    "out/**",
    "build/**",
    "**/.wrangler/**",
    ".tools/**",
    ".cache/**",
    "video-projects/**",
    "next-env.d.ts",
    "public/arcade-games/**/vendor/**",
    "public/arcade-games/royal-scratch-match/assets/alea-upstream.js",
    "public/arcade-games/*/simulation.js",
    "tests/full-games/*-harness.mjs",
  ]),
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  reactHooks.configs.flat["recommended-latest"],
  jsxA11y.flatConfigs.recommended,
  next.configs["core-web-vitals"],
  {
    // Preserve the imported Sumo package's best-effort storage/socket cleanup.
    files: ["public/arcade-games/royal-sumo/online/*.js", "public/arcade-games/royal-sumo/callback-camera.js"],
    rules: { "no-empty": ["error", { allowEmptyCatch: true }] },
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.serviceworker,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
]);

export default eslintConfig;
