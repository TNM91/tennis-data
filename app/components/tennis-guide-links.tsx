import Link from 'next/link'
import { TENNIS_GUIDES } from '@/lib/tennis-guides'

export default function TennisGuideLinks() {
  return (
    <section className="surface-card-strong panel-pad" aria-label="Tennis intelligence guides" style={{ minWidth: 0, marginBlock: 16 }}>
      <div className="section-kicker">Read the game</div>
      <h2 className="section-title">Make sense of the match evidence.</h2>
      <p>Learn what ratings, doubles results, and matchup estimates can tell you before your next match.</p>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}>
        {TENNIS_GUIDES.map((guide) => (
          <div key={guide.slug} style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            <h3 style={{ fontSize: '1rem', lineHeight: 1.4 }}><Link href={`/resources/guides/${guide.slug}`}>{guide.title}</Link></h3>
            <p style={{ lineHeight: 1.6 }}>{guide.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
