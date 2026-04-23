'use client'

import Link from 'next/link'
import BrandWordmark from '@/app/components/brand-wordmark'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

const PRIMARY_LINKS = [
  { href: '/explore', label: 'Explore' },
  { href: '/compete', label: 'Compete' },
  { href: '/captain', label: 'Captain' },
  { href: '/pricing', label: 'Pricing' },
]

const META_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/legal/privacy', label: 'Privacy' },
  { href: '/legal/terms', label: 'Terms' },
]

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
                lineHeight: 1.7,
                fontWeight: 600,
              }}
            >
              Search free, unlock smarter insight when you need it, and bring your team or league into one clean workflow.
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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isTablet ? '1fr' : '1fr auto auto',
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
              gap: '10px 18px',
              alignItems: 'center',
            }}
          >
            {PRIMARY_LINKS.map((item) => (
              <Link key={item.href} href={item.href} style={footerNavLinkStyle}>
                {item.label}
              </Link>
            ))}
          </div>

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

const footerNavLinkStyle = {
  color: 'var(--footer-link)',
  fontSize: '14px',
  lineHeight: 1.5,
  fontWeight: 700,
  textDecoration: 'none',
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
