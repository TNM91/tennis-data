'use client'

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
import DataBallHero from '@/app/components/data-ball-hero'
import { supabase } from '../lib/supabase'
import { getUserRole, type UserRole } from '@/lib/roles'

type PlayerSearchRow = {
  id: string
  name: string
}

type QuickAction =
  | { type: 'player'; label: string; playerId: string }
  | { type: 'route'; label: string; href: string }

const QUICK_ACTION_STORAGE_KEY = 'tenaceiq_recent_players'

const FALLBACK_QUICK_ACTIONS: QuickAction[] = [
  { type: 'route', label: 'Explore rankings', href: '/rankings' },
  { type: 'route', label: 'Browse leagues', href: '/leagues' },
]

const PRIMARY_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/matchup', label: 'Matchups' },
  { href: '/captain', label: 'Captain' },
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
  const [role, setRole] = useState<UserRole>('public')
  const [authLoading, setAuthLoading] = useState(true)

  const trimmedSearch = useMemo(() => playerSearch.trim(), [playerSearch])
  const shouldShowSuggestions = showSuggestions && trimmedSearch.length >= 2
  const quickActions = useMemo(
    () => [...recentPlayerActions, ...FALLBACK_QUICK_ACTIONS].slice(0, 3),
    [recentPlayerActions],
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
            typeof item.label === 'string' && typeof item.playerId === 'string',
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
    async function loadUser() {
      try {
        const { data } = await supabase.auth.getUser()
        setRole(getUserRole(data.user?.id ?? null))
      } finally {
        setAuthLoading(false)
      }
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setRole(getUserRole(session?.user?.id ?? null))
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
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
        (row) => row.name.toLowerCase() === query.toLowerCase(),
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
    const updated = [
      { type: 'player' as const, label: player.name, playerId: player.id },
      ...recentPlayerActions.filter(
        (item) => item.type !== 'player' || item.playerId !== player.id,
      ),
    ].slice(0, 2) as QuickAction[]

    setRecentPlayerActions(updated)

    try {
      window.localStorage.setItem(
        QUICK_ACTION_STORAGE_KEY,
        JSON.stringify(
          updated
            .filter(
              (item): item is Extract<QuickAction, { type: 'player' }> =>
                item.type === 'player',
            )
            .map((item) => ({
              label: item.label,
              playerId: item.playerId,
            })),
        ),
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

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!shouldShowSuggestions || suggestions.length === 0) return

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
    padding: isMobile ? '18px 16px 26px' : '14px 22px 28px',
  }

  const dynamicHeroShell: CSSProperties = {
    ...heroShell,
    padding: isMobile ? '28px 18px 24px' : '38px 30px 28px',
  }

  const dynamicHeroContent: CSSProperties = {
    ...heroContent,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.14fr) minmax(360px, 0.92fr)',
    gap: isMobile ? '20px' : '26px',
  }

  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '36px' : isMobile ? '50px' : '66px',
    lineHeight: isMobile ? 1.04 : 0.97,
    maxWidth: '760px',
  }

  const dynamicHeroText: CSSProperties = {
    ...heroText,
    fontSize: isMobile ? '16px' : '18px',
    maxWidth: '650px',
  }

  const dynamicSearchShell: CSSProperties = {
    ...searchShell,
    padding: isMobile ? '18px' : '20px',
    marginBottom: 0,
    boxShadow: inputFocused
      ? '0 20px 44px rgba(7,24,53,0.18), 0 0 0 2px rgba(74,163,255,0.18)'
      : (searchShell.boxShadow as string),
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
    boxShadow: inputFocused ? '0 0 0 2px rgba(74,163,255,0.18)' : 'none',
  }

  const dynamicSearchButton: CSSProperties = {
    ...searchButton,
    width: isSmallMobile ? '100%' : 'auto',
  }

  const dynamicLogoPanel: CSSProperties = {
    ...logoPanel,
    minHeight: isMobile ? '248px' : '292px',
  }

  const dynamicActionGrid: CSSProperties = {
    ...actionGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(4, minmax(220px, 1fr))',
    gap: isMobile ? '14px' : '16px',
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
      <div style={topBlueWash} />

      <header style={headerStyle}>
        <div style={dynamicHeaderInner}>
          <Link href="/" style={brandWrap} aria-label="TenAceIQ home">
            <BrandWordmark compact={isMobile} top />
          </Link>

          <nav style={dynamicNavStyle}>
            {PRIMARY_LINKS.map((link) => {
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

            <Link href="/leagues" style={navLink}>
              Leagues
            </Link>

            {authLoading ? (
              <span style={{ ...navLink, opacity: 0.72 }}>Loading...</span>
            ) : role === 'public' ? (
              <>
                <Link href="/login" style={navLink}>
                  Login
                </Link>
                <Link href="/join" style={ctaNavLink}>
                  Join
                </Link>
              </>
            ) : (
              <>
                <Link href="/dashboard" style={ctaNavLink}>
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
              </>
            )}
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
                The fastest way to check player stats, compare matchups, and run your tennis season.
              </h1>

              <p style={dynamicHeroText}>
                Search players first, then move straight into public exploration, matchup prep,
                league context, and member tools like My Lab and Captain workflows.
              </p>

              <div style={quickActionLabel}>Recent / featured</div>
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

              <div style={{ ...dynamicLogoPanel, padding: 0 }}>
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: isMobile ? '260px' : '320px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: isMobile ? '18px' : '22px',
                      borderRadius: '24px',
                      border: '1px solid rgba(116,190,255,0.10)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      width: isMobile ? '200px' : '260px',
                      height: isMobile ? '200px' : '260px',
                      borderRadius: '999px',
                      background:
                        'radial-gradient(circle, rgba(116,190,255,0.16) 0%, rgba(155,225,29,0.06) 40%, rgba(116,190,255,0) 72%)',
                      filter: 'blur(12px)',
                    }}
                  />
                  <DataBallHero />
                </div>
              </div>
            </div>
          </div>

          <div style={dynamicActionGrid}>
            <ActionCard
              href="/explore"
              eyebrow="Discover"
              title="Explore"
              text="Players, rankings, leagues, teams, and public activity."
              icon={<ExploreIcon />}
              hovered={hoveredCard === '/explore'}
              onEnter={() => setHoveredCard('/explore')}
              onLeave={() => setHoveredCard(null)}
              accent="blue"
            />

            <ActionCard
              href="/matchup"
              eyebrow="Prepare"
              title="Matchups"
              text="Compare players before match day and see projected edges."
              icon={<MatchupIcon />}
              hovered={hoveredCard === '/matchup'}
              onEnter={() => setHoveredCard('/matchup')}
              onLeave={() => setHoveredCard(null)}
              accent="green"
            />

            <ActionCard
              href={role === 'public' ? '/join' : '/dashboard'}
              eyebrow="Members"
              title="My Lab"
              text="Follow players, teams, and leagues with a personalized feed."
              icon={<LabIcon />}
              hovered={hoveredCard === 'my-lab'}
              onEnter={() => setHoveredCard('my-lab')}
              onLeave={() => setHoveredCard(null)}
              accent="blue"
            />

            <ActionCard
              href="/captain"
              eyebrow="Captain tools"
              title="Captain"
              text="Availability, messaging, lineups, scenarios, and season context."
              icon={<CaptainIcon />}
              hovered={hoveredCard === '/captain'}
              onEnter={() => setHoveredCard('/captain')}
              onLeave={() => setHoveredCard(null)}
              accent="green"
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
              <Link href="/explore" style={footerUtilityLink}>
                Explore
              </Link>
              <Link href="/players" style={footerUtilityLink}>
                Players
              </Link>
              <Link href="/rankings" style={footerUtilityLink}>
                Rankings
              </Link>
              <Link href="/matchup" style={footerUtilityLink}>
                Matchups
              </Link>
              <Link href="/leagues" style={footerUtilityLink}>
                Leagues
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
      <img
        src="/logo-icon.png"
        alt="TenAceIQ"
        width={iconSize}
        height={iconSize}
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

function ExploreIcon() {
  return (
    <IconBase>
      <path
        d="M12 3l2.6 5.4L20 11l-5.4 2.6L12 19l-2.6-5.4L4 11l5.4-2.6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </IconBase>
  )
}

function MatchupIcon() {
  return (
    <IconBase>
      <path
        d="M4 17.5V6.8c0-.7.6-1.3 1.3-1.3H12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M20 6.5v10.7c0 .7-.6 1.3-1.3 1.3H12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M9 8.8h5.5M9 12h6.6M9 15.2h4.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </IconBase>
  )
}

function LabIcon() {
  return (
    <IconBase>
      <path
        d="M9 4v4.2l-3.6 6.3A2 2 0 0 0 7.1 18h9.8a2 2 0 0 0 1.7-3.5L15 8.2V4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.2 13h7.6"
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

const quickActionLabel: CSSProperties = {
  color: 'rgba(202,220,241,0.78)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
}

const quickActionWrap: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '2px',
}

const quickActionButton: CSSProperties = {
  border: '1px solid rgba(116,190,255,0.22)',
  background:
    'linear-gradient(180deg, rgba(54,108,198,0.22) 0%, rgba(29,63,121,0.18) 100%)',
  color: '#eaf4ff',
  borderRadius: '999px',
  padding: '11px 16px',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const searchShell: CSSProperties = {
  borderRadius: '24px',
  background: `
    linear-gradient(180deg, rgba(68, 132, 229, 0.20) 0%, rgba(40, 83, 158, 0.18) 28%, rgba(16, 36, 70, 0.72) 100%)
  `,
  border: '1px solid rgba(116,190,255,0.24)',
  boxShadow:
    '0 18px 44px rgba(9,25,54,0.16), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 40px rgba(116,190,255,0.05)',
}

const searchTopRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '14px',
  alignItems: 'center',
}

const searchLabel: CSSProperties = {
  color: '#f6fbff',
  fontSize: '16px',
  fontWeight: 800,
  letterSpacing: '-0.02em',
}

const searchShortcutHint: CSSProperties = {
  color: 'rgba(204,220,241,0.76)',
  fontSize: '13px',
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
  border: '1px solid rgba(74,163,255,0.18)',
  background: 'rgba(10,20,40,0.6)',
  color: '#f7fbff',
  padding: '17px 16px 17px 46px',
  fontSize: '15px',
  outline: 'none',
}

const searchButton: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.34)',
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
  color: '#08111d',
  borderRadius: '18px',
  padding: '17px 22px',
  fontSize: '15px',
  fontWeight: 800,
  cursor: 'pointer',
  minWidth: '128px',
}

const searchHelperText: CSSProperties = {
  marginTop: '12px',
  color: 'rgba(205,220,241,0.75)',
  fontSize: '14px',
  lineHeight: 1.6,
}

const searchErrorStyle: CSSProperties = {
  marginTop: '12px',
  padding: '10px 12px',
  borderRadius: '14px',
  background: 'rgba(255,104,104,0.12)',
  border: '1px solid rgba(255,130,130,0.18)',
  color: '#ffd3d3',
  fontSize: '13px',
  fontWeight: 700,
}

const suggestionsDropdown: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  left: 0,
  right: 0,
  zIndex: 20,
  borderRadius: '18px',
  overflow: 'hidden',
  border: '1px solid rgba(74,163,255,0.18)',
  background: 'rgba(9,18,35,0.96)',
  backdropFilter: 'blur(18px)',
  boxShadow: '0 20px 48px rgba(0,0,0,0.3)',
}

const suggestionStatus: CSSProperties = {
  padding: '14px 16px',
  color: 'rgba(210,226,244,0.8)',
  fontSize: '14px',
}

const suggestionItem: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '14px 16px',
  background: 'transparent',
  border: 0,
  color: '#f7fbff',
  cursor: 'pointer',
  textAlign: 'left',
}

const suggestionItemActive: CSSProperties = {
  background: 'rgba(37,91,227,0.24)',
}

const suggestionPrimary: CSSProperties = {
  fontSize: '14px',
  fontWeight: 700,
}

const suggestionSecondary: CSSProperties = {
  fontSize: '12px',
  color: 'rgba(192,212,240,0.72)',
}

const logoPanel: CSSProperties = {
  position: 'relative',
  borderRadius: '26px',
  overflow: 'hidden',
  background: `
    linear-gradient(180deg, rgba(24, 49, 93, 0.68) 0%, rgba(16, 33, 64, 0.84) 30%, rgba(13, 26, 50, 0.96) 100%)
  `,
  border: '1px solid rgba(116,190,255,0.20)',
  boxShadow:
    '0 20px 48px rgba(7,18,40,0.24), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 0 56px rgba(116,190,255,0.05)',
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
