'use client'

import Link from 'next/link'
import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { BrandWordmark } from './brand-wordmark'
import { PRIMARY_NAV, isNavActive } from '@/lib/site-nav'

type SiteShellProps = {
  children: ReactNode
  sectionLabel?: string
  contentClassName?: string
}

export function SiteShell({ children, sectionLabel, contentClassName }: SiteShellProps) {
  const pathname = usePathname()

  return (
    <div className="site-shell-root">
      <div className="site-shell-orb site-shell-orb-one" />
      <div className="site-shell-orb site-shell-orb-two" />
      <div className="site-shell-grid-glow" />

      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="site-brand-link" aria-label="TenAceIQ home">
            <BrandWordmark top />
          </Link>

          <nav className="site-nav" aria-label="Primary">
            {PRIMARY_NAV.map((item) => {
              const active = isNavActive(pathname, item)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? 'site-nav-link site-nav-link-active' : 'site-nav-link'}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>

      <main className={contentClassName ? `site-main ${contentClassName}` : 'site-main'}>
        {sectionLabel ? (
          <div className="site-section-tag">
            {sectionLabel}
          </div>
        ) : null}
        {children}
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="site-footer-row">
            <Link href="/" className="site-footer-brand-link">
              <BrandWordmark footer />
            </Link>

            <div className="site-footer-links">
              {PRIMARY_NAV.filter((item) => item.href !== '/').map((item) => (
                <Link key={item.href} href={item.href} className="site-footer-link">
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="site-footer-copy">
              © {new Date().getFullYear()} TenAceIQ
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
