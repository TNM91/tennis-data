'use client'

import Link from 'next/link'
import BrandWordmark from '@/app/components/brand-wordmark'
import { FOOTER_NAV_SECTIONS, PRIMARY_NAV_ITEMS } from '@/lib/site-navigation'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

const META_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/legal/privacy', label: 'Privacy' },
  { href: '/legal/terms', label: 'Terms' },
]

const FOOTER_JOURNEY: Record<string, { step: string; intent: string; note: string }> = {
  '/explore': { step: '1', intent: 'Find', note: 'Players, teams, leagues' },
  '/mylab': { step: '2', intent: 'You', note: 'Your scorecard' },
  '/matchup': { step: '3', intent: 'Compare', note: 'Who to play next' },
  '/captain': { step: '4', intent: 'Run', note: 'Team decisions' },
}

export default function SiteFooter() {
  const { isTablet, isMobile } = useViewportBreakpoints()

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
            gridTemplateColumns: isTablet ? '1fr' : 'minmax(320px, 1fr) auto',
            gap: isMobile ? 14 : 18,
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'grid', gap: 10 }}>
            <Link href="/" aria-label="TenAceIQ home" style={{ width: 'fit-content' }}>
              <BrandWordmark footer />
            </Link>

            <p
              style={{
                margin: 0,
                maxWidth: '540px',
                color: 'var(--footer-text)',
                fontSize: '14px',
                lineHeight: 1.5,
                fontWeight: 600,
              }}
            >
              Find what matters. Personalize the read. Compare the next match. Go play.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: isTablet ? 'flex-start' : 'flex-end' }}>
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
            const visual = FOOTER_JOURNEY[item.href]
            return (
              <Link key={item.href} href={item.href} style={footerJourneyCardStyle}>
                <span style={footerJourneyStepStyle}>{visual.step}</span>
                <span style={footerJourneyTextStyle}>
                  <strong style={footerJourneyLabelStyle}>{item.label}</strong>
                  <small style={footerJourneyIntentStyle}>{visual.intent}</small>
                  <em style={footerJourneyNoteStyle}>{visual.note}</em>
                </span>
              </Link>
            )
          })}
        </div>

        <nav
          aria-label="Footer"
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
            gap: isMobile ? 18 : 22,
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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isTablet ? '1fr' : '1fr auto',
            gap: isMobile ? 10 : 16,
            alignItems: 'center',
            paddingTop: 10,
            borderTop: '1px solid rgba(116, 190, 255, 0.08)',
          }}
        >

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px 14px',
              alignItems: 'center',
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
  borderRadius: '999px',
  border: '1px solid rgba(155, 225, 29, 0.28)',
  background: 'linear-gradient(135deg, #9BE11D 0%, #C7F36B 100%)',
  color: 'var(--text-dark)',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 900,
  letterSpacing: '-0.02em',
  boxShadow: '0 12px 24px rgba(155, 225, 29, 0.10)',
} as const

const footerSecondaryCtaStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '40px',
  padding: '0 15px',
  borderRadius: '999px',
  border: '1px solid rgba(116, 190, 255, 0.14)',
  background: 'transparent',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 800,
  letterSpacing: '-0.02em',
} as const

const footerJourneyGridStyle = (isMobile: boolean) => ({
  display: 'grid',
  gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))',
  gap: isMobile ? '10px' : '12px',
  paddingTop: 12,
  borderTop: '1px solid rgba(116, 190, 255, 0.08)',
}) as const

const footerJourneyCardStyle = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: '12px',
  alignItems: 'center',
  minHeight: '72px',
  padding: '12px 14px',
  borderRadius: '14px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
} as const

const footerJourneyStepStyle = {
  width: '30px',
  height: '30px',
  borderRadius: '999px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, var(--brand-green), var(--brand-lime))',
  color: 'var(--text-dark)',
  fontSize: '12px',
  fontWeight: 950,
} as const

const footerJourneyTextStyle = {
  display: 'grid',
  gap: '2px',
  lineHeight: 1.12,
} as const

const footerJourneyLabelStyle = {
  color: 'var(--foreground-strong)',
  fontSize: '13.5px',
  fontWeight: 900,
} as const

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
} as const

const backToTopStyle = {
  border: '1px solid rgba(116, 190, 255, 0.14)',
  background: 'transparent',
  color: 'var(--foreground-strong)',
  minHeight: '38px',
  padding: '0 14px',
  borderRadius: '999px',
  fontSize: '13px',
  fontWeight: 800,
  cursor: 'pointer',
} as const
