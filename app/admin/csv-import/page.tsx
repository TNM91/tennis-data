
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import SiteShell from '@/app/components/site-shell'
import {
  buildImportPreview,
  commitImportPreview,
  formatImportSummary,
  determineMatchType,
  normalizeDate,
  normalizeNullableText,
  normalizeResult,
  normalizeSource,
  normalizeWinnerSide,
  parsePrefixedResult,
  splitSide,
  type ImportPreview,
  type InvalidImportRow,
  type MatchSide,
  type MatchType,
  type PreparedImportRow,
  type CommitImportWithFailuresResult,
} from '@/lib/importEngine'
import { supabase } from '../../../lib/supabase'

type CsvRow = Record<string, string>

const ADMIN_ID = 'accc3471-8912-491c-b8d9-4a84dcc7c42e'

export default function CsvImportPage() {
  const router = useRouter()

  const [fileName, setFileName] = useState('')
  const [csvText, setCsvText] = useState('')
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<CommitImportWithFailuresResult | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)

  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      setUser(user)
      setAuthLoading(false)

      if (!user || user.id !== ADMIN_ID) {
        router.push('/admin')
      }
    }

    void checkUser()
  }, [router])

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')
    setMessage('')
    setResult(null)
    setPreview(null)
    setFileName(file.name)

    try {
      const text = await file.text()
      setCsvText(text)
    } catch {
      setError('Failed to read CSV file.')
    }
  }

  async function handlePreview() {
    setPreviewLoading(true)
    setError('')
    setMessage('')
    setResult(null)
    setPreview(null)

    try {
      const parsed = parseCsvTextWithInvalidRows(csvText)

      if (parsed.validRows.length === 0 && parsed.invalidRows.length === 0) {
        throw new Error('No rows found.')
      }

      const builtPreview = await buildImportPreview(parsed.validRows, parsed.invalidRows)
      setPreview(builtPreview)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleConfirmImport() {
    if (!preview) return

    setLoading(true)
    setError('')
    setMessage('')
    setResult(null)

    try {
      const importResult = await commitImportPreview(preview, {
        createMissingPlayers: true,
        recalculateRatings: true,
        failFast: false,
      })

      setResult(importResult)

      await logImportRun({
        source: 'csv',
        insertedCount: importResult.insertedMatchCount,
        duplicateCount: importResult.skippedDuplicateMatchCount,
        failedCount: importResult.failedRowCount,
        createdPlayers: importResult.createdPlayerCount,
        status:
          importResult.failedRowCount > 0
            ? 'partial_success'
            : importResult.insertedMatchCount > 0
              ? 'success'
              : 'no_new_rows',
      })

      setMessage(formatImportSummary(importResult))
      setCsvText('')
      setFileName('')
      setPreview(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV import failed')
    } finally {
      setLoading(false)
    }
  }

  const readyCount = useMemo(
    () => preview?.previewRows.filter((row) => row.status === 'ready').length ?? 0,
    [preview]
  )

  if (authLoading) {
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
              <h1 className="page-title">Checking access...</h1>
              <p className="page-subtitle">
                Verifying administrator permissions and loading import tools.
              </p>
            </div>
          </section>
        </section>
      </SiteShell>
    )
  }

  if (!user || user.id !== ADMIN_ID) {
    return null
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
            <h1 className="page-title">CSV Import</h1>
            <p className="page-subtitle">
              Upload a CSV of singles or doubles matches, preview duplicates before import,
              create missing players automatically, and load data into the matches and
              match_players structure.
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
            <h2 className="section-title">CSV Format</h2>
            <p className="subtle-text" style={{ marginTop: 8 }}>Recommended columns:</p>

            <pre
              style={{
                marginTop: 14,
                background: 'rgba(8,15,28,0.82)',
                border: '1px solid rgba(116,190,255,0.14)',
                borderRadius: 16,
                padding: 16,
                overflowX: 'auto',
                color: '#dbeafe',
                fontSize: '0.92rem',
                lineHeight: 1.55,
              }}
            >
{`match_date,match_type,side_a_players,side_b_players,result,source,external_match_id,line_number
2026-01-18,singles,Stephen Hipkiss,Nathan Meinert,W 6-2 6-1,usta,1011650666,1S
2026-01-18,doubles,Matthew Hodge / Alex Schaefer,Christopher Krieger / David Cabrera,W 6-3 6-3,usta,1011650666,1D`}
            </pre>

            <p className="subtle-text" style={{ marginTop: 16 }}>
              You can also use <strong>date</strong> instead of <strong>match_date</strong>, and either:
            </p>

            <pre
              style={{
                marginTop: 14,
                background: 'rgba(8,15,28,0.82)',
                border: '1px solid rgba(116,190,255,0.14)',
                borderRadius: 16,
                padding: 16,
                overflowX: 'auto',
                color: '#dbeafe',
                fontSize: '0.92rem',
                lineHeight: 1.55,
              }}
            >
{`result
W 6-2 6-1

OR

score,winner_side
6-2 6-1,A`}
            </pre>

            <div style={{ marginTop: 18 }}>
              <label className="label">Upload File</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                disabled={loading || previewLoading}
              />
            </div>

            {fileName && (
              <div
                className="badge badge-blue"
                style={{
                  marginTop: 16,
                  minHeight: 40,
                  justifyContent: 'flex-start',
                  width: '100%',
                  padding: '10px 14px',
                }}
              >
                <strong>Selected file:</strong>&nbsp;{fileName}
              </div>
            )}

            {csvText && (
              <div style={{ marginTop: 18 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.08rem',
                    fontWeight: 800,
                    color: '#F8FBFF',
                    letterSpacing: '-0.02em',
                  }}
                >
                  CSV Preview
                </h3>

                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="textarea"
                  style={{ marginTop: 14, minHeight: 240 }}
                  disabled={loading || previewLoading}
                />
              </div>
            )}

            <div
              style={{
                marginTop: 18,
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <button
                onClick={handlePreview}
                className="button-primary"
                style={{
                  opacity: previewLoading || loading ? 0.7 : 1,
                  cursor: previewLoading || loading ? 'not-allowed' : 'pointer',
                }}
                disabled={previewLoading || loading || !csvText.trim()}
              >
                {previewLoading ? 'Preparing Preview...' : 'Preview Import'}
              </button>

              {preview && (
                <>
                  <button
                    onClick={handleConfirmImport}
                    className="button-secondary"
                    style={{
                      opacity: loading ? 0.7 : 1,
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                    disabled={loading}
                  >
                    {loading ? 'Importing...' : `Confirm Import (${readyCount} Ready)`}
                  </button>

                  <button
                    onClick={() => setPreview(null)}
                    className="button-ghost"
                    style={{
                      background: 'rgba(15,23,42,0.24)',
                      color: '#dbeafe',
                      border: '1px solid rgba(116,190,255,0.12)',
                    }}
                    disabled={loading}
                  >
                    Clear Preview
                  </button>
                </>
              )}
            </div>

            {message && (
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
                {message}
              </div>
            )}

            {error && (
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
            )}
          </div>
        </section>

        {preview && (
          <section className="surface-card panel-pad section">
            <h2 className="section-title">Preview Summary</h2>

            <div className="metric-grid" style={{ marginTop: 18 }}>
              <MetricCard label="Valid Matches" value={preview.parsedCount} />
              <MetricCard label="Invalid Rows" value={preview.invalidCount} />
              <MetricCard label="Participant Rows" value={preview.participantRowCount} />
              <MetricCard label="Unique Matches" value={preview.uniqueMatchCount} />
              <MetricCard label="Ready To Import" value={readyCount} />
              <MetricCard label="Duplicates In File" value={preview.duplicateInFileCount} />
              <MetricCard label="Duplicates In DB" value={preview.duplicateInDbCount} />
              <MetricCard label="Players To Create" value={preview.missingNames.length} />
            </div>

            {preview.missingNames.length > 0 && (
              <div
                className="badge badge-blue"
                style={{
                  marginTop: 18,
                  minHeight: 44,
                  width: '100%',
                  justifyContent: 'flex-start',
                  padding: '10px 14px',
                }}
              >
                <strong>Players that will be created:</strong>&nbsp;{preview.missingNames.join(', ')}
              </div>
            )}

            {preview.invalidRows.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.08rem',
                    fontWeight: 800,
                    color: '#F8FBFF',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Invalid Rows
                </h3>

                <div className="table-wrap" style={{ marginTop: 14 }}>
                  <table className="data-table" style={{ minWidth: 840 }}>
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Raw</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.invalidRows.map((row) => (
                        <tr key={`invalid-${row.sourceIndex}-${row.raw}`}>
                          <td>{row.sourceIndex}</td>
                          <td>{row.raw}</td>
                          <td>{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ marginTop: 22 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.08rem',
                  fontWeight: 800,
                  color: '#F8FBFF',
                  letterSpacing: '-0.02em',
                }}
              >
                Row Preview
              </h3>

              <div className="table-wrap" style={{ marginTop: 14 }}>
                <table className="data-table" style={{ minWidth: 1080 }}>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Side A</th>
                      <th>Side B</th>
                      <th>Result</th>
                      <th>Score</th>
                      <th>Winner</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.previewRows.map((row) => (
                      <tr key={`${row.sourceIndex}-${row.dedupeKey}`}>
                        <td>{row.sourceIndex}</td>
                        <td>{row.sideA.join(' / ')}</td>
                        <td>{row.sideB.join(' / ')}</td>
                        <td>{row.rawResult}</td>
                        <td>{row.score}</td>
                        <td>{row.winnerSide}</td>
                        <td>{row.date}</td>
                        <td>{capitalize(row.matchType)}</td>
                        <td>
                          <span
                            className={
                              row.status === 'ready'
                                ? 'badge badge-green'
                                : row.status === 'duplicate_in_file'
                                  ? 'badge badge-slate'
                                  : 'badge badge-blue'
                            }
                          >
                            {row.reason}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {result && (
          <section className="surface-card panel-pad section">
            <h2 className="section-title">Import Summary</h2>

            <div className="metric-grid" style={{ marginTop: 18 }}>
              <MetricCard label="Source Matches" value={result.parsedCount} />
              <MetricCard label="Participant Rows" value={result.participantRowCount} />
              <MetricCard label="Unique Matches" value={result.uniqueMatchCount} />
              <MetricCard label="Inserted Matches" value={result.insertedMatchCount} />
              <MetricCard label="Skipped Duplicates" value={result.skippedDuplicateMatchCount} />
              <MetricCard label="Failed Rows" value={result.failedRowCount} />
              <MetricCard label="Created Players" value={result.createdPlayerCount} />
            </div>

            <p style={{ marginTop: 16, color: '#cbd5e1' }}>
              Ratings recalculated: <strong>{result.ratingsRecalculated ? 'Yes' : 'No'}</strong>
            </p>

            {result.rowFailures.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.08rem',
                    fontWeight: 800,
                    color: '#F8FBFF',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Row Failures
                </h3>

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
              </div>
            )}
          </section>
        )}
      </section>
    </SiteShell>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  )
}

function parseCsvTextWithInvalidRows(text: string): {
  validRows: PreparedImportRow[]
  invalidRows: InvalidImportRow[]
} {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)

  if (lines.length === 0) {
    return { validRows: [], invalidRows: [] }
  }

  const headerCells = splitCsvLine(lines[0]).map((cell) => normalizeHeader(cell))
  const dataLines = lines.slice(1)

  const validRows: PreparedImportRow[] = []
  const invalidRows: InvalidImportRow[] = []

  dataLines.forEach((line, index) => {
    const sourceIndex = index + 2
    const values = splitCsvLine(line)
    const row = buildCsvRow(headerCells, values)

    try {
      const prepared = prepareCsvRow(row, sourceIndex, line)
      validRows.push(prepared)
    } catch (err) {
      invalidRows.push({
        sourceIndex,
        raw: line,
        reason: err instanceof Error ? err.message : 'Invalid row',
      })
    }
  })

  return { validRows, invalidRows }
}

function prepareCsvRow(row: CsvRow, sourceIndex: number, raw: string): PreparedImportRow {
  const rawDate = firstValue(row, ['match_date', 'date'])
  const rawMatchType = firstValue(row, ['match_type'])
  const rawSideA = firstValue(row, ['side_a_players', 'side_a', 'team_a', 'players_a'])
  const rawSideB = firstValue(row, ['side_b_players', 'side_b', 'team_b', 'players_b'])
  const rawResult = firstValue(row, ['result'])
  const rawScore = firstValue(row, ['score'])
  const rawWinnerSide = firstValue(row, ['winner_side'])
  const rawSource = firstValue(row, ['source']) || 'csv'
  const rawExternalMatchId = firstValue(row, ['external_match_id', 'match_id'])
  const rawLineNumber = firstValue(row, ['line_number', 'line', 'court'])

  if (!rawDate) throw new Error('Missing match_date/date')
  if (!rawSideA) throw new Error('Missing side_a_players')
  if (!rawSideB) throw new Error('Missing side_b_players')

  const sideA = splitSide(rawSideA)
  const sideB = splitSide(rawSideB)

  if (sideA.length === 0) throw new Error('Missing Side A players')
  if (sideB.length === 0) throw new Error('Missing Side B players')

  const allNames = [...sideA, ...sideB]
  const matchType = determineMatchType(rawMatchType, sideA, sideB)

  if (matchType === 'singles' && (sideA.length !== 1 || sideB.length !== 1)) {
    throw new Error('Singles must have exactly 1 player on each side')
  }

  if (matchType === 'doubles' && (sideA.length !== 2 || sideB.length !== 2)) {
    throw new Error('Doubles must have exactly 2 players on each side')
  }

  const duplicateNameCheck = new Set(allNames.map((name) => name.toLowerCase()))
  if (duplicateNameCheck.size !== allNames.length) {
    throw new Error('Player appears more than once in the same match')
  }

  let parsedResult: { winnerSide: MatchSide; score: string } | null = null

  if (rawResult) {
    parsedResult = parsePrefixedResult(rawResult)
    if (!parsedResult) {
      throw new Error('result must start with W or L, for example: W 6-3 6-4')
    }
  } else if (rawScore && rawWinnerSide) {
    const winner = normalizeWinnerSide(rawWinnerSide)
    if (!winner) {
      throw new Error('winner_side must be A or B')
    }
    parsedResult = {
      winnerSide: winner,
      score: normalizeResult(rawScore),
    }
  } else {
    throw new Error('Provide either result or score + winner_side')
  }

  return {
    sourceIndex,
    sideA,
    sideB,
    rawResult: rawResult || `${parsedResult.winnerSide} ${parsedResult.score}`,
    score: parsedResult.score,
    winnerSide: parsedResult.winnerSide,
    date: normalizeDate(rawDate),
    matchType,
    source: normalizeSource(rawSource, 'csv'),
    externalMatchId: normalizeNullableText(rawExternalMatchId),
    lineNumber: normalizeNullableText(rawLineNumber),
  }
}

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  result.push(current.trim())
  return result
}

function buildCsvRow(headers: string[], values: string[]): CsvRow {
  const row: CsvRow = {}

  headers.forEach((header, index) => {
    row[header] = (values[index] ?? '').trim()
  })

  return row
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_')
}

function firstValue(row: CsvRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value && value.trim()) return value.trim()
  }
  return ''
}


async function logImportRun({
  source,
  insertedCount,
  duplicateCount,
  failedCount,
  createdPlayers,
  status,
}: {
  source: string
  insertedCount: number
  duplicateCount: number
  failedCount: number
  createdPlayers: number
  status: string
}) {
  const { error } = await supabase.from('import_logs').insert({
    source,
    inserted_count: insertedCount,
    duplicate_count: duplicateCount,
    failed_count: failedCount,
    created_players: createdPlayers,
    status,
  })

  if (error) {
    console.error('Failed to write import log:', error)
  }
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
