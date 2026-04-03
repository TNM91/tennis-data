'use client'

import Link from 'next/link'
import {
  CSSProperties,
  ReactNode,
  useEffect,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { getUserRole, type UserRole } from '@/lib/roles'

const PRIMARY_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/matchup', label: 'Matchups' },
  { href: '/captain', label: 'Captain' },
]

const LAB_CARDS = [
  {
    href: '/my-players',
    eyebrow: 'Follow',
    title: 'My Players',
    text: 'Track followed players, rating movement, and recent performance.',
    accent: 'blue' as const,
    icon: 'player',
  },
  {
    href: '/my-teams',
    eyebrow: 'Monitor',
    title: 'My Teams',
    text: 'Keep your followed teams organized with season-specific context.',
    accent: 'green' as const,
    icon: 'team',
  },
  {
    href: '/my-leagues',
    eyebrow: 'Watch',
    title: 'My Leagues',
    text: 'Follow league movement, standings shifts, and recent activity.',
    accent: 'blue' as const,
    icon: 'league',
  },
  {
    href: '/captain',
    eyebrow: 'Plan',
    title: 'Captain',
    text: 'Jump into availability, messaging, lineups, and weekly planning.',
    accent: 'green' as const,
    icon: 'captain',
  },
]

const FEED_ITEMS = [
  {
    tag: 'Player',
    title: 'Followed player updates',
    body: 'Recent player rating changes and results will surface here once your follows are connected.',
  },
  {
    tag: 'Team',
    title: 'Team movement',
    body: 'See followed team results, recent match entries, and season snapshots in one feed.',
  },
  {
    tag: 'League',
    title: 'League changes',
    body: 'Track standings movement, active teams, and fresh results in followed leagues.',
  },
]

export default function DashboardPage() {
  const router = useRouter()
  const [screenWidth, setScreenWidth] = useState(1280)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [role, setRole] = useState<UserRole>('public')
  const [authLoading, setAuthLoading] = useState(true)

  const isTablet = screenWidth < 1080
  const isMobile = screenWidth < 820
  const isSmallMobile = screenWidth < 560

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    async function loadUser() {
      try {
        const { data } = await supabase.auth.getUser()
        const nextRole = getUserRole(data.user?.id ?? null)
        setRole(nextRole)

        if (nextRole === 'public') {
          router.replace('/login')
        }
      } finally {
        setAuthLoading(false)
      }
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextRole = getUserRole(session?.user?.id ?? null)
      setRole(nextRole)
      setAuthLoading(false)

      if (nextRole === 'public') {
        router.replace('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const dynamicHeaderInner: CSSProperties = {
    ...headerInner,
    flexDirection: isTablet ? 'column' : 'row',
    alignItems: isTablet ? 'flex-start' : 'center',
    gap: isTablet ? '16px' : '22px',
  }

  const dynamicNavStyle: CSSProperties = {
    ...navStyle,
    width: isTablet ? '100%' : 'auto',
    justifyContent: isTablet ? 'flex-start' : 'flex-end',
    flexWrap: 'wrap',
  }

  const dynamicHeroWrap: CSSProperties = {
    ...heroWrap,
    padding: isMobile ? '18px 16px 24px' : '14px 22px 28px',
  }

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isMobile ? '28px 18px 24px' : '38px 30px 28px',
  }

  const dynamicHeroContent: CSSProperties = {
    ...heroContent,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.05fr) minmax(350px, 0.95fr)',
    gap: isMobile ? '20px' : '26px',
  }

  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '34px' : isMobile ? '48px' : '62px',
    lineHeight: isMobile ? 1.04 : 0.98,
    maxWidth: '760px',
  }

  const dynamicHeroText: CSSProperties = {
    ...heroText,
    fontSize: isMobile ? '16px' : '18px',
    maxWidth: '640px',
  }

  const dynamicActionGrid: CSSProperties = {
    ...actionGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(4, minmax(220px, 1fr))',
    gap: isMobile ? '14px' : '16px',
  }

  const dynamicMetricsGrid: CSSProperties = {
    ...metricsGrid,
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
    gap: isMobile ? '12px' : '14px',
  }

  const dynamicFeedGrid: CSSProperties = {
    ...feedGrid,
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
    gap: isMobile ? '12px' : '14px',
  }

  const dynamicFooterInner: CSSProperties = {
    ...footerInner,
    padding: isMobile ? '16px 16px 14px' : '16px 20px 14px',
  }

  const dynamicFooterRow: CSSProperties = {
    ...footerRow,
    flexDirection: isTablet ? 'column' : 'row',
    alignItems: isTablet ? 'flex-start' : 'center',
    gap: isTablet ? '12px' : '18px',
  }

  const dynamicFooterLinks: CSSProperties = {
    ...footerLinks,
    justifyContent: isTablet ? 'flex-start' : 'center',
  }

  const dynamicFooterBottom: CSSProperties = {
    ...footerBottom,
    marginLeft: isTablet ? 0 : 'auto',
  }

  if (authLoading) {
    return (
      <main style={pageStyle}>
        <div style={orbOne} />
        <div style={orbTwo} />
        <div style={gridGlow} />
        <div style={topBlueWash} />
        <section style={{ ...heroWrap, padding: '40px 22px' }}>
          <div style={{ ...heroShell, padding: '28px' }}>
            <div style={loadingCard}>Loading dashboard...</div>
          </div>
        </section>
      </main>
    )
  }

  if (role === 'public') {
    return null
  }

  return (
    <main style={pageStyle}>
      <div style={orbOne} />
      <div style={orbTwo} />
      <div style={gridGlow} />
      <div style={topBlueWash} />

      <header style={headerStyle}>
        <div style={dynamicHeaderInner}>
          <Link href="/" style={brandWrap} aria-label="TenAceIQ home">
            <BrandWordmark compact={isMobile} top />
          </Link>

          <nav style={dynamicNavStyle}>
            {PRIMARY_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={navLink}
              >
                {link.label}
              </Link>
            ))}

            <Link href="/leagues" style={navLink}>
              Leagues
            </Link>

            <Link href="/dashboard" style={activeNavLink}>
              My Lab
            </Link>

            {role === 'admin' ? (
              <Link href="/admin" style={navLink}>
                Admin
              </Link>
            ) : null}

            <button type="button" onClick={handleLogout} style={navButtonReset}>
              Logout
            </button>
          </nav>
        </div>
      </header>

      <section style={dynamicHeroWrap}>
        <div style={dynamicHeroShell}>
          <div style={heroNoise} />

          <div style={dynamicHeroContent}>
            <div style={heroLeft}>
              <div style={eyebrow}>My Lab</div>

              <h1 style={dynamicHeroTitle}>
                Follow what matters and keep your season organized.
              </h1>

              <p style={dynamicHeroText}>
                My Lab is your member workspace for followed players, teams, leagues, and
                personalized recent activity across the platform.
              </p>

              <div style={explorePills}>
                <span style={pillBlue}>My Players</span>
                <span style={pillBlue}>My Teams</span>
                <span style={pillGreen}>My Leagues</span>
                <span style={pillGreen}>Captain</span>
              </div>
            </div>

            <div style={summaryPanel}>
              <div style={summaryHeader}>
                <div style={summaryLabel}>Workspace summary</div>
                <div style={summaryHint}>Member view</div>
              </div>

              <div style={dynamicMetricsGrid}>
                <div style={metricCard}>
                  <div style={metricEyebrow}>Tracked</div>
                  <div style={metricValue}>0</div>
                  <div style={metricText}>My Players</div>
                </div>
                <div style={metricCard}>
                  <div style={metricEyebrow}>Tracked</div>
                  <div style={metricValue}>0</div>
                  <div style={metricText}>My Teams</div>
                </div>
                <div style={metricCard}>
                  <div style={metricEyebrow}>Tracked</div>
                  <div style={metricValue}>0</div>
                  <div style={metricText}>My Leagues</div>
                </div>
              </div>
            </div>
          </div>

          <div style={dynamicActionGrid}>
            {LAB_CARDS.map((card) => (
              <ActionCard
                key={card.href}
                href={card.href}
                eyebrow={card.eyebrow}
                title={card.title}
                text={card.text}
                icon={getCardIcon(card.icon)}
                hovered={hoveredCard === card.href}
                onEnter={() => setHoveredCard(card.href)}
                onLeave={() => setHoveredCard(null)}
                accent={card.accent}
              />
            ))}
          </div>
        </div>
      </section>

      <section style={sectionWrap}>
        <div style={sectionInner}>
          <div style={sectionHeader}>
            <div>
              <div style={sectionEyebrow}>Recent activity</div>
              <h2 style={sectionTitle}>Feed based on your follows</h2>
            </div>
            <Link href="/captain" style={sectionCta}>
              Open Captain
            </Link>
          </div>

          <div style={dynamicFeedGrid}>
            {FEED_ITEMS.map((item) => (
              <div key={item.title} style={feedCard}>
                <div style={feedTag}>{item.tag}</div>
                <div style={feedTitle}>{item.title}</div>
                <div style={feedText}>{item.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer style={footerStyle}>
        <div style={dynamicFooterInner}>
          <div style={dynamicFooterRow}>
            <Link href="/" style={footerBrandLink}>
              <BrandWordmark compact={false} footer />
            </Link>

            <div style={dynamicFooterLinks}>
              <Link href="/dashboard" style={footerUtilityLink}>
                My Lab
              </Link>
              <Link href="/my-players" style={footerUtilityLink}>
                My Players
              </Link>
              <Link href="/my-teams" style={footerUtilityLink}>
                My Teams
              </Link>
              <Link href="/my-leagues" style={footerUtilityLink}>
                My Leagues
              </Link>
              <Link href="/captain" style={footerUtilityLink}>
                Captain
              </Link>
            </div>

            <div style={dynamicFooterBottom}>© {new Date().getFullYear()} TenAceIQ</div>
          </div>
        </div>
      </footer>
    </main>
  )
}

function getCardIcon(icon: string) {
  if (icon === 'player') return <PlayerIcon />
  if (icon === 'team') return <TeamIcon />
  if (icon === 'league') return <LeagueIcon />
  return <CaptainIcon />
}

function ActionCard({
  href,
  eyebrow,
  title,
  text,
  icon,
  hovered,
  onEnter,
  onLeave,
  accent = 'blue',
}: {
  href: string
  eyebrow?: string
  title: string
  text: string
  icon: ReactNode
  hovered: boolean
  onEnter: () => void
  onLeave: () => void
  accent?: 'blue' | 'green'
}) {
  const iconStyle = accent === 'green' ? actionCardIconGreen : actionCardIconBlue
  const ctaStyle = accent === 'green' ? actionFooterCtaGreen : actionFooterCtaBlue

  return (
    <Link
      href={href}
      style={{
        ...actionCard,
        ...(hovered ? actionCardHover : {}),
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div style={actionCardTop}>
        <div
          style={{
            ...actionCardIcon,
            ...iconStyle,
            ...(hovered ? actionCardIconHover : {}),
          }}
        >
          {icon}
        </div>
      </div>

      <div style={actionBody}>
        {eyebrow ? <div style={actionEyebrow}>{eyebrow}</div> : null}
        <div style={actionTitle}>{title}</div>
        <div style={actionText}>{text}</div>
      </div>

      <div style={actionFooterRow}>
        <span style={ctaStyle}>Open</span>
        <span style={actionFooterArrow}>→</span>
      </div>
    </Link>
  )
}

function BrandWordmark({
  compact = false,
  footer = false,
  top = false,
}: {
  compact?: boolean
  footer?: boolean
  top?: boolean
}) {
  const iconSize = compact ? 34 : top ? 46 : footer ? 38 : 36
  const fontSize = compact ? 27 : top ? 34 : footer ? 29 : 29

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? '10px' : '12px',
        lineHeight: 1,
      }}
    >
      <span
        style={{
          width: `${iconSize}px`,
          height: `${iconSize}px`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '999px',
          background:
            'radial-gradient(circle at 30% 30%, rgba(155,225,29,0.28), rgba(74,163,255,0.18) 55%, rgba(74,163,255,0.04) 100%)',
          boxShadow: '0 0 28px rgba(116,190,255,0.18)',
          overflow: 'hidden',
        }}
      >
        <TennisPulseIcon />
      </span>

      <div
        style={{
          fontWeight: 900,
          letterSpacing: '-0.045em',
          fontSize: `${fontSize}px`,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'baseline',
        }}
      >
        <span style={{ color: footer ? '#FFFFFF' : '#F8FBFF' }}>TenAce</span>
        <span style={heroIQ}>IQ</span>
      </div>
    </div>
  )
}

function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" style={iconSvgStyle} aria-hidden="true">
      {children}
    </svg>
  )
}

function PlayerIcon() {
  return (
    <IconBase>
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M6.5 19c1.3-3.1 3.4-4.7 5.5-4.7S16.2 15.9 17.5 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </IconBase>
  )
}

function TeamIcon() {
  return (
    <IconBase>
      <circle cx="9" cy="9" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.5" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4.8 19c.9-2.5 2.6-3.9 4.2-3.9 1.7 0 3.3 1.4 4.2 3.9M13.8 18.8c.7-1.9 1.9-2.9 3.3-2.9 1.2 0 2.3.8 3.1 2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </IconBase>
  )
}

function LeagueIcon() {
  return (
    <IconBase>
      <path
        d="M5 12a7 7 0 0 0 14 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 5a7 7 0 0 0-7 7M12 5a7 7 0 0 1 7 7M12 5v14M7.5 8.2h9M6.8 15.8h10.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </IconBase>
  )
}

function CaptainIcon() {
  return (
    <IconBase>
      <path
        d="M7 18v-7.5c0-1.2.8-2 2-2h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M17.5 5.5l2 2-4.8 4.8-2.8.7.7-2.8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 18.5h11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </IconBase>
  )
}

function TennisPulseIcon() {
  return (
    <svg viewBox="0 0 32 32" style={{ width: '82%', height: '82%', display: 'block' }} aria-hidden="true">
      <path
        d="M11 6.5c1.9 0 3.7.5 5.2 1.4M7.7 9.2c-1.8 2-2.9 4.6-2.9 7.5M7.7 23c-1.8-2-2.9-4.6-2.9-7.5M11 25.7c1.9 0 3.7-.5 5.2-1.4"
        fill="none"
        stroke="#C8F36B"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="22" cy="16" r="5.2" fill="none" stroke="#EAF4FF" strokeWidth="1.8" />
      <path
        d="M0 16h6.3l2-4.2 2.2 8 2.1-5 1.6 1.2h3"
        fill="none"
        stroke="#74BEFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  position: 'relative',
  overflow: 'hidden',
  background: `
    radial-gradient(circle at 14% 2%, rgba(120, 190, 255, 0.22) 0%, rgba(120, 190, 255, 0) 24%),
    radial-gradient(circle at 82% 10%, rgba(88, 170, 255, 0.18) 0%, rgba(88, 170, 255, 0) 26%),
    radial-gradient(circle at 50% -8%, rgba(150, 210, 255, 0.14) 0%, rgba(150, 210, 255, 0) 28%),
    linear-gradient(180deg, #0b1830 0%, #102347 34%, #0f2243 68%, #0c1a33 100%)
  `,
}

const orbOne: CSSProperties = {
  position: 'absolute',
  top: '-120px',
  left: '-140px',
  width: '420px',
  height: '420px',
  borderRadius: '999px',
  background:
    'radial-gradient(circle, rgba(116,190,255,0.28) 0%, rgba(116,190,255,0.12) 40%, rgba(116,190,255,0) 74%)',
  filter: 'blur(8px)',
  pointerEvents: 'none',
}

const orbTwo: CSSProperties = {
  position: 'absolute',
  right: '-140px',
  top: '140px',
  width: '420px',
  height: '420px',
  borderRadius: '999px',
  background:
    'radial-gradient(circle, rgba(155,225,29,0.13) 0%, rgba(155,225,29,0.05) 36%, rgba(155,225,29,0) 72%)',
  filter: 'blur(8px)',
  pointerEvents: 'none',
}

const gridGlow: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.024) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.024) 1px, transparent 1px)',
  backgroundRepeat: 'repeat, repeat',
  backgroundSize: '34px 34px, 34px 34px',
  maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.55), transparent 88%)',
  pointerEvents: 'none',
}

const topBlueWash: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: '420px',
  background:
    'linear-gradient(180deg, rgba(114,186,255,0.10) 0%, rgba(114,186,255,0.05) 38%, rgba(114,186,255,0) 100%)',
  pointerEvents: 'none',
}

const headerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  padding: '18px 24px 0',
}

const headerInner: CSSProperties = {
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  display: 'flex',
  justifyContent: 'space-between',
}

const brandWrap: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  textDecoration: 'none',
}

const navStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
}

const navLink: CSSProperties = {
  color: 'rgba(238,247,255,0.94)',
  textDecoration: 'none',
  fontSize: '15px',
  fontWeight: 800,
  letterSpacing: '0.01em',
  padding: '12px 18px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.22)',
  background: 'linear-gradient(180deg, rgba(58,115,212,0.22) 0%, rgba(27,62,120,0.18) 100%)',
  backdropFilter: 'blur(14px)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
  transition: 'all 180ms ease',
}

const ctaNavLink: CSSProperties = {
  ...navLink,
  color: '#08111d',
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
  border: '1px solid rgba(155,225,29,0.34)',
  boxShadow: '0 10px 28px rgba(155,225,29,0.18)',
}

const navButtonReset: CSSProperties = {
  ...navLink,
  cursor: 'pointer',
  appearance: 'none',
}

const activeNavLink: CSSProperties = {
  color: '#08111d',
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
  border: '1px solid rgba(155,225,29,0.34)',
  boxShadow: '0 10px 28px rgba(155,225,29,0.18)',
}

const heroWrap: CSSProperties = {
  position: 'relative',
  zIndex: 1,
}

const heroShell: CSSProperties = {
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  borderRadius: '30px',
  background: `
    linear-gradient(180deg, rgba(26, 54, 104, 0.52) 0%, rgba(17, 36, 72, 0.72) 22%, rgba(12, 27, 52, 0.82) 100%)
  `,
  border: '1px solid rgba(116,190,255,0.22)',
  boxShadow:
    '0 26px 80px rgba(7,18,42,0.24), inset 0 1px 0 rgba(255,255,255,0.07), inset 0 0 80px rgba(88,170,255,0.06)',
  overflow: 'hidden',
  position: 'relative',
}

const heroNoise: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: `
    radial-gradient(circle at 12% 0%, rgba(116,190,255,0.26), transparent 28%),
    radial-gradient(circle at 72% 8%, rgba(88,170,255,0.18), transparent 24%),
    radial-gradient(circle at 100% 0%, rgba(155,225,29,0.10), transparent 26%),
    linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 26%)
  `,
  pointerEvents: 'none',
}

const heroContent: CSSProperties = {
  display: 'grid',
  alignItems: 'stretch',
  marginBottom: '20px',
  position: 'relative',
  zIndex: 1,
}

const heroLeft: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: '18px',
}

const heroRight: CSSProperties = {
  display: 'grid',
  gap: '16px',
  alignContent: 'start',
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  alignItems: 'center',
  padding: '8px 14px',
  borderRadius: '999px',
  color: '#d6e9ff',
  background: 'rgba(37,91,227,0.18)',
  border: '1px solid rgba(116,190,255,0.22)',
  fontSize: '12px',
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const heroTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontWeight: 900,
  letterSpacing: '-0.05em',
}

const heroText: CSSProperties = {
  margin: 0,
  color: 'rgba(224,236,249,0.86)',
  lineHeight: 1.7,
  fontWeight: 500,
}

const heroIQ: CSSProperties = {
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  marginLeft: '2px',
}

const explorePills: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '4px',
}

const pillBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '32px',
  padding: '0 12px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.04em',
}

const pillBlue: CSSProperties = {
  ...pillBase,
  color: '#dcebff',
  background: 'rgba(37,91,227,0.16)',
  border: '1px solid rgba(74,163,255,0.18)',
}

const pillGreen: CSSProperties = {
  ...pillBase,
  color: '#e7ffd0',
  background: 'rgba(155,225,29,0.14)',
  border: '1px solid rgba(155,225,29,0.24)',
}

const summaryPanel: CSSProperties = {
  borderRadius: '24px',
  background:
    'linear-gradient(180deg, rgba(68, 132, 229, 0.20) 0%, rgba(40, 83, 158, 0.18) 28%, rgba(16, 36, 70, 0.72) 100%)',
  border: '1px solid rgba(116,190,255,0.24)',
  boxShadow:
    '0 18px 44px rgba(9,25,54,0.16), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 40px rgba(116,190,255,0.05)',
  padding: '20px',
}

const summaryHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '14px',
}

const summaryLabel: CSSProperties = {
  color: '#f6fbff',
  fontSize: '16px',
  fontWeight: 800,
  letterSpacing: '-0.02em',
}

const summaryHint: CSSProperties = {
  color: 'rgba(204,220,241,0.76)',
  fontSize: '13px',
  fontWeight: 700,
}

const metricsGrid: CSSProperties = {
  display: 'grid',
}

const metricCard: CSSProperties = {
  borderRadius: '20px',
  padding: '18px 16px',
  background: 'linear-gradient(180deg, rgba(22,46,88,0.74) 0%, rgba(13,27,52,0.84) 100%)',
  border: '1px solid rgba(116,190,255,0.16)',
  minHeight: '132px',
}

const metricEyebrow: CSSProperties = {
  color: 'rgba(188,208,232,0.8)',
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
}

const metricValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: '34px',
  lineHeight: 1,
  fontWeight: 900,
  marginTop: '8px',
}

const metricText: CSSProperties = {
  color: 'rgba(224,236,249,0.78)',
  fontSize: '14px',
  marginTop: '8px',
  fontWeight: 600,
}

const sectionWrap: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  padding: '0 22px 28px',
}

const sectionInner: CSSProperties = {
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  borderRadius: '28px',
  padding: '24px',
  background:
    'linear-gradient(180deg, rgba(20, 42, 80, 0.42) 0%, rgba(11, 23, 44, 0.76) 100%)',
  border: '1px solid rgba(116,190,255,0.16)',
  boxShadow: '0 20px 48px rgba(7,18,40,0.18)',
}

const sectionHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  gap: '16px',
  marginBottom: '18px',
  flexWrap: 'wrap',
}

const sectionEyebrow: CSSProperties = {
  color: 'rgba(188,208,232,0.8)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
  marginBottom: '8px',
}

const sectionTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontSize: '32px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const sectionCta: CSSProperties = {
  textDecoration: 'none',
  color: '#08111d',
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
  border: '1px solid rgba(155,225,29,0.34)',
  boxShadow: '0 10px 28px rgba(155,225,29,0.18)',
  borderRadius: '999px',
  padding: '12px 18px',
  fontSize: '14px',
  fontWeight: 800,
}

const feedGrid: CSSProperties = {
  display: 'grid',
}

const feedCard: CSSProperties = {
  borderRadius: '20px',
  padding: '16px 15px',
  background: 'linear-gradient(180deg, rgba(22,46,88,0.74) 0%, rgba(13,27,52,0.84) 100%)',
  border: '1px solid rgba(116,190,255,0.16)',
  minHeight: '150px',
}

const feedTag: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  marginBottom: '10px',
  color: '#e7ffd0',
  background: 'rgba(155,225,29,0.14)',
  border: '1px solid rgba(155,225,29,0.24)',
  borderRadius: '999px',
  padding: '5px 10px',
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const feedTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '18px',
  fontWeight: 800,
  letterSpacing: '-0.02em',
  marginBottom: '8px',
}

const feedText: CSSProperties = {
  color: 'rgba(224,236,249,0.78)',
  fontSize: '14px',
  lineHeight: 1.65,
}

const actionGrid: CSSProperties = {
  display: 'grid',
  position: 'relative',
  zIndex: 1,
}

const actionCard: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: '18px',
  minHeight: '220px',
  borderRadius: '24px',
  padding: '22px',
  textDecoration: 'none',
  color: '#eff6ff',
  background:
    'linear-gradient(180deg, rgba(26,48,90,0.88) 0%, rgba(15,30,57,0.94) 100%)',
  border: '1px solid rgba(116,190,255,0.16)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.18), inset 0 1px 0 rgba(255,255,255,0.03)',
  transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
}

const actionCardHover: CSSProperties = {
  transform: 'translateY(-4px)',
  border: '1px solid rgba(116,190,255,0.30)',
  boxShadow: '0 22px 52px rgba(7,18,40,0.26), inset 0 0 32px rgba(116,190,255,0.05)',
}

const actionCardTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
}

const actionCardIcon: CSSProperties = {
  width: '58px',
  height: '58px',
  borderRadius: '18px',
  display: 'grid',
  placeItems: 'center',
  transition: 'transform 180ms ease',
}

const actionCardIconBlue: CSSProperties = {
  background: 'rgba(37,91,227,0.16)',
  color: '#cfe4ff',
}

const actionCardIconGreen: CSSProperties = {
  background: 'rgba(155,225,29,0.14)',
  color: '#efffd5',
}

const actionCardIconHover: CSSProperties = {
  transform: 'scale(1.04)',
}

const actionBody: CSSProperties = {
  display: 'grid',
  gap: '10px',
}

const actionEyebrow: CSSProperties = {
  color: 'rgba(188,208,232,0.8)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
}

const actionTitle: CSSProperties = {
  fontSize: '27px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
  color: '#f8fbff',
}

const actionText: CSSProperties = {
  fontSize: '14px',
  lineHeight: 1.7,
  color: 'rgba(215,229,247,0.78)',
}

const actionFooterRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 'auto',
}

const actionFooterCtaBlue: CSSProperties = {
  color: '#d5e8ff',
  fontSize: '13px',
  fontWeight: 800,
}

const actionFooterCtaGreen: CSSProperties = {
  color: '#e7ffd0',
  fontSize: '13px',
  fontWeight: 800,
}

const actionFooterArrow: CSSProperties = {
  color: 'rgba(216,230,246,0.78)',
  fontSize: '18px',
  fontWeight: 800,
}

const loadingCard: CSSProperties = {
  borderRadius: '22px',
  padding: '18px 20px',
  color: '#eaf4ff',
  background: 'linear-gradient(180deg, rgba(24,49,93,0.68) 0%, rgba(13,26,50,0.92) 100%)',
  border: '1px solid rgba(116,190,255,0.18)',
  fontSize: '15px',
  fontWeight: 700,
}

const iconSvgStyle: CSSProperties = {
  width: '24px',
  height: '24px',
  display: 'block',
}

const footerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  marginTop: '26px',
  padding: '0 18px 24px',
}

const footerInner: CSSProperties = {
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  borderRadius: '24px',
  background:
    'linear-gradient(180deg, rgba(21,42,80,0.54) 0%, rgba(12,24,46,0.88) 100%)',
  border: '1px solid rgba(116,190,255,0.12)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
}

const footerRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '18px',
}

const footerBrandLink: CSSProperties = {
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
}

const footerLinks: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px 14px',
}

const footerUtilityLink: CSSProperties = {
  color: 'rgba(215,229,247,0.8)',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 700,
}

const footerBottom: CSSProperties = {
  color: 'rgba(197,213,234,0.72)',
  fontSize: '13px',
  fontWeight: 700,
}
