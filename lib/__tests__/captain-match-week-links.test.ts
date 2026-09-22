import { describe, expect, it } from 'vitest'
import {
  buildMatchWeekGoogleCalendarHref,
  buildMatchWeekIcs,
  buildMatchWeekMapsHref,
  buildMatchWeekPhoneCalendarHref,
} from '../captain-match-week-links'

describe('captain match-week links', () => {
  it('builds a Google Calendar template for a scheduled match', () => {
    const href = buildMatchWeekGoogleCalendarHref({
      eventDate: '2026-08-29',
      eventTime: '7:00 PM',
      opponent: 'Racquet Club',
      location: 'Forest Lake Tennis Center',
    })

    expect(href).toContain('calendar.google.com')
    expect(href).toContain('20260829T190000%2F20260829T220000')
  })

  it('builds a safe map search and withholds a calendar link without a usable time', () => {
    expect(buildMatchWeekMapsHref('Forest Lake Tennis Center')).toContain('Forest%20Lake%20Tennis%20Center')
    expect(buildMatchWeekGoogleCalendarHref({ eventDate: '2026-08-29', eventTime: '', opponent: '', location: '' })).toBe('')
  })

  it('provides an Apple Calendar-compatible invite from the player response link', () => {
    expect(buildMatchWeekPhoneCalendarHref('https://www.tenaceiq.com/availability/abc-token'))
      .toBe('https://www.tenaceiq.com/api/captain/availability-requests/abc-token/calendar.ics')
    const ics = buildMatchWeekIcs({
      uid: 'match-1', eventDate: '2026-08-29', eventTime: '7:00 PM', opponent: 'Racquet Club', location: 'Forest Lake',
    })
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('DTSTART:20260829T190000')
    expect(ics).toContain('SUMMARY:TenAceIQ match vs Racquet Club')
  })
})
