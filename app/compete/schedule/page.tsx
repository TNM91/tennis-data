 'use client'

import { useEffect, useMemo, useState } from 'react'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import { getClientAuthState } from '@/lib/auth'
import CompetePageFrame, {
  CompeteCard,
  CompeteGrid,
} from '@/app/compete/_components/compete-page-frame'
import { type UserRole } from '@/lib/roles'

export default function CompeteSchedulePage() {
  const [role, setRole] = useState<UserRole>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)
  const access = useMemo(() => buildProductAccessState(role, entitlements), [role, entitlements])

  useEffect(() => {
    let active = true

    async function loadAuth() {
      try {
        const authState = await getClientAuthState()
        if (!active) return
        setRole(authState.role)
        setEntitlements(authState.entitlements)
      } catch {
        if (!active) return
        setRole('public')
        setEntitlements(null)
      }
    }

    void loadAuth()

    return () => {
      active = false
    }
  }, [])

  return (
    <CompetePageFrame
      eyebrow="Schedule"
      title="Upcoming matches should drive the weekly flow."
      description="Schedule is the bridge between browseable season data and action-oriented preparation. This route anchors the week around what is next, then routes users into the execution tools that already work."
    >
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
          href="/matchup"
          meta="Comparison"
          title="Matchup Analysis"
          text="Run comparison work when schedule context turns into opponent-specific preparation."
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

    </CompetePageFrame>
  )
}

const upgradeWrapStyle = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: '12px',
  marginTop: '24px',
} as const
