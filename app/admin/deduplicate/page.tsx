'use client'

export const dynamic = 'force-dynamic'

import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  AdminEmptyState,
  AdminReviewFrame,
  AdminReviewHero,
  AdminReviewPanel,
  AdminStatusPanel,
} from '@/app/admin/_components/admin-review-ui'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import { recalculateDynamicRatings } from '@/lib/recalculateRatings'
import { supabase } from '@/lib/supabase'

type PlayerRow = {
  id: string
  name: string
  matchCount: number
}

type DuplicateGroup = {
  players: PlayerRow[]
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i][j - 1], dp[i - 1][j], dp[i - 1][j - 1])
    }
  }

  return dp[m][n]
}

function findDuplicateGroups(players: PlayerRow[]): DuplicateGroup[] {
  const normalized = players.map((p) => ({ ...p, normalized: normalizeName(p.name) }))
  const grouped = new Map<number, Set<number>>()
  const visited = new Set<number>()

  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      const a = normalized[i].normalized
      const b = normalized[j].normalized
      if (a === b) continue

      const threshold = Math.max(2, Math.floor(Math.min(a.length, b.length) * 0.15))
      if (editDistance(a, b) <= threshold) {
        if (!grouped.has(i)) grouped.set(i, new Set([i]))
        grouped.get(i)!.add(j)
        if (!grouped.has(j)) grouped.set(j, new Set([j]))
        grouped.get(j)!.add(i)
      }
    }
  }

  const groups: DuplicateGroup[] = []

  for (const [root, members] of grouped) {
    if (visited.has(root)) continue
    for (const member of members) visited.add(member)
    groups.push({
      players: [...members].map((idx) => players[idx]),
    })
  }

  return groups.sort((a, b) => b.players.length - a.players.length)
}

const phaseLabels: Record<string, string> = {
  'fetching-players': 'Loading players...',
  'fetching-matches': 'Loading matches...',
  'fetching-participants': 'Loading participants...',
  processing: 'Processing matches...',
  'applying-decay': 'Applying inactivity decay...',
  'saving-ratings': 'Saving ratings...',
  'saving-snapshots': 'Saving snapshots...',
  done: 'Done',
}

export default function DeduplicatePage() {
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [merging, setMerging] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [recalcPhase, setRecalcPhase] = useState('')
  const [message, setMessage] = useState('')
  const [mergedIds, setMergedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    void loadPlayers()
  }, [])

  async function loadPlayers() {
    setLoading(true)
    setError('')

    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select('id, name')
      .order('name', { ascending: true })

    if (playerError || !playerData) {
      setError(playerError?.message ?? 'Failed to load players')
      setLoading(false)
      return
    }

    const { data: countData } = await supabase
      .from('match_players')
      .select('player_id')

    const counts: Record<string, number> = {}
    for (const row of countData ?? []) {
      counts[row.player_id] = (counts[row.player_id] ?? 0) + 1
    }

    setPlayers(
      playerData.map((p) => ({
        id: p.id,
        name: p.name,
        matchCount: counts[p.id] ?? 0,
      })),
    )
    setLoading(false)
  }

  const groups = useMemo(() => {
    const visible = players.filter((p) => !mergedIds.has(p.id))
    return findDuplicateGroups(visible)
  }, [players, mergedIds])

  async function handleMerge(canonicalId: string, duplicateId: string) {
    setMerging(true)
    setMessage('')

    const { error: updateError } = await supabase
      .from('match_players')
      .update({ player_id: canonicalId })
      .eq('player_id', duplicateId)

    if (updateError) {
      setError(`Failed to reassign matches: ${updateError.message}`)
      setMerging(false)
      return
    }

    const { error: deleteError } = await supabase
      .from('players')
      .delete()
      .eq('id', duplicateId)

    if (deleteError) {
      setError(`Failed to delete duplicate: ${deleteError.message}`)
      setMerging(false)
      return
    }

    setMergedIds((prev) => new Set([...prev, duplicateId]))
    setMerging(false)
    setMessage('Merged. Run recalculate when done to refresh all ratings.')
  }

  async function handleRecalculate() {
    setRecalculating(true)
    setRecalcPhase('')
    setMessage('')
    try {
      await recalculateDynamicRatings((phase, detail) => {
        setRecalcPhase(phaseLabels[phase] ?? phase + (detail ? ` (${detail})` : ''))
      })
      setMessage('Ratings recalculated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recalculation failed')
    } finally {
      setRecalculating(false)
      setRecalcPhase('')
    }
  }

  return (
    <SiteShell active="/admin">
      <AdminGate>
        <AdminReviewFrame>
          <AdminReviewHero
            kicker="Admin Tool"
            title="Duplicate Player Detection"
            actions={
              <div style={{ display: 'grid', justifyItems: 'start', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => void handleRecalculate()}
                  disabled={recalculating}
                  style={actionButton}
                >
                  {recalculating ? 'Recalculating...' : 'Recalculate ratings'}
                </button>
                {recalculating && recalcPhase ? (
                  <div className="subtle-text" style={{ fontSize: 12, fontWeight: 800 }}>
                    {recalcPhase}
                  </div>
                ) : null}
              </div>
            }
          >
            Review likely duplicate player records, choose the canonical player to keep, reassign
            the duplicate&apos;s matches, then recalculate ratings when cleanup is complete.
          </AdminReviewHero>

          <AdminReviewPanel style={{ marginTop: 18 }}>
            {message ? <AdminStatusPanel tone="success" text={message} /> : null}
            {error ? <AdminStatusPanel tone="error" text={error} /> : null}

            {loading ? (
              <AdminEmptyState text="Loading players..." />
            ) : groups.length === 0 ? (
              <AdminEmptyState text={`No potential duplicates found across ${players.length} players.`} />
            ) : (
              <div style={groupList}>
                <div style={summary}>
                  {groups.length} potential duplicate {groups.length === 1 ? 'group' : 'groups'} across{' '}
                  {players.length} players
                </div>

                {groups.map((group) => (
                  <div key={group.players.map((p) => p.id).join('-')} style={groupCard}>
                    <div style={groupTitle}>Similar names</div>
                    <div style={playerGrid}>
                      {group.players.map((player) => (
                        <div key={player.id} style={playerRow}>
                          <div style={playerInfo}>
                            <div style={playerName}>{player.name}</div>
                            <div style={playerMeta}>
                              {player.matchCount} matches | id: {player.id.slice(0, 8)}...
                            </div>
                          </div>

                          <div style={mergeButtons}>
                            {group.players
                              .filter((other) => other.id !== player.id)
                              .map((other) => (
                                <button
                                  key={other.id}
                                  type="button"
                                  disabled={merging}
                                  onClick={() => void handleMerge(player.id, other.id)}
                                  style={mergeButton}
                                  title={`Keep "${player.name}", absorb matches from "${other.name}", delete "${other.name}"`}
                                >
                                  {merging ? '...' : `Keep this, remove "${other.name}"`}
                                </button>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminReviewPanel>
        </AdminReviewFrame>
      </AdminGate>
    </SiteShell>
  )
}

const actionButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '44px',
  padding: '0 20px',
  borderRadius: '999px',
  background: 'rgba(116,190,255,0.10)',
  border: '1px solid rgba(116,190,255,0.22)',
  color: 'var(--foreground-strong)',
  fontWeight: 800,
  fontSize: '14px',
  cursor: 'pointer',
  whiteSpace: 'normal',
}

const groupList: CSSProperties = {
  display: 'grid',
  gap: '16px',
}

const summary: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  fontWeight: 700,
}

const groupCard: CSSProperties = {
  borderRadius: '16px',
  border: '1px solid rgba(251,146,60,0.22)',
  background: 'var(--shell-chip-bg)',
  padding: '18px',
}

const groupTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 800,
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: 0,
  marginBottom: '14px',
}

const playerGrid: CSSProperties = {
  display: 'grid',
  gap: '12px',
}

const playerRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '16px',
  flexWrap: 'wrap',
  padding: '14px 16px',
  borderRadius: '14px',
  background: 'var(--shell-panel-bg)',
  border: '1px solid var(--shell-panel-border)',
}

const playerInfo: CSSProperties = {
  display: 'grid',
  gap: '4px',
  minWidth: 0,
}

const playerName: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 800,
  fontSize: '16px',
}

const playerMeta: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  fontWeight: 600,
  overflowWrap: 'anywhere',
}

const mergeButtons: CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
}

const mergeButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '36px',
  padding: '0 14px',
  borderRadius: '999px',
  background: 'rgba(239,68,68,0.08)',
  border: '1px solid rgba(239,68,68,0.22)',
  color: '#fecaca',
  fontWeight: 700,
  fontSize: '13px',
  cursor: 'pointer',
  whiteSpace: 'normal',
}
