
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
  normalizeSource,
  normalizeResult,
  parsePrefixedResult,
  splitSide,
  type CommitImportWithFailuresResult,
  type ImportPreview,
  type InvalidImportRow,
  type MatchSide,
  type MatchType,
  type PreparedImportRow,
} from '@/lib/importEngine'
import { supabase } from '../../../lib/supabase'

const ADMIN_ID = 'accc3471-8912-491c-b8d9-4a84dcc7c42e'

export default function PasteResultsPage() {
  const router = useRouter()

  const [text, setText] = useState('')
  const [defaultDate, setDefaultDate] = useState(getTodayLocalDate())
  const [defaultSource, setDefaultSource] = useState('paste')
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

  async function handlePreview() {
    setPreviewLoading(true)
    setError('')
    setMessage('')
    setResult(null)
    setPreview(null)

    try {
      const parsed = parsePasteTextWithInvalidRows(text, defaultDate, defaultSource)

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
        source: 'paste',
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
      setText('')
      setPreview(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Paste import failed')
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
                Verifying administrator permissions and loading paste-import tools.
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
            <h1 className="page-title">Paste Results</h1>
            <p className="page-subtitle">
              Paste natural singles or doubles result text, preview duplicates, create
              missing players automatically, and import into the matches and match_players
              structure.
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
            <h2 className="section-title">Paste Match Results</h2>
            <p className="subtle-text" style={{ marginTop: 8 }}>Supported examples:</p>

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
{`Nathan Meinert def John Smith 6-3 6-4
Nathan Meinert / Alex Smith def John Smith / Mike Lee 6-4 6-3
John Smith d. Nathan Meinert 7-6 6-2
Nathan Meinert / Alex Smith lost to John Smith / Mike Lee 4-6 4-6

Pipe format still works:
Nathan Meinert | John Smith | W 6-3 6-4 | 2026-03-22
Nathan Meinert / Alex Smith | John Smith / Mike Lee | W 6-4 6-3 | 2026-03-25 | doubles`}
            </pre>

            <div className="card-grid two" style={{ marginTop: 18 }}>
              <Field label="Default Date">
                <input
                  type="date"
                  value={defaultDate}
                  onChange={(e) => setDefaultDate(e.target.value)}
                  className="input"
                  disabled={loading || previewLoading}
                />
              </Field>

              <Field label="Default Source">
                <input
                  type="text"
                  value={defaultSource}
                  onChange={(e) => setDefaultSource(e.target.value)}
                  className="input"
                  disabled={loading || previewLoading}
                />
              </Field>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Nathan Meinert def John Smith 6-3 6-4
Nathan Meinert / Alex Smith def John Smith / Mike Lee 6-4 6-3`}
              className="textarea"
              style={{ marginTop: 16, minHeight: 240 }}
              disabled={loading || previewLoading}
            />

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
                disabled={previewLoading || loading || !text.trim()}
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
              <MetricCard label="Duplicates In Paste" value={preview.duplicateInFileCount} />
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

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  )
}

function parsePasteTextWithInvalidRows(
  text: string,
  defaultDate: string,
  defaultSource: string
): {
  validRows: PreparedImportRow[]
  invalidRows: InvalidImportRow[]
} {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const validRows: PreparedImportRow[] = []
  const invalidRows: InvalidImportRow[] = []

  lines.forEach((line, index) => {
    const sourceIndex = index + 1

    try {
      const row = line.includes('|')
        ? parsePipeFormatLine(line, sourceIndex, defaultDate, defaultSource)
        : parseNaturalFormatLine(line, sourceIndex, defaultDate, defaultSource)

      validatePreparedRow(row, line)
      validRows.push(row)
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

function parsePipeFormatLine(
  line: string,
  sourceIndex: number,
  defaultDate: string,
  defaultSource: string
): PreparedImportRow {
  const parts = line.split('|').map((p) => p.trim())

  if (parts.length < 4) {
    throw new Error(
      'Expected format: side_a | side_b | result | date | optional match_type | optional source | optional external_match_id | optional line_number'
    )
  }

  const rawSideA = parts[0]
  const rawSideB = parts[1]
  const rawResult = normalizeResult(parts[2])
  const rawDate = parts[3] || defaultDate
  const rawMatchType = parts[4] ?? ''
  const rawSource = parts[5] ?? defaultSource
  const rawExternalMatchId = parts[6] ?? null
  const rawLineNumber = parts[7] ?? null

  const sideA = splitSide(rawSideA)
  const sideB = splitSide(rawSideB)
  const matchType = determineMatchType(rawMatchType, sideA, sideB)

  const parsedResult = parsePrefixedResult(rawResult)
  if (!parsedResult) {
    throw new Error('Result must start with W or L, for example: W 6-3 6-4')
  }

  return {
    sourceIndex,
    sideA,
    sideB,
    rawResult,
    score: parsedResult.score,
    winnerSide: parsedResult.winnerSide,
    date: normalizeDate(rawDate),
    matchType,
    source: normalizeSource(rawSource, 'paste'),
    externalMatchId: normalizeNullableText(rawExternalMatchId),
    lineNumber: normalizeNullableText(rawLineNumber),
  }
}

function parseNaturalFormatLine(
  line: string,
  sourceIndex: number,
  defaultDate: string,
  defaultSource: string
): PreparedImportRow {
  const normalizedLine = line.replace(/\s+/g, ' ').trim()

  const separators = [
    { pattern: /\s+def\.\s+/i, winnerIsLeft: true },
    { pattern: /\s+def\s+/i, winnerIsLeft: true },
    { pattern: /\s+d\.\s+/i, winnerIsLeft: true },
    { pattern: /\s+beat\s+/i, winnerIsLeft: true },
    { pattern: /\s+beats\s+/i, winnerIsLeft: true },
    { pattern: /\s+won against\s+/i, winnerIsLeft: true },
    { pattern: /\s+lost to\s+/i, winnerIsLeft: false },
    { pattern: /\s+loses to\s+/i, winnerIsLeft: false },
    { pattern: /\s+fell to\s+/i, winnerIsLeft: false },
  ]

  let matchedSeparator: { pattern: RegExp; winnerIsLeft: boolean } | null = null
  let matchParts: RegExpExecArray | null = null

  for (const separator of separators) {
    const regex = new RegExp(`^(.*?)${separator.pattern.source}(.*)$`, 'i')
    const candidate = regex.exec(normalizedLine)
    if (candidate) {
      matchedSeparator = separator
      matchParts = candidate
      break
    }
  }

  if (!matchedSeparator || !matchParts) {
    throw new Error(
      'Could not parse line. Use natural format like "A def B 6-3 6-4" or pipe format.'
    )
  }

  const leftRaw = matchParts[1].trim()
  const rightWithScoreRaw = matchParts[2].trim()

  const scoreMatch = rightWithScoreRaw.match(
    /(\d{1,2}-\d{1,2}(?:\(\d+\))?(?:\s+\d{1,2}-\d{1,2}(?:\(\d+\))?)*)\s*$/
  )

  if (!scoreMatch) {
    throw new Error('Could not detect score at the end of the line.')
  }

  const score = normalizeResult(scoreMatch[1])
  const rightRaw = rightWithScoreRaw.slice(0, scoreMatch.index).trim()

  if (!leftRaw || !rightRaw) {
    throw new Error('Could not detect both sides of the match.')
  }

  const sideLeft = splitSide(leftRaw)
  const sideRight = splitSide(rightRaw)
  const matchType = determineMatchType('', sideLeft, sideRight)

  const winnerSide: MatchSide = matchedSeparator.winnerIsLeft ? 'A' : 'B'

  return {
    sourceIndex,
    sideA: sideLeft,
    sideB: sideRight,
    rawResult: normalizedLine,
    score,
    winnerSide,
    date: normalizeDate(defaultDate),
    matchType,
    source: normalizeSource(defaultSource, 'paste'),
    externalMatchId: null,
    lineNumber: null,
  }
}

function validatePreparedRow(row: PreparedImportRow, rawLine: string) {
  if (row.sideA.length === 0) {
    throw new Error('Missing Side A players')
  }

  if (row.sideB.length === 0) {
    throw new Error('Missing Side B players')
  }

  const allNames = [...row.sideA, ...row.sideB]
  const duplicateNames = new Set(allNames.map((name) => name.toLowerCase()))

  if (duplicateNames.size !== allNames.length) {
    throw new Error('Player appears more than once in the same match')
  }

  if (row.matchType === 'singles' && (row.sideA.length !== 1 || row.sideB.length !== 1)) {
    throw new Error('Singles must have exactly 1 player on each side')
  }

  if (row.matchType === 'doubles' && (row.sideA.length !== 2 || row.sideB.length !== 2)) {
    throw new Error('Doubles must have exactly 2 players on each side')
  }

  if (!row.score) {
    throw new Error(`Missing score: ${rawLine}`)
  }
}

function getTodayLocalDate() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const local = new Date(now.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 10)
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
