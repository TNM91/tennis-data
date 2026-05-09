import { describe, expect, it } from 'vitest'
import {
  detectDataAssistExportType,
  detectImportTypeFromExportText,
  detectImportTypeFromFileName,
} from '../data-assist-export-detection'

function exportFile(name: string, html: string) {
  return new File([html], name, { type: 'application/vnd.ms-excel' })
}

describe('Data Assist export detection', () => {
  it('detects TennisLink export type from standard filenames', () => {
    expect(detectImportTypeFromFileName('Scorecard_582026.xls')).toBe('scorecard')
    expect(detectImportTypeFromFileName('MatchSchedule_582026.xls')).toBe('schedule')
    expect(detectImportTypeFromFileName('TeamSummary_582026.xls')).toBe('team_summary')
  })

  it('detects scorecard exports from table content when the filename is generic', () => {
    expect(detectImportTypeFromExportText(`
      <table>
        <tr><td>Scorecard for Match # 1011650664 in 2026 Adult 18 & Over Spring</td></tr>
        <tr><td>Match Win Criteria: Team Wins</td></tr>
        <tr><td>Home Team</td><td>Visiting Team</td><td>3rd Set Tie-break</td></tr>
      </table>
    `)).toBe('scorecard')
  })

  it('detects schedule exports from table content when the filename is generic', () => {
    expect(detectImportTypeFromExportText(`
      <table>
        <tr><td>Match Schedule by Team Report</td></tr>
        <tr><td>Match ID</td><td>Schedule Date</td><td>Schedule Time</td><td>Home Team</td><td>Visiting Team</td><td>Facility/Match Site</td></tr>
      </table>
    `)).toBe('schedule')
  })

  it('detects team summary exports from table content when the filename is generic', () => {
    expect(detectImportTypeFromExportText(`
      <table>
        <tr><td>Team Summary</td></tr>
        <tr><td>Team Standings</td></tr>
        <tr><td>Player Name</td><td>NTRP</td><td>Player Name</td><td>NTRP</td></tr>
      </table>
    `)).toBe('team_summary')
  })

  it('uses content detection before filename hints', async () => {
    const file = exportFile('download.xls', `
      <table>
        <tr><td>Match ID</td><td>Schedule Date</td><td>Schedule Time</td><td>Home Team</td><td>Visiting Team</td><td>Facility/Match Site</td></tr>
      </table>
    `)

    await expect(detectDataAssistExportType([file], 'scorecard')).resolves.toEqual({
      importType: 'schedule',
      mixed: false,
    })
  })

  it('flags mixed export types before import', async () => {
    const scorecard = exportFile('download-1.xls', 'Scorecard for Match # 1011650664')
    const roster = exportFile('download-2.xls', 'Team Summary Player Name NTRP')

    await expect(detectDataAssistExportType([scorecard, roster], 'scorecard')).resolves.toEqual({
      importType: 'scorecard',
      mixed: true,
    })
  })
})
