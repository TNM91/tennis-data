import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildTeamSeasonCalendars } from '../team-season-calendar'
import { buildSeasonCalendarDownload, createSeasonCalendarLink, saveSeasonCalendarItems } from '../season-calendar-actions'

type Row = Record<string, unknown>
const state = vi.hoisted(() => ({ tables: new Map<string, Row[]>(), owner: 'owner-one', authorized: true, failure: '' }))
// In-memory storage only; exercise the real save, link, load, venue and ICS routes.
const db = vi.hoisted(() => ({
  from(table: string) {
    const filters: Array<(row: Row) => boolean> = []
    let patch: Row | undefined
    let saved: Row[] | undefined
    let bounds: [number, number] | undefined
    let columns = '*'
    const result = () => {
      let rows = saved || (state.tables.get(table) || []).filter(row => filters.every(filter => filter(row)))
      if (patch) rows.forEach(row => Object.assign(row, patch))
      if (bounds) rows = rows.slice(bounds[0], bounds[1] + 1)
      if (columns !== '*') rows = rows.map(row => Object.fromEntries(columns.split(',').map(key => key.trim()).map(key => [key, row[key]])))
      return { data: rows, error: state.failure === table ? { message: 'Synthetic failure' } : null }
    }
    return {
      select(value = '*') { columns = value; return this }, order() { return this }, limit() { return this },
      eq(field: string, value: unknown) { filters.push(row => row[field] === value); return this },
      in(field: string, values: unknown[]) { filters.push(row => values.includes(row[field])); return this },
      range(start: number, end: number) { bounds = [start, end]; return this },
      update(value: Row) { patch = value; return this },
      insert(value: Row) { const rows = state.tables.get(table) || []; const row = { id: `00000000-0000-4000-8000-${String(rows.length).padStart(12,'0')}`, status: 'active', created_at: '2026-09-07T12:00:00Z', ...value }; rows.push(row); saved = [row]; state.tables.set(table, rows); return this },
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
      async maybeSingle() { const value = result(); return { data: value.data[0] || null, error: value.error } },
      async single() { return this.maybeSingle() },
      then(resolve: (value: ReturnType<typeof result>) => void) { resolve(result()) },
    }
  },
}))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => db }))
vi.mock('@/lib/player-api-auth', () => ({ getSignedInPlayerApiAuth: async () => state.authorized ? ({ ok: true, userId: state.owner, supabase: db }) : ({ ok:false, response: new Response('Sign in', {status:401}) }) }))
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

async function shareRequest(method: 'POST'|'PATCH'|'GET'|'DELETE', body?: Row, id = '') {
  const routes = await import('../../app/api/player/match-calendar-shares/route')
  return routes[method](new Request(`https://www.tenaceiq.com/api/player/match-calendar-shares${id ? `?id=${id}` : ''}`, {method, ...(body ? {body:JSON.stringify(body),headers:{'Content-Type':'application/json'}} : {})}))
}
async function createShare(ids = items().map(item => item.id)) {
  const response = await shareRequest('POST', {label:'Family',teamName:'Calendar Aces',seasonKey:'Fall',itemIds:ids})
  expect(response.status).toBe(200)
  return await response.json() as {share: {id:string;item_ids:string[]};shareUrl:string}
}
async function sharedFeed(url: string, json = false) {
  const link = new URL(url)
  const shareId = link.pathname.split('/').at(-1)!
  const req = new Request(`https://www.tenaceiq.com/api/calendar/shared/${shareId}/calendar.ics?token=${link.hash.slice(1)}`, {headers:json ? {Accept:'application/json'} : {}})
  return (await import('../../app/api/calendar/shared/[shareId]/calendar.ics/route')).GET(req, {params:Promise.resolve({shareId})})
}

describe('14-match season → save → private subscription', () => {
  beforeEach(() => {
    state.tables.clear(); state.owner = 'owner-one'; state.authorized = true; state.failure = ''
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

  it('shares only selected own match fields and stores a hash, never the bearer secret', async () => {
    await saveSeasonCalendarItems(items(), 'synthetic', vi.fn(), request)
    const rows = state.tables.get('player_calendar_items')!
    rows.push({id:'practice',player_user_id:state.owner,kind:'practice',title:'Private practice',scheduled_date:'2026-09-13'}, {id:'foreign',player_user_id:'other-owner',kind:'match',title:'Foreign match',scheduled_date:'2026-09-13'})
    rows[0].notes = 'Private medical note'
    const share = await createShare(items().slice(0,2).map(item=>item.id))
    const token = new URL(share.shareUrl).hash.slice(1)
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(new URL(share.shareUrl).search).toBe('')
    expect(JSON.stringify(state.tables.get('match_calendar_shares'))).not.toContain(token)
    expect(share.share).not.toHaveProperty('token_hash')
    const response = await sharedFeed(share.shareUrl)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const ics = await response.text()
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics).not.toMatch(/Private practice|Foreign match|Private medical note|Opponent 2/)
    const preview = await (await sharedFeed(share.shareUrl,true)).json()
    expect(preview.count).toBe(2)
    expect(Object.keys(preview.matches[0]).sort()).toEqual(['date','location','time','title'])
    const listed = await (await shareRequest('GET')).json()
    expect(listed.shares).toHaveLength(1)
    expect(JSON.stringify(listed)).not.toContain('token_hash')
    state.owner = 'other-owner'
    expect((await (await shareRequest('GET')).json()).shares).toEqual([])
    expect((await shareRequest('DELETE',undefined,share.share.id)).status).toBe(404)
    expect((await sharedFeed(share.shareUrl)).status).toBe(200)
  })

  it('rejects private, foreign, missing and malformed selections and unauthenticated management', async () => {
    await saveSeasonCalendarItems(items(), 'synthetic', vi.fn(), request)
    state.tables.get('player_calendar_items')!.push({id:'practice',player_user_id:state.owner,kind:'practice'}, {id:'foreign',player_user_id:'other-owner',kind:'match'})
    for (const ids of [[], ['practice'], ['foreign'], ['missing'], [123], Array(501).fill('x')]) {
      expect((await shareRequest('POST',{label:'Family',teamName:'Aces',seasonKey:'Fall',itemIds:ids})).status).toBe(400)
    }
    expect(state.tables.get('match_calendar_shares')).toBeUndefined()
    state.authorized = false
    for (const method of ['POST','PATCH','DELETE','GET'] as const) expect((await shareRequest(method)).status).toBe(401)
  })

  it('updates explicit selection and saved details without changing links, and revokes only that share', async () => {
    await saveSeasonCalendarItems(items(), 'synthetic', vi.fn(), request)
    const personal = await createSeasonCalendarLink('synthetic',request)
    const first = await createShare(items().slice(0,2).map(item=>item.id))
    const second = await createShare()
    const before = await (await sharedFeed(first.shareUrl)).text()
    state.tables.get('player_calendar_items')![0].scheduled_date = '2026-09-15'
    state.tables.get('calendar_venue_directory')![0].street_address = '456 Corrected Ave'
    const after = await (await sharedFeed(first.shareUrl)).text()
    expect(uids(after)).toEqual(uids(before))
    expect(after).toContain('20260915T180000')
    expect(after).toContain('456 Corrected Ave')
    expect((await shareRequest('PATCH',{id:first.share.id,itemIds:[items()[2].id]})).status).toBe(200)
    const updated = await (await sharedFeed(first.shareUrl)).text()
    expect(updated.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(updated).toContain('Opponent 2')
    expect((await shareRequest('DELETE',undefined,first.share.id)).status).toBe(200)
    expect((await sharedFeed(first.shareUrl)).status).toBe(404)
    expect((await sharedFeed(second.shareUrl)).status).toBe(200)
    expect((await feed(personal)).status).toBe(200)
    expect(state.tables.get('player_calendar_items')).toHaveLength(14)
  })

  it('fails closed on storage failure and never accepts a personal feed token as a family token', async () => {
    await saveSeasonCalendarItems(items(), 'synthetic', vi.fn(), request)
    const share = await createShare()
    const personal = await createSeasonCalendarLink('synthetic',request)
    const fake = new URL(share.shareUrl);fake.hash = new URL(personal).searchParams.get('token')!
    expect((await sharedFeed(fake.toString())).status).toBe(404)
    const fakePersonal = new URL(personal);fakePersonal.searchParams.set('token',new URL(share.shareUrl).hash.slice(1))
    expect((await feed(fakePersonal.toString())).status).toBe(404)
    for(const table of ['match_calendar_shares','player_calendar_items']) {
      state.failure = table
      expect((await sharedFeed(share.shareUrl)).status).toBe(503)
    }
    state.failure = ''
    // Defense in depth even if a malformed allowlist is written outside the API.
    const rows = state.tables.get('player_calendar_items')!
    rows[0].kind = 'practice'; rows[1].player_user_id = 'other-owner'
    expect((await (await sharedFeed(share.shareUrl,true)).json()).count).toBe(12)
  })

  it('serves an isolated recipient page with a nonce CSP and no third-party scripts', async () => {
    const route = await import('../../app/calendar/share/[shareId]/route')
    const response = await route.GET(new Request('https://www.tenaceiq.com/calendar/share/00000000-0000-4000-8000-000000000001'),{params:Promise.resolve({shareId:'00000000-0000-4000-8000-000000000001'})})
    expect(response.status).toBe(200)
    expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    const html = await response.text()
    expect(html).not.toMatch(/googlesyndication|vercel-insights|analytics|<script src=/)
    expect(html).toContain('location.hash.slice(1)')
    expect(html).toContain('.textContent=data.teamName')
    expect((await route.GET(new Request('https://www.tenaceiq.com/calendar/share/bad'),{params:Promise.resolve({shareId:'bad'})})).status).toBe(404)
  })

  it('preserves the selected match time zone in a family subscription', async () => {
    await saveSeasonCalendarItems(items(),'synthetic',vi.fn(),request)
    const response = await shareRequest('POST',{label:'Family',teamName:'Aces',seasonKey:'Fall',timeZone:'America/Los_Angeles',itemIds:items().map(item=>item.id)})
    expect(response.status).toBe(200)
    const share = await response.json()
    expect(await (await sharedFeed(share.shareUrl)).text()).toContain('DTSTART;TZID=America/Los_Angeles:20260913T180000')
    await shareRequest('PATCH',{id:share.share.id,itemIds:[items()[0].id]})
    expect((await (await sharedFeed(share.shareUrl,true)).json()).timeZone).toBe('America/Los_Angeles')
    expect((await shareRequest('PATCH',{id:share.share.id,itemIds:[items()[0].id],timeZone:'Invalid/Zone'})).status).toBe(400)
  })

  it('keeps global application headers from overriding isolated calendar headers', async () => {
    const config = (await import('../../next.config')).default
    const headers = await config.headers!()
    const global = headers.find(rule=>rule.headers.some(header=>header.key==='Content-Security-Policy'))!
    const matches = new RegExp(`^${global.source}$`)
    expect(matches.test('/teams')).toBe(true)
    expect(matches.test('/')).toBe(true)
    expect(matches.test('/api/player/match-calendar-shares')).toBe(true)
    expect(matches.test('/calendar/share/00000000-0000-4000-8000-000000000001')).toBe(false)
    expect(matches.test('/api/calendar/shared/00000000-0000-4000-8000-000000000001/calendar.ics')).toBe(false)
  })
})
