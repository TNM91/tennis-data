import CompetePageFrame, {
  CompeteCard,
  CompeteGrid,
} from '@/app/compete/_components/compete-page-frame'

export default function CompetePage() {
  return (
    <CompetePageFrame
      eyebrow="Compete"
      title="Pick your next match move."
      description="Prep a matchup, scout a player, build a lineup, or check results."
    >
      <CompeteGrid>
        <CompeteCard
          href="/matchup"
          meta="Match prep"
          title="Prep a matchup"
          question="What matchup matters, and what should I watch first?"
          text="Compare players before the first game starts."
          icon="matchupAnalysis"
          action="Prep matchup"
          event={{ eventName: 'matchup_started', surface: 'matchup', metadata: { location: 'compete_hub', job: 'prep_matchup' } }}
        />
        <CompeteCard
          href="/explore/players"
          meta="Scouting"
          title="Scout players"
          question="Who am I facing, and what context changes the plan?"
          text="Check ratings, recent context, and player signals before match day."
          icon="playerRatings"
          action="Scout players"
          event={{ eventName: 'search_result_clicked', surface: 'public_site', metadata: { location: 'compete_hub', job: 'scout_players' } }}
        />
        <CompeteCard
          href="/captain/lineup-builder"
          meta="Lineup strategy"
          title="Build a lineup plan"
          question="What lineup gives us the best chance?"
          text="Turn roster and opponent context into a captain decision."
          icon="lineupBuilder"
          action="Build lineup"
          event={{ eventName: 'lineup_preview_clicked', surface: 'captain', metadata: { location: 'compete_hub', job: 'build_lineup_plan' } }}
        />
        <CompeteCard
          href="/compete/results"
          meta="Performance tracking"
          title="Track results"
          question="What happened, and what should change next?"
          text="Review scores and match history before the next decision."
          icon="reports"
          action="Track results"
          event={{ eventName: 'standings_preview_clicked', surface: 'public_site', metadata: { location: 'compete_hub', job: 'track_results' } }}
        />
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

    </CompetePageFrame>
  )
}
