import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('pricing entitlement copy', () => {
  it('keeps free signup distinct from paid plan activation', () => {
    const source = readFileSync('app/pricing/page.tsx', 'utf8')

    expect(source).toContain('Creating an account opens Free access for public tennis intelligence and data contributions.')
    expect(source).toContain('Start Free access. Paid workspaces open only when that plan is active.')
    expect(source).toContain('Paid workspaces need activation')
    expect(source).toContain('open only after the matching plan is active')
  })

  it('keeps Data Assist uploads positioned as the platform refresh path', () => {
    const source = readFileSync('app/pricing/page.tsx', 'utf8')

    expect(source).toContain('Uploads refresh the platform')
    expect(source).toContain('move through review before they shape TenAceIQ')
    expect(source).toContain('data contributions')
  })
})
