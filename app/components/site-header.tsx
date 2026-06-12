'use client'

import Link from 'next/link'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import BrandWordmark from '@/app/components/brand-wordmark'
import UniversalSearch from '@/app/components/universal-search'
import { useAuth } from '@/app/components/auth-provider'
import { buildProductAccessState, type ProductAccessState } from '@/lib/access-model'
import { isPersonalQuestOwner } from '@/lib/personal-quest'
import { PRIMARY_NAV_ITEMS } from '@/lib/site-navigation'
import { shouldUseCompactSiteHeader } from '@/lib/site-header-responsive'
import { supabase } from '@/lib/supabase'
import { loadUserProfileLink } from '@/lib/user-profile'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

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

function getHeaderWorkspaceShortcut(access: ProductAccessState, authenticated: boolean) {
  if (!authenticated) return null
  if (access.canUseLeagueTools) return { href: '/league-coordinator', label: 'League Office' }
  if (access.canUseCaptainWorkflow) return { href: '/captain', label: 'Team Hub' }
  if (access.canUseCoachWorkflow) return { href: '/coach', label: 'Coach Hub' }
  if (access.canUseAdvancedPlayerInsights) return { href: '/mylab', label: 'My Lab' }
  return { href: '/explore', label: 'Find tennis' }
}

export default function SiteHeader({ active }: { active?: string }) {
  void active
  const pathname = usePathname()
  const router = useRouter()
  const { role, userId, session, entitlements, authResolved } = useAuth()
  const { screenWidth, isTablet, isMobile } = useViewportBreakpoints()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [linkedPlayerName, setLinkedPlayerName] = useState('')
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('')

  useEffect(() => {
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

  const authenticated = Boolean(userId) || role !== 'public'
  const authPending = !authResolved
  const accessPending = authenticated && (authPending || entitlements === null)
  const resolvedRole = authResolved || !userId ? role : 'member'
  const useCompactHeader = shouldUseCompactSiteHeader({ role: resolvedRole, authenticated, screenWidth })
  const useCompactBrand = useCompactHeader
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
  const signInHref = `/login?next=${encodeURIComponent(pathname || '/')}`
  const workspaceShortcut = getHeaderWorkspaceShortcut(access, authenticated)
  const canOpenPersonalQuest = isPersonalQuestOwner({
    id: session?.user?.id ?? userId,
    email: session?.user?.email,
  })

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
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
          padding: isMobile ? '9px 2px' : isTablet ? '11px 4px' : '13px 8px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: useCompactHeader
              ? 'minmax(0, 1fr) minmax(0, auto)'
              : 'minmax(0, auto) minmax(0, 1fr)',
            alignItems: 'center',
            gap: isMobile ? '10px' : useCompactHeader ? '12px' : '16px',
            padding: isMobile ? '7px 7px' : useCompactHeader ? '8px 9px' : '10px 12px',
            minWidth: 0,
            overflowWrap: 'anywhere',
            borderRadius: isMobile ? 18 : 999,
            border: '1px solid color-mix(in srgb, var(--shell-panel-border) 76%, rgba(116,190,255,0.18) 24%)',
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--header-bg) 86%, var(--surface) 14%) 0%, color-mix(in srgb, var(--header-bg) 94%, transparent 6%) 100%)',
            boxShadow: '0 14px 34px rgba(2, 10, 24, 0.10), inset 0 1px 0 rgba(255,255,255,0.04)',
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
            <BrandWordmark top={!useCompactBrand} compact={useCompactBrand} />
          </Link>

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
            {useCompactHeader ? null : authPending ? (
              <span aria-live="polite" style={accountPillStyle}>Checking access</span>
            ) : authenticated ? (
              <>
                {PRIMARY_NAV_ITEMS.map((item) => (
                  <UtilityLink key={item.href} href={item.href}>{item.label}</UtilityLink>
                ))}
                {canOpenPersonalQuest ? (
                  <UtilityLink href="/level-up/my-quest">My Quest</UtilityLink>
                ) : null}
                <button
                  type="button"
                  aria-label={searchOpen ? 'Close site search' : 'Open site search'}
                  aria-expanded={searchOpen}
                  aria-controls="site-header-search-panel"
                  aria-haspopup="dialog"
                  onClick={() => setSearchOpen((current) => !current)}
                  style={utilityButtonStyle}
                >
                  Search
                </button>
                {accountLabel ? (
                  <span style={accountPillStyle}>
                    {profilePhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profilePhotoUrl} alt="" style={accountPhotoStyle} />
                    ) : null}
                    {accountLabel}
                  </span>
                ) : null}
                {workspaceShortcut ? (
                  <Link href={workspaceShortcut.href} style={workspaceShortcutStyle}>
                    {workspaceShortcut.label}
                  </Link>
                ) : null}
                {role === 'admin' ? (
                  <UtilityLink href="/admin">Admin dashboard</UtilityLink>
                ) : null}
                <button type="button" onClick={handleLogout} style={utilityButtonStyle}>
                  Logout
                </button>
              </>
            ) : (
              <>
                {PRIMARY_NAV_ITEMS.map((item) => (
                  <UtilityLink key={item.href} href={item.href}>{item.label}</UtilityLink>
                ))}
                <button
                  type="button"
                  aria-label={searchOpen ? 'Close site search' : 'Open site search'}
                  aria-expanded={searchOpen}
                  aria-controls="site-header-search-panel"
                  aria-haspopup="dialog"
                  onClick={() => setSearchOpen((current) => !current)}
                  style={utilityButtonStyle}
                >
                  Search
                </button>
                <UtilityLink href="/login">Sign in</UtilityLink>
                <Link href="/join" style={primaryCtaStyle}>
                  Start Free
                </Link>
              </>
            )}

            {useCompactHeader ? (
              <button
                type="button"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((prev) => !prev)}
                style={menuButtonStyle}
              >
                {menuOpen ? <CloseIcon /> : <HamburgerIcon />}
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

        {useCompactHeader && menuOpen ? (
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              maxHeight: 'calc(100dvh - 120px)',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <div
              style={{
                marginTop: '10px',
                border: '1px solid color-mix(in srgb, var(--shell-panel-border) 78%, rgba(116,190,255,0.16) 22%)',
                background:
                  'linear-gradient(180deg, color-mix(in srgb, var(--shell-panel-bg) 96%, var(--surface) 4%) 0%, color-mix(in srgb, var(--shell-panel-bg) 92%, var(--surface-soft) 8%) 100%)',
                borderRadius: '20px',
                padding: '12px',
                boxShadow: 'var(--shadow-card)',
                display: 'grid',
                gap: '8px',
              }}
            >
              <div style={mobilePanelTopStyle}>
                <div style={mobileSectionLabelStyle}>{accessPending ? 'Account' : roleLabel || 'Account'}</div>
                <div style={mobileAccountToolsStyle}>
                  {accountLabel ? (
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
                <UniversalSearch compact placeholder="Search TenAceIQ" />
              </div>

              {authPending ? null : authenticated ? (
                <>
                  {PRIMARY_NAV_ITEMS.map((item) => (
                    <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} style={mobileItemStyle}>
                      <span style={mobilePlainItemTextStyle}>{item.label}</span>
                      <span style={{ opacity: 0.44 }}>{'\u2192'}</span>
                    </Link>
                  ))}
                  {canOpenPersonalQuest ? (
                    <Link href="/level-up/my-quest" onClick={() => setMenuOpen(false)} style={mobileWorkspaceItemStyle}>
                      <span style={mobilePlainItemTextStyle}>My Quest</span>
                      <span style={{ opacity: 0.62 }}>{'\u2192'}</span>
                    </Link>
                  ) : null}
                  {role === 'admin' ? (
                    <Link href="/admin" onClick={() => setMenuOpen(false)} style={mobileItemStyle}>
                      <span style={mobilePlainItemTextStyle}>Admin dashboard</span>
                      <span style={{ opacity: 0.44 }}>{'\u2192'}</span>
                    </Link>
                  ) : null}
                  {workspaceShortcut ? (
                    <Link href={workspaceShortcut.href} onClick={() => setMenuOpen(false)} style={mobileWorkspaceItemStyle}>
                      <span style={mobilePlainItemTextStyle}>{workspaceShortcut.label}</span>
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
                    <span style={mobilePlainItemTextStyle}>Logout</span>
                    <span style={{ opacity: 0.44 }}>{'\u2192'}</span>
                  </button>
                </>
              ) : (
                <>
                  {PRIMARY_NAV_ITEMS.map((item) => (
                    <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} style={mobileItemStyle}>
                      <span style={mobilePlainItemTextStyle}>{item.label}</span>
                      <span style={{ opacity: 0.44 }}>{'\u2192'}</span>
                    </Link>
                  ))}
                  <Link href={signInHref} onClick={() => setMenuOpen(false)} style={mobileItemStyle}>
                    <span style={mobilePlainItemTextStyle}>Sign in</span>
                    <span style={{ opacity: 0.44 }}>{'\u2192'}</span>
                  </Link>
                  <Link
                    href="/join"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      ...mobileItemStyle,
                      ...primaryCtaStyle,
                      minHeight: '52px',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={mobilePlainItemTextStyle}>Start Free</span>
                    <span style={{ opacity: 0.62 }}>{'\u2192'}</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </header>
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

const menuButtonStyle = {
  width: '40px',
  height: '40px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '13px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 82%, transparent 18%)',
  color: 'var(--foreground-strong)',
  cursor: 'pointer',
} as const

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
