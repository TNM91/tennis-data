import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/admin/access/page.tsx'), 'utf8')

describe('admin access coach entitlement controls', () => {
  it('keeps Coach and Full-Court available in admin entitlement management', () => {
    expect(source).toContain('coach_subscription_active')
    expect(source).toContain('coach_subscription_status')
    expect(source).toContain("type AccessPreset = 'player_plus' | 'coach' | 'captain' | 'league' | 'full_court'")
    expect(source).toContain('Draft Coach')
    expect(source).toContain('Draft Full-Court')
    expect(source).toContain('Coach Active')
    expect(source).toContain('Coach Status')
    expect(source).toContain('Coach flag is')
    expect(source).toContain('profile.coach_subscription_active ||')
    expect(source).toContain("if (planId === 'coach') return 'Coach'")
    expect(source).toContain("if (planId === 'full_court') return 'Full-Court'")
  })
})
