import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(join(process.cwd(), 'app/upgrade/page.tsx'), 'utf8')
const componentSource = readFileSync(join(process.cwd(), 'app/upgrade/upgrade-mobile-handoff.tsx'), 'utf8')
const stylesSource = readFileSync(join(process.cwd(), 'app/upgrade/upgrade-mobile-handoff.module.css'), 'utf8')

describe('mobile upgrade handoff', () => {
  it('keeps the selected plan and one checkout action in the phone flow', () => {
    expect(pageSource).toContain('<UpgradeMobileHandoff')
    expect(pageSource).toContain("'Continue to secure checkout'")
    expect(componentSource).toContain('Selected plan')
    expect(componentSource).toContain('Your ${planName} choice stays selected through Stripe.')
    expect(componentSource).toContain('benefits.slice(0, 2)')
    expect(componentSource).toContain('Everything included')
    expect(componentSource).toContain('Change plan')
  })

  it('keeps the primary control thumb-friendly and the card shrink-safe', () => {
    expect(stylesSource).toContain('min-height: 50px')
    expect(stylesSource).toContain('grid-template-columns: auto minmax(0, 1fr) auto')
    expect(stylesSource).toContain('min-width: 0')
    expect(stylesSource).toContain("background: url('/tiq/courts/tiq-court-master.png')")
  })

  it('turns a completed checkout into a stable mobile receipt', () => {
    expect(pageSource).toContain('successSteps={successSteps}')
    expect(pageSource).toContain("label: successHandoff.primaryAction")
    expect(pageSource).toContain("url.searchParams.delete('session_id')")
    expect(pageSource).not.toContain('window.location.replace(nextHref)')
    expect(componentSource).toContain('data-upgrade-mobile-receipt="true"')
    expect(componentSource).toContain('Payment confirmed')
    expect(componentSource).toContain('Ready now')
    expect(componentSource).toContain('{priceLabel} plan confirmed.')
    expect(stylesSource).toContain('.receiptHero')
    expect(stylesSource).toContain('grid-template-columns: auto minmax(0, 1fr)')
  })
})
