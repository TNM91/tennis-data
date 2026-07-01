import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Vercel production branch smoke', () => {
  it('keeps a non-secret guard for the Vercel production branch dashboard item', () => {
    const packageJson = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    const deployChecklist = readFileSync(join(process.cwd(), 'docs/deploy-checklist.md'), 'utf8')
    const closeoutLog = readFileSync(join(process.cwd(), 'docs/platform-closeout-verification-log.md'), 'utf8')
    const smokeScript = readFileSync(join(process.cwd(), 'scripts/vercel-production-branch-smoke.mjs'), 'utf8')

    expect(packageJson).toContain('"qa:vercel-branch": "node scripts/vercel-production-branch-smoke.mjs"')
    expect(deployChecklist).toContain('npm run qa:vercel-branch')
    expect(closeoutLog).toContain('npm run qa:vercel-branch')
    expect(smokeScript).toContain('/v9/projects/${projectIdOrName}')
    expect(smokeScript).toContain('expectedProductionBranch')
    expect(smokeScript).toContain('actualProductionBranch')
    expect(smokeScript).toContain('productionDeploymentBranch')
    expect(smokeScript).toContain('dashboardGitSettingsUrl')
    expect(smokeScript).toContain('dashboardSteps')
    expect(smokeScript).toContain('extractFirstJsonObject')
    expect(deployChecklist).toContain('https://vercel.com/tennis-data/tennis-data/settings/git#connected-git-repository')
    expect(smokeScript).not.toContain('STRIPE_SECRET_KEY')
    expect(smokeScript).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(smokeScript).not.toContain('process.env.VERCEL_TOKEN')
  })
})
