import { describe, expect, it, vi } from 'vitest'
import { appleSubscriptionUrl, createSeasonCalendarLink, googleMatchCalendarUrl, saveSeasonCalendarItems } from '../season-calendar-actions'
import { buildTeamSeasonCalendars } from '../team-season-calendar'
import type { TeamScheduleCalendarItem } from '../team-schedule-calendar'

const item: TeamScheduleCalendarItem = { id: 'one', title: 'Aces vs Volleys', date: '2026-12-31', time: '23:30', location: 'Court & Club', kind: 'match' }
describe('season calendar handoff', () => {
  it('saves batches sequentially and reports progress with stable retry IDs', async () => {
    const items = Array.from({ length: 203 }, (_, i) => ({ ...item, id: `match-${i}` }))
    const request = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => Response.json({ ok: true, savedCount: JSON.parse(String(init?.body)).items.length }))
    const progress = vi.fn()
    await saveSeasonCalendarItems(items, 'signed-in', progress, request)
    expect(request.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).items.length)).toEqual([100, 100, 3])
    expect(progress.mock.calls.flat()).toEqual([100, 200, 203])
    const body = request.mock.calls[0][1]?.body
    await saveSeasonCalendarItems(items.slice(0, 100), 'signed-in', progress, request)
    expect(request.mock.calls[3][1]?.body).toBe(body)
  })
  it('does not claim success after a partial save or malformed response', async () => {
    const progress = vi.fn()
    await expect(saveSeasonCalendarItems([item], 'token', progress, vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true, savedCount: 0 })))).rejects.toThrow('Some matches')
    expect(progress).not.toHaveBeenCalled()
    await expect(saveSeasonCalendarItems([item], 'token', progress, vi.fn<typeof fetch>().mockResolvedValue(new Response('bad gateway', { status: 502 })))).rejects.toThrow('Some matches')
  })
  it('stops before sending an empty selection or missing session', async () => {
    const request = vi.fn<typeof fetch>()
    await expect(saveSeasonCalendarItems([], 'token', vi.fn(), request)).rejects.toThrow('Choose')
    await expect(saveSeasonCalendarItems([item], '', vi.fn(), request)).rejects.toThrow('Sign in')
    expect(request).not.toHaveBeenCalled()
  })
  it('tells the player when authentication expired', async () => {
    await expect(saveSeasonCalendarItems([item], 'expired', vi.fn(), vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: false }, { status: 401 })))).rejects.toThrow('sign-in expired')
  })
  it('preserves query credentials in a real webcal handoff link', async () => {
    const url = 'https://www.tenaceiq.com/api/calendar/player/id/calendar.ics?token=example'
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true, calendarUrl: url }))
    expect(await createSeasonCalendarLink('token', request)).toBe(url)
    expect(appleSubscriptionUrl(url)).toBe(url.replace('https:', 'webcal:'))
  })
  it('keeps a link failure separate from the successful TiQ save', async () => {
    await expect(createSeasonCalendarLink('token', vi.fn<typeof fetch>().mockResolvedValue(new Response('offline', { status: 503 })))).rejects.toThrow('matches are saved to TiQ')
  })
  it('builds a Google event across midnight with an explicit timezone', () => {
    const url = new URL(googleMatchCalendarUrl(item))
    expect(url.searchParams.get('dates')).toBe('20261231T233000/20270101T013000')
    expect(url.searchParams.get('ctz')).toBe('America/Chicago')
    expect(url.searchParams.get('location')).toBe('Court & Club')
    expect(new URL(googleMatchCalendarUrl({ ...item, time: '' })).searchParams.get('dates')).toBe('20261231/20270101')
  })
  it('preserves database HH:mm:ss times instead of converting matches to all day', () => {
    const season = buildTeamSeasonCalendars('Aces', [{ id: 'one', home_team: 'Aces', away_team: 'Volleys', match_date: '2026-09-14', match_time: '18:00:00' }], 'player')
    expect(season[0].items[0].time).toBe('18:00')
  })
})
