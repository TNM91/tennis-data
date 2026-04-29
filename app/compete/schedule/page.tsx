'use client'

import { useMemo } from 'react'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { buildProductAccessState } from '@/lib/access-model'
import { useAuth } from '@/app/components/auth-provider'
import CompetePageFrame, {
  CompeteCard,
  CompeteGrid,
} from '@/app/compete/_components/compete-page-frame'

export default function CompeteSchedulePage() {
  return (
    <CompetePageFrame
      eyebrow="Schedule"
      title="Upcoming matches should drive the weekly flow."
      description="Schedule is the bridge between browseable season data and action-oriented preparation. This route anchors the week around what is next, then routes users into the execution tools that already work."
    >
      <CompeteScheduleContent />
    </CompetePageFrame>
  )
}

function CompeteScheduleContent() {
  const { role, entitlements } = useAuth()
  const access = useMemo(() => buildProductAccessState(role, entitlements), [role, entitlements])

  return (
    <>
      <CompeteGrid>
        <CompeteCard
          href="/captain"
          meta="Weekly hub"
          title="Captain Week View"
          text="Use the captain dashboard as the current working surface for upcoming team matches and preparation status."
        />
        <CompeteCard
          href="/captain/scenario-builder"
          meta="Scenario prep"
          title="Scenario Builder"
          text="Test likely opponent outcomes and lineup branches before match day."
        />
        <CompeteCard
          href="/mylab"
          meta="Player+ prep"
          title="My Lab"
          text="Use premium comparison work when schedule context turns into opponent-specific preparation."
        />
      </CompeteGrid>

      {!access.canUseCaptainWorkflow ? (
        <div style={upgradeWrapStyle}>
          <UpgradePrompt
            planId="captain"
            compact
            headline="Need your schedule to lead straight into lineup prep?"
            body="Unlock Captain to move from what is next on the calendar into availability, scenarios, lineups, and team messaging without losing context."
            ctaLabel="Build Smarter Lineups"
            ctaHref="/pricing"
            secondaryLabel="See Captain plan"
            secondaryHref="/pricing"
            footnote="Best for captains who want schedule context to become action instead of another page to check."
          />
        </div>
      ) : null}
    </>
  )
}

const upgradeWrapStyle = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: '12px',
  marginTop: '24px',
} as const
