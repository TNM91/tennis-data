import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "**/.next/**",
    ".codex-audits/**",
    ".codex-deck/**",
    ".codex-worktrees/**",
    ".pricing-release-worktree/**",
    ".codex/**",
    "artifacts/**",
    "deliverables/**",
    "output/**",
    "out/**",
    "build/**",
    "tmp/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
