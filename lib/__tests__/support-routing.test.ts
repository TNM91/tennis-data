import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BILLING_SUPPORT_PATH } from '../billing-policy'
import { SUPPORT_THREAD_ASSURANCE } from '../message-links'

const SUPPORT_SURFACE_FILES = [
  'app/contact/page.tsx',
  'app/data-assist/page.tsx',
  'app/legal/billing/page.tsx',
  'app/legal/data-policy/page.tsx',
  'app/legal/privacy/page.tsx',
  'app/legal/terms/page.tsx',
  'app/pricing/page.tsx',
  'app/profile/page.tsx',
  'app/upgrade/page.tsx',
]

describe('internal support routing', () => {
  it('keeps billing support inside TenAceIQ messages', () => {
    const url = new URL(BILLING_SUPPORT_PATH, 'https://tenaceiq.test')
    expect(url.pathname).toBe('/messages')
    expect(url.searchParams.get('compose')).toBe('support')
    expect(url.searchParams.get('category')).toBe('billing')
    expect(url.searchParams.get('subject')).toBe('Billing or refund question')
    expect(BILLING_SUPPORT_PATH).not.toContain('mailto:')
  })

  it('does not send core support surfaces to hardcoded email addresses', () => {
    for (const filePath of SUPPORT_SURFACE_FILES) {
      const source = readFileSync(filePath, 'utf8')
      expect(source, filePath).not.toMatch(/mailto:/i)
      expect(source, filePath).not.toMatch(/\b(?:support|help|billing)@/i)
    }
  })

  it('keeps public support entry points tied to in-platform Messages', () => {
    const contactSource = readFileSync('app/contact/page.tsx', 'utf8')
    const billingSource = readFileSync('app/legal/billing/page.tsx', 'utf8')
    const pricingSource = readFileSync('app/pricing/page.tsx', 'utf8')

    expect(SUPPORT_THREAD_ASSURANCE).toContain('inside TenAceIQ Messages')
    expect(`${contactSource}\n${billingSource}\n${pricingSource}`).toContain('SUPPORT_THREAD_ASSURANCE')
    expect(pricingSource).toContain('BILLING_SUPPORT_PATH')
    expect(pricingSource).toContain('Open support thread')
    expect(pricingSource).toContain('heroActionRowStyle')
  })

  it('keeps contact and legal data requests routed to categorized support threads', () => {
    const contactSource = readFileSync('app/contact/page.tsx', 'utf8')
    const dataPolicySource = readFileSync('app/legal/data-policy/page.tsx', 'utf8')
    const privacySource = readFileSync('app/legal/privacy/page.tsx', 'utf8')

    expect(contactSource).toContain('Data Assist or data quality question')
    expect(dataPolicySource).toContain('Data correction or takedown request')
    expect(privacySource).toContain('Privacy or data handling question')
    expect(`${contactSource}\n${dataPolicySource}\n${privacySource}`).toContain('buildSupportMessageHref')
  })

  it('keeps contact support copy tied to tennis jobs instead of generic workspaces', () => {
    const contactSource = readFileSync('app/contact/page.tsx', 'utf8')

    expect(contactSource).toContain('Tennis job or page:')
    expect(contactSource).toContain('help choosing the right tennis path.')
    expect(contactSource).toContain('help choosing where your tennis job belongs.')
    expect(contactSource).not.toContain('Page or workspace:')
    expect(contactSource).not.toContain('help finding the right workspace.')
  })
})
