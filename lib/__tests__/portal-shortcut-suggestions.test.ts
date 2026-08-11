import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  getPortalShortcutUsageStorageKey,
  mergePortalShortcutSuggestionCandidates,
  rankPortalShortcutSuggestions,
} from '../portal-shortcut-suggestions'

const apiSource = readFileSync(join(process.cwd(), 'app/api/portal/shortcuts/route.ts'), 'utf8')
const toolbarSource = readFileSync(join(process.cwd(), 'app/components/portal-tool-bar.tsx'), 'utf8')

describe('portal shortcut suggestions', () => {
  it('ranks recent use first, then frequency, while excluding pinned tools', () => {
    const suggestions = rankPortalShortcutSuggestions([
      { shortcutId: 'action:mylab', usedAt: '2026-08-01T10:00:00.000Z' },
      { shortcutId: 'action:mylab', usedAt: '2026-08-01T10:00:00.000Z' },
      { shortcutId: 'action:tactics', usedAt: '2026-08-03T10:00:00.000Z' },
      { shortcutId: 'action:level-up', usedAt: '2026-08-02T10:00:00.000Z' },
      { shortcutId: 'unknown', usedAt: '2026-08-04T10:00:00.000Z' },
    ], ['action:level-up'])

    expect(suggestions).toEqual(['action:tactics', 'action:mylab'])
  })

  it('uses frequency to resolve equal recency and merges cloud with local candidates', () => {
    const suggestions = rankPortalShortcutSuggestions([
      { shortcutId: 'action:mylab', usedAt: '2026-08-03T10:00:00.000Z' },
      { shortcutId: 'action:tactics', usedAt: '2026-08-03T10:00:00.000Z' },
      { shortcutId: 'action:tactics', usedAt: '2026-08-02T10:00:00.000Z' },
    ])

    expect(suggestions).toEqual(['action:tactics', 'action:mylab'])
    expect(mergePortalShortcutSuggestionCandidates(
      ['action:tactics', 'action:mylab'],
      ['action:mylab', 'lane:club'],
    )).toEqual(['action:tactics', 'action:mylab', 'lane:club'])
  })

  it('keeps local usage scoped to the current account', () => {
    expect(getPortalShortcutUsageStorageKey()).toBe('tenaceiq.portal-shortcut-usage.v1.guest')
    expect(getPortalShortcutUsageStorageKey('player-123')).toBe('tenaceiq.portal-shortcut-usage.v1.player-123')
  })

  it('loads signed-in suggestions only when Edit opens and never changes pins automatically', () => {
    expect(apiSource).toContain("searchParams.get('suggestions') === '1'")
    expect(apiSource).toContain(".eq('event_name', 'portal_shortcut_opened')")
    expect(apiSource).toContain(".order('created_at', { ascending: false })")
    expect(toolbarSource).toContain('loadPortalShortcutSuggestionCandidates()')
    expect(toolbarSource).toContain('data-portal-shortcut-suggested={suggested')
    expect(toolbarSource).toContain('For you')
    expect(toolbarSource).not.toContain('setPinnedPortalShortcutIds(cloudSuggestions)')
  })
})
