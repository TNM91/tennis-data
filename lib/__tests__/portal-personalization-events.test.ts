import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const toolbarSource = readFileSync(join(process.cwd(), 'app/components/portal-tool-bar.tsx'), 'utf8')
const adminSource = readFileSync(join(process.cwd(), 'app/admin/product-events/page.tsx'), 'utf8')

describe('portal personalization analytics', () => {
  it('tracks discovery, saves, blocked saves, and lane use', () => {
    for (const eventName of [
      'portal_personalization_opened',
      'portal_personalization_saved',
      'portal_personalization_save_blocked',
      'portal_lane_opened',
    ]) {
      expect(toolbarSource).toContain(`eventName: '${eventName}'`)
    }

    expect(toolbarSource).toContain("surface: 'portal'")
    expect(toolbarSource).toContain('previousPinnedLanes: pinnedPortalLaneIds')
    expect(toolbarSource).toContain('pinnedPosition: pinnedPosition > 0 ? pinnedPosition : null')
    expect(toolbarSource).toContain('requiredCount: PORTAL_LANE_PIN_LIMIT')
  })

  it('surfaces portal adoption in Admin Product Events', () => {
    expect(adminSource).toContain("event.event_name === 'portal_personalization_saved'")
    expect(adminSource).toContain("event.event_name === 'portal_lane_opened'")
    expect(adminSource).toContain('label="Portal Saves"')
    expect(adminSource).toContain('<option value="portal">Portal navigation</option>')
  })
})
