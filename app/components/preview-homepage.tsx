'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import AdsenseSlot from '@/app/components/adsense-slot'
import SiteShell from '@/app/components/site-shell'
import {
  badgeBlue,
  badgeGreen,
  badgeSlate,
  buttonGhost,
  buttonPrimary,
  colors,
  glassCard,
  heroPanel,
  pageShell,
  pageTitle,
  pageSubtitle,
  sectionKicker,
  sectionStack,
  sectionTitle,
  surfaceCard,
  surfaceCardStrong,
} from '@/lib/design-system'
import { getPricingPlan, type PricingPlanId } from '@/lib/pricing-plans'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

const HOME_INLINE_AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_INLINE || null

type TierTheme = {
  shellBorder: string
  shellShadow: string
  shellBackground: string
  chapterGlow: string
  contentBackground: string
  previewBackground: string
  previewDivider: string
  tierBadge: CSSProperties
  priceColor: string
  numberColor: string
  accentLabel: string
  accentBorder: string
  accentBackground: string
  accentText: string
  primaryButton: CSSProperties
}

type TierSectionConfig = {
  planId: PricingPlanId
  stage: string
  label: string
  headline: string
  copy: string
  bullets: string[]
  primaryCta: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  snapshot: ReactNode
  featured?: boolean
  featuredNote?: string
}

const tierSections: TierSectionConfig[] = [
  {
    planId: 'free',
    stage: 'Start here',
    label: 'Free',
    headline: 'Start free and get into the weekly flow fast.',
    copy:
      'Get into TenAceIQ without friction. Search for players, join your team or league, set availability, and stay connected to the week without paying first.',
    bullets: [
      'Search players, teams, leagues, and matchups in seconds',
      'Create your profile and join your team',
      'Set availability and view the lineup once it is posted',
    ],
    primaryCta: { label: 'Get Started Free', href: '/join' },
    secondaryCta: { label: 'Explore TIQ', href: '/explore' },
    snapshot: <FreeSnapshot />,
  },
  {
    planId: 'player_plus',
    stage: 'Upgrade 1',
    label: 'Player+',
    headline: 'Unlock Player+ to see where you fit and how to improve faster.',
    copy:
      'Player+ is for players who want more than a match log. Turn your results into clearer lineup-fit guidance, projections, recent-form signals, and practical player insight.',
    bullets: [
      'See where you should play in singles or doubles',
      'Understand projections and opponent context faster',
      'Track personal trends, recent form, and lineup fit',
    ],
    primaryCta: { label: 'Unlock Player+', href: '/pricing' },
    secondaryCta: { label: 'Explore Players', href: '/players' },
    snapshot: <PlayerPlusSnapshot />,
  },
  {
    planId: 'captain',
    stage: 'Primary unlock',
    label: 'Captain',
    headline: 'Unlock Captain to run your team with less chaos and better decisions.',
    copy:
      'Captain is the main upgrade for weekly team execution. Bring availability, lineup logic, projections, scenarios, and team communication into one command layer.',
    bullets: [
      'Build lineups with less guesswork',
      'Compare scenarios before match day',
      'Turn group-text chaos into one clear weekly plan',
    ],
    primaryCta: { label: 'Unlock Captain Tools', href: '/pricing' },
    secondaryCta: { label: 'See Captain tools', href: '/captain' },
    snapshot: <CaptainSnapshot />,
    featured: true,
    featuredNote: 'Most captains upgrade here because this is where lineup stress, availability chasing, and team communication finally come together in one workflow.',
  },
  {
    planId: 'league',
    stage: 'Organizer layer',
    label: 'League',
    headline: 'Run your league without spreadsheets.',
    copy:
      'League gives organizers one clean operating layer for schedules, standings, teams, results, and communication so the season stops living in scattered tools.',
    bullets: [
      'Create structure around teams, flights, and seasons',
      'Keep schedules and standings visible in one place',
      'Organize league-wide communication without cleanup work',
    ],
    primaryCta: { label: 'Run Your League on TIQ', href: '/pricing' },
    secondaryCta: { label: 'Explore Leagues', href: '/explore/leagues' },
    snapshot: <LeagueSnapshot />,
  },
]

export default function PreviewHomepage() {
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()

  return (
    <SiteShell active="">
      <div
        style={{
          ...pageShell,
          display: 'grid',
          gap: isMobile ? 18 : 24,
          paddingTop: isMobile ? 12 : 18,
        }}
      >
        <section style={{ ...heroPanel, overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background:
                'radial-gradient(circle at 18% 18%, rgba(74,163,255,0.18) 0%, transparent 34%), radial-gradient(circle at 82% 20%, rgba(155,225,29,0.16) 0%, transparent 30%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              backgroundImage:
                'linear-gradient(rgba(116,190,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(116,190,255,0.05) 1px, transparent 1px)',
              backgroundSize: isSmallMobile ? '26px 26px' : '34px 34px',
              maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.2) 100%)',
              WebkitMaskImage:
                'linear-gradient(180deg, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.2) 100%)',
              opacity: 0.42,
            }}
          />

          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'grid',
              gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.04fr) minmax(360px, 0.96fr)',
              gap: isTablet ? 18 : 20,
              padding: isSmallMobile ? 18 : isMobile ? 22 : 28,
              alignItems: 'stretch',
            }}
          >
            <div
              style={{
                display: 'grid',
                gap: 16,
                alignContent: 'start',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                  alignItems: 'center',
                }}
              >
                <span style={sectionKicker}>Premium tennis intelligence platform</span>
                <span
                  style={{
                    ...badgeBlue,
                    color: colors.textStrong,
                  }}
                >
                  Search first. Upgrade with purpose.
                </span>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <div
                  style={{
                    color: 'var(--brand-blue-2)',
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                  }}
                >
                  Start free. Unlock the next edge when you need it.
                </div>
                <h1
                  style={{
                    ...pageTitle,
                    fontSize: 'clamp(2.5rem, 5.6vw, 5rem)',
                    lineHeight: 0.94,
                    letterSpacing: '-0.05em',
                    maxWidth: 700,
                  }}
                >
                  Start simple.
                  <br />
                  Upgrade with purpose.
                </h1>
                <p
                  style={{
                    ...pageSubtitle,
                    maxWidth: 700,
                    fontSize: isMobile ? '15px' : '17px',
                  }}
                >
                  Search for players, teams, leagues, or matches. Get value quickly, then unlock the tools
                  that fit your role when you need better answers, more control, and less weekly stress.
                </p>
              </div>

              <HeroSearchPreview compact={isSmallMobile} />

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <Link href="/join" style={buttonPrimary}>
                  Get Started Free
                </Link>
                <Link href="/explore" style={buttonGhost}>
                  Explore the platform
                </Link>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                {[
                  'Search players, teams, leagues, and matchups fast',
                  'Captain is the unlock that clears the most weekly friction',
                ].map((item) => (
                  <span
                    key={item}
                    style={{
                      ...snapshotChipStyle,
                      minHeight: 32,
                      padding: '0 11px',
                      border: '1px solid rgba(116,190,255,0.10)',
                      background: 'color-mix(in srgb, var(--surface-soft) 92%, var(--brand-blue-2) 8%)',
                      color: 'var(--muted-strong)',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 10,
                }}
              >
                {[
                  {
                    planId: 'free' as PricingPlanId,
                    stage: 'Start here',
                    label: 'Free',
                    value: 'Search + join',
                    text: 'Get in fast with player search, team joins, availability, and lineup visibility.',
                  },
                  {
                    planId: 'captain' as PricingPlanId,
                    stage: 'Primary unlock',
                    label: 'Captain',
                    value: 'Run the week',
                    text: 'Use Captain when lineup stress, availability, and messaging start taking over.',
                  },
                ].map((item) => {
                  const theme = getTierTheme(item.planId)
                  return (
                  <div
                    key={item.label}
                    style={{
                      position: 'relative',
                      padding: 14,
                      display: 'grid',
                      gap: 6,
                      overflow: 'hidden',
                      border: '1px solid rgba(116,190,255,0.10)',
                      borderTop: `2px solid ${theme.priceColor}`,
                      background: 'color-mix(in srgb, var(--surface-soft) 94%, var(--foreground) 6%)',
                    }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        zIndex: 1,
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div
                        style={{
                          color: theme.accentLabel,
                          fontSize: 11,
                          fontWeight: 900,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {item.label}
                      </div>
                      <div
                        style={{
                          color: 'var(--muted-strong)',
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {item.stage}
                      </div>
                    </div>
                    <div style={{ color: colors.textStrong, fontSize: 18, fontWeight: 900, letterSpacing: '-0.03em' }}>
                      {item.value}
                    </div>
                    <div style={{ color: colors.mutedStrong, fontSize: 13, lineHeight: 1.65 }}>{item.text}</div>
                  </div>
                )})}
              </div>
            </div>

            <HeroWorkspacePreview />
          </div>
        </section>

        <HeroTrustStrip />

        <section style={sectionStack}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.1fr) minmax(280px, 0.9fr)',
              gap: 14,
              alignItems: 'stretch',
            }}
          >
            <div style={{ display: 'grid', gap: 12, maxWidth: 860 }}>
              <div style={sectionKicker}>Guided upgrade flow</div>
              <h2 style={{ ...sectionTitle, fontSize: 'clamp(1.85rem, 2.8vw, 2.7rem)', lineHeight: 1.02 }}>
                Unlock the tools that match your role.
              </h2>
              <p style={{ ...pageSubtitle, marginTop: 0 }}>
                Start free, get value quickly, then unlock Player+, Captain, or League when the next problem
                shows up.
              </p>
            </div>

            <div
              style={{
                ...surfaceCard,
                display: 'grid',
                gap: 8,
                padding: isSmallMobile ? 14 : 16,
                borderLeft: '2px solid rgba(155,225,29,0.42)',
                background: 'transparent',
              }}
            >
              <div style={{ color: 'var(--brand-blue-2)', fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Best path for most teams
              </div>
              <div style={{ color: 'var(--foreground-strong)', fontSize: 18, fontWeight: 900, letterSpacing: '-0.035em', lineHeight: 1.08 }}>
                Free gets players in. Captain makes the week work.
              </div>
              <div style={{ color: colors.mutedStrong, fontSize: 13, lineHeight: 1.68 }}>
                Player+ gives individual players better answers. Captain is where availability, lineups,
                scenarios, and messaging finally connect into one clear workflow.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: isMobile ? 16 : 20 }}>
            {tierSections.map((section, index) => (
              <TierSection
                key={section.planId}
                {...section}
                reverse={!isTablet && index % 2 === 1}
              />
            ))}
          </div>
        </section>

        <AdsenseSlot slot={HOME_INLINE_AD_SLOT} label="Sponsored" minHeight={250} />

        <section
          style={{
            ...heroPanel,
            padding: isSmallMobile ? 18 : isMobile ? 22 : 26,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background:
                'radial-gradient(circle at 78% 22%, rgba(155,225,29,0.16) 0%, transparent 26%), radial-gradient(circle at 20% 80%, rgba(74,163,255,0.14) 0%, transparent 26%)',
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'grid',
              gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1fr) auto',
              gap: 18,
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'grid', gap: 12, maxWidth: 760 }}>
              <div style={sectionKicker}>Next step</div>
              <h2 style={{ ...sectionTitle, fontSize: 'clamp(1.85rem, 2.8vw, 2.7rem)', lineHeight: 1.02 }}>
                Start free. Upgrade only when the next friction shows up.
              </h2>
              <p style={{ ...pageSubtitle, marginTop: 0 }}>
                This homepage keeps the flow simple on purpose: search first, then unlock the right layer
                when you need more insight, more control, or a cleaner way to run competition.
              </p>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                {[ 
                  { label: 'Free', text: 'Search, join, and get into the weekly flow.' },
                  { label: 'Captain', text: 'The clearest upgrade for weekly team execution.' },
                  { label: 'League', text: 'The easiest way to run organized competition.' },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: 'var(--muted-strong)',
                      fontSize: 13,
                      lineHeight: 1.5,
                      fontWeight: 700,
                      maxWidth: 230,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        flex: '0 0 auto',
                        background:
                          item.label === 'Captain'
                            ? 'var(--brand-green)'
                            : item.label === 'League'
                              ? '#f59e0b'
                              : 'var(--brand-blue-2)',
                      }}
                    />
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gap: 10,
                padding: 14,
                borderLeft: '2px solid rgba(155,225,29,0.42)',
                background: 'transparent',
                alignSelf: isTablet ? 'stretch' : 'start',
              }}
            >
              <div style={{ color: 'var(--brand-blue-2)', fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Choose the package that clears the next bottleneck
              </div>
              <div style={{ color: 'var(--foreground-strong)', fontSize: 18, fontWeight: 900, letterSpacing: '-0.03em' }}>
                Unlock only what solves the next real problem.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <Link href="/join" style={buttonPrimary}>
                  Get Started Free
                </Link>
                <Link href="/pricing" style={buttonGhost}>
                  Compare plans
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </SiteShell>
  )
}

function HeroSearchPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div
      style={{
        ...glassCard,
        padding: compact ? 15 : 18,
        display: 'grid',
        gap: 12,
        maxWidth: 760,
        border: '1px solid rgba(155,225,29,0.14)',
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface) 96%, var(--brand-green) 4%) 0%, color-mix(in srgb, var(--surface-soft) 98%, var(--brand-blue) 2%) 100%)',
        boxShadow: '0 18px 36px rgba(2,10,24,0.10)',
      }}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ ...badgeGreen, width: 'fit-content' }}>Start with search</div>
          <div
            style={{
              color: 'color-mix(in srgb, var(--brand-green) 78%, var(--foreground-strong) 22%)',
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            Free entry
          </div>
        </div>
        <div style={{ color: colors.textStrong, fontSize: compact ? 20 : 24, fontWeight: 900, letterSpacing: '-0.03em' }}>
          Find what you need without digging through the product.
        </div>
        <div style={{ color: colors.mutedStrong, fontSize: 13, lineHeight: 1.65 }}>
          Search the tennis layer first, then unlock the tools that solve the next problem in your week.
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact ? '1fr' : 'minmax(0, 1fr) auto',
          gap: 10,
        }}
      >
        <div
          style={{
            ...surfaceCard,
            minHeight: 56,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            border: '1px solid rgba(116,190,255,0.16)',
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 92%, var(--brand-blue-2) 8%) 0%, color-mix(in srgb, var(--surface-soft) 98%, var(--foreground) 2%) 100%)',
          }}
        >
          <SearchIcon />
          <span style={{ color: colors.mutedStrong, fontSize: 15 }}>
            Search players, teams, leagues, or matchups...
          </span>
        </div>
        <Link
          href="/explore/players"
          style={{
            ...buttonPrimary,
            minHeight: 56,
            minWidth: compact ? '100%' : 160,
          }}
        >
          Search now
        </Link>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {[
          { href: '/explore/players', label: 'Players' },
          { href: '/explore/teams', label: 'Teams' },
          { href: '/explore/leagues', label: 'Leagues' },
          { href: '/matchup', label: 'Matchups' },
        ].map((item) => (
          <Link key={item.href} href={item.href} style={chipLinkStyle}>
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function HeroWorkspacePreview() {
  const { isMobile, isTablet, isSmallMobile } = useViewportBreakpoints()

  return (
    <div
      style={{
        ...surfaceCardStrong,
        padding: isSmallMobile ? 16 : 18,
        display: 'grid',
        gap: 14,
        minHeight: 100,
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(116,190,255,0.14)',
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface) 94%, var(--brand-blue-2) 6%) 0%, color-mix(in srgb, var(--surface-soft) 98%, var(--foreground) 2%) 100%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-40px',
          right: '-30px',
          width: isMobile ? 180 : 240,
          height: isMobile ? 180 : 240,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(155,225,29,0.18) 0%, rgba(74,163,255,0.08) 42%, transparent 72%)',
          filter: 'blur(6px)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'grid', gap: 10, maxWidth: 460 }}>
          <div style={{ ...badgeBlue, width: 'fit-content' }}>Your TIQ workspace</div>
          <div style={{ color: colors.textStrong, fontSize: 28, fontWeight: 900, lineHeight: 1.02, letterSpacing: '-0.04em' }}>
            See the path from search to smarter tools.
          </div>
          <div style={{ color: colors.mutedStrong, fontSize: 14, lineHeight: 1.7, maxWidth: 420 }}>
            The snapshots below feel like real TenAceIQ surfaces: search, insight, captain workflow, and league operations.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, color: 'var(--muted-strong)', fontSize: 12, fontWeight: 700 }}>
            {['Free entry', 'Player+ insight', 'Captain workflow'].map((item, index) => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    color: index === 2 ? 'var(--brand-green)' : 'var(--foreground-strong)',
                  }}
                >
                  {item}
                </span>
                {index < 2 ? <span style={{ opacity: 0.28 }}>{'\u2022'}</span> : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateRows: 'auto minmax(220px, 1fr) auto',
            gap: 12,
            borderRadius: 24,
            overflow: 'hidden',
            border: '1px solid rgba(116,190,255,0.12)',
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--surface) 94%, var(--brand-blue-2) 6%) 0%, color-mix(in srgb, var(--surface-soft) 98%, var(--foreground) 2%) 100%)',
            padding: 14,
          }}
        >
          <div
            style={{
              ...snapshotPanelStyle,
              gap: 6,
              padding: 12,
            }}
          >
            <div style={{ ...snapshotPanelLabelStyle, color: 'var(--brand-green)' }}>Inside TenAceIQ</div>
            <div style={{ color: 'var(--foreground-strong)', fontSize: 16, fontWeight: 900 }}>
              Search first, then unlock the next layer when you need it.
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                color: 'var(--muted-strong)',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {['Search', 'Insight', 'Captain', 'League'].map((item, index) => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span>{item}</span>
                  {index < 3 ? <span style={{ opacity: 0.35 }}>{'\u2022'}</span> : null}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              ...snapshotPanelStyle,
              gap: 10,
              padding: 10,
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ ...snapshotPanelLabelStyle, color: 'var(--brand-blue-2)' }}>Matchup card</div>
              <span style={{ ...badgeBlue, width: 'fit-content' }}>Player+</span>
            </div>
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '1.2 / 1',
                borderRadius: 16,
                overflow: 'hidden',
                border: '1px solid rgba(116,190,255,0.16)',
                background:
                  'radial-gradient(circle at 50% 52%, rgba(155,225,29,0.18) 0%, rgba(155,225,29,0.07) 18%, transparent 38%), radial-gradient(circle at 18% 20%, rgba(116,190,255,0.10) 0%, transparent 26%), radial-gradient(circle at 82% 18%, rgba(255,255,255,0.08) 0%, transparent 22%), linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 88%, var(--brand-blue-2) 12%) 0%, color-mix(in srgb, var(--surface-soft) 94%, var(--foreground) 6%) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  background:
                    'linear-gradient(rgba(116,190,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(116,190,255,0.04) 1px, transparent 1px)',
                  backgroundSize: '28px 28px',
                  opacity: 0.34,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: '7%',
                  width: '68%',
                  height: '18%',
                  transform: 'translateX(-50%)',
                  borderRadius: 999,
                  background: 'radial-gradient(circle, rgba(155,225,29,0.16) 0%, rgba(116,190,255,0.08) 42%, transparent 74%)',
                  filter: 'blur(12px)',
                  pointerEvents: 'none',
                }}
              />
              <Image
                src="/matchup.png"
                alt="TenAceIQ matchup preview"
                fill
                sizes="260px"
                style={{
                  objectFit: 'cover',
                  objectPosition: 'center center',
                }}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
            gap: 8,
          }}
        >
          {[
            {
              label: 'Free',
              text: 'Search, join, and set availability without friction.',
            },
            {
              label: 'Player+',
              text: 'See fit, projections, and matchup context faster.',
            },
            {
              label: 'Captain',
              text: 'Bring lineups, scenarios, and team execution together.',
            },
          ].map((item, index) => (
            <div
              key={item.label}
              style={{
                padding: 8,
                display: 'grid',
                gap: 4,
                borderTop:
                  index === 2 ? '2px solid rgba(155,225,29,0.5)' : '2px solid rgba(116,190,255,0.35)',
                background: 'transparent',
              }}
            >
              <div style={{ color: index === 2 ? 'var(--brand-green)' : 'var(--brand-blue-2)', fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{item.label}</div>
              <div style={{ color: 'var(--muted-strong)', fontSize: 13, lineHeight: 1.6 }}>{item.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TierSection({
  planId,
  stage,
  label,
  headline,
  copy,
  bullets,
  primaryCta,
  secondaryCta,
  snapshot,
  featured = false,
  featuredNote,
  reverse = false,
}: TierSectionConfig & { reverse?: boolean }) {
  const { isTablet, isSmallMobile } = useViewportBreakpoints()
  const plan = getPricingPlan(planId)
  const theme = getTierTheme(planId)

  return (
    <section
      style={{
        ...surfaceCardStrong,
        position: 'relative',
        padding: 0,
        overflow: 'hidden',
        border: '1px solid rgba(116,190,255,0.10)',
        boxShadow: '0 20px 40px rgba(2,10,24,0.10)',
        background: theme.shellBackground,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: theme.chapterGlow,
          opacity: 0.46,
        }}
      />
      <div
        style={{
          position: 'absolute',
          insetInline: 0,
          top: 0,
          height: 2,
          background: `linear-gradient(90deg, ${theme.priceColor} 0%, transparent 72%)`,
          opacity: 0.72,
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 0.92fr) minmax(320px, 1.08fr)',
          gap: 0,
        }}
      >
        <div
          style={{
            order: isTablet ? 1 : reverse ? 2 : 1,
            padding: isSmallMobile ? 18 : 22,
            display: 'grid',
            gap: 12,
            alignContent: 'start',
            background: theme.contentBackground,
          }}
        >
          <div style={tierHeaderWrapStyle}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <span style={theme.tierBadge}>{label}</span>
              {plan.badge ? <span style={mostPopularBadgeStyle}>{plan.badge}</span> : null}
            </div>
            <span style={{ ...tierPriceStyle, color: theme.priceColor }}>{plan.priceLabel}</span>
          </div>

          <div style={{ display: 'grid', gap: 9 }}>
            <div style={{ color: theme.accentLabel, fontSize: 12, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {stage}
            </div>
            <h3
              style={{
                margin: 0,
                color: 'var(--foreground-strong)',
                fontSize: 'clamp(1.68rem, 2.45vw, 2.45rem)',
                lineHeight: 1.04,
                letterSpacing: '-0.04em',
                fontWeight: 900,
                maxWidth: 560,
              }}
            >
              {headline}
            </h3>
            <p
              style={{
                margin: 0,
                color: 'var(--muted-strong)',
                fontSize: 14,
                lineHeight: 1.68,
                maxWidth: 560,
              }}
            >
              {copy}
            </p>
          </div>

          <div style={{ display: 'grid', gap: 9 }}>
            {bullets.map((bullet) => (
              <div key={bullet} style={bulletRowStyle}>
                <span style={{ ...bulletDotStyle, background: `linear-gradient(135deg, ${theme.priceColor} 0%, rgba(255,255,255,0.98) 100%)` }} />
                <span>{bullet}</span>
              </div>
            ))}
          </div>

          {featured && featuredNote ? (
            <div
              style={{
                ...featuredNoteCardStyle,
                border: '1px solid rgba(116,190,255,0.10)',
                background: 'color-mix(in srgb, var(--surface-soft) 94%, var(--foreground) 6%)',
              }}
            >
              <div style={{ ...featuredNoteLabelStyle, color: theme.accentLabel }}>Why this tier matters</div>
              <div style={featuredNoteTextStyle}>{featuredNote}</div>
            </div>
          ) : null}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Link
              href={primaryCta.href}
              style={featured ? { ...theme.primaryButton, boxShadow: '0 16px 28px rgba(155, 225, 29, 0.18)' } : theme.primaryButton}
            >
              {primaryCta.label}
            </Link>
              {secondaryCta ? (
                <Link href={secondaryCta.href} style={getTierSecondaryButton(theme)}>
                  {secondaryCta.label}
                </Link>
              ) : null}
          </div>

          <div style={{ ...tierMetaCardStyle, border: '1px solid rgba(116,190,255,0.10)', background: 'color-mix(in srgb, var(--surface-soft) 94%, var(--foreground) 6%)' }}>
            <div style={{ ...tierMetaLabelStyle, color: theme.accentLabel }}>Problem solved</div>
            <div style={tierMetaTextStyle}>{plan.problem}</div>
            <div style={{ ...tierMetaTextStyle, color: 'var(--foreground-strong)' }}>{plan.outcome}</div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: 'var(--muted-strong)',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            <span
              style={{
                width: 36,
                height: 1,
                background: theme.priceColor,
                opacity: 0.7,
              }}
            />
            Unlocked experience
          </div>
        </div>

        <div
          style={{
            order: isTablet ? 2 : reverse ? 1 : 2,
            padding: isSmallMobile ? 18 : 22,
            background: theme.previewBackground,
            borderLeft: isTablet ? 'none' : reverse ? 'none' : theme.previewDivider,
            borderRight: isTablet ? 'none' : reverse ? theme.previewDivider : 'none',
            borderTop: isTablet ? theme.previewDivider : 'none',
            display: 'grid',
            alignContent: 'center',
          }}
        >
          {snapshot}
        </div>
      </div>
    </section>
  )
}

function HeroTrustStrip() {
  const { isMobile } = useViewportBreakpoints()
  const trustItems: Array<{ planId: PricingPlanId; label: string; title: string; text: string }> = [
    {
      planId: 'free',
      label: 'Free',
      title: 'Get in the game',
      text: 'Search, join, set availability, and stay connected without paying first.',
    },
    {
      planId: 'player_plus',
      label: 'Player+',
      title: 'See where you fit',
      text: 'Use personal analytics and projections when you want better individual answers.',
    },
    {
      planId: 'captain',
      label: 'Captain',
      title: 'Run the week with less stress',
      text: 'Lineups, scenarios, projections, and messaging live together when the week gets complicated.',
    },
    {
      planId: 'league',
      label: 'League',
      title: 'Organize competition cleanly',
      text: 'Scheduling, standings, teams, and season communication move out of spreadsheets.',
    },
  ]

  return (
    <section
      style={{
        ...surfaceCard,
        position: 'relative',
        padding: isMobile ? 14 : 16,
        display: 'grid',
        gap: 10,
        overflow: 'hidden',
        background: 'transparent',
        border: '1px solid rgba(116,190,255,0.10)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(circle at 12% 18%, color-mix(in srgb, var(--brand-blue-2) 14%, transparent) 0%, transparent 26%), radial-gradient(circle at 86% 82%, color-mix(in srgb, var(--brand-green) 12%, transparent) 0%, transparent 24%)',
        }}
      />
      <div style={{ display: 'grid', gap: 6, maxWidth: 760 }}>
        <div style={sectionKicker}>Why this flow works</div>
        <div style={{ color: colors.textStrong, fontSize: 22, fontWeight: 900, letterSpacing: '-0.04em' }}>
          The best homepage makes the next step obvious.
        </div>
        <div style={{ color: colors.mutedStrong, fontSize: 14, lineHeight: 1.72 }}>
          Start with useful free tools, then unlock the layer that removes the biggest source of friction from your tennis week.
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))',
          gap: 10,
        }}
      >
        {trustItems.map((item) => {
          const theme = getTierTheme(item.planId)
          return (
          <div key={item.label} style={{ ...trustCardStyle, border: '1px solid rgba(116,190,255,0.10)', background: 'transparent', boxShadow: 'none' }}>
            <div style={{ color: theme.accentLabel, fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', width: 'fit-content' }}>{item.label}</div>
            <div style={trustCardTitleStyle}>{item.title}</div>
            <div style={trustCardTextStyle}>{item.text}</div>
          </div>
        )})}
      </div>
    </section>
  )
}

function FreeSnapshot() {
  const { isSmallMobile } = useViewportBreakpoints()

  return (
    <SnapshotShell planId="free" title="Explore entry" subtitle="Search, profile, availability, lineup visibility">
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={searchInputShellStyle}>
          <SearchIcon />
          <span style={{ color: colors.mutedStrong, fontSize: 14 }}>Search players, teams, leagues, or matches</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['Players', 'Teams', 'Leagues', 'Matchups'].map((item) => (
            <span key={item} style={snapshotChipStyle}>
              {item}
            </span>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <SnapshotCard title="Profile" value="Ready to join" text="Create your player profile and connect to your weekly flow." />
          <SnapshotCard title="Availability" value="2 taps" text="Set in, out, or tentative before lineup decisions start." accent="green" />
        </div>

        <div style={listShellStyle}>
          <ListRow title="Posted lineup" meta="View-only access on Free" trailing="Ready" />
          <ListRow title="My next match" meta="Saturday, 9:00 AM" trailing="Upcoming" />
        </div>
      </div>
    </SnapshotShell>
  )
}

function PlayerPlusSnapshot() {
  const { isMobile, isSmallMobile } = useViewportBreakpoints()

  return (
    <SnapshotShell planId="player_plus" title="Player+ insight" subtitle="Role fit, projections, recent form, and matchup context">
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isSmallMobile ? '1fr' : isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          <SnapshotCard title="TIQ" value="4.48" text="Current form rating" accent="green" />
          <SnapshotCard title="Best fit" value="D2" text="Where you should play" accent="blue" />
          <SnapshotCard title="Projection" value="63%" text="Match win estimate" accent="blue" />
        </div>

        <div style={snapshotPanelStyle}>
          <div style={{ ...snapshotPanelLabelStyle, color: 'var(--brand-green)' }}>Where should I play?</div>
          <div style={{ color: 'var(--foreground-strong)', fontSize: 18, fontWeight: 900, letterSpacing: '-0.03em' }}>
            Your best edge is doubles this week.
          </div>
          <div style={{ color: 'var(--muted-strong)', fontSize: 13, lineHeight: 1.65 }}>
            Higher doubles fit, steadier recent form, and better synergy with similar TIQ pair profiles.
          </div>
        </div>

        <div style={snapshotPanelStyle}>
          <div style={{ ...snapshotPanelLabelStyle, color: 'var(--brand-blue-2)' }}>Recent form and matchup context</div>
          <div style={{ color: 'var(--foreground-strong)', fontSize: 16, fontWeight: 900 }}>
            Trending up, with the clearest edge when the pace stays controlled.
          </div>
          <div style={{ color: 'var(--muted-strong)', fontSize: 13, lineHeight: 1.6 }}>
            Recent TIQ movement and available opponent context both point to doubles as the stronger play this week.
          </div>
        </div>
      </div>
    </SnapshotShell>
  )
}

function CaptainSnapshot() {
  const { isMobile, isSmallMobile } = useViewportBreakpoints()

  return (
    <SnapshotShell
      planId="captain"
      title="Captain workflow"
      subtitle="Availability, lineup builder, scenarios, projections, and team messaging"
      featured
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isSmallMobile ? '1fr' : isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          <SnapshotCard title="Availability" value="8 / 10" text="Players confirmed" accent="green" />
          <SnapshotCard title="Best lineup" value="71%" text="Projected win rate" accent="green" />
          <SnapshotCard title="Scenario delta" value="+8%" text="Versus fallback option" accent="blue" />
        </div>

        <div style={{ ...snapshotPanelStyle, gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ ...snapshotPanelLabelStyle, color: 'var(--foreground)' }}>Projected lineup</div>
            <span style={{ ...badgeGreen, width: 'fit-content' }}>Captain</span>
          </div>
          <div style={lineupShellStyle}>
            <LineupRow label="S1" value="N. Meinert" status="Available" projection="66%" />
            <LineupRow label="S2" value="L. Carter" status="Available" projection="59%" />
            <LineupRow label="D1" value="Mei + Brooks" status="Available" projection="74%" />
            <LineupRow label="D2" value="Hart + Lyons" status="Tentative" projection="68%" />
            <LineupRow label="D3" value="Cole + Ramos" status="Available" projection="71%" />
          </div>
        </div>

        <div style={{ ...snapshotPanelStyle, gap: 10 }}>
          <div style={{ ...snapshotPanelLabelStyle, color: 'var(--brand-blue-2)' }}>Captain signals</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <CaptainSignalRow title="Availability conflict" text="Two tentative players are still sitting in fallback doubles spots." tone="warn" />
            <CaptainSignalRow title="Best projected court" text="D1 is the clearest swing court in the current recommended lineup." tone="good" />
            <CaptainSignalRow title="Team message" text="Lineup, arrival time, and reminders can go out in one update." tone="info" />
          </div>
        </div>
      </div>
    </SnapshotShell>
  )
}

function LeagueSnapshot() {
  const { isMobile, isSmallMobile } = useViewportBreakpoints()

  return (
    <SnapshotShell planId="league" title="League workspace" subtitle="Standings, schedule, teams, and season operations">
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          <SnapshotCard title="Teams" value="10" text="Entered this season" accent="blue" />
          <SnapshotCard title="Matches" value="36" text="Scheduled and tracked" accent="green" />
        </div>

        <div style={listShellStyle}>
          <div style={{ ...snapshotPanelLabelStyle, color: 'var(--brand-blue-2)', marginBottom: 4 }}>Standings</div>
          <StandingsRow rank="1" team="Southside Aces" record="5-1" points="16" />
          <StandingsRow rank="2" team="Wily Wolverines" record="4-2" points="14" />
          <StandingsRow rank="3" team="Northline Volley" record="4-2" points="13" />
          <StandingsRow rank="4" team="Baseline Union" record="3-3" points="11" />
        </div>

        <div style={snapshotPanelStyle}>
          <div style={{ ...snapshotPanelLabelStyle, color: 'var(--brand-green)' }}>Upcoming schedule</div>
          <ListRow title="Wolverines vs Aces" meta="Saturday - Court 3 - 9:00 AM" trailing="Ready" />
          <ListRow title="Union vs Spin Club" meta="Saturday - Court 5 - 10:30 AM" trailing="Posted" />
        </div>
      </div>
    </SnapshotShell>
  )
}

function SnapshotShell({
  planId,
  title,
  subtitle,
  children,
  featured = false,
}: {
  planId: PricingPlanId
  title: string
  subtitle: string
  children: ReactNode
  featured?: boolean
}) {
  const { isSmallMobile } = useViewportBreakpoints()
  const theme = getTierTheme(planId)
  return (
    <div
      style={{
        ...surfaceCard,
        position: 'relative',
        padding: isSmallMobile ? 15 : 16,
        display: 'grid',
        gap: 12,
        background: featured ? theme.previewBackground : theme.contentBackground,
        border: '1px solid rgba(116,190,255,0.10)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: theme.chapterGlow,
          opacity: 0.24,
        }}
      />
      <div style={{ display: 'grid', gap: 5 }}>
        <div style={{ ...snapshotPanelLabelStyle, color: theme.accentLabel }}>{title}</div>
        <div style={{ color: 'var(--foreground-strong)', fontSize: 18, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{subtitle}</div>
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )
}

function SnapshotCard({
  title,
  value,
  text,
  accent = 'slate',
}: {
  title: string
  value: string
  text: string
  accent?: 'green' | 'blue' | 'slate'
}) {
  const tone =
    accent === 'green'
      ? 'color-mix(in srgb, var(--surface-soft) 88%, var(--brand-green) 12%)'
      : accent === 'blue'
        ? 'color-mix(in srgb, var(--surface-soft) 88%, var(--brand-blue-2) 12%)'
        : 'color-mix(in srgb, var(--surface-soft) 96%, var(--foreground) 4%)'

  const border =
    accent === 'green'
      ? '1px solid rgba(155,225,29,0.18)'
      : accent === 'blue'
        ? '1px solid rgba(116,190,255,0.16)'
        : '1px solid rgba(116,190,255,0.10)'

  const labelColor =
    accent === 'green'
      ? 'color-mix(in srgb, var(--brand-green) 78%, var(--foreground-strong) 22%)'
      : accent === 'blue'
        ? 'color-mix(in srgb, var(--brand-blue) 74%, var(--foreground-strong) 26%)'
        : 'var(--muted-strong)'

  return (
    <div
      style={{
        display: 'grid',
        gap: 6,
        padding: 12,
        borderRadius: 15,
        background: tone,
        border,
      }}
    >
      <div style={{ color: labelColor, fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {title}
      </div>
      <div style={{ color: 'var(--foreground-strong)', fontSize: 22, fontWeight: 900, letterSpacing: '-0.04em' }}>{value}</div>
      <div style={{ color: 'var(--foreground)', fontSize: 12, lineHeight: 1.55 }}>{text}</div>
    </div>
  )
}

function CaptainSignalRow({
  title,
  text,
  tone,
}: {
  title: string
  text: string
  tone: 'warn' | 'good' | 'info'
}) {
  const chipStyle =
    tone === 'warn'
      ? signalWarnChipStyle
      : tone === 'good'
        ? signalGoodChipStyle
        : signalInfoChipStyle

  const chipLabel = tone === 'warn' ? 'Watch' : tone === 'good' ? 'Strong' : 'Ready'

  return (
    <div style={captainSignalRowStyle}>
      <div style={{ display: 'grid', gap: 4 }}>
        <div style={{ color: 'var(--foreground-strong)', fontSize: 13, fontWeight: 800 }}>{title}</div>
        <div style={{ color: 'var(--muted-strong)', fontSize: 12, lineHeight: 1.55 }}>{text}</div>
      </div>
      <span style={chipStyle}>{chipLabel}</span>
    </div>
  )
}

function LineupRow({
  label,
  value,
  status,
  projection,
}: {
  label: string
  value: string
  status: string
  projection: string
}) {
  const { isSmallMobile } = useViewportBreakpoints()
  const statusStyle =
    status === 'Available'
      ? badgeGreen
      : status === 'Tentative'
        ? badgeBlue
        : badgeSlate

  const projectionChipStyle: CSSProperties = {
    width: 'fit-content',
    minHeight: 28,
    padding: '0 12px',
    borderRadius: 999,
    border: '1px solid rgba(155,225,29,0.24)',
    background:
      'color-mix(in srgb, var(--surface-soft) 82%, var(--brand-green) 18%)',
    color: 'var(--foreground-strong)',
    fontSize: 13,
    fontWeight: 900,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    letterSpacing: '-0.01em',
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isSmallMobile ? '44px minmax(0, 1fr)' : '52px minmax(0, 1fr) auto auto',
        gap: 10,
        alignItems: 'center',
        padding: 12,
        borderRadius: 15,
        border: '1px solid rgba(116,190,255,0.1)',
        background: 'color-mix(in srgb, var(--surface-soft) 96%, var(--foreground) 4%)',
      }}
    >
      <div style={{ color: 'var(--foreground)', fontWeight: 900 }}>{label}</div>
      <div style={{ color: 'var(--foreground-strong)', fontSize: 14, fontWeight: 800 }}>{value}</div>
      {isSmallMobile ? (
        <>
          <span style={{ ...statusStyle, width: 'fit-content', minHeight: 28, gridColumn: '2 / 3' }}>{status}</span>
          <div style={{ ...projectionChipStyle, gridColumn: '2 / 3' }}>{projection}</div>
        </>
      ) : (
        <>
          <span style={{ ...statusStyle, width: 'fit-content', minHeight: 28 }}>{status}</span>
          <div style={projectionChipStyle}>{projection}</div>
        </>
      )}
    </div>
  )
}

function ListRow({
  title,
  meta,
  trailing,
}: {
  title: string
  meta: string
  trailing: string
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 12,
        alignItems: 'center',
        padding: 12,
        borderRadius: 15,
        border: '1px solid rgba(116,190,255,0.1)',
        background: 'color-mix(in srgb, var(--surface-soft) 96%, var(--foreground) 4%)',
      }}
    >
      <div style={{ display: 'grid', gap: 4 }}>
        <div style={{ color: 'var(--foreground-strong)', fontSize: 14, fontWeight: 800 }}>{title}</div>
        <div style={{ color: 'var(--muted-strong)', fontSize: 12, lineHeight: 1.55 }}>{meta}</div>
      </div>
      <div style={{ ...badgeBlue, width: 'fit-content' }}>{trailing}</div>
    </div>
  )
}

function StandingsRow({
  rank,
  team,
  record,
  points,
}: {
  rank: string
  team: string
  record: string
  points: string
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '28px minmax(0, 1fr) auto auto',
        gap: 10,
        alignItems: 'center',
        padding: 10,
        borderRadius: 14,
      }}
    >
      <div style={{ color: '#9be11d', fontWeight: 900 }}>{rank}</div>
      <div style={{ color: 'var(--foreground-strong)', fontSize: 14, fontWeight: 800 }}>{team}</div>
      <div style={{ color: 'var(--muted-strong)', fontSize: 12, fontWeight: 800 }}>{record}</div>
      <div style={{ color: 'var(--foreground)', fontSize: 12, fontWeight: 900 }}>{points} pts</div>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="M8.6 14.2a5.6 5.6 0 1 1 0-11.2 5.6 5.6 0 0 1 0 11.2Zm7 1.1-3.1-3.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

const chipLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid var(--card-border-soft)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 92%, var(--brand-blue-2) 8%) 0%, color-mix(in srgb, var(--surface-soft) 98%, var(--foreground) 2%) 100%)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 800,
  boxShadow: 'var(--shadow-soft)',
}

const searchInputShellStyle: CSSProperties = {
  ...surfaceCard,
  minHeight: 50,
  padding: '0 14px',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  border: '1px solid rgba(116,190,255,0.16)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 92%, var(--brand-blue-2) 8%) 0%, color-mix(in srgb, var(--surface-soft) 98%, var(--foreground) 2%) 100%)',
}

const snapshotChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.12)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 92%, var(--brand-blue-2) 8%) 0%, color-mix(in srgb, var(--surface-soft) 98%, var(--foreground) 2%) 100%)',
  color: 'var(--foreground)',
  fontSize: 12,
  fontWeight: 800,
}

const snapshotPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'color-mix(in srgb, var(--surface-soft) 96%, var(--foreground) 4%)',
}

const snapshotPanelLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const listShellStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: 10,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'color-mix(in srgb, var(--surface-soft) 96%, var(--foreground) 4%)',
}

const lineupShellStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
}

const tierPriceStyle: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: '-0.01em',
}

const mostPopularBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 26,
  padding: '0 9px',
  borderRadius: 999,
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
  color: '#07121f',
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const bulletRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '12px 1fr',
  gap: 10,
  alignItems: 'start',
  color: 'var(--foreground)',
  fontSize: 14,
  lineHeight: 1.68,
}

const bulletDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  marginTop: 7,
  borderRadius: 999,
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
}

const tierMetaCardStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 11,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'color-mix(in srgb, var(--surface-soft) 96%, var(--foreground) 4%)',
}

const tierMetaLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const tierMetaTextStyle: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: 13,
  lineHeight: 1.6,
  fontWeight: 700,
}

const tierHeaderWrapStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
}

function getTierTheme(planId: PricingPlanId): TierTheme {
  switch (planId) {
    case 'player_plus':
      return {
        shellBorder: '1px solid rgba(74,163,255,0.22)',
        shellShadow: '0 24px 56px rgba(37,91,227,0.10)',
        shellBackground:
          'linear-gradient(135deg, color-mix(in srgb, var(--surface-strong) 92%, var(--brand-blue) 8%) 0%, color-mix(in srgb, var(--surface) 94%, var(--brand-blue-2) 6%) 100%)',
        chapterGlow:
          'radial-gradient(circle at 14% 16%, color-mix(in srgb, var(--brand-blue-2) 14%, transparent) 0%, transparent 34%), radial-gradient(circle at 88% 82%, color-mix(in srgb, var(--brand-blue) 12%, transparent) 0%, transparent 30%)',
        contentBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 96%, var(--brand-blue) 4%) 0%, color-mix(in srgb, var(--surface) 96%, var(--brand-blue-2) 4%) 100%)',
        previewBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 94%, var(--brand-blue) 6%) 0%, color-mix(in srgb, var(--surface) 94%, var(--brand-blue-2) 6%) 100%)',
        previewDivider: '1px solid rgba(74,163,255,0.12)',
        tierBadge: {
          ...badgeBlue,
          color: 'var(--foreground-strong)',
          border: '1px solid rgba(74,163,255,0.22)',
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 80%, var(--brand-blue) 20%) 0%, color-mix(in srgb, var(--surface-soft) 92%, var(--brand-blue-2) 8%) 100%)',
        },
        priceColor: 'var(--brand-blue)',
        numberColor: 'color-mix(in srgb, var(--brand-blue) 72%, var(--foreground-strong) 28%)',
        accentLabel: 'color-mix(in srgb, var(--brand-blue) 72%, var(--foreground-strong) 28%)',
        accentBorder: '1px solid rgba(74,163,255,0.18)',
        accentBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 80%, var(--brand-blue) 20%) 0%, color-mix(in srgb, var(--surface-soft) 86%, var(--brand-blue-2) 14%) 100%)',
        accentText: 'var(--foreground-strong)',
        primaryButton: {
          ...buttonPrimary,
          background: 'linear-gradient(135deg, #255be3 0%, #74beff 100%)',
          border: '1px solid rgba(116,190,255,0.34)',
          color: 'var(--foreground-strong)',
          boxShadow: '0 16px 30px rgba(37,91,227,0.20)',
        },
      }
    case 'captain':
      return {
        shellBorder: '1px solid rgba(155,225,29,0.24)',
        shellShadow: '0 26px 60px rgba(155,225,29,0.10)',
        shellBackground:
          'linear-gradient(135deg, color-mix(in srgb, var(--surface-strong) 90%, var(--brand-green) 10%) 0%, color-mix(in srgb, var(--surface) 94%, var(--brand-blue) 6%) 100%)',
        chapterGlow:
          'radial-gradient(circle at 16% 14%, color-mix(in srgb, var(--brand-green) 16%, transparent) 0%, transparent 34%), radial-gradient(circle at 84% 80%, color-mix(in srgb, var(--brand-blue-2) 12%, transparent) 0%, transparent 28%)',
        contentBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 96%, var(--brand-blue) 4%) 0%, color-mix(in srgb, var(--surface) 94%, var(--brand-green) 6%) 100%)',
        previewBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 92%, var(--brand-green) 8%) 0%, color-mix(in srgb, var(--surface) 94%, var(--brand-blue) 6%) 100%)',
        previewDivider: '1px solid rgba(155,225,29,0.10)',
        tierBadge: {
          ...badgeGreen,
          color: 'var(--foreground-strong)',
          border: '1px solid rgba(155,225,29,0.22)',
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 78%, var(--brand-green) 22%) 0%, color-mix(in srgb, var(--surface-soft) 90%, var(--brand-green) 10%) 100%)',
        },
        priceColor: 'var(--brand-green)',
        numberColor: 'color-mix(in srgb, var(--brand-green) 76%, var(--foreground-strong) 24%)',
        accentLabel: 'color-mix(in srgb, var(--brand-green) 76%, var(--foreground-strong) 24%)',
        accentBorder: '1px solid rgba(155,225,29,0.18)',
        accentBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 78%, var(--brand-green) 22%) 0%, color-mix(in srgb, var(--surface-soft) 84%, var(--brand-blue) 16%) 100%)',
        accentText: 'var(--foreground-strong)',
        primaryButton: {
          ...buttonPrimary,
          boxShadow: '0 18px 34px rgba(155, 225, 29, 0.22)',
        },
      }
    case 'league':
      return {
        shellBorder: '1px solid rgba(245,158,11,0.22)',
        shellShadow: '0 24px 56px rgba(245,158,11,0.10)',
        shellBackground:
          'linear-gradient(135deg, color-mix(in srgb, var(--surface-strong) 92%, #f59e0b 8%) 0%, color-mix(in srgb, var(--surface) 96%, #fcd34d 4%) 100%)',
        chapterGlow:
          'radial-gradient(circle at 16% 18%, color-mix(in srgb, #f59e0b 12%, transparent) 0%, transparent 34%), radial-gradient(circle at 86% 80%, color-mix(in srgb, #fcd34d 10%, transparent) 0%, transparent 28%)',
        contentBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 96%, #f59e0b 4%) 0%, color-mix(in srgb, var(--surface) 96%, var(--brand-blue) 4%) 100%)',
        previewBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 94%, #f59e0b 6%) 0%, color-mix(in srgb, var(--surface) 96%, #fcd34d 4%) 100%)',
        previewDivider: '1px solid rgba(245,158,11,0.12)',
        tierBadge: {
          ...badgeSlate,
          color: 'var(--foreground-strong)',
          border: '1px solid rgba(245,158,11,0.22)',
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 78%, #f59e0b 22%) 0%, color-mix(in srgb, var(--surface-soft) 90%, #fcd34d 10%) 100%)',
        },
        priceColor: '#f59e0b',
        numberColor: 'color-mix(in srgb, #f59e0b 74%, var(--foreground-strong) 26%)',
        accentLabel: 'color-mix(in srgb, #f59e0b 74%, var(--foreground-strong) 26%)',
        accentBorder: '1px solid rgba(245,158,11,0.18)',
        accentBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 78%, #f59e0b 22%) 0%, color-mix(in srgb, var(--surface-soft) 86%, #fcd34d 14%) 100%)',
        accentText: 'var(--foreground-strong)',
        primaryButton: {
          ...buttonPrimary,
          background: 'linear-gradient(135deg, #f59e0b 0%, #fcd34d 100%)',
          border: '1px solid rgba(245,158,11,0.34)',
          color: '#111827',
          boxShadow: '0 16px 30px rgba(245,158,11,0.20)',
        },
      }
    case 'free':
    default:
      return {
        shellBorder: '1px solid rgba(148,163,184,0.18)',
        shellShadow: 'var(--shadow-card)',
        shellBackground:
          'linear-gradient(135deg, color-mix(in srgb, var(--surface-strong) 92%, var(--brand-blue) 8%) 0%, color-mix(in srgb, var(--surface) 96%, var(--foreground) 4%) 100%)',
        chapterGlow:
          'radial-gradient(circle at 16% 16%, color-mix(in srgb, var(--brand-blue-2) 12%, transparent) 0%, transparent 34%), radial-gradient(circle at 84% 84%, color-mix(in srgb, var(--foreground) 8%, transparent) 0%, transparent 30%)',
        contentBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 96%, var(--brand-blue) 4%) 0%, color-mix(in srgb, var(--surface) 98%, var(--foreground) 2%) 100%)',
        previewBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 94%, var(--brand-blue-2) 6%) 0%, color-mix(in srgb, var(--surface) 96%, var(--foreground) 4%) 100%)',
        previewDivider: '1px solid rgba(116,190,255,0.08)',
        tierBadge: {
          ...badgeSlate,
          color: 'var(--foreground-strong)',
          background: 'var(--surface-soft)',
        },
        priceColor: 'var(--foreground)',
        numberColor: 'color-mix(in srgb, var(--brand-blue) 72%, var(--foreground-strong) 28%)',
        accentLabel: 'color-mix(in srgb, var(--brand-blue) 72%, var(--foreground-strong) 28%)',
        accentBorder: '1px solid rgba(116,190,255,0.12)',
        accentBackground:
          'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 92%, var(--brand-blue-2) 8%) 0%, color-mix(in srgb, var(--surface-soft) 96%, var(--foreground) 4%) 100%)',
        accentText: 'var(--foreground-strong)',
        primaryButton: buttonPrimary,
      }
  }
}

const featuredNoteCardStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.18)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 80%, var(--brand-green) 20%) 0%, color-mix(in srgb, var(--surface-soft) 88%, var(--brand-blue) 12%) 100%)',
}

const featuredNoteLabelStyle: CSSProperties = {
  color: 'color-mix(in srgb, var(--brand-green) 78%, var(--foreground-strong) 22%)',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const featuredNoteTextStyle: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: 13,
  lineHeight: 1.6,
  fontWeight: 700,
}

const trustCardStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'transparent',
}

const trustCardTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 15,
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const trustCardTextStyle: CSSProperties = {
  color: 'var(--muted-strong)',
  fontSize: 13,
  lineHeight: 1.65,
}

const captainSignalRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 10,
  alignItems: 'center',
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.08)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--surface-soft-strong) 90%, var(--brand-blue-2) 10%) 0%, color-mix(in srgb, var(--surface-soft) 96%, var(--foreground) 4%) 100%)',
}

const signalWarnChipStyle: CSSProperties = {
  ...badgeSlate,
  width: 'fit-content',
  border: '1px solid rgba(245, 158, 11, 0.22)',
  background: 'rgba(245, 158, 11, 0.12)',
  color: 'var(--foreground-strong)',
}

const signalGoodChipStyle: CSSProperties = {
  ...badgeGreen,
  width: 'fit-content',
}

const signalInfoChipStyle: CSSProperties = {
  ...badgeBlue,
  width: 'fit-content',
}

function getTierSecondaryButton(theme: TierTheme): CSSProperties {
  return {
    ...buttonGhost,
    border: theme.accentBorder,
    background: theme.accentBackground,
    color: theme.accentText,
  }
}
