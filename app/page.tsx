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
import { supabase } from '@/lib/supabase'
import { getUserRole, type UserRole } from '@/lib/roles'
import SiteShell from '@/app/components/site-shell'

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
  const [hoveredQuickAction, setHoveredQuickAction] = useState<string | null>(null)
  const [searchButtonHovered, setSearchButtonHovered] = useState(false)
  const [previewCtaHovered, setPreviewCtaHovered] = useState(false)

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
      }
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setRole(getUserRole(session?.user?.id ?? null))
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

  const myLabHref = role === 'public' ? '/join' : '/mylab'
  const myLabLabel = role === 'public' ? 'Unlock My Lab' : 'Open My Lab'

  const dynamicHeroGrid: CSSProperties = {
    ...heroGrid,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.06fr) minmax(420px, 0.94fr)',
    gap: isMobile ? '18px' : '24px',
  }

  const dynamicHeroTitle: CSSProperties = {
    ...heroTitle,
    fontSize: isSmallMobile ? '38px' : isMobile ? '50px' : '70px',
    lineHeight: isMobile ? 1.02 : 0.95,
  }

  const dynamicHeroText: CSSProperties = {
    ...heroText,
    fontSize: isMobile ? '16px' : '18px',
  }

  const dynamicSearchFrame: CSSProperties = {
    ...searchFrame,
    padding: isSmallMobile ? '16px' : isMobile ? '18px' : '20px',
    boxShadow: inputFocused
      ? '0 28px 64px rgba(6,16,36,0.24), 0 0 0 2px rgba(74,163,255,0.2)'
      : (searchFrame.boxShadow as string),
  }

  const dynamicSearchRow: CSSProperties = {
    ...searchRow,
    flexDirection: isSmallMobile ? 'column' : 'row',
    alignItems: isSmallMobile ? 'stretch' : 'center',
  }

  const dynamicSearchInputWrap: CSSProperties = {
    ...searchInputWrap,
    minWidth: isSmallMobile ? '100%' : '280px',
    width: isSmallMobile ? '100%' : undefined,
  }

  const dynamicSearchButton: CSSProperties = {
    ...searchButton,
    width: isSmallMobile ? '100%' : 'auto',
  }

  const dynamicQuickActionGrid: CSSProperties = {
    ...quickActionGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  }

  const dynamicPreviewMetrics: CSSProperties = {
    ...previewMetrics,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  }

  const dynamicAudienceGrid: CSSProperties = {
    ...audienceGrid,
    gridTemplateColumns: isTablet ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  }

  const dynamicActionStrip: CSSProperties = {
    ...actionStrip,
    gridTemplateColumns: isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
  }

  return (
    <SiteShell active="/">
      <section style={pageWrap}>
        <div style={heroShell}>
          <div style={heroGlowTop} />
          <div style={heroGlowRight} />

          <div style={dynamicHeroGrid}>
            <div style={heroLeft}>
              <div style={eyebrow}>Know more. Plan better. Compete smarter.</div>

              <div style={headlineBlock}>
                <h1 style={dynamicHeroTitle}>Your Tennis. Your Team. Your Edge.</h1>
                <p style={dynamicHeroText}>
                  Track your game, analyze matchups, and build winning lineups with the context you need to prepare faster and compete smarter.
                </p>

              <form onSubmit={handlePlayerSearch} style={dynamicSearchFrame}>
                <div style={searchTopRow}>
                  <div>
                    <div style={searchLabel}>Search a player</div>
                    <div style={searchSubLabel}>Start with the name. Jump straight into the data.</div>
                  </div>
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
                        style={searchInput}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={searchLoading}
                      onMouseEnter={() => setSearchButtonHovered(true)}
                      onMouseLeave={() => setSearchButtonHovered(false)}
                      style={{
                        ...dynamicSearchButton,
                        ...(searchButtonHovered ? searchButtonHover : {}),
                      }}
                    >
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
                              <span style={suggestionSecondary}>Open player</span>
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

              </div>

              <div style={sectionLabel}>Recent / featured</div>
              <div style={dynamicQuickActionGrid}>
                {quickActions.map((action) => {
                  const hovered = hoveredQuickAction === action.label
                  return (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => handleQuickAction(action)}
                      onMouseEnter={() => setHoveredQuickAction(action.label)}
                      onMouseLeave={() => setHoveredQuickAction(null)}
                      style={{
                        ...quickActionButton,
                        ...(hovered ? quickActionButtonHover : {}),
                      }}
                    >
                      <span style={quickActionTitle}>{action.label}</span>
                      <span
                        style={{
                          ...quickActionArrow,
                          ...(hovered ? quickActionArrowHover : {}),
                        }}
                      >
                        →
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={heroRight}>
              <div style={previewShell}>
                <div style={previewHeader}>
                  <div style={previewHeaderLeft}>
                    <div style={previewBrandRow}>
                      <div style={previewLogoWrap}>
                        <Image
                          src="/logo-icon.png"
                          alt="TenAceIQ"
                          width={42}
                          height={42}
                          style={{ width: 42, height: 42, objectFit: 'contain' }}
                        />
                      </div>
                      <div>
                        <div style={previewEyebrow}>TenAceIQ</div>
                        <div style={previewTitle}>Your tennis hub</div>
                      </div>
                    </div>
                    <div style={previewText}>
                      Your data, your team, and your progress together in one place so all you have to do is play and keep leveling up.
                    </div>
                  </div>

                  <Link
                    href={myLabHref}
                    onMouseEnter={() => setPreviewCtaHovered(true)}
                    onMouseLeave={() => setPreviewCtaHovered(false)}
                    style={{
                      ...previewCta,
                      ...(previewCtaHovered ? previewCtaHover : {}),
                    }}
                  >
                    {myLabLabel}
                  </Link>
                </div>

                <div style={dynamicPreviewMetrics}>
                  <MetricCard label="Your game" value="Tracked" text="Track ratings, results, and progress over time." />
                  <MetricCard label="Your matches" value="Smarter" text="Prepare with matchup context before match day." />
                  <MetricCard label="Your team" value="Ready" text="Move from scouting to lineup decisions without friction." />
                </div>

                <div style={workspaceCard}>
                  <div style={workspaceTopRow}>
                    <div>
                      <div style={workspaceEyebrow}>Platform preview</div>
                      <div style={workspaceTitle}>Everything you need to prepare and progress.</div>
                    </div>
                    <div style={workspaceBadge}>Live workflow</div>
                  </div>

                  <div style={workspaceFlow}>
                    <PreviewStep
                      href="/players"
                      icon={<SearchIcon />}
                      title="Search & scout"
                      text="Jump into player profiles, ratings, and recent form fast."
                    />
                    <PreviewStep
                      href="/matchup"
                      icon={<MatchupIcon />}
                      title="Compare matchups"
                      text="See likely edges, confidence, and scouting context before match day."
                    />
                    <PreviewStep
                      href="/captain"
                      icon={<CaptainIcon />}
                      title="Captain workflow"
                      text="Turn player context into better lineup and team decisions."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={dynamicActionStrip}>
            <ActionTile
              href="/players"
              title="Players"
              text="Profiles, ratings, and recent form."
              icon={<SearchIcon />}
              accent="blue"
              hovered={hoveredCard === '/players'}
              onEnter={() => setHoveredCard('/players')}
              onLeave={() => setHoveredCard(null)}
            />
            <ActionTile
              href="/matchup"
              title="Matchups"
              text="Side-by-side comparison before match day."
              icon={<MatchupIcon />}
              accent="green"
              hovered={hoveredCard === '/matchup'}
              onEnter={() => setHoveredCard('/matchup')}
              onLeave={() => setHoveredCard(null)}
            />
            <ActionTile
              href="/leagues"
              title="Leagues"
              text="Standings, structure, and team context."
              icon={<LeagueIcon />}
              accent="blue"
              hovered={hoveredCard === '/leagues'}
              onEnter={() => setHoveredCard('/leagues')}
              onLeave={() => setHoveredCard(null)}
            />
            <ActionTile
              href="/captain"
              title="Captain"
              text="Availability, planning, and season prep."
              icon={<CaptainIcon />}
              accent="green"
              hovered={hoveredCard === '/captain'}
              onEnter={() => setHoveredCard('/captain')}
              onLeave={() => setHoveredCard(null)}
            />
          </div>
        </div>

        <section style={contentSection}>
          <div style={sectionHeader}>
            <div style={sectionEyebrow}>Built for your tennis life</div>
            <h2 style={sectionTitle}>One platform. Three advantages.</h2>
            <p style={sectionText}>
              TenAceIQ brings your game, your matches, and your team together so you can improve faster, make better decisions, and show up ready.
            </p>
          </div>

          <div style={dynamicAudienceGrid}>
            <AudienceCard
              href="/players"
              eyebrow="Your game"
              title="Track your progress"
              text="Follow ratings, form, and performance trends so you can see where your game is moving."
              bullets={['Ratings trends', 'Recent performance', 'Player profiles']}
              accent="blue"
            />
            <AudienceCard
              href="/matchup"
              eyebrow="Your matches"
              title="Prepare with confidence"
              text="Compare players quickly, understand likely edges, and step on court with better prep."
              bullets={['Matchup analysis', 'Scouting context', 'Better prep']}
              accent="green"
            />
            <AudienceCard
              href="/captain"
              eyebrow="Your team"
              title="Lead your lineup"
              text="Build smarter lineups, manage availability, and run your team with less guesswork."
              bullets={['Lineup planning', 'Availability', 'Captain workflow']}
              accent="blue"
            />
          </div>
        </section>

        <section style={contentSection}>
          <div style={premiumSectionCard}>
            <div style={sectionHeader}>
              <div style={sectionEyebrow}>Captain tier</div>
              <h2 style={sectionTitle}>Win your league before match day.</h2>
              <p style={sectionText}>
                Captain tools should feel like a competitive edge, not extra admin work. Build smarter lineups, prepare with more confidence, and keep your team aligned in one workflow.
              </p>
            </div>

            <div style={premiumFeatureGrid}>
              <div style={premiumFeatureCard}>
                <div style={premiumFeatureTitle}>Lineup optimizer</div>
                <div style={premiumFeatureText}>Turn player context into better lineup decisions faster.</div>
              </div>
              <div style={premiumFeatureCard}>
                <div style={premiumFeatureTitle}>Match predictions</div>
                <div style={premiumFeatureText}>See likely edges before the first ball is hit.</div>
              </div>
              <div style={premiumFeatureCard}>
                <div style={premiumFeatureTitle}>Availability tracking</div>
                <div style={premiumFeatureText}>Know who is ready so lineup choices are easier.</div>
              </div>
              <div style={premiumFeatureCard}>
                <div style={premiumFeatureTitle}>Team workflow</div>
                <div style={premiumFeatureText}>Keep captain planning and match prep connected.</div>
              </div>
            </div>

            <div style={premiumCtaRow}>
              <Link href={myLabHref} style={previewCta}>{myLabLabel}</Link>
              <Link href="/captain" style={secondaryInlineLink}>Explore captain tools →</Link>
            </div>
          </div>
        </section>

        <section style={contentSection}>
          <div style={sectionHeader}>
            <div style={sectionEyebrow}>Come back every week</div>
            <h2 style={sectionTitle}>A smarter pulse on your tennis community.</h2>
            <p style={sectionText}>
              The best version of TenAceIQ is alive every time you open it — from player movement to fresh results to what matters next in your league.
            </p>
          </div>

          <div style={weeklyGrid}>
            <div style={weeklyCard}>
              <div style={weeklyCardTitle}>Trending players</div>
              <div style={weeklyCardText}>Spot who is rising and who is becoming more dangerous.</div>
            </div>
            <div style={weeklyCard}>
              <div style={weeklyCardTitle}>Biggest movers</div>
              <div style={weeklyCardText}>See rating momentum and recent performance shifts faster.</div>
            </div>
            <div style={weeklyCard}>
              <div style={weeklyCardTitle}>Recent results</div>
              <div style={weeklyCardText}>Keep up with what just happened across your league and community.</div>
            </div>
          </div>
        </section>

      </section>
    </SiteShell>
  )
}

function MetricCard({
  label,
  value,
  text,
}: {
  label: string
  value: string
  text: string
}) {
  return (
    <div style={metricCard}>
      <div style={metricLabel}>{label}</div>
      <div style={metricValue}>{value}</div>
      <div style={metricText}>{text}</div>
    </div>
  )
}

function PreviewStep({
  href,
  icon,
  title,
  text,
}: {
  href: string
  icon: ReactNode
  title: string
  text: string
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={href}
      style={{
        ...previewStep,
        ...(hovered ? previewStepHover : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          ...previewStepIcon,
          ...(hovered ? previewStepIconHover : {}),
        }}
      >
        {icon}
      </div>
      <div style={previewStepBody}>
        <div style={previewStepTitle}>{title}</div>
        <div style={previewStepText}>{text}</div>
      </div>
      <div
        style={{
          ...previewStepArrow,
          ...(hovered ? previewStepArrowHover : {}),
        }}
      >
        →
      </div>
    </Link>
  )
}

function ActionTile({
  href,
  title,
  text,
  icon,
  accent,
  hovered,
  onEnter,
  onLeave,
}: {
  href: string
  title: string
  text: string
  icon: ReactNode
  accent: 'blue' | 'green'
  hovered: boolean
  onEnter: () => void
  onLeave: () => void
}) {
  const accentStyles = accent === 'green' ? tileAccentGreen : tileAccentBlue
  const iconAccent = accent === 'green' ? tileIconGreen : tileIconBlue
  const iconHoverAccent = accent === 'green' ? tileIconGreenHover : tileIconBlueHover

  return (
    <Link
      href={href}
      style={{
        ...actionTile,
        ...accentStyles,
        ...(hovered ? actionTileHover : {}),
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div
        style={{
          ...actionTileIcon,
          ...iconAccent,
          ...(hovered ? iconHoverAccent : {}),
        }}
      >
        {icon}
      </div>
      <div style={actionTileTitle}>{title}</div>
      <div style={actionTileText}>{text}</div>
      <div style={actionTileFooter}>Open →</div>
    </Link>
  )
}

function AudienceCard({
  href,
  eyebrow,
  title,
  text,
  bullets,
  accent,
}: {
  href: string
  eyebrow: string
  title: string
  text: string
  bullets: string[]
  accent: 'blue' | 'green'
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...audienceCard,
        ...(accent === 'green' ? audienceCardGreen : audienceCardBlue),
        ...(hovered ? audienceCardHover : {}),
      }}
    >
      <div style={audienceEyebrow}>{eyebrow}</div>
      <div style={audienceTitle}>{title}</div>
      <div style={audienceText}>{text}</div>
      <div style={audienceBulletList}>
        {bullets.map((item) => (
          <div key={item} style={audienceBulletItem}>
            <span
              style={{
                ...audienceBulletDot,
                ...(hovered ? audienceBulletDotHover : {}),
              }}
            />
            <span>{item}</span>
          </div>
        ))}
      </div>
      <div
        style={{
          ...audienceFooter,
          ...(hovered ? audienceFooterHover : {}),
        }}
      >
        Explore →
      </div>
    </Link>
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

function LeagueIcon() {
  return (
    <IconBase>
      <path
        d="M6 6.5h12M6 12h12M6 17.5h12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="8" cy="6.5" r="1.2" fill="currentColor" />
      <circle cx="16" cy="12" r="1.2" fill="currentColor" />
      <circle cx="11" cy="17.5" r="1.2" fill="currentColor" />
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

const pageWrap: CSSProperties = {
  display: 'grid',
  gap: '18px',
  position: 'relative',
  zIndex: 1,
  paddingTop: '12px',
}

const heroShell: CSSProperties = {
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '42px 24px 24px',
  borderRadius: '32px',
  background:
    'linear-gradient(180deg, rgba(22,47,90,0.68) 0%, rgba(13,28,55,0.84) 26%, rgba(8,18,35,0.92) 100%)',
  border: '1px solid rgba(116,190,255,0.18)',
  boxShadow:
    '0 30px 90px rgba(4,12,28,0.24), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 0 80px rgba(88,170,255,0.05)',
  overflow: 'hidden',
  position: 'relative',
}

const heroGlowTop: CSSProperties = {
  position: 'absolute',
  width: '560px',
  height: '560px',
  left: '-160px',
  top: '-240px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(74,163,255,0.22) 0%, transparent 66%)',
  pointerEvents: 'none',
}

const heroGlowRight: CSSProperties = {
  position: 'absolute',
  width: '520px',
  height: '520px',
  right: '-190px',
  top: '-40px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(155,225,29,0.12) 0%, transparent 68%)',
  pointerEvents: 'none',
}

const heroGrid: CSSProperties = {
  display: 'grid',
  alignItems: 'stretch',
  position: 'relative',
  zIndex: 1,
  marginBottom: '18px',
}

const heroLeft: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: '18px',
}

const heroRight: CSSProperties = {
  display: 'grid',
  alignContent: 'stretch',
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  alignItems: 'center',
  padding: '8px 14px',
  borderRadius: '999px',
  color: '#d9ebff',
  background: 'rgba(37,91,227,0.18)',
  border: '1px solid rgba(116,190,255,0.22)',
  fontSize: '12px',
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const headlineBlock: CSSProperties = {
  display: 'grid',
  gap: '14px',
  maxWidth: '760px',
}

const heroTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontWeight: 900,
  letterSpacing: '-0.055em',
}

const heroText: CSSProperties = {
  margin: 0,
  maxWidth: '650px',
  color: 'rgba(224,236,249,0.86)',
  lineHeight: 1.72,
  fontWeight: 500,
}

const searchFrame: CSSProperties = {
  borderRadius: '24px',
  background:
    'linear-gradient(180deg, rgba(57,112,197,0.24) 0%, rgba(30,61,118,0.24) 28%, rgba(11,22,42,0.84) 100%)',
  border: '1px solid rgba(116,190,255,0.24)',
  boxShadow:
    '0 22px 48px rgba(9,25,54,0.18), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 40px rgba(116,190,255,0.05)',
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

const searchSubLabel: CSSProperties = {
  marginTop: '4px',
  color: 'rgba(204,220,241,0.72)',
  fontSize: '13px',
  lineHeight: 1.5,
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
}

const searchInputWrap: CSSProperties = {
  position: 'relative',
  flex: 1,
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
  background: 'rgba(8,18,35,0.72)',
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
  transition: 'transform 180ms ease, box-shadow 180ms ease, filter 180ms ease',
}

const searchButtonHover: CSSProperties = {
  transform: 'translateY(-2px)',
  boxShadow: '0 16px 30px rgba(155,225,29,0.20)',
  filter: 'brightness(1.03)',
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

const sectionLabel: CSSProperties = {
  color: 'rgba(202,220,241,0.78)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
}

const quickActionGrid: CSSProperties = {
  display: 'grid',
  gap: '10px',
}

const quickActionButton: CSSProperties = {
  border: '1px solid rgba(116,190,255,0.16)',
  background:
    'linear-gradient(180deg, rgba(34,69,129,0.34) 0%, rgba(15,31,61,0.9) 100%)',
  color: '#eaf4ff',
  borderRadius: '18px',
  padding: '14px 16px',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  textAlign: 'left',
  transition: 'transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease, background 180ms ease',
}

const quickActionTitle: CSSProperties = {
  fontSize: '14px',
  fontWeight: 800,
}

const quickActionArrow: CSSProperties = {
  color: 'rgba(215,229,247,0.76)',
  fontSize: '16px',
  fontWeight: 800,
  transition: 'transform 180ms ease, color 180ms ease',
}

const quickActionButtonHover: CSSProperties = {
  transform: 'translateY(-3px)',
  border: '1px solid rgba(116,190,255,0.28)',
  background: 'linear-gradient(180deg, rgba(43,83,154,0.42) 0%, rgba(16,34,68,0.96) 100%)',
  boxShadow: '0 16px 30px rgba(5,12,28,0.16), inset 0 1px 0 rgba(255,255,255,0.05)',
}

const quickActionArrowHover: CSSProperties = {
  color: '#eef8ff',
  transform: 'translateX(2px)',
}

const previewShell: CSSProperties = {
  display: 'grid',
  gap: '14px',
  height: '100%',
  padding: '18px',
  borderRadius: '28px',
  background:
    'linear-gradient(180deg, rgba(18,37,71,0.84) 0%, rgba(11,23,44,0.92) 100%)',
  border: '1px solid rgba(116,190,255,0.16)',
  boxShadow: '0 20px 52px rgba(5,12,28,0.22), inset 0 1px 0 rgba(255,255,255,0.04)',
}

const previewHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '14px',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}

const previewHeaderLeft: CSSProperties = {
  display: 'grid',
  gap: '10px',
  flex: 1,
  minWidth: '220px',
}

const previewBrandRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
}

const previewLogoWrap: CSSProperties = {
  width: '52px',
  height: '52px',
  borderRadius: '16px',
  display: 'grid',
  placeItems: 'center',
  background: 'linear-gradient(180deg, rgba(37,91,227,0.16) 0%, rgba(15,33,66,0.66) 100%)',
  border: '1px solid rgba(116,190,255,0.18)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const previewEyebrow: CSSProperties = {
  color: '#b9d5f6',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const previewTitle: CSSProperties = {
  color: '#f7fbff',
  fontSize: '26px',
  lineHeight: 1.04,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const previewText: CSSProperties = {
  color: 'rgba(216,229,245,0.78)',
  fontSize: '14px',
  lineHeight: 1.7,
  maxWidth: '520px',
}

const previewCta: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '12px 16px',
  borderRadius: '16px',
  textDecoration: 'none',
  color: '#08111d',
  background: 'linear-gradient(135deg, #9BE11D 0%, #C7F36B 100%)',
  border: '1px solid rgba(155,225,29,0.34)',
  fontWeight: 800,
  fontSize: '14px',
  boxShadow: '0 12px 28px rgba(155,225,29,0.14)',
  transition: 'transform 180ms ease, box-shadow 180ms ease, filter 180ms ease',
}

const previewCtaHover: CSSProperties = {
  transform: 'translateY(-2px)',
  boxShadow: '0 16px 34px rgba(155,225,29,0.22)',
  filter: 'brightness(1.03)',
}

const previewMetrics: CSSProperties = {
  display: 'grid',
  gap: '12px',
}

const metricCard: CSSProperties = {
  borderRadius: '20px',
  padding: '16px',
  background:
    'linear-gradient(180deg, rgba(24,47,87,0.72) 0%, rgba(12,24,46,0.92) 100%)',
  border: '1px solid rgba(116,190,255,0.12)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
  display: 'grid',
  gap: '7px',
}

const metricLabel: CSSProperties = {
  color: 'rgba(188,208,232,0.76)',
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
}

const metricValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: '24px',
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const metricText: CSSProperties = {
  color: 'rgba(212,226,244,0.72)',
  fontSize: '13px',
  lineHeight: 1.58,
}

const workspaceCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  background:
    'linear-gradient(180deg, rgba(16,31,60,0.9) 0%, rgba(8,18,35,0.96) 100%)',
  border: '1px solid rgba(116,190,255,0.14)',
  boxShadow: '0 18px 44px rgba(5,12,28,0.2), inset 0 1px 0 rgba(255,255,255,0.03)',
  display: 'grid',
  gap: '16px',
}

const workspaceTopRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}

const workspaceEyebrow: CSSProperties = {
  color: 'rgba(188,208,232,0.78)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
}

const workspaceTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '22px',
  lineHeight: 1.08,
  fontWeight: 900,
  letterSpacing: '-0.04em',
  marginTop: '6px',
}

const workspaceBadge: CSSProperties = {
  padding: '8px 12px',
  borderRadius: '999px',
  background: 'rgba(155,225,29,0.14)',
  border: '1px solid rgba(155,225,29,0.22)',
  color: '#eaffcf',
  fontSize: '12px',
  fontWeight: 800,
}

const workspaceFlow: CSSProperties = {
  display: 'grid',
  gap: '12px',
}

const previewStep: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '48px minmax(0, 1fr) auto',
  gap: '12px',
  alignItems: 'center',
  padding: '14px',
  borderRadius: '18px',
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(116,190,255,0.10)',
  textDecoration: 'none',
  transition: 'transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease',
}

const previewStepIcon: CSSProperties = {
  width: '48px',
  height: '48px',
  borderRadius: '16px',
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(37,91,227,0.16)',
  color: '#dbe9ff',
  transition: 'transform 180ms ease, box-shadow 180ms ease, background 180ms ease, color 180ms ease',
}

const previewStepBody: CSSProperties = {
  display: 'grid',
  gap: '6px',
}

const previewStepTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '15px',
  fontWeight: 800,
}

const previewStepText: CSSProperties = {
  color: 'rgba(212,226,244,0.72)',
  fontSize: '13px',
  lineHeight: 1.6,
}

const previewStepArrow: CSSProperties = {
  color: 'rgba(216,230,246,0.72)',
  fontSize: '18px',
  fontWeight: 800,
}

const previewStepHover: CSSProperties = {
  transform: 'translateY(-4px)',
  border: '1px solid rgba(116,190,255,0.24)',
  background: 'linear-gradient(180deg, rgba(25,49,90,0.28) 0%, rgba(255,255,255,0.03) 100%)',
  boxShadow: '0 16px 32px rgba(5,12,28,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
}

const previewStepIconHover: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(37,91,227,0.30) 0%, rgba(155,225,29,0.16) 100%)',
  color: '#f2fbff',
  boxShadow: '0 0 0 1px rgba(116,190,255,0.10), 0 10px 24px rgba(37,91,227,0.18)',
  transform: 'scale(1.05)',
}

const previewStepArrowHover: CSSProperties = {
  color: '#dff8ff',
}

const actionStrip: CSSProperties = {
  display: 'grid',
  gap: '12px',
  position: 'relative',
  zIndex: 1,
}

const actionTile: CSSProperties = {
  display: 'grid',
  gap: '10px',
  padding: '18px',
  borderRadius: '22px',
  textDecoration: 'none',
  minHeight: '154px',
  transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
}

const tileAccentBlue: CSSProperties = {
  background:
    'linear-gradient(180deg, rgba(23,47,88,0.76) 0%, rgba(11,24,45,0.94) 100%)',
  border: '1px solid rgba(116,190,255,0.14)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.16), inset 0 1px 0 rgba(255,255,255,0.03)',
}

const tileAccentGreen: CSSProperties = {
  background:
    'linear-gradient(180deg, rgba(32,54,40,0.76) 0%, rgba(14,24,19,0.94) 100%)',
  border: '1px solid rgba(155,225,29,0.14)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.16), inset 0 1px 0 rgba(255,255,255,0.03)',
}

const actionTileHover: CSSProperties = {
  transform: 'translateY(-4px)',
}

const actionTileIcon: CSSProperties = {
  width: '48px',
  height: '48px',
  borderRadius: '15px',
  display: 'grid',
  placeItems: 'center',
  transition: 'transform 180ms ease, box-shadow 180ms ease, background 180ms ease, color 180ms ease',
}

const tileIconBlue: CSSProperties = {
  background: 'rgba(37,91,227,0.16)',
  color: '#dbe9ff',
}

const tileIconGreen: CSSProperties = {
  background: 'rgba(155,225,29,0.14)',
  color: '#efffd5',
}

const tileIconBlueHover: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(37,91,227,0.28) 0%, rgba(74,163,255,0.18) 100%)',
  color: '#f3f9ff',
  transform: 'scale(1.05)',
  boxShadow: '0 10px 24px rgba(37,91,227,0.18)',
}

const tileIconGreenHover: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(155,225,29,0.24) 0%, rgba(74,163,255,0.12) 100%)',
  color: '#f7ffea',
  transform: 'scale(1.05)',
  boxShadow: '0 10px 24px rgba(155,225,29,0.14)',
}

const actionTileTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '22px',
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const actionTileText: CSSProperties = {
  color: 'rgba(215,229,247,0.78)',
  fontSize: '13px',
  lineHeight: 1.65,
}

const actionTileFooter: CSSProperties = {
  marginTop: 'auto',
  color: 'rgba(216,230,246,0.84)',
  fontSize: '13px',
  fontWeight: 800,
}

const contentSection: CSSProperties = {
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  display: 'grid',
  gap: '18px',
}


const sectionHeader: CSSProperties = {
  display: 'grid',
  gap: '10px',
  maxWidth: '760px',
}

const sectionEyebrow: CSSProperties = {
  color: '#b9d5f6',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const sectionTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontSize: '40px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.05em',
}

const sectionText: CSSProperties = {
  margin: 0,
  color: 'rgba(220,233,248,0.78)',
  fontSize: '16px',
  lineHeight: 1.72,
}

const audienceGrid: CSSProperties = {
  display: 'grid',
  gap: '16px',
}

const audienceCard: CSSProperties = {
  display: 'grid',
  gap: '12px',
  padding: '22px',
  borderRadius: '26px',
  textDecoration: 'none',
  boxShadow: '0 18px 44px rgba(7,18,40,0.16), inset 0 1px 0 rgba(255,255,255,0.03)',
  transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
}

const audienceCardBlue: CSSProperties = {
  background:
    'linear-gradient(180deg, rgba(23,47,88,0.78) 0%, rgba(10,21,40,0.96) 100%)',
  border: '1px solid rgba(116,190,255,0.14)',
}

const audienceCardGreen: CSSProperties = {
  background:
    'linear-gradient(180deg, rgba(29,51,34,0.78) 0%, rgba(11,21,16,0.96) 100%)',
  border: '1px solid rgba(155,225,29,0.14)',
}

const audienceEyebrow: CSSProperties = {
  color: 'rgba(188,208,232,0.78)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.11em',
  textTransform: 'uppercase',
}

const audienceTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '30px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const audienceText: CSSProperties = {
  color: 'rgba(215,229,247,0.78)',
  fontSize: '14px',
  lineHeight: 1.72,
}

const audienceBulletList: CSSProperties = {
  display: 'grid',
  gap: '8px',
}

const audienceBulletItem: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  color: '#ebf4ff',
  fontSize: '13px',
  fontWeight: 700,
}

const audienceBulletDot: CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '999px',
  background: 'linear-gradient(135deg, #9BE11D 0%, #C7F36B 100%)',
  flexShrink: 0,
}

const audienceFooter: CSSProperties = {
  marginTop: '6px',
  color: 'rgba(216,230,246,0.84)',
  fontSize: '13px',
  fontWeight: 800,
  transition: 'transform 180ms ease, color 180ms ease',
}

const audienceCardHover: CSSProperties = {
  transform: 'translateY(-4px)',
  boxShadow: '0 22px 50px rgba(7,18,40,0.22), inset 0 1px 0 rgba(255,255,255,0.04)',
}

const audienceBulletDotHover: CSSProperties = {
  boxShadow: '0 0 0 4px rgba(155,225,29,0.08), 0 0 14px rgba(155,225,29,0.22)',
}

const audienceFooterHover: CSSProperties = {
  color: '#f3fbff',
  transform: 'translateX(2px)',
}






const iconSvgStyle: CSSProperties = {
  width: '24px',
  height: '24px',
  display: 'block',
}

const premiumSectionCard: CSSProperties = {
  display: 'grid',
  gap: '18px',
  padding: '24px',
  borderRadius: '28px',
  background: 'linear-gradient(180deg, rgba(24,46,34,0.74) 0%, rgba(10,20,16,0.96) 100%)',
  border: '1px solid rgba(155,225,29,0.16)',
  boxShadow: '0 22px 50px rgba(7,18,40,0.2), inset 0 1px 0 rgba(255,255,255,0.03)',
}

const premiumFeatureGrid: CSSProperties = {
  display: 'grid',
  gap: '14px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
}

const premiumFeatureCard: CSSProperties = {
  display: 'grid',
  gap: '8px',
  padding: '18px',
  borderRadius: '20px',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 100%)',
  border: '1px solid rgba(155,225,29,0.12)',
}

const premiumFeatureTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '18px',
  lineHeight: 1.1,
  fontWeight: 800,
  letterSpacing: '-0.03em',
}

const premiumFeatureText: CSSProperties = {
  color: 'rgba(220,233,248,0.76)',
  fontSize: '14px',
  lineHeight: 1.68,
}

const premiumCtaRow: CSSProperties = {
  display: 'flex',
  gap: '14px',
  alignItems: 'center',
  flexWrap: 'wrap',
}

const secondaryInlineLink: CSSProperties = {
  color: '#dff3ff',
  fontSize: '14px',
  fontWeight: 800,
  textDecoration: 'none',
}

const weeklyGrid: CSSProperties = {
  display: 'grid',
  gap: '14px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
}

const weeklyCard: CSSProperties = {
  display: 'grid',
  gap: '8px',
  padding: '20px',
  borderRadius: '22px',
  background: 'linear-gradient(180deg, rgba(23,47,88,0.72) 0%, rgba(10,21,40,0.96) 100%)',
  border: '1px solid rgba(116,190,255,0.14)',
  boxShadow: '0 18px 44px rgba(7,18,40,0.16), inset 0 1px 0 rgba(255,255,255,0.03)',
}

const weeklyCardTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '20px',
  lineHeight: 1.08,
  fontWeight: 900,
  letterSpacing: '-0.04em',
}

const weeklyCardText: CSSProperties = {
  color: 'rgba(215,229,247,0.78)',
  fontSize: '14px',
  lineHeight: 1.7,
}

