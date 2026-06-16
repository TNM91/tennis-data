import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/manage/page.tsx'), 'utf8')

describe('Manage hub actions', () => {
  it('frames each management path around the practical user question', () => {
    expect(source).toContain('Start with the job that is causing the chaos.')
    expect(source).toContain('Who is available, what lineup should we send, and what needs to be communicated?')
    expect(source).toContain('How do I keep schedules, players, teams, scores, and standings organized?')
    expect(source).toContain('How do I keep entries, draws, courts, scores, and winners moving?')
    expect(source).toContain('Which path fits the work: league season, tournament desk, or both?')
    expect(source).toContain('What source needs review before the platform can trust it?')
    expect(source).toContain('<p style={actionQuestionStyle}>{action.question}</p>')
  })

  it('keeps manage actions tied to clear jobs for product analytics', () => {
    expect(source).toContain("metadata: { location: 'manage_hub', job: 'manage_team_week' }")
    expect(source).toContain("metadata: { location: 'manage_hub', job: 'run_league_season' }")
    expect(source).toContain("metadata: { location: 'manage_hub', job: 'run_event_desk' }")
    expect(source).toContain("job: 'organize_competition'")
    expect(source).toContain("metadata: { location: 'manage_hub', job: 'fix_source_confusion' }")
  })

  it('tracks preview-card actions without turning the page into a dashboard', () => {
    expect(source).toContain("eventName: 'availability_clicked'")
    expect(source).toContain("eventName: 'league_office_clicked'")
    expect(source).toContain("eventName: 'tournament_desk_clicked'")
    expect(source).toContain("metadata: { location: 'manage_preview', job: 'manage_team_week' }")
    expect(source).toContain("metadata: { location: 'manage_preview', job: 'run_league_season' }")
    expect(source).toContain("metadata: { location: 'manage_preview', job: 'run_event_desk' }")
  })

  it('keeps the question treatment compact and mobile-safe', () => {
    expect(source).toContain('const actionQuestionStyle')
    expect(source).toContain("fontSize: 12")
    expect(source).toContain("lineHeight: 1.35")
    expect(source).toContain("overflowWrap: 'anywhere'")
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))'")
    expect(source).toContain('minWidth: 0')
  })
})
