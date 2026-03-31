'use client'

import Image from 'next/image'
import Link from 'next/link'
import { FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

type PlayerSearchRow = {
  id: string
  name: string
}

const QUICK_SEARCHES = ['Nathan Meinert', 'Nathan Easley', 'Top doubles players']

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

  const [screenWidth, setScreenWidth] = useState(1200)

  const trimmedSearch = useMemo(() => playerSearch.trim(), [playerSearch])
  const shouldShowSuggestions = showSuggestions && trimmedSearch.length >= 2
  const isMobile = screenWidth < 900
  const isSmallMobile = screenWidth < 560

  useEffect(() => {
    function handleResize() {
      setScreenWidth(window.innerWidth)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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

  async function searchForPlayerName(name: string) {
    if (!name.trim()) return

    setSearchLoading(true)
    setSearchError('')

    try {
      const term = name.trim()

      const { data, error } = await supabase
        .from('players')
        .select('id, name')
        .ilike('name', `%${term}%`)
        .order('name', { ascending: true })
        .limit(25)

      if (error) throw new Error(error.message)

      const results = (data || []) as PlayerSearchRow[]

      if (!results.length) {
        setSearchError('No matching player found.')
        setShowSuggestions(true)
        return
      }

      const lowered = term.toLowerCase()

      const ranked = [...results].sort((a, b) => {
        const aName = a.name.toLowerCase()
        const bName = b.name.toLowerCase()

        const aExact = aName === lowered ? 0 : 1
        const bExact = bName === lowered ? 0 : 1
        if (aExact !== bExact) return aExact - bExact

        const aStarts = aName.startsWith(lowered) ? 0 : 1
        const bStarts = bName.startsWith(lowered) ? 0 : 1
        if (aStarts !== bStarts) return aStarts - bStarts

        const aIncludes = aName.includes(lowered) ? 0 : 1
        const bIncludes = bName.includes(lowered) ? 0 : 1
        if (aIncludes !== bIncludes) return aIncludes - bIncludes

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

  async function handlePlayerSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!trimmedSearch || searchLoading) return

    if (
      shouldShowSuggestions &&
      activeSuggestionIndex >= 0 &&
      activeSuggestionIndex < suggestions.length
    ) {
      handleSuggestionClick(suggestions[activeSuggestionIndex])
      return
    }

    await searchForPlayerName(trimmedSearch)
  }

  function handleSuggestionClick(player: PlayerSearchRow) {
    setPlayerSearch(player.name)
    setSearchError('')
    setShowSuggestions(false)
    setActiveSuggestionIndex(-1)
    router.push(`/players/${player.id}`)
  }

  function handleQuickSearch(name: string) {
    setPlayerSearch(name)
    setSearchError('')
    setShowSuggestions(name.trim().length >= 2)
    void searchForPlayerName(name)
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
        shouldShowSuggestions &&
        activeSuggestionIndex >= 0 &&
        activeSuggestionIndex < suggestions.length
      ) {
        e.preventDefault()
        handleSuggestionClick(suggestions[activeSuggestionIndex])
      }
    }
  }

  const dynamicHeaderInner: React.CSSProperties = {
    ...headerInner,
    padding: isMobile ? '14px 16px' : '16px 20px',
    justifyContent: isMobile ? 'center' : 'space-between',
  }

  const dynamicNavStyle: React.CSSProperties = {
    ...navStyle,
    justifyContent: isMobile ? 'center' : 'flex-start',
    gap: isMobile ? '8px' : '10px',
  }

  const dynamicNavLink: React.CSSProperties = {
    ...navLink,
    padding: isMobile ? '9px 12px' : '10px 14px',
    fontSize: isMobile ? '14px' : '15px',
  }

  const dynamicHeroSection: React.CSSProperties = {
    ...heroSection,
    padding: isMobile ? '18px 12px 16px' : '30px 20px 18px',
  }

  const dynamicHeroShell: React.CSSProperties = {
    ...heroShell,
    borderRadius: isMobile ? '24px' : '34px',
  }

  const dynamicHeroContent: React.CSSProperties = {
    ...heroContent,
    gridTemplateColumns: isMobile ? '1fr' : '1.02fr 0.98fr',
    gap: isMobile ? '18px' : '30px',
  }

  const dynamicHeroLeft: React.CSSProperties = {
    ...heroLeft,
    padding: isMobile ? '26px 20px 6px' : '52px 50px 22px',
  }

  const dynamicHeroRight: React.CSSProperties = {
    ...heroRight,
    padding: isMobile ? '0 20px 24px' : '42px 42px 28px 18px',
    gap: isMobile ? '16px' : '18px',
  }

  const dynamicEyebrow: React.CSSProperties = {
    ...eyebrow,
    fontSize: isMobile ? '11px' : '13px',
    padding: isMobile ? '7px 12px' : '8px 14px',
  }

  const dynamicHeroTitle: React.CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '32px' : isMobile ? '40px' : '62px',
    lineHeight: isMobile ? 1.05 : 0.98,
  }

  const dynamicHeroText: React.CSSProperties = {
    ...heroText,
    fontSize: isMobile ? '16px' : '18px',
    maxWidth: '640px',
    lineHeight: isMobile ? 1.6 : 1.72,
  }

  const dynamicSearchShellRight: React.CSSProperties = {
    ...searchShellRight,
    maxWidth: isMobile ? '100%' : '560px',
    padding: isMobile ? '16px' : '18px',
  }

  const dynamicSearchRow: React.CSSProperties = {
    ...searchRow,
    flexDirection: isMobile ? 'column' : 'row',
  }

  const dynamicSearchInputWrap: React.CSSProperties = {
    ...searchInputWrap,
    minWidth: isMobile ? '100%' : '260px',
    width: isMobile ? '100%' : undefined,
  }

  const dynamicSearchButton: React.CSSProperties = {
    ...searchButton,
    width: isMobile ? '100%' : 'auto',
  }

  const dynamicLogoStage: React.CSSProperties = {
    ...logoStage,
    minHeight: isMobile ? '220px' : '290px',
    marginTop: isMobile ? '6px' : '10px',
  }

  const dynamicLogoRing: React.CSSProperties = {
    ...logoRing,
    width: isMobile ? '210px' : '260px',
    height: isMobile ? '210px' : '260px',
    opacity: 0.45,
  }

  const dynamicHeroProofRowWrap: React.CSSProperties = {
    ...heroProofRowWrap,
    padding: isSmallMobile ? '0 16px 22px' : isMobile ? '0 20px 26px' : '0 50px 38px',
  }

  const dynamicHeroProofGrid: React.CSSProperties = {
    ...heroProofGrid,
    gridTemplateColumns: isSmallMobile
      ? '1fr'
      : isMobile
      ? 'repeat(2, minmax(0, 1fr))'
      : 'repeat(4, minmax(0, 1fr))',
    gap: isMobile ? '12px' : '16px',
  }

  const dynamicProofItem: React.CSSProperties = {
    ...proofItem,
    minHeight: isMobile ? '96px' : '110px',
    padding: isMobile ? '16px 14px' : '20px 18px',
  }

  const dynamicFeatureSection: React.CSSProperties = {
    ...featureSection,
    padding: isMobile ? '18px 12px 16px' : '24px 20px 20px',
  }

  const dynamicFeatureTitle: React.CSSProperties = {
    ...featureTitle,
    fontSize: isSmallMobile ? '28px' : isMobile ? '32px' : '42px',
  }

  const dynamicFeatureText: React.CSSProperties = {
    ...featureText,
    fontSize: isMobile ? '16px' : '17px',
    lineHeight: isMobile ? 1.6 : 1.72,
  }

  const dynamicMessageStripSection: React.CSSProperties = {
    ...messageStripSection,
    padding: isMobile ? '8px 12px 18px' : '8px 20px 20px',
  }

  const dynamicMessageStrip: React.CSSProperties = {
    ...messageStrip,
    padding: isMobile ? '18px 16px' : '22px 26px',
    borderRadius: isMobile ? '22px' : '28px',
  }

  const dynamicMessageStripText: React.CSSProperties = {
    ...messageStripText,
    fontSize: isSmallMobile ? '22px' : isMobile ? '24px' : '28px',
  }

  const dynamicCtaSection: React.CSSProperties = {
    ...ctaSection,
    padding: isMobile ? '4px 12px 30px' : '10px 20px 56px',
  }

  const dynamicCtaCard: React.CSSProperties = {
    ...ctaCard,
    padding: isMobile ? '22px 18px' : '30px',
  }

  const dynamicCtaTitle: React.CSSProperties = {
    ...ctaTitle,
    fontSize: isSmallMobile ? '24px' : isMobile ? '28px' : '34px',
  }

  const dynamicFooterInner: React.CSSProperties = {
    ...footerInner,
    padding: isMobile ? '30px 16px 22px' : '38px 20px 26px',
  }

  return (
    <main style={pageStyle}>
      <div style={orbOne} />
      <div style={orbTwo} />
      <div style={gridGlow} />

      <header style={headerStyle}>
        <div style={dynamicHeaderInner}>
          <Link href="/" style={brandWrap} aria-label="TenAceIQ home">
            <BrandWordmark compact={isMobile} />
          </Link>

          <nav style={dynamicNavStyle}>
            <Link href="/" style={dynamicNavLink}>Home</Link>
            <Link href="/players" style={dynamicNavLink}>Players</Link>
            <Link href="/rankings" style={dynamicNavLink}>Rankings</Link>
            <Link href="/matchup" style={dynamicNavLink}>Matchup</Link>
            <Link href="/leagues" style={dynamicNavLink}>Leagues</Link>
            <Link href="/captains-corner" style={dynamicNavLink}>Captain&apos;s Corner</Link>
          </nav>
        </div>
      </header>

      <section style={dynamicHeroSection}>
        <div style={dynamicHeroShell}>
          <div style={heroNoise} />

          <div style={dynamicHeroContent}>
            <div style={dynamicHeroLeft}>
              <div style={dynamicEyebrow}>Know More. Plan Better. Compete Smarter.</div>

              <h1 style={dynamicHeroTitle}>
                Smarter tennis
                <br />
                insight for players,
                <br />
                captains, and teams.
              </h1>

              <p style={dynamicHeroText}>
                TenAceIQ helps you search players, compare matchups, track rankings,
                understand league context, and prepare with more confidence before match day.
              </p>

              <div style={statsRow}>
                <div style={statPill}>
                  <span style={statValue}>Player</span>
                  <span style={statLabel}>search first</span>
                </div>
                <div style={statPill}>
                  <span style={statValue}>Singles + doubles</span>
                  <span style={statLabel}>better context</span>
                </div>
                <div style={statPill}>
                  <span style={statValue}>Captain tools</span>
                  <span style={statLabel}>plan smarter</span>
                </div>
              </div>
            </div>

            <div style={dynamicHeroRight}>
              <form onSubmit={handlePlayerSearch} style={dynamicSearchShellRight}>
                <div style={searchTopRow}>
                  <div style={searchLabel}>Start with a player</div>
                  <div style={searchShortcutHint}>Use ↑ ↓ Enter</div>
                </div>

                <div ref={searchRef} style={searchAutocompleteWrap}>
                  <div style={dynamicSearchRow}>
                    <div style={dynamicSearchInputWrap}>
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

                    <button type="submit" style={dynamicSearchButton} disabled={searchLoading}>
                      {searchLoading ? 'Searching...' : 'Search'}
                    </button>
                  </div>

                  {shouldShowSuggestions && (
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

                <div style={quickSearchRow}>
                  {QUICK_SEARCHES.map((name) => (
                    <button
                      key={name}
                      type="button"
                      style={quickSearchChip}
                      onClick={() => handleQuickSearch(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>

                {searchError ? <div style={searchErrorStyle}>{searchError}</div> : null}
              </form>

              <div style={dynamicLogoStage}>
                <div style={logoGlow} />
                <div style={dynamicLogoRing} />
                <div style={heroBrandCard}>
                  <Image
                    src="/logo-icon.png"
                    alt="TenAceIQ"
                    width={140}
                    height={140}
                    priority
                    style={{
                      width: '100%',
                      maxWidth: isMobile ? '110px' : '140px',
                      height: 'auto',
                      display: 'block',
                      margin: '0 auto 10px',
                      objectFit: 'contain',
                    }}
                  />
                  <div style={heroBrandText}>
                    <span style={heroTenAce}>TenAce</span>
                    <span style={heroIQ}>IQ</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={dynamicHeroProofRowWrap}>
            <div style={dynamicHeroProofGrid}>
              <Link href="/players" style={proofLink}>
                <div style={dynamicProofItem}>
                  <div style={proofIconShell}><PlayersIcon /></div>
                  <div style={proofTextWrap}>
                    <div style={proofTitle}>Player Ratings</div>
                    <div style={proofText}>Know more about every player</div>
                  </div>
                </div>
              </Link>

              <Link href="/matchup" style={proofLink}>
                <div style={dynamicProofItem}>
                  <div style={proofIconShell}><MatchupIcon /></div>
                  <div style={proofTextWrap}>
                    <div style={proofTitle}>Matchup Analysis</div>
                    <div style={proofText}>Compare opponents faster</div>
                  </div>
                </div>
              </Link>

              <Link href="/leagues" style={proofLink}>
                <div style={dynamicProofItem}>
                  <div style={proofIconShell}><LeaguesIcon /></div>
                  <div style={proofTextWrap}>
                    <div style={proofTitle}>League Context</div>
                    <div style={proofText}>Track teams and competition</div>
                  </div>
                </div>
              </Link>

              <Link href="/captains-corner" style={proofLink}>
                <div style={dynamicProofItem}>
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

      <section style={dynamicFeatureSection}>
        <div style={featureHeader}>
          <div style={featureEyebrow}>Platform Overview</div>
          <h2 style={dynamicFeatureTitle}>
            Everything important for your game, your team, and your next lineup.
          </h2>
          <p style={dynamicFeatureText}>
            TenAceIQ is built to be your tennis decision-making hub, so you can move from player search
            to rankings, matchup prep, league context, and captain planning without jumping between tools.
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

      <section style={dynamicMessageStripSection}>
        <div style={dynamicMessageStrip}>
          <div style={messageStripLeft}>
            <div style={messageStripKicker}>Core Theme</div>
            <div style={dynamicMessageStripText}>Know more. Plan better. Compete smarter.</div>
          </div>

          <div style={messageStripRight}>
            <span style={messagePill}>Players</span>
            <span style={messagePill}>Teams</span>
            <span style={messagePill}>Leagues</span>
            <span style={messagePill}>Captains</span>
          </div>
        </div>
      </section>

      <section style={dynamicCtaSection}>
        <div style={dynamicCtaCard}>
          <div>
            <div style={ctaEyebrow}>Start Here</div>
            <h3 style={dynamicCtaTitle}>
              Smarter player data. Better team planning. Stronger match-day decisions.
            </h3>
          </div>

          <div style={ctaButtons}>
            <Link href="/players" style={ctaPrimary}>Search Player Ratings</Link>
            <Link href="/matchup" style={ctaSecondary}>Run a Matchup Comparison</Link>
          </div>
        </div>
      </section>

      <footer style={footerStyle}>
        <div style={dynamicFooterInner}>
          <Link href="/" style={footerBrandLink}>
            <BrandWordmark compact={false} footer />
          </Link>

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

function BrandWordmark({
  compact = false,
  footer = false,
}: {
  compact?: boolean
  footer?: boolean
}) {
  const iconSize = compact ? 30 : footer ? 42 : 34
  const fontSize = compact ? 24 : footer ? 32 : 27

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? '8px' : '10px',
        lineHeight: 1,
      }}
    >
      <Image
        src="/logo-icon.png"
        alt="TenAceIQ"
        width={iconSize}
        height={iconSize}
        priority
        style={{
          width: `${iconSize}px`,
          height: `${iconSize}px`,
          display: 'block',
          objectFit: 'contain',
        }}
      />

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
        <span
          style={{
            background: 'linear-gradient(135deg, #D9F84A 0%, #36D56D 68%, #2492FF 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          IQ
        </span>
      </div>
    </div>
  )
}

function IconBase({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" style={svgStyle} aria-hidden="true">
      {children}
    </svg>
  )
}

function SearchIcon() {
  return (
    <IconBase>
      <circle cx="11" cy="11" r="6" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path d="M16 16l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
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
  background: 'linear-gradient(180deg, #07152F 0%, #091C42 27%, #EFF5FB 27%, #F7FAFD 100%)',
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
  zIndex: 50,
  background: 'rgba(7, 21, 47, 0.72)',
  backdropFilter: 'blur(16px)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
}

const headerInner: React.CSSProperties = {
  maxWidth: '1240px',
  margin: '0 auto',
  padding: '16px 20px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '18px',
  flexWrap: 'wrap',
}

const brandWrap: React.CSSProperties = {
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
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
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.05)',
  transition: 'all 0.18s ease',
}

const heroSection: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
}

const heroShell: React.CSSProperties = {
  position: 'relative',
  maxWidth: '1240px',
  margin: '0 auto',
  overflow: 'hidden',
  background: 'linear-gradient(135deg, #0A1B46 0%, #0F2A63 55%, #163A78 100%)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 30px 80px rgba(3,10,25,0.28)',
}

const heroNoise: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(circle at 15% 20%, rgba(92,219,186,0.10), transparent 30%), radial-gradient(circle at 85% 20%, rgba(173,255,47,0.10), transparent 26%), radial-gradient(circle at 50% 100%, rgba(255,255,255,0.05), transparent 34%)',
  pointerEvents: 'none',
}

const heroContent: React.CSSProperties = {
  display: 'grid',
  alignItems: 'center',
  position: 'relative',
  zIndex: 1,
}

const heroLeft: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '22px',
}

const heroRight: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
}

const eyebrow: React.CSSProperties = {
  display: 'inline-flex',
  alignSelf: 'flex-start',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.10)',
  color: '#DDE9FF',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const heroTitle: React.CSSProperties = {
  margin: 0,
  color: '#FFFFFF',
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const heroText: React.CSSProperties = {
  margin: 0,
  color: 'rgba(231,240,255,0.88)',
  fontWeight: 500,
}

const statsRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
  marginTop: '2px',
}

const statPill: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  padding: '12px 14px',
  borderRadius: '16px',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.10)',
  minWidth: '140px',
}

const statValue: React.CSSProperties = {
  color: '#FFFFFF',
  fontWeight: 800,
  fontSize: '14px',
}

const statLabel: React.CSSProperties = {
  color: 'rgba(221,233,255,0.76)',
  fontSize: '12px',
  fontWeight: 600,
}

const searchShellRight: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '26px',
  boxShadow: '0 20px 40px rgba(3,10,25,0.18)',
  backdropFilter: 'blur(14px)',
}

const searchTopRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'center',
  marginBottom: '14px',
  flexWrap: 'wrap',
}

const searchLabel: React.CSSProperties = {
  color: '#FFFFFF',
  fontWeight: 800,
  fontSize: '16px',
}

const searchShortcutHint: React.CSSProperties = {
  color: 'rgba(223,234,255,0.74)',
  fontSize: '13px',
  fontWeight: 700,
}

const searchAutocompleteWrap: React.CSSProperties = {
  position: 'relative',
  zIndex: 8,
}

const searchRow: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  alignItems: 'stretch',
}

const searchInputWrap: React.CSSProperties = {
  position: 'relative',
  flex: 1,
  display: 'flex',
  alignItems: 'center',
}

const searchIconWrap: React.CSSProperties = {
  position: 'absolute',
  left: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  color: '#1F4D9A',
  width: '20px',
  height: '20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
}

const searchInput: React.CSSProperties = {
  width: '100%',
  minHeight: '56px',
  border: 'none',
  outline: 'none',
  borderRadius: '18px',
  background: '#FFFFFF',
  color: '#0A1C45',
  fontSize: '18px',
  fontWeight: 700,
  padding: '0 18px 0 48px',
  boxSizing: 'border-box',
}

const searchButton: React.CSSProperties = {
  minHeight: '56px',
  padding: '0 24px',
  borderRadius: '18px',
  border: 'none',
  cursor: 'pointer',
  fontWeight: 900,
  fontSize: '18px',
  color: '#051636',
  background: 'linear-gradient(135deg, #56D8AE 0%, #B8E61A 100%)',
  boxShadow: '0 10px 24px rgba(184,230,26,0.22)',
}

const suggestionsDropdown: React.CSSProperties = {
  position: 'relative',
  marginTop: '10px',
  background: '#FFFFFF',
  borderRadius: '18px',
  border: '1px solid rgba(8,32,79,0.08)',
  overflow: 'hidden',
  boxShadow: '0 20px 44px rgba(6,19,48,0.18)',
  maxHeight: '280px',
  overflowY: 'auto',
}

const suggestionItem: React.CSSProperties = {
  width: '100%',
  border: 'none',
  background: '#FFFFFF',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  padding: '16px 18px',
  cursor: 'pointer',
  textAlign: 'left',
}

const suggestionItemActive: React.CSSProperties = {
  background: '#F2F7FF',
}

const suggestionPrimary: React.CSSProperties = {
  color: '#102A5E',
  fontWeight: 800,
  fontSize: '15px',
}

const suggestionSecondary: React.CSSProperties = {
  color: '#2563EB',
  fontWeight: 700,
  fontSize: '14px',
  whiteSpace: 'nowrap',
}

const suggestionStatus: React.CSSProperties = {
  padding: '16px 18px',
  color: '#465A84',
  fontWeight: 700,
  fontSize: '14px',
}

const searchHelperText: React.CSSProperties = {
  marginTop: '12px',
  color: 'rgba(223,234,255,0.80)',
  fontSize: '13px',
  lineHeight: 1.5,
  fontWeight: 600,
}

const quickSearchRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '14px',
}

const quickSearchChip: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.08)',
  color: '#E8F0FF',
  borderRadius: '999px',
  padding: '9px 14px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '13px',
}

const searchErrorStyle: React.CSSProperties = {
  marginTop: '12px',
  color: '#FFD4D4',
  fontWeight: 700,
  fontSize: '14px',
}

const logoStage: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: '18px',
}

const logoGlow: React.CSSProperties = {
  position: 'absolute',
  width: '240px',
  height: '240px',
  borderRadius: '50%',
  background: 'rgba(112, 230, 185, 0.10)',
  filter: 'blur(42px)',
  pointerEvents: 'none',
}

const logoRing: React.CSSProperties = {
  position: 'absolute',
  borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.14)',
  background:
    'radial-gradient(circle at center, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.00) 58%, rgba(255,255,255,0.04) 100%)',
}

const heroBrandCard: React.CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: '100%',
  maxWidth: '360px',
  borderRadius: '28px',
  padding: '22px 20px 20px',
  background: 'linear-gradient(180deg, rgba(6,17,49,0.22) 0%, rgba(7,22,59,0.14) 100%)',
  border: '1px solid rgba(255,255,255,0.08)',
  textAlign: 'center',
  boxShadow: '0 20px 50px rgba(3,10,25,0.18)',
}

const heroBrandText: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 'clamp(28px, 4vw, 44px)',
  lineHeight: 1,
  letterSpacing: '-0.045em',
}

const heroTenAce: React.CSSProperties = {
  color: '#FFFFFF',
}

const heroIQ: React.CSSProperties = {
  background: 'linear-gradient(135deg, #D9F84A 0%, #36D56D 68%, #2492FF 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}

const heroProofRowWrap: React.CSSProperties = {}

const heroProofGrid: React.CSSProperties = {
  display: 'grid',
}

const proofLink: React.CSSProperties = {
  textDecoration: 'none',
}

const proofItem: React.CSSProperties = {
  display: 'flex',
  gap: '14px',
  borderRadius: '22px',
  background: '#FFFFFF',
  border: '1px solid rgba(7,27,77,0.06)',
  boxShadow: '0 16px 34px rgba(9,22,54,0.08)',
}

const proofIconShell: React.CSSProperties = {
  width: '46px',
  height: '46px',
  minWidth: '46px',
  borderRadius: '14px',
  background: 'linear-gradient(135deg, rgba(37,91,227,0.12), rgba(184,230,26,0.16))',
  color: '#103170',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const proofTextWrap: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: '4px',
}

const proofTitle: React.CSSProperties = {
  color: '#0F234F',
  fontWeight: 900,
  fontSize: '15px',
}

const proofText: React.CSSProperties = {
  color: '#4C618D',
  fontWeight: 600,
  fontSize: '13px',
  lineHeight: 1.5,
}

const featureSection: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  maxWidth: '1240px',
  margin: '0 auto',
}

const featureHeader: React.CSSProperties = {
  maxWidth: '780px',
  marginBottom: '24px',
}

const featureEyebrow: React.CSSProperties = {
  color: '#2563EB',
  fontWeight: 900,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '10px',
}

const featureTitle: React.CSSProperties = {
  margin: 0,
  color: '#0A1F4A',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const featureText: React.CSSProperties = {
  marginTop: '14px',
  marginBottom: 0,
  color: '#51678E',
  fontWeight: 500,
}

const featureGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '18px',
}

const featureCardBase: React.CSSProperties = {
  borderRadius: '24px',
  padding: '22px',
  minHeight: '220px',
  background: '#FFFFFF',
  border: '1px solid rgba(7,27,77,0.06)',
  boxShadow: '0 18px 36px rgba(8,24,59,0.08)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
}

const featureCard: React.CSSProperties = {
  ...featureCardBase,
  textDecoration: 'none',
}

const featureCardStatic: React.CSSProperties = {
  ...featureCardBase,
}

const featureCardTop: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '24px',
}

const featureIconShell: React.CSSProperties = {
  width: '52px',
  height: '52px',
  borderRadius: '16px',
  background: 'linear-gradient(135deg, rgba(37,91,227,0.10), rgba(184,230,26,0.16))',
  color: '#103170',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const featureArrow: React.CSSProperties = {
  color: '#7C90B4',
  fontSize: '22px',
  fontWeight: 900,
}

const featureCardTitle: React.CSSProperties = {
  color: '#102652',
  fontWeight: 900,
  fontSize: '22px',
  marginBottom: '10px',
}

const featureCardText: React.CSSProperties = {
  color: '#53698F',
  fontSize: '15px',
  lineHeight: 1.65,
  fontWeight: 600,
}

const messageStripSection: React.CSSProperties = {
  maxWidth: '1240px',
  margin: '0 auto',
  padding: '8px 20px 20px',
}

const messageStrip: React.CSSProperties = {
  borderRadius: '28px',
  background: 'linear-gradient(135deg, #0B1F4A 0%, #123777 100%)',
  boxShadow: '0 24px 60px rgba(7,21,47,0.18)',
  border: '1px solid rgba(255,255,255,0.08)',
  padding: '22px 26px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '18px',
  flexWrap: 'wrap',
}

const messageStripLeft: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}

const messageStripKicker: React.CSSProperties = {
  color: '#92B4FF',
  fontSize: '12px',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const messageStripText: React.CSSProperties = {
  color: '#FFFFFF',
  fontSize: '28px',
  fontWeight: 900,
  lineHeight: 1.2,
}

const messageStripRight: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
}

const messagePill: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '999px',
  padding: '10px 14px',
  background: 'rgba(255,255,255,0.08)',
  color: '#EAF2FF',
  border: '1px solid rgba(255,255,255,0.08)',
  fontWeight: 800,
  fontSize: '13px',
}

const ctaSection: React.CSSProperties = {
  maxWidth: '1240px',
  margin: '0 auto',
}

const ctaCard: React.CSSProperties = {
  borderRadius: '28px',
  background: '#FFFFFF',
  border: '1px solid rgba(7,27,77,0.06)',
  boxShadow: '0 18px 38px rgba(8,24,59,0.08)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '20px',
  flexWrap: 'wrap',
}

const ctaEyebrow: React.CSSProperties = {
  color: '#2563EB',
  fontWeight: 900,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '10px',
}

const ctaTitle: React.CSSProperties = {
  margin: 0,
  color: '#0B214E',
  fontWeight: 900,
  lineHeight: 1.15,
  maxWidth: '760px',
}

const ctaButtons: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
}

const ctaPrimary: React.CSSProperties = {
  textDecoration: 'none',
  padding: '14px 18px',
  borderRadius: '16px',
  background: 'linear-gradient(135deg, #56D8AE 0%, #B8E61A 100%)',
  color: '#081B44',
  fontWeight: 900,
  boxShadow: '0 12px 26px rgba(184,230,26,0.20)',
}

const ctaSecondary: React.CSSProperties = {
  textDecoration: 'none',
  padding: '14px 18px',
  borderRadius: '16px',
  background: '#EEF4FF',
  color: '#12356E',
  fontWeight: 900,
  border: '1px solid rgba(17,53,110,0.10)',
}

const footerStyle: React.CSSProperties = {
  background: '#081C44',
  marginTop: '20px',
  borderTop: '1px solid rgba(255,255,255,0.06)',
}

const footerInner: React.CSSProperties = {
  maxWidth: '1240px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '14px',
}

const footerBrandLink: React.CSSProperties = {
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
}

const footerTagline: React.CSSProperties = {
  color: 'rgba(223,234,255,0.82)',
  fontSize: '14px',
  fontWeight: 700,
  textAlign: 'center',
}

const footerUtilityRow: React.CSSProperties = {
  display: 'flex',
  gap: '14px',
  flexWrap: 'wrap',
  justifyContent: 'center',
}

const footerUtilityLink: React.CSSProperties = {
  color: '#D9E7FF',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: '14px',
}

const footerBottom: React.CSSProperties = {
  color: 'rgba(223,234,255,0.64)',
  fontSize: '13px',
  fontWeight: 700,
  textAlign: 'center',
}

const svgStyle: React.CSSProperties = {
  width: '22px',
  height: '22px',
  display: 'block',
}