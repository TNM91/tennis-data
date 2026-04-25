'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/captain-formatters'

type MatchRow = {
  id: string
  match_date: string
  match_type: string
  score: string | null
  winner_side: string
  match_source: string
}

type PlayerRow = {
  id: string
  name: string
  overall_dynamic_rating: number | null
}

type ParticipantRow = {
  match_id: string
  player_id: string
  side: string
}

type Anomaly = {
  matchId: string
  matchDate: string
  matchType: string
  score: string | null
  source: string
  kind: 'extreme_gap' | 'missing_score' | 'possible_duplicate'
  detail: string
}

const EXTREME_GAP_THRESHOLD = 2.0

export default function AnomaliesPage() {
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'extreme_gap' | 'missing_score' | 'possible_duplicate'>('all')

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')

    const [
      { data: matchData, error: matchError },
      { data: playerData, error: playerError },
      { data: participantData, error: participantError },
    ] = await Promise.all([
      supabase
        .from('matches')
        .select('id, match_date, match_type, score, winner_side, match_source')
        .not('match_type', 'is', null)
        .not('winner_side', 'is', null)
        .order('match_date', { ascending: false }),
      supabase
        .from('players')
        .select('id, name, overall_dynamic_rating'),
      supabase
        .from('match_players')
        .select('match_id, player_id, side'),
    ])

    if (matchError || playerError || participantError) {
      setError((matchError ?? playerError ?? participantError)?.message ?? 'Failed to load data')
      setLoading(false)
      return
    }

    setMatches((matchData ?? []) as MatchRow[])
    setPlayers((playerData ?? []) as PlayerRow[])
    setParticipants((participantData ?? []) as ParticipantRow[])
    setLoading(false)
  }

  const anomalies = useMemo<Anomaly[]>(() => {
    const playerMap = new Map(players.map((p) => [p.id, p]))
    const participantsByMatch = new Map<string, ParticipantRow[]>()
    for (const p of participants) {
      const existing = participantsByMatch.get(p.match_id) ?? []
      existing.push(p)
      participantsByMatch.set(p.match_id, existing)
    }

    const results: Anomaly[] = []

    // Possible duplicates: same date + overlapping player sets
    const keyToMatchIds = new Map<string, string[]>()
    for (const match of matches) {
      const pts = participantsByMatch.get(match.id) ?? []
      const playerIds = pts.map((p) => p.player_id).sort().join(',')
      if (!playerIds) continue
      const key = `${match.match_date}::${playerIds}`
      const existing = keyToMatchIds.get(key) ?? []
      existing.push(match.id)
      keyToMatchIds.set(key, existing)
    }
    const duplicateMatchIds = new Set<string>()
    for (const ids of keyToMatchIds.values()) {
      if (ids.length > 1) {
        for (const id of ids) duplicateMatchIds.add(id)
      }
    }

    for (const match of matches) {
      const pts = participantsByMatch.get(match.id) ?? []
      const sideA = pts.filter((p) => p.side === 'A').map((p) => playerMap.get(p.player_id))
      const sideB = pts.filter((p) => p.side === 'B').map((p) => playerMap.get(p.player_id))

      // Missing score
      if (!match.score || match.score.trim() === '') {
        results.push({
          matchId: match.id,
          matchDate: match.match_date,
          matchType: match.match_type,
          score: match.score,
          source: match.match_source,
          kind: 'missing_score',
          detail: 'No score recorded for this match.',
        })
      }

      // Extreme rating gap
      const allA = sideA.filter(Boolean)
      const allB = sideB.filter(Boolean)
      if (allA.length > 0 && allB.length > 0) {
        const avgA = allA.reduce((s, p) => s + (p!.overall_dynamic_rating ?? 3.5), 0) / allA.length
        const avgB = allB.reduce((s, p) => s + (p!.overall_dynamic_rating ?? 3.5), 0) / allB.length
        const gap = Math.abs(avgA - avgB)
        if (gap >= EXTREME_GAP_THRESHOLD) {
          const namesA = allA.map((p) => p!.name).join(' / ')
          const namesB = allB.map((p) => p!.name).join(' / ')
          results.push({
            matchId: match.id,
            matchDate: match.match_date,
            matchType: match.match_type,
            score: match.score,
            source: match.match_source,
            kind: 'extreme_gap',
            detail: `Rating gap of ${gap.toFixed(2)} — ${namesA} (${avgA.toFixed(2)}) vs ${namesB} (${avgB.toFixed(2)}).`,
          })
        }
      }

      // Possible duplicate
      if (duplicateMatchIds.has(match.id)) {
        results.push({
          matchId: match.id,
          matchDate: match.match_date,
          matchType: match.match_type,
          score: match.score,
          source: match.match_source,
          kind: 'possible_duplicate',
          detail: 'Same players on the same date appear in more than one match record.',
        })
      }
    }

    return results.sort((a, b) => b.matchDate.localeCompare(a.matchDate))
  }, [matches, players, participants])

  const filtered = useMemo(
    () => (filter === 'all' ? anomalies : anomalies.filter((a) => a.kind === filter)),
    [anomalies, filter],
  )

  const counts = useMemo(() => ({
    extreme_gap: anomalies.filter((a) => a.kind === 'extreme_gap').length,
    missing_score: anomalies.filter((a) => a.kind === 'missing_score').length,
    possible_duplicate: anomalies.filter((a) => a.kind === 'possible_duplicate').length,
  }), [anomalies])

  return (
    <AdminGate>
      <SiteShell active="/admin">
        <div style={shell}>
          <div style={header}>
            <div>
              <div style={kicker}>Admin tool</div>
              <h1 style={title}>Match anomaly scanner</h1>
              <p style={subtitle}>
                Flags matches with extreme rating gaps, missing scores, or possible duplicate
                entries. Review and clean up suspicious records before they affect ratings.
              </p>
            </div>
            <button type="button" onClick={() => void load()} style={refreshBtn}>
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>

          {error ? <div style={errorBanner}>{error}</div> : null}

          <div style={summaryRow}>
            {([
              ['all', 'All anomalies', anomalies.length],
              ['extreme_gap', 'Extreme gap', counts.extreme_gap],
              ['missing_score', 'Missing score', counts.missing_score],
              ['possible_duplicate', 'Possible duplicate', counts.possible_duplicate],
            ] as const).map(([kind, label, count]) => (
              <button
                key={kind}
                type="button"
                onClick={() => setFilter(kind)}
                style={{
                  ...filterChip,
                  ...(filter === kind ? filterChipActive : {}),
                }}
              >
                <span style={chipLabel}>{label}</span>
                <span style={chipCount(count)}>{count}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div style={emptyState}>Scanning matches…</div>
          ) : filtered.length === 0 ? (
            <div style={emptyState}>
              {filter === 'all'
                ? `No anomalies found across ${matches.length} matches.`
                : `No ${filter.replace('_', ' ')} anomalies found.`}
            </div>
          ) : (
            <div style={tableWrap}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Date</th>
                    <th style={th}>Type</th>
                    <th style={th}>Source</th>
                    <th style={th}>Score</th>
                    <th style={th}>Issue</th>
                    <th style={th}>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, i) => (
                    <tr key={`${a.matchId}-${a.kind}`} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.018)' }}>
                      <td style={td}>{formatDate(a.matchDate)}</td>
                      <td style={td}>{a.matchType}</td>
                      <td style={td}>{a.source}</td>
                      <td style={td}>{a.score || '—'}</td>
                      <td style={td}>
                        <span style={kindBadge(a.kind)}>{kindLabel(a.kind)}</span>
                      </td>
                      <td style={{ ...td, color: 'rgba(217,230,246,0.72)', fontSize: 13 }}>{a.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SiteShell>
    </AdminGate>
  )
}

function kindLabel(kind: Anomaly['kind']) {
  if (kind === 'extreme_gap') return 'Extreme gap'
  if (kind === 'missing_score') return 'Missing score'
  return 'Possible duplicate'
}

function kindBadge(kind: Anomaly['kind']): React.CSSProperties {
  if (kind === 'extreme_gap') {
    return { ...badge, background: 'rgba(251,146,60,0.12)', color: '#fed7aa', border: '1px solid rgba(251,146,60,0.22)' }
  }
  if (kind === 'missing_score') {
    return { ...badge, background: 'rgba(239,68,68,0.10)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.20)' }
  }
  return { ...badge, background: 'rgba(250,204,21,0.10)', color: '#fef08a', border: '1px solid rgba(250,204,21,0.20)' }
}

const shell: React.CSSProperties = {
  maxWidth: '1100px',
  margin: '0 auto',
  padding: '32px 20px 64px',
}

const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 20,
  flexWrap: 'wrap',
  marginBottom: 24,
}

const kicker: React.CSSProperties = {
  color: '#93c5fd',
  fontWeight: 800,
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 8,
}

const title: React.CSSProperties = {
  margin: '0 0 8px',
  color: 'var(--foreground)',
  fontWeight: 900,
  fontSize: 32,
  letterSpacing: '-0.04em',
}

const subtitle: React.CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 15,
  lineHeight: 1.6,
  maxWidth: 580,
}

const refreshBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
  padding: '0 20px',
  borderRadius: 999,
  background: 'rgba(116,190,255,0.10)',
  border: '1px solid rgba(116,190,255,0.22)',
  color: '#bfdbfe',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const errorBanner: React.CSSProperties = {
  padding: '14px 18px',
  borderRadius: 16,
  background: 'rgba(239,68,68,0.08)',
  border: '1px solid rgba(239,68,68,0.18)',
  color: '#fca5a5',
  fontWeight: 700,
  fontSize: 14,
  marginBottom: 20,
}

const summaryRow: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  marginBottom: 20,
}

const filterChip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 14px',
  borderRadius: 999,
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  color: 'var(--shell-copy-muted)',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
}

const filterChipActive: React.CSSProperties = {
  background: 'rgba(116,190,255,0.12)',
  border: '1px solid rgba(116,190,255,0.28)',
  color: '#bfdbfe',
}

const chipLabel: React.CSSProperties = {}

function chipCount(n: number): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    background: n > 0 ? 'rgba(251,146,60,0.14)' : 'rgba(255,255,255,0.06)',
    color: n > 0 ? '#fed7aa' : 'var(--shell-copy-muted)',
    fontSize: 12,
    fontWeight: 800,
  }
}

const emptyState: React.CSSProperties = {
  padding: 32,
  borderRadius: 20,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  color: 'var(--shell-copy-muted)',
  fontWeight: 600,
  fontSize: 15,
  textAlign: 'center',
}

const tableWrap: React.CSSProperties = {
  overflowX: 'auto',
  borderRadius: 20,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
}

const table: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: 860,
}

const th: React.CSSProperties = {
  padding: '13px 16px',
  textAlign: 'left',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '14px 16px',
  color: 'var(--foreground)',
  fontSize: 14,
  fontWeight: 600,
  borderTop: '1px solid var(--shell-panel-border)',
  verticalAlign: 'top',
}

const badge: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: 'nowrap',
}
