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

const footerStyle = {
  position: 'relative',
  zIndex: 1,
} as const

const footerBrandLink = {
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
} as const

const footerUtilityLink = {
  color: 'rgba(215,229,247,0.8)',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 700,
} as const

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

  const footerPadding = isMobile ? '0 16px 24px' : '0 24px 24px'

  const footerInner = useMemo(
    () => ({
      width: '100%',
      maxWidth: '1280px',
      margin: '0 auto',
      borderRadius: '24px',
      background: 'linear-gradient(180deg, rgba(21,42,80,0.54) 0%, rgba(12,24,46,0.88) 100%)',
      border: '1px solid rgba(116,190,255,0.12)',
      boxShadow: '0 18px 44px rgba(7,18,40,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
      padding: isMobile ? '16px 16px 14px' : '16px 20px 14px',
    }),
    [isMobile],
  )

  const footerRow = useMemo(
    () => ({
      display: 'flex',
      alignItems: isTablet ? ('flex-start' as const) : ('center' as const),
      flexDirection: isTablet ? ('column' as const) : ('row' as const),
      gap: isTablet ? '12px' : '18px',
    }),
    [isTablet],
  )

  const footerLinks = useMemo(
    () => ({
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: '12px 14px',
      justifyContent: isTablet ? ('flex-start' as const) : ('center' as const),
    }),
    [isTablet],
  )

  const footerBottom = {
    color: 'rgba(197,213,234,0.72)',
    fontSize: '13px',
    fontWeight: 700,
    marginLeft: isTablet ? 0 : 'auto',
  }

  return (
    <footer style={{ ...footerStyle, marginTop: '26px', padding: footerPadding }}>
      <div style={footerInner}>
        <div style={footerRow}>
          <Link href="/" style={footerBrandLink}>
            <BrandWordmark footer />
          </Link>

          <div style={footerLinks}>
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} style={footerUtilityLink}>
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
