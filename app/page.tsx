'use client'

import Link from 'next/link'
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

type PlayerSearchRow = {
  id: string
  name: string
}

export default function HomePage() {
  const router = useRouter()
  const searchRef = useRef<HTMLDivElement | null>(null)

  const [playerSearch, setPlayerSearch] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')

  const [suggestions, setSuggestions] = useState<PlayerSearchRow[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)

  const trimmedSearch = useMemo(() => playerSearch.trim(), [playerSearch])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchRef.current &&
        event.target instanceof Node &&
        !searchRef.current.contains(event.target)
      ) {
        setShowSuggestions(false)
        setActiveSuggestionIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (trimmedSearch.length < 2) {
      setSuggestions([])
      setSuggestionsLoading(false)
      setActiveSuggestionIndex(-1)
      return
    }

    let isCancelled = false

    const timeout = setTimeout(async () => {
      try {
        setSuggestionsLoading(true)

        const { data, error } = await supabase
          .from('players')
          .select('id, name')
          .ilike('name', `%${trimmedSearch}%`)
          .order('name', { ascending: true })
          .limit(8)

        if (error) throw new Error(error.message)
        if (isCancelled) return

        const q = trimmedSearch.toLowerCase()

        const results = ((data || []) as PlayerSearchRow[]).sort((a, b) => {
          const aName = a.name.toLowerCase()
          const bName = b.name.toLowerCase()

          const aExact = aName === q ? 0 : 1
          const bExact = bName === q ? 0 : 1
          if (aExact !== bExact) return aExact - bExact

          const aStarts = aName.startsWith(q) ? 0 : 1
          const bStarts = bName.startsWith(q) ? 0 : 1
          if (aStarts !== bStarts) return aStarts - bStarts

          const aIncludes = aName.includes(q) ? 0 : 1
          const bIncludes = bName.includes(q) ? 0 : 1
          if (aIncludes !== bIncludes) return aIncludes - bIncludes

          return aName.length - bName.length
        })

        setSuggestions(results)
        setActiveSuggestionIndex(results.length > 0 ? 0 : -1)
      } catch {
        if (!isCancelled) {
          setSuggestions([])
          setActiveSuggestionIndex(-1)
        }
      } finally {
        if (!isCancelled) setSuggestionsLoading(false)
      }
    }, 200)

    return () => {
      isCancelled = true
      clearTimeout(timeout)
    }
  }, [trimmedSearch])

  async function handlePlayerSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!trimmedSearch || searchLoading) return

    if (
      showSuggestions &&
      activeSuggestionIndex >= 0 &&
      activeSuggestionIndex < suggestions.length
    ) {
      handleSuggestionClick(suggestions[activeSuggestionIndex])
      return
    }

    setSearchLoading(true)
    setSearchError('')

    try {
      const { data, error } = await supabase
        .from('players')
        .select('id, name')
        .ilike('name', `%${trimmedSearch}%`)
        .order('name', { ascending: true })
        .limit(25)

      if (error) throw new Error(error.message)

      const results = (data || []) as PlayerSearchRow[]

      if (!results.length) {
        setSearchError('No matching player found.')
        setShowSuggestions(true)
        return
      }

      const lowered = trimmedSearch.toLowerCase()

      const ranked = [...results].sort((a, b) => {
        const aName = a.name.toLowerCase()
        const bName = b.name.toLowerCase()

        const aExact = aName === lowered ? 0 : 1
        const bExact = bName === lowered ? 0 : 1
        if (aExact !== bExact) return aExact - bExact

        const aStarts = aName.startsWith(lowered) ? 0 : 1
        const bStarts = bName.startsWith(lowered) ? 0 : 1
        if (aStarts !== bStarts) return aStarts - bStarts

        return aName.length - bName.length
      })

      setShowSuggestions(false)
      setActiveSuggestionIndex(-1)
      router.push(`/players/${ranked[0].id}`)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed.')
    } finally {
      setSearchLoading(false)
    }
  }

  function handleSuggestionClick(player: PlayerSearchRow) {
    setPlayerSearch(player.name)
    setSearchError('')
    setShowSuggestions(false)
    setActiveSuggestionIndex(-1)
    router.push(`/players/${player.id}`)
  }

  function handleInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      if (suggestions.length > 0) {
        setShowSuggestions(true)
        setActiveSuggestionIndex(0)
        e.preventDefault()
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!suggestions.length) return
      setShowSuggestions(true)
      setActiveSuggestionIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      )
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!suggestions.length) return
      setShowSuggestions(true)
      setActiveSuggestionIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      )
      return
    }

    if (e.key === 'Escape') {
      setShowSuggestions(false)
      setActiveSuggestionIndex(-1)
      return
    }

    if (e.key === 'Enter') {
      if (
        showSuggestions &&
        activeSuggestionIndex >= 0 &&
        activeSuggestionIndex < suggestions.length
      ) {
        e.preventDefault()
        handleSuggestionClick(suggestions[activeSuggestionIndex])
      }
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
            <Link href="/players" style={navLink}>Players</Link>
            <Link href="/rankings" style={navLink}>Rankings</Link>
            <Link href="/matchup" style={navLink}>Matchup</Link>
            <Link href="/leagues" style={navLink}>Leagues</Link>
            <Link href="/captains-corner" style={navLink}>Captain&apos;s Corner</Link>
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
            </div>

            <div style={heroRight}>
              <form onSubmit={handlePlayerSearch} style={searchShellRight}>
                <div style={searchTopRow}>
                  <div style={searchLabel}>Start with a player</div>
                  <div style={searchShortcutHint}>Use ↑ ↓ Enter</div>
                </div>

                <div ref={searchRef} style={searchAutocompleteWrap}>
                  <div style={searchRow}>
                    <div style={searchInputWrap}>
                      <div style={searchIconWrap}>
                        <SearchIcon />
                      </div>

                      <input
                        type="text"
                        value={playerSearch}
                        onChange={(e) => {
                          setPlayerSearch(e.target.value)
                          setSearchError('')
                          setShowSuggestions(true)
                        }}
                        onFocus={() => {
                          if (trimmedSearch.length >= 2) {
                            setShowSuggestions(true)
                          }
                        }}
                        onKeyDown={handleInputKeyDown}
                        placeholder="Search player name..."
                        style={searchInput}
                        aria-label="Search player name"
                        autoComplete="off"
                      />
                    </div>

                    <button type="submit" style={searchButton} disabled={searchLoading}>
                      {searchLoading ? 'Searching...' : 'Search'}
                    </button>
                  </div>

                  {showSuggestions && trimmedSearch.length >= 2 && (
                    <div style={suggestionsDropdown}>
                      {suggestionsLoading ? (
                        <div style={suggestionStatus}>Searching players...</div>
                      ) : suggestions.length > 0 ? (
                        suggestions.map((player, index) => {
                          const isActive = index === activeSuggestionIndex

                          return (
                            <button
                              key={player.id}
                              type="button"
                              style={{
                                ...suggestionItem,
                                ...(isActive ? suggestionItemActive : {}),
                              }}
                              onMouseEnter={() => setActiveSuggestionIndex(index)}
                              onClick={() => handleSuggestionClick(player)}
                            >
                              <span style={suggestionPrimary}>{player.name}</span>
                              <span style={suggestionSecondary}>View player</span>
                            </button>
                          )
                        })
                      ) : (
                        <div style={suggestionStatus}>No players found.</div>
                      )}
                    </div>
                  )}
                </div>

                <div style={searchHelperText}>
                  Search ratings, results, and recent player performance from one place.
                </div>

                {searchError ? <div style={searchErrorStyle}>{searchError}</div> : null}
              </form>

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
                  <div style={floatingText}>See the edge before your first serve.</div>
                </div>

                <div style={floatingBottom}>
                  <div style={floatingKicker}>Captain tools</div>
                  <div style={floatingText}>Matchup prep, lineup tools, and smarter team decisions.</div>
                </div>
              </div>
            </div>
          </div>

          <div style={heroProofRowWrap}>
            <div style={heroProofGrid}>
              <Link href="/players" style={proofLink}>
                <div style={proofItem}>
                  <div style={proofIconShell}><PlayersIcon /></div>
                  <div style={proofTextWrap}>
                    <div style={proofTitle}>Player Ratings</div>
                    <div style={proofText}>Know more about every player</div>
                  </div>
                </div>
              </Link>

              <Link href="/matchup" style={proofLink}>
                <div style={proofItem}>
                  <div style={proofIconShell}><MatchupIcon /></div>
                  <div style={proofTextWrap}>
                    <div style={proofTitle}>Matchup Analysis</div>
                    <div style={proofText}>Compare opponents faster</div>
                  </div>
                </div>
              </Link>

              <Link href="/leagues" style={proofLink}>
                <div style={proofItem}>
                  <div style={proofIconShell}><LeaguesIcon /></div>
                  <div style={proofTextWrap}>
                    <div style={proofTitle}>League Context</div>
                    <div style={proofText}>Track your team and competition</div>
                  </div>
                </div>
              </Link>

              <Link href="/captains-corner" style={proofLink}>
                <div style={proofItem}>
                  <div style={proofIconShell}><CaptainIcon /></div>
                  <div style={proofTextWrap}>
                    <div style={proofTitle}>Captain Tools</div>
                    <div style={proofText}>Plan better before match day</div>
                  </div>
                </div>
              </Link>
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
          <Link href="/players" style={featureCard}>
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
            <Link href="/players" style={ctaPrimary}>Find a Player</Link>
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

          <div style={footerUtilityRow}>
            <Link href="/players" style={footerUtilityLink}>Players</Link>
            <Link href="/rankings" style={footerUtilityLink}>Rankings</Link>
            <Link href="/matchup" style={footerUtilityLink}>Matchup</Link>
            <Link href="/leagues" style={footerUtilityLink}>Leagues</Link>
            <Link href="/captains-corner" style={footerUtilityLink}>Captain&apos;s Corner</Link>
          </div>

          <div style={footerBottom}>
            © {new Date().getFullYear()} TenAceIQ
          </div>
        </div>
      </footer>
    </main>
  )
}

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
  gridTemplateColumns: '1.02fr 0.98fr',
  gap: '26px',
  alignItems: 'stretch',
  position: 'relative',
  zIndex: 1,
}

const heroLeft: React.CSSProperties = {
  padding: '60px 50px 26px',
  color: '#FFFFFF',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
}

const heroRight: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-start',
  gap: '20px',
  padding: '38px 38px 20px 20px',
}

const heroProofRowWrap: React.CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: '100%',
  padding: '0 50px 42px',
  display: 'flex',
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

const heroProofGrid: React.CSSProperties = {
  width: '100%',
  maxWidth: '1120px',
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: '18px',
  alignItems: 'stretch',
}

const proofLink: React.CSSProperties = {
  textDecoration: 'none',
  display: 'block',
}

const proofTextWrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  textAlign: 'left',
}

const searchShellRight: React.CSSProperties = {
  padding: '18px',
  borderRadius: '22px',
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.14)',
  backdropFilter: 'blur(8px)',
  width: '100%',
  maxWidth: '560px',
  alignSelf: 'center',
}

const searchTopRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap',
  marginBottom: '12px',
}

const searchLabel: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 900,
  color: '#FFFFFF',
}

const searchShortcutHint: React.CSSProperties = {
  color: '#CFE2FF',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.02em',
}

const searchAutocompleteWrap: React.CSSProperties = {
  position: 'relative',
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

const suggestionsDropdown: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 10px)',
  left: 0,
  right: 0,
  background: '#FFFFFF',
  borderRadius: '18px',
  boxShadow: '0 20px 40px rgba(15,23,42,0.18)',
  border: '1px solid rgba(14,99,199,0.10)',
  overflow: 'hidden',
  zIndex: 30,
}

const suggestionItem: React.CSSProperties = {
  width: '100%',
  background: '#FFFFFF',
  border: 'none',
  borderBottom: '1px solid rgba(15,23,42,0.06)',
  padding: '14px 16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  cursor: 'pointer',
  textAlign: 'left',
}

const suggestionItemActive: React.CSSProperties = {
  background: 'rgba(12,62,139,0.06)',
}

const suggestionPrimary: React.CSSProperties = {
  color: '#071B4D',
  fontSize: '15px',
  fontWeight: 800,
}

const suggestionSecondary: React.CSSProperties = {
  color: '#0E63C7',
  fontSize: '13px',
  fontWeight: 700,
}

const suggestionStatus: React.CSSProperties = {
  padding: '16px',
  color: '#4D6684',
  fontSize: '14px',
  fontWeight: 600,
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

const logoStage: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  minHeight: '430px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'center',
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
  top: '26px',
  right: '8px',
  zIndex: 3,
  background: 'rgba(255,255,255,0.96)',
  padding: '14px 16px',
  borderRadius: '18px',
  boxShadow: '0 12px 30px rgba(0,0,0,0.16)',
  maxWidth: '210px',
}

const floatingBottom: React.CSSProperties = {
  position: 'absolute',
  bottom: '24px',
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

const proofItem: React.CSSProperties = {
  background: 'rgba(255,255,255,0.94)',
  border: '1px solid rgba(14,99,199,0.12)',
  boxShadow: '0 12px 32px rgba(15,23,42,0.08)',
  borderRadius: '22px',
  padding: '20px 18px',
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  minHeight: '112px',
  width: '100%',
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
  lineHeight: 1.3,
}

const proofText: React.CSSProperties = {
  marginTop: '4px',
  color: '#4D6684',
  fontSize: '13px',
  lineHeight: 1.5,
}

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

const footerUtilityRow: React.CSSProperties = {
  marginTop: '18px',
  display: 'flex',
  justifyContent: 'center',
  gap: '14px',
  flexWrap: 'wrap',
}

const footerUtilityLink: React.CSSProperties = {
  color: '#D6E4F8',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 700,
}

const footerBottom: React.CSSProperties = {
  marginTop: '24px',
  paddingTop: '18px',
  borderTop: '1px solid rgba(255,255,255,0.08)',
  color: '#6F86A8',
  fontSize: '14px',
  textAlign: 'center',
}