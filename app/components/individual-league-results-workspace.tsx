'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import CoordinatorSubnav from '@/app/components/coordinator-subnav'
import SiteShell from '@/app/components/site-shell'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { buildProductAccessState } from '@/lib/access-model'
import { getClientAuthState } from '@/lib/auth'
import {
  getTiqLeagueById,
  listTiqLeagues,
  listTiqPlayerLeagueEntries,
  type TiqPlayerLeagueEntryRecord,
} from '@/lib/tiq-league-service'
import type { TiqLeagueRecord } from '@/lib/tiq-league-registry'
import {
  deleteTiqIndividualLeagueResult,
  listTiqIndividualLeagueResults,
  saveTiqIndividualLeagueResult,
  type TiqIndividualLeagueResultRecord,
  type TiqLeagueStorageSource as TiqResultStorageSource,
} from '@/lib/tiq-individual-results-service'
import { buildTiqIndividualLeagueSummaries } from '@/lib/tiq-individual-results-summary'
import { completeTiqIndividualSuggestionsForPair } from '@/lib/tiq-individual-suggestions-service'
import { getTiqIndividualCompetitionFormatExperience } from '@/lib/tiq-individual-format'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/captain-formatters'

type ResultParticipantOption = {
  value: string
  playerId: string
  playerName: string
}

const pageWrap: CSSProperties = { maxWidth: 1000, margin: '0 auto', padding: '32px 16px' }
const heading: CSSProperties = { fontSize: 32, fontWeight: 900, marginBottom: 8, letterSpacing: 0 }
const subheading: CSSProperties = { color: '#b8c7dc', fontSize: 15, lineHeight: 1.55, marginBottom: 0, maxWidth: 700 }
const introCard: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(13, 31, 55, 0.92), rgba(6, 17, 33, 0.96))',
  border: '1px solid rgba(124, 167, 255, 0.18)',
  borderRadius: 16,
  padding: 24,
  marginBottom: 22,
}
const card: CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: '18px 20px',
  marginBottom: 14,
}
const detailsCard: CSSProperties = { ...card, display: 'grid', gap: 12 }
const detailsSummary: CSSProperties = {
  cursor: 'pointer',
  listStyle: 'none',
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}
const sectionTitle: CSSProperties = { fontSize: 16, fontWeight: 800, marginBottom: 14, marginTop: 28 }
const row: CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }
const fieldWrap: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 190px' }
const labelStyle: CSSProperties = { fontSize: 11, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }
const inputStyle: CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: '#f1f5f9',
  fontSize: 14,
}
const textareaStyle: CSSProperties = { ...inputStyle, minHeight: 82, resize: 'vertical' }
const btnPrimary: CSSProperties = {
  padding: '9px 18px',
  borderRadius: 8,
  background: '#9be11d',
  color: '#0a0a0a',
  fontWeight: 800,
  fontSize: 14,
  border: 'none',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
const btnSecondary: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.06)',
  color: '#e2e8f0',
  fontWeight: 700,
  fontSize: 13,
  border: '1px solid rgba(255,255,255,0.10)',
  cursor: 'pointer',
  textDecoration: 'none',
}
const btnDanger: CSSProperties = {
  ...btnSecondary,
  background: 'rgba(239,68,68,0.14)',
  color: '#fca5a5',
  border: '1px solid rgba(239,68,68,0.24)',
}
const disabledButton: CSSProperties = { opacity: 0.6, cursor: 'not-allowed' }
const msgOk: CSSProperties = { color: '#9be11d', fontSize: 13, marginTop: 6 }
const msgErr: CSSProperties = { color: '#f87171', fontSize: 13, marginTop: 6 }
const pill: CSSProperties = { display: 'inline-block', padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', fontSize: 12, color: '#94a3b8' }
const pillGreen: CSSProperties = { ...pill, background: 'rgba(155,225,29,0.12)', color: '#9be11d' }
const scorekeeperGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 18 }
const scorekeeperTile: CSSProperties = {
  padding: '14px 16px',
  borderRadius: 14,
  border: '1px solid rgba(124,167,255,0.14)',
  background: 'rgba(255,255,255,0.055)',
}
const tileLabel: CSSProperties = { color: '#93b7ea', fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' }
const tileValue: CSSProperties = { color: '#f8fbff', fontSize: 24, fontWeight: 950, marginTop: 5, lineHeight: 1.05 }
const tileText: CSSProperties = { color: '#b8c7dc', fontSize: 13, lineHeight: 1.5, marginTop: 6 }
const flowStrip: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginTop: 16 }
const flowStep: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '32px 1fr',
  gap: 10,
  alignItems: 'center',
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
}
const flowNumber: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: 32,
  height: 32,
  borderRadius: 999,
  background: 'linear-gradient(135deg, #9be11d 0%, #45e3a1 100%)',
  color: '#071425',
  fontWeight: 950,
}
const flowTitle: CSSProperties = { color: '#f8fbff', fontWeight: 900, fontSize: 14 }
const flowText: CSSProperties = { color: '#b8c7dc', fontSize: 12, marginTop: 2 }
const listWrap: CSSProperties = { display: 'grid', gap: 10 }
const resultCard: CSSProperties = {
  ...card,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 14,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
}
const resultTitle: CSSProperties = { color: '#f8fbff', fontSize: 15, fontWeight: 850, marginBottom: 5 }
const resultMeta: CSSProperties = { color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }
const actionRow: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }
const emptyCard: CSSProperties = {
  ...card,
  color: '#94a3b8',
  lineHeight: 1.5,
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label style={{ ...fieldWrap, ...(wide ? { flexBasis: '100%' } : {}) }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  )
}

function resultOpponentName(result: TiqIndividualLeagueResultRecord) {
  return result.winnerPlayerName === result.playerAName ? result.playerBName : result.playerAName
}

function fallbackEntriesForLeague(league: TiqLeagueRecord | null): TiqPlayerLeagueEntryRecord[] {
  if (!league || league.leagueFormat !== 'individual') return []

  return (league.players || []).map((playerName) => ({
    leagueId: league.id,
    playerName,
    playerId: '',
    playerLocation: '',
    entryStatus: 'active' as const,
  }))
}

export function IndividualLeagueResultsWorkspace({
  activeRoute = '/league-coordinator',
  loginNextHref = '/league-coordinator/individual-results',
  resultsHref = '/league-coordinator/individual-results',
}: {
  activeRoute?: string
  loginNextHref?: string
  resultsHref?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialLeagueId = searchParams.get('leagueId') || searchParams.get('league_id') || ''

  const [leagues, setLeagues] = useState<TiqLeagueRecord[]>([])
  const [results, setResults] = useState<TiqIndividualLeagueResultRecord[]>([])
  const [playerEntries, setPlayerEntries] = useState<TiqPlayerLeagueEntryRecord[]>([])
  const [filterLeagueId, setFilterLeagueId] = useState(initialLeagueId)
  const [formLeagueId, setFormLeagueId] = useState(initialLeagueId)
  const [resultPlayerA, setResultPlayerA] = useState('')
  const [resultPlayerB, setResultPlayerB] = useState('')
  const [resultWinner, setResultWinner] = useState('')
  const [resultScore, setResultScore] = useState('')
  const [resultDate, setResultDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [resultNotes, setResultNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [resultStorageSource, setResultStorageSource] = useState<TiqResultStorageSource>('local')
  const [canEditResults, setCanEditResults] = useState(false)
  const [accessResolved, setAccessResolved] = useState(false)
  const [accessMessage, setAccessMessage] = useState('')

  const selectedLeague = useMemo(
    () => leagues.find((league) => league.id === formLeagueId) || null,
    [formLeagueId, leagues],
  )
  const selectedLeagueExperience = getTiqIndividualCompetitionFormatExperience(
    selectedLeague?.individualCompetitionFormat,
  )
  const visiblePlayerEntries = playerEntries.length > 0 ? playerEntries : fallbackEntriesForLeague(selectedLeague)
  const resultParticipantOptions = useMemo<ResultParticipantOption[]>(
    () =>
      visiblePlayerEntries.map((entry) => ({
        value: entry.playerId || `name:${entry.playerName}`,
        playerId: entry.playerId,
        playerName: entry.playerName,
      })),
    [visiblePlayerEntries],
  )
  const resultPlayerAOption =
    resultParticipantOptions.find((option) => option.value === resultPlayerA) || null
  const resultPlayerBOption =
    resultParticipantOptions.find((option) => option.value === resultPlayerB) || null
  const resultWinnerOptions = [resultPlayerAOption, resultPlayerBOption].filter(
    (option): option is ResultParticipantOption => Boolean(option),
  )
  const latestResult = results[0] || null
  const summaryByLeague = useMemo(() => buildTiqIndividualLeagueSummaries(results), [results])
  const selectedSummary = formLeagueId ? summaryByLeague.get(formLeagueId) || null : null
  const activeParticipantCount = selectedLeague
    ? visiblePlayerEntries.length
    : leagues.reduce((sum, league) => sum + (league.players || []).length, 0)

  useEffect(() => {
    let mounted = true

    async function checkAuth() {
      const authState = await getClientAuthState()
      if (!authState.user && mounted) {
        router.replace(`/login?next=${encodeURIComponent(loginNextHref)}`)
        return
      }

      if (authState.user && mounted) {
        const access = buildProductAccessState(authState.role, authState.entitlements)
        setCanEditResults(access.canCreateTiqIndividualLeague)
        setAccessMessage(access.individualLeagueMessage)
        setAccessResolved(true)
      }
    }

    void checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void checkAuth() })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loginNextHref, router])

  const refreshResults = useCallback(async (leagueId: string) => {
    const result = await listTiqIndividualLeagueResults({ leagueId: leagueId || null })
    setResults(result.results)
    setResultStorageSource(result.source)
    if (result.warning) setError(result.warning)
  }, [])

  const refreshPlayerEntries = useCallback(async (leagueId: string) => {
    setPlayerEntries([])
    if (!leagueId) return

    const leagueResult = await getTiqLeagueById(leagueId)
    if (leagueResult.warning) setError((current) => current || leagueResult.warning || '')
    if (!leagueResult.record || leagueResult.record.leagueFormat !== 'individual') return

    const result = await listTiqPlayerLeagueEntries(leagueResult.record.id)
    setPlayerEntries(result.entries)
    if (result.warning) setError((current) => current || result.warning || '')
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    const leaguesResult = await listTiqLeagues()
    const individualLeagues = leaguesResult.records.filter((league) => league.leagueFormat === 'individual')
    const nextFormLeagueId = initialLeagueId || individualLeagues[0]?.id || ''

    setLeagues(individualLeagues)
    setFormLeagueId((current) => current || nextFormLeagueId)
    if (leaguesResult.warning) setError(leaguesResult.warning)
    await Promise.all([
      refreshResults(initialLeagueId || ''),
      refreshPlayerEntries(nextFormLeagueId),
    ])
    setLoading(false)
  }, [initialLeagueId, refreshPlayerEntries, refreshResults])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadData])

  async function handleFilterChange(leagueId: string) {
    setFilterLeagueId(leagueId)
    const nextHref = leagueId ? `${resultsHref}?leagueId=${encodeURIComponent(leagueId)}` : resultsHref
    router.replace(nextHref, { scroll: false })
    setLoading(true)
    setError('')
    await refreshResults(leagueId)
    if (leagueId) {
      setFormLeagueId(leagueId)
      await refreshPlayerEntries(leagueId)
    }
    setLoading(false)
  }

  async function handleFormLeagueChange(leagueId: string) {
    setFormLeagueId(leagueId)
    setResultPlayerA('')
    setResultPlayerB('')
    setResultWinner('')
    setStatus('')
    await refreshPlayerEntries(leagueId)
  }

  async function handleResultSubmit() {
    if (!canEditResults) {
      setStatus(accessMessage || 'Coordinator access is required before logging individual results.')
      return
    }

    if (!selectedLeague) {
      setStatus('Choose an individual TIQ league before logging a result.')
      return
    }

    if (!resultPlayerAOption || !resultPlayerBOption) {
      setStatus('Choose two players before logging a TIQ individual result.')
      return
    }

    if (resultPlayerAOption.value === resultPlayerBOption.value) {
      setStatus('A TIQ individual result needs two different players.')
      return
    }

    const winnerOption = resultWinnerOptions.find((option) => option.value === resultWinner) || null
    if (!winnerOption) {
      setStatus('Choose the winner before saving this TIQ individual result.')
      return
    }

    setSaving(true)
    setStatus('')

    try {
      const saveResult = await saveTiqIndividualLeagueResult({
        leagueId: selectedLeague.id,
        playerAName: resultPlayerAOption.playerName,
        playerAId: resultPlayerAOption.playerId,
        playerBName: resultPlayerBOption.playerName,
        playerBId: resultPlayerBOption.playerId,
        winnerPlayerName: winnerOption.playerName,
        winnerPlayerId: winnerOption.playerId,
        score: resultScore,
        resultDate: resultDate ? new Date(`${resultDate}T12:00:00`).toISOString() : new Date().toISOString(),
        notes: resultNotes,
      })
      const completion = await completeTiqIndividualSuggestionsForPair({
        leagueId: selectedLeague.id,
        playerAName: resultPlayerAOption.playerName,
        playerBName: resultPlayerBOption.playerName,
      })

      await refreshResults(filterLeagueId)
      setResultStorageSource(saveResult.source)
      setError(saveResult.warning || completion.warning || '')
      setStatus(
        `Saved TIQ result: ${winnerOption.playerName} over ${
          winnerOption.value === resultPlayerAOption.value ? resultPlayerBOption.playerName : resultPlayerAOption.playerName
        }.`,
      )
      setResultScore('')
      setResultNotes('')
      setResultWinner('')
    } catch (saveError) {
      setStatus(saveError instanceof Error ? saveError.message : 'Unable to save this TIQ result.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteResult(result: TiqIndividualLeagueResultRecord) {
    if (!canEditResults) return
    if (!confirm(`Delete ${result.winnerPlayerName} over ${resultOpponentName(result)}? This cannot be undone.`)) return

    const deleteResult = await deleteTiqIndividualLeagueResult(result.id)
    await refreshResults(filterLeagueId)
    setResultStorageSource(deleteResult.source)
    setStatus(deleteResult.warning || 'Result deleted.')
  }

  return (
    <SiteShell active={activeRoute}>
      <CoordinatorSubnav
        title="Individual results"
        description="Log player results for ladders, round robins, and challenge leagues without leaving Coordinator."
        tierLabel={canEditResults ? 'Player results active' : 'Coordinator results locked'}
        tierActive={canEditResults}
      />
      <div style={pageWrap}>
        <div style={introCard}>
          <div style={heading}>Record player results fast.</div>
          <div style={subheading}>
            Pick the TIQ individual league, choose both players, save the scoreline, and keep standings,
            prompts, and rating sync current.
          </div>
          <div style={scorekeeperGrid}>
            <div style={scorekeeperTile}>
              <div style={tileLabel}>Individual leagues</div>
              <div style={tileValue}>{leagues.length}</div>
              <div style={tileText}>Available result groups</div>
            </div>
            <div style={scorekeeperTile}>
              <div style={tileLabel}>Results</div>
              <div style={tileValue}>{results.length}</div>
              <div style={tileText}>{filterLeagueId ? 'Filtered view' : 'All recorded player results'}</div>
            </div>
            <div style={scorekeeperTile}>
              <div style={tileLabel}>Latest</div>
              <div style={tileValue}>{latestResult ? formatDate(latestResult.resultDate) : '-'}</div>
              <div style={tileText}>
                {latestResult ? `${latestResult.winnerPlayerName} def. ${resultOpponentName(latestResult)}` : 'No result yet'}
              </div>
            </div>
            <div style={scorekeeperTile}>
              <div style={tileLabel}>Leader</div>
              <div style={tileValue}>{selectedSummary?.leaderName || '-'}</div>
              <div style={tileText}>{selectedSummary ? `${selectedSummary.leaderRecord} ${selectedSummary.leaderRecentForm}` : `${activeParticipantCount} players tracked`}</div>
            </div>
          </div>
          <div style={flowStrip}>
            <div style={flowStep}>
              <div style={flowNumber}>1</div>
              <div><div style={flowTitle}>Pick league</div><div style={flowText}>Ladder, round robin, challenge.</div></div>
            </div>
            <div style={flowStep}>
              <div style={flowNumber}>2</div>
              <div><div style={flowTitle}>Log result</div><div style={flowText}>Players, winner, score.</div></div>
            </div>
            <div style={flowStep}>
              <div style={flowNumber}>3</div>
              <div><div style={flowTitle}>Close prompts</div><div style={flowText}>Suggestions and ratings update.</div></div>
            </div>
          </div>
        </div>

        {error ? <p style={msgErr}>{error}</p> : null}
        {status ? (
          <p style={status.startsWith('Saved') || status.toLowerCase().includes('deleted') ? msgOk : msgErr}>
            {status}
          </p>
        ) : null}
        {accessResolved && !canEditResults ? (
          <div style={{ marginBottom: 14 }}>
            <UpgradePrompt
              planId="league"
              compact
              headline="Unlock individual result entry with TIQ League Coordinator"
              body={accessMessage || 'TIQ League Coordinator lets organizers create individual leagues, log player results, and keep standings current.'}
              ctaLabel="Run Your League on TIQ"
              secondaryLabel="Back to Coordinator"
            />
          </div>
        ) : null}

        <details style={detailsCard} open={canEditResults && results.length === 0}>
          <summary style={detailsSummary}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>New player result</div>
              <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
                {canEditResults ? 'Use this for individual TIQ league matches only.' : 'Result entry unlocks with individual-league Coordinator access.'}
              </div>
            </div>
            <span style={canEditResults ? pillGreen : pill}>Add result</span>
          </summary>

          {canEditResults ? (
            <>
              <div style={row}>
                <Field label="League">
                  <select
                    style={inputStyle}
                    value={formLeagueId}
                    onChange={(event) => void handleFormLeagueChange(event.target.value)}
                    disabled={saving}
                  >
                    <option value="">Choose league</option>
                    {leagues.map((league) => (
                      <option key={league.id} value={league.id}>{league.leagueName}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Player A">
                  <select
                    value={resultPlayerA}
                    onChange={(event) => setResultPlayerA(event.target.value)}
                    style={inputStyle}
                    disabled={saving || !selectedLeague}
                  >
                    <option value="">Choose player A</option>
                    {resultParticipantOptions.map((option) => (
                      <option key={`a-${option.value}`} value={option.value}>{option.playerName}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Player B">
                  <select
                    value={resultPlayerB}
                    onChange={(event) => setResultPlayerB(event.target.value)}
                    style={inputStyle}
                    disabled={saving || !selectedLeague}
                  >
                    <option value="">Choose player B</option>
                    {resultParticipantOptions.map((option) => (
                      <option key={`b-${option.value}`} value={option.value}>{option.playerName}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div style={row}>
                <Field label="Winner">
                  <select
                    value={resultWinner}
                    onChange={(event) => setResultWinner(event.target.value)}
                    style={inputStyle}
                    disabled={saving}
                  >
                    <option value="">Choose winner</option>
                    {resultWinnerOptions.map((option) => (
                      <option key={`w-${option.value}`} value={option.value}>{option.playerName}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Score">
                  <input
                    value={resultScore}
                    onChange={(event) => setResultScore(event.target.value)}
                    placeholder={selectedLeagueExperience.scorePlaceholder}
                    style={inputStyle}
                    disabled={saving}
                  />
                </Field>
                <Field label="Result date">
                  <input
                    type="date"
                    value={resultDate}
                    onChange={(event) => setResultDate(event.target.value)}
                    style={inputStyle}
                    disabled={saving}
                  />
                </Field>
              </div>

              <div style={row}>
                <Field label="Notes" wide>
                  <textarea
                    value={resultNotes}
                    onChange={(event) => setResultNotes(event.target.value)}
                    placeholder={selectedLeagueExperience.notesPlaceholder}
                    style={textareaStyle}
                    disabled={saving}
                  />
                </Field>
              </div>

              <div style={actionRow}>
                <button
                  type="button"
                  onClick={handleResultSubmit}
                  disabled={saving}
                  style={{ ...btnPrimary, ...(saving ? disabledButton : {}) }}
                >
                  {saving ? 'Saving result...' : selectedLeagueExperience.actionLabel}
                </button>
                <span style={pillGreen}>{resultStorageSource === 'supabase' ? 'Live results' : 'Saved preview results'}</span>
                {selectedLeague ? (
                  <Link href={`/explore/leagues/tiq/${encodeURIComponent(selectedLeague.id)}?league_id=${encodeURIComponent(selectedLeague.id)}`} style={btnSecondary}>
                    View league
                  </Link>
                ) : null}
              </div>
            </>
          ) : null}
        </details>

        <div style={sectionTitle}>Recorded player results</div>
        <div style={{ marginBottom: 14 }}>
          <select
            style={{ ...inputStyle, maxWidth: 280 }}
            value={filterLeagueId}
            onChange={(event) => void handleFilterChange(event.target.value)}
          >
            <option value="">All individual leagues</option>
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>{league.leagueName}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p style={{ color: '#94a3b8' }}>Loading...</p>
        ) : results.length === 0 ? (
          <div style={emptyCard}>No individual results yet. Open the form above to log the first player result.</div>
        ) : (
          <div style={listWrap}>
            {results.map((result) => {
              const league = leagues.find((item) => item.id === result.leagueId)
              return (
                <div key={result.id} style={resultCard}>
                  <div>
                    <div style={resultTitle}>
                      {result.winnerPlayerName} def. {resultOpponentName(result)}
                    </div>
                    <div style={resultMeta}>
                      {[league?.leagueName, result.score, formatDate(result.resultDate), result.notes].filter(Boolean).join(' - ')}
                    </div>
                  </div>
                  <div style={actionRow}>
                    {result.winnerPlayerId ? (
                      <Link href={`/players/${encodeURIComponent(result.winnerPlayerId)}`} style={btnSecondary}>Winner</Link>
                    ) : null}
                    {canEditResults ? (
                      <button type="button" onClick={() => void handleDeleteResult(result)} style={btnDanger}>
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </SiteShell>
  )
}
