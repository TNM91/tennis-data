'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import BrandWordmark from '@/app/components/brand-wordmark'
import UniversalSearch from '@/app/components/universal-search'
import { useAuth } from '@/app/components/auth-provider'
import { buildProductAccessState } from '@/lib/access-model'
import { buildAuthEntryHref } from '@/lib/auth-entry-hrefs'
import { isPersonalQuestOwner } from '@/lib/personal-quest'
import { PRIMARY_NAV_ITEMS } from '@/lib/site-navigation'
import { shouldUseCompactSiteHeader } from '@/lib/site-header-responsive'
import { getHeaderWorkspaceShortcut } from '@/lib/site-header-workspace-shortcut'
import { supabase } from '@/lib/supabase'
import { loadUserProfileLink } from '@/lib/user-profile'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type SiteHeaderProps = {
  active?: string
  railLayout?: boolean
  onCompactMenuOpenChange?: (open: boolean) => void
}

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function UtilityLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...utilityLinkStyle,
        color: hovered ? 'var(--foreground-strong)' : utilityLinkStyle.color,
        background: hovered ? 'color-mix(in srgb, var(--brand-blue-2) 9%, transparent 91%)' : utilityLinkStyle.background,
      }}
    >
      {children}
    </Link>
  )
}

function MobileItemLabel({ label, description }: { label: string; description?: string }) {
  return (
    <span style={mobileItemCopyStyle}>
      <span style={mobilePlainItemTextStyle}>{label}</span>
      {description ? <span style={mobileItemDescriptionStyle}>{description}</span> : null}
    </span>
  )
}

export default function SiteHeader({ active, railLayout = false, onCompactMenuOpenChange }: SiteHeaderProps) {
  void active
  const pathname = usePathname()
  const router = useRouter()
  const { role, userId, session, entitlements, authResolved } = useAuth()
  const { screenWidth, isTablet, isMobile } = useViewportBreakpoints()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [linkedPlayerName, setLinkedPlayerName] = useState('')
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('')
  const mountedPathnameRef = useRef<string | null>(null)
  const authenticated = Boolean(userId) || role !== 'public'
  const authPending = !authResolved
  const accessPending = authenticated && (authPending || entitlements === null)
  const resolvedRole = authResolved || !userId ? role : 'member'
  const useCompactHeader = shouldUseCompactSiteHeader({ role: resolvedRole, authenticated, screenWidth })

  useEffect(() => {
    if (mountedPathnameRef.current === null) {
      mountedPathnameRef.current = pathname
      return
    }

    if (mountedPathnameRef.current === pathname) return
    mountedPathnameRef.current = pathname

    const timeout = window.setTimeout(() => {
      setMenuOpen(false)
      setSearchOpen(false)
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen && !searchOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setSearchOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen, searchOpen])

  useEffect(() => {
    const root = document.documentElement
    const shouldMarkCompactMenuOpen = useCompactHeader && menuOpen

    if (shouldMarkCompactMenuOpen) {
      root.dataset.siteCompactMenuOpen = 'true'
    } else {
      delete root.dataset.siteCompactMenuOpen
    }

    onCompactMenuOpenChange?.(shouldMarkCompactMenuOpen)

    return () => {
      delete root.dataset.siteCompactMenuOpen
      onCompactMenuOpenChange?.(false)
    }
  }, [menuOpen, onCompactMenuOpenChange, useCompactHeader])

  useEffect(() => {
    let active = true

    async function loadHeaderProfile() {
      if (!authResolved || !userId) {
        setLinkedPlayerName('')
        setProfilePhotoUrl('')
        return
      }

      const result = await loadUserProfileLink(userId)
      if (!active) return
      setLinkedPlayerName(result.data?.linked_player_name || '')
      setProfilePhotoUrl(result.data?.profile_photo_url || '')
    }

    void loadHeaderProfile()

    return () => {
      active = false
    }
  }, [authResolved, userId])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const useRailHeader = railLayout && !isMobile
  const useCompactBrand = screenWidth < 340
  const access = buildProductAccessState(resolvedRole, entitlements)
  const roleLabel =
    accessPending
      ? 'Account'
      : role === 'admin'
      ? 'Admin'
      : authenticated
        ? access.currentPlanId === 'league'
          ? 'League'
          : access.currentPlanId === 'full_court'
            ? 'Full-Court'
            : access.currentPlanId === 'captain'
              ? 'Captain'
              : access.currentPlanId === 'coach'
                ? 'Coach'
                : access.currentPlanId === 'player_plus'
                  ? 'Player'
                  : 'Free'
        : ''
  const firstName = linkedPlayerName.split(' ')[0] || ''
  const accountLabel = firstName ? `Hi, ${firstName}` : roleLabel
  const showMobileAccountPill = Boolean(accountLabel && (firstName || profilePhotoUrl || accountLabel !== roleLabel))
  const signInNextHref = pathname || '/'
  const signInPlanId = signInNextHref.startsWith('/captain')
    ? 'captain'
    : signInNextHref.startsWith('/league-coordinator')
      ? 'league'
      : 'free'
  const signInHref = buildAuthEntryHref('/login', signInPlanId, signInNextHref, true)
  const joinHref =
    signInPlanId === 'free' ? '/join' : buildAuthEntryHref('/join', signInPlanId, signInNextHref, true)
  const workspaceShortcut = getHeaderWorkspaceShortcut(access, authenticated)
  const compactMenuId = 'site-header-compact-menu'
  const canOpenPersonalQuest = isPersonalQuestOwner({
    id: session?.user?.id ?? userId,
    email: session?.user?.email,
  })

  return (
    <>
    <header
      data-site-header={useRailHeader ? 'rail-fixed' : 'flow'}
      style={{
        position: useRailHeader ? 'fixed' : 'sticky',
        top: 0,
        left: useRailHeader ? 0 : undefined,
        right: useRailHeader ? 0 : undefined,
        zIndex: 40,
        width: useRailHeader ? '100%' : undefined,
        boxSizing: 'border-box',
        overflow: 'visible',
        padding: `max(0px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) 0 max(12px, env(safe-area-inset-left))`,
        background: 'transparent',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'var(--header-bg)',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          insetInline: 0,
          bottom: -24,
          height: 56,
          pointerEvents: 'none',
          background: 'var(--header-fade)',
          filter: 'blur(18px)',
          opacity: 0.9,
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '1280px',
          margin: '0 auto',
          padding: isMobile ? '5px 2px' : useRailHeader ? '7px 8px 5px' : isTablet ? '11px 4px' : '13px 8px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: useCompactHeader
              ? 'minmax(0, 1fr) minmax(0, auto)'
              : 'minmax(0, auto) minmax(0, 1fr) minmax(0, auto)',
            alignItems: 'center',
            gap: isMobile ? '8px' : useCompactHeader ? '12px' : '14px',
            padding: isMobile ? '5px 6px' : useRailHeader ? '4px 0' : useCompactHeader ? '8px 9px' : '8px 10px',
            minWidth: 0,
            overflowWrap: 'anywhere',
            borderRadius: isMobile ? 18 : useCompactHeader ? 999 : 16,
            border: useRailHeader ? '0' : '1px solid color-mix(in srgb, var(--shell-panel-border) 76%, rgba(116,190,255,0.18) 24%)',
            background: useRailHeader
              ? 'transparent'
              : 'linear-gradient(180deg, color-mix(in srgb, var(--header-bg) 86%, var(--surface) 14%) 0%, color-mix(in srgb, var(--header-bg) 94%, transparent 6%) 100%)',
            boxShadow: useRailHeader ? 'none' : '0 14px 34px rgba(2, 10, 24, 0.10), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <Link
            href="/"
            aria-label="TenAceIQ home"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              width: 'fit-content',
              minWidth: 0,
              textDecoration: 'none',
            }}
          >
            <BrandWordmark top compact={useCompactBrand} legacyNav siteHeaderCompact={useCompactHeader} />
          </Link>

          {!useCompactHeader ? (
            <nav aria-label="Primary navigation" style={desktopNavRailStyle}>
              {PRIMARY_NAV_ITEMS.map((item) => (
                <UtilityLink key={item.href} href={item.href}>{item.label}</UtilityLink>
              ))}
            </nav>
          ) : null}

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: isMobile ? '7px' : isTablet ? '8px' : '9px',
              minWidth: 0,
              maxWidth: '100%',
            }}
          >
            {useCompactHeader ? null : (
              <>
                <button
                  type="button"
                  aria-label={searchOpen ? 'Close site search' : 'Open site search'}
                  aria-expanded={searchOpen}
                  aria-controls="site-header-search-panel"
                  aria-haspopup="dialog"
                  onClick={() => {
                    setMenuOpen(false)
                    setSearchOpen((current) => !current)
                  }}
                  style={utilityButtonStyle}
                >
                  Search
                </button>
                <button
                  type="button"
                  aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                  aria-expanded={menuOpen}
                  aria-controls="site-header-desktop-menu"
                  aria-haspopup="dialog"
                  onClick={() => {
                    setSearchOpen(false)
                    setMenuOpen((prev) => !prev)
                  }}
                  style={desktopMenuButtonStyle}
                >
                  Menu
                </button>
              </>
            )}

            {useCompactHeader ? (
              <button
                type="button"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={menuOpen}
                aria-controls={compactMenuId}
                aria-haspopup="dialog"
                onClick={() => setMenuOpen((prev) => !prev)}
                style={useRailHeader ? railHeaderMenuButtonStyle : menuButtonStyle}
              >
                {menuOpen ? <CloseIcon /> : <HamburgerIcon />}
                {useRailHeader ? <span>Menu</span> : null}
              </button>
            ) : null}
          </div>
        </div>

        {!useCompactHeader && searchOpen ? (
          <div
            id="site-header-search-panel"
            role="dialog"
            aria-modal="false"
            aria-labelledby="site-header-search-title"
            style={headerSearchPanelStyle}
          >
            <div style={headerSearchPanelHeaderStyle}>
              <div style={headerSearchTitleBlockStyle}>
                <div style={mobileSectionLabelStyle}>Search</div>
                <h2 id="site-header-search-title" style={headerSearchTitleStyle}>Search TenAceIQ</h2>
              </div>
              <button
                type="button"
                aria-label="Close site search"
                onClick={() => setSearchOpen(false)}
                style={searchCloseButtonStyle}
              >
                <CloseIcon />
              </button>
            </div>
            <UniversalSearch compact placeholder="Search players, teams, leagues, coaches, tournaments, resources, or actions" />
          </div>
        ) : null}

        {!useCompactHeader && menuOpen ? (
          <div
            id="site-header-desktop-menu"
            role="dialog"
            aria-modal="false"
            aria-labelledby="site-header-desktop-menu-title"
            style={desktopMenuPanelStyle}
          >
            <div style={desktopMenuHeaderStyle}>
              <div style={desktopMenuTitleBlockStyle}>
                <div style={mobileSectionLabelStyle}>{accessPending ? 'Account' : authenticated ? roleLabel || 'Account' : 'Menu'}</div>
                <h2 id="site-header-desktop-menu-title" style={desktopMenuTitleStyle}>
                  {authPending ? 'Checking access' : authenticated ? accountLabel || 'Your account' : 'Start playing smarter'}
                </h2>
              </div>
              {profilePhotoUrl && authenticated ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profilePhotoUrl} alt="" style={desktopAccountPhotoStyle} />
              ) : null}
            </div>

            {authPending ? (
              <span aria-live="polite" style={desktopMenuStatusStyle}>Checking account access</span>
            ) : authenticated ? (
              <>
                {workspaceShortcut ? (
                  <Link href={workspaceShortcut.href} onClick={() => setMenuOpen(false)} style={desktopMenuHighlightLinkStyle}>
                    {workspaceShortcut.label}
                  </Link>
                ) : null}
                {canOpenPersonalQuest ? (
                  <Link href="/level-up/my-quest" onClick={() => setMenuOpen(false)} style={desktopMenuLinkStyle}>
                    My Quest
                  </Link>
                ) : null}
                {role === 'admin' ? (
                  <Link href="/admin" onClick={() => setMenuOpen(false)} style={desktopMenuLinkStyle}>
                    Admin dashboard
                  </Link>
                ) : null}
                <div style={desktopMenuDividerStyle} />
                <Link href="/profile" onClick={() => setMenuOpen(false)} style={desktopMenuLinkStyle}>
                  Profile
                </Link>
                <Link href="/messages" onClick={() => setMenuOpen(false)} style={desktopMenuLinkStyle}>
                  Messages
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    void handleLogout()
                  }}
                  style={desktopMenuButtonItemStyle}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <p style={desktopMenuCueStyle}>Search public tennis context first, then open the tool that fits your next match, team, or season.</p>
                <Link href={signInHref} onClick={() => setMenuOpen(false)} style={desktopMenuLinkStyle}>
                  Sign in
                </Link>
                <Link href={joinHref} onClick={() => setMenuOpen(false)} style={desktopMenuHighlightLinkStyle}>
                  Start Free
                </Link>
              </>
            )}
          </div>
        ) : null}

        {useCompactHeader && menuOpen ? (
          <div
            id={compactMenuId}
            role="dialog"
            aria-modal="false"
            aria-label="Site menu"
            style={useRailHeader ? railHeaderMenuWrapStyle : compactMenuWrapStyle}
          >
            <div
              style={{
                ...(useRailHeader ? railHeaderMenuPanelStyle : compactMenuPanelStyle),
              }}
            >
              <div style={mobilePanelTopStyle}>
                <div style={mobileSectionLabelStyle}>{accessPending ? 'Account' : authenticated ? roleLabel || 'Account' : 'Menu'}</div>
                <div style={mobileAccountToolsStyle}>
                  {showMobileAccountPill ? (
                    <span style={mobileAccountPillStyle}>
                      {profilePhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profilePhotoUrl} alt="" style={accountPhotoStyle} />
                      ) : null}
                      {accountLabel}
                    </span>
                  ) : null}
                </div>
              </div>
              <div style={mobileSearchWrapStyle}>
                <UniversalSearch compact placeholder="Search TenAceIQ" showResults={false} />
              </div>
              <p style={mobileMenuCueStyle}>
                Pick the tennis support you need next.
              </p>

              {authPending ? null : authenticated ? (
                <>
                  {PRIMARY_NAV_ITEMS.map((item) => (
                    <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} style={mobileItemStyle}>
                      <MobileItemLabel label={item.label} description={item.description} />
                      <span style={{ opacity: 0.44 }}>{'\u2192'}</span>
                    </Link>
                  ))}
                  {canOpenPersonalQuest ? (
                    <Link href="/level-up/my-quest" onClick={() => setMenuOpen(false)} style={mobileWorkspaceItemStyle}>
                      <MobileItemLabel label="My Quest" description="Open your private Level Up plan." />
                      <span style={{ opacity: 0.62 }}>{'\u2192'}</span>
                    </Link>
                  ) : null}
                  {role === 'admin' ? (
                    <Link href="/admin" onClick={() => setMenuOpen(false)} style={mobileItemStyle}>
                      <MobileItemLabel label="Admin dashboard" />
                      <span style={{ opacity: 0.44 }}>{'\u2192'}</span>
                    </Link>
                  ) : null}
                  {workspaceShortcut ? (
                    <Link href={workspaceShortcut.href} onClick={() => setMenuOpen(false)} style={mobileWorkspaceItemStyle}>
                      <MobileItemLabel label={workspaceShortcut.label} description="Continue the active tennis tool." />
                      <span style={{ opacity: 0.62 }}>{'\u2192'}</span>
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                      ...mobileItemStyle,
                      cursor: 'pointer',
                    }}
                  >
                    <MobileItemLabel label="Logout" />
                    <span style={{ opacity: 0.44 }}>{'\u2192'}</span>
                  </button>
                </>
              ) : (
                <>
                  {PRIMARY_NAV_ITEMS.map((item) => (
                    <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} style={mobileItemStyle}>
                      <MobileItemLabel label={item.label} description={item.description} />
                      <span style={{ opacity: 0.44 }}>{'\u2192'}</span>
                    </Link>
                  ))}
                  <Link href={signInHref} onClick={() => setMenuOpen(false)} style={mobileItemStyle}>
                    <MobileItemLabel label="Sign in" description="Open your saved tennis work." />
                    <span style={{ opacity: 0.44 }}>{'\u2192'}</span>
                  </Link>
                  <Link
                    href={joinHref}
                    onClick={() => setMenuOpen(false)}
                    style={{
                      ...mobileItemStyle,
                      ...primaryCtaStyle,
                      minHeight: '52px',
                      justifyContent: 'space-between',
                    }}
                  >
                    <MobileItemLabel label="Start Free" description="Explore public tennis context before upgrading." />
                    <span style={{ opacity: 0.62 }}>{'\u2192'}</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </header>
    {useRailHeader ? <div aria-hidden="true" style={railHeaderSpacerStyle} /> : null}
    </>
  )
}

const utilityLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 0,
  minHeight: '42px',
  padding: '0 10px',
  borderRadius: '999px',
  border: 'none',
  color: 'var(--header-link)',
  fontSize: '13.5px',
  fontWeight: 700,
  letterSpacing: 0,
  textDecoration: 'none',
  background: 'transparent',
  whiteSpace: 'normal' as const,
  maxWidth: '100%',
  overflow: 'hidden',
  overflowWrap: 'anywhere',
  textOverflow: 'ellipsis',
} as const

const accountPillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  maxWidth: '100%',
  minHeight: '30px',
  padding: '0 10px',
  borderRadius: '999px',
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-green) 10%, var(--shell-chip-bg) 90%)',
  color: 'var(--foreground-strong)',
  fontSize: '11px',
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  whiteSpace: 'normal' as const,
  overflow: 'hidden',
  overflowWrap: 'anywhere',
  textOverflow: 'ellipsis',
} as const

const mobileAccountPillStyle = {
  ...accountPillStyle,
  justifyContent: 'flex-start',
  flex: '1 1 auto',
  minWidth: 0,
  maxWidth: '100%',
  width: '100%',
} as const

const accountPhotoStyle = {
  width: '20px',
  height: '20px',
  borderRadius: '999px',
  objectFit: 'cover' as const,
  display: 'block',
}

const utilityButtonStyle = {
  appearance: 'none',
  border: 'none',
  background: 'transparent',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '42px',
  padding: '0 10px',
  borderRadius: '999px',
  color: 'var(--header-link)',
  fontSize: '13.5px',
  fontWeight: 700,
  letterSpacing: 0,
  cursor: 'pointer',
  whiteSpace: 'normal' as const,
  maxWidth: '100%',
  overflow: 'hidden',
  overflowWrap: 'anywhere',
  textOverflow: 'ellipsis',
} as const

const desktopNavRailStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  justifySelf: 'center',
  gap: 4,
  minWidth: 0,
  maxWidth: '100%',
  padding: '0 8px',
  borderRadius: 12,
  border: '1px solid color-mix(in srgb, var(--shell-panel-border) 72%, rgba(116,190,255,0.14) 28%)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 42%, transparent 58%)',
  overflow: 'hidden',
}

const desktopMenuButtonStyle = {
  ...utilityButtonStyle,
  minWidth: '82px',
  border: '1px solid color-mix(in srgb, var(--shell-panel-border) 78%, rgba(116,190,255,0.16) 22%)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 68%, transparent 32%)',
  color: 'var(--foreground-strong)',
} as const

const primaryCtaStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 0,
  maxWidth: '100%',
  minHeight: '44px',
  padding: '0 20px',
  borderRadius: '999px',
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  fontSize: '13.5px',
  fontWeight: 900,
  letterSpacing: 0,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
  boxShadow: '0 12px 24px color-mix(in srgb, var(--brand-green) 14%, transparent), inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
} as const

const workspaceShortcutStyle = {
  ...primaryCtaStyle,
  minHeight: '38px',
  padding: '0 14px',
  background: 'color-mix(in srgb, var(--brand-blue-2) 14%, var(--shell-chip-bg) 86%)',
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 34%, var(--shell-panel-border) 66%)',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
} as const

const desktopMenuPanelStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 3,
  top: 'calc(100% - 2px)',
  right: 'max(14px, env(safe-area-inset-right))',
  width: 'min(310px, calc(100vw - 28px))',
  display: 'grid',
  gap: 8,
  padding: 12,
  borderRadius: 16,
  border: '1px solid color-mix(in srgb, var(--shell-panel-border) 78%, rgba(116,190,255,0.16) 22%)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--shell-panel-bg) 96%, var(--surface) 4%) 0%, color-mix(in srgb, var(--shell-panel-bg) 92%, var(--surface-soft) 8%) 100%)',
  boxShadow: '0 20px 48px rgba(2, 10, 24, 0.26), inset 0 1px 0 rgba(255,255,255,0.05)',
}

const desktopMenuHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minWidth: 0,
  padding: '2px 2px 8px',
}

const desktopMenuTitleBlockStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
}

const desktopMenuTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 17,
  fontWeight: 900,
  letterSpacing: 0,
  lineHeight: 1.15,
  overflowWrap: 'anywhere',
}

const desktopAccountPhotoStyle: CSSProperties = {
  ...accountPhotoStyle,
  width: 34,
  height: 34,
  flex: '0 0 auto',
}

const desktopMenuStatusStyle: CSSProperties = {
  ...accountPillStyle,
  justifyContent: 'flex-start',
  width: '100%',
  boxSizing: 'border-box',
}

const desktopMenuLinkStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  minHeight: 42,
  padding: '0 12px',
  borderRadius: 10,
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 820,
  letterSpacing: 0,
  background: 'transparent',
  border: '1px solid transparent',
}

const desktopMenuHighlightLinkStyle: CSSProperties = {
  ...workspaceShortcutStyle,
  justifyContent: 'space-between',
  width: '100%',
  minHeight: 44,
  boxSizing: 'border-box',
  borderRadius: 10,
}

const desktopMenuButtonItemStyle: CSSProperties = {
  ...desktopMenuLinkStyle,
  width: '100%',
  cursor: 'pointer',
  appearance: 'none',
  textAlign: 'left',
}

const desktopMenuDividerStyle: CSSProperties = {
  height: 1,
  background: 'var(--shell-panel-border)',
  margin: '2px 0',
}

const desktopMenuCueStyle: CSSProperties = {
  margin: 0,
  borderRadius: 10,
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-chip-bg) 92%)',
  color: 'var(--foreground-strong)',
  padding: '10px 12px',
  fontSize: 12,
  fontWeight: 850,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
}

const menuButtonStyle = {
  width: '44px',
  height: '44px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '12px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 82%, transparent 18%)',
  color: 'var(--foreground-strong)',
  cursor: 'pointer',
} as const

const railHeaderMenuButtonStyle = {
  ...menuButtonStyle,
  width: 'auto',
  minWidth: '84px',
  padding: '0 12px',
  gap: '7px',
  borderRadius: '999px',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 74%, transparent 26%)',
  fontSize: '13px',
  fontWeight: 850,
  letterSpacing: 0,
} as const

const railHeaderSpacerStyle: CSSProperties = {
  height: 'var(--header-height)',
  minHeight: 'var(--header-height)',
  width: '100%',
  flex: '0 0 auto',
  pointerEvents: 'none',
}

const mobileItemStyle = {
  width: '100%',
  minWidth: 0,
  minHeight: '58px',
  padding: '8px 14px',
  boxSizing: 'border-box',
  borderRadius: '15px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: '14px',
  fontWeight: 700,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
  gap: '12px',
  textAlign: 'left' as const,
} as const

const mobileWorkspaceItemStyle = {
  ...mobileItemStyle,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 34%, var(--shell-panel-border) 66%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 14%, var(--shell-chip-bg) 86%)',
} as const

const mobilePlainItemTextStyle = {
  minWidth: 0,
  overflowWrap: 'anywhere',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
} as const

const mobileItemCopyStyle = {
  display: 'grid',
  gap: '3px',
  minWidth: 0,
  overflowWrap: 'anywhere',
} as const

const mobileItemDescriptionStyle = {
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  fontWeight: 720,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
} as const

const mobileMenuCueStyle = {
  margin: '0',
  borderRadius: '14px',
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-chip-bg) 92%)',
  color: 'var(--foreground-strong)',
  padding: '10px 12px',
  fontSize: '12px',
  fontWeight: 850,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
} as const

const mobileSectionLabelStyle = {
  color: 'var(--muted-strong)',
  fontSize: '11px',
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
} as const

const mobilePanelTopStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: '10px',
  paddingBottom: '2px',
  minWidth: 0,
}

const compactMenuWrapStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxHeight: 'calc(100dvh - 120px)',
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
}

const compactMenuPanelStyle: CSSProperties = {
  marginTop: '10px',
  border: '1px solid color-mix(in srgb, var(--shell-panel-border) 78%, rgba(116,190,255,0.16) 22%)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--shell-panel-bg) 96%, var(--surface) 4%) 0%, color-mix(in srgb, var(--shell-panel-bg) 92%, var(--surface-soft) 8%) 100%)',
  borderRadius: '20px',
  padding: '12px',
  boxShadow: 'var(--shadow-card)',
  display: 'grid',
  gap: '8px',
}

const railHeaderMenuWrapStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 3,
  top: 'calc(100% - 4px)',
  right: '8px',
  width: 'min(360px, calc(100vw - 28px))',
  maxHeight: 'calc(100dvh - 74px)',
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
}

const railHeaderMenuPanelStyle: CSSProperties = {
  ...compactMenuPanelStyle,
  marginTop: 0,
  borderRadius: 16,
  padding: 10,
  gap: 7,
  background: 'linear-gradient(180deg, rgba(8,18,34,0.985) 0%, rgba(7,17,33,0.975) 100%)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  boxShadow: '0 20px 48px rgba(2, 10, 24, 0.28), inset 0 1px 0 rgba(255,255,255,0.05)',
}

const mobileAccountToolsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, auto)',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  minWidth: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
}

const headerSearchPanelStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: 'min(920px, calc(100% - clamp(24px, 5vw, 32px)))',
  margin: '10px auto 0',
  padding: 14,
  borderRadius: 22,
  border: '1px solid color-mix(in srgb, var(--shell-panel-border) 78%, rgba(116,190,255,0.16) 22%)',
  background:
    'linear-gradient(180deg, color-mix(in srgb, var(--shell-panel-bg) 96%, var(--surface) 4%) 0%, color-mix(in srgb, var(--shell-panel-bg) 92%, var(--surface-soft) 8%) 100%)',
  boxShadow: 'var(--shadow-card)',
}

const headerSearchPanelHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minWidth: 0,
  marginBottom: 10,
}

const headerSearchTitleBlockStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
}

const headerSearchTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: '18px',
  fontWeight: 900,
  letterSpacing: 0,
  lineHeight: 1.15,
}

const searchCloseButtonStyle: CSSProperties = {
  width: 40,
  height: 40,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
  borderRadius: 13,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  cursor: 'pointer',
}

const mobileSearchWrapStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
  padding: '8px 4px 10px',
}
