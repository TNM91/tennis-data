import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(join(process.cwd(), 'app/admin/growth/page.tsx'), 'utf8')
const routeSource = readFileSync(join(process.cwd(), 'app/api/admin/growth-funnel/route.ts'), 'utf8')
const signupSource = readFileSync(join(process.cwd(), 'app/api/auth/signup/route.ts'), 'utf8')

describe('admin growth funnel', () => {
  it('keeps visitor traffic separate from signed-in product and billing conversion signals', () => {
    expect(pageSource).toContain('Visitor traffic belongs in Vercel Web Analytics.')
    expect(pageSource).toContain('Signup requests')
    expect(pageSource).toContain('Checkout starts')
    expect(pageSource).toContain('Paid activations')
    expect(routeSource).toContain('buildGrowthCohort(events, billingEvents)')
    expect(routeSource).toContain('buildFollowGrowthCohort(events, followRequests)')
    expect(routeSource).toContain(".select('requester_user_id, plan_id, next_href, created_at')")
    expect(pageSource).toContain('Player requests after click')
    expect(routeSource).toContain('.range(offset, offset + EVENT_PAGE_SIZE - 1)')
    expect(pageSource).toContain('First useful action')
    expect(pageSource).toContain('same members from signup')
  })

  it('records a successful signup email as the funnel entry step without blocking signup delivery', () => {
    expect(signupSource).toContain("event_name: 'signup_confirmation_sent'")
    expect(signupSource).toContain("console.warn('Signup funnel event was not recorded.'")
    expect(signupSource.indexOf("if (!response.ok)")).toBeLessThan(signupSource.indexOf("event_name: 'signup_confirmation_sent'"))
  })
})
