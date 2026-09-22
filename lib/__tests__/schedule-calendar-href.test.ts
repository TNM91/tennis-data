import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildScheduleCalendarHref } from '../schedule-calendar-href'

describe('schedule import next step', () => {
  it('opens the imported team calendar with its league and flight, not another upload', () => {
    const href = buildScheduleCalendarHref('Aces/Volleys', 'Fall 18 & Over', '4.0')
    const url = new URL(href, 'https://www.tenaceiq.com')
    expect(url.pathname).toBe('/teams/Aces~2FVolleys')
    expect(url.searchParams.get('league')).toBe('Fall 18 & Over')
    expect(url.searchParams.get('flight')).toBe('4.0')
    expect(url.hash).toBe('#team-schedule')
  })

  it('lets the player choose a team when entering from the general upload menu', () => {
    expect(buildScheduleCalendarHref('')).toBe('/compete/teams')
    expect(buildScheduleCalendarHref('  ')).toBe('/compete/teams')
  })

  it('keeps the completion action and existing-calendar escape route visible', () => {
    const source = readFileSync('app/data-assist/page.tsx', 'utf8')
    expect(source).toContain('if (isScheduleParsedDraft(input.parsedDraft)) return false')
    expect(source).toContain('outcome.calendarHref')
    expect(source).toContain('Add season to Apple / Google Calendar')
    expect(source).toContain('Use an existing team schedule')
    expect(source).toContain('Importing a schedule does not add it to your phone automatically.')
  })

  it('does not interpret a failed read or a history-year filter as a missing schedule', () => {
    const page = readFileSync('app/teams/[team]/page.tsx', 'utf8')
    const calendar = readFileSync('app/components/team-season-calendar.tsx', 'utf8')
    expect(page).toContain("setScheduleLoadError('Your saved schedule could not be loaded right now.')")
    expect(page).toContain('loadError={scheduleLoadError}')
    expect(page).toContain('matches={matches}')
    expect(page).not.toContain('matches={seasonMatches}')
    expect(calendar).toContain('open && loadError ?')
    expect(calendar).toContain('You do not need to upload your schedule again.')
    expect(calendar).toContain('Retry schedule')
  })
})
