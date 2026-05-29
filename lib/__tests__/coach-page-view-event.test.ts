import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const trackerSource = readFileSync(join(process.cwd(), 'app/components/product-event-tracker.tsx'), 'utf8')
const coachesSource = readFileSync(join(process.cwd(), 'app/coaches/page.tsx'), 'utf8')
const eventsSource = readFileSync(join(process.cwd(), 'lib/product-usage-events.ts'), 'utf8')

describe('Coach page view event', () => {
  it('has a reusable page-view tracker that never renders UI', () => {
    expect(trackerSource).toContain("'use client'")
    expect(trackerSource).toContain('useEffect')
    expect(trackerSource).toContain('trackProductUsageEvent(event)')
    expect(trackerSource).toContain('return null')
  })

  it('tracks the public Coaches landing page view', () => {
    expect(eventsSource).toContain("'coach_page_viewed'")
    expect(coachesSource).toContain('ProductEventTracker')
    expect(coachesSource).toContain("eventName: 'coach_page_viewed'")
    expect(coachesSource).toContain("page: '/coaches'")
    expect(coachesSource).toContain("primary={{ href: '/resources?q=find%20a%20coach', label: 'Find a Coach' }}")
  })
})
