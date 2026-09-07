import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildTeamSeasonCalendars } from '../team-season-calendar'
import { buildSeasonCalendarDownload, createSeasonCalendarLink, saveSeasonCalendarItems } from '../season-calendar-actions'

type Row = Record<string, unknown>
const state = vi.hoisted(() => ({ tables: new Map<string, Row[]>(), owner: 'owner-one' }))
// In-memory storage only; exercise the real save, link, load, venue and ICS routes.
const db = vi.hoisted(() => ({
  from(table: string) {
    const filters: Array<(row: Row) => boolean> = []
    let patch: Row | undefined
    let saved: Row[] | undefined
    let bounds: [number, number] | undefined
    const result = () => {
      let rows = saved || (state.tables.get(table) || []).filter(row => filters.every(filter => filter(row)))
      if (patch) rows.forEach(row => Object.assign(row, patch))
      if (bounds) rows = rows.slice(bounds[0], bounds[1] + 1)
      return { data: rows, error: null }
    }
    return {
      select() { return this }, order() { return this }, limit() { return this },
      eq(field: string, value: unknown) { filters.push(row => row[field] === value); return this },
      in(field: string, values: unknown[]) { filters.push(row => values.includes(row[field])); return this },
      range(start: number, end: number) { bounds = [start, end]; return this },
      update(value: Row) { patch = value; return this },
      insert(value: Row) { const rows = state.tables.get(table) || []; rows.push({ id: `token-${rows.length}`, ...value }); state.tables.set(table, rows); return this },
      upsert(values: Row[], options: { onConflict: string }) {
        expect(options.onConflict).toBe('id')
        const rows = state.tables.get(table) || []
        saved = values.map(value => {
          const existing = rows.find(row => row.id === value.id)
          if (existing) return Object.assign(existing, value)
          const created = { created_at: '2026-09-07T12:00:00Z', ...value }
          rows.push(created)
          return created
        })
        state.tables.set(table, rows)
        return this
      },
      async maybeSingle() { return { data: result().data[0] || null, error: null } },
      then(resolve: (value: { data: Row[]; error: null }) => void) { resolve(result()) },
    }
  },
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => db }))
vi.mock('@/lib/player-api-auth', () => ({ getSignedInPlayerApiAuth: async () => ({ ok: true, userId: state.owner, supabase: db }) }))
vi.mock('@/lib/supabase', () => ({ supabaseUrl: 'https://example.test' }))
vi.mock('@/lib/player-competition-schedule', () => ({ loadPlayerCompetitionSchedule: async () => [], buildPlayerCompetitionCalendarEvent: vi.fn() }))

const dates = ['2026-09-13', '2026-09-20', '2026-09-27', '2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25', '2026-11-08', '2026-11-15', '2026-11-22', '2026-12-06', '2026-12-13', '2027-01-03', '2027-01-10']
const fixtures = dates.map((date, i) => ({ id: `fixture-${i}`, external_match_id: `tennislink-${i}`, home_team: 'Calendar Aces', away_team: `Opponent ${i}`, match_date: date, match_time: i === 2 ? null : '18:00:00', facility: 'Test Club', league_name: '2027 Adult Fall', flight: '4.5' }))
const items = () => buildTeamSeasonCalendars('Calendar Aces', fixtures, state.owner)[0].items.map(item => ({ ...item, venueDirectoryId: 'venue-1' }))
const request: typeof fetch = async (url, init) => {
  const req = new Request(new URL(String(url), 'https://www.tenaceiq.com'), init)
  if (String(url).includes('personal-calendar-link')) return (await import('../../app/api/player/personal-calendar-link/route')).POST(req)
  return (await import('../../app/api/player/calendar-items/route')).POST(req)
}
async function feed(url: string, userId = state.owner) {
  return (await import('../../app/api/calendar/player/[userId]/calendar.ics/route')).GET(new Request(url), { params: Promise.resolve({ userId }) })
}
function uids(ics: string) { return ics.replace(/\r\n /g, '').split('\r\n').filter(line => line.startsWith('UID:')).sort() }

describe('14-match season → save → private subscription', () => {
  beforeEach(() => {
    state.tables.clear(); state.owner = 'owner-one'
    state.tables.set('calendar_venue_directory', [{ id: 'venue-1', facility_name: 'Test Club', street_address: '123 Main St', city: 'St. Louis', state_code: 'MO' }])
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-only')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('saves all 14, retries without duplicate rows, and preserves feed identities in the download', async () => {
    await saveSeasonCalendarItems(items(), 'synthetic', vi.fn(), request)
    await saveSeasonCalendarItems(items(), 'synthetic', vi.fn(), request)
    expect(state.tables.get('player_calendar_items')).toHaveLength(14)
    const url = await createSeasonCalendarLink('synthetic', request)
    const response = await feed(url)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/calendar')
    expect(response.headers.get('cache-control')).toContain('private')
    const ics = await response.text()
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(14)
    expect(new Set(uids(ics)).size).toBe(14)
    expect(ics).toContain('DTSTART;TZID=America/Chicago:20260913T180000')
    expect(ics).toContain('DTSTART;TZID=America/Chicago:20261108T180000')
    expect(ics).toContain('DTSTART;TZID=America/Chicago:20270110T180000')
    expect(ics).toContain('DTSTART;VALUE=DATE:20260927')
    expect(ics).toContain('DTEND;VALUE=DATE:20260928')
    expect(ics.match(/123 Main St/g)).toHaveLength(14)
    expect(uids(buildSeasonCalendarDownload(items(), 'Season', 'America/Chicago'))).toEqual(uids(ics))
  })

  it('updates a saved match and verified address through an existing link without creating another event', async () => {
    const original = items()
    await saveSeasonCalendarItems(original, 'synthetic', vi.fn(), request)
    const url = await createSeasonCalendarLink('synthetic', request)
    const before = await (await feed(url)).text()
    const moved = buildTeamSeasonCalendars('Calendar Aces', [{ ...fixtures[0], match_date: '2026-09-15', match_time: '19:30:00' }], state.owner)[0].items[0]
    expect(moved.id).toBe(original[0].id)
    await saveSeasonCalendarItems([{ ...moved, venueDirectoryId: 'venue-1' }], 'synthetic', vi.fn(), request)
    state.tables.get('calendar_venue_directory')![0].street_address = '456 Corrected Ave'
    const after = await (await feed(url)).text()
    expect(uids(after)).toEqual(uids(before))
    expect(state.tables.get('player_calendar_items')).toHaveLength(14)
    expect(after).toContain('DTSTART;TZID=America/Chicago:20260915T193000')
    expect(after).not.toContain('DTSTART;TZID=America/Chicago:20260913T180000')
    expect(after.match(/456 Corrected Ave/g)).toHaveLength(14)
    expect(after).not.toContain('123 Main St')
  })

  it('keeps prior device links valid, isolates owners, and respects explicit revocation', async () => {
    await saveSeasonCalendarItems(items(), 'synthetic', vi.fn(), request)
    const first = await createSeasonCalendarLink('synthetic', request)
    const second = await createSeasonCalendarLink('synthetic', request)
    expect(first).not.toBe(second)
    expect((await feed(first)).status).toBe(200)
    expect((await feed(second)).status).toBe(200)
    expect((await feed(first, 'other-owner')).status).toBe(404)
    state.tables.get('player_calendar_items')!.push({ id: 'private-other', player_user_id: 'other-owner', title: 'Other owner private event', scheduled_date: '2026-09-13', kind: 'practice' })
    expect(await (await feed(first)).text()).not.toContain('Other owner private event')
    await (await import('../../app/api/player/personal-calendar-link/route')).DELETE(new Request('https://www.tenaceiq.com/api/player/personal-calendar-link', { method: 'DELETE' }))
    expect((await feed(first)).status).toBe(404)
    expect((await feed(second)).status).toBe(404)
    expect((await feed('https://www.tenaceiq.com/api/calendar/player/owner-one/calendar.ics')).status).toBe(401)
  })
})
