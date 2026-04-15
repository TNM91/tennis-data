'use client'

import Link from 'next/link'
import { type ReactNode, useDeferredValue, useEffect, useMemo, useState } from 'react'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import { supabase } from '@/lib/supabase'

type MatchLedgerRow = {
  id: string
  external_match_id: string | null
  league_name: string | null
  flight: string | null
  home_team: string | null
  away_team: string | null
  match_date: string | null
  status: string | null
  score: string | null
  line_number: string | null
}

type StatusFilter = 'pending' | 'upcoming' | 'completed' | 'all'
type FocusFilter = 'all' | 'due-this-week' | 'missing-id' | 'missing-league'

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Unscheduled'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function startOfTodayKey() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

function leagueScopeLabel(leagueName: string | null, flight: string | null) {
  return [cleanText(leagueName), cleanText(flight)].filter(Boolean).join(' - ') || 'Unscoped league'
}

export default function MissingScorecardsPage() {
  const [rows, setRows] = useState<MatchLedgerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [leagueFilter, setLeagueFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [focusFilter, setFocusFilter] = useState<FocusFilter>('all')
  const [copiedQueue, setCopiedQueue] = useState(false)
  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const nextSearch = params.get('search') || ''
    const nextLeague = params.get('league') || ''
    const nextTeam = params.get('team') || ''
    const nextStatus = (params.get('status') || 'pending') as StatusFilter
    const nextFocus = (params.get('focus') || 'all') as FocusFilter

    setSearch(nextSearch)
    setLeagueFilter(nextLeague)
    setTeamFilter(nextTeam)
    setStatusFilter(['pending', 'upcoming', 'completed', 'all'].includes(nextStatus) ? nextStatus : 'pending')
    setFocusFilter(['all', 'due-this-week', 'missing-id', 'missing-league'].includes(nextFocus) ? nextFocus : 'all')
  }, [])

  useEffect(() => {
    void loadLedger()
  }, [])

  async function loadLedger() {
    setLoading(true)
    setError('')

    try {
      const { data, error: ledgerError } = await supabase
        .from('matches')
        .select(`
          id,
          external_match_id,
          league_name,
          flight,
          home_team,
          away_team,
          match_date,
          status,
          score,
          line_number
        `)
        .order('match_date', { ascending: true })
        .limit(1500)

      if (ledgerError) throw new Error(ledgerError.message)

      setRows((data || []) as MatchLedgerRow[])
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : 'Unable to load missing scorecard dashboard.')
    } finally {
      setLoading(false)
    }
  }

  const summary = useMemo(() => {
    const todayKey = startOfTodayKey()
    const parentRows = rows.filter((row) => !row.line_number)
    const lineRows = rows.filter((row) => Boolean(row.line_number))
    const importedLineCounts = new Map<string, number>()

    for (const row of lineRows) {
      const externalMatchId = cleanText(row.external_match_id)
      const parentExternalMatchId = externalMatchId.split('::line:')[0] || ''
      if (!parentExternalMatchId) continue
      importedLineCounts.set(
        parentExternalMatchId,
        (importedLineCounts.get(parentExternalMatchId) || 0) + 1,
      )
    }

    const classify = (row: MatchLedgerRow): StatusFilter => {
      const externalMatchId = cleanText(row.external_match_id)
      const importedLines = externalMatchId ? importedLineCounts.get(externalMatchId) || 0 : 0
      const completed =
        row.status === 'completed' || Boolean(cleanText(row.score)) || importedLines > 0

      if (completed) return 'completed'
      if (!row.match_date) return 'all'

      const matchKey = new Date(row.match_date).getTime()
      if (Number.isNaN(matchKey)) return 'all'
      return matchKey <= todayKey ? 'pending' : 'upcoming'
    }

    return {
      parentRows,
      importedLineCounts,
      classify,
    }
  }, [rows])

  const leagueOptions = useMemo(() => {
    return Array.from(
      new Set(
        summary.parentRows.map((row) => leagueScopeLabel(row.league_name, row.flight)).filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b))
  }, [summary.parentRows])

  const teamOptions = useMemo(() => {
    return Array.from(
      new Set(
        summary.parentRows.flatMap((row) => [cleanText(row.home_team), cleanText(row.away_team)]).filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b))
  }, [summary.parentRows])

  const filteredRows = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const sevenDaysFromNow = new Date(today)
    sevenDaysFromNow.setDate(today.getDate() + 7)
    const todayKey = today.getTime()
    const dueSoonKey = sevenDaysFromNow.getTime()

    return summary.parentRows.filter((row) => {
      const classification = summary.classify(row)
      if (statusFilter !== 'all' && classification !== statusFilter) return false

      const rowLeagueLabel = leagueScopeLabel(row.league_name, row.flight)
      if (leagueFilter && rowLeagueLabel !== leagueFilter) return false

      const matchesTeam =
        !teamFilter ||
        cleanText(row.home_team) === teamFilter ||
        cleanText(row.away_team) === teamFilter
      if (!matchesTeam) return false

      if (focusFilter === 'missing-id' && cleanText(row.external_match_id)) return false
      if (focusFilter === 'missing-league' && cleanText(row.league_name)) return false
      if (focusFilter === 'due-this-week') {
        if (classification !== 'pending' && classification !== 'upcoming') return false
        if (!row.match_date) return false
        const matchKey = new Date(row.match_date).getTime()
        if (Number.isNaN(matchKey) || matchKey < todayKey || matchKey > dueSoonKey) return false
      }

      if (!query) return true

      const haystack = [
        cleanText(row.external_match_id),
        cleanText(row.home_team),
        cleanText(row.away_team),
        cleanText(row.league_name),
        cleanText(row.flight),
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [deferredSearch, focusFilter, leagueFilter, statusFilter, summary, teamFilter])

  const metrics = useMemo(() => {
    const counts = {
      pending: 0,
      upcoming: 0,
      completed: 0,
      missingExternalIds: 0,
      missingLeagueNames: 0,
    }

    for (const row of summary.parentRows) {
      const classification = summary.classify(row)
      if (classification === 'pending') counts.pending += 1
      if (classification === 'upcoming') counts.upcoming += 1
      if (classification === 'completed') counts.completed += 1
      if (!cleanText(row.external_match_id)) counts.missingExternalIds += 1
      if (!cleanText(row.league_name)) counts.missingLeagueNames += 1
    }

    return counts
  }, [summary])

  const actionLanes = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const sevenDaysFromNow = new Date(today)
    sevenDaysFromNow.setDate(today.getDate() + 7)
    const todayKey = today.getTime()
    const dueSoonKey = sevenDaysFromNow.getTime()

    let dueThisWeek = 0

    for (const row of summary.parentRows) {
      if (!row.match_date) continue
      const matchKey = new Date(row.match_date).getTime()
      if (Number.isNaN(matchKey)) continue
      if (matchKey < todayKey || matchKey > dueSoonKey) continue
      const classification = summary.classify(row)
      if (classification === 'pending' || classification === 'upcoming') {
        dueThisWeek += 1
      }
    }

    return {
      dueThisWeek,
      missingExternalIds: metrics.missingExternalIds,
      missingLeagueNames: metrics.missingLeagueNames,
    }
  }, [metrics.missingExternalIds, metrics.missingLeagueNames, summary])

  const backlogSummaries = useMemo(() => {
    const pendingRows = summary.parentRows.filter((row) => summary.classify(row) === 'pending')
    const byLeague = new Map<string, { label: string; count: number }>()
    const byTeam = new Map<string, { label: string; count: number; league: string }>()

    for (const row of pendingRows) {
      const leagueLabel = leagueScopeLabel(row.league_name, row.flight)
      const homeTeam = cleanText(row.home_team)
      const awayTeam = cleanText(row.away_team)

      byLeague.set(leagueLabel, {
        label: leagueLabel,
        count: (byLeague.get(leagueLabel)?.count || 0) + 1,
      })

      for (const team of [homeTeam, awayTeam]) {
        if (!team) continue
        const key = `${team}__${leagueLabel}`
        byTeam.set(key, {
          label: team,
          league: leagueLabel,
          count: (byTeam.get(key)?.count || 0) + 1,
        })
      }
    }

    return {
      leagues: [...byLeague.values()]
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .slice(0, 6),
      teams: [...byTeam.values()]
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .slice(0, 6),
    }
  }, [summary])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    if (leagueFilter) params.set('league', leagueFilter)
    if (teamFilter) params.set('team', teamFilter)
    if (statusFilter !== 'pending') params.set('status', statusFilter)
    if (focusFilter !== 'all') params.set('focus', focusFilter)

    const query = params.toString()
    const nextUrl = query ? `/admin/missing-scorecards?${query}` : '/admin/missing-scorecards'
    window.history.replaceState(null, '', nextUrl)
  }, [focusFilter, leagueFilter, search, statusFilter, teamFilter])

  async function handleCopyVisibleQueue() {
    const lines = filteredRows.map((row) => {
      const externalMatchId = cleanText(row.external_match_id) || 'missing-id'
      const league = leagueScopeLabel(row.league_name, row.flight)
      const teams = `${cleanText(row.home_team) || 'Unknown home'} vs ${cleanText(row.away_team) || 'Unknown away'}`
      return `${formatDate(row.match_date)} | ${league} | ${teams} | Match ID: ${externalMatchId}`
    })

    if (lines.length === 0) return

    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopiedQueue(true)
      window.setTimeout(() => setCopiedQueue(false), 1800)
    } catch {
      setCopiedQueue(false)
    }
  }

  return (
    <SiteShell active="/admin">
      <AdminGate>
        <section
          style={{
            width: '100%',
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '18px 24px 0',
          }}
        >
          <section className="hero-panel">
            <div className="hero-inner">
              <div className="section-kicker">Admin Tool</div>
              <h1 className="page-title">Missing Scorecards</h1>
              <p className="page-subtitle">
                Review scheduled parent matches, see which ones still need scorecards after match day,
                and jump straight into import or match review without guessing what is missing.
              </p>
            </div>
          </section>

          <section className="surface-card panel-pad section" style={{ marginTop: 18 }}>
            <div className="metric-grid">
              <MetricCard label="Needs scorecard" value={String(metrics.pending)} helper="Past scheduled matches still missing results." />
              <MetricCard label="Upcoming" value={String(metrics.upcoming)} helper="Future scheduled matches not due yet." />
              <MetricCard label="Completed" value={String(metrics.completed)} helper="Parent matches with score or imported scorecard lines." />
              <MetricCard label="Missing match ID" value={String(metrics.missingExternalIds)} helper="Parent rows without an external match ID." />
            </div>
          </section>

          <section className="surface-card panel-pad section" style={{ marginTop: 18 }}>
            <div className="section-kicker">Action lanes</div>
            <h2 className="section-title" style={{ marginTop: 6 }}>Jump straight into the work queue that needs attention</h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 14,
                marginTop: 16,
              }}
            >
              <button
                type="button"
                className="button-ghost"
                style={{ justifyContent: 'space-between' }}
                onClick={() => {
                  setFocusFilter('due-this-week')
                  setStatusFilter('all')
                  setLeagueFilter('')
                  setTeamFilter('')
                }}
              >
                <span>Due this week</span>
                <span>{actionLanes.dueThisWeek}</span>
              </button>
              <button
                type="button"
                className="button-ghost"
                style={{ justifyContent: 'space-between' }}
                onClick={() => {
                  setFocusFilter('missing-id')
                  setStatusFilter('all')
                  setLeagueFilter('')
                  setTeamFilter('')
                }}
              >
                <span>Missing external IDs</span>
                <span>{actionLanes.missingExternalIds}</span>
              </button>
              <button
                type="button"
                className="button-ghost"
                style={{ justifyContent: 'space-between' }}
                onClick={() => {
                  setFocusFilter('missing-league')
                  setStatusFilter('all')
                  setLeagueFilter('')
                  setTeamFilter('')
                }}
              >
                <span>Missing league names</span>
                <span>{actionLanes.missingLeagueNames}</span>
              </button>
              <button
                type="button"
                className="button-ghost"
                style={{ justifyContent: 'space-between' }}
                onClick={() => {
                  setFocusFilter('all')
                  setStatusFilter('pending')
                  setLeagueFilter('')
                  setTeamFilter('')
                  setSearch('')
                }}
              >
                <span>Reset to past due</span>
                <span>{metrics.pending}</span>
              </button>
            </div>
          </section>

          <section className="surface-card panel-pad section" style={{ marginTop: 18 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 16,
              }}
            >
              <Field label="Search">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="input"
                  placeholder="Match ID, team, league, or flight"
                />
              </Field>
              <Field label="Status">
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="select">
                  <option value="pending">Past due</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="completed">Completed</option>
                  <option value="all">All parent matches</option>
                </select>
              </Field>
              <Field label="League / Flight">
                <select value={leagueFilter} onChange={(event) => setLeagueFilter(event.target.value)} className="select">
                  <option value="">All leagues</option>
                  {leagueOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Team">
                <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} className="select">
                  <option value="">All teams</option>
                  {teamOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Focus lane">
                <select value={focusFilter} onChange={(event) => setFocusFilter(event.target.value as FocusFilter)} className="select">
                  <option value="all">All queue items</option>
                  <option value="due-this-week">Due this week</option>
                  <option value="missing-id">Missing external IDs</option>
                  <option value="missing-league">Missing league names</option>
                </select>
              </Field>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
              <button type="button" onClick={() => void loadLedger()} className="button-ghost">
                {loading ? 'Refreshing dashboard...' : 'Refresh dashboard'}
              </button>
              <button type="button" onClick={() => void handleCopyVisibleQueue()} className="button-ghost">
                {copiedQueue ? 'Queue copied' : 'Copy visible queue'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setLeagueFilter('')
                  setTeamFilter('')
                  setStatusFilter('pending')
                  setFocusFilter('all')
                }}
                className="button-ghost"
              >
                Reset filters
              </button>
              <Link href="/admin/import?kind=scorecard" className="button-primary">
                Open Scorecard Import
              </Link>
            </div>
          </section>

          {!loading && !error && backlogSummaries.leagues.length > 0 ? (
            <section className="surface-card panel-pad section" style={{ marginTop: 18 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 18,
                }}
              >
                <div>
                  <div className="section-kicker">League backlog</div>
                  <h2 className="section-title" style={{ marginTop: 6 }}>Where scorecards are backing up</h2>
                  <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                    {backlogSummaries.leagues.map((entry) => (
                      <button
                        key={entry.label}
                        type="button"
                        className="button-ghost"
                        style={{ justifyContent: 'space-between' }}
                        onClick={() => {
                          setLeagueFilter(entry.label)
                          setTeamFilter('')
                          setStatusFilter('pending')
                        }}
                      >
                        <span>{entry.label}</span>
                        <span>{entry.count}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="section-kicker">Team backlog</div>
                  <h2 className="section-title" style={{ marginTop: 6 }}>Teams still waiting on uploads</h2>
                  <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                    {backlogSummaries.teams.map((entry) => (
                      <button
                        key={`${entry.label}-${entry.league}`}
                        type="button"
                        className="button-ghost"
                        style={{ justifyContent: 'space-between' }}
                        onClick={() => {
                          setLeagueFilter(entry.league)
                          setTeamFilter(entry.label)
                          setStatusFilter('pending')
                        }}
                      >
                        <span>{entry.label}</span>
                        <span>{entry.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section className="surface-card panel-pad section" style={{ marginTop: 18 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div className="section-kicker">Weekly control panel</div>
                <h2 className="section-title" style={{ marginTop: 6 }}>Scorecard queue</h2>
                <p className="subtle-text" style={{ marginTop: 8, maxWidth: 760 }}>
                  Use this list to track what still needs to be uploaded, what is coming up later, and
                  which parent matches already look complete from score or imported line data.
                </p>
                {focusFilter !== 'all' ? (
                  <p className="subtle-text" style={{ marginTop: 8, maxWidth: 760 }}>
                    Focus lane active: {focusFilter === 'due-this-week' ? 'Due this week' : focusFilter === 'missing-id' ? 'Missing external IDs' : 'Missing league names'}.
                  </p>
                ) : null}
              </div>
              <div className="badge badge-slate" style={{ minHeight: 42 }}>
                {filteredRows.length} visible match{filteredRows.length === 1 ? '' : 'es'}
              </div>
            </div>

            {loading ? (
              <div className="subtle-text" style={{ marginTop: 16 }}>Loading missing scorecard dashboard...</div>
            ) : error ? (
              <div
                className="badge"
                style={{
                  marginTop: 18,
                  minHeight: 44,
                  width: '100%',
                  justifyContent: 'flex-start',
                  padding: '10px 14px',
                  background: 'rgba(220,38,38,0.12)',
                  color: '#991b1b',
                  border: '1px solid rgba(220,38,38,0.18)',
                }}
              >
                {error}
              </div>
            ) : filteredRows.length === 0 ? (
              <div
                style={{
                  marginTop: 18,
                  padding: 18,
                  borderRadius: 16,
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  color: '#475569',
                }}
              >
                No matches are currently visible for this filter set. Try widening the status, league, team, or search scope.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                {filteredRows.map((row) => {
                  const status = summary.classify(row)
                  const externalMatchId = cleanText(row.external_match_id)
                  const importedLines = externalMatchId ? summary.importedLineCounts.get(externalMatchId) || 0 : 0
                  const searchSeed =
                    externalMatchId || `${cleanText(row.home_team)} ${cleanText(row.away_team)}`.trim()

                  return (
                    <article
                      key={row.id}
                      className="surface-card"
                      style={{
                        padding: 18,
                        border: '1px solid rgba(116,190,255,0.12)',
                        background:
                          status === 'pending'
                            ? 'linear-gradient(180deg, rgba(45,22,12,0.72) 0%, rgba(15,23,42,0.96) 100%)'
                            : status === 'completed'
                              ? 'linear-gradient(180deg, rgba(18,48,29,0.68) 0%, rgba(9,18,34,0.94) 100%)'
                              : 'linear-gradient(180deg, rgba(17,34,63,0.70) 0%, rgba(9,18,34,0.94) 100%)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 16,
                          alignItems: 'flex-start',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ maxWidth: 760 }}>
                          <div style={{ color: '#F8FBFF', fontWeight: 800, fontSize: '1rem' }}>
                            {cleanText(row.home_team) || 'Unknown home'} vs {cleanText(row.away_team) || 'Unknown away'}
                          </div>
                          <div className="subtle-text" style={{ marginTop: 6 }}>
                            {formatDate(row.match_date)} | {leagueScopeLabel(row.league_name, row.flight)}
                          </div>
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                            <span className={status === 'pending' ? 'badge badge-green' : status === 'completed' ? 'badge badge-slate' : 'badge badge-blue'}>
                              {status === 'pending' ? 'Past due' : status === 'completed' ? 'Completed' : 'Upcoming'}
                            </span>
                            <span className="badge badge-blue">Match ID: {externalMatchId || 'Missing'}</span>
                            <span className="badge badge-slate">Scorecard lines: {importedLines}</span>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gap: 10 }}>
                          <Link href={`/admin/manage-matches?search=${encodeURIComponent(searchSeed)}`} className="button-ghost">
                            Review in Manage Matches
                          </Link>
                          <Link
                            href={`/admin/missing-scorecards?status=${status}&league=${encodeURIComponent(leagueScopeLabel(row.league_name, row.flight))}&team=${encodeURIComponent(cleanText(row.home_team) || cleanText(row.away_team))}`}
                            className="button-ghost"
                          >
                            Open scoped queue
                          </Link>
                          <Link
                            href={`/admin/import?kind=scorecard&leagueOverride=${encodeURIComponent(cleanText(row.league_name))}`}
                            className="button-primary"
                          >
                            Import scorecard
                          </Link>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </section>
      </AdminGate>
    </SiteShell>
  )
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper: string
}) {
  return (
    <div className="surface-card" style={{ padding: 18 }}>
      <div className="section-kicker">{label}</div>
      <div style={{ color: '#F8FBFF', fontWeight: 900, fontSize: '2rem', marginTop: 8 }}>{value}</div>
      <div className="subtle-text" style={{ marginTop: 8 }}>{helper}</div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label style={{ display: 'grid', gap: 8 }}>
      <span className="section-kicker">{label}</span>
      {children}
    </label>
  )
}
