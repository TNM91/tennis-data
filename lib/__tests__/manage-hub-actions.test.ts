import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/manage/page.tsx'), 'utf8')

describe('Manage hub actions', () => {
  it('puts the fastest Manage path directly under the hero', () => {
    expect(source).toContain('Pick your path')
    expect(source).not.toContain('Pick your job')
    expect(source).toContain('What are you trying to organize right now?')
    expect(source).toContain('Choose the closest path, then TenAceIQ keeps the next step focused on less admin and more tennis.')
    expect(source).toContain('manageQuickPaths')
    expect(source).toContain('Who is available and what lineup should I send?')
    expect(source).toContain('How do I organize schedules, teams, scores, and standings?')
    expect(source).toContain('How do I keep entries, courts, draws, and results moving?')
    expect(source).toContain('What scorecard, roster, or schedule needs review?')
    expect(source).toContain('data-manage-path-job={path.job}')
  })

  it('frames each management path around the practical user question', () => {
    expect(source).toContain('Start with the need that is causing the chaos.')
    expect(source).not.toContain('Start with the job that is causing the chaos.')
    expect(source).toContain('Who is available, what lineup should we send, and what needs to be communicated?')
    expect(source).toContain('How do I keep schedules, players, teams, scores, and standings organized?')
    expect(source).toContain('How do I keep entries, draws, courts, scores, and winners moving?')
    expect(source).toContain('Which path fits the work: league season, tournament desk, or both?')
    expect(source).toContain('What source needs review before it shapes the tennis context?')
    expect(source).toContain("{ label: 'Feeds', value: 'Tennis context' }")
    expect(source).not.toContain('What source needs review before the platform can trust it?')
    expect(source).not.toContain("{ label: 'Feeds', value: 'Platform' }")
    expect(source).toContain('<p style={actionQuestionStyle}>{action.question}</p>')
  })

  it('keeps manage actions tied to clear jobs for product analytics', () => {
    expect(source).toContain("metadata: { location: 'manage_hub', job: 'manage_team_week' }")
    expect(source).toContain("metadata: { location: 'manage_hub', job: 'run_league_season' }")
    expect(source).toContain("metadata: { location: 'manage_hub', job: 'run_event_desk' }")
    expect(source).toContain("job: 'organize_competition'")
    expect(source).toContain("metadata: { location: 'manage_hub', job: 'fix_source_confusion' }")
  })

  it('routes quick Manage jobs to the right workspaces', () => {
    expect(source).toContain("href: '/captain'")
    expect(source).toContain("href: '/league-coordinator'")
    expect(source).toContain("href: '/tournaments#desk'")
    expect(source).toContain("href: '/data-assist?intent=upload-source&context=Manage%20quick%20path'")
    expect(source).toContain("job: 'manage_team_week'")
    expect(source).toContain("job: 'run_league_season'")
    expect(source).toContain("job: 'run_event_desk'")
    expect(source).toContain("job: 'refresh_management_context'")
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
    expect(source).toContain('const quickPathStyle')
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))'")
    expect(source).toContain('const quickPathGridStyle')
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))'")
    expect(source).toContain('const quickPathQuestionStyle')
    expect(source).toContain('const actionQuestionStyle')
    expect(source).toContain("fontSize: 12")
    expect(source).toContain("lineHeight: 1.35")
    expect(source).toContain("overflowWrap: 'anywhere'")
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))'")
    expect(source).toContain('minWidth: 0')
  })
})
