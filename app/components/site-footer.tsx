'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import BrandWordmark from '@/app/components/brand-wordmark'
import {
  hoverLift,
  hoverGlowBlue,
  hoverGlowGreen,
  hoverBrighten,
  transitionBase,
} from '@/lib/interaction-styles'

const PRIMARY_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/matchup', label: 'Matchups' },
  { href: '/captain', label: 'Captain' },
  { href: '/leagues', label: 'Leagues' },
]

const SECONDARY_LINKS = [
  { href: '/players', label: 'Players' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/login', label: 'Login' },
  { href: '/join', label: 'Join', cta: true },
]

const LEGAL_LINKS = [
  { href: '/legal/privacy', label: 'Privacy' },
  { href: '/legal/terms', label: 'Terms' },
  { href: '/legal/disclaimer', label: 'Disclaimer' },
  { href: '/legal/data-policy', label: 'Data Policy' },
  { href: '/legal/cookies', label: 'Cookies' },
  { href: '/legal/copyright', label: 'Copyright' },
]

function FooterLink({
  href,
  label,
  cta = false,
}: {
  href: string
  label: string
  cta?: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...(cta ? ctaPillLink : pillLink),
        ...(hovered
          ? cta
            ? { ...hoverLift, ...hoverGlowGreen, ...hoverBrighten }
            : { ...hoverLift, ...hoverGlowBlue, ...hoverBrighten }
          : {}),
      }}
    >
      {label}
    </Link>
  )
}

export default function SiteFooter() {
  const [screenWidth, setScreenWidth] = useState(1280)

  const isTablet = screenWidth < 1080
  const isMobile = screenWidth < 820

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const footerPadding = isMobile ? '14px 12px 20px' : '18px 16px 24px'

  const footerInner = useMemo(
    () => ({
      width: '100%',
      maxWidth: '1280px',
      margin: '0 auto',
      borderRadius: isMobile ? '24px' : '28px',
      padding: isMobile ? '18px 16px 16px' : '22px 22px 18px',
      background:
        'linear-gradient(180deg, rgba(16,34,66,0.92) 0%, rgba(9,20,39,0.98) 100%)',
      border: '1px solid rgba(116,190,255,0.14)',
      boxShadow:
        '0 18px 44px rgba(5,12,25,0.16), inset 0 1px 0 rgba(255,255,255,0.04)',
      overflow: 'hidden' as const,
      position: 'relative' as const,
    }),
    [isMobile],
  )

  const topRow = useMemo(
    () => ({
      display: 'grid',
      gridTemplateColumns: isTablet ? '1fr' : 'minmax(240px, auto) minmax(0, 1fr) auto',
      gap: isTablet ? '16px' : '18px',
      alignItems: isTablet ? ('stretch' as const) : ('start' as const),
      position: 'relative' as const,
      zIndex: 1,
    }),
    [isTablet],
  )

  const navColumns = useMemo(
    () => ({
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
      gap: '12px',
      minWidth: 0,
    }),
    [isMobile],
  )

  const linkGroup = {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '10px',
    alignItems: 'center',
  }

  const legalRow = useMemo(
    () => ({
      marginTop: isMobile ? '16px' : '18px',
      paddingTop: isMobile ? '14px' : '16px',
      borderTop: '1px solid rgba(116,190,255,0.10)',
      display: 'flex',
      flexDirection: isMobile ? ('column' as const) : ('row' as const),
      gap: isMobile ? '8px' : '12px',
      alignItems: isMobile ? ('flex-start' as const) : ('center' as const),
      justifyContent: 'space-between',
      position: 'relative' as const,
      zIndex: 1,
    }),
    [isMobile],
  )

  return (
    <footer style={{ position: 'relative', zIndex: 1, marginTop: '20px', padding: footerPadding }}>
      <div style={footerInner}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 0% 0%, rgba(74,163,255,0.12) 0%, transparent 32%), radial-gradient(circle at 100% 0%, rgba(155,225,29,0.10) 0%, transparent 28%)',
            pointerEvents: 'none',
          }}
        />

        <div style={topRow}>
          <div style={{ display: 'grid', gap: '10px', alignContent: 'start' }}>
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
                color: 'rgba(215,229,247,0.74)',
                fontSize: '14px',
                lineHeight: 1.65,
                maxWidth: isTablet ? '100%' : '320px',
                fontWeight: 600,
              }}
            >
              Smarter player search, matchup prep, lineup planning, and league context in one place.
            </p>
          </div>

          <div style={navColumns}>
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={sectionLabel}>Platform</div>
              <div style={linkGroup}>
                {PRIMARY_LINKS.map((link) => (
                  <FooterLink key={link.href} href={link.href} label={link.label} />
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={sectionLabel}>Account</div>
              <div style={linkGroup}>
                {SECONDARY_LINKS.map((link) => (
                  <FooterLink
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    cta={Boolean(link.cta)}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={sectionLabel}>Legal</div>
              <div style={linkGroup}>
                {LEGAL_LINKS.map((link) => (
                  <FooterLink key={link.href} href={link.href} label={link.label} />
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gap: '8px',
              alignContent: 'start',
              justifyItems: isTablet ? ('start' as const) : ('end' as const),
              textAlign: isTablet ? ('left' as const) : ('right' as const),
              minWidth: isTablet ? 0 : '220px',
            }}
          >
            <div
              style={{
                color: '#f4f9ff',
                fontWeight: 900,
                fontSize: isMobile ? '20px' : '24px',
                lineHeight: 1.05,
                letterSpacing: '-0.04em',
                maxWidth: '260px',
              }}
            >
              Built for smarter tennis decisions.
            </div>
            <div
              style={{
                color: 'rgba(197,213,234,0.74)',
                fontSize: '13px',
                lineHeight: 1.6,
                fontWeight: 700,
                maxWidth: '260px',
              }}
            >
              Search first, prep faster, and move from player data to real match-day decisions.
            </div>
          </div>
        </div>

        <div style={legalRow}>
          <div
            style={{
              color: 'rgba(197,213,234,0.72)',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            © {new Date().getFullYear()} TenAceIQ
          </div>

          <div
            style={{
              color: 'rgba(197,213,234,0.62)',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            Know more. Plan better. Compete smarter.
          </div>
        </div>
      </div>
    </footer>
  )
}

const sectionLabel = {
  color: '#8fb8ff',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
}

const pillLink = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '42px',
  padding: '0 14px',
  borderRadius: '14px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(180deg, rgba(40,82,150,0.18) 0%, rgba(18,40,78,0.16) 100%)',
  color: '#e7eefb',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: '14px',
  lineHeight: 1,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
  ...transitionBase,
}

const ctaPillLink = {
  ...pillLink,
  color: '#08111d',
  background: 'linear-gradient(135deg, #9BE11D 0%, #C7F36B 100%)',
  border: '1px solid rgba(155,225,29,0.34)',
  boxShadow: '0 10px 24px rgba(155,225,29,0.14)',
}