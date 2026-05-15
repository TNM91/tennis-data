'use client'

export const dynamic = 'force-dynamic'

import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AdminEmptyState,
  AdminReviewFrame,
  AdminReviewHero,
  AdminReviewPanel,
  AdminStatusPanel,
} from '@/app/admin/_components/admin-review-ui'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import { formatDate } from '@/lib/captain-formatters'
import { supabase } from '@/lib/supabase'

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
  const [filter, setFilter] = useState<'all' | Anomaly['kind']>('all')

  const load = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [load])

  const anomalies = useMemo<Anomaly[]>(() => {
    const playerMap = new Map(players.map((p) => [p.id, p]))
    const participantsByMatch = new Map<string, ParticipantRow[]>()
    for (const participant of participants) {
      const existing = participantsByMatch.get(participant.match_id) ?? []
      existing.push(participant)
      participantsByMatch.set(participant.match_id, existing)
    }

    const results: Anomaly[] = []
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

      const allA = sideA.filter(Boolean)
      const allB = sideB.filter(Boolean)
      if (allA.length > 0 && allB.length > 0) {
        const avgA = allA.reduce((sum, p) => sum + (p!.overall_dynamic_rating ?? 3.5), 0) / allA.length
        const avgB = allB.reduce((sum, p) => sum + (p!.overall_dynamic_rating ?? 3.5), 0) / allB.length
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
            detail: `Rating gap of ${gap.toFixed(2)} - ${namesA} (${avgA.toFixed(2)}) vs ${namesB} (${avgB.toFixed(2)}).`,
          })
        }
      }

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
    <SiteShell active="/admin">
      <AdminGate>
        <AdminReviewFrame>
          <AdminReviewHero
            kicker="Admin Tool"
            title="Match Anomaly Scanner"
            actions={
              <button type="button" onClick={() => void load()} style={refreshBtn}>
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            }
          >
            Flags matches with extreme rating gaps, missing scores, or possible duplicate entries.
            Review and clean up suspicious records before they affect ratings.
          </AdminReviewHero>

          <AdminReviewPanel style={{ marginTop: 18 }}>
            {error ? <AdminStatusPanel tone="error" text={error} /> : null}

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
                  <span>{label}</span>
                  <span style={chipCount(count)}>{count}</span>
                </button>
              ))}
            </div>

            {loading ? (
              <AdminEmptyState text="Scanning matches..." />
            ) : filtered.length === 0 ? (
              <AdminEmptyState
                text={
                  filter === 'all'
                    ? `No anomalies found across ${matches.length} matches.`
                    : `No ${filter.replace('_', ' ')} anomalies found.`
                }
              />
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
                      <tr
                        key={`${a.matchId}-${a.kind}`}
                        style={{ background: i % 2 === 0 ? 'transparent' : 'var(--shell-chip-bg)' }}
                      >
                        <td style={td}>{formatDate(a.matchDate)}</td>
                        <td style={td}>{a.matchType}</td>
                        <td style={td}>{a.source}</td>
                        <td style={td}>{a.score || '-'}</td>
                        <td style={td}>
                          <span style={kindBadge(a.kind)}>{kindLabel(a.kind)}</span>
                        </td>
                        <td style={{ ...td, color: 'var(--shell-copy-muted)', fontSize: 13 }}>{a.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminReviewPanel>
        </AdminReviewFrame>
      </AdminGate>
    </SiteShell>
  )
}

function kindLabel(kind: Anomaly['kind']) {
  if (kind === 'extreme_gap') return 'Extreme gap'
  if (kind === 'missing_score') return 'Missing score'
  return 'Possible duplicate'
}

function kindBadge(kind: Anomaly['kind']): CSSProperties {
  if (kind === 'extreme_gap') {
    return {
      ...badge,
      background: 'rgba(251,146,60,0.12)',
      color: '#fed7aa',
      border: '1px solid rgba(251,146,60,0.22)',
    }
  }
  if (kind === 'missing_score') {
    return {
      ...badge,
      background: 'rgba(239,68,68,0.10)',
      color: '#fecaca',
      border: '1px solid rgba(239,68,68,0.20)',
    }
  }
  return {
    ...badge,
    background: 'rgba(250,204,21,0.10)',
    color: 'var(--foreground-strong)',
    border: '1px solid rgba(250,204,21,0.20)',
  }
}

const refreshBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
  padding: '0 20px',
  borderRadius: 999,
  background: 'rgba(116,190,255,0.10)',
  border: '1px solid rgba(116,190,255,0.22)',
  color: 'var(--foreground-strong)',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
  whiteSpace: 'normal',
}

const summaryRow: CSSProperties = {
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  marginBottom: 20,
}

const filterChip: CSSProperties = {
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

const filterChipActive: CSSProperties = {
  background: 'rgba(116,190,255,0.12)',
  border: '1px solid rgba(116,190,255,0.28)',
  color: 'var(--foreground-strong)',
}

function chipCount(n: number): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    background: n > 0 ? 'rgba(251,146,60,0.14)' : 'var(--shell-panel-bg)',
    color: n > 0 ? 'var(--foreground-strong)' : 'var(--shell-copy-muted)',
    fontSize: 12,
    fontWeight: 800,
  }
}

const tableWrap: CSSProperties = {
  overflowX: 'auto',
  overscrollBehaviorX: 'contain',
  WebkitOverflowScrolling: 'touch',
  scrollbarWidth: 'thin',
  maxWidth: '100%',
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  minWidth: 0,
}

const table: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: 0,
  tableLayout: 'auto',
}

const th: CSSProperties = {
  padding: '13px 16px',
  textAlign: 'left',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0,
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  whiteSpace: 'normal',
}

const td: CSSProperties = {
  padding: '14px 16px',
  color: 'var(--foreground-strong)',
  fontSize: 14,
  fontWeight: 600,
  borderTop: '1px solid var(--shell-panel-border)',
  verticalAlign: 'top',
}

const badge: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: 'normal',
}
