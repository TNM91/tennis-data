import Link from 'next/link'
import type { PublicTeamEvidence } from '@/lib/public-competition-evidence'
import { buildTeamProfileHref } from '@/lib/team-routes'

const dateLabel = (date: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))

export default function PublicTeamProfileSnapshot({ evidence, titleAs = 'h1' }: { evidence: PublicTeamEvidence; titleAs?: 'h1' | 'h2' }) {
  const Heading = titleAs
  const ResultHeading = titleAs === 'h1' ? 'h2' : 'h3'
  const wins = evidence.results.filter(({ result }) => result === 'W').length
  return (
    <section className="page-shell-tight" aria-label="Public team court record" data-public-team-name={evidence.name}>
      <div className="surface-card-strong panel-pad">
        <div className="section-kicker">Public court record</div>
        <Heading className="page-title">{evidence.name}</Heading>
        <p>{evidence.results.length ? `${wins} court wins and ${evidence.results.length - wins} court losses across the ${evidence.results.length} scored results shown. This sample is not a team-tie record or a season standing.` : 'There is not enough scored public court evidence to summarize this team name yet. Roster and schedule context may still be available below.'}</p>
        <p>This view combines recorded competition under this team name. Check the league, flight, and date on each result before comparing teams or seasons.</p>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))' }}>{evidence.results.map((result) => <article key={result.id} style={{ minWidth: 0, overflowWrap: 'anywhere', padding: 14, border: '1px solid rgba(255,255,255,0.16)', borderRadius: 12 }}>
          <ResultHeading style={{ fontSize: '1rem', lineHeight: 1.5 }}>{result.result === 'W' ? 'Court win' : 'Court loss'} · {result.format === 'singles' ? 'Singles' : 'Doubles'}</ResultHeading>
          <p><time dateTime={result.date}>{dateLabel(result.date)}</time> · Recorded court score: <strong>{result.score}</strong></p>
          <p>Against <Link href={buildTeamProfileHref(result.opponent)} prefetch={false}>{result.opponent}</Link></p>
          <p>{result.league || 'Competition not supplied'}{result.flight ? ` · Flight ${result.flight}` : ''}</p>
        </article>)}</div>
        <p>Public snapshots refresh daily. Court dates show when play occurred, not when the page was edited.</p>
        <p><Link href="/resources/guides/read-doubles-results">Understand doubles results</Link> · <Link href="/methodology">Rating methodology</Link> · <Link href={`/data-assist?intent=request-review&context=${encodeURIComponent(`Team ${evidence.name}`)}`}>Request a data correction</Link></p>
      </div>
    </section>
  )
}
