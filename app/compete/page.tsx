import CompetePageFrame, {
  CompeteCard,
  CompeteGrid,
} from '@/app/compete/_components/compete-page-frame'
import RoleActionHome from '@/app/components/role-action-home'
import styles from './compete-home.module.css'

const competePrimaryAction = {
  label: 'Start here',
  title: 'Prep your next matchup',
  detail: 'Compare the players and leave with the first thing to watch.',
  cta: 'Prep matchup',
  href: '/matchup',
  icon: 'matchupAnalysis' as const,
  event: { eventName: 'matchup_started' as const, surface: 'matchup' as const, metadata: { location: 'compete_hub', job: 'prep_matchup' } },
}

const competeQuickActions = [
  {
    title: 'Scout player',
    detail: 'Ratings and recent context',
    href: '/explore/players',
    icon: 'playerRatings' as const,
    event: { eventName: 'search_result_clicked' as const, surface: 'public_site' as const, metadata: { location: 'compete_hub', job: 'scout_players' } },
  },
  {
    title: 'Build lineup',
    detail: 'Turn the read into a team plan',
    href: '/captain/lineup-builder',
    icon: 'lineupBuilder' as const,
    event: { eventName: 'lineup_preview_clicked' as const, surface: 'captain' as const, metadata: { location: 'compete_hub', job: 'build_lineup_plan' } },
  },
  {
    title: 'Check results',
    detail: 'Review what happened',
    href: '/compete/results',
    icon: 'reports' as const,
    event: { eventName: 'standings_preview_clicked' as const, surface: 'public_site' as const, metadata: { location: 'compete_hub', job: 'track_results' } },
  },
  {
    title: 'Read a team',
    detail: 'Roster and team context',
    href: '/compete/teams',
    icon: 'teamRankings' as const,
    event: { eventName: 'team_search_submitted' as const, surface: 'teams' as const, metadata: { location: 'compete_hub', job: 'read_team' } },
  },
]

const competeSteps = [
  {
    title: 'Find the opponent',
    detail: 'Open the player, team, or league behind the next match.',
  },
  {
    title: 'Make one match plan',
    detail: 'Use the matchup read to choose the first pattern or pressure point.',
  },
  {
    title: 'Carry it forward',
    detail: 'Take the read into a lineup, result review, or Improve plan.',
  },
]

export default function CompetePage() {
  return (
    <CompetePageFrame
      eyebrow="Compete"
      title="Pick your next match move."
      description="Prep a matchup, scout a player, build a lineup, or check results."
      compactHome
    >
      <RoleActionHome
        roleLabel="Compete"
        contextLabel="Match focus"
        contextValue="Next match"
        primaryAction={competePrimaryAction}
        quickActions={competeQuickActions}
        helpTitle="Need help with match prep?"
        steps={competeSteps}
      />

      <details className={styles.moreTools}>
        <summary className={styles.moreToolsSummary}>
          <span>More Compete tools</span>
          <strong>Open team and season context.</strong>
          <em>2 tools</em>
        </summary>
        <div className={styles.moreToolsBody}>
          <CompeteGrid>
            <CompeteCard
              href="/compete/teams"
              meta="Team intelligence"
              title="Read a team"
              question="Where is the other team strong, thin, or risky?"
              text="Scan roster depth, pairings, and team context."
              icon="teamRankings"
              action="Read teams"
              event={{ eventName: 'team_search_submitted', surface: 'teams', metadata: { location: 'compete_hub', job: 'read_team' } }}
            />
            <CompeteCard
              href="/leagues"
              meta="Season context"
              title="Understand the flight"
              question="Which standings, schedules, and results matter now?"
              text="Check the league context behind the match."
              icon="schedule"
              action="Find leagues"
              event={{ eventName: 'league_search_submitted', surface: 'leagues', metadata: { location: 'compete_hub', job: 'understand_flight' } }}
            />
          </CompeteGrid>
        </div>
      </details>
    </CompetePageFrame>
  )
}
