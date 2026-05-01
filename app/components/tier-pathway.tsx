'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import {
  MEMBERSHIP_TIER_ORDER,
  TIER_HOMEPAGE_STORY,
  getMembershipTier,
  type MembershipTierId,
} from '@/lib/product-story'

type TierPathwayProps = {
  title?: string
  intro?: string
  compact?: boolean
  showCtas?: boolean
  framed?: boolean
}

export default function TierPathway({
  title = 'Choose the layer that matches the job.',
  intro = 'Start with free discovery, then add Player, Captain, or TIQ League Coordinator when that next layer makes tennis easier to run.',
  compact = false,
  showCtas = false,
  framed = true,
}: TierPathwayProps) {
  return (
    <section style={framed ? (compact ? compactShellStyle : shellStyle) : unframedShellStyle}>
      <div style={headerStyle}>
        <div style={eyebrowStyle}>Tier pathway</div>
        <h2 style={titleStyle}>{title}</h2>
        <p style={introStyle}>{intro}</p>
      </div>

      <div style={compact ? compactGridStyle : gridStyle}>
        {MEMBERSHIP_TIER_ORDER.map((tierId, index) => (
          <TierPathwayCard
            key={tierId}
            tierId={tierId}
            index={index + 1}
            compact={compact}
            showCta={showCtas}
          />
        ))}
      </div>
    </section>
  )
}

export function RoleValueStrip({ compact = false }: { compact?: boolean }) {
  return (
    <div style={compact ? stripCompactStyle : stripStyle}>
      {MEMBERSHIP_TIER_ORDER.map((tierId) => {
        const tier = getMembershipTier(tierId)
        return (
          <div key={tierId} style={stripItemStyle}>
            <span style={getBadgeStyle(tierId)}>{tier.name}</span>
            <span style={stripTextStyle}>{tier.shortPromise}</span>
          </div>
        )
      })}
    </div>
  )
}

export function UpgradeStoryCard({
  tierId,
  compact = false,
}: {
  tierId: MembershipTierId
  compact?: boolean
}) {
  const tier = getMembershipTier(tierId)
  const story = TIER_HOMEPAGE_STORY[tierId]

  return (
    <article style={compact ? upgradeCompactStyle : upgradeStyle}>
      <div style={upgradeTopStyle}>
        <span style={getBadgeStyle(tierId)}>{tier.name}</span>
        <span style={stageStyle}>{story.stage}</span>
      </div>
      <h3 style={upgradeTitleStyle}>{story.headline}</h3>
      <p style={upgradeTextStyle}>{story.copy}</p>
      <Link href={story.primaryCta.href} style={ctaStyle}>
        {story.primaryCta.label}
      </Link>
    </article>
  )
}

function TierPathwayCard({
  tierId,
  index,
  compact,
  showCta,
}: {
  tierId: MembershipTierId
  index: number
  compact: boolean
  showCta: boolean
}) {
  const tier = getMembershipTier(tierId)
  const story = TIER_HOMEPAGE_STORY[tierId]

  return (
    <article style={compact ? compactCardStyle : cardStyle}>
      <div style={cardTopStyle}>
        <span style={numberStyle}>{String(index).padStart(2, '0')}</span>
        <span style={getBadgeStyle(tierId)}>{tier.name}</span>
      </div>
      <div style={stageStyle}>{story.stage}</div>
      <h3 style={cardTitleStyle}>{tier.shortPromise}</h3>
      <p style={cardTextStyle}>{tier.description}</p>

      {!compact ? (
        <div style={valueListStyle}>
          {tier.valueProps.slice(0, 3).map((value) => (
            <div key={value} style={valueRowStyle}>
              <span style={dotStyle} />
              <span>{value}</span>
            </div>
          ))}
        </div>
      ) : null}

      {showCta ? (
        <div style={ctaRowStyle}>
          <Link href={story.primaryCta.href} style={ctaStyle}>
            {story.primaryCta.label}
          </Link>
          {story.secondaryCta ? (
            <Link href={story.secondaryCta.href} style={secondaryCtaStyle}>
              {story.secondaryCta.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

function getBadgeStyle(tierId: MembershipTierId): CSSProperties {
  if (tierId === 'player_plus') return { ...badgeStyle, borderColor: 'rgba(116,190,255,0.32)', background: 'rgba(116,190,255,0.10)' }
  if (tierId === 'captain') return { ...badgeStyle, borderColor: 'rgba(155,225,29,0.32)', background: 'rgba(155,225,29,0.10)' }
  if (tierId === 'league') return { ...badgeStyle, borderColor: 'rgba(245,158,11,0.30)', background: 'rgba(245,158,11,0.10)' }
  return badgeStyle
}

const shellStyle: CSSProperties = {
  display: 'grid',
  gap: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  borderRadius: 24,
  padding: 18,
}

const compactShellStyle: CSSProperties = {
  ...shellStyle,
  padding: 16,
  borderRadius: 20,
}

const unframedShellStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
}

const headerStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
}

const eyebrowStyle: CSSProperties = {
  color: 'var(--home-eyebrow-color)',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 24,
  lineHeight: 1.1,
  fontWeight: 900,
}

const introStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.65,
  maxWidth: 860,
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
}

const compactGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: 10,
}

const cardStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minHeight: 260,
  border: '1px solid var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 90%, var(--foreground) 10%)',
  borderRadius: 18,
  padding: 16,
}

const compactCardStyle: CSSProperties = {
  ...cardStyle,
  minHeight: 0,
  padding: 14,
}

const cardTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
}

const numberStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 900,
}

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  width: 'fit-content',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
}

const stageStyle: CSSProperties = {
  color: 'var(--home-eyebrow-color)',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

const cardTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 18,
  lineHeight: 1.2,
  fontWeight: 900,
}

const cardTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
}

const valueListStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  marginTop: 2,
}

const valueRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '8px minmax(0, 1fr)',
  alignItems: 'start',
  gap: 9,
  color: 'var(--foreground)',
  fontSize: 12,
  lineHeight: 1.45,
}

const dotStyle: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  marginTop: 5,
  background: 'var(--brand-lime)',
  boxShadow: '0 0 14px rgba(155,225,29,0.34)',
}

const ctaRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 2,
}

const ctaStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 38,
  padding: '0 13px',
  borderRadius: 12,
  border: '1px solid color-mix(in srgb, var(--brand-lime) 30%, var(--shell-panel-border) 70%)',
  background: 'linear-gradient(135deg, var(--brand-lime) 0%, #c7f36b 100%)',
  color: 'var(--text-dark)',
  fontSize: 13,
  fontWeight: 900,
  textDecoration: 'none',
}

const secondaryCtaStyle: CSSProperties = {
  ...ctaStyle,
  color: 'var(--foreground-strong)',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const stripStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: 10,
}

const stripCompactStyle: CSSProperties = {
  ...stripStyle,
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
}

const stripItemStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  borderRadius: 16,
  padding: 12,
}

const stripTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 700,
}

const upgradeStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  borderRadius: 20,
  padding: 16,
}

const upgradeCompactStyle: CSSProperties = {
  ...upgradeStyle,
  padding: 14,
}

const upgradeTopStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
}

const upgradeTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 20,
  lineHeight: 1.15,
  fontWeight: 900,
}

const upgradeTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.6,
}
