'use client'

import type { CSSProperties } from 'react'
import SiteShell from '@/app/components/site-shell'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import type { PricingPlanId } from '@/lib/pricing-plans'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'

type LockedPlanPageProps = {
  active?: string
  planId: PricingPlanId
  headline: string
  body: string
  result?: string
  ctaLabel?: string
  secondaryLabel?: string
  secondaryHref?: string
}

export default function LockedPlanPage({
  active,
  planId,
  headline,
  body,
  result,
  ctaLabel,
  secondaryLabel = 'See plans',
  secondaryHref = '/pricing',
}: LockedPlanPageProps) {
  const preview = getLockedPreview(planId)

  return (
    <SiteShell active={active}>
      <div style={pageWrapStyle}>
        <section style={previewShellStyle}>
          <div style={previewHeroStyle}>
            <div style={previewEyebrowStyle}>{preview.eyebrow}</div>
            <h1 style={previewTitleStyle}>{preview.title}</h1>
            <p style={previewBodyStyle}>{preview.body}</p>
          </div>

          <div style={previewGridStyle}>
            {preview.cards.map((card) => (
              <div key={card.title} style={previewCardStyle}>
                <TiqFeatureIcon name={card.icon} size="md" variant="surface" />
                <div style={previewCardCopyStyle}>
                  <span style={previewCardLabelStyle}>{card.label}</span>
                  <strong style={previewCardTitleStyle}>{card.title}</strong>
                  <span style={previewCardTextStyle}>{card.text}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <UpgradePrompt
          planId={planId}
          headline={headline}
          body={body}
          result={result}
          ctaLabel={ctaLabel}
          secondaryLabel={secondaryLabel}
          secondaryHref={secondaryHref}
        />
      </div>
    </SiteShell>
  )
}

function getLockedPreview(planId: PricingPlanId): {
  eyebrow: string
  title: string
  body: string
  cards: Array<{ label: string; title: string; text: string; icon: TiqFeatureIconName }>
} {
  if (planId === 'captain') {
    return {
      eyebrow: 'Team unlock preview',
      title: 'This is where the team week gets easier.',
      body: 'Team turns scattered availability, lineup thinking, and follow-up messages into one repeatable flow.',
      cards: [
        {
          label: 'Step 1',
          title: 'Know who can play',
          text: 'Availability and roster context stay connected to the match week.',
          icon: 'reliabilityIndex',
        },
        {
          label: 'Step 2',
          title: 'Build the lineup',
          text: 'Compare practical options before committing courts.',
          icon: 'lineupBuilder',
        },
        {
          label: 'Step 3',
          title: 'Send the plan',
          text: 'Move the decision into clear captain communication.',
          icon: 'messagingCenter',
        },
      ],
    }
  }

  if (planId === 'coach') {
    return {
      eyebrow: 'Coach unlock preview',
      title: 'Help players leave with the next step.',
      body: 'Coach turns lesson plans, tactical boards, drill assignments, development tracking, reviews, resources, and scheduling into one practical flow.',
      cards: [
        {
          label: 'Plan',
          title: 'Build the lesson',
          text: 'Use drill blocks, tactical boards, and homework assignments.',
          icon: 'scenarioBuilder',
        },
        {
          label: 'Track',
          title: 'Track player development',
          text: 'Keep player development paths and coach notes together.',
          icon: 'reports',
        },
        {
          label: 'Assign',
          title: 'Send the next step',
          text: 'Turn a lesson into clear player follow-through.',
          icon: 'messagingCenter',
        },
      ],
    }
  }

  if (planId === 'league') {
    return {
      eyebrow: 'League unlock preview',
      title: 'Run the season with less admin work.',
      body: 'League keeps participants, schedules, scores, standings, member clarity, and league visibility organized.',
      cards: [
        {
          label: 'Setup',
          title: 'Structure the league',
          text: 'Create the season shape before schedules and scores start arriving.',
          icon: 'teamRankings',
        },
        {
          label: 'Operate',
          title: 'Track scores',
          text: 'Keep schedules, scorecards, results, and standings moving together.',
          icon: 'reports',
        },
        {
          label: 'Publish',
          title: 'Give members clarity',
          text: 'Make who, when, where, and what happened easy to see.',
          icon: 'schedule',
        },
      ],
    }
  }

  return {
    eyebrow: 'Player unlock preview',
    title: 'Make TenAceIQ personal.',
    body: 'Player unlocks My Lab, data refreshes, matchup prep, and tennis messages.',
    cards: [
      {
        label: 'You',
        title: 'Open My Lab',
        text: 'Keep your scorecard, goals, and next tennis read together.',
        icon: 'myLab',
      },
      {
        label: 'Fix tennis info',
        title: 'Refresh tennis context',
        text: 'Upload, report, or refresh the records behind your read.',
        icon: 'reports',
      },
      {
        label: 'Prep matchup',
        title: 'Compare before you play',
        text: 'Turn public discovery into a clear read before you play.',
        icon: 'matchupAnalysis',
      },
    ],
  }
}

const pageWrapStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  width: 'min(1180px, calc(100% - clamp(24px, 5vw, 32px)))',
  margin: '0 auto',
  padding: '28px 0 36px',
  minWidth: 0,
  display: 'grid',
  gap: 18,
}

const previewShellStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  display: 'grid',
  gap: 18,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'linear-gradient(180deg, rgba(12,26,50,0.78) 0%, rgba(8,18,36,0.92) 100%)',
  boxShadow: '0 24px 58px rgba(2,10,24,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
}

const previewHeroStyle: CSSProperties = {
  display: 'grid',
  gap: 9,
  maxWidth: 760,
  minWidth: 0,
}

const previewEyebrowStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const previewTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(2rem, 5vw, 3.4rem)',
  lineHeight: 1,
  letterSpacing: 0,
}

const previewBodyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 15,
  lineHeight: 1.65,
}

const previewGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
  gap: 12,
  minWidth: 0,
}

const previewCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '48px minmax(0, 1fr)',
  gap: 12,
  alignItems: 'start',
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  minWidth: 0,
}

const previewCardCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
}

const previewCardLabelStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const previewCardTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 15,
  lineHeight: 1.15,
}

const previewCardTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
}
