import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildPortalLaneOrderFromShortcuts,
  DEFAULT_PINNED_PORTAL_SHORTCUTS,
  getPortalShortcutStorageKey,
  isPinnedPortalShortcutList,
  movePinnedPortalShortcut,
  normalizePinnedPortalShortcuts,
} from '../portal-lane-preferences'

const portalSource = readFileSync(join(process.cwd(), 'app/components/portal-tool-bar.tsx'), 'utf8')

describe('portal shortcut personalization', () => {
  it('accepts hubs and quick actions while preserving every lane in All tools', () => {
    expect(buildPortalLaneOrderFromShortcuts(['action:mylab', 'lane:team', 'action:tactics', 'lane:club'])).toEqual([
      'team',
      'club',
      'find',
      'you',
      'compete',
      'coach',
      'league',
    ])
  })

  it('falls back to a complete default first row for invalid saved data', () => {
    expect(normalizePinnedPortalShortcuts(['lane:team', 'lane:team', 'unknown'])).toEqual(DEFAULT_PINNED_PORTAL_SHORTCUTS)
    expect(normalizePinnedPortalShortcuts(null)).toEqual(DEFAULT_PINNED_PORTAL_SHORTCUTS)
  })

  it('accepts one through seven unique known shortcuts for cloud storage', () => {
    expect(isPinnedPortalShortcutList(['action:mylab', 'action:tactics', 'lane:team', 'lane:club'])).toBe(true)
    expect(isPinnedPortalShortcutList(['action:mylab', 'action:tactics', 'lane:team', 'lane:club', 'lane:find', 'lane:you', 'lane:compete'])).toBe(true)
    expect(isPinnedPortalShortcutList(['action:mylab', 'action:mylab', 'lane:team', 'lane:club'])).toBe(false)
    expect(isPinnedPortalShortcutList([])).toBe(false)
    expect(isPinnedPortalShortcutList(['action:mylab', 'lane:team', 'lane:club', 'lane:find', 'lane:you', 'lane:compete', 'lane:coach', 'lane:league'])).toBe(false)
    expect(isPinnedPortalShortcutList(['action:mylab', 'action:unknown', 'lane:team', 'lane:club'])).toBe(false)
  })

  it('moves a selected shortcut one position without changing the other pins', () => {
    const pins = ['lane:find', 'action:mylab', 'lane:team', 'lane:club'] as const

    expect(movePinnedPortalShortcut(pins, 'lane:team', -1)).toEqual([
      'lane:find',
      'lane:team',
      'action:mylab',
      'lane:club',
    ])
    expect(movePinnedPortalShortcut(pins, 'action:mylab', 1)).toEqual([
      'lane:find',
      'lane:team',
      'action:mylab',
      'lane:club',
    ])
    expect(movePinnedPortalShortcut(pins, 'lane:find', -1)).toEqual(pins)
    expect(movePinnedPortalShortcut(pins, 'lane:club', 1)).toEqual(pins)
  })

  it('scopes saved shortcuts to the signed-in account', () => {
    expect(getPortalShortcutStorageKey()).toBe('tenaceiq.portal-shortcuts.v2.guest')
    expect(getPortalShortcutStorageKey('player-123')).toBe('tenaceiq.portal-shortcuts.v2.player-123')
  })

  it('offers actions, a single shortcut editor, and a one-time cue in the shared top menu', () => {
    expect(portalSource).toContain("id: 'action:mylab'")
    expect(portalSource).toContain("id: 'action:tactics'")
    expect(portalSource).not.toContain('data-mobile-portal-shortcut-add={index + 1}')
    expect(portalSource).toContain('data-mobile-portal-personalize="open"')
    expect(portalSource).toContain('data-portal-personalization-cue="true"')
    expect(portalSource).toContain('Pin My Lab, Tactics, or the hubs you use most.')
    expect(portalSource).toContain('writePinnedPortalShortcuts(draftPinnedPortalShortcutIds, userId)')
    expect(portalSource).toContain('loadPortalShortcutCloudState(accessToken, controller.signal)')
    expect(portalSource).toContain('syncPortalShortcutsToCloud(savedShortcutIds, true)')
    expect(portalSource).not.toContain('syncPortalShortcutsToCloud(pinnedPortalShortcutIds, true)')
    expect(portalSource).toContain('draftPinnedPortalShortcuts.map((shortcut)')
    expect(portalSource).toContain('unpinnedPortalShortcutOptions.map((shortcut)')
    expect(portalSource).toContain('data-portal-shortcut-selected={selected')
    expect(portalSource).toContain('Move it or unpin it.')
    expect(portalSource).toContain('moveSelectedPortalShortcut(event, -1)')
    expect(portalSource).toContain('moveSelectedPortalShortcut(event, 1)')
    expect(portalSource).toContain('onClick={unpinSelectedPortalShortcut}')
  })
})
