import Link from 'next/link'
import { getPublicPlayerDiscovery } from '@/lib/public-player-evidence-server'
import { type PublicPlayerEvidence } from '@/lib/public-player-evidence'

const dateLabel = (date: string) => new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))

export function PublicPlayerSnapshot({ evidence }: { evidence: PublicPlayerEvidence }) {
  const { player, results } = evidence
  const wins = results.filter((result) => result.result === 'W').length
  return (
    <section className="page-shell-tight" aria-label="Public player match record" data-public-player-id={player.id}>
      <div className="surface-card-strong panel-pad">
        <div className="section-kicker">Public match record</div>
        <h1 className="page-title">{player.name}</h1>
        {player.location ? <p>{player.location}</p> : null}
        <p>{results.length ? `${wins} wins and ${results.length - wins} losses across the ${results.length} scored public results shown below. These results are a sample of the available record, not a career total.` : 'There are not enough named, scored public results here to summarize this player’s competitive history yet.'}</p>
        <p>Read the score alongside the opponents, format, and date. A doubles result includes a partner; it does not isolate one player’s contribution.</p>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))' }}>
          {results.map((result) => (
            <article key={result.id} style={{ minWidth: 0, overflowWrap: 'anywhere', padding: 14, border: '1px solid rgba(255,255,255,0.16)', borderRadius: 12 }}>
              <h2 style={{ fontSize: '1rem', lineHeight: 1.5 }}>{result.result === 'W' ? 'Win' : 'Loss'} · {result.format === 'singles' ? 'Singles' : 'Doubles'}</h2>
              <p><time dateTime={result.date}>{dateLabel(result.date)}</time> · Recorded score: <strong>{result.score}</strong></p>
              <p>Against {result.opponents.map((opponent, index) => <span key={opponent.id}>{index ? ' / ' : ''}<Link href={`/players/${opponent.id}`} prefetch={false}>{opponent.name}</Link></span>)}</p>
              {result.partner ? <p>Partner: <Link href={`/players/${result.partner.id}`} prefetch={false}>{result.partner.name}</Link></p> : null}
              {result.competition ? <p>Competition: {result.competition}</p> : null}
            </article>
          ))}
        </div>
        <p>Results shown through {results.length ? <time dateTime={results[0].date}>{dateLabel(results[0].date)}</time> : 'the available public record'}. Public snapshots refresh daily; match dates describe when play occurred.</p>
        <p><Link href="/resources/guides/read-your-tennis-rating">Understand the rating evidence</Link> · <Link href="/methodology">Read the methodology</Link> · <Link prefetch={false} rel="nofollow" href={`/data-assist?intent=request-review&context=${encodeURIComponent(`Player ${player.id}`)}`}>Request a data correction</Link></p>
      </div>
    </section>
  )
}

export default async function PublicPlayerDiscovery() {
  let players: PublicPlayerEvidence[]
  try {
    players = await getPublicPlayerDiscovery()
  } catch {
    return <section className="page-shell-tight"><div className="surface-card-strong panel-pad"><h2 className="section-title">Public match records are temporarily unavailable.</h2><p>Try player search, or <Link href="/resources">read the tennis intelligence guides</Link> while the records reconnect.</p></div></section>
  }
  if (!players.length) return null
  return (
    <section className="page-shell-tight" aria-label="Players with public match evidence">
      <div className="surface-card-strong panel-pad">
        <div className="section-kicker">Public match evidence</div>
        <h2 className="section-title">Start with players who have results to read.</h2>
        <p>These profiles have at least three scored public results with named opponents and complete lineups in the recent records checked. This is a starting point for exploring match history, not a ranking or a complete player directory.</p>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}>
          {players.map(({ player, results }) => (
            <article key={player.id} data-public-player-id={player.id} style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              <h3><Link href={`/players/${player.id}`} prefetch={false}>{player.name}</Link></h3>
              {player.location ? <p>{player.location}</p> : null}
              <p>{results.length} public results in this snapshot. Latest: <time dateTime={results[0].date}>{dateLabel(results[0].date)}</time>.</p>
              <p>{results[0].format === 'singles' ? 'Singles' : 'Doubles'} · {results[0].result === 'W' ? 'Win' : 'Loss'} · Recorded score: {results[0].score}</p>
            </article>
          ))}
        </div>
        <p><Link href="/resources/guides/matchup-confidence">Check how much evidence a matchup needs</Link> · <Link prefetch={false} rel="nofollow" href="/data-assist?intent=request-review&context=Public%20players">Request a data correction</Link></p>
      </div>
    </section>
  )
}
