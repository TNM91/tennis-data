'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import BrandWordmark from '@/app/components/brand-wordmark'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

const statCardStyle = {
  borderRadius: '22px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(19,38,70,0.54) 0%, rgba(9,19,37,0.82) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  padding: '16px 16px 15px',
} as const

const featureCardStyle = {
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(17,34,64,0.66) 0%, rgba(8,17,32,0.86) 100%)',
  boxShadow: '0 18px 40px rgba(5,12,26,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
  padding: '18px 18px 16px',
} as const

const actionLinkBase = {
  minHeight: '52px',
  padding: '0 18px',
  borderRadius: '16px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
  fontSize: '15px',
  fontWeight: 900,
  letterSpacing: '-0.02em',
  transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
} as const

export default function HomePageHeroResponsive() {
  const { isTablet, isMobile } = useViewportBreakpoints()
  const [explorHovered, setExplorHovered] = useState(false)
  const [matchupHovered, setMatchupHovered] = useState(false)
  const [captainHovered, setCaptainHovered] = useState(false)

  const shellPadding = isMobile ? '16px' : '24px'
  const heroPadding = isMobile ? '18px' : isTablet ? '22px' : '30px'
  const headlineSize = isMobile ? '42px' : isTablet ? '58px' : '76px'
  const bodySize = isMobile ? '16px' : '18px'
  const heroGrid = isTablet ? '1fr' : 'minmax(0, 1.06fr) minmax(380px, 540px)'
  const statGrid = isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))'
  const featureGrid = isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))'

  const rightStageStyle = useMemo(
    () => ({
      position: 'relative' as const,
      minHeight: isMobile ? '360px' : isTablet ? '420px' : '620px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      order: isTablet ? 1 : 2,
      zIndex: 2,
    }),
    [isMobile, isTablet],
  )

  return (
    <section
      style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: '1280px',
        margin: '0 auto',
        padding: `18px ${shellPadding} 8px`,
      }}
    >
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: isMobile ? '28px' : '34px',
          border: '1px solid rgba(116,190,255,0.14)',
          background: 'linear-gradient(180deg, rgba(11,23,44,0.9) 0%, rgba(7,15,29,0.98) 100%)',
          boxShadow: '0 30px 84px rgba(5,12,26,0.34), inset 0 1px 0 rgba(255,255,255,0.05)',
          padding: heroPadding,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-140px',
            left: '-140px',
            width: isMobile ? '260px' : '380px',
            height: isMobile ? '260px' : '380px',
            borderRadius: '999px',
            background: 'radial-gradient(circle, rgba(74,163,255,0.18) 0%, transparent 72%)',
            filter: 'blur(8px)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '-80px',
            right: '-60px',
            width: isMobile ? '220px' : '320px',
            height: isMobile ? '220px' : '320px',
            borderRadius: '999px',
            background: 'radial-gradient(circle, rgba(155,225,29,0.13) 0%, transparent 72%)',
            filter: 'blur(8px)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: '0',
            backgroundImage:
              'linear-gradient(rgba(116,190,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(116,190,255,0.035) 1px, transparent 1px)',
            backgroundSize: isMobile ? '24px 24px' : '30px 30px',
            opacity: 0.28,
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.25) 100%)',
            WebkitMaskImage:
              'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.25) 100%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: heroGrid,
            gap: isTablet ? '16px' : '28px',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              order: isTablet ? 2 : 1,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 14px',
                borderRadius: '999px',
                border: '1px solid rgba(116,190,255,0.18)',
                background: 'linear-gradient(180deg, rgba(24,46,84,0.72) 0%, rgba(12,25,48,0.84) 100%)',
                color: '#dbe9ff',
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                boxShadow: '0 14px 30px rgba(6,14,28,0.24)',
              }}
            >
              Data-powered tennis intelligence
            </div>

            <div style={{ marginTop: '18px' }}>
              <BrandWordmark top />
            </div>

            <h1
              style={{
                margin: '18px 0 0',
                fontSize: headlineSize,
                lineHeight: 0.95,
                letterSpacing: '-0.06em',
                fontWeight: 900,
                color: '#f8fbff',
                maxWidth: '780px',
              }}
            >
              The smarter way
              <br />
              to read the court.
            </h1>

            <p
              style={{
                margin: '18px 0 0',
                maxWidth: '620px',
                color: 'rgba(216,229,245,0.82)',
                fontSize: bodySize,
                lineHeight: 1.72,
                fontWeight: 500,
              }}
            >
              TenAceIQ blends ratings, matchup intelligence, lineup planning, and league context
              into one premium command center for players, captains, and teams.
            </p>

            <div
              style={{
                marginTop: '22px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <Link
                href="/explore"
                onMouseEnter={() => setExplorHovered(true)}
                onMouseLeave={() => setExplorHovered(false)}
                style={{
                  ...actionLinkBase,
                  color: '#08111d',
                  background: 'linear-gradient(135deg, #9BE11D 0%, #C7F36B 100%)',
                  border: '1px solid rgba(155,225,29,0.34)',
                  boxShadow: explorHovered
                    ? '0 20px 42px rgba(155,225,29,0.28)'
                    : '0 16px 34px rgba(155,225,29,0.18)',
                  transform: explorHovered ? 'translateY(-2px)' : 'none',
                  transition: 'transform 150ms ease, box-shadow 150ms ease',
                }}
              >
                Explore the platform
              </Link>

              <Link
                href="/mylab"
                onMouseEnter={() => setMatchupHovered(true)}
                onMouseLeave={() => setMatchupHovered(false)}
                style={{
                  ...actionLinkBase,
                  color: '#e9f2ff',
                  background: matchupHovered
                    ? 'linear-gradient(180deg, rgba(55,102,180,0.58) 0%, rgba(24,50,98,0.82) 100%)'
                    : 'linear-gradient(180deg, rgba(41,78,140,0.48) 0%, rgba(17,36,69,0.72) 100%)',
                  border: matchupHovered ? '1px solid rgba(116,190,255,0.38)' : '1px solid rgba(116,190,255,0.22)',
                  boxShadow: matchupHovered
                    ? '0 14px 32px rgba(7,18,42,0.24), inset 0 1px 0 rgba(255,255,255,0.07)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                  transform: matchupHovered ? 'translateY(-2px)' : 'none',
                  transition: 'all 150ms ease',
                }}
              >
                Open My Lab
              </Link>

              <Link
                href="/captain"
                onMouseEnter={() => setCaptainHovered(true)}
                onMouseLeave={() => setCaptainHovered(false)}
                style={{
                  ...actionLinkBase,
                  color: captainHovered ? '#eef5ff' : '#dbe9ff',
                  background: captainHovered
                    ? 'linear-gradient(180deg, rgba(26,50,96,0.68) 0%, rgba(15,30,58,0.92) 100%)'
                    : 'linear-gradient(180deg, rgba(20,40,76,0.56) 0%, rgba(11,22,42,0.86) 100%)',
                  border: captainHovered ? '1px solid rgba(116,190,255,0.24)' : '1px solid rgba(116,190,255,0.14)',
                  transform: captainHovered ? 'translateY(-2px)' : 'none',
                  transition: 'all 150ms ease',
                }}
              >
                Open Captain's Corner
              </Link>
            </div>

            <div
              style={{
                marginTop: '24px',
                display: 'grid',
                gridTemplateColumns: statGrid,
                gap: '12px',
                maxWidth: isTablet ? '100%' : '780px',
              }}
            >
              <div style={statCardStyle}>
                <div
                  style={{
                    color: '#8fb8ff',
                    fontSize: '12px',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Ratings
                </div>
                <div
                  style={{
                    marginTop: '8px',
                    color: '#f8fbff',
                    fontSize: '20px',
                    fontWeight: 900,
                    letterSpacing: '-0.03em',
                  }}
                >
                  See trajectory
                </div>
                <div
                  style={{
                    marginTop: '6px',
                    color: 'rgba(206,221,241,0.72)',
                    fontSize: '14px',
                    lineHeight: 1.55,
                  }}
                >
                  Track singles, doubles, and overall form in one clean system.
                </div>
              </div>

              <div style={statCardStyle}>
                <div
                  style={{
                    color: '#8fb8ff',
                    fontSize: '12px',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  My Lab
                </div>
                <div
                  style={{
                    marginTop: '8px',
                    color: '#f8fbff',
                    fontSize: '20px',
                    fontWeight: 900,
                    letterSpacing: '-0.03em',
                  }}
                >
                  Read edges faster
                </div>
                <div
                  style={{
                    marginTop: '6px',
                    color: 'rgba(206,221,241,0.72)',
                    fontSize: '14px',
                    lineHeight: 1.55,
                  }}
                >
                  Compare players and teams before decisions lock in.
                </div>
              </div>

              <div style={statCardStyle}>
                <div
                  style={{
                    color: '#8fb8ff',
                    fontSize: '12px',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Captain tools
                </div>
                <div
                  style={{
                    marginTop: '8px',
                    color: '#f8fbff',
                    fontSize: '20px',
                    fontWeight: 900,
                    letterSpacing: '-0.03em',
                  }}
                >
                  Build smarter lineups
                </div>
                <div
                  style={{
                    marginTop: '6px',
                    color: 'rgba(206,221,241,0.72)',
                    fontSize: '14px',
                    lineHeight: 1.55,
                  }}
                >
                  Turn availability, pairings, and opponent context into better choices.
                </div>
              </div>
            </div>
          </div>

          <div style={rightStageStyle}>
            <div
              style={{
                position: 'absolute',
                width: isMobile ? '250px' : isTablet ? '360px' : '520px',
                height: isMobile ? '250px' : isTablet ? '360px' : '520px',
                borderRadius: '999px',
                background:
                  'radial-gradient(circle, rgba(74,163,255,0.22) 0%, rgba(74,163,255,0.08) 26%, rgba(155,225,29,0.08) 44%, transparent 72%)',
                filter: 'blur(18px)',
                opacity: 0.95,
              }}
            />

            <div
              style={{
                position: 'absolute',
                width: isMobile ? '270px' : isTablet ? '390px' : '560px',
                height: isMobile ? '270px' : isTablet ? '390px' : '560px',
                borderRadius: '999px',
                border: '1px solid rgba(116,190,255,0.12)',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.02) inset, 0 0 60px rgba(37,91,227,0.10)',
              }}
            />

            <div
              style={{
                position: 'absolute',
                width: isMobile ? '230px' : isTablet ? '340px' : '500px',
                height: isMobile ? '230px' : isTablet ? '340px' : '500px',
                borderRadius: '999px',
                border: '1px dashed rgba(155,225,29,0.18)',
                transform: 'rotate(14deg)',
                opacity: 0.76,
              }}
            />

            <div
              style={{
                position: 'relative',
                width: isMobile ? '240px' : isTablet ? '340px' : '470px',
                aspectRatio: '1 / 1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                filter:
                  'drop-shadow(0 36px 80px rgba(8,17,32,0.48)) drop-shadow(0 0 34px rgba(74,163,255,0.14)) drop-shadow(0 0 44px rgba(155,225,29,0.12))',
              }}
            >
              <Image
                src="/logo-icon-current.png"
                alt="TenAceIQ Data Ball"
                fill
                priority
                sizes="(max-width: 820px) 240px, (max-width: 1100px) 340px, 470px"
                style={{
                  objectFit: 'contain',
                }}
              />
            </div>

            <div
              style={{
                position: 'absolute',
                bottom: isMobile ? '0px' : isTablet ? '8px' : '32px',
                left: isMobile ? '10px' : isTablet ? '14px' : '18px',
                right: isMobile ? '10px' : isTablet ? '14px' : '18px',
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
                gap: '10px',
              }}
            >
              {[
                ['Dynamic edge', 'Ratings and matchup reads layered together'],
                ['Captain command', 'Availability, lineups, and projections connected'],
                ['League context', 'Players, teams, and flights in one workflow'],
              ].map(([title, copy]) => (
                <div
                  key={title}
                  style={{
                    borderRadius: '18px',
                    border: '1px solid rgba(116,190,255,0.12)',
                    background: 'linear-gradient(180deg, rgba(17,34,64,0.42) 0%, rgba(8,17,32,0.72) 100%)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                    padding: '12px 12px 10px',
                  }}
                >
                  <div
                    style={{
                      color: '#f7fbff',
                      fontSize: '13px',
                      fontWeight: 900,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {title}
                  </div>
                  <div
                    style={{
                      marginTop: '5px',
                      color: 'rgba(206,221,241,0.72)',
                      fontSize: '12px',
                      lineHeight: 1.45,
                      fontWeight: 600,
                    }}
                  >
                    {copy}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: isTablet ? '18px' : '8px',
            display: 'grid',
            gridTemplateColumns: featureGrid,
            gap: '12px',
            position: 'relative',
            zIndex: 2,
          }}
        >
          {[
            {
              label: 'For players',
              title: 'Understand your game faster',
              copy: 'See where you are trending, compare yourself to the field, and make better training decisions.',
            },
            {
              label: 'For captains',
              title: 'Plan with more clarity',
              copy: 'Build lineups with context, spot swing matches, and prepare smarter before match day.',
            },
            {
              label: 'For teams',
              title: 'Connect the whole picture',
              copy: 'Bring ratings, pairings, opponents, and league movement into one premium workflow.',
            },
          ].map((feature) => (
            <div key={feature.title} style={featureCardStyle}>
              <div
                style={{
                  color: '#8fb8ff',
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {feature.label}
              </div>
              <div
                style={{
                  marginTop: '9px',
                  color: '#f8fbff',
                  fontSize: '22px',
                  lineHeight: 1.12,
                  fontWeight: 900,
                  letterSpacing: '-0.04em',
                }}
              >
                {feature.title}
              </div>
              <div
                style={{
                  marginTop: '8px',
                  color: 'rgba(206,221,241,0.76)',
                  fontSize: '14px',
                  lineHeight: 1.62,
                  fontWeight: 600,
                }}
              >
                {feature.copy}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
