'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { recalculateDynamicRatings } from '../../../lib/recalculateRatings'

type MatchType = 'singles' | 'doubles'
type MatchSide = 'A' | 'B'

type Player = {
  id: string
  name: string
  location?: string | null
  singles_rating?: number | null
  singles_dynamic_rating?: number | null
  doubles_rating?: number | null
  doubles_dynamic_rating?: number | null
  overall_rating?: number | null
  overall_dynamic_rating?: number | null
}

type ImportResult = {
  parsedCount: number
  participantRowCount: number
  uniqueMatchCount: number
  insertedMatchCount: number
  skippedDuplicateMatchCount: number
  createdPlayerCount: number
  ratingsRecalculated: boolean
}

type CsvRow = Record<string, string>

type PreparedCsvRow = {
  sourceIndex: number
  sideA: string[]
  sideB: string[]
  rawResult: string
  score: string
  winnerSide: MatchSide
  date: string
  matchType: MatchType
  source: string
  externalMatchId: string | null
  lineNumber: string | null
}

type PreviewRow = {
  sourceIndex: number
  sideA: string[]
  sideB: string[]
  rawResult: string
  score: string
  winnerSide: MatchSide
  date: string
  matchType: MatchType
  status: 'ready' | 'duplicate_in_file' | 'duplicate_in_db'
  reason: string
  dedupeKey: string
}

type InvalidPreviewRow = {
  sourceIndex: number
  raw: string
  reason: string
}

type PreviewState = {
  preparedRows: PreparedCsvRow[]
  previewRows: PreviewRow[]
  invalidRows: InvalidPreviewRow[]
  missingNames: string[]
  parsedCount: number
  invalidCount: number
  participantRowCount: number
  uniqueMatchCount: number
  duplicateInFileCount: number
  duplicateInDbCount: number
  readyRows: PreparedCsvRow[]
}

const ADMIN_ID = 'accc3471-8912-491c-b8d9-4a84dcc7c42e'

export default function CsvImportPage() {
  const router = useRouter()

  const [fileName, setFileName] = useState('')
  const [csvText, setCsvText] = useState('')
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)

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

    checkUser()
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

      const preparedRows = parsed.validRows
      const allNames = [
        ...new Set(preparedRows.flatMap((row) => [...row.sideA, ...row.sideB])),
      ]
      const playerMap = await fetchPlayersByNames(allNames)
      const missingNames = allNames.filter((name) => !playerMap[name.toLowerCase()])

      const fileDuplicateKeys = new Set<string>()
      const fileSeenKeys = new Set<string>()
      const uniqueRowMap = new Map<string, PreparedCsvRow>()

      for (const row of preparedRows) {
        const dedupeKey = buildDedupeKey(row)
        if (fileSeenKeys.has(dedupeKey)) {
          fileDuplicateKeys.add(dedupeKey)
        } else {
          fileSeenKeys.add(dedupeKey)
          uniqueRowMap.set(dedupeKey, row)
        }
      }

      const dedupedRows = [...uniqueRowMap.values()]
      const dbDuplicateKeys = await findExistingMatchDedupeKeys(
        dedupedRows.map((row) => buildDedupeKey(row))
      )

      const previewRows: PreviewRow[] = preparedRows.map((row) => {
        const dedupeKey = buildDedupeKey(row)

        let status: PreviewRow['status'] = 'ready'
        let reason = 'Will be imported'

        if (fileDuplicateKeys.has(dedupeKey)) {
          status = 'duplicate_in_file'
          reason = 'Duplicate inside this CSV file'
        } else if (dbDuplicateKeys.has(dedupeKey)) {
          status = 'duplicate_in_db'
          reason = 'Already exists in database'
        }

        return {
          sourceIndex: row.sourceIndex,
          sideA: row.sideA,
          sideB: row.sideB,
          rawResult: row.rawResult,
          score: row.score,
          winnerSide: row.winnerSide,
          date: row.date,
          matchType: row.matchType,
          status,
          reason,
          dedupeKey,
        }
      })

      const readyRows = dedupedRows.filter((row) => !dbDuplicateKeys.has(buildDedupeKey(row)))

      setPreview({
        preparedRows,
        previewRows,
        invalidRows: parsed.invalidRows,
        missingNames,
        parsedCount: preparedRows.length,
        invalidCount: parsed.invalidRows.length,
        participantRowCount: preparedRows.reduce(
          (sum, row) => sum + row.sideA.length + row.sideB.length,
          0
        ),
        uniqueMatchCount: dedupedRows.length,
        duplicateInFileCount: previewRows.filter((row) => row.status === 'duplicate_in_file').length,
        duplicateInDbCount: previewRows.filter((row) => row.status === 'duplicate_in_db').length,
        readyRows,
      })
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
      const createdPlayers = await createMissingPlayers(preview.missingNames)
      const playerMap = await fetchPlayersByNames([
        ...new Set(preview.readyRows.flatMap((row) => [...row.sideA, ...row.sideB])),
      ])

      let insertedMatchCount = 0

      for (const row of preview.readyRows) {
        const dedupeKey = buildDedupeKey(row)

        const sideAPlayerIds = row.sideA.map((name) => {
          const player = playerMap[normalizeName(name).toLowerCase()]
          if (!player) throw new Error(`Missing player after create/fetch: ${name}`)
          return player.id
        })

        const sideBPlayerIds = row.sideB.map((name) => {
          const player = playerMap[normalizeName(name).toLowerCase()]
          if (!player) throw new Error(`Missing player after create/fetch: ${name}`)
          return player.id
        })

        const { data: insertedMatch, error: matchError } = await supabase
          .from('matches')
          .insert({
            match_date: row.date,
            match_type: row.matchType,
            score: row.score,
            winner_side: row.winnerSide,
            line_number: row.lineNumber,
            source: row.source,
            external_match_id: row.externalMatchId,
            dedupe_key: dedupeKey,
          })
          .select('id')
          .single()

        if (matchError) {
          const alreadyExists =
            matchError.code === '23505' ||
            matchError.message.toLowerCase().includes('duplicate') ||
            matchError.message.toLowerCase().includes('unique')

          if (alreadyExists) {
            continue
          }

          throw new Error(matchError.message)
        }

        const participantRows = [
          ...sideAPlayerIds.map((playerId, index) => ({
            match_id: insertedMatch.id,
            player_id: playerId,
            side: 'A' as const,
            seat: index + 1,
          })),
          ...sideBPlayerIds.map((playerId, index) => ({
            match_id: insertedMatch.id,
            player_id: playerId,
            side: 'B' as const,
            seat: index + 1,
          })),
        ]

        const { error: participantsError } = await supabase
          .from('match_players')
          .insert(participantRows)

        if (participantsError) {
          await supabase.from('matches').delete().eq('id', insertedMatch.id)
          throw new Error(participantsError.message)
        }

        insertedMatchCount += 1
      }

      let ratingsRecalculated = false

      if (insertedMatchCount > 0) {
        try {
          await recalculateDynamicRatings()
          ratingsRecalculated = true
        } catch (recalcError) {
          console.error('Rating recalculation failed:', recalcError)
          ratingsRecalculated = false
        }
      }

      const importResult: ImportResult = {
        parsedCount: preview.parsedCount,
        participantRowCount: preview.participantRowCount,
        uniqueMatchCount: preview.uniqueMatchCount,
        insertedMatchCount,
        skippedDuplicateMatchCount: preview.uniqueMatchCount - insertedMatchCount,
        createdPlayerCount: createdPlayers.length,
        ratingsRecalculated,
      }

      setResult(importResult)

      const messageParts = [
        `Imported ${importResult.insertedMatchCount} matches.`,
        `Skipped ${importResult.skippedDuplicateMatchCount} duplicates.`,
        `Created ${importResult.createdPlayerCount} players.`,
      ]

      if (insertedMatchCount > 0) {
        if (ratingsRecalculated) {
          messageParts.push('Ratings recalculated.')
        } else {
          messageParts.push('Matches were imported, but rating recalculation still needs review.')
        }
      }

      setMessage(messageParts.join(' '))
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
      <main className="page-shell-tight">
        <section className="hero-panel">
          <div className="hero-inner">
            <div className="section-kicker">Admin Tool</div>
            <h1 className="page-title">Checking access...</h1>
            <p className="page-subtitle">
              Verifying administrator permissions and loading import tools.
            </p>
          </div>
        </section>
      </main>
    )
  }

  if (!user || user.id !== ADMIN_ID) {
    return null
  }

  return (
    <main className="page-shell">
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

      <section className="surface-card panel-pad section">
        <h2 className="section-title">CSV Format</h2>
        <p className="subtle-text" style={{ marginTop: 8 }}>Recommended columns:</p>

        <pre
          style={{
            marginTop: 14,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 16,
            padding: 16,
            overflowX: 'auto',
            color: '#334155',
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
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 16,
            padding: 16,
            overflowX: 'auto',
            color: '#334155',
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
                color: '#0f172a',
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
                  background: 'rgba(15,23,42,0.06)',
                  color: '#0f172a',
                  border: '1px solid rgba(15,23,42,0.08)',
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
              color: '#991b1b',
              border: '1px solid rgba(220,38,38,0.18)',
            }}
          >
            {error}
          </div>
        )}
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
                  color: '#0f172a',
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
                color: '#0f172a',
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
            <MetricCard label="Created Players" value={result.createdPlayerCount} />
          </div>

          <p style={{ marginTop: 16, color: '#475569' }}>
            Ratings recalculated: <strong>{result.ratingsRecalculated ? 'Yes' : 'No'}</strong>
          </p>
        </section>
      )}
    </main>
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
  validRows: PreparedCsvRow[]
  invalidRows: InvalidPreviewRow[]
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

  const validRows: PreparedCsvRow[] = []
  const invalidRows: InvalidPreviewRow[] = []

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

function prepareCsvRow(row: CsvRow, sourceIndex: number, raw: string): PreparedCsvRow {
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
  const duplicateNames = findDuplicateNames(allNames)
  if (duplicateNames.length > 0) {
    throw new Error(`Player appears more than once in the same match: ${duplicateNames.join(', ')}`)
  }

  const matchType = determineMatchType(rawMatchType, sideA, sideB)

  if (matchType === 'singles' && (sideA.length !== 1 || sideB.length !== 1)) {
    throw new Error('Singles must have exactly 1 player on each side')
  }

  if (matchType === 'doubles' && (sideA.length !== 2 || sideB.length !== 2)) {
    throw new Error('Doubles must have exactly 2 players on each side')
  }

  let parsedResult: { winnerSide: MatchSide; score: string } | null = null

  if (rawResult) {
    parsedResult = parseResult(rawResult)
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

  const date = normalizeDate(rawDate)

  return {
    sourceIndex,
    sideA,
    sideB,
    rawResult: rawResult || `${parsedResult.winnerSide} ${parsedResult.score}`,
    score: parsedResult.score,
    winnerSide: parsedResult.winnerSide,
    date,
    matchType,
    source: normalizeSource(rawSource),
    externalMatchId: normalizeNullableText(rawExternalMatchId),
    lineNumber: normalizeNullableText(rawLineNumber),
  }
}

async function fetchPlayersByNames(names: string[]): Promise<Record<string, Player>> {
  const playerMap: Record<string, Player> = {}
  const uniqueNames = [...new Set(names.map((name) => normalizeName(name)))]

  for (const chunk of chunkArray(uniqueNames, 500)) {
    const { data, error } = await supabase
      .from('players')
      .select(`
        id,
        name,
        location,
        singles_rating,
        singles_dynamic_rating,
        doubles_rating,
        doubles_dynamic_rating,
        overall_rating,
        overall_dynamic_rating
      `)
      .in('name', chunk)

    if (error) {
      throw new Error(error.message)
    }

    for (const player of (data || []) as Player[]) {
      playerMap[normalizeName(player.name).toLowerCase()] = player
    }
  }

  return playerMap
}

async function createMissingPlayers(names: string[]) {
  const uniqueMissingNames = [...new Set(names.map(normalizeName))]

  if (uniqueMissingNames.length === 0) return []

  const { data, error } = await supabase
    .from('players')
    .insert(
      uniqueMissingNames.map((name) => ({
        name,
        singles_rating: 3.5,
        singles_dynamic_rating: 3.5,
        doubles_rating: 3.5,
        doubles_dynamic_rating: 3.5,
        overall_rating: 3.5,
        overall_dynamic_rating: 3.5,
      }))
    )
    .select(`
      id,
      name,
      location,
      singles_rating,
      singles_dynamic_rating,
      doubles_rating,
      doubles_dynamic_rating,
      overall_rating,
      overall_dynamic_rating
    `)

  if (error) {
    throw new Error(error.message)
  }

  return (data || []) as Player[]
}

async function findExistingMatchDedupeKeys(keys: string[]): Promise<Set<string>> {
  const existingKeys = new Set<string>()
  const uniqueKeys = [...new Set(keys)]

  for (const chunk of chunkArray(uniqueKeys, 200)) {
    const { data, error } = await supabase
      .from('matches')
      .select('dedupe_key')
      .in('dedupe_key', chunk)

    if (error) {
      throw new Error(error.message)
    }

    for (const row of data || []) {
      if (row?.dedupe_key) {
        existingKeys.add(row.dedupe_key)
      }
    }
  }

  return existingKeys
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

function splitSide(value: string) {
  return value
    .split('/')
    .map((name) => normalizeName(name))
    .filter(Boolean)
}

function determineMatchType(
  rawMatchType: string,
  sideA: string[],
  sideB: string[]
): MatchType {
  const normalized = (rawMatchType || '').trim().toLowerCase()

  if (normalized) {
    if (normalized !== 'singles' && normalized !== 'doubles') {
      throw new Error('match_type must be singles or doubles')
    }
    return normalized as MatchType
  }

  if (sideA.length === 1 && sideB.length === 1) return 'singles'
  if (sideA.length === 2 && sideB.length === 2) return 'doubles'

  throw new Error('Could not infer match type. Add singles or doubles explicitly.')
}

function normalizeWinnerSide(value: string): MatchSide | null {
  const normalized = value.trim().toUpperCase()
  if (normalized === 'A') return 'A'
  if (normalized === 'B') return 'B'
  return null
}

function parseResult(result: string): { winnerSide: MatchSide; score: string } | null {
  const trimmed = normalizeResult(result)

  if (!trimmed) return null

  if (/^W\b/i.test(trimmed)) {
    const score = trimmed.replace(/^W\b/i, '').trim()
    return score ? { winnerSide: 'A', score } : null
  }

  if (/^L\b/i.test(trimmed)) {
    const score = trimmed.replace(/^L\b/i, '').trim()
    return score ? { winnerSide: 'B', score } : null
  }

  return null
}

function buildDedupeKey(row: PreparedCsvRow) {
  const winningTeam =
    row.winnerSide === 'A'
      ? normalizeTeamForKey(row.sideA)
      : normalizeTeamForKey(row.sideB)

  const losingTeam =
    row.winnerSide === 'A'
      ? normalizeTeamForKey(row.sideB)
      : normalizeTeamForKey(row.sideA)

  return [
    row.date,
    row.matchType,
    normalizeScoreForKey(row.score),
    winningTeam,
    losingTeam,
  ].join('|')
}

function normalizeTeamForKey(names: string[]) {
  return [...names]
    .map((name) => normalizeName(name).toLowerCase())
    .sort()
    .join('+')
}

function normalizeScoreForKey(score: string) {
  return normalizeResult(score).toLowerCase()
}

function findDuplicateNames(names: string[]) {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const name of names) {
    const key = normalizeName(name).toLowerCase()
    if (seen.has(key)) {
      duplicates.add(name)
    } else {
      seen.add(key)
    }
  }

  return [...duplicates]
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

function normalizeResult(result: string) {
  return result.trim().replace(/\s+/g, ' ')
}

function normalizeNullableText(value: string | null | undefined) {
  const normalized = (value ?? '').trim()
  return normalized ? normalized : null
}

function normalizeSource(value: string) {
  const normalized = value.trim()
  return normalized || 'csv'
}

function normalizeDate(date: string) {
  const value = date.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${date}`)
  }

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}