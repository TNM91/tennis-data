import CompetePageFrame, {
  CompeteCard,
  CompeteGrid,
} from '@/app/compete/_components/compete-page-frame'

export default function CompetePage() {
  return (
    <CompetePageFrame
      eyebrow="Weekly workflow"
      title="This week, ready to act."
      description="Leagues, teams, schedule, results, and data refresh stay one click apart."
    >
      <CompeteGrid>
        <CompeteCard
          href="/compete/leagues"
          meta="Competition context"
          title="My Leagues"
          text="Team leagues and player leagues, split cleanly with the next action visible."
          icon="teamRankings"
          action="Check leagues"
        />
        <CompeteCard
          href="/compete/teams"
          meta="Roster context"
          title="My Teams"
          text="Open roster context and jump into availability, lineups, and messaging."
          icon="lineupBuilder"
          action="Open teams"
        />
        <CompeteCard
          href="/compete/schedule"
          meta="What is next"
          title="Schedule"
          text="Upcoming dates, opponents, and prep links in one surface."
          icon="schedule"
          action="See next"
        />
        <CompeteCard
          href="/compete/results"
          meta="What happened"
          title="Results"
          text="Recent outcomes, movement, and matchup handoffs for the next week."
          icon="reports"
          action="Review results"
        />
        <CompeteCard
          href="/data-assist"
          meta="Community assist"
          title="Data Assist"
          text="Upload schedules, scorecards, and roster changes for review."
          icon="accountSecurity"
          action="Refresh data"
        />
      </CompeteGrid>

    </CompetePageFrame>
  )
}
