import CompetePageFrame, {
  CompeteCard,
  CompeteGrid,
} from '@/app/compete/_components/compete-page-frame'

export default function CompetePage() {
  return (
    <CompetePageFrame
      eyebrow="League Office"
      title="Run the season."
      description="Shared calendar, tournaments, team results, and player results stay in one League Office lane."
    >
      <CompeteGrid>
        <CompeteCard
          href="/compete/schedule"
          meta="Shared scheduling"
          title="Shared calendar"
          text="Publish, propose, confirm, and track match dates for everyone in the league."
          icon="schedule"
          action="Open calendar"
        />
        <CompeteCard
          href="/league-coordinator/tournaments"
          meta="Full-Court"
          title="Build tournament"
          text="Create a draw, seed entrants, schedule courts, and finish with awards from one room."
          icon="teamRankings"
          action="Build tournament"
        />
        <CompeteCard
          href="/league-coordinator/results"
          meta="Team results"
          title="Team book"
          text="Record team match events, line scores, and the results that move standings."
          icon="reports"
          action="Open team book"
        />
        <CompeteCard
          href="/league-coordinator/individual-results"
          meta="Player results"
          title="Player book"
          text="Log one-on-one results for ladders, round robins, and challenge leagues."
          icon="playerRatings"
          action="Open player book"
        />
      </CompeteGrid>

    </CompetePageFrame>
  )
}
