import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/upgrade/page.tsx'), 'utf8')

describe('upgrade page naming', () => {
  it('uses public/workspace naming in unlock and success copy', () => {
    for (const phrase of [
      'Continue with Team Hub',
      'Preview Team Hub',
      'Continue with League Office',
      'Preview League Office',
      'Activate My Lab for your game.',
      'Activate Coach Hub for player development.',
      'Activate Team Hub for match week.',
      'Activate League Office for the season.',
      'Activate Full-Court for the complete toolkit.',
      'const UPGRADE_JOB_FIT',
      'Search players, teams, leagues, rankings, flights, and areas before choosing paid tools.',
      'Search the tennis map first, then pick the right tools when your tennis needs more support.',
      'Activate Captain when match week needs availability, lineup decisions, scouting, and team updates in Team Hub.',
      'Upgrade when you need more support',
      'Search public tennis context, then upgrade when your game, team, players, league, or tournament needs more support.',
      'Create Free access',
      'Choose the right tools',
      'Coach Hub is active',
      'Team Hub is active',
      'League Office is active',
      'Open Coach Hub, map court work in Tactical Studio, and turn the next player-development job into assignments.',
      'Start with Team Hub, then turn the match-week job into availability, scouting, lineup decisions, and a cleaner team plan.',
      'Open Full-Court, then move between My Lab, Coach Hub, Team Hub, League Office, and unlimited Tournament Desk operations without switching plans.',
      'Tournament Desk operations',
      'Use the complete toolkit.',
      'one connected tennis operation',
      'Preview Full-Court',
      'Full-Court is active. Use the complete toolkit.',
      'Open the full toolkit',
      'Open ${getPlanDestinationLabel(planId)} when you are ready.',
      'Ready to activate {getPlanDestinationLabel(planId)}?',
      'selected tool opens after access is active.',
      'Selected tennis need',
      'Which tennis need should TenAceIQ support first?',
      'Request ${getPlanDestinationLabel(planId)}',
      "if (planId === 'coach') return 'Coach Hub'",
      "if (planId === 'captain') return 'Team Hub'",
      "if (planId === 'league') return 'League Office'",
    ]) {
      expect(source).toContain(phrase)
    }

    for (const oldPhrase of [
      "primaryAction: 'Open Coach'",
      "primaryAction: 'Open Team'",
      "primaryAction: 'Open League'",
      "title: 'League is active.",
      "title: 'Team is active.",
      "secondaryAction: 'View leagues'",
      "secondaryHref: '/compete'",
      'Player, Coach, Captain, League, and unlimited tournaments',
      'Search public tennis context, then upgrade when a paid workspace helps.',
      'Search players, teams, leagues, rankings, flights, and areas before the next tennis job needs a home base.',
      'Search the tennis map first, then pick the next tennis job when it needs a home base.',
      'Upgrade when the next tennis job needs a home base',
      'Search public tennis context, then upgrade when the next tennis job needs a home base.',
      'Search the tennis map first, then pick the next tennis job when it needs a workspace.',
      'Upgrade when the next tennis job needs a workspace',
      'Search public tennis context, then upgrade when the next tennis job needs a workspace.',
      'Upgrade when a workspace helps',
      'Upgrade when a workspace helps',
      'Open the workspace when you are ready.',
      'Selected tennis job',
      'Which tennis job needs help first?',
      'Selected plan',
      'Ready to turn on',
      'selected plan opens after access is active',
      'What are you trying to do first?',
      'Team or league',
      'Starting ${plan.name} checkout.',
      'Request ${plan.name}',
      'Unlock the Player path for $4.99/month.',
      'Run the full court.',
      'should stay connected around one tennis operation',
      'Preview full suite',
      'Run the full suite',
      'Open the connected suite',
    ]) {
      expect(source).not.toContain(oldPhrase)
    }
  })
})
