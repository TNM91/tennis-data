import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    include: [
      'lib/__tests__/**/*.{test,spec}.{ts,tsx}',
      'components/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.codex-worktrees/**',
      '**/.codex-archive/**',
      '**/.codex-audits/**',
      '**/.codex-deck/**',
      '**/artifacts/**',
      '**/deliverables/**',
      '**/output/**',
    ],
  },
})
