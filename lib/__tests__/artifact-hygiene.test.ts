import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('artifact hygiene', () => {
  it('keeps typecheck from creating closeout-blocking TypeScript build info', () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
    const gitignore = readFileSync(join(process.cwd(), '.gitignore'), 'utf8')
    const eslintConfig = readFileSync(join(process.cwd(), 'eslint.config.mjs'), 'utf8')
    const artifactAudit = readFileSync(join(process.cwd(), 'scripts/audit-artifacts.mjs'), 'utf8')

    expect(packageJson.scripts.typecheck).toContain('--incremental false')
    expect(gitignore).toContain('*.tsbuildinfo')
    expect(gitignore).toContain('.codex-worktrees/')
    expect(eslintConfig).toContain('".codex-worktrees/**"')
    expect(eslintConfig).toContain('".codex-deck/**"')
    expect(eslintConfig).toContain('"artifacts/**"')
    expect(eslintConfig).toContain('"deliverables/**"')
    expect(eslintConfig).toContain('"output/**"')
    expect(artifactAudit).toContain('/\\.tsbuildinfo$/i')
  })
})
