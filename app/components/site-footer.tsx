'use client'

import Link from 'next/link'
import BrandWordmark from '@/app/components/brand-wordmark'
import { FOOTER_NAV_SECTIONS } from '@/lib/site-navigation'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type SiteFooterProps = {
  railLayout?: boolean
  railWidth?: number
}

const META_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/messages?compose=support', label: 'Support' },
  { href: '/legal/privacy', label: 'Privacy' },
  { href: '/legal/terms', label: 'Terms' },
]

export default function SiteFooter({ railLayout = false, railWidth = 0 }: SiteFooterProps) {
  const { isTablet, isMobile } = useViewportBreakpoints()
  const useRailFooter = railLayout && !isMobile
  const railFooterOffset = railWidth > 0 ? railWidth + 32 : 0
  const showFooterNav = !isMobile && !useRailFooter
  const footerYear = new Date().getFullYear()
  const footerCopy = useRailFooter
    ? `\u00A9 ${footerYear} TenAceIQ.`
    : `\u00A9 ${footerYear} TenAceIQ. Data. Insight. Competitive advantage.`

  function scrollShellToTop() {
    const portalScroller = document.querySelector('[data-portal-content-scroll="true"]')
    if (portalScroller instanceof HTMLElement) {
      portalScroller.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <footer
      style={{
        position: 'relative',
        zIndex: 1,
        padding: useRailFooter
          ? '10px 0 calc(14px + env(safe-area-inset-bottom)) 0'
          : `14px max(12px, env(safe-area-inset-right)) calc(18px + env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))`,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1280px',
          margin: '0 auto',
          paddingLeft: useRailFooter ? railFooterOffset : 0,
          paddingRight: useRailFooter && railWidth > 0 ? 16 : 0,
          boxSizing: 'border-box',
        }}
      >
        <div
          data-site-footer-content="true"
          style={{
            paddingTop: useRailFooter ? 10 : isMobile ? 14 : 16,
            borderTop: '1px solid rgba(116, 190, 255, 0.10)',
            display: 'grid',
            gap: useRailFooter ? 10 : isMobile ? 14 : 16,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr)',
              gap: useRailFooter ? 8 : isMobile ? 14 : 18,
              alignItems: 'center',
              minWidth: 0,
            }}
          >
            <div style={{ display: 'grid', gap: useRailFooter ? 6 : 10, minWidth: 0 }}>
              <Link href="/" aria-label="TenAceIQ home" style={{ width: 'fit-content', maxWidth: '100%' }}>
                <BrandWordmark footer />
              </Link>

              <p
                style={{
                  margin: 0,
                  maxWidth: useRailFooter ? 'none' : '540px',
                  minWidth: 0,
                  color: 'var(--footer-text)',
                  fontSize: useRailFooter ? '13px' : '14px',
                  lineHeight: useRailFooter ? 1.4 : 1.5,
                  fontWeight: 600,
                  overflowWrap: 'anywhere',
                }}
              >
                Find what matters. Personalize the read. Compare the next match. Go play.
              </p>
            </div>
          </div>

          {showFooterNav ? (
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
          ) : null}

          {useRailFooter ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 8.5rem)',
                gap: 10,
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
                  gap: '8px 12px',
                  alignItems: 'center',
                  minWidth: 0,
                }}
              >
                {META_LINKS.map((item) => (
                  <Link key={item.href} href={item.href} style={footerMetaLinkStyle}>
                    {item.label}
                  </Link>
                ))}
                <span style={railFooterCopyrightStyle}>{footerCopy}</span>
              </div>

              <button type="button" onClick={scrollShellToTop} style={backToTopStyle}>
                Back to top
              </button>
            </div>
          ) : (
            <>
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

                <button type="button" onClick={scrollShellToTop} style={backToTopStyle}>
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
                {footerCopy}
              </div>
            </>
          )}
        </div>
      </div>
    </footer>
  )
}

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

const railFooterCopyrightStyle = {
  color: 'var(--footer-meta)',
  fontSize: '12px',
  lineHeight: 1.5,
  fontWeight: 600,
  letterSpacing: '0.02em',
  minWidth: 0,
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
