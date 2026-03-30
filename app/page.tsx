'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

type PlayerSearchRow = {
  id: string
  name: string
}

export default function HomePage() {
  const router = useRouter()

  const [playerSearch, setPlayerSearch] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')

  async function handlePlayerSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const query = playerSearch.trim()
    if (!query || searchLoading) return

    setSearchLoading(true)
    setSearchError('')

    try {
      const normalized = query.replace(/\s+/g, ' ').trim()

      const { data, error } = await supabase
        .from('players')
        .select('id, name')
        .ilike('name', `%${normalized}%`)
        .order('name', { ascending: true })
        .limit(25)

      if (error) {
        throw new Error(error.message)
      }

      const results = (data || []) as PlayerSearchRow[]

      if (!results.length) {
        setSearchError('No matching player found.')
        return
      }

      const lowered = normalized.toLowerCase()

      const ranked = [...results].sort((a, b) => {
        const aName = a.name.toLowerCase()
        const bName = b.name.toLowerCase()

        const aExact = aName === lowered ? 0 : 1
        const bExact = bName === lowered ? 0 : 1
        if (aExact !== bExact) return aExact - bExact

        const aStarts = aName.startsWith(lowered) ? 0 : 1
        const bStarts = bName.startsWith(lowered) ? 0 : 1
        if (aStarts !== bStarts) return aStarts - bStarts

        const aWord = aName.split(' ').includes(lowered) ? 0 : 1
        const bWord = bName.split(' ').includes(lowered) ? 0 : 1
        if (aWord !== bWord) return aWord - bWord

        return aName.length - bName.length
      })

      router.push(`/player/${ranked[0].id}`)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed.')
    } finally {
      setSearchLoading(false)
    }
  }

  return (
    <main style={pageStyle}>
      <div style={orbOne} />
      <div style={orbTwo} />
      <div style={gridGlow} />

      <header style={headerStyle}>
        <div style={headerInner}>
          <Link href="/" style={brandWrap} aria-label="TenAceIQ home">
            <LogoWordmark />
          </Link>

          <nav style={navStyle}>
            <Link href="/" style={navLink}>Home</Link>
            <Link href="/rankings" style={navLink}>Players</Link>
            <Link href="/rankings" style={navLink}>Rankings</Link>
            <Link href="/matchup" style={navLink}>Matchup</Link>
            <Link href="/leagues" style={navLink}>Leagues</Link>
            <Link href="/captains-corner" style={navLink}>Captain&apos;s Corner</Link>
            <Link href="/admin" style={navLink}>Admin</Link>
          </nav>
        </div>
      </header>

      <section style={heroSection}>
        <div style={heroShell}>
          <div style={heroNoise} />

          <div style={heroContent}>
            <div style={heroLeft}>
              <div style={eyebrow}>Know More. Plan Better. Compete Smarter.</div>

              <h1 style={heroTitle}>
                The one-stop tennis
                <br />
                intelligence platform
                <br />
                for players and captains.
              </h1>

              <p style={heroText}>
                TenAceIQ brings player insight, rankings, matchup analysis, league context,
                and captain tools into one clean platform built to help you make smarter
                tennis decisions before match day.
              </p>

              <form onSubmit={handlePlayerSearch} style={searchShell}>
                <div style={searchLabel}>Start with a player</div>

                <div style={searchRow}>
                  <div style={searchInputWrap}>
                    <div style={searchIconWrap}>
                      <SearchIcon />
                    </div>

                    <input
                      type="text"
                      value={playerSearch}
                      onChange={(e) => setPlayerSearch(e.target.value)}
                      placeholder="Search player name..."
                      style={searchInput}
                      aria-label="Search player name"
                    />
                  </div>

                  <button type="submit" style={searchButton} disabled={searchLoading}>
                    {searchLoading ? 'Searching...' : 'Search'}
                  </button>
                </div>

                <div style={searchHelperText}>
                  Search ratings, results, and recent player performance from one place.
                </div>

                {searchError ? <div style={searchErrorStyle}>{searchError}</div> : null}
              </form>

              <div style={heroButtons}>
                <Link href="/rankings" style={primaryButton}>Explore Rankings</Link>
                <Link href="/captains-corner" style={secondaryButton}>Captain&apos;s Corner</Link>
              </div>

              <div style={heroMetaRow}>
                <div style={heroMetaCard}>
                  <div style={heroMetaLabel}>Player Intelligence</div>
                  <div style={heroMetaText}>
                    Ratings, rankings, results, and trends in one place.
                  </div>
                </div>

                <div style={heroMetaCard}>
                  <div style={heroMetaLabel}>Captain Advantage</div>
                  <div style={heroMetaText}>
                    Matchup prep, lineup tools, and smarter team decisions.
                  </div>
                </div>
              </div>
            </div>

            <div style={heroRight}>
              <div style={logoStage}>
                <div style={logoGlow} />
                <div style={logoRing} />

                <div style={logoCard}>
                  <div style={logoCardInner}>
                    <img src="/logo-dark.png" style={heroLogo} alt="TenAceIQ logo" />
                  </div>
                </div>

                <div style={floatingTop}>
                  <div style={floatingKicker}>Matchup insight</div>
                  <div style={floatingText}>See the edge before first serve</div>
                </div>

                <div style={floatingBottom}>
                  <div style={floatingKicker}>Captain tools</div>
                  <div style={floatingText}>Plan smarter lines and scenarios</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={proofSection}>
        <div style={proofStrip}>
          <div style={proofItem}>
            <div style={proofIconShell}><PlayersIcon /></div>
            <div>
              <div style={proofTitle}>Player Ratings</div>
              <div style={proofText}>Know more about every player</div>
            </div>
          </div>

          <div style={proofItem}>
            <div style={proofIconShell}><MatchupIcon /></div>
            <div>
              <div style={proofTitle}>Matchup Analysis</div>
              <div style={proofText}>Compare opponents faster</div>
            </div>
          </div>

          <div style={proofItem}>
            <div style={proofIconShell}><LeaguesIcon /></div>
            <div>
              <div style={proofTitle}>League Context</div>
              <div style={proofText}>Track your team and competition</div>
            </div>
          </div>

          <div style={proofItem}>
            <div style={proofIconShell}><CaptainIcon /></div>
            <div>
              <div style={proofTitle}>Captain Tools</div>
              <div style={proofText}>Plan better before match day</div>
            </div>
          </div>
        </div>
      </section>

      <section style={featureSection}>
        <div style={featureHeader}>
          <div style={featureEyebrow}>Platform Overview</div>
          <h2 style={featureTitle}>
            Everything important for your game, your team, and your next lineup.
          </h2>
          <p style={featureText}>
            TenAceIQ is designed to be the home base for tennis data, preparation,
            and decision-making without forcing you to jump between disconnected tools.
          </p>
        </div>

        <div style={featureGrid}>
          <Link href="/rankings" style={featureCard}>
            <div style={featureCardTop}>
              <div style={featureIconShell}><PlayersIcon /></div>
              <div style={featureArrow}>→</div>
            </div>
            <div style={featureCardTitle}>Players</div>
            <div style={featureCardText}>
              Search profiles, ratings, and recent performance to understand the field faster.
            </div>
          </Link>

          <Link href="/rankings" style={featureCard}>
            <div style={featureCardTop}>
              <div style={featureIconShell}><RankingsIcon /></div>
              <div style={featureArrow}>→</div>
            </div>
            <div style={featureCardTitle}>Rankings</div>
            <div style={featureCardText}>
              See how players stack up across overall, singles, and doubles performance.
            </div>
          </Link>

          <Link href="/matchup" style={featureCard}>
            <div style={featureCardTop}>
              <div style={featureIconShell}><MatchupIcon /></div>
              <div style={featureArrow}>→</div>
            </div>
            <div style={featureCardTitle}>Matchup</div>
            <div style={featureCardText}>
              Compare players side by side and uncover advantages before match day.
            </div>
          </Link>

          <Link href="/leagues" style={featureCard}>
            <div style={featureCardTop}>
              <div style={featureIconShell}><LeaguesIcon /></div>
              <div style={featureArrow}>→</div>
            </div>
            <div style={featureCardTitle}>Leagues</div>
            <div style={featureCardText}>
              Follow standings, team context, and league structure in one organized view.
            </div>
          </Link>

          <Link href="/captains-corner" style={featureCard}>
            <div style={featureCardTop}>
              <div style={featureIconShell}><CaptainIcon /></div>
              <div style={featureArrow}>→</div>
            </div>
            <div style={featureCardTitle}>Captain&apos;s Corner</div>
            <div style={featureCardText}>
              Build smarter lineups, compare scenarios, and prepare with more confidence.
            </div>
          </Link>

          <div style={featureCardStatic}>
            <div style={featureCardTop}>
              <div style={featureIconShell}><PlatformIcon /></div>
            </div>
            <div style={featureCardTitle}>One Platform</div>
            <div style={featureCardText}>
              One place for player data, team insight, league context, and captain preparation.
            </div>
          </div>
        </div>
      </section>

      <section style={messageStripSection}>
        <div style={messageStrip}>
          <div style={messageStripLeft}>
            <div style={messageStripKicker}>Core Theme</div>
            <div style={messageStripText}>Know more. Plan better. Compete smarter.</div>
          </div>

          <div style={messageStripRight}>
            <span style={messagePill}>Players</span>
            <span style={messagePill}>Teams</span>
            <span style={messagePill}>Leagues</span>
            <span style={messagePill}>Captains</span>
          </div>
        </div>
      </section>

      <section style={ctaSection}>
        <div style={ctaCard}>
          <div>
            <div style={ctaEyebrow}>Start Here</div>
            <h3 style={ctaTitle}>
              Smarter player data. Better team planning. Stronger match-day decisions.
            </h3>
          </div>

          <div style={ctaButtons}>
            <Link href="/rankings" style={ctaPrimary}>Find a Player</Link>
            <Link href="/matchup" style={ctaSecondary}>Compare Matchups</Link>
          </div>
        </div>
      </section>

      <footer style={footerStyle}>
        <div style={footerInner}>
          <div style={footerBrandRow}>
            <LogoWordmark darkText={false} />
          </div>

          <div style={footerTagline}>
            Know more. Plan better. Compete smarter.
          </div>

          <div style={footerBottom}>
            © {new Date().getFullYear()} TenAceIQ
          </div>
        </div>
      </footer>
    </main>
  )
}

/* ================= LOGO ================= */

function LogoWordmark({ darkText = false }: { darkText?: boolean }) {
  return (
    <div style={logoWordmarkWrap}>
      <img
        src="/logo-icon.png"
        alt="TenAceIQ icon"
        style={logoWordmarkIcon}
      />

      <div style={logoWordmarkText}>
        <span style={{ color: darkText ? '#071B4D' : '#FFFFFF' }}>TenAce</span>
        <span style={logoWordmarkIQ}>IQ</span>
      </div>
    </div>
  )
}

/* ================= ICONS ================= */

function IconBase({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" style={svgStyle} aria-hidden="true">
      {children}
    </svg>
  )
}

function SearchIcon() {
  return (
    <IconBase>
      <circle
        cx="11"
        cy="11"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M16 16l3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </IconBase>
  )
}

function PlayersIcon() {
  return (
    <IconBase>
      <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16" cy="9" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.5 18c.7-2.6 2.6-4 5.5-4s4.8 1.4 5.5 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14.5 18c.5-1.8 1.8-2.8 3.9-3.1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconBase>
  )
}

function RankingsIcon() {
  return (
    <IconBase>
      <path d="M6 18V11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 18V7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18 18V4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 20h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconBase>
  )
}

function MatchupIcon() {
  return (
    <IconBase>
      <path d="M7 7h4v4H7z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M13 13h4v4h-4z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M11 9h2c1.7 0 3 1.3 3 3v1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 11V9c0-1.7 1.3-3 3-3h1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconBase>
  )
}

function LeaguesIcon() {
  return (
    <IconBase>
      <path d="M12 4l2.1 4.2L19 9l-3.5 3.3.8 4.7-4.3-2.2-4.3 2.2.8-4.7L5 9l4.9-.8L12 4z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </IconBase>
  )
}

function CaptainIcon() {
  return (
    <IconBase>
      <rect x="5" y="5" width="14" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 9h6M9 12h6M9 15h3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconBase>
  )
}

function PlatformIcon() {
  return (
    <IconBase>
      <rect x="4" y="5" width="16" height="4" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="4" y="11" width="7" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13" y="11" width="7" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </IconBase>
  )
}

/* ================= PAGE ================= */

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background:
    'linear-gradient(180deg, #07152F 0%, #091C42 28%, #EFF5FB 28%, #F7FAFD 100%)',
  fontFamily: 'Arial, sans-serif',
  position: 'relative',
  overflow: 'hidden',
}

const orbOne: React.CSSProperties = {
  position: 'absolute',
  top: '-80px',
  left: '-80px',
  width: '320px',
  height: '320px',
  borderRadius: '50%',
  background: 'rgba(76,199,199,0.16)',
  filter: 'blur(70px)',
  pointerEvents: 'none',
}

const orbTwo: React.CSSProperties = {
  position: 'absolute',
  top: '340px',
  right: '-90px',
  width: '340px',
  height: '340px',
  borderRadius: '50%',
  background: 'rgba(155,225,29,0.12)',
  filter: 'blur(75px)',
  pointerEvents: 'none',
}

const gridGlow: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
  backgroundSize: '42px 42px',
  pointerEvents: 'none',
  opacity: 0.5,
}

/* ================= HEADER ================= */

const headerStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 20,
  background: 'rgba(7, 21, 47, 0.72)',
  backdropFilter: 'blur(16px)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
}

const headerInner: React.CSSProperties = {
  maxWidth: '1240px',
  margin: '0 auto',
  padding: '18px 20px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '20px',
  flexWrap: 'wrap',
}

const brandWrap: React.CSSProperties = {
  textDecoration: 'none',
}

const navStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  alignItems: 'center',
}

const navLink: React.CSSProperties = {
  color: '#D9E7FF',
  textDecoration: 'none',
  fontWeight: 700,
  padding: '10px 14px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.04)',
}

/* ================= WORDMARK ================= */

const logoWordmarkWrap: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
}

const logoWordmarkIcon: React.CSSProperties = {
  width: '38px',
  height: '38px',
  borderRadius: '10px',
  display: 'block',
}

const logoWordmarkText: React.CSSProperties = {
  fontWeight: 900,
  fontSize: '30px',
  display: 'flex',
  alignItems: 'baseline',
  letterSpacing: '-0.03em',
  lineHeight: 1,
}

const logoWordmarkIQ: React.CSSProperties = {
  background: 'linear-gradient(90deg, #4CC7C7, #9BE11D)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  marginLeft: '2px',
}

/* ================= HERO ================= */

const heroSection: React.CSSProperties = {
  maxWidth: '1240px',
  margin: '0 auto',
  padding: '36px 20px 22px',
  position: 'relative',
  zIndex: 1,
}

const heroShell: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: '34px',
  background: 'linear-gradient(135deg, rgba(8,28,71,0.98), rgba(12,79,170,0.92))',
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: '0 26px 80px rgba(3,10,30,0.30)',
}

const heroNoise: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.10), transparent 24%), radial-gradient(circle at 80% 30%, rgba(255,255,255,0.08), transparent 20%), radial-gradient(circle at 70% 80%, rgba(155,225,29,0.12), transparent 22%)',
  pointerEvents: 'none',
}

const heroContent: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.08fr 0.92fr',
  gap: '24px',
  alignItems: 'stretch',
  position: 'relative',
  zIndex: 1,
}

const heroLeft: React.CSSProperties = {
  padding: '60px 50px',
  color: '#FFFFFF',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
}

const eyebrow: React.CSSProperties = {
  display: 'inline-flex',
  alignSelf: 'flex-start',
  padding: '8px 14px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.14)',
  color: '#E4F5FF',
  fontWeight: 800,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const heroTitle: React.CSSProperties = {
  margin: '20px 0 0',
  fontSize: '60px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.05em',
}

const heroText: React.CSSProperties = {
  marginTop: '18px',
  color: '#D9E7FF',
  fontSize: '18px',
  lineHeight: 1.75,
  maxWidth: '620px',
}

/* ================= HERO SEARCH ================= */

const searchShell: React.CSSProperties = {
  marginTop: '28px',
  padding: '18px',
  borderRadius: '22px',
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.14)',
  backdropFilter: 'blur(8px)',
  maxWidth: '640px',
}

const searchLabel: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 900,
  color: '#FFFFFF',
  marginBottom: '12px',
}

const searchRow: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  alignItems: 'stretch',
  flexWrap: 'wrap',
}

const searchInputWrap: React.CSSProperties = {
  flex: '1 1 320px',
  minWidth: '260px',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  background: 'rgba(255,255,255,0.96)',
  borderRadius: '16px',
  padding: '0 14px',
  minHeight: '56px',
  boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
}

const searchIconWrap: React.CSSProperties = {
  color: '#0C3E8B',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const searchInput: React.CSSProperties = {
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontSize: '16px',
  color: '#071B4D',
  width: '100%',
  fontWeight: 600,
}

const searchButton: React.CSSProperties = {
  minHeight: '56px',
  padding: '0 20px',
  borderRadius: '16px',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 900,
  fontSize: '15px',
  color: '#07152F',
  background: 'linear-gradient(90deg, #4CC7C7, #9BE11D)',
  boxShadow: '0 14px 28px rgba(0,0,0,0.18)',
}

const searchHelperText: React.CSSProperties = {
  marginTop: '10px',
  color: '#D6E6FF',
  fontSize: '13px',
  lineHeight: 1.6,
}

const searchErrorStyle: React.CSSProperties = {
  marginTop: '10px',
  color: '#FECACA',
  fontSize: '13px',
  fontWeight: 700,
}

/* ================= HERO ACTIONS ================= */

const heroButtons: React.CSSProperties = {
  marginTop: '24px',
  display: 'flex',
  gap: '14px',
  flexWrap: 'wrap',
}

const primaryButton: React.CSSProperties = {
  background: 'linear-gradient(90deg, #4CC7C7, #9BE11D)',
  color: '#07152F',
  padding: '15px 22px',
  borderRadius: '14px',
  fontWeight: 900,
  textDecoration: 'none',
  boxShadow: '0 16px 32px rgba(0,0,0,0.18)',
}

const secondaryButton: React.CSSProperties = {
  background: 'rgba(255,255,255,0.10)',
  color: '#FFFFFF',
  padding: '15px 22px',
  borderRadius: '14px',
  fontWeight: 800,
  textDecoration: 'none',
  border: '1px solid rgba(255,255,255,0.16)',
}

const heroMetaRow: React.CSSProperties = {
  marginTop: '30px',
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '14px',
}

const heroMetaCard: React.CSSProperties = {
  padding: '18px',
  borderRadius: '18px',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.12)',
  backdropFilter: 'blur(8px)',
}

const heroMetaLabel: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 900,
  color: '#FFFFFF',
}

const heroMetaText: React.CSSProperties = {
  marginTop: '8px',
  fontSize: '14px',
  lineHeight: 1.6,
  color: '#D6E6FF',
}

const heroRight: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '38px',
}

const logoStage: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  minHeight: '470px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const logoGlow: React.CSSProperties = {
  position: 'absolute',
  width: '340px',
  height: '340px',
  borderRadius: '50%',
  background:
    'radial-gradient(circle, rgba(155,225,29,0.28) 0%, rgba(76,199,199,0.22) 42%, transparent 72%)',
  filter: 'blur(28px)',
}

const logoRing: React.CSSProperties = {
  position: 'absolute',
  width: '430px',
  height: '430px',
  borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03)',
}

const logoCard: React.CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: '100%',
  maxWidth: '440px',
  padding: '18px',
  borderRadius: '32px',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.07))',
  border: '1px solid rgba(255,255,255,0.16)',
  boxShadow: '0 24px 60px rgba(0,0,0,0.24)',
}

const logoCardInner: React.CSSProperties = {
  borderRadius: '24px',
  minHeight: '290px',
  background: 'linear-gradient(180deg, #091A3D 0%, #102758 100%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '34px 24px',
}

const heroLogo: React.CSSProperties = {
  width: '100%',
  maxWidth: '310px',
  objectFit: 'contain',
}

const floatingTop: React.CSSProperties = {
  position: 'absolute',
  top: '34px',
  right: '6px',
  zIndex: 3,
  background: 'rgba(255,255,255,0.96)',
  padding: '14px 16px',
  borderRadius: '18px',
  boxShadow: '0 12px 30px rgba(0,0,0,0.16)',
  maxWidth: '210px',
}

const floatingBottom: React.CSSProperties = {
  position: 'absolute',
  bottom: '28px',
  left: '0px',
  zIndex: 3,
  background: 'rgba(255,255,255,0.96)',
  padding: '14px 16px',
  borderRadius: '18px',
  boxShadow: '0 12px 30px rgba(0,0,0,0.16)',
  maxWidth: '230px',
}

const floatingKicker: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 900,
  color: '#0E63C7',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const floatingText: React.CSSProperties = {
  marginTop: '6px',
  fontSize: '15px',
  lineHeight: 1.45,
  fontWeight: 800,
  color: '#071B4D',
}

/* ================= PROOF STRIP ================= */

const proofSection: React.CSSProperties = {
  maxWidth: '1240px',
  margin: '0 auto',
  padding: '0 20px 12px',
  position: 'relative',
  zIndex: 1,
}

const proofStrip: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: '14px',
}

const proofItem: React.CSSProperties = {
  background: 'rgba(255,255,255,0.82)',
  border: '1px solid rgba(14,99,199,0.10)',
  boxShadow: '0 12px 32px rgba(15,23,42,0.05)',
  borderRadius: '22px',
  padding: '18px',
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  backdropFilter: 'blur(10px)',
}

const proofIconShell: React.CSSProperties = {
  width: '46px',
  height: '46px',
  borderRadius: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, rgba(76,199,199,0.14), rgba(155,225,29,0.18))',
  color: '#0C3E8B',
  flexShrink: 0,
}

const proofTitle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 900,
  color: '#071B4D',
}

const proofText: React.CSSProperties = {
  marginTop: '4px',
  color: '#4D6684',
  fontSize: '13px',
  lineHeight: 1.5,
}

/* ================= FEATURE SECTION ================= */

const featureSection: React.CSSProperties = {
  maxWidth: '1240px',
  margin: '0 auto',
  padding: '24px 20px 20px',
  position: 'relative',
  zIndex: 1,
}

const featureHeader: React.CSSProperties = {
  textAlign: 'center',
  maxWidth: '820px',
  margin: '0 auto 28px',
}

const featureEyebrow: React.CSSProperties = {
  color: '#0E63C7',
  fontWeight: 900,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const featureTitle: React.CSSProperties = {
  margin: '12px 0 0',
  fontSize: '40px',
  lineHeight: 1.08,
  color: '#071B4D',
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const featureText: React.CSSProperties = {
  marginTop: '14px',
  color: '#4A617E',
  fontSize: '17px',
  lineHeight: 1.75,
}

const featureGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '20px',
}

const featureCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.84)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(14,99,199,0.10)',
  borderRadius: '24px',
  padding: '24px',
  textDecoration: 'none',
  color: '#071B4D',
  boxShadow: '0 12px 32px rgba(15,23,42,0.06)',
  minHeight: '220px',
  display: 'block',
}

const featureCardStatic: React.CSSProperties = {
  background: 'rgba(255,255,255,0.84)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(14,99,199,0.10)',
  borderRadius: '24px',
  padding: '24px',
  color: '#071B4D',
  boxShadow: '0 12px 32px rgba(15,23,42,0.06)',
  minHeight: '220px',
}

const featureCardTop: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}

const featureIconShell: React.CSSProperties = {
  width: '52px',
  height: '52px',
  borderRadius: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, rgba(76,199,199,0.14), rgba(155,225,29,0.18))',
  color: '#0C3E8B',
}

const featureArrow: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 900,
  color: '#0E63C7',
}

const featureCardTitle: React.CSSProperties = {
  marginTop: '20px',
  fontSize: '22px',
  fontWeight: 900,
}

const featureCardText: React.CSSProperties = {
  marginTop: '10px',
  color: '#4D6684',
  fontSize: '15px',
  lineHeight: 1.7,
}

const svgStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  display: 'block',
}

/* ================= MESSAGE STRIP ================= */

const messageStripSection: React.CSSProperties = {
  maxWidth: '1240px',
  margin: '0 auto',
  padding: '8px 20px 20px',
  position: 'relative',
  zIndex: 1,
}

const messageStrip: React.CSSProperties = {
  borderRadius: '24px',
  padding: '22px 26px',
  background: 'rgba(255,255,255,0.78)',
  border: '1px solid rgba(14,99,199,0.10)',
  boxShadow: '0 12px 32px rgba(15,23,42,0.05)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '16px',
  flexWrap: 'wrap',
}

const messageStripLeft: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}

const messageStripKicker: React.CSSProperties = {
  color: '#0E63C7',
  fontSize: '13px',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const messageStripText: React.CSSProperties = {
  color: '#071B4D',
  fontSize: '28px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const messageStripRight: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
}

const messagePill: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: '999px',
  background: 'rgba(12,62,139,0.06)',
  border: '1px solid rgba(12,62,139,0.08)',
  color: '#0C3E8B',
  fontWeight: 800,
  fontSize: '14px',
}

/* ================= CTA ================= */

const ctaSection: React.CSSProperties = {
  maxWidth: '1240px',
  margin: '0 auto',
  padding: '8px 20px 54px',
  position: 'relative',
  zIndex: 1,
}

const ctaCard: React.CSSProperties = {
  borderRadius: '30px',
  padding: '30px',
  background: 'linear-gradient(135deg, #071B4D 0%, #0C3E8B 100%)',
  color: '#FFFFFF',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '20px',
  flexWrap: 'wrap',
  boxShadow: '0 18px 50px rgba(7,27,77,0.18)',
}

const ctaEyebrow: React.CSSProperties = {
  color: '#9BE11D',
  fontWeight: 900,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const ctaTitle: React.CSSProperties = {
  margin: '10px 0 0',
  fontSize: '34px',
  lineHeight: 1.12,
  fontWeight: 900,
  maxWidth: '760px',
}

const ctaButtons: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
}

const ctaPrimary: React.CSSProperties = {
  background: 'linear-gradient(90deg, #4CC7C7, #9BE11D)',
  color: '#07152F',
  padding: '14px 20px',
  borderRadius: '14px',
  fontWeight: 900,
  textDecoration: 'none',
}

const ctaSecondary: React.CSSProperties = {
  background: 'rgba(255,255,255,0.10)',
  color: '#FFFFFF',
  padding: '14px 20px',
  borderRadius: '14px',
  fontWeight: 800,
  textDecoration: 'none',
  border: '1px solid rgba(255,255,255,0.16)',
}

/* ================= FOOTER ================= */

const footerStyle: React.CSSProperties = {
  background: '#07152F',
  position: 'relative',
  zIndex: 1,
}

const footerInner: React.CSSProperties = {
  maxWidth: '1240px',
  margin: '0 auto',
  padding: '38px 20px 26px',
  textAlign: 'center',
}

const footerBrandRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const footerTagline: React.CSSProperties = {
  marginTop: '12px',
  color: '#9CB2D1',
  lineHeight: 1.7,
}

const footerBottom: React.CSSProperties = {
  marginTop: '24px',
  paddingTop: '18px',
  borderTop: '1px solid rgba(255,255,255,0.08)',
  color: '#6F86A8',
  fontSize: '14px',
  textAlign: 'center',
}