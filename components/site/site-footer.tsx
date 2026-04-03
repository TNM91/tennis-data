import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="page-shell pb-10 pt-8">
      <div className="site-footer">
        <div className="space-y-2">
          <div className="site-footer-brand">TenAceIQ</div>
          <p className="site-footer-copy">
            Know more. Plan better. Compete smarter.
          </p>
        </div>

        <div className="site-footer-links">
          <Link href="/explore">Explore</Link>
          <Link href="/players">Players</Link>
          <Link href="/rankings">Rankings</Link>
          <Link href="/leagues">Leagues</Link>
          <Link href="/matchup">Matchups</Link>
        </div>
      </div>
    </footer>
  )
}