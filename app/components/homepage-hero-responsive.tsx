'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import BrandWordmark from '@/app/components/brand-wordmark'
import DataBallHero from '@/app/components/data-ball-hero'

const statCardStyle = {
  borderRadius: '22px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(180deg, rgba(18,35,66,0.82) 0%, rgba(10,20,38,0.92) 100%)',
  boxShadow: '0 18px 44px rgba(5,12,25,0.24), inset 0 1px 0 rgba(255,255,255,0.04)',
  padding: '16px 18px',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
} as const

const featureCardStyle = {
  borderRadius: '24px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(17,34,63,0.74) 0%, rgba(9,18,34,0.92) 100%)',
  boxShadow: '0 20px 50px rgba(5,12,25,0.2), inset 0 1px 0 rgba(255,255,255,0.04)',
  padding: '20px',
} as const

const actionLinkBase = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '50px',
  borderRadius: '999px',
  padding: '0 18px',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: '15px',
  transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
} as const

export default function HomePageHeroResponsive() {
  const [screenWidth, setScreenWidth] = useState(1280)

  useEffect(() => {
    const onResize = () => setScreenWidth(window.innerWidth)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const isTablet = screenWidth < 1100
  const isMobile = screenWidth < 820

  const shellPadding = isMobile ? '16px' : '24px'
  const heroPadding = isMobile ? '18px' : isTablet ? '22px' : '28px'
  const headlineSize = isMobile ? '42px' : isTablet ? '56px' : '74px'
  const bodySize = isMobile ? '16px' : '18px'
  const heroGrid = isTablet ? '1fr' : 'minmax(0, 1.08fr) minmax(320px, 520px)'
  const statGrid = isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))'
  const featureGrid = isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))'

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
          background: 'linear-gradient(180deg, rgba(14,28,52,0.88) 0%, rgba(8,17,32,0.96) 100%)',
          boxShadow: '0 28px 80px rgba(5,12,26,0.34), inset 0 1px 0 rgba(255,255,255,0.05)',
          padding: heroPadding,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            right: '-80px',
            width: isMobile ? '240px' : '360px',
            height: isMobile ? '240px' : '360px',
            borderRadius: '999px',
            background: 'radial-gradient(circle, rgba(74,163,255,0.16) 0%, transparent 70%)',
            filter: 'blur(8px)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-140px',
            left: '-100px',
            width: isMobile ? '220px' : '340px',
            height: isMobile ? '220px' : '340px',
            borderRadius: '999px',
            background: 'radial-gradient(circle, rgba(155,225,29,0.12) 0%, transparent 72%)',
            filter: 'blur(10px)',
          }}
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: heroGrid,
            gap: isTablet ? '10px' : '24px',
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
              Tennis Intelligence Engine
            </div>

            <div style={{ marginTop: '18px' }}>
              <BrandWordmark top />
            </div>

            <h1
              style={{
                margin: '16px 0 0',
                fontSize: headlineSize,
                lineHeight: 0.95,
                letterSpacing: '-0.055em',
                fontWeight: 900,
                color: '#f8fbff',
                maxWidth: '760px',
              }}
            >
              Know more.
              <br />
              Plan better.
              <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #9BE11D 0%, #C7F36B 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Compete smarter.
              </span>
            </h1>

            <p
              style={{
                margin: '18px 0 0',
                maxWidth: '620px',
                color: 'rgba(216,229,245,0.82)',
                fontSize: bodySize,
                lineHeight: 1.7,
                fontWeight: 500,
              }}
            >
              Advanced tennis ratings, matchup intelligence, lineup planning, and league context
              built for players, captains, and teams.
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
                style={{
                  ...actionLinkBase,
                  color: '#08111d',
                  background: 'linear-gradient(135deg, #9BE11D 0%, #C7F36B 100%)',
                  border: '1px solid rgba(155,225,29,0.34)',
                  boxShadow: '0 16px 34px rgba(155,225,29,0.18)',
                }}
              >
                Explore the platform
              </Link>

              <Link
                href="/matchup"
                style={{
                  ...actionLinkBase,
                  color: '#e9f2ff',
                  background: 'linear-gradient(180deg, rgba(41,78,140,0.48) 0%, rgba(17,36,69,0.72) 100%)',
                  border: '1px solid rgba(116,190,255,0.22)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                }}
              >
                Run a matchup
              </Link>

              <Link
                href="/captain"
                style={{
                  ...actionLinkBase,
                  color: '#dbe9ff',
                  background: 'linear-gradient(180deg, rgba(20,40,76,0.56) 0%, rgba(11,22,42,0.86) 100%)',
                  border: '1px solid rgba(116,190,255,0.14)',
                }}
              >
                Open Captain’s Corner
              </Link>
            </div>

            <div
              style={{
                marginTop: '24px',
                display: 'grid',
                gridTemplateColumns: statGrid,
                gap: '12px',
                maxWidth: isTablet ? '100%' : '760px',
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
                  Track progress
                </div>
                <div
                  style={{
                    marginTop: '6px',
                    color: 'rgba(206,221,241,0.72)',
                    fontSize: '14px',
                    lineHeight: 1.55,
                  }}
                >
                  Singles, doubles, and overall intelligence in one system.
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
                  Matchups
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
                  Compare faster
                </div>
                <div
                  style={{
                    marginTop: '6px',
                    color: 'rgba(206,221,241,0.72)',
                    fontSize: '14px',
                    lineHeight: 1.55,
                  }}
                >
                  Instantly evaluate likely outcomes before lineups lock.
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
                  Plan smarter
                </div>
                <div
                  style={{
                    marginTop: '6px',
                    color: 'rgba(206,221,241,0.72)',
                    fontSize: '14px',
                    lineHeight: 1.55,
                  }}
                >
                  Availability, lineup building, and team decision support.
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              zIndex: 2,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: isMobile ? '320px' : '420px',
              order: isTablet ? 1 : 2,
            }}
          >
            <DataBallHero />
          </div>
        </div>
      </div>

      <section
        style={{
          width: '100%',
          marginTop: '18px',
          display: 'grid',
          gridTemplateColumns: featureGrid,
          gap: '14px',
        }}
      >
        <Link href="/players" style={{ ...featureCardStyle, textDecoration: 'none' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '16px',
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(135deg, rgba(74,163,255,0.2) 0%, rgba(37,91,227,0.26) 100%)',
              border: '1px solid rgba(116,190,255,0.18)',
            }}
          >
            <span style={{ color: '#dff0ff', fontSize: '22px' }}>👤</span>
          </div>
          <div
            style={{
              marginTop: '14px',
              color: '#f8fbff',
              fontSize: '22px',
              fontWeight: 900,
              letterSpacing: '-0.03em',
            }}
          >
            Player intelligence
          </div>
          <div
            style={{
              marginTop: '8px',
              color: 'rgba(210,225,244,0.76)',
              fontSize: '14px',
              lineHeight: 1.6,
            }}
          >
            Search player profiles, rating movement, historical results, and recent momentum.
          </div>
        </Link>

        <Link href="/leagues" style={{ ...featureCardStyle, textDecoration: 'none' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '16px',
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(135deg, rgba(155,225,29,0.18) 0%, rgba(74,163,255,0.16) 100%)',
              border: '1px solid rgba(155,225,29,0.18)',
            }}
          >
            <span style={{ color: '#efffc9', fontSize: '22px' }}>🏆</span>
          </div>
          <div
            style={{
              marginTop: '14px',
              color: '#f8fbff',
              fontSize: '22px',
              fontWeight: 900,
              letterSpacing: '-0.03em',
            }}
          >
            League context
          </div>
          <div
            style={{
              marginTop: '8px',
              color: 'rgba(210,225,244,0.76)',
              fontSize: '14px',
              lineHeight: 1.6,
            }}
          >
            Move from individual analysis to team and league-level context without losing clarity.
          </div>
        </Link>

        <Link href="/captain" style={{ ...featureCardStyle, textDecoration: 'none' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '16px',
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(135deg, rgba(37,91,227,0.2) 0%, rgba(155,225,29,0.18) 100%)',
              border: '1px solid rgba(116,190,255,0.18)',
            }}
          >
            <span style={{ color: '#dff0ff', fontSize: '22px' }}>🧠</span>
          </div>
          <div
            style={{
              marginTop: '14px',
              color: '#f8fbff',
              fontSize: '22px',
              fontWeight: 900,
              letterSpacing: '-0.03em',
            }}
          >
            Captain tools
          </div>
          <div
            style={{
              marginTop: '8px',
              color: 'rgba(210,225,244,0.76)',
              fontSize: '14px',
              lineHeight: 1.6,
            }}
          >
            Use availability, lineup planning, and matchup logic to make better decisions faster.
          </div>
        </Link>
      </section>

      <section
        style={{
          width: '100%',
          marginTop: '14px',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.3fr) minmax(280px, 0.9fr)',
          gap: '14px',
        }}
      >
        <div
          style={{
            ...featureCardStyle,
            position: 'relative',
            overflow: 'hidden',
            minHeight: '220px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-60px',
              right: '-80px',
              width: '220px',
              height: '220px',
              borderRadius: '999px',
              background: 'radial-gradient(circle, rgba(74,163,255,0.16) 0%, transparent 70%)',
            }}
          />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div
              style={{
                color: '#8fb8ff',
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Built for real teams
            </div>
            <div
              style={{
                marginTop: '10px',
                color: '#f8fbff',
                fontSize: isMobile ? '26px' : '32px',
                fontWeight: 900,
                lineHeight: 1.04,
                letterSpacing: '-0.04em',
                maxWidth: '560px',
              }}
            >
              Turn tennis data into better lineup decisions.
            </div>
            <div
              style={{
                marginTop: '10px',
                color: 'rgba(210,225,244,0.76)',
                fontSize: '15px',
                lineHeight: 1.7,
                maxWidth: '620px',
              }}
            >
              TenAceIQ is designed to bridge the gap between ratings, real match context, and the
              decisions captains and players actually need to make each week.
            </div>
          </div>
        </div>

        <div
          style={{
            ...featureCardStyle,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div>
            <div
              style={{
                color: '#8fb8ff',
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Current brand
            </div>

            <div
              style={{
                marginTop: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '20px',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'linear-gradient(180deg, rgba(28,51,93,0.8) 0%, rgba(12,22,41,0.92) 100%)',
                  border: '1px solid rgba(116,190,255,0.16)',
                  boxShadow: '0 16px 36px rgba(5,12,25,0.24)',
                  flexShrink: 0,
                }}
              >
                <Image
                  src="/logo-icon.png"
                  alt="TenAceIQ"
                  width={48}
                  height={48}
                  style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  minHeight: '72px',
                }}
              >
                <BrandWordmark top />
              </div>
            </div>
          </div>

          <Link
            href="/explore"
            style={{
              ...actionLinkBase,
              width: '100%',
              color: '#08111d',
              background: 'linear-gradient(135deg, #9BE11D 0%, #C7F36B 100%)',
              border: '1px solid rgba(155,225,29,0.34)',
              boxShadow: '0 16px 34px rgba(155,225,29,0.18)',
            }}
          >
            Start exploring TenAceIQ
          </Link>
        </div>
      </section>
    </section>
  )
}