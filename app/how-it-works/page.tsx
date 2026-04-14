import type { Metadata } from 'next'
import Link from 'next/link'
import SiteShell from '@/app/components/site-shell'
import InfoPage from '@/app/components/info-page'

export const metadata: Metadata = {
  title: 'How It Works',
  description:
    'See how TenAceIQ connects public discovery, personal tracking, and captain workflow tools into one tennis decision system.',
}

export default function HowItWorksPage() {
  return (
    <SiteShell active="/how-it-works">
      <InfoPage
        kicker="How It Works"
        title="From public discovery to weekly captain decisions."
        intro="TenAceIQ is organized in layers so users can move from open exploration into more focused decision-making. That structure helps visitors understand the value of the site quickly and helps members move into higher-context tools once they need them."
      >
        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>1. Public discovery</h2>
          <p>
            Public pages like <Link href="/players">Players</Link>, <Link href="/rankings">Rankings</Link>,{' '}
            <Link href="/teams">Teams</Link>, <Link href="/leagues">Leagues</Link>, and{' '}
            <Link href="/matchup">Matchup</Link> help visitors explore the tennis landscape before
            they commit to deeper workflow tools.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>2. Personal context</h2>
          <p>
            Member-facing tools help users keep a tighter read on performance, follows, activity,
            and recent movement. The point is to turn broad discovery into something personally
            useful and repeatable.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>3. Captain workflow</h2>
          <p>
            Captain tools are built around actual weekly operations: availability, lineup planning,
            scenario comparisons, messaging, and match preparation. That layer exists to reduce
            scramble and make lineup choices easier to explain and repeat.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>4. Data operations</h2>
          <p>
            Imports, scorecard tracking, and league-level diagnostics help keep the platform’s
            underlying tennis data useful. Better data quality supports better player insight,
            rankings, matchup context, and captain decisions.
          </p>
        </div>
      </InfoPage>
    </SiteShell>
  )
}
