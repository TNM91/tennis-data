import { describe, expect, it } from 'vitest'
import { buildLeagueWeeklyRecapEmail, normalizeLeagueWeeklyRecapDraft, validateLeagueWeeklyRecapDraft } from '../league-weekly-recap-delivery'

describe('weekly recap delivery', () => {
  it('trims and bounds owner-written recap content', () => {
    expect(normalizeLeagueWeeklyRecapDraft({ headline: '  Big week  ', summary: ' Strong tennis. ', stories: ['  Great sportsmanship  ', ''] })).toEqual({
      headline: 'Big week',
      summary: 'Strong tennis.',
      stories: ['Great sportsmanship'],
    })
  })

  it('requires a headline and summary', () => {
    expect(validateLeagueWeeklyRecapDraft({ headline: '', summary: 'Scores are in.', stories: [] })).toContain('headline')
    expect(validateLeagueWeeklyRecapDraft({ headline: 'Week 3', summary: '', stories: [] })).toContain('summary')
  })

  it('escapes player-supplied content in the email', () => {
    const email = buildLeagueWeeklyRecapEmail({
      leagueName: 'Thursday <League>',
      playOn: '2026-10-01',
      draft: { headline: 'A & B', summary: '<script>alert(1)</script>', stories: ['"Great" point'] },
      href: 'https://tenaceiq.com/league-week/abc',
    })
    expect(email.html).toContain('Thursday &lt;League&gt;')
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(email.html).not.toContain('<script>')
    expect(email.text).toContain('• "Great" point')
  })
})
