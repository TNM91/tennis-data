import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCaptainAvailabilityProgress } from '../captain-availability-progress'
import { mergeCaptainWeeklyResponses } from '../captain-weekly-responses'

describe('captain availability progress', () => {
  it('counts only replies for the selected match date', () => {
    const result = buildCaptainAvailabilityProgress({
      matchDate: '2026-08-12',
      invites: [
        { playerId: 'player-1', playerName: 'Alex Ace' },
        { playerId: 'player-2', playerName: 'Casey Court' },
      ],
      responses: [
        { player_id: 'player-1', player_name: 'Alex Ace', match_date: '2026-08-12', status: 'available' },
        { player_id: 'player-2', player_name: 'Casey Court', match_date: '2026-08-19', status: 'available' },
      ],
    })

    expect(result).toMatchObject({
      invitedCount: 2,
      answeredCount: 1,
      pendingCount: 1,
      unansweredNames: ['Casey Court'],
    })
  })

  it('matches a reply by normalized player name when no player ID exists', () => {
    const result = buildCaptainAvailabilityProgress({
      matchDate: '2026-08-12',
      invites: [{ playerId: '', playerName: 'Alex Ace' }],
      responses: [{ player_id: null, player_name: 'alex ace', match_date: '2026-08-12', status: 'Maybe' }],
    })

    expect(result.people[0].status).toBe('maybe')
    expect(result.pendingCount).toBe(0)
  })

  it('keeps a secure-link reply in the Captain weekly response view', () => {
    const result = mergeCaptainWeeklyResponses({
      eventKey: '2026-09-14-super-smash',
      matchDate: '2026-09-14',
      localResponses: [],
      liveResponses: [{
        player_id: 'miles-id',
        player_name: 'Miles Yetter',
        match_date: '2026-09-14',
        status: 'available',
        responded_at: '2026-09-02T01:17:11.853Z',
      }],
    })

    expect(result).toEqual([expect.objectContaining({
      event_key: '2026-09-14-super-smash',
      contact_id: 'miles-id',
      status: 'confirmed',
    })])
  })

  it('keeps live progress and unanswered reminders on the first Captain screen', () => {
    const source = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')

    expect(source).toContain("fetch(`/api/captain/availability-requests?${query.toString()}`")
    expect(source).toContain('buildCaptainAvailabilityProgress({')
    expect(source).toContain('mergeCaptainWeeklyResponses({')
    expect(source).toContain('visibleRosterMembers')
    expect(source).toContain('Upcoming match availability')
    expect(source).toContain('Remind unanswered')
    expect(source).toContain('captainHomeUnansweredSmsHandoff.href')
    expect(source).toContain('Respond here: ${responseLink}')
  })
})
