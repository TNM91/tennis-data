import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildPortalShortcutPinRecommendation,
  getPortalShortcutRecommendationDismissalKey,
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
    expect(getPortalShortcutRecommendationDismissalKey('player-123')).toBe('tenaceiq.portal-shortcut-recommendation.v1.player-123')
  })

  it('recommends an explicit least-used replacement after three All tools opens', () => {
    const now = Date.parse('2026-08-11T12:00:00.000Z')
    const recommendation = buildPortalShortcutPinRecommendation([
      { shortcutId: 'lane:club', usedAt: '2026-08-11T11:00:00.000Z', source: 'all_tools' },
      { shortcutId: 'lane:club', usedAt: '2026-08-10T11:00:00.000Z', source: 'all_tools' },
      { shortcutId: 'lane:club', usedAt: '2026-08-09T11:00:00.000Z', source: 'all_tools' },
      { shortcutId: 'lane:find', usedAt: '2026-08-11T10:00:00.000Z', source: 'pinned' },
      { shortcutId: 'lane:you', usedAt: '2026-08-10T10:00:00.000Z', source: 'pinned' },
      { shortcutId: 'lane:compete', usedAt: '2026-08-09T10:00:00.000Z', source: 'pinned' },
      { shortcutId: 'lane:team', usedAt: '2026-08-08T10:00:00.000Z', source: 'pinned' },
    ], ['lane:find', 'lane:you', 'lane:compete', 'lane:team'], {}, now)

    expect(recommendation).toEqual({ shortcutId: 'lane:club', replaceShortcutId: 'lane:team' })
  })

  it('does not recommend from ordinary pinned use or during a dismissal cooldown', () => {
    const now = Date.parse('2026-08-11T12:00:00.000Z')
    const signals = [
      { shortcutId: 'lane:club', usedAt: '2026-08-11T11:00:00.000Z', source: 'all_tools' },
      { shortcutId: 'lane:club', usedAt: '2026-08-10T11:00:00.000Z', source: 'all_tools' },
      { shortcutId: 'lane:club', usedAt: '2026-08-09T11:00:00.000Z', source: 'all_tools' },
    ]
    const pins = ['lane:find', 'lane:you', 'lane:compete', 'lane:team'] as const

    expect(buildPortalShortcutPinRecommendation(
      signals.map((signal) => ({ ...signal, source: 'pinned' })),
      pins,
      {},
      now,
    )).toBeNull()
    expect(buildPortalShortcutPinRecommendation(
      signals,
      pins,
      { 'lane:club': now - 24 * 60 * 60 * 1000 },
      now,
    )).toBeNull()
  })

  it('loads signed-in suggestions only when Edit opens and never changes pins automatically', () => {
    expect(apiSource).toContain("searchParams.get('suggestions') === '1'")
    expect(apiSource).toContain(".eq('event_name', 'portal_shortcut_opened')")
    expect(apiSource).toContain(".order('created_at', { ascending: false })")
    expect(toolbarSource).toContain('loadPortalShortcutSuggestionCandidates()')
    expect(toolbarSource).toContain('data-portal-shortcut-suggested={suggested')
    expect(toolbarSource).toContain('For you')
    expect(toolbarSource).toContain('data-portal-pin-recommendation="true"')
    expect(toolbarSource).toContain('Replaces {getPortalShortcutLabel')
    expect(toolbarSource).toContain("source: 'usage_recommendation'")
    expect(toolbarSource).not.toContain('setPinnedPortalShortcutIds(cloudSuggestions)')
  })
})
