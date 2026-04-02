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

type QuickAction =
  | { type: 'player'; label: string; playerId: string }
  | { type: 'route'; label: string; href: string }

const QUICK_ACTION_STORAGE_KEY = 'tenaceiq_recent_players'
const FALLBACK_QUICK_ACTIONS: QuickAction[] = [
  { type: 'route', label: 'Top doubles players', href: '/rankings' },
  { type: 'route', label: 'Captain tools', href: '/captains-corner' },
]

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/players', label: 'Players' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/matchup', label: 'Matchup' },
  { href: '/leagues', label: 'Leagues' },
  { href: '/captains-corner', label: "Captain's Corner" },
]

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
  const [recentPlayerActions, setRecentPlayerActions] = useState<QuickAction[]>([])

  const trimmedSearch = useMemo(() => playerSearch.trim(), [playerSearch])
  const shouldShowSuggestions = showSuggestions && trimmedSearch.length >= 2
  const quickActions = useMemo(
    () => [...recentPlayerActions, ...FALLBACK_QUICK_ACTIONS].slice(0, 3),
    [recentPlayerActions]
  )

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
    try {
      const raw = window.localStorage.getItem(QUICK_ACTION_STORAGE_KEY)
      if (!raw) return

      const parsed = JSON.parse(raw) as Array<{ label?: string; playerId?: string }>
      const sanitized: QuickAction[] = parsed
        .filter(
          (item): item is { label: string; playerId: string } =>
            typeof item.label === 'string' && typeof item.playerId === 'string'
        )
        .slice(0, 2)
        .map((item) => ({
          type: 'player',
          label: item.label,
          playerId: item.playerId,
        }))

      setRecentPlayerActions(sanitized)
    } catch {
      setRecentPlayerActions([])
    }
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

    const timeout = window.setTimeout(async () => {
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
          const aStarts = a.name.toLowerCase().startsWith(q) ? 1 : 0
          const bStarts = b.name.toLowerCase().startsWith(q) ? 1 : 0
          if (aStarts !== bStarts) return bStarts - aStarts
          return a.name.localeCompare(b.name)
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
      window.clearTimeout(timeout)
    }
  }, [trimmedSearch])

  async function handlePlayerSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const query = trimmedSearch
    if (!query) {
      setSearchError('Enter a player name to search.')
      return
    }

    setSearchLoading(true)
    setSearchError('')

    try {
      const exact = suggestions.find(
        (row) => row.name.toLowerCase() === query.toLowerCase()
      )

      if (exact) {
        saveRecentPlayer(exact)
        router.push(`/players/${exact.id}`)
        return
      }

      const { data, error } = await supabase
        .from('players')
        .select('id, name')
        .ilike('name', `%${query}%`)
        .order('name', { ascending: true })
        .limit(1)

      if (error) throw new Error(error.message)

      const first = (data || [])[0] as PlayerSearchRow | undefined
      if (!first) {
        setSearchError('No player matched that search.')
        return
      }

      saveRecentPlayer(first)
      router.push(`/players/${first.id}`)
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Search failed.')
    } finally {
      setSearchLoading(false)
    }
  }

  function saveRecentPlayer(player: PlayerSearchRow) {
    const updated: QuickAction[] = [
      { type: 'player', label: player.name, playerId: player.id },
      ...recentPlayerActions.filter(
        (item) => item.type !== 'player' || item.playerId !== player.id
      ),
    ].slice(0, 2)

    setRecentPlayerActions(updated)

    try {
      window.localStorage.setItem(
        QUICK_ACTION_STORAGE_KEY,
        JSON.stringify(
          updated
            .filter((item): item is Extract<QuickAction, { type: 'player' }> => item.type === 'player')
            .map((item) => ({
              label: item.label,
              playerId: item.playerId,
            }))
        )
      )
    } catch {
      // ignore localStorage issues
    }
  }

  function handleSuggestionPick(row: PlayerSearchRow) {
    setPlayerSearch(row.name)
    setShowSuggestions(false)
    setActiveSuggestionIndex(-1)
    saveRecentPlayer(row)
    router.push(`/players/${row.id}`)
  }

  function handleQuickAction(action: QuickAction) {
    if (action.type === 'route') {
      router.push(action.href)
      return
    }

    router.push(`/players/${action.playerId}`)
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!shouldShowSuggestions || suggestions.length === 0) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
      return
    }

    if (event.key === 'Enter') {
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) {
        event.preventDefault()
        handleSuggestionPick(suggestions[activeSuggestionIndex])
      }
      return
    }

    if (event.key === 'Escape') {
      setShowSuggestions(false)
      setActiveSuggestionIndex(-1)
    }
  }

  const dynamicHeaderInner: CSSProperties = {
    ...headerInner,
    flexDirection: isTablet ? 'column' : 'row',
    alignItems: isTablet ? 'flex-start' : 'center',
    gap: isTablet ? '14px' : '18px',
  }

  const dynamicNavStyle: CSSProperties = {
    ...navStyle,
    width: isTablet ? '100%' : 'auto',
    justifyContent: isTablet ? 'flex-start' : 'flex-end',
    flexWrap: 'wrap',
  }

  const dynamicHeroWrap: CSSProperties = {
    ...heroWrap,
    padding: isMobile ? '14px 16px 24px' : '10px 18px 24px',
  }

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isMobile ? '26px 18px 22px' : '34px 28px 24px',
  }

  const dynamicHeroContent: CSSProperties = {
    ...heroContent,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.12fr) minmax(360px, 0.88fr)',
    gap: isMobile ? '18px' : '22px',
  }

  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '34px' : isMobile ? '46px' : '60px',
    lineHeight: isMobile ? 1.05 : 0.98,
    maxWidth: '720px',
  }

  const dynamicHeroText: CSSProperties = {
    ...heroText,
    fontSize: isMobile ? '16px' : '18px',
    maxWidth: '640px',
  }

  const dynamicSearchShell: CSSProperties = {
    ...searchShell,
    padding: isMobile ? '16px' : '18px',
    marginBottom: '16px',
    boxShadow: inputFocused
      ? '0 20px 44px rgba(7,24,53,0.18), 0 0 0 2px rgba(72,161,255,0.18)'
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
    boxShadow: inputFocused ? '0 0 0 2px rgba(64,145,255,0.18)' : 'none',
  }

  const dynamicSearchButton: CSSProperties = {
    ...searchButton,
    width: isSmallMobile ? '100%' : 'auto',
  }

  const dynamicLogoPanel: CSSProperties = {
    ...logoPanel,
    minHeight: isMobile ? '220px' : '252px',
  }

  const dynamicActionGrid: CSSProperties = {
    ...actionGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(240px, 1fr))',
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

  return (
    <main style={pageStyle}>
      <div style={orbOne} />
      <div style={orbTwo} />
      <div style={gridGlow} />

      <header style={headerStyle}>
        <div style={dynamicHeaderInner}>
          <Link href="/" style={brandWrap} aria-label="TenAceIQ home">
            <BrandWordmark compact={isMobile} top />
          </Link>

          <nav style={dynamicNavStyle}>
            {NAV_LINKS.map((link) => {
              const isActive = link.href === '/'
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    ...navLink,
                    ...(isActive ? activeNavLink : {}),
                  }}
                >
                  {link.label}
                </Link>
              )
            })}
            <Link href="/admin" style={navLink}>
              Admin
            </Link>
          </nav>
        </div>
      </header>

      <section style={dynamicHeroWrap}>
        <div style={dynamicHeroShell}>
          <div style={heroNoise} />

          <div style={dynamicHeroContent}>
            <div style={heroLeft}>
              <div style={eyebrow}>Know more. Plan better. Compete smarter.</div>

              <h1 style={dynamicHeroTitle}>
                The fastest way to check player stats, compare matchups, and prepare your lineup.
              </h1>

              <p style={dynamicHeroText}>
                Search players first, then move straight into matchups, rankings, team context, and captain tools.
              </p>

              <div style={quickActionWrap}>
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => handleQuickAction(action)}
                    style={quickActionButton}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
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
                          setShowSuggestions(true)
                          setSearchError('')
                        }}
                        onFocus={() => {
                          setInputFocused(true)
                          if (trimmedSearch.length >= 2) setShowSuggestions(true)
                        }}
                        onBlur={() => setInputFocused(false)}
                        onKeyDown={handleInputKeyDown}
                        placeholder="Search player name..."
                        autoComplete="off"
                        aria-label="Search player name"
                        style={dynamicSearchInput}
                      />
                    </div>

                    <button type="submit" disabled={searchLoading} style={dynamicSearchButton}>
                      {searchLoading ? 'Searching...' : 'Search'}
                    </button>
                  </div>

                  {shouldShowSuggestions ? (
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
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => handleSuggestionPick(player)}
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
                  ) : null}
                </div>

                <div style={searchHelperText}>
                  Search ratings, results, and recent player performance from one place.
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
                      width: isMobile ? '108px' : '118px',
                      height: isMobile ? '108px' : '118px',
                      display: 'block',
                      margin: isMobile ? '14px auto 12px' : '18px auto 12px',
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
              accent="blue"
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
              accent="green"
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
              accent="blue"
            />
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
              <Link href="/players" style={footerUtilityLink}>Players</Link>
              <Link href="/rankings" style={footerUtilityLink}>Rankings</Link>
              <Link href="/matchup" style={footerUtilityLink}>Matchup</Link>
              <Link href="/leagues" style={footerUtilityLink}>Leagues</Link>
              <Link href="/captains-corner" style={footerUtilityLink}>Captain&apos;s Corner</Link>
            </div>

            <div style={dynamicFooterBottom}>
              © {new Date().getFullYear()} TenAceIQ
            </div>
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
  const iconSize = compact ? 30 : top ? 38 : footer ? 36 : 34
  const fontSize = compact ? 24 : top ? 30 : footer ? 27 : 27

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

function MatchupIcon() {
  return (
    <IconBase>
      <path d="M4 17.5V6.8c0-.7.6-1.3 1.3-1.3H12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20 6.5v10.7c0 .7-.6 1.3-1.3 1.3H12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 8.8h5.5M9 12h6.6M9 15.2h4.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconBase>
  )
}

function CaptainIcon() {
  return (
    <IconBase>
      <path d="M7 18v-7.5c0-1.2.8-2 2-2h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17.5 5.5l2 2-4.8 4.8-2.8.7.7-2.8z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M6.5 18.5h11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconBase>
  )
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  position: 'relative',
  overflow: 'hidden',
  background:
    'radial-gradient(circle at top, rgba(66,149,255,0.16), transparent 28%), linear-gradient(180deg, #07111f 0%, #0b1730 42%, #0d1b35 100%)',
}

const orbOne: CSSProperties = {
  position: 'absolute',
  top: '-90px',
  left: '-110px',
  width: '340px',
  height: '340px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(84,163,255,0.18) 0%, rgba(84,163,255,0) 70%)',
  pointerEvents: 'none',
}

const orbTwo: CSSProperties = {
  position: 'absolute',
  right: '-120px',
  top: '180px',
  width: '340px',
  height: '340px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(90,233,176,0.11) 0%, rgba(90,233,176,0) 68%)',
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

const headerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  padding: '24px 18px 0',
}

const headerInner: CSSProperties = {
  width: '100%',
  maxWidth: '1240px',
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
  gap: '10px',
}

const navLink: CSSProperties = {
  color: 'rgba(231,243,255,0.9)',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 700,
  letterSpacing: '0.01em',
  padding: '10px 14px',
  borderRadius: '999px',
  border: '1px solid rgba(122,170,255,0.16)',
  background: 'rgba(22,42,78,0.42)',
  backdropFilter: 'blur(14px)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  transition: 'all 180ms ease',
}

const activeNavLink: CSSProperties = {
  color: '#06111f',
  background: 'linear-gradient(135deg, #4ade80 0%, #86efac 100%)',
  border: '1px solid rgba(134,239,172,0.45)',
  boxShadow: '0 10px 30px rgba(74,222,128,0.22)',
}

const heroWrap: CSSProperties = {
  position: 'relative',
  zIndex: 1,
}

const heroShell: CSSProperties = {
  width: '100%',
  maxWidth: '1240px',
  margin: '0 auto',
  borderRadius: '30px',
  background:
    'linear-gradient(180deg, rgba(16,29,56,0.84) 0%, rgba(13,25,48,0.72) 100%)',
  border: '1px solid rgba(128,174,255,0.12)',
  boxShadow:
    '0 24px 80px rgba(6,18,42,0.24), inset 0 1px 0 rgba(255,255,255,0.05)',
  overflow: 'hidden',
  position: 'relative',
}

const heroNoise: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(circle at 10% 0%, rgba(88,161,255,0.16), transparent 26%), radial-gradient(circle at 100% 0%, rgba(74,222,128,0.08), transparent 30%)',
  pointerEvents: 'none',
}

const heroContent: CSSProperties = {
  display: 'grid',
  alignItems: 'stretch',
  marginBottom: '18px',
  position: 'relative',
  zIndex: 1,
}

const heroLeft: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: '16px',
}

const heroRight: CSSProperties = {
  display: 'grid',
  gap: '14px',
  alignContent: 'start',
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  alignItems: 'center',
  padding: '7px 11px',
  borderRadius: '999px',
  color: '#d6e9ff',
  background: 'rgba(74,123,211,0.18)',
  border: '1px solid rgba(130,178,255,0.18)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const heroTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontWeight: 900,
  letterSpacing: '-0.045em',
}

const heroText: CSSProperties = {
  margin: 0,
  color: 'rgba(224,236,249,0.86)',
  lineHeight: 1.65,
  fontWeight: 500,
}

const heroIQ: CSSProperties = {
  background: 'linear-gradient(135deg, #4ade80 0%, #bbf7d0 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  marginLeft: '2px',
}

const quickActionWrap: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '4px',
}

const quickActionButton: CSSProperties = {
  border: '1px solid rgba(137,182,255,0.14)',
  background: 'rgba(43,78,138,0.34)',
  color: '#e2efff',
  borderRadius: '999px',
  padding: '10px 14px',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
}

const searchShell: CSSProperties = {
  borderRadius: '24px',
  background:
    'linear-gradient(180deg, rgba(43,78,138,0.42) 0%, rgba(20,37,73,0.56) 100%)',
  border: '1px solid rgba(142,184,255,0.18)',
  boxShadow:
    '0 18px 44px rgba(9,25,54,0.16), inset 0 1px 0 rgba(255,255,255,0.05)',
}

const searchTopRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '12px',
  alignItems: 'center',
}

const searchLabel: CSSProperties = {
  color: '#f6fbff',
  fontSize: '15px',
  fontWeight: 800,
  letterSpacing: '-0.02em',
}

const searchShortcutHint: CSSProperties = {
  color: 'rgba(204,220,241,0.76)',
  fontSize: '12px',
  fontWeight: 700,
}

const searchAutocompleteWrap: CSSProperties = {
  position: 'relative',
}

const searchRow: CSSProperties = {
  display: 'flex',
  gap: '12px',
  alignItems: 'center',
}

const searchInputWrap: CSSProperties = {
  position: 'relative',
  flex: 1,
  minWidth: '260px',
}

const searchIconWrap: CSSProperties = {
  position: 'absolute',
  left: '14px',
  top: '50%',
  transform: 'translateY(-50%)',
  color: 'rgba(210,226,244,0.82)',
  pointerEvents: 'none',
}

const searchInput: CSSProperties = {
  width: '100%',
  borderRadius: '18px',
  border: '1px solid rgba(138,182,255,0.16)',
  background: 'rgba(10,20,40,0.6)',
  color: '#f7fbff',
  padding: '15px 16px 15px 46px',
  fontSize: '15px',
  outline: 'none',
}

const searchButton: CSSProperties = {
  border: '1px solid rgba(117,255,188,0.38)',
  background: 'linear-gradient(135deg, #22c55e 0%, #86efac 100%)',
  color: '#03111d',
  borderRadius: '18px',
  padding: '15px 18px',
  fontSize: '14px',
  fontWeight: 900,
  cursor: 'pointer',
  boxShadow: '0 14px 28px rgba(34,197,94,0.18)',
}

const suggestionsDropdown: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 'calc(100% + 10px)',
  borderRadius: '20px',
  overflow: 'hidden',
  background: 'rgba(15,29,58,0.98)',
  border: '1px solid rgba(138,182,255,0.16)',
  boxShadow: '0 24px 60px rgba(6,18,42,0.28)',
  zIndex: 10,
}

const suggestionItem: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  border: 0,
  background: 'transparent',
  color: '#f7fbff',
  padding: '14px 16px',
  textAlign: 'left',
  cursor: 'pointer',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
}

const suggestionItemActive: CSSProperties = {
  background: 'linear-gradient(90deg, rgba(72,133,232,0.18) 0%, rgba(74,222,128,0.1) 100%)',
}

const suggestionPrimary: CSSProperties = {
  fontSize: '14px',
  fontWeight: 700,
}

const suggestionSecondary: CSSProperties = {
  fontSize: '12px',
  fontWeight: 800,
  color: '#bde7ff',
}

const suggestionStatus: CSSProperties = {
  padding: '16px',
  color: 'rgba(211,225,242,0.78)',
  fontSize: '14px',
}

const searchHelperText: CSSProperties = {
  marginTop: '12px',
  color: 'rgba(216,230,246,0.78)',
  fontSize: '13px',
  lineHeight: 1.6,
}

const searchErrorStyle: CSSProperties = {
  marginTop: '10px',
  color: '#ffcbcb',
  fontSize: '13px',
  fontWeight: 700,
}

const logoPanel: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: '24px',
  background:
    'linear-gradient(180deg, rgba(72,124,206,0.42) 0%, rgba(36,66,116,0.52) 100%)',
  border: '1px solid rgba(144,189,255,0.2)',
  boxShadow:
    '0 18px 40px rgba(10,28,58,0.16), inset 0 1px 0 rgba(255,255,255,0.06)',
}

const logoGlow: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'radial-gradient(circle at 50% 20%, rgba(110,187,255,0.18), transparent 38%), radial-gradient(circle at 50% 100%, rgba(74,222,128,0.08), transparent 40%)',
  pointerEvents: 'none',
}

const logoRing: CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  width: '220px',
  height: '220px',
  transform: 'translate(-50%, -50%)',
  borderRadius: '999px',
  border: '1px solid rgba(170,208,255,0.14)',
  boxShadow: '0 0 0 24px rgba(124,176,255,0.05), 0 0 0 54px rgba(124,176,255,0.03)',
  pointerEvents: 'none',
}

const logoPanelInner: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  minHeight: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: '22px 20px 28px',
}

const heroBrandText: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'center',
  gap: '2px',
  fontWeight: 900,
  letterSpacing: '-0.045em',
  fontSize: '38px',
  lineHeight: 1,
  marginBottom: '10px',
}

const heroTenAce: CSSProperties = {
  color: '#f8fbff',
}

const logoPanelText: CSSProperties = {
  margin: 0,
  color: 'rgba(226,238,249,0.82)',
  lineHeight: 1.6,
  fontSize: '14px',
  maxWidth: '330px',
}

const actionGrid: CSSProperties = {
  display: 'grid',
  position: 'relative',
  zIndex: 1,
}

const actionCard: CSSProperties = {
  borderRadius: '22px',
  padding: '18px',
  textDecoration: 'none',
  border: '1px solid rgba(140,184,255,0.18)',
  background: 'linear-gradient(180deg, rgba(65,112,194,0.32) 0%, rgba(28,49,95,0.46) 100%)',
  boxShadow: '0 14px 34px rgba(9,25,54,0.14), inset 0 1px 0 rgba(255,255,255,0.05)',
  transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  minHeight: '210px',
}

const actionCardHover: CSSProperties = {
  transform: 'translateY(-3px)',
  boxShadow: '0 22px 48px rgba(10,28,58,0.2)',
  border: '1px solid rgba(158,197,255,0.28)',
}

const actionCardTop: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '24px',
}

const actionCardIcon: CSSProperties = {
  width: '50px',
  height: '50px',
  borderRadius: '16px',
  display: 'grid',
  placeItems: 'center',
  color: '#f8fbff',
}

const actionCardIconBlue: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(59,130,246,0.94) 0%, rgba(125,211,252,0.88) 100%)',
  boxShadow: '0 12px 24px rgba(59,130,246,0.18)',
}

const actionCardIconGreen: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(34,197,94,0.94) 0%, rgba(110,231,183,0.88) 100%)',
  boxShadow: '0 12px 24px rgba(34,197,94,0.16)',
}

const actionCardIconHover: CSSProperties = {
  transform: 'translateY(-1px) scale(1.02)',
}

const actionBody: CSSProperties = {
  display: 'grid',
  gap: '10px',
}

const actionEyebrow: CSSProperties = {
  color: '#cfe4ff',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const actionTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '22px',
  fontWeight: 900,
  letterSpacing: '-0.03em',
}

const actionText: CSSProperties = {
  color: 'rgba(223,235,248,0.84)',
  lineHeight: 1.65,
  fontWeight: 500,
  fontSize: '14px',
}

const actionFooterRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: '18px',
}

const actionFooterCtaBlue: CSSProperties = {
  color: '#dceeff',
  fontSize: '13px',
  fontWeight: 900,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const actionFooterCtaGreen: CSSProperties = {
  color: '#bbf7d0',
  fontSize: '13px',
  fontWeight: 900,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const actionFooterArrow: CSSProperties = {
  color: '#f8fbff',
  fontSize: '18px',
  fontWeight: 900,
}

const iconSvgStyle: CSSProperties = {
  width: '22px',
  height: '22px',
}

const footerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  padding: '0 18px 20px',
}

const footerInner: CSSProperties = {
  width: '100%',
  maxWidth: '1240px',
  margin: '0 auto',
  borderRadius: '22px',
  background: 'rgba(17,31,58,0.72)',
  border: '1px solid rgba(128,174,255,0.12)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const footerRow: CSSProperties = {
  display: 'flex',
  width: '100%',
}

const footerBrandLink: CSSProperties = {
  display: 'inline-flex',
  textDecoration: 'none',
  flexShrink: 0,
}

const footerLinks: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px 14px',
}

const footerUtilityLink: CSSProperties = {
  color: 'rgba(231,243,255,0.86)',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 700,
}

const footerBottom: CSSProperties = {
  color: 'rgba(190,205,224,0.74)',
  fontSize: '13px',
  fontWeight: 600,
  whiteSpace: 'nowrap',
}
