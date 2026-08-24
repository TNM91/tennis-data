import { describe, expect, it } from 'vitest'
import { buildMatchupPrepHref, readMatchupPrepDraft } from '@/lib/matchup-prep-note'

describe('matchup prep note handoff', () => {
  const draft = {
    id: 'singles:player-a:player-b',
    title: 'Match prep: Player A vs Player B',
    context: '56% vs 44% - medium confidence',
    evidence: 'Recent form is close. No recorded head-to-head yet.',
    courtPlan: 'Protect the opening four games and repeat the highest-percentage pattern.',
  }

  it('round-trips a private Matchup read into My Lab', () => {
    const href = buildMatchupPrepHref(draft)
    const url = new URL(href, 'https://tenaceiq.test')

    expect(url.pathname).toBe('/mylab')
    expect(url.hash).toBe('#player-notebook')
    expect(readMatchupPrepDraft(url.searchParams.get('matchupPrep'))).toEqual(draft)
  })

  it('fails closed for malformed or incomplete payloads', () => {
    expect(readMatchupPrepDraft('{bad json')).toBeNull()
    expect(readMatchupPrepDraft(JSON.stringify({ id: 'only-an-id' }))).toBeNull()
    expect(buildMatchupPrepHref({ ...draft, courtPlan: '' })).toBe('/mylab#player-notebook')
  })
})
