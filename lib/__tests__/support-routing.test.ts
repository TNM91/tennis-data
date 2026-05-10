import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BILLING_SUPPORT_PATH } from '../billing-policy'

const SUPPORT_SURFACE_FILES = [
  'app/contact/page.tsx',
  'app/legal/billing/page.tsx',
  'app/legal/privacy/page.tsx',
  'app/legal/terms/page.tsx',
  'app/legal/data-policy/page.tsx',
  'app/pricing/page.tsx',
  'app/profile/page.tsx',
]

describe('internal support routing', () => {
  it('keeps billing support inside TenAceIQ messages', () => {
    expect(BILLING_SUPPORT_PATH).toBe('/messages?compose=support')
    expect(BILLING_SUPPORT_PATH).not.toContain('mailto:')
  })

  it('does not send core support surfaces to hardcoded email addresses', () => {
    for (const filePath of SUPPORT_SURFACE_FILES) {
      const source = readFileSync(filePath, 'utf8')
      expect(source, filePath).not.toMatch(/mailto:/i)
      expect(source, filePath).not.toMatch(/\b(?:support|help|billing)@/i)
    }
  })
})
