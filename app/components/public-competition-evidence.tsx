import Link from 'next/link'
import { getPublicRankingsEvidence, getPublicTeamDiscovery } from '@/lib/public-competition-evidence-server'
import { buildTeamProfileHref } from '@/lib/team-routes'

const dateLabel = (date: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
const grid = { display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))' }

export async function PublicRankingsSnapshot() {
  const rows = await getPublicRankingsEvidence()
  return (
    <section className="page-shell-tight" aria-label="Public overall TiQ snapshot">
      <div className="surface-card-strong panel-pad">
        <div className="section-kicker">Rating and evidence</div>
        <h2 className="section-title">Read the signal alongside the results.</h2>
        <p>This limited snapshot follows stored overall TiQ order and includes players with at least three named, scored public results in the checked sample. It is not an official USTA ranking. A rating alone does not establish current form or matchup certainty.</p>
        <p>A read such as 3.XX shows the integer portion of a TiQ signal, not an official NTRP designation. Choose singles or doubles in the interactive table to compare the right format.</p>
        <div style={grid}>
          {rows.map(({ player, publicRead, results }) => {
            const singles = results.filter((result) => result.format === 'singles').length
            const wins = results.filter((result) => result.result === 'W').length
            return <article key={player.id} data-public-ranked-player={player.id} style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              <h3><Link href={`/players/${player.id}`} prefetch={false}>{player.name}</Link></h3>
              <p>Public overall TiQ read: <strong>{publicRead}</strong></p>
              <p>{results.length} scored results shown in the evidence sample · {wins} wins, {results.length - wins} losses.</p>
              <p>{singles} singles · {results.length - singles} doubles. Latest sampled result: <time dateTime={results[0].date}>{dateLabel(results[0].date)}</time>.</p>
              <p>Latest recorded score: {results[0].score}</p>
            </article>
          })}
        </div>
        {!rows.length ? <p>No profiles currently meet this snapshot’s scored-evidence checks. Use player search to inspect an individual record.</p> : null}
        <p>Sample records are not career totals. Overall, singles, and doubles signals answer different questions; check format and freshness before interpreting a gap.</p>
        <p><Link href="/methodology">How TiQ reads match evidence</Link> · <Link href="/resources/guides/matchup-confidence">Check matchup confidence</Link></p>
      </div>
    </section>
  )
}

export async function PublicTeamsSnapshot() {
  const teams = await getPublicTeamDiscovery()
  return (
    <section className="page-shell-tight" aria-label="Teams with scored public court evidence">
      <div className="surface-card-strong panel-pad">
        <div className="section-kicker">Public team evidence</div>
        <h2 className="section-title">Open a team with scorecards to read.</h2>
        <p>These team names appear in at least three scored public court results in the recent sample. Court results are not team-tie standings. The competition and flight identify where each result belongs; a shared team name can span seasons or leagues.</p>
        <div style={grid}>{teams.map(({ name, results }) => <article key={name} data-public-team-name={name} style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          <h3><Link href={buildTeamProfileHref(name)} prefetch={false}>{name}</Link></h3>
          <p>{results.length} scored court results in this sample. Latest: <time dateTime={results[0].date}>{dateLabel(results[0].date)}</time>.</p>
          <p>Latest recorded court score: {results[0].score} · Against {results[0].opponent}</p>
          <p>{results[0].league || 'Competition not supplied'}{results[0].flight ? ` · Flight ${results[0].flight}` : ''}</p>
        </article>)}</div>
        {!teams.length ? <p>No teams currently meet the scored-evidence threshold in this sample. Use the directory to find a specific team.</p> : null}
        <p><Link href="/resources/guides/read-doubles-results">Read doubles evidence before choosing a pair</Link> · <Link href="/data-assist?intent=request-review&context=Public%20teams">Request a data correction</Link></p>
      </div>
    </section>
  )
}
