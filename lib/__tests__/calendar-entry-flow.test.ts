import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseTennisLinkExportFiles } from '../data-assist-export-parser'
import { buildScheduleOcrDraftFromText } from '../data-assist-schedule-parser'
import { buildTeamSeasonCalendars } from '../team-season-calendar'
import { buildTennisCalendarFeed } from '../tiq-league-schedule-calendar'
import { normalizeCapturedSchedulePayload } from '../ingestion/normalizeCapturedImports'

describe('season calendar handoff', () => {
  it('carries every cross-year TennisLink date from export through calendar generation', () => {
    const dates = ['9/13/2026', '9/20/2026', '9/27/2026', '10/4/2026', '10/11/2026', '10/18/2026', '10/25/2026', '11/8/2026', '11/15/2026', '11/22/2026', '12/6/2026', '12/13/2026', '1/3/2027', '1/10/2027']
    const html = `<table>
      <tr><td>Section</td><td>District/Area</td><td>League</td><td>Flight</td></tr>
      <tr><td>USTA/MISSOURI VALLEY</td><td>ST. LOUIS</td><td>2027 Adult 18 &amp; Over Fall</td><td>Men 4.5 (F)</td></tr>
      <tr><td>Match ID</td><td>Schedule Date</td><td>Schedule Time</td><td>Home Team</td><td>Captain/Phone</td><td>Visiting Team</td><td>Captain/Phone</td><td>Facility/Match Site</td></tr>
      ${dates.map((date, index) => `<tr><td>${1012222900 + index}</td><td>${date}</td><td>6:00 PM</td><td>Meinert/The Other Guys (F)</td><td>Captain</td><td>${index === 0 ? 'Hodge-Kamman (F)' : `Opponent ${index}`}</td><td>Captain</td><td>Center Court</td></tr>`).join('')}
    </table>`
    const file = { fileName: 'MatchSchedule.xls', uploadOrder: 1, imageWidth: 0, imageHeight: 0, confidenceScore: 1, visualSignals: [], mimeType: 'application/vnd.ms-excel', fileBuffer: Buffer.from(html) }
    const parsed = parseTennisLinkExportFiles([file])
    const draft = buildScheduleOcrDraftFromText(parsed.rawText, [], parsed.provider)
    expect(parsed.detectedImportType).toBe('schedule')
    expect(draft.teamName).toBe('Meinert/The Other Guys (F)')
    expect(draft.matches[0].awayTeam).toBe('Hodge-Kamman (F)')
    expect(draft.matches.map(match => match.matchDate)).toEqual(dates)
    expect(draft.matches.every(match => match.reviewNotes.length === 0)).toBe(true)
    const normalized = normalizeCapturedSchedulePayload({ pageType: 'season_schedule', seasonSchedule: {
      teamName: draft.teamName, leagueName: draft.leagueName, flight: draft.flight,
      matches: draft.matches.map(match => ({ ...match, scheduleDate: match.matchDate, scheduleTime: match.matchTime })),
    } })
    expect(normalized.rows).toHaveLength(14)
    expect(normalized.rows.every(match => match.homeTeam === 'Meinert/The Other Guys (F)')).toBe(true)
    expect(normalized.rows[0].awayTeam).toBe('Hodge-Kamman (F)')
    const seasons = buildTeamSeasonCalendars('Meinert/The Other Guys (F)', normalized.rows.map(match => ({
      id: match.externalMatchId, external_match_id: match.externalMatchId, home_team: match.homeTeam, away_team: match.awayTeam,
      match_date: match.matchDate, match_time: match.matchTime, facility: match.facility, league_name: draft.leagueName, flight: draft.flight,
    })), 'calendar-owner')
    expect(seasons).toHaveLength(1)
    expect(seasons[0].items).toHaveLength(14)
    const ics = buildTennisCalendarFeed(seasons[0].items)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(14)
    expect(ics).toContain('20260913')
    expect(ics).toContain('20270110')
  })

  it('keeps My Calendar outside profile-gated tools and opens disclosures for calendar links', () => {
    const source = readFileSync('app/mylab/page.tsx', 'utf8')
    expect(source.match(/<MyLabCalendarPanel\s/g)).toHaveLength(1)
    expect(source.indexOf('<MyLabCalendarPanel')).toBeLessThan(source.indexOf('<PlayerWorkshopShell'))
    expect(source).toContain("window.location.hash !== '#my-calendar'")
    expect(source).toContain('parent instanceof HTMLDetailsElement')
    expect(source).toContain('parent.open = true')
    expect(source).toContain("window.removeEventListener('hashchange', revealCalendar)")
    expect(source).toContain("href: '/mylab#my-calendar',")
  })
})
