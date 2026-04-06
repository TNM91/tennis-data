
'use client'

import { ChangeEvent, useMemo, useState } from 'react'
import SiteShell from '@/app/components/site-shell'
import {
  buildImportPreview,
  commitImportPreview,
  normalizeDate,
  type CommitImportWithFailuresResult,
  type ImportPreview,
  type PreparedImportRow,
} from '@/lib/importEngine'
import { parseScorecardHtml, ParsedScorecard } from '@/lib/parseScorecardHtml'

function normalizeName(name: string) {
  return name.replace(/\s+/g, ' ').trim()
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
  const [previewLoading, setPreviewLoading] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [result, setResult] = useState<CommitImportWithFailuresResult | null>(null)

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
    setPreview(null)
    setResult(null)
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

  function buildPreparedRows(): PreparedImportRow[] {
    if (!parsed) return []

    const matchDate = resolvedMatchDate
    if (!matchDate) {
      throw new Error('Could not determine a valid match date. Enter one manually before previewing.')
    }

    return parsed.lines.map((line, index) => {
      const sourceParts = [
        'scorecard-upload',
        parsed.leagueName || null,
        parsed.matchNumber ? `match-${parsed.matchNumber}` : null,
        resolvedHomeTeam || null,
        resolvedAwayTeam || null,
      ].filter(Boolean)

      return {
        sourceIndex: index + 1,
        sideA: line.teamAPlayers.map(normalizeName),
        sideB: line.teamBPlayers.map(normalizeName),
        rawResult: `${line.lineNumber} | ${line.teamAPlayers.join(' / ')} | ${line.teamBPlayers.join(' / ')} | ${line.score}`,
        score: line.score,
        winnerSide: line.winnerSide,
        date: normalizeDate(matchDate),
        matchType: line.matchType,
        source: sourceParts.join(' | '),
        lineNumber: line.lineNumber != null ? String(line.lineNumber) : null,
        externalMatchId: parsed.matchNumber || null,
        createPlayerDefaults: {
          flight: parsed.flight || null,
          singles_rating: 3.5,
          singles_dynamic_rating: 3.5,
          doubles_rating: 3.5,
          doubles_dynamic_rating: 3.5,
          overall_rating: 3.5,
          overall_dynamic_rating: 3.5,
        },
        matchInsertOverrides: {
          flight: parsed.flight || null,
          usta_section: parsed.ustaSection || null,
          district_area: parsed.districtArea || null,
          league_name: parsed.league || parsed.leagueName || null,
          home_team: resolvedHomeTeam || null,
          away_team: resolvedAwayTeam || null,
        },
      }
    })
  }

  async function handlePreviewImport() {
    if (!parsed) {
      setError('No parsed scorecard available.')
      return
    }

    setPreviewLoading(true)

    setError('')
    setStatus('')
    setResult(null)
    setPreview(null)

    try {
      const preparedRows = buildPreparedRows()
      const builtPreview = await buildImportPreview(preparedRows, [])
      setPreview(builtPreview)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed.')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function importScorecard() {
    if (!preview) {
      setError('Preview the scorecard before importing.')
      return
    }

    setImporting(true)
    setError('')
    setStatus('')
    setResult(null)

    try {
      const importResult = await commitImportPreview(preview, {
        createMissingPlayers: true,
        recalculateRatings: true,
        failFast: true,
      })

      setResult(importResult)

      const messageParts = [
        `Inserted ${importResult.insertedMatchCount}.`,
        `Skipped ${importResult.skippedDuplicateMatchCount}.`,
        `Created ${importResult.createdPlayerCount} new players.`,
      ]

      if (importResult.insertedMatchCount > 0) {
        messageParts.push(
          importResult.ratingsRecalculated
            ? 'Ratings recalculated.'
            : 'Import completed, but ratings were not recalculated.'
        )
      }

      if (importResult.rowFailures.length > 0) {
        messageParts.push(`${importResult.rowFailures.length} row failures occurred.`)
      }

      setStatus(messageParts.join(' '))
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <SiteShell active="/admin">
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
            <h1 className="page-title">Upload Scorecard</h1>
            <p className="page-subtitle">
              Upload a USTA scorecard export, preview parsed singles and doubles lines,
              then import them into matches and match_players with duplicate protection.
            </p>
          </div>
        </section>

        <section
          className="surface-card panel-pad section"
          style={{
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-90px',
              right: '-70px',
              width: '240px',
              height: '240px',
              borderRadius: '999px',
              background:
                'radial-gradient(circle, rgba(74,163,255,0.14) 0%, transparent 72%)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-120px',
              left: '-60px',
              width: '220px',
              height: '220px',
              borderRadius: '999px',
              background:
                'radial-gradient(circle, rgba(155,225,29,0.10) 0%, transparent 74%)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'relative', zIndex: 1 }}>
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
                  color: '#fca5a5',
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
                    background:
                      'linear-gradient(180deg, rgba(17,34,63,0.58) 0%, rgba(9,18,34,0.86) 100%)',
                    borderColor: 'rgba(155,225,29,0.18)',
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      color: '#F8FBFF',
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

                <div
                  style={{
                    marginTop: 22,
                    display: 'flex',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    onClick={handlePreviewImport}
                    disabled={previewLoading || importing || !resolvedMatchDate}
                    className="button-secondary"
                    style={{
                      opacity: previewLoading || importing || !resolvedMatchDate ? 0.7 : 1,
                      cursor:
                        previewLoading || importing || !resolvedMatchDate
                          ? 'not-allowed'
                          : 'pointer',
                    }}
                  >
                    {previewLoading ? 'Preparing Preview...' : 'Preview Import'}
                  </button>

                  <button
                    onClick={importScorecard}
                    disabled={importing || !preview}
                    className="button-primary"
                    style={{
                      opacity: importing || !preview ? 0.7 : 1,
                      cursor: importing || !preview ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {importing ? 'Importing + Recalculating...' : 'Confirm Import'}
                  </button>
                </div>

                {preview ? (
                  <section className="surface-card section" style={{ marginTop: 22, padding: 18 }}>
                    <h2 className="section-title">Import Preview</h2>

                    <div className="metric-grid" style={{ marginTop: 18 }}>
                      <MetricCard label="Valid Matches" value={String(preview.parsedCount)} />
                      <MetricCard label="Unique Matches" value={String(preview.uniqueMatchCount)} />
                      <MetricCard label="Ready To Import" value={String(preview.readyRows.length)} />
                      <MetricCard label="Duplicates In File" value={String(preview.duplicateInFileCount)} />
                      <MetricCard label="Duplicates In DB" value={String(preview.duplicateInDbCount)} />
                      <MetricCard label="Players To Create" value={String(preview.missingNames.length)} />
                    </div>

                    {preview.missingNames.length > 0 ? (
                      <div
                        className="badge badge-blue"
                        style={{
                          marginTop: 16,
                          minHeight: 44,
                          width: '100%',
                          justifyContent: 'flex-start',
                          padding: '10px 14px',
                        }}
                      >
                        Players that will be created: {preview.missingNames.join(', ')}
                      </div>
                    ) : null}
                  </section>
                ) : null}

                <div style={{ marginTop: 22 }}>
                  <h2 className="section-title">Preview</h2>

                  <div className="card-grid two" style={{ marginTop: 14 }}>
                    {parsed.lines.map((line, index) => (
                      <div
                        key={`${line.lineNumber}-${index}`}
                        className="surface-card"
                        style={{
                          padding: 18,
                          background:
                            'linear-gradient(180deg, rgba(17,34,63,0.74) 0%, rgba(9,18,34,0.92) 100%)',
                          border: '1px solid rgba(116,190,255,0.14)',
                        }}
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
                              color: '#F8FBFF',
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
                          <strong style={{ color: '#F8FBFF' }}>Side A:</strong>{' '}
                          {line.teamAPlayers.join(' / ')}
                        </div>

                        <div className="subtle-text" style={{ marginBottom: 8 }}>
                          <strong style={{ color: '#F8FBFF' }}>Side B:</strong>{' '}
                          {line.teamBPlayers.join(' / ')}
                        </div>

                        <div className="subtle-text">
                          <strong style={{ color: '#F8FBFF' }}>Score:</strong> {line.score}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {result && result.rowFailures.length > 0 ? (
                  <section className="surface-card section" style={{ marginTop: 22, padding: 18 }}>
                    <h2 className="section-title">Row Failures</h2>
                    <div className="table-wrap" style={{ marginTop: 14 }}>
                      <table className="data-table" style={{ minWidth: 820 }}>
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>Raw</th>
                            <th>Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.rowFailures.map((row) => (
                            <tr key={`failure-${row.sourceIndex}-${row.raw}`}>
                              <td>{row.sourceIndex}</td>
                              <td>{row.raw}</td>
                              <td>{row.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}
          </div>
        </section>
      </section>
    </SiteShell>
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
