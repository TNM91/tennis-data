import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const coachesSource = readFileSync(join(process.cwd(), 'app/coaches/page.tsx'), 'utf8')
const tournamentsSource = readFileSync(join(process.cwd(), 'app/tournaments/page.tsx'), 'utf8')
const commandCenterSource = readFileSync(join(process.cwd(), 'app/components/public-command-center.tsx'), 'utf8')

describe('public landing preview cards', () => {
  it('uses named coach preview cards with tracked product actions', () => {
    expect(coachesSource).toContain('TiqWorkspacePreview')
    expect(coachesSource).toContain('TiqCoachAssignmentCard')
    expect(coachesSource).toContain("eventName: 'coach_hub_clicked'")
    expect(coachesSource).toContain("eventName: 'coach_assignment_preview_clicked'")
    expect(coachesSource).not.toContain('ProductPreviewGrid')
  })

  it('uses named tournament preview cards with Tournament Desk tracking', () => {
    expect(tournamentsSource).toContain('TiqTournamentDrawCard')
    expect(tournamentsSource).toContain('TiqWorkspacePreview')
    expect(tournamentsSource).toContain('TiqActionCard')
    expect(tournamentsSource).toContain("const tournamentDeskHref = '/join?plan=full_court&next=%2Fleague-coordinator%2Ftournaments'")
    expect(tournamentsSource).toContain('href={tournamentDeskHref}')
    expect(tournamentsSource).toContain('href: tournamentDeskHref')
    expect(tournamentsSource).toContain('Find tournaments')
    expect(tournamentsSource).toContain('Search Events')
    expect(tournamentsSource).toContain('Preview Draws')
    expect(tournamentsSource).toContain('Open Desk')
    expect(tournamentsSource).toContain("location: 'tournaments_find_events'")
    expect(tournamentsSource).toContain("location: 'tournaments_follow_draw'")
    expect(tournamentsSource).toContain("location: 'tournaments_run_event'")
    expect(tournamentsSource).toContain('Tournament flow')
    expect(tournamentsSource).toContain('aria-labelledby="tournament-flow-title"')
    expect(tournamentsSource).toContain('titleId="tournament-flow-title"')
    expect(tournamentsSource).toContain('Event setup')
    expect(tournamentsSource).toContain('Player notifications')
    expect(tournamentsSource).toContain("{ label: 'Pending', value: 'Clear' }")
    expect(tournamentsSource).not.toContain("{ label: 'Pending', value: '0' }")
    expect(tournamentsSource).toContain("eventName: 'draw_preview_clicked'")
    expect(tournamentsSource).toContain("location: 'tournaments_draw_preview'")
    expect(tournamentsSource).toContain('Open Tournament Desk')
    expect(tournamentsSource).not.toContain('cta="Preview Draw"')
    expect(tournamentsSource).not.toContain('cta="Publish Results"')
    expect(tournamentsSource).toContain("eventName: 'tournament_desk_clicked'")
    expect(tournamentsSource).toContain('Draws reviewable')
    expect(tournamentsSource).toContain('context="Tournaments trust strip"')
    expect(tournamentsSource).not.toContain('ProductPreviewGrid')
  })

  it('lets public section headers provide accessible labels', () => {
    expect(commandCenterSource).toContain('titleId?: string')
    expect(commandCenterSource).toContain('<h2 id={titleId}')
    expect(commandCenterSource).toContain('context?: string')
    expect(commandCenterSource).toContain('const trustContext = encodeURIComponent(context)')
    expect(commandCenterSource).toContain("{ label: 'Results', value: 'Clear' }")
    expect(commandCenterSource).not.toContain("{ label: 'Results', value: '0 pending' }")
  })
})
