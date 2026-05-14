'use client'

import Link from 'next/link'
import BrandWordmark from '@/app/components/brand-wordmark'
import NavLockIcon from '@/app/components/nav-lock-icon'
import { useAuth } from '@/app/components/auth-provider'
import { buildProductAccessState } from '@/lib/access-model'
import {
  getPrimaryNavLockedLabel,
  getPrimaryNavLockedTitle,
  getPrimaryNavTarget,
  PRIMARY_NAV_VISUALS,
} from '@/lib/primary-nav-access'
import { FOOTER_NAV_SECTIONS, PRIMARY_NAV_ITEMS } from '@/lib/site-navigation'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

const META_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/messages?compose=support', label: 'Support' },
  { href: '/legal/privacy', label: 'Privacy' },
  { href: '/legal/terms', label: 'Terms' },
]

const FOOTER_JOURNEY = PRIMARY_NAV_VISUALS

export default function SiteFooter() {
  const { isTablet, isMobile } = useViewportBreakpoints()
  const { role, userId, entitlements, authResolved } = useAuth()
  const authenticated = Boolean(userId) || role !== 'public'
  const resolvedRole = authResolved || !userId ? role : 'member'
  const access = buildProductAccessState(resolvedRole, entitlements)

  return (
    <footer
      style={{
        position: 'relative',
        zIndex: 1,
        padding: `14px max(12px, env(safe-area-inset-right)) calc(18px + env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))`,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1280px',
          margin: '0 auto',
          paddingTop: isMobile ? 14 : 16,
          borderTop: '1px solid rgba(116, 190, 255, 0.10)',
          display: 'grid',
          gap: isMobile ? 14 : 16,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(min(100%, 320px), 1fr) minmax(0, 17rem)',
            gap: isMobile ? 14 : 18,
            alignItems: 'center',
            minWidth: 0,
          }}
        >
          <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
            <Link href="/" aria-label="TenAceIQ home" style={{ width: 'fit-content', maxWidth: '100%' }}>
              <BrandWordmark footer />
            </Link>

            <p
              style={{
                margin: 0,
                maxWidth: '540px',
                minWidth: 0,
                color: 'var(--footer-text)',
                fontSize: '14px',
                lineHeight: 1.5,
                fontWeight: 600,
                overflowWrap: 'anywhere',
              }}
            >
              Find what matters. Personalize the read. Compare the next match. Go play.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: isTablet ? 'flex-start' : 'flex-end', minWidth: 0 }}>
            <Link href="/join" style={footerPrimaryCtaStyle}>
              Start Free
            </Link>
            <Link href="/pricing" style={footerSecondaryCtaStyle}>
              Compare plans
            </Link>
          </div>
        </div>

        <div style={footerJourneyGridStyle(isMobile)}>
          {PRIMARY_NAV_ITEMS.map((item) => {
            const visual = FOOTER_JOURNEY[item.href] || { step: '•', intent: item.label, note: '' }
            const navTarget = getPrimaryNavTarget(item.href, access, authenticated)
            const lockedLabel = getPrimaryNavLockedLabel(item.label, navTarget.requiredPlan)
            const lockedTitle = getPrimaryNavLockedTitle(item.label, navTarget.requiredPlan)
            return (
              <Link
                key={item.href}
                href={navTarget.href}
                aria-label={navTarget.locked ? lockedLabel : item.label}
                title={navTarget.locked ? lockedTitle : undefined}
                style={footerJourneyCardStyle(isMobile)}
              >
                <span style={navTarget.locked ? footerJourneyLockStyle(isMobile) : footerJourneyStepStyle(isMobile)}>
                  {navTarget.locked ? <NavLockIcon size={isMobile ? 13 : 14} /> : visual.step}
                </span>
                <span style={footerJourneyTextStyle}>
                  <strong style={footerJourneyLabelStyle(isMobile)}>{item.label}</strong>
                  {isMobile ? null : <small style={footerJourneyIntentStyle}>{visual.intent}</small>}
                  {isMobile ? null : <em style={footerJourneyNoteStyle}>{visual.note}</em>}
                </span>
              </Link>
            )
          })}
        </div>

        {isMobile ? null : (
          <nav
            aria-label="Footer"
            style={{
              display: 'grid',
              gridTemplateColumns: isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))',
              gap: 22,
              paddingTop: 14,
              borderTop: '1px solid rgba(116, 190, 255, 0.08)',
            }}
          >
            {FOOTER_NAV_SECTIONS.map((section) => (
              <div key={section.title} style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
                <div style={footerSectionTitleStyle}>{section.title}</div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {section.items.map((item) => (
                    <Link key={`${section.title}-${item.href}`} href={item.href} style={footerNavLinkStyle}>
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 8.5rem)',
            gap: isMobile ? 10 : 16,
            alignItems: 'center',
            paddingTop: 10,
            borderTop: '1px solid rgba(116, 190, 255, 0.08)',
            minWidth: 0,
          }}
        >

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px 14px',
              alignItems: 'center',
              minWidth: 0,
            }}
          >
            {META_LINKS.map((item) => (
              <Link key={item.href} href={item.href} style={footerMetaLinkStyle}>
                {item.label}
              </Link>
            ))}
          </div>

          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={backToTopStyle}>
            Back to top
          </button>
        </div>

        <div
          style={{
            color: 'var(--footer-meta)',
            fontSize: '12px',
            lineHeight: 1.6,
            fontWeight: 600,
            letterSpacing: '0.02em',
            minWidth: 0,
            overflowWrap: 'anywhere',
          }}
        >
          {'\u00A9'} {new Date().getFullYear()} TenAceIQ. Data. Insight. Competitive advantage.
        </div>
      </div>
    </footer>
  )
}

const footerPrimaryCtaStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '40px',
  padding: '0 15px',
  maxWidth: '100%',
  borderRadius: '999px',
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 900,
  letterSpacing: 0,
  textAlign: 'center',
  boxShadow: '0 12px 24px color-mix(in srgb, var(--brand-green) 12%, transparent), inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
} as const

const footerSecondaryCtaStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '40px',
  padding: '0 15px',
  maxWidth: '100%',
  borderRadius: '999px',
  border: '1px solid rgba(116, 190, 255, 0.14)',
  background: 'transparent',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 800,
  letterSpacing: 0,
  textAlign: 'center',
} as const

const footerJourneyGridStyle = (isMobile: boolean) => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: isMobile ? '8px' : '12px',
  paddingTop: 12,
  borderTop: '1px solid rgba(116, 190, 255, 0.08)',
}) as const

const footerJourneyCardStyle = (isMobile: boolean) => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 2.125rem) minmax(0, 1fr)',
  justifyItems: isMobile ? 'center' : 'start',
  gap: isMobile ? '6px' : '12px',
  alignItems: 'center',
  minWidth: 0,
  minHeight: isMobile ? '78px' : '72px',
  padding: isMobile ? '10px 8px' : '12px 14px',
  borderRadius: '14px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  textAlign: isMobile ? 'center' : 'left',
}) as const

const footerJourneyStepStyle = (isMobile: boolean) => ({
  width: isMobile ? '30px' : '34px',
  height: isMobile ? '30px' : '34px',
  minWidth: 0,
  borderRadius: '999px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'color-mix(in srgb, var(--brand-green) 20%, var(--shell-chip-bg) 80%)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 36%, var(--shell-panel-border) 64%)',
  color: 'var(--foreground-strong)',
  fontSize: isMobile ? '12px' : '13px',
  fontWeight: 950,
  lineHeight: 1,
  boxShadow: '0 10px 22px color-mix(in srgb, var(--brand-green) 12%, transparent), inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
}) as const

const footerJourneyLockStyle = (isMobile: boolean) => ({
  ...footerJourneyStepStyle(isMobile),
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 36%, var(--shell-panel-border) 64%)',
  color: 'var(--foreground-strong)',
}) as const

const footerJourneyTextStyle = {
  display: 'grid',
  gap: '2px',
  lineHeight: 1.12,
  minWidth: 0,
  overflowWrap: 'anywhere',
} as const

const footerJourneyLabelStyle = (isMobile: boolean) => ({
  color: 'var(--foreground-strong)',
  fontSize: isMobile ? '13px' : '13.5px',
  fontWeight: 900,
}) as const

const footerJourneyIntentStyle = {
  color: 'var(--brand-blue-2)',
  fontSize: '9.5px',
  fontWeight: 900,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
} as const

const footerJourneyNoteStyle = {
  color: 'var(--footer-text)',
  fontSize: '12px',
  fontStyle: 'normal',
  fontWeight: 700,
  lineHeight: 1.25,
} as const

const footerNavLinkStyle = {
  color: 'var(--footer-link)',
  fontSize: '14px',
  lineHeight: 1.5,
  fontWeight: 700,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
} as const

const footerSectionTitleStyle = {
  color: 'var(--footer-meta)',
  fontSize: '11px',
  lineHeight: 1.4,
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
} as const

const footerMetaLinkStyle = {
  color: 'var(--footer-meta)',
  fontSize: '13px',
  lineHeight: 1.5,
  fontWeight: 700,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
} as const

const backToTopStyle = {
  border: '1px solid rgba(116, 190, 255, 0.14)',
  background: 'transparent',
  color: 'var(--foreground-strong)',
  minHeight: '38px',
  padding: '0 14px',
  maxWidth: '100%',
  borderRadius: '999px',
  fontSize: '13px',
  fontWeight: 800,
  cursor: 'pointer',
  whiteSpace: 'normal',
} as const
