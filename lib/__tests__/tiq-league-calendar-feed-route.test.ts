import { describe, expect, it, vi } from 'vitest'

const scheduleRows = [
  {
    id: 'schedule-1',
    league_id: 'league-1',
    league_format: 'individual',
    participant_a_name: 'Alice',
    participant_b_name: 'Bob',
    scheduled_date: '2026-02-01',
    scheduled_time: '09:00',
    facility: 'Court 1',
    status: 'confirmed',
    notes: 'Bring balls',
  },
]

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from(table: string) {
      if (table === 'tiq_leagues') {
        return {
          select() {
            return this
          },
          eq() {
            return this
          },
          async maybeSingle() {
            return {
              data: {
                id: 'league-1',
                league_name: 'Tuesday Ladder',
                season_label: 'Spring 2026',
                schedule_time_zone: 'America/New_York',
                is_public: true,
              },
              error: null,
            }
          },
        }
      }

      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        neq() {
          return this
        },
        order() {
          return this
        },
        then(resolve: (value: { data: typeof scheduleRows; error: null }) => void) {
          resolve({ data: scheduleRows, error: null })
        },
      }
    },
  })),
}))

vi.mock('@/lib/tiq-league-schedule-calendar', async () => {
  return await import('../tiq-league-schedule-calendar')
})

describe('TIQ league calendar feed route', () => {
  it('returns a subscribe-ready iCal feed for public league schedules', async () => {
    const route = await import('../../app/api/calendar/tiq-league/[leagueId]/calendar.ics/route')
    const response = await route.GET(
      new Request('https://tenaceiq.com/api/calendar/tiq-league/league-1/calendar.ics'),
      { params: Promise.resolve({ leagueId: 'league-1' }) },
    )
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/calendar')
    expect(response.headers.get('cache-control')).toContain('max-age=300')
    expect(response.headers.get('content-disposition')).toBe('inline; filename="tenaceiq-league-1.ics"')
    expect(body).toContain('BEGIN:VCALENDAR')
    expect(body).toContain('X-WR-CALNAME:Tuesday Ladder - Spring 2026')
    expect(body).toContain('UID:schedule-1@tenaceiq.com')
    expect(body).toContain('SUMMARY:Alice vs Bob')
    expect(body).toContain('DTSTART;TZID=America/New_York:20260201T090000')
    expect(body).toContain('URL:https://tenaceiq.com/explore/leagues/tiq/league-1?league_id=league-1')
  })
})
