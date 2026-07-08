import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/leagues-and-tournaments/page.tsx'), 'utf8')

describe('leagues and tournaments job clarity', () => {
  it('frames organizer actions around practical admin questions', () => {
    expect(source).toContain('Use one path for the work behind play: setup, event desk, score review, and public updates.')
    expect(source).toContain('A cleaner path for the work behind play.')
    expect(source).not.toContain('Start with the job you need to finish')
    expect(source).not.toContain('Start with the organizer need in front of you')
    expect(source).toContain('How do I organize the season before players start asking where everything lives?')
    expect(source).toContain('How do I manage entries, draws, courts, and event-day movement?')
    expect(source).toContain('Where do scores go, and what needs review before standings move?')
    expect(source).toContain('How do I give everyone one place to check schedules, results, and corrections?')
    expect(source).toContain('<p style={organizerQuestionStyle}>{action.question}</p>')
  })

  it('tracks organizer jobs from public CTAs and the command board', () => {
    expect(source).toContain("metadata: { location: 'leagues_tournaments_hub', job: 'organize_season' }")
    expect(source).toContain("metadata: { location: 'leagues_tournaments_hub', job: 'run_event_day' }")
    expect(source).toContain("metadata: { location: 'leagues_tournaments_hub', job: 'track_scores' }")
    expect(source).toContain("metadata: { location: 'leagues_tournaments_hub', job: 'publish_updates' }")
    expect(source).toContain("metadata: { location: 'leagues_tournaments_command', job: 'organize_season' }")
    expect(source).toContain("metadata: { location: 'leagues_tournaments_command', job: 'run_event_day' }")
    expect(source).toContain("metadata: { location: 'leagues_tournaments_command', job: 'review_source_data' }")
    expect(source).not.toContain("location: 'leagues_tournaments_preview'")
  })

  it('keeps organizer question cards compact and phone-safe', () => {
    expect(source).toContain('const organizerQuestionStyle')
    expect(source).toContain('const organizerCommandBoardStyle')
    expect(source).toContain('const organizerCommandStepStyle')
    expect(source).toContain("fontSize: 12")
    expect(source).toContain("lineHeight: 1.35")
    expect(source).toContain("overflowWrap: 'anywhere'")
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 370px), 1fr))'")
    expect(source).toContain("gridTemplateColumns: '32px minmax(0, 1fr)'")
    expect(source).toContain('minWidth: 0')
  })
})
