import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/league-coordinator-workspace.tsx'), 'utf8')

describe('League Office desk', () => {
  it('surfaces the current league work without repeating broad path questions', () => {
    expect(source).toContain('leagueDeskItems')
    expect(source).toContain('Today&apos;s league desk')
    expect(source).toContain('Run the season from the thing that needs attention.')
    expect(source).toContain('Setup, approvals, results, and public proof stay separate enough to scan quickly.')
    expect(source).not.toContain('Start with the season question, then open the workspace that removes the most admin work.')

    expect(source).toContain("job: 'season_control'")
    expect(source).toContain("job: 'participant_queue'")
    expect(source).toContain("job: 'result_flow'")
    expect(source).toContain("job: 'member_view'")
    expect(source).not.toContain("question: 'How do I organize schedules?'")
    expect(source).not.toContain("question: 'How do I manage players or teams?'")
    expect(source).not.toContain("question: 'How do I track scores?'")
    expect(source).not.toContain("question: 'How do I reduce admin work?'")

    expect(source).toContain("href: '#league-setup-form'")
    expect(source).toContain("href: '#league-registry'")
    expect(source).toContain('href: resultEntryHref')
    expect(source).toContain("href: '#league-public-pages'")
  })

  it('keeps the desk tappable and measurable on mobile', () => {
    expect(source).toContain('gridTemplateColumns: \'repeat(auto-fit, minmax(min(100%, 230px), 1fr))\'')
    expect(source).toContain('gridTemplateColumns: \'38px minmax(0, 1fr)\'')
    expect(source).toContain('data-league-desk-job={path.job}')
    expect(source).toContain('aria-label={`${path.cta}: ${path.title}`}')
    expect(source).toContain('leaguePathMarkerStyle')
    expect(source).toContain('leagueDeskCardCompleteStyle')
    expect(source).toContain('leagueDeskMarkerReadyStyle')
  })
})
