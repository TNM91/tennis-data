import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const loginSource = readFileSync(join(process.cwd(), 'app/login/page.tsx'), 'utf8')
const joinSource = readFileSync(join(process.cwd(), 'app/join/page.tsx'), 'utf8')
const welcomeSource = readFileSync(join(process.cwd(), 'app/welcome/page.tsx'), 'utf8')
const signupSource = readFileSync(join(process.cwd(), 'app/api/auth/signup/route.ts'), 'utf8')
const componentSource = readFileSync(join(process.cwd(), 'app/components/auth-plan-continuity.tsx'), 'utf8')
const stylesSource = readFileSync(join(process.cwd(), 'app/components/auth-plan-continuity.module.css'), 'utf8')

describe('auth plan continuity', () => {
  it('keeps the selected paid plan visible while sign-in and account creation stay primary', () => {
    expect(loginSource).toContain('<AuthPlanContinuity planId={selectedPlanId} step="sign-in" />')
    expect(joinSource).toContain('<AuthPlanContinuity planId={selectedPlanId} step="account" />')
    expect(componentSource).toContain('Plan saved')
    expect(componentSource).toContain('Stays selected')
    expect(componentSource).toContain('After account setup')
  })

  it('supports Club plans through confirmation instead of falling back to Free', () => {
    for (const source of [loginSource, joinSource, welcomeSource, signupSource]) {
      expect(source).toContain('club_starter')
      expect(source).toContain('club_unlimited')
    }
    expect(signupSource).toContain('isBillablePricingPlanId')
    expect(welcomeSource).toContain('getAuthEntryPlanId')
  })

  it('keeps the mobile continuity card compact and shrink-safe', () => {
    expect(stylesSource).toContain('grid-template-columns: auto minmax(0, 1fr) auto')
    expect(stylesSource).toContain('min-width: 0')
    expect(stylesSource).toContain('@media (max-width: 374px)')
  })
})
