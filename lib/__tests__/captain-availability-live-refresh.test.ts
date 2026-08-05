import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildCaptainAvailabilityResponseSignature,
  CAPTAIN_AVAILABILITY_REFRESH_MS,
  findLatestCaptainAvailabilityLineupRisk,
  findLatestCaptainAvailabilityRiskChange,
} from '../captain-availability-live'

const captainHomeSource = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')
const availabilitySource = readFileSync(join(process.cwd(), 'app/captain/availability/page.tsx'), 'utf8')

describe('Captain availability live refresh', () => {
  it('builds a stable signature that changes with reply status or time', () => {
    const replies = [
      { player_id: 'player-2', player_name: 'Blair', status: 'maybe', responded_at: '2026-08-04T20:00:00.000Z' },
      { player_id: 'player-1', player_name: 'Alex', status: 'available', responded_at: '2026-08-04T19:00:00.000Z' },
    ]
    expect(buildCaptainAvailabilityResponseSignature(replies)).toBe(
      buildCaptainAvailabilityResponseSignature([...replies].reverse()),
    )
    expect(buildCaptainAvailabilityResponseSignature(replies)).not.toBe(
      buildCaptainAvailabilityResponseSignature([
        replies[0],
        { ...replies[1], status: 'unavailable' },
      ]),
    )
  })

  it('selects the newest changed Out or Maybe reply for lineup review', () => {
    const previous = [
      { player_name: 'Alex Ace', match_date: '2026-08-12', status: 'available', responded_at: '2026-08-04T19:00:00.000Z' },
      { player_name: 'Blair Ball', match_date: '2026-08-12', status: 'available', responded_at: '2026-08-04T19:05:00.000Z' },
    ]
    const risk = findLatestCaptainAvailabilityRiskChange(previous, [
      { ...previous[0], status: 'unavailable', responded_at: '2026-08-04T20:00:00.000Z' },
      { ...previous[1], status: 'maybe', responded_at: '2026-08-04T20:05:00.000Z' },
    ])
    expect(risk?.player_name).toBe('Blair Ball')
    expect(risk?.status).toBe('maybe')
    expect(findLatestCaptainAvailabilityRiskChange(previous, [
      { ...previous[0], responded_at: '2026-08-04T20:00:00.000Z' },
      previous[1],
    ])).toBeNull()
  })

  it('keeps a current lineup risk active until that player leaves the court', () => {
    const responses = [
      { player_name: 'Alex Ace', match_date: '2026-08-12', status: 'out', responded_at: '2026-08-04T20:00:00.000Z' },
      { player_name: 'Blair Ball', match_date: '2026-08-12', status: 'maybe', responded_at: '2026-08-04T20:05:00.000Z' },
    ]
    expect(findLatestCaptainAvailabilityLineupRisk(responses, [
      { courtLabel: 'Doubles 1', players: ['Alex Ace', 'Casey Court'] },
    ])).toMatchObject({
      courtLabel: 'Doubles 1',
      response: { player_name: 'Alex Ace', status: 'out' },
    })
    expect(findLatestCaptainAvailabilityLineupRisk(responses, [
      { courtLabel: 'Doubles 1', players: ['Jordan Jump', 'Casey Court'] },
    ])).toBeNull()
  })

  it('keeps polling light and limited to visible captain pages', () => {
    expect(CAPTAIN_AVAILABILITY_REFRESH_MS).toBe(15_000)
    for (const source of [captainHomeSource, availabilitySource]) {
      expect(source).toContain('document.visibilityState === \'visible\'')
      expect(source).toContain('CAPTAIN_AVAILABILITY_REFRESH_MS')
      expect(source).toContain("window.addEventListener('pageshow', refreshVisibleAvailability)")
      expect(source).toContain("window.addEventListener('focus', refreshVisibleAvailability)")
      expect(source).toContain("document.addEventListener('visibilitychange', refreshVisibleAvailability)")
      expect(source).toContain("'Updated just now'")
      expect(source).toContain("'Live replies'")
    }
  })

  it('uses the request id and guards overlapping Availability page reads', () => {
    expect(availabilitySource).toContain('new URLSearchParams({ requestId: availabilityRequestId })')
    expect(availabilitySource).toContain('availabilityRefreshInFlightRef.current === availabilityRequestId')
    expect(availabilitySource).toContain("cache: 'no-store'")
    expect(captainHomeSource).toContain('captainAvailabilityRequestInFlightRef.current === requestScope')
  })

  it('raises a changed risk reply above polled notifications with one lineup action', () => {
    expect(captainHomeSource).toContain('findLatestCaptainAvailabilityRiskChange(')
    expect(captainHomeSource).toContain('findLatestCaptainAvailabilityLineupRisk(')
    expect(captainHomeSource).toContain('?? captainPersistentLineupRiskAlert')
    expect(captainHomeSource).toContain("'Review affected lineup'")
    expect(captainHomeSource).toContain('captainReplyAffectsSavedLineup ? captainReplacementLineupHref')
    expect(captainHomeSource).toContain('setCaptainLiveReplyAlert(null)')
  })

  it('keeps the affected court visible through replacement confirmation', () => {
    expect(captainHomeSource).toContain("'Unresolved lineup change'")
    expect(captainHomeSource).toContain("'Send lineup change'")
    expect(captainHomeSource).toContain("'Check confirmation'")
    expect(captainHomeSource).toContain('!captainReplyAlertIsPersistent')
    expect(captainHomeSource).toContain("const captainOpenLineupChange = captainLineupChange?.response === 'accepted'")
  })
})
