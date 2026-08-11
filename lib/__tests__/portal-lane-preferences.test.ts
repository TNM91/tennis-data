import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildPortalLaneOrder,
  DEFAULT_PINNED_PORTAL_LANES,
  getPortalLaneStorageKey,
  normalizePinnedPortalLanes,
} from '../portal-lane-preferences'

const portalSource = readFileSync(join(process.cwd(), 'app/components/portal-tool-bar.tsx'), 'utf8')

describe('portal lane personalization', () => {
  it('puts the four selected lanes first and preserves every remaining lane', () => {
    expect(buildPortalLaneOrder(['team', 'club', 'coach', 'you'])).toEqual([
      'team',
      'club',
      'coach',
      'you',
      'find',
      'compete',
      'league',
    ])
  })

  it('falls back to a complete default first row for invalid saved data', () => {
    expect(normalizePinnedPortalLanes(['team', 'team', 'unknown'])).toEqual(DEFAULT_PINNED_PORTAL_LANES)
    expect(normalizePinnedPortalLanes(null)).toEqual(DEFAULT_PINNED_PORTAL_LANES)
  })

  it('scopes saved navigation to the signed-in account', () => {
    expect(getPortalLaneStorageKey()).toBe('tenaceiq.portal-lanes.v1.guest')
    expect(getPortalLaneStorageKey('player-123')).toBe('tenaceiq.portal-lanes.v1.player-123')
  })

  it('offers a touch-friendly four-pin editor in the shared top menu', () => {
    expect(portalSource).toContain('data-mobile-portal-personalize={customizingPortalLanes')
    expect(portalSource).toContain('data-mobile-portal-customizer="true"')
    expect(portalSource).toContain('Pin four. They stay on the first row.')
    expect(portalSource).toContain("'repeat(8, minmax(0, 1fr))'")
    expect(portalSource).toContain("'repeat(4, minmax(0, 1fr))'")
    expect(portalSource).toContain('writePinnedPortalLanes(draftPinnedPortalLaneIds, userId)')
  })
})
