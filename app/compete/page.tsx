import CompetePageFrame, {
  CompeteCard,
  CompeteGrid,
} from '@/app/compete/_components/compete-page-frame'
import CompeteHome from '@/app/compete/_components/compete-home'
import PlayerEntryTracker from '@/app/compete/_components/player-entry-tracker'
import styles from './compete-home.module.css'

export default function CompetePage() {
  return (
    <CompetePageFrame
      eyebrow="Compete"
      title="Pick your next match move."
      description="Prep a matchup, scout a player, build a lineup, or check results."
      compactHome
    >
      <PlayerEntryTracker />
      <CompeteHome />

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
