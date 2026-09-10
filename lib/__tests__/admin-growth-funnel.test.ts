import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(join(process.cwd(), 'app/admin/growth/page.tsx'), 'utf8')
const routeSource = readFileSync(join(process.cwd(), 'app/api/admin/growth-funnel/route.ts'), 'utf8')
const signupSource = readFileSync(join(process.cwd(), 'app/api/auth/signup/route.ts'), 'utf8')
const pageStyles = readFileSync(join(process.cwd(), 'app/admin/growth/growth.module.css'), 'utf8')

describe('admin growth funnel', () => {
  it('keeps visitor traffic separate from signed-in product and billing conversion signals', () => {
    expect(pageSource).toContain('Visitor and page-view traffic belongs in Vercel Web Analytics.')
    expect(pageSource).toContain('Signup requests')
    expect(pageSource).toContain('Checkout clicks')
    expect(pageSource).toContain('Stripe opens')
    expect(pageSource).toContain('Paid activations')
    expect(pageSource).toContain('Offer to activation')
    expect(pageSource).toContain('Largest opportunity')
    expect(routeSource).toContain("uniqueUsers(events, 'signup_confirmation_sent')")
    expect(routeSource).toContain("uniqueUsers(events, 'upgrade_checkout_clicked')")
    expect(routeSource).toContain("uniqueUsers(events, 'upgrade_checkout_started')")
    expect(routeSource).toContain("uniqueUsers(events, 'upgrade_checkout_failed')")
    expect(routeSource).toContain("event.resulting_status === 'active' || event.resulting_status === 'trial'")
    expect(routeSource).toContain('buildCaptainPilotFunnel')
    expect(routeSource).toContain(".from('captain_pilot_redemptions')")
    expect(pageStyles).toContain('@media (max-width: 560px)')
    expect(pageStyles).toContain('grid-template-columns: 1fr')
  })

  it('records a successful signup email as the funnel entry step without blocking signup delivery', () => {
    expect(signupSource).toContain("event_name: 'signup_confirmation_sent'")
    expect(signupSource).toContain("console.warn('Signup funnel event was not recorded.'")
    expect(signupSource.indexOf("if (!response.ok)")).toBeLessThan(signupSource.indexOf("event_name: 'signup_confirmation_sent'"))
  })
})
