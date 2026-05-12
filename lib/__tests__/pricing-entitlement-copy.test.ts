import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('pricing entitlement copy', () => {
  it('keeps free signup distinct from paid plan activation', () => {
    const source = readFileSync('app/pricing/page.tsx', 'utf8')

    expect(source).toContain('A free account is the starting line, not a paid unlock.')
    expect(source).toContain('Paid tools need activation')
    expect(source).toContain('open only after the matching plan is active')
    expect(source).toContain('Start with Free, or activate the tier that saves time.')
  })

  it('keeps Data Assist uploads positioned as the platform refresh path', () => {
    const source = readFileSync('app/pricing/page.tsx', 'utf8')

    expect(source).toContain('Uploads refresh the platform')
    expect(source).toContain('move through Data Assist review before they shape TenAceIQ')
    expect(source).toContain('Data Assist contributions')
  })
})
