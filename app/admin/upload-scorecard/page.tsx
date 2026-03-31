'use client'

import { ChangeEvent, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { recalculateDynamicRatings } from '@/lib/recalculateRatings'
import { parseScorecardHtml, ParsedScorecard } from '@/lib/parseScorecardHtml'

type ImportResult = {
  inserted: number
  skipped: number
  createdPlayers: number
}

function normalizeName(name: string) {
  return name.replace(/\s+/g, ' ').trim()
}

function slugifyName(name: string) {
  return normalizeName(name).toLowerCase()
}

function buildDedupeKey(
  matchDate: string,
  matchType: 'singles' | 'doubles',
  teamAPlayers: string[],
  teamBPlayers: string[],
  score: string
) {
  const a = [...teamAPlayers].map(slugifyName).sort().join('|')
  const b = [...teamBPlayers].map(slugifyName).sort().join('|')
  return `${matchDate}__${matchType}__${a}__${b}__${score.trim()}`
}

function formatDateForDb(value: string | null) {
  if (!value) return null

  const trimmed = value.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  const parts = trimmed.split('/')
  if (parts.length === 3) {
    const [month, day, year] = parts
    const yyyy = year.length === 2 ? `20${year}` : year
    const mm = month.padStart(2, '0')
    const dd = day.padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null

  const yyyy = parsed.getFullYear()
  const mm = String(parsed.getMonth() + 1).padStart(2, '0')
  const dd = String(parsed.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function displayDate(value: string | null) {
  if (!value) return 'Unknown'

  const dbDate = formatDateForDb(value)
  if (!dbDate) return value

  const parsed = new Date(`${dbDate}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function UploadScorecardPage() {
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedScorecard | null>(null)
  const [manualMatchDate, setManualMatchDate] = useState('')
  const [manualHomeTeam, setManualHomeTeam] = useState('')
  const [manualAwayTeam, setManualAwayTeam] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)
  const [importing, setImporting] = useState(false)

  const previewCount = useMemo(() => parsed?.lines.length ?? 0, [parsed])

  const resolvedMatchDate = useMemo(() => {
    if (manualMatchDate) return manualMatchDate
    return formatDateForDb(parsed?.matchDate || null) || ''
  }, [manualMatchDate, parsed])

  const resolvedHomeTeam = useMemo(() => {
    if (manualHomeTeam.trim()) return manualHomeTeam.trim()
    return parsed?.homeTeam?.trim() || ''
  }, [manualHomeTeam, parsed])

  const resolvedAwayTeam = useMemo(() => {
    if (manualAwayTeam.trim()) return manualAwayTeam.trim()
    return parsed?.awayTeam?.trim() || ''
  }, [manualAwayTeam, parsed])

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null

    setError('')
    setStatus('')
    setParsed(null)
    setFileName(file?.name || '')
    setManualMatchDate('')
    setManualHomeTeam('')
    setManualAwayTeam('')

    if (!file) return

    setLoadingFile(true)

    try {
      const text = await file.text()
      const parsedResult = parseScorecardHtml(text)

      if (!parsedResult.lines.length) {
        throw new Error('No valid match lines were found in this scorecard.')
      }

      setParsed(parsedResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse scorecard.')
    } finally {
      setLoadingFile(false)
    }
  }

  async function getOrCreatePlayerId(
    name: string,
    flight: string | null
  ): Promise<{ id: string; created: boolean }> {
    const normalized = normalizeName(name)

    const { data: existing, error: existingError } = await supabase
      .from('players')
      .select('id,name,flight')
      .ilike('name', normalized)
      .limit(1)

    if (existingError) throw existingError

    if (existing && existing.length > 0) {
      const existingId = existing[0].id

      if (flight) {
        await supabase
          .from('players')
          .update({ flight })
          .eq('id', existingId)
          .is('flight', null)
      }

      return { id: existingId, created: false }
    }

    const { data: inserted, error: insertError } = await supabase
      .from('players')
      .insert({
        name: normalized,
        location: null,
        flight: flight || null,
        singles_rating: null,
        singles_dynamic_rating: null,
        doubles_rating: null,
        doubles_dynamic_rating: null,
        overall_rating: null,
        overall_dynamic_rating: null,
      })
      .select('id')
      .single()

    if (insertError) throw insertError

    return { id: inserted.id, created: true }
  }

  async function importScorecard() {
    if (!parsed) {
      setError('No parsed scorecard available.')
      return
    }

    const matchDate = resolvedMatchDate
    if (!matchDate) {
      setError('Could not determine a valid match date. Enter one manually before importing.')
      return
    }

    setImporting(true)
    setError('')
    setStatus('')

    try {
      const result: ImportResult = {
        inserted: 0,
        skipped: 0,
        createdPlayers: 0,
      }

      for (const line of parsed.lines) {
        const dedupeKey = buildDedupeKey(
          matchDate,
          line.matchType,
          line.teamAPlayers,
          line.teamBPlayers,
          line.score
        )

        const { data: existingMatch, error: existingError } = await supabase
          .from('matches')
          .select('id')
          .eq('dedupe_key', dedupeKey)
          .limit(1)

        if (existingError) throw existingError

        if (existingMatch && existingMatch.length > 0) {
          result.skipped += 1
          continue
        }

        const teamAPlayerIds: string[] = []
        const teamBPlayerIds: string[] = []

        for (const name of line.teamAPlayers) {
          const player = await getOrCreatePlayerId(name, parsed.flight)
          if (player.created) result.createdPlayers += 1
          teamAPlayerIds.push(player.id)
        }

        for (const name of line.teamBPlayers) {
          const player = await getOrCreatePlayerId(name, parsed.flight)
          if (player.created) result.createdPlayers += 1
          teamBPlayerIds.push(player.id)
        }

        const sourceParts = [
          'scorecard-upload',
          parsed.leagueName || null,
          parsed.matchNumber ? `match-${parsed.matchNumber}` : null,
          resolvedHomeTeam || null,
          resolvedAwayTeam || null,
        ].filter(Boolean)

        const { data: insertedMatch, error: matchInsertError } = await supabase
          .from('matches')
          .insert({
            match_date: matchDate,
            match_type: line.matchType,
            score: line.score,
            winner_side: line.winnerSide,
            dedupe_key: dedupeKey,
            source: sourceParts.join(' | '),
            flight: parsed.flight || null,
            usta_section: parsed.ustaSection || null,
            district_area: parsed.districtArea || null,
            league_name: parsed.league || parsed.leagueName || null,
            home_team: resolvedHomeTeam || null,
            away_team: resolvedAwayTeam || null,
          })
          .select('id')
          .single()

        if (matchInsertError) throw matchInsertError

        const matchPlayersPayload = [
          ...teamAPlayerIds.map((playerId, index) => ({
            match_id: insertedMatch.id,
            player_id: playerId,
            side: 'A',
            seat: index + 1,
          })),
          ...teamBPlayerIds.map((playerId, index) => ({
            match_id: insertedMatch.id,
            player_id: playerId,
            side: 'B',
            seat: index + 1,
          })),
        ]

        const { error: matchPlayersError } = await supabase
          .from('match_players')
          .insert(matchPlayersPayload)

        if (matchPlayersError) throw matchPlayersError

        result.inserted += 1
      }

      if (result.inserted > 0) {
        setStatus(`Imported ${result.inserted} lines. Recalculating ratings now...`)
        await recalculateDynamicRatings()
        setStatus(
          `Import complete. Inserted ${result.inserted}, skipped ${result.skipped}, created ${result.createdPlayers} new players, and recalculated ratings.`
        )
      } else {
        setStatus(`No new lines were inserted. Skipped ${result.skipped} duplicates.`)
      }
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="hero-inner">
          <div className="section-kicker">Admin Tool</div>
          <h1 className="page-title">Upload Scorecard</h1>
          <p className="page-subtitle">
            Upload a USTA scorecard export, preview parsed singles and doubles lines,
            then import them into matches and match_players with duplicate protection.
          </p>
        </div>
      </section>

      <section className="surface-card panel-pad section">
        <div>
          <label className="label">Scorecard file</label>

          <input
            id="scorecard-upload"
            type="file"
            accept=".xls,.html"
            onChange={onFileChange}
            style={{ display: 'none' }}
          />

          <label
            htmlFor="scorecard-upload"
            className="button-secondary"
            style={{
              display: 'inline-flex',
              width: 'fit-content',
              cursor: 'pointer',
              marginTop: 8,
            }}
          >
            Choose Scorecard File
          </label>

          <div className="subtle-text" style={{ marginTop: 10 }}>
            Supports HTML-based <code>.xls</code> scorecards and <code>.html</code> files.
          </div>
        </div>

        {fileName ? (
          <div
            className="badge badge-blue"
            style={{
              marginTop: 16,
              minHeight: 42,
              width: '100%',
              justifyContent: 'flex-start',
              padding: '10px 14px',
            }}
          >
            Loaded file: {fileName}
          </div>
        ) : null}

        {loadingFile ? (
          <p className="subtle-text" style={{ marginTop: 16 }}>
            Parsing scorecard...
          </p>
        ) : null}

        {error ? (
          <div
            className="badge"
            style={{
              marginTop: 16,
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
        ) : null}

        {status ? (
          <div
            className="badge badge-green"
            style={{
              marginTop: 16,
              minHeight: 44,
              width: '100%',
              justifyContent: 'flex-start',
              padding: '10px 14px',
            }}
          >
            {status}
          </div>
        ) : null}

        {parsed ? (
          <>
            <div className="metric-grid" style={{ marginTop: 22 }}>
              <MetricCard label="Parsed Match Date" value={displayDate(parsed.matchDate)} />
              <MetricCard label="Flight" value={parsed.flight || 'Unknown'} />
              <MetricCard label="USTA Section" value={parsed.ustaSection || 'Unknown'} />
              <MetricCard label="District / Area" value={parsed.districtArea || 'Unknown'} />
              <MetricCard label="League" value={parsed.league || parsed.leagueName || 'Unknown'} />
              <MetricCard label="Match #" value={parsed.matchNumber || 'Unknown'} />
              <MetricCard label="Lines Found" value={String(previewCount)} />
            </div>

            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                marginTop: 18,
              }}
            >
              <div className="badge badge-blue" style={{ minHeight: 40 }}>
                Home: {resolvedHomeTeam || 'Unknown'}
              </div>

              <div className="badge badge-slate" style={{ minHeight: 40 }}>
                Away: {resolvedAwayTeam || 'Unknown'}
              </div>
            </div>

            <section
              className="surface-card"
              style={{
                marginTop: 18,
                padding: 18,
                borderStyle: 'dashed',
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                }}
              >
                Import Overrides
              </h2>

              <div className="card-grid three" style={{ marginTop: 16 }}>
                <Field label="Match date override">
                  <input
                    type="date"
                    value={manualMatchDate}
                    onChange={(e) => setManualMatchDate(e.target.value)}
                    className="input"
                  />
                </Field>

                <Field label="Home team override">
                  <input
                    type="text"
                    value={manualHomeTeam}
                    onChange={(e) => setManualHomeTeam(e.target.value)}
                    placeholder="Enter home team if parser missed it"
                    className="input"
                  />
                </Field>

                <Field label="Away team override">
                  <input
                    type="text"
                    value={manualAwayTeam}
                    onChange={(e) => setManualAwayTeam(e.target.value)}
                    placeholder="Enter away team if parser missed it"
                    className="input"
                  />
                </Field>
              </div>

              <div className="subtle-text" style={{ marginTop: 12 }}>
                Leave overrides blank to use parsed values. Import will use:{' '}
                <strong>{resolvedMatchDate || 'No valid date yet'}</strong>
              </div>
            </section>

            <div style={{ marginTop: 22 }}>
              <h2 className="section-title">Preview</h2>

              <div className="card-grid two" style={{ marginTop: 14 }}>
                {parsed.lines.map((line, index) => (
                  <div
                    key={`${line.lineNumber}-${index}`}
                    className="surface-card"
                    style={{ padding: 18 }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                        alignItems: 'center',
                        marginBottom: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div
                        style={{
                          color: '#0f172a',
                          fontWeight: 800,
                          fontSize: '1rem',
                        }}
                      >
                        {line.lineNumber} • {capitalize(line.matchType)}
                      </div>

                      <span
                        className={line.winnerSide === 'A' ? 'badge badge-blue' : 'badge badge-green'}
                      >
                        Winner: Side {line.winnerSide}
                      </span>
                    </div>

                    <div className="subtle-text" style={{ marginBottom: 8 }}>
                      <strong style={{ color: '#0f172a' }}>Side A:</strong>{' '}
                      {line.teamAPlayers.join(' / ')}
                    </div>

                    <div className="subtle-text" style={{ marginBottom: 8 }}>
                      <strong style={{ color: '#0f172a' }}>Side B:</strong>{' '}
                      {line.teamBPlayers.join(' / ')}
                    </div>

                    <div className="subtle-text">
                      <strong style={{ color: '#0f172a' }}>Score:</strong> {line.score}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                marginTop: 22,
                display: 'flex',
                justifyContent: 'flex-start',
              }}
            >
              <button
                onClick={importScorecard}
                disabled={importing || !resolvedMatchDate}
                className="button-primary"
                style={{
                  opacity: importing || !resolvedMatchDate ? 0.7 : 1,
                  cursor: importing || !resolvedMatchDate ? 'not-allowed' : 'pointer',
                }}
              >
                {importing ? 'Importing + Recalculating...' : 'Confirm Import'}
              </button>
            </div>
          </>
        ) : null}
      </section>
    </main>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ fontSize: '1.15rem', lineHeight: 1.2 }}>
        {value}
      </div>
    </div>
  )
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}