import CompetePageFrame, {
  CompeteCard,
  CompeteGrid,
} from '@/app/compete/_components/compete-page-frame'

export default function CompetePage() {
  return (
    <CompetePageFrame
      eyebrow="Weekly workflow"
      title="Compete is the operational hub for this week."
      description="This is where active play gets organized. Move from league context into teams, schedule, results, and then into captain execution without losing the thread of what needs attention next."
    >
      <CompeteGrid>
        <CompeteCard
          href="/compete/leagues"
          meta="Competition context"
          title="My Leagues"
          text="Separate team-league participation from individual-league participation so weekly decisions start with the right competition model."
        />
        <CompeteCard
          href="/compete/teams"
          meta="Roster context"
          title="My Teams"
          text="Open team-level operations, review roster and match context, and bridge straight into availability, lineups, and messaging."
        />
        <CompeteCard
          href="/compete/schedule"
          meta="What is next"
          title="Schedule"
          text="Use upcoming matches as the weekly decision spine and keep captain work tied to real dates, opponents, and league context."
        />
        <CompeteCard
          href="/compete/results"
          meta="What happened"
          title="Results"
          text="Review completed match outcomes, recent movement, and the competitive signals that should feed your next lineup or scenario pass."
        />
      </CompeteGrid>

    </CompetePageFrame>
  )
}
