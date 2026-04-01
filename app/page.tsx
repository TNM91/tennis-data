'use client'

import Image from 'next/image'
import Link from 'next/link'
import {
  CSSProperties,
  FormEvent,
  KeyboardEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

type PlayerSearchRow = {
  id: string
  name: string
}

const QUICK_SEARCHES = ['Nathan Meinert', 'Top doubles players']

export default function HomePage() {
  const router = useRouter()
  const searchRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [playerSearch, setPlayerSearch] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [suggestions, setSuggestions] = useState<PlayerSearchRow[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const [screenWidth, setScreenWidth] = useState(1280)
  const [inputFocused, setInputFocused] = useState(false)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  const trimmedSearch = useMemo(() => playerSearch.trim(), [playerSearch])
  const shouldShowSuggestions = showSuggestions && trimmedSearch.length >= 2
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
    const timer = window.setTimeout(() => {
      inputRef.current?.focus()
    }, 220)
    return () => window.clearTimeout(timer)
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
    }, 180)

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

    if (
      e.key === 'Enter' &&
      shouldShowSuggestions &&
      activeSuggestionIndex >= 0 &&
      activeSuggestionIndex < suggestions.length
    ) {
      e.preventDefault()
      handleSuggestionClick(suggestions[activeSuggestionIndex])
    }
  }

  const dynamicHeaderInner: CSSProperties = {
    ...headerInner,
    padding: isMobile ? '14px 16px' : '16px 20px',
    justifyContent: isMobile ? 'center' : 'space-between',
  }

  const dynamicNavStyle: CSSProperties = {
    ...navStyle,
    justifyContent: isMobile ? 'center' : 'flex-start',
    gap: isMobile ? '8px' : '10px',
  }

  const dynamicNavLink: CSSProperties = {
    ...navLink,
    padding: isMobile ? '9px 12px' : '10px 14px',
    fontSize: isMobile ? '14px' : '15px',
    background: isMobile ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.02)',
    color: '#D6E5FF',
  }

  const dynamicHeroSection: CSSProperties = {
    ...heroSection,
    padding: isMobile ? '18px 12px 24px' : '30px 20px 28px',
  }

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    borderRadius: isMobile ? '24px' : '34px',
  }

  const dynamicHeroContent: CSSProperties = {
    ...heroContent,
    gridTemplateColumns: isTablet ? '1fr' : '1.02fr 0.98fr',
    gap: isTablet ? '20px' : '28px',
    padding: isMobile ? '28px 18px 24px' : '38px 38px 26px',
  }

  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '32px' : isMobile ? '42px' : '60px',
    lineHeight: isMobile ? 1.04 : 0.98,
    maxWidth: '700px',
  }

  const dynamicHeroText: CSSProperties = {
    ...heroText,
    fontSize: isMobile ? '16px' : '18px',
    maxWidth: '620px',
  }

  const dynamicSearchShell: CSSProperties = {
    ...searchShell,
    padding: isMobile ? '16px' : '18px',
    marginBottom: '18px',
    boxShadow: inputFocused
      ? '0 22px 44px rgba(3,10,25,0.24), 0 0 0 2px rgba(86,216,174,0.28)'
      : searchShell.boxShadow,
  }

  const dynamicSearchRow: CSSProperties = {
    ...searchRow,
    flexDirection: isSmallMobile ? 'column' : 'row',
  }

  const dynamicSearchInputWrap: CSSProperties = {
    ...searchInputWrap,
    width: isSmallMobile ? '100%' : undefined,
    minWidth: isSmallMobile ? '100%' : '260px',
  }

  const dynamicSearchInput: CSSProperties = {
    ...searchInput,
    boxShadow: inputFocused ? '0 0 0 2px rgba(36,146,255,0.22)' : 'none',
  }

  const dynamicSearchButton: CSSProperties = {
    ...searchButton,
    width: isSmallMobile ? '100%' : 'auto',
    filter: searchLoading ? 'saturate(0.92)' : 'none',
  }

  const dynamicLogoPanel: CSSProperties = {
    ...logoPanel,
    minHeight: isMobile ? '220px' : '250px',
    opacity: inputFocused ? 0.95 : 1,
  }

  const dynamicActionGrid: CSSProperties = {
    ...actionGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(260px, 1fr))',
    gap: isMobile ? '12px' : '14px',
    gridColumn: isTablet ? 'auto' : '1 / -1',
    alignItems: 'stretch',
  }

  const dynamicFooterInner: CSSProperties = {
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
            <div style={heroLeft}>
              <div style={eyebrow}>Know more. Plan better. Compete smarter.</div>

              <h1 style={dynamicHeroTitle}>
                The fastest way to check player stats, compare matchups, and prepare your lineup.
              </h1>

              <p style={dynamicHeroText}>
                Search players first, then move straight into matchups, rankings, and captain tools.
              </p>
            </div>

            <div style={heroRight}>
              <form onSubmit={handlePlayerSearch} style={dynamicSearchShell}>
                <div style={searchTopRow}>
                  <div style={searchLabel}>Search a player</div>
                  {!isSmallMobile ? <div style={searchShortcutHint}>Use ↑ ↓ Enter</div> : null}
                </div>

                <div ref={searchRef} style={searchAutocompleteWrap}>
                  <div style={dynamicSearchRow}>
                    <div style={dynamicSearchInputWrap}>
                      <div style={searchIconWrap}>
                        <SearchIcon />
                      </div>

                      <input
                        ref={inputRef}
                        type="text"
                        value={playerSearch}
                        onChange={(e) => {
                          setPlayerSearch(e.target.value)
                          setSearchError('')
                          setShowSuggestions(true)
                        }}
                        onFocus={() => {
                          setInputFocused(true)
                          if (trimmedSearch.length >= 2) setShowSuggestions(true)
                        }}
                        onBlur={() => setInputFocused(false)}
                        onKeyDown={handleInputKeyDown}
                        placeholder="Search player name..."
                        style={dynamicSearchInput}
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
                        <div style={suggestionStatus}>
                          <div style={loadingBar} />
                          <div style={loadingBarShort} />
                        </div>
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

              <div style={dynamicLogoPanel}>
                <div style={logoGlow} />
                <div style={logoRing} />
                <div style={logoPanelInner}>
                  <Image
                    src="/logo-icon.png"
                    alt="TenAceIQ"
                    width={512}
                    height={512}
                    priority
                    style={{
                      width: isMobile ? '108px' : '116px',
                      height: isMobile ? '108px' : '116px',
                      display: 'block',
                      margin: '0 auto 10px',
                      objectFit: 'contain',
                    }}
                  />
                  <div style={heroBrandText}>
                    <span style={heroTenAce}>TenAce</span>
                    <span style={heroIQ}>IQ</span>
                  </div>
                  <p style={logoPanelText}>
                    Premium player analytics, matchup insight, league context, and captain prep built for competitive tennis.
                  </p>
                </div>
              </div>
            </div>

            <div style={dynamicActionGrid}>
              <ActionCard
                href="/players"
                eyebrow="Explore"
                title="Players"
                text="Profiles, ratings, and performance history."
                icon={<PlayersIcon />}
                hovered={hoveredCard === '/players'}
                onEnter={() => setHoveredCard('/players')}
                onLeave={() => setHoveredCard(null)}
              />
              <ActionCard
                href="/matchup"
                eyebrow="Prepare"
                title="Matchup"
                text="Compare players before match day."
                icon={<MatchupIcon />}
                hovered={hoveredCard === '/matchup'}
                onEnter={() => setHoveredCard('/matchup')}
                onLeave={() => setHoveredCard(null)}
              />
              <ActionCard
                href="/captains-corner"
                eyebrow="Captain tools"
                title="Captain's Corner"
                text="Lineups, scenarios, and captain prep."
                icon={<CaptainIcon />}
                hovered={hoveredCard === '/captains-corner'}
                onEnter={() => setHoveredCard('/captains-corner')}
                onLeave={() => setHoveredCard(null)}
              />
              <ActionCard
                href="/rankings"
                title="Rankings"
                text="See how the field stacks up."
                icon={<RankingsIcon />}
                hovered={hoveredCard === '/rankings'}
                onEnter={() => setHoveredCard('/rankings')}
                onLeave={() => setHoveredCard(null)}
              />
              <ActionCard
                href="/leagues"
                title="Leagues"
                text="Track league and team context."
                icon={<LeaguesIcon />}
                hovered={hoveredCard === '/leagues'}
                onEnter={() => setHoveredCard('/leagues')}
                onLeave={() => setHoveredCard(null)}
              />
              <ActionCard
                href="/teams"
                title="Teams"
                text="Review team and lineup detail."
                icon={<PlayersIcon />}
                hovered={hoveredCard === '/teams'}
                onEnter={() => setHoveredCard('/teams')}
                onLeave={() => setHoveredCard(null)}
              />
            </div>
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

function ActionCard({
  href,
  eyebrow,
  title,
  text,
  icon,
  hovered,
  onEnter,
  onLeave,
}: {
  href: string
  eyebrow?: string
  title: string
  text: string
  icon: ReactNode
  hovered: boolean
  onEnter: () => void
  onLeave: () => void
}) {
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
    </Link>
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
      <path
        d="M12 4l2.1 4.2L19 9l-3.5 3.3.8 4.7-4.3-2.2-4.3 2.2.8-4.7L5 9l4.9-.8L12 4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
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

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  position: 'relative',
  overflow: 'hidden',
  fontFamily: 'Arial, sans-serif',
  background: 'linear-gradient(180deg, #06142E 0%, #0A1C42 25%, #EDF4FB 25%, #F8FBFE 100%)',
}

const orbOne: CSSProperties = {
  position: 'absolute',
  top: -80,
  left: -80,
  width: 320,
  height: 320,
  borderRadius: '50%',
  background: 'rgba(76,199,199,0.16)',
  filter: 'blur(70px)',
  pointerEvents: 'none',
}

const orbTwo: CSSProperties = {
  position: 'absolute',
  top: 280,
  right: -100,
  width: 360,
  height: 360,
  borderRadius: '50%',
  background: 'rgba(171,225,29,0.12)',
  filter: 'blur(78px)',
  pointerEvents: 'none',
}

const gridGlow: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  opacity: 0.42,
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
  backgroundSize: '42px 42px',
}

const headerStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 60,
  backdropFilter: 'blur(16px)',
  background: 'rgba(7, 21, 47, 0.72)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
}

const headerInner: CSSProperties = {
  maxWidth: '1180px',
  margin: '0 auto',
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
  flexWrap: 'wrap',
}

const brandWrap: CSSProperties = {
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
}

const navStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
}

const navLink: CSSProperties = {
  textDecoration: 'none',
  color: '#DCE8FF',
  fontWeight: 700,
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.05)',
}

const heroSection: CSSProperties = {
  position: 'relative',
  zIndex: 1,
}

const heroShell: CSSProperties = {
  position: 'relative',
  maxWidth: '1180px',
  margin: '0 auto',
  overflow: 'hidden',
  background: 'linear-gradient(135deg, #091A46 0%, #0F2A63 55%, #153A78 100%)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 30px 80px rgba(3,10,25,0.28)',
}

const heroNoise: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  background:
    'radial-gradient(circle at 12% 16%, rgba(92,219,186,0.11), transparent 28%), radial-gradient(circle at 85% 18%, rgba(173,255,47,0.10), transparent 26%), radial-gradient(circle at 52% 100%, rgba(255,255,255,0.05), transparent 35%)',
}

const heroContent: CSSProperties = {
  display: 'grid',
  alignItems: 'start',
  position: 'relative',
  zIndex: 1,
}

const heroLeft: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '18px',
  minWidth: 0,
}

const heroRight: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  alignSelf: 'flex-start',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.10)',
  color: '#DDE9FF',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontSize: '12px',
  padding: '8px 14px',
}

const heroTitle: CSSProperties = {
  margin: 0,
  color: '#FFFFFF',
  fontWeight: 900,
  letterSpacing: '-0.045em',
}

const heroText: CSSProperties = {
  margin: 0,
  color: 'rgba(231,240,255,0.88)',
  lineHeight: 1.72,
  fontWeight: 500,
}

const searchShell: CSSProperties = {
  borderRadius: '26px',
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.12)',
  boxShadow: '0 20px 40px rgba(3,10,25,0.18)',
  backdropFilter: 'blur(14px)',
}

const searchTopRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  marginBottom: '14px',
  flexWrap: 'wrap',
}

const searchLabel: CSSProperties = {
  color: '#FFFFFF',
  fontWeight: 800,
  fontSize: '16px',
}

const searchShortcutHint: CSSProperties = {
  color: 'rgba(223,234,255,0.74)',
  fontSize: '13px',
  fontWeight: 700,
  paddingTop: '3px',
}

const searchAutocompleteWrap: CSSProperties = {
  position: 'relative',
  zIndex: 20,
}

const searchRow: CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  gap: '12px',
}

const searchInputWrap: CSSProperties = {
  position: 'relative',
  flex: 1,
  minWidth: 0,
}

const searchIconWrap: CSSProperties = {
  position: 'absolute',
  left: '14px',
  top: '28px',
  transform: 'translateY(-50%)',
  width: '20px',
  height: '20px',
  color: '#1F4D9A',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
  zIndex: 2,
}

const searchInput: CSSProperties = {
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

const searchButton: CSSProperties = {
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

const suggestionsDropdown: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 10px)',
  left: 0,
  right: 0,
  background: '#FFFFFF',
  borderRadius: '18px',
  border: '1px solid rgba(8,32,79,0.08)',
  overflow: 'hidden',
  boxShadow: '0 20px 44px rgba(6,19,48,0.18)',
  maxHeight: '280px',
  overflowY: 'auto',
  zIndex: 40,
}

const suggestionItem: CSSProperties = {
  width: '100%',
  border: 'none',
  background: '#FFFFFF',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  padding: '15px 16px',
  cursor: 'pointer',
  textAlign: 'left',
}

const suggestionItemActive: CSSProperties = {
  background: '#F2F7FF',
}

const suggestionPrimary: CSSProperties = {
  color: '#102A5E',
  fontWeight: 800,
  fontSize: '15px',
}

const suggestionSecondary: CSSProperties = {
  color: '#2563EB',
  fontWeight: 700,
  fontSize: '13px',
  whiteSpace: 'nowrap',
}

const suggestionStatus: CSSProperties = {
  padding: '16px 18px',
  color: '#465A84',
  fontWeight: 700,
  fontSize: '14px',
}

const loadingBar: CSSProperties = {
  width: '74%',
  height: '10px',
  borderRadius: '999px',
  background: 'linear-gradient(90deg, #eef4ff 0%, #d8e7ff 50%, #eef4ff 100%)',
  marginBottom: '10px',
}

const loadingBarShort: CSSProperties = {
  width: '46%',
  height: '10px',
  borderRadius: '999px',
  background: 'linear-gradient(90deg, #eef4ff 0%, #d8e7ff 50%, #eef4ff 100%)',
}

const searchHelperText: CSSProperties = {
  marginTop: '12px',
  color: 'rgba(223,234,255,0.80)',
  fontSize: '13px',
  lineHeight: 1.5,
  fontWeight: 600,
}

const quickSearchRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '14px',
}

const quickSearchChip: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.08)',
  color: '#E8F0FF',
  borderRadius: '999px',
  padding: '9px 14px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '13px',
}

const searchErrorStyle: CSSProperties = {
  marginTop: '12px',
  color: '#FFD4D4',
  fontWeight: 700,
  fontSize: '14px',
}

const logoPanel: CSSProperties = {
  position: 'relative',
  borderRadius: '28px',
  overflow: 'hidden',
  background: 'linear-gradient(180deg, rgba(6,17,49,0.18) 0%, rgba(7,22,59,0.08) 100%)',
  border: '1px solid rgba(255,255,255,0.06)',
  boxShadow: '0 18px 42px rgba(3,10,25,0.16)',
}

const logoGlow: CSSProperties = {
  position: 'absolute',
  inset: '24% 24%',
  borderRadius: '50%',
  background: 'rgba(112,230,185,0.08)',
  filter: 'blur(28px)',
  opacity: 0.6,
  pointerEvents: 'none',
}

const logoRing: CSSProperties = {
  position: 'absolute',
  inset: '22px',
  borderRadius: '28px',
  border: '1px solid rgba(255,255,255,0.06)',
  pointerEvents: 'none',
}

const logoPanelInner: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  minHeight: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  gap: '10px',
  padding: '26px 22px',
}

const logoPanelText: CSSProperties = {
  margin: 0,
  maxWidth: '320px',
  color: 'rgba(231,240,255,0.78)',
  fontWeight: 600,
  fontSize: '14px',
  lineHeight: 1.55,
}

const actionGrid: CSSProperties = {
  display: 'grid',
}

const actionCard: CSSProperties = {
  textDecoration: 'none',
  borderRadius: '20px',
  background: '#FFFFFF',
  border: '1px solid rgba(7,27,77,0.05)',
  boxShadow: '0 14px 30px rgba(9,22,54,0.07)',
  display: 'flex',
  gap: '14px',
  alignItems: 'flex-start',
  minHeight: '132px',
  padding: '18px 16px',
}

const actionCardHover: CSSProperties = {
  transform: 'translateY(-3px) scale(1.01)',
  boxShadow: '0 22px 44px rgba(9,22,54,0.12)',
  border: '1px solid rgba(36,146,255,0.12)',
}

const actionCardTop: CSSProperties = {
  display: 'flex',
}

const actionCardIcon: CSSProperties = {
  width: '44px',
  height: '44px',
  minWidth: '44px',
  borderRadius: '14px',
  background: 'linear-gradient(135deg, rgba(37,91,227,0.08), rgba(184,230,26,0.18))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
  color: '#103170',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const actionCardIconHover: CSSProperties = {
  transform: 'scale(1.04)',
  boxShadow: '0 10px 22px rgba(16,49,112,0.14)',
}

const actionBody: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
}

const actionEyebrow: CSSProperties = {
  color: '#5872A6',
  fontSize: '10px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const actionTitle: CSSProperties = {
  color: '#0F234F',
  fontWeight: 900,
  fontSize: '16px',
  lineHeight: 1.2,
}

const actionText: CSSProperties = {
  color: '#4C618D',
  fontWeight: 600,
  fontSize: '12px',
  lineHeight: 1.45,
}

const heroBrandText: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  fontWeight: 900,
  fontSize: 'clamp(34px, 4vw, 46px)',
  lineHeight: 1,
  letterSpacing: '-0.045em',
}

const heroTenAce: CSSProperties = {
  color: '#FFFFFF',
}

const heroIQ: CSSProperties = {
  background: 'linear-gradient(135deg, #D8F94A 0%, #36D56D 68%, #2492FF 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
}

const footerStyle: CSSProperties = {
  marginTop: '8px',
  background: '#081C44',
  borderTop: '1px solid rgba(255,255,255,0.06)',
}

const footerInner: CSSProperties = {
  maxWidth: '1180px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '14px',
}

const footerBrandLink: CSSProperties = {
  textDecoration: 'none',
}

const footerTagline: CSSProperties = {
  color: 'rgba(223,234,255,0.82)',
  fontSize: '14px',
  fontWeight: 700,
  textAlign: 'center',
}

const footerUtilityRow: CSSProperties = {
  display: 'flex',
  gap: '14px',
  flexWrap: 'wrap',
  justifyContent: 'center',
}

const footerUtilityLink: CSSProperties = {
  color: '#D9E7FF',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: '14px',
}

const footerBottom: CSSProperties = {
  color: 'rgba(223,234,255,0.64)',
  fontSize: '13px',
  fontWeight: 700,
  textAlign: 'center',
}

const iconSvgStyle: CSSProperties = {
  width: '22px',
  height: '22px',
  display: 'block',
}
