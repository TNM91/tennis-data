'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import BrandWordmark from '@/app/components/brand-wordmark'
import {
  hoverLift,
  hoverGlowGreen,
  hoverBrighten,
  transitionBase,
} from '@/lib/interaction-styles'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

const PLATFORM_LINKS = [
  { href: '/explore', label: 'Explore' },
  { href: '/matchup', label: 'Matchups' },
  { href: '/captain', label: 'Captain' },
  { href: '/leagues', label: 'Leagues' },
]

const RESOURCE_LINKS = [
  { href: '/players', label: 'Players' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/methodology', label: 'Methodology' },
]

const COMPANY_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/faq', label: 'FAQ' },
  { href: '/login', label: 'Login' },
]

const LEGAL_LINKS = [
  { href: '/legal/privacy', label: 'Privacy' },
  { href: '/legal/terms', label: 'Terms' },
  { href: '/legal/cookies', label: 'Cookies' },
  { href: '/advertising-disclosure', label: 'Advertising' },
]

function FooterLink({
  href,
  label,
  muted = false,
}: {
  href: string
  label: string
  muted?: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...footerLink,
        color: hovered
          ? '#f4f9ff'
          : muted
            ? 'rgba(190,205,226,0.56)'
            : 'rgba(222,233,247,0.76)',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      <span
        style={{
          ...footerLinkGlow,
          opacity: hovered ? 1 : 0,
          transform: hovered ? 'scaleX(1)' : 'scaleX(0.55)',
        }}
      />
      {label}
    </Link>
  )
}

function FooterCta({
  href,
  label,
}: {
  href: string
  label: string
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...ctaLink,
        ...(hovered ? { ...hoverLift, ...hoverGlowGreen, ...hoverBrighten } : {}),
      }}
    >
      {label}
    </Link>
  )
}

export default function SiteFooter() {
  const { isTablet, isMobile } = useViewportBreakpoints()

  const footerPadding = isMobile ? '18px 12px 24px' : '28px 16px 34px'

  const footerInner = useMemo(
    () => ({
      width: '100%',
      maxWidth: '1280px',
      margin: '0 auto',
      borderRadius: isMobile ? '26px' : '34px',
      padding: isMobile ? '24px 18px 16px' : '40px 38px 20px',
      background:
        'linear-gradient(180deg, rgba(7,19,38,0.985) 0%, rgba(4,13,28,0.995) 100%)',
      border: '1px solid rgba(116,190,255,0.08)',
      boxShadow:
        '0 30px 80px rgba(2,8,18,0.34), inset 0 1px 0 rgba(255,255,255,0.03)',
      overflow: 'hidden' as const,
      position: 'relative' as const,
    }),
    [isMobile],
  )

  const topGrid = useMemo(
    () => ({
      display: 'grid',
      gridTemplateColumns: isTablet
        ? '1fr'
        : 'minmax(260px, 300px) minmax(0, 1fr) minmax(250px, 290px)',
      gap: isTablet ? '28px' : '42px',
      alignItems: 'start',
      position: 'relative' as const,
      zIndex: 1,
    }),
    [isTablet],
  )

  const navGrid = useMemo(
    () => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
      gap: isMobile ? '18px' : '28px',
      alignItems: 'start',
      minWidth: 0,
      paddingTop: isTablet ? 0 : '6px',
    }),
    [isMobile, isTablet],
  )

  const bottomRow = useMemo(
    () => ({
      marginTop: isMobile ? '24px' : '34px',
      paddingTop: isMobile ? '14px' : '18px',
      borderTop: '1px solid rgba(116,190,255,0.07)',
      display: 'flex',
      flexDirection: isMobile ? ('column' as const) : ('row' as const),
      alignItems: isMobile ? ('flex-start' as const) : ('center' as const),
      justifyContent: 'space-between',
      gap: isMobile ? '10px' : '20px',
      position: 'relative' as const,
      zIndex: 1,
    }),
    [isMobile],
  )

  return (
    <footer
      style={{
        position: 'relative',
        zIndex: 1,
        marginTop: '34px',
        padding: footerPadding,
      }}
    >
      <div style={footerInner}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `
              radial-gradient(circle at 0% 0%, rgba(74,163,255,0.11) 0%, transparent 34%),
              radial-gradient(circle at 100% 0%, rgba(155,225,29,0.055) 0%, transparent 22%),
              linear-gradient(180deg, rgba(255,255,255,0.012) 0%, transparent 18%, transparent 82%, rgba(255,255,255,0.008) 100%)
            `,
          }}
        />

        <div style={topGrid}>
          <div style={{ display: 'grid', gap: '18px', alignContent: 'start' }}>
            <Link
              href="/"
              style={{
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                width: 'fit-content',
              }}
              aria-label="TenAceIQ home"
            >
              <BrandWordmark footer />
            </Link>

            <p
              style={{
                margin: 0,
                color: 'rgba(214,228,246,0.70)',
                fontSize: '15px',
                lineHeight: 1.9,
                maxWidth: '310px',
                fontWeight: 600,
              }}
            >
              Premium player intelligence, lineup strategy, and captain workflow tools for smarter
              match-day decisions.
            </p>

            <div
              style={{
                width: '48px',
                height: '2px',
                borderRadius: '999px',
                background:
                  'linear-gradient(90deg, rgba(74,163,255,0.8) 0%, rgba(155,225,29,0.9) 100%)',
                opacity: 0.7,
              }}
            />
          </div>

          <div style={navGrid}>
            <div style={footerColumn}>
              <div style={sectionLabel}>Platform</div>
              <div style={footerLinkStack}>
                {PLATFORM_LINKS.map((link) => (
                  <FooterLink key={link.href} href={link.href} label={link.label} />
                ))}
              </div>
            </div>

            <div style={footerColumn}>
              <div style={sectionLabel}>Resources</div>
              <div style={footerLinkStack}>
                {RESOURCE_LINKS.map((link) => (
                  <FooterLink key={link.href} href={link.href} label={link.label} />
                ))}
              </div>
            </div>

            <div style={footerColumn}>
              <div style={sectionLabel}>Company</div>
              <div style={footerLinkStack}>
                {COMPANY_LINKS.map((link) => (
                  <FooterLink key={link.href} href={link.href} label={link.label} />
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gap: '14px',
              alignContent: 'start',
              justifyItems: isTablet ? ('start' as const) : ('end' as const),
              textAlign: isTablet ? ('left' as const) : ('right' as const),
              minWidth: 0,
            }}
          >
            <div
              style={{
                color: 'rgba(143,184,255,0.76)',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              TenAceIQ
            </div>

            <div
              style={{
                color: '#f4f9ff',
                fontWeight: 900,
                fontSize: isMobile ? '24px' : '30px',
                lineHeight: 0.98,
                letterSpacing: '-0.055em',
                maxWidth: '260px',
              }}
            >
              Built for smarter tennis decisions.
            </div>

            <div
              style={{
                width: isTablet ? '80px' : '92px',
                height: '1px',
                borderRadius: '999px',
                background:
                  'linear-gradient(90deg, rgba(74,163,255,0.92) 0%, rgba(155,225,29,0.92) 100%)',
                justifySelf: isTablet ? ('start' as const) : ('end' as const),
                opacity: 0.9,
              }}
            />

            <div
              style={{
                color: 'rgba(197,213,234,0.66)',
                fontSize: '14px',
                lineHeight: 1.7,
                fontWeight: 600,
                maxWidth: '260px',
              }}
            >
              Search first. Prepare faster. Move from player data to real lineup and execution
              decisions.
            </div>

            <div style={{ paddingTop: '6px' }}>
              <FooterCta href="/join" label="Join TenAceIQ" />
            </div>
          </div>
        </div>

        <div style={bottomRow}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '8px 12px',
            }}
          >
            <div
              style={{
                color: 'rgba(197,213,234,0.66)',
                fontSize: '13px',
                fontWeight: 700,
              }}
            >
              © {new Date().getFullYear()} TenAceIQ
            </div>

            {!isMobile && (
              <div
                style={{
                  width: '24px',
                  height: '1px',
                  background: 'rgba(143,184,255,0.25)',
                }}
              />
            )}

            <div
              style={{
                color: 'rgba(197,213,234,0.48)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.02em',
              }}
            >
              Know more. Plan better. Compete smarter.
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px 18px',
            }}
          >
            {LEGAL_LINKS.map((link) => (
              <FooterLink key={link.href} href={link.href} label={link.label} muted />
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

const footerColumn = {
  display: 'grid',
  gap: '14px',
}

const footerLinkStack = {
  display: 'grid',
  gap: '10px',
  alignContent: 'start',
}

const sectionLabel = {
  color: '#8fb8ff',
  fontSize: '10px',
  fontWeight: 800,
  letterSpacing: '0.22em',
  textTransform: 'uppercase' as const,
  opacity: 0.7,
}

const footerLink = {
  position: 'relative' as const,
  display: 'inline-flex',
  alignItems: 'center',
  width: 'fit-content',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: '14px',
  lineHeight: 1.2,
  paddingBottom: '4px',
  ...transitionBase,
}

const footerLinkGlow = {
  position: 'absolute' as const,
  left: 0,
  bottom: 0,
  width: '100%',
  height: '1px',
  background:
    'linear-gradient(90deg, rgba(74,163,255,0.86) 0%, rgba(155,225,29,0.86) 100%)',
  transformOrigin: 'left center',
  transition: 'transform 180ms ease, opacity 180ms ease',
}

const ctaLink = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '42px',
  padding: '0 16px',
  borderRadius: '999px',
  border: '1px solid rgba(155,225,29,0.30)',
  background: 'linear-gradient(135deg, #9BE11D 0%, #C7F36B 100%)',
  color: '#08111d',
  textDecoration: 'none',
  fontWeight: 900,
  fontSize: '14px',
  lineHeight: 1,
  letterSpacing: '-0.01em',
  boxShadow: '0 8px 18px rgba(155,225,29,0.12)',
  ...transitionBase,
}
