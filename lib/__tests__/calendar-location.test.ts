import { describe, expect, it } from 'vitest'
import { calendarVenues, resolveCalendarLocation } from '../calendar-location'
import { buildTeamScheduleCalendarItems } from '../team-schedule-calendar'
import { buildPlayerCalendarItemPayload, mapPlayerCalendarItemRow } from '../player-calendar-items'
import { buildTennisCalendarFeed } from '../tiq-league-schedule-calendar'
import { googleMatchCalendarUrl } from '../season-calendar-actions'

describe('verified calendar venue addresses', () => {
  it.each(calendarVenues)('enriches exact aliases with verified address: $address', (venue) => {
    for (const alias of venue.aliases) {
      const location = resolveCalendarLocation(alias)
      expect(location).toBe(`${alias} — ${venue.address}`)
      expect(resolveCalendarLocation(location)).toBe(location)
      expect(location.length).toBeLessThanOrEqual(160)
    }
    expect(venue.source).toMatch(/^https:\/\//)
    expect(venue.verifiedOn).toBe('2026-09-07')
  })

  it.each(['Concord', 'West', 'Forest Lake Club', 'Vetta West - Court 2', 'Vetta West, 5 Custom Rd, Austin, TX', 'Unknown Tennis Club'])('does not guess or overwrite %s', (location) => {
    expect(resolveCalendarLocation(location)).toBe(location)
  })

  it('accepts case/spacing differences and empty locations', () => {
    expect(resolveCalendarLocation(' vetta  west ')).toContain('1330 Harvestowne Industrial Dr')
    expect(resolveCalendarLocation(null)).toBe('')
    expect(resolveCalendarLocation(undefined)).toBe('')
    expect(resolveCalendarLocation('   ')).toBe('')
  })

  it('carries the address through season saving, existing items, and subscribed/downloaded ICS without changing IDs', () => {
    const [item] = buildTeamScheduleCalendarItems({
      teamName: 'Aces', calendarOwnerId: 'owner',
      matches: [{ externalMatchId: '123', matchDate: '2026-09-13', matchTime: '10:00', homeTeam: 'Aces', awayTeam: 'Volleys', facility: 'Vetta West' }],
    })
    expect(item.id).toBe('team-schedule-owner-aces-123')
    expect(item.location).toContain('1330 Harvestowne Industrial Dr')
    const payload = buildPlayerCalendarItemPayload(item, 'owner')!
    expect(payload.location).toBe(item.location)
    const existing = mapPlayerCalendarItemRow({ ...payload, created_at: '2026-09-01', location: 'Vetta West' })
    expect(existing.location).toBe(item.location)
    expect(existing.id).toBe(item.id)
    const unfolded = buildTennisCalendarFeed([{ ...existing, location: 'Vetta West' }]).replace(/\r\n /g, '')
    expect(unfolded).toContain('LOCATION:Vetta West — 1330 Harvestowne Industrial Dr\\, St. Peters\\, MO 63304')
    expect(unfolded.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(new URL(googleMatchCalendarUrl({ ...item, location: 'Vetta West' })).searchParams.get('location')).toBe(item.location)
  })
})
