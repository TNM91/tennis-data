import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('pricing entitlement copy', () => {
  it('keeps free signup distinct from paid plan activation', () => {
    const source = readFileSync('app/pricing/page.tsx', 'utf8')

    expect(source).toContain('Creating an account opens Free access for public tennis intelligence and data contributions.')
    expect(source).toContain('My Lab, Coach Hub, Team Hub, League Office, and Full-Court open only after the matching plan is active.')
    expect(source).toContain("const active = !accessPending && isPlanActive(plan.id, access)")
    expect(source).toContain("{accessPending ? 'View tiers' : getPlanCta(plan.id, active)}")
    expect(source).not.toContain('Paid workspaces open only after the matching plan is active.')
  })

  it('keeps Data Assist uploads positioned as the tennis context refresh path', () => {
    const source = readFileSync('app/pricing/page.tsx', 'utf8')

    expect(source).toContain('uploads refresh tennis context')
    expect(source).toContain('move through review before they shape TenAceIQ')
    expect(source).toContain('data contributions')
    expect(source).not.toContain('uploads refresh the platform')
  })
})
