'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import BrandWordmark from '@/app/components/brand-wordmark'

const LINKS = [
  { href: '/explore', label: 'Explore' },
  { href: '/players', label: 'Players' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/matchup', label: 'Matchups' },
  { href: '/leagues', label: 'Leagues' },
  { href: '/captain', label: 'Captain' },
]

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

  const footerPadding = isMobile ? '4px 16px 24px' : '6px 24px 24px'

  const footerInner = useMemo(
    () => ({
      width: '100%',
      maxWidth: '1280px',
      margin: '0 auto',
      borderRadius: '24px',
      background: 'linear-gradient(180deg, rgba(21,42,80,0.56) 0%, rgba(12,24,46,0.90) 100%)',
      border: '1px solid rgba(116,190,255,0.12)',
      boxShadow: '0 18px 44px rgba(7,18,40,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
      padding: isMobile ? '18px 16px 16px' : '18px 22px 16px',
    }),
    [isMobile],
  )

  const footerRow = useMemo(
    () => ({
      display: 'flex',
      alignItems: isTablet ? ('flex-start' as const) : ('center' as const),
      flexDirection: isTablet ? ('column' as const) : ('row' as const),
      gap: isTablet ? '14px' : '20px',
    }),
    [isTablet],
  )

  const footerLinks = useMemo(
    () => ({
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: '12px 14px',
      justifyContent: isTablet ? ('flex-start' as const) : ('center' as const),
      alignItems: 'center',
    }),
    [isTablet],
  )

  const footerBottom = {
    color: 'rgba(197,213,234,0.72)',
    fontSize: '13px',
    fontWeight: 700,
    marginLeft: isTablet ? 0 : 'auto',
  } as const

  return (
    <footer style={{ position: 'relative', zIndex: 1, marginTop: '26px', padding: footerPadding }}>
      <div style={footerInner}>
        <div style={footerRow}>
          <Link
            href="/"
            style={{
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: isMobile ? '60px' : '64px',
            }}
            aria-label="TenAceIQ home"
          >
            <BrandWordmark footer />
          </Link>

          <div style={footerLinks}>
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  color: 'rgba(215,229,247,0.8)',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 700,
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div style={footerBottom}>© {new Date().getFullYear()} TenAceIQ</div>
        </div>
      </div>
    </footer>
  )
}