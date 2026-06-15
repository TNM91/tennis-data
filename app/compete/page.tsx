import CompetePageFrame, {
  CompeteCard,
  CompeteGrid,
} from '@/app/compete/_components/compete-page-frame'

export default function CompetePage() {
  return (
    <CompetePageFrame
      eyebrow="Compete"
      title="Prepare for the next match."
      description="Use matchup insight, scouting, lineup strategy, and performance context to compete with a clearer plan."
    >
      <CompeteGrid>
        <CompeteCard
          href="/matchup"
          meta="Match prep"
          title="Prep a matchup"
          text="Compare players before you play so the first game starts with a plan instead of a guess."
          icon="matchupAnalysis"
          action="Prep matchup"
        />
        <CompeteCard
          href="/explore/players"
          meta="Scouting"
          title="Scout players"
          text="Find ratings, recent context, and player signals that help you understand the court before match day."
          icon="playerRatings"
          action="Scout players"
        />
        <CompeteCard
          href="/captain/lineup-builder"
          meta="Lineup strategy"
          title="Build a lineup plan"
          text="Turn roster, opponent, and partner context into a captain decision the team can act on."
          icon="lineupBuilder"
          action="Build lineup"
        />
        <CompeteCard
          href="/compete/results"
          meta="Performance tracking"
          title="Track results"
          text="Review scores, line outcomes, and match history so the next practice or lineup has evidence."
          icon="reports"
          action="Track results"
        />
        <CompeteCard
          href="/compete/teams"
          meta="Team intelligence"
          title="Read a team"
          text="Scan roster depth, pairing patterns, and team context before the weekly decision gets noisy."
          icon="teamRankings"
          action="Read teams"
        />
        <CompeteCard
          href="/leagues"
          meta="Season context"
          title="Understand the flight"
          text="Use league, schedule, and standings context to know what matchups and results actually matter."
          icon="schedule"
          action="Find leagues"
        />
      </CompeteGrid>

    </CompetePageFrame>
  )
}
