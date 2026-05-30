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
    expect(tournamentsSource).toContain('Tournament flow')
    expect(tournamentsSource).toContain('aria-labelledby="tournament-flow-title"')
    expect(tournamentsSource).toContain('titleId="tournament-flow-title"')
    expect(tournamentsSource).toContain('Event setup')
    expect(tournamentsSource).toContain('Player notifications')
    expect(tournamentsSource).toContain("eventName: 'draw_preview_clicked'")
    expect(tournamentsSource).toContain("location: 'tournaments_draw_preview'")
    expect(tournamentsSource).toContain('Preview Draw')
    expect(tournamentsSource).toContain("eventName: 'tournament_desk_clicked'")
    expect(tournamentsSource).toContain('Draws reviewable')
    expect(tournamentsSource).not.toContain('ProductPreviewGrid')
  })

  it('lets public section headers provide accessible labels', () => {
    expect(commandCenterSource).toContain('titleId?: string')
    expect(commandCenterSource).toContain('<h2 id={titleId}')
  })
})
