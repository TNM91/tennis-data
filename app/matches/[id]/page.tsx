'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState, type CSSProperties } from 'react'
import SiteShell from '@/app/components/site-shell'
import PublicDetailState from '@/app/components/public-detail-state'
import { supabase } from '@/lib/supabase'
import { buildTeamProfileHref } from '@/lib/team-routes'

type MatchRecord = {
  id: string
  external_match_id: string | null
  match_date: string | null
  match_time: string | null
  facility: string | null
  home_team: string | null
  away_team: string | null
  league_name: string | null
  flight: string | null
  usta_section: string | null
  district_area: string | null
  score: string | null
  winner_side: string | null
  status: string | null
}

type LineRecord = {
  id: string
  external_match_id: string | null
  line_number: string | null
  match_type: string | null
  score: string | null
  winner_side: string | null
}

type MatchPlayer = {
  match_id: string
  side: string | null
  seat: number | null
  players: { id: string; name: string } | { id: string; name: string }[] | null
}

function matchDateLabel(value: string | null) {
  if (!value) return 'Date to be confirmed'
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

function leagueHref(match: MatchRecord) {
  const params = new URLSearchParams()
  if (match.flight) params.set('flight', match.flight)
  if (match.usta_section) params.set('section', match.usta_section)
  if (match.district_area) params.set('district', match.district_area)
  const query = params.toString()
  return `/leagues/${encodeURIComponent(match.league_name || 'league')}${query ? `?${query}` : ''}`
}

export default function MatchDetailPage() {
  return (
    <SiteShell active="/compete/results">
      <MatchDetailContent />
    </SiteShell>
  )
}

function MatchDetailContent() {
  const params = useParams<{ id: string }>()
  const matchId = params?.id || ''
  const [match, setMatch] = useState<MatchRecord | null>(null)
  const [lines, setLines] = useState<LineRecord[]>([])
  const [players, setPlayers] = useState<MatchPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadMatch() {
      setLoading(true)
      setError('')
      setMatch(null)
      setLines([])
      setPlayers([])

      const { data, error: matchError } = await supabase
        .from('matches')
        .select('id,external_match_id,match_date,match_time,facility,home_team,away_team,league_name,flight,usta_section,district_area,score,winner_side,status')
        .eq('id', matchId)
        .is('line_number', null)
        .maybeSingle()

      if (!active) return
      if (matchError || !data) {
        setError(matchError?.message || 'This match could not be found.')
        setLoading(false)
        return
      }

      const record = data as MatchRecord
      setMatch(record)
      let lineRows: LineRecord[] = []
      if (record.external_match_id) {
        const prefix = `${record.external_match_id}::line:`
        const { data: lineData } = await supabase
          .from('matches')
          .select('id,external_match_id,line_number,match_type,score,winner_side')
          .like('external_match_id', `${prefix}%`)
          .not('line_number', 'is', null)
          .limit(20)
        lineRows = ((lineData ?? []) as LineRecord[])
          .filter((line) => line.external_match_id?.startsWith(prefix))
          .sort((a, b) => Number(a.line_number || 0) - Number(b.line_number || 0))
      }

      const { data: playerData } = await supabase
        .from('match_players')
        .select('match_id,side,seat,players(id,name)')
        .in('match_id', [record.id, ...lineRows.map((line) => line.id)])

      if (!active) return
      setLines(lineRows)
      setPlayers((playerData ?? []) as unknown as MatchPlayer[])
      setLoading(false)
    }

    if (matchId) void loadMatch()

    return () => { active = false }
  }, [matchId])

  const namesFor = (id: string, side: string) => players
    .filter((row) => row.match_id === id && row.side === side)
    .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))
    .map((row) => Array.isArray(row.players) ? row.players[0] : row.players)
    .filter((player): player is { id: string; name: string } => Boolean(player?.id && player.name))

  const home = match?.home_team || 'Home team'
  const away = match?.away_team || 'Away team'
  const winner = match?.winner_side === 'A' ? home : match?.winner_side === 'B' ? away : ''

  return (
    <main style={pageStyle}>
      <Link href="/compete/results" style={backLinkStyle}>← Explore results</Link>
      {loading && matchId ? (
        <PublicDetailState eyebrow="Match" title="Loading match" body="Getting the score and available line details." tone="loading" visual="matchup" />
      ) : error || !match ? (
        <PublicDetailState eyebrow="Match" title="Match unavailable" body={error || 'This match could not be found.'} tone="empty" visual="matchup" actions={[{ href: '/compete/results', label: 'Explore results' }]} />
      ) : (
        <>
          <header style={heroStyle}>
            <p style={eyebrowStyle}>Match result</p>
            <h1 style={titleStyle}>{home} vs {away}</h1>
            <p style={metaStyle}>{[matchDateLabel(match.match_date), match.league_name, match.flight].filter(Boolean).join(' · ')}</p>
            <div style={scoreRowStyle}>
              <strong style={scoreStyle}>{match.score || 'Score pending'}</strong>
              <span style={winnerStyle}>{winner ? `${winner} won` : match.status === 'completed' ? 'Result recorded' : 'Match scheduled'}</span>
            </div>
            {match.facility ? <p style={venueStyle}>{match.facility}</p> : null}
          </header>

          <section style={surfaceStyle} aria-label="Match teams">
            <h2 style={sectionTitleStyle}>Teams</h2>
            <div style={teamGridStyle}>
              {[home, away].map((team, index) => (
                <Link key={`${index}-${team}`} href={buildTeamProfileHref(team, { league: match.league_name, flight: match.flight })} style={teamLinkStyle}>
                  <span style={smallLabelStyle}>{index === 0 ? 'Home' : 'Away'}</span>
                  <strong>{team}</strong>
                  <span style={linkCueStyle}>View team →</span>
                </Link>
              ))}
            </div>
          </section>

          <section style={surfaceStyle} aria-label="Match lines">
            <h2 style={sectionTitleStyle}>Lines and players</h2>
            {lines.length ? (
              <div style={lineListStyle}>
                {lines.map((line) => (
                  <article key={line.id} style={lineCardStyle}>
                    <div style={lineHeaderStyle}>
                      <strong>Line {line.line_number || '—'}{line.match_type ? ` · ${line.match_type}` : ''}</strong>
                      <span style={lineScoreStyle}>{line.score || 'Score unavailable'}</span>
                    </div>
                    <div style={teamGridStyle}>
                      {(['A', 'B'] as const).map((side) => (
                        <div key={side} style={lineSideStyle}>
                          <span style={smallLabelStyle}>{side === 'A' ? home : away}{line.winner_side === side ? ' · Won' : ''}</span>
                          {namesFor(line.id, side).length ? namesFor(line.id, side).map((player) => (
                            <Link key={player.id} href={`/players/${encodeURIComponent(player.id)}`} style={playerLinkStyle}>{player.name}</Link>
                          )) : <span style={mutedStyle}>Players not linked</span>}
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p style={mutedStyle}>Line scores are not available for this match yet.</p>
            )}
            {!lines.length && players.length ? (
              <>
                <h3 style={linkedPlayersTitleStyle}>Linked players</h3>
                <div style={teamGridStyle}>
                  {(['A', 'B'] as const).map((side) => (
                    <div key={side} style={lineSideStyle}>
                      <span style={smallLabelStyle}>{side === 'A' ? home : away}</span>
                      {namesFor(match.id, side).length ? namesFor(match.id, side).map((player) => (
                        <Link key={player.id} href={`/players/${encodeURIComponent(player.id)}`} style={playerLinkStyle}>
                          {player.name}
                        </Link>
                      )) : <span style={mutedStyle}>Players not linked</span>}
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </section>

          {match.league_name ? <Link href={leagueHref(match)} style={backLinkStyle}>View league results →</Link> : null}
        </>
      )}
    </main>
  )
}

const pageStyle: CSSProperties = { width: 'min(960px, calc(100% - clamp(24px, 5vw, 40px)))', margin: '0 auto', padding: '28px 0 72px', display: 'grid', gap: 20 }
const backLinkStyle: CSSProperties = { color: 'var(--foreground-strong)', fontWeight: 800, textDecoration: 'none', width: 'fit-content' }
const heroStyle: CSSProperties = { padding: 'clamp(22px, 4vw, 38px)', border: '1px solid rgba(116,190,255,0.22)', borderRadius: 24, background: 'var(--portal-surface-bg)', display: 'grid', gap: 12 }
const eyebrowStyle: CSSProperties = { margin: 0, color: '#a6d96a', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.09em' }
const titleStyle: CSSProperties = { margin: 0, color: 'var(--foreground-strong)', fontSize: 'clamp(27px, 5vw, 44px)', lineHeight: 1.1 }
const metaStyle: CSSProperties = { margin: 0, color: 'var(--foreground-muted)', lineHeight: 1.5 }
const scoreRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px 20px' }
const scoreStyle: CSSProperties = { color: 'var(--foreground-strong)', fontSize: 'clamp(30px, 5vw, 52px)' }
const winnerStyle: CSSProperties = { color: '#a6d96a', fontWeight: 800 }
const venueStyle: CSSProperties = { margin: 0, color: 'var(--foreground-muted)' }
const surfaceStyle: CSSProperties = { padding: 'clamp(18px, 3vw, 28px)', border: '1px solid rgba(116,190,255,0.15)', borderRadius: 20, background: 'var(--portal-surface-bg)', display: 'grid', gap: 16 }
const sectionTitleStyle: CSSProperties = { margin: 0, color: 'var(--foreground-strong)', fontSize: 22 }
const linkedPlayersTitleStyle: CSSProperties = { margin: '18px 0 10px', color: 'var(--foreground-strong)', fontSize: 16 }
const teamGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 12 }
const teamLinkStyle: CSSProperties = { display: 'grid', gap: 5, padding: 16, borderRadius: 14, border: '1px solid rgba(116,190,255,0.18)', color: 'var(--foreground-strong)', textDecoration: 'none', minWidth: 0, overflowWrap: 'anywhere' }
const smallLabelStyle: CSSProperties = { color: 'var(--foreground-muted)', fontSize: 12, fontWeight: 800 }
const linkCueStyle: CSSProperties = { color: '#a6d96a', fontSize: 12, fontWeight: 800 }
const lineListStyle: CSSProperties = { display: 'grid', gap: 12 }
const lineCardStyle: CSSProperties = { padding: 16, border: '1px solid rgba(116,190,255,0.16)', borderRadius: 14, display: 'grid', gap: 12 }
const lineHeaderStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, color: 'var(--foreground-strong)' }
const lineScoreStyle: CSSProperties = { fontWeight: 900 }
const lineSideStyle: CSSProperties = { display: 'grid', alignContent: 'start', gap: 6, minWidth: 0 }
const playerLinkStyle: CSSProperties = { color: 'var(--brand-blue-2)', fontWeight: 800, textDecoration: 'underline', textUnderlineOffset: 3 }
const mutedStyle: CSSProperties = { color: 'var(--foreground-muted)', lineHeight: 1.5 }
