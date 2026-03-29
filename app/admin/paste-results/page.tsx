'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { recalculateDynamicRatings } from '../../../lib/recalculateRatings'

type MatchType = 'singles' | 'doubles'
type MatchSide = 'A' | 'B'

type ImportResult = {
  parsedCount: number
  participantRowCount: number
  uniqueMatchCount: number
  insertedMatchCount: number
  skippedDuplicateMatchCount: number
  createdPlayerCount: number
  ratingsRecalculated: boolean
}

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

type PreparedPasteRow = {
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
  preparedRows: PreparedPasteRow[]
  previewRows: PreviewRow[]
  invalidRows: InvalidPreviewRow[]
  missingNames: string[]
  parsedCount: number
  invalidCount: number
  participantRowCount: number
  uniqueMatchCount: number
  duplicateInFileCount: number
  duplicateInDbCount: number
  readyRows: PreparedPasteRow[]
}

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

      const preparedRows = parsed.validRows
      const allNames = [
        ...new Set(preparedRows.flatMap((row) => [...row.sideA, ...row.sideB])),
      ]
      const playerMap = await fetchPlayersByNames(allNames)
      const missingNames = allNames.filter((name) => !playerMap[name.toLowerCase()])

      const fileDuplicateKeys = new Set<string>()
      const fileSeenKeys = new Set<string>()
      const uniqueRowMap = new Map<string, PreparedPasteRow>()

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
          reason = 'Duplicate inside this paste import'
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
    return <p style={{ padding: '24px' }}>Checking access...</p>
  }

  if (!user || user.id !== ADMIN_ID) {
    return null
  }

  return (
    <main style={mainStyle}>
      <div style={navRowStyle}>
        <Link href="/" style={navLinkStyle}>Home</Link>
        <Link href="/rankings" style={navLinkStyle}>Rankings</Link>
        <Link href="/matchup" style={navLinkStyle}>Matchup</Link>
        <Link href="/admin" style={navLinkStyle}>Admin</Link>
        <Link href="/admin/add-match" style={navLinkStyle}>Add Match</Link>
        <Link href="/admin/csv-import" style={navLinkStyle}>CSV Import</Link>
        <Link href="/admin/paste-results" style={navLinkStyle}>Paste Results</Link>
        <Link href="/admin/manage-matches" style={navLinkStyle}>Manage Matches</Link>
        <Link href="/admin/manage-players" style={navLinkStyle}>Manage Players</Link>
      </div>

      <div style={heroCardStyle}>
        <h1 style={{ margin: 0, fontSize: '36px' }}>Paste Results</h1>
        <p style={{ margin: '12px 0 0 0', color: '#dbeafe', fontSize: '17px', maxWidth: '760px' }}>
          Paste natural singles or doubles result text, preview duplicates, create missing players automatically, and import into the matches + match_players structure.
        </p>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Paste Match Results</h2>
        <p style={{ color: '#64748b' }}>Supported examples:</p>

        <pre style={sampleStyle}>
{`Nathan Meinert def John Smith 6-3 6-4
Nathan Meinert / Alex Smith def John Smith / Mike Lee 6-4 6-3
John Smith d. Nathan Meinert 7-6 6-2
Nathan Meinert / Alex Smith lost to John Smith / Mike Lee 4-6 4-6

Pipe format still works:
Nathan Meinert | John Smith | W 6-3 6-4 | 2026-03-22
Nathan Meinert / Alex Smith | John Smith / Mike Lee | W 6-4 6-3 | 2026-03-25 | doubles`}
        </pre>

        <div style={settingsGridStyle}>
          <div>
            <label style={labelStyle}>Default Date</label>
            <input
              type="date"
              value={defaultDate}
              onChange={(e) => setDefaultDate(e.target.value)}
              style={inputStyle}
              disabled={loading || previewLoading}
            />
          </div>

          <div>
            <label style={labelStyle}>Default Source</label>
            <input
              type="text"
              value={defaultSource}
              onChange={(e) => setDefaultSource(e.target.value)}
              style={inputStyle}
              disabled={loading || previewLoading}
            />
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Nathan Meinert def John Smith 6-3 6-4
Nathan Meinert / Alex Smith def John Smith / Mike Lee 6-4 6-3`}
          style={textareaStyle}
          disabled={loading || previewLoading}
        />

        <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={handlePreview}
            style={{
              ...primaryButtonStyle,
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
                style={{
                  ...successButtonStyle,
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
                disabled={loading}
              >
                {loading ? 'Importing...' : `Confirm Import (${readyCount} Ready)`}
              </button>

              <button
                onClick={() => setPreview(null)}
                style={secondaryButtonStyle}
                disabled={loading}
              >
                Clear Preview
              </button>
            </>
          )}
        </div>

        {message && (
          <div style={successBoxStyle}>
            <p style={{ margin: 0, fontWeight: 700 }}>{message}</p>
          </div>
        )}

        {error && (
          <div style={errorBoxStyle}>
            <p style={{ margin: 0, fontWeight: 700 }}>{error}</p>
          </div>
        )}

        {preview && (
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ marginBottom: '12px' }}>Preview Summary</h3>

            <div style={summaryGridStyle}>
              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Valid Matches</div>
                <div style={summaryValueStyle}>{preview.parsedCount}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Invalid Rows</div>
                <div style={summaryValueStyle}>{preview.invalidCount}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Participant Rows</div>
                <div style={summaryValueStyle}>{preview.participantRowCount}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Unique Matches</div>
                <div style={summaryValueStyle}>{preview.uniqueMatchCount}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Ready To Import</div>
                <div style={summaryValueStyle}>{readyCount}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Duplicates In Paste</div>
                <div style={summaryValueStyle}>{preview.duplicateInFileCount}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Duplicates In DB</div>
                <div style={summaryValueStyle}>{preview.duplicateInDbCount}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Players To Create</div>
                <div style={summaryValueStyle}>{preview.missingNames.length}</div>
              </div>
            </div>

            {preview.missingNames.length > 0 && (
              <div style={infoBoxStyle}>
                <strong>Players that will be created:</strong> {preview.missingNames.join(', ')}
              </div>
            )}

            {preview.invalidRows.length > 0 && (
              <div style={{ marginTop: '18px' }}>
                <h3 style={{ marginBottom: '12px' }}>Invalid Rows</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Row</th>
                        <th style={thStyle}>Raw</th>
                        <th style={thStyle}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.invalidRows.map((row) => (
                        <tr key={`invalid-${row.sourceIndex}-${row.raw}`} style={invalidRowStyle}>
                          <td style={tdStyle}>{row.sourceIndex}</td>
                          <td style={tdStyle}>{row.raw}</td>
                          <td style={tdStyle}>{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ overflowX: 'auto', marginTop: '18px' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Row</th>
                    <th style={thStyle}>Side A</th>
                    <th style={thStyle}>Side B</th>
                    <th style={thStyle}>Result</th>
                    <th style={thStyle}>Score</th>
                    <th style={thStyle}>Winner</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.previewRows.map((row) => (
                    <tr
                      key={`${row.sourceIndex}-${row.dedupeKey}`}
                      style={
                        row.status === 'ready'
                          ? readyRowStyle
                          : row.status === 'duplicate_in_file'
                            ? duplicateFileRowStyle
                            : duplicateDbRowStyle
                      }
                    >
                      <td style={tdStyle}>{row.sourceIndex}</td>
                      <td style={tdStyle}>{row.sideA.join(' / ')}</td>
                      <td style={tdStyle}>{row.sideB.join(' / ')}</td>
                      <td style={tdStyle}>{row.rawResult}</td>
                      <td style={tdStyle}>{row.score}</td>
                      <td style={tdStyle}>{row.winnerSide}</td>
                      <td style={tdStyle}>{row.date}</td>
                      <td style={tdStyle}>{capitalize(row.matchType)}</td>
                      <td style={tdStyle}>{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result && (
          <div style={{ marginTop: '20px' }}>
            <h3 style={{ marginBottom: '12px' }}>Import Summary</h3>
            <div style={summaryGridStyle}>
              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Source Matches</div>
                <div style={summaryValueStyle}>{result.parsedCount}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Participant Rows</div>
                <div style={summaryValueStyle}>{result.participantRowCount}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Unique Matches</div>
                <div style={summaryValueStyle}>{result.uniqueMatchCount}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Inserted Matches</div>
                <div style={summaryValueStyle}>{result.insertedMatchCount}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Skipped Duplicates</div>
                <div style={summaryValueStyle}>{result.skippedDuplicateMatchCount}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Created Players</div>
                <div style={summaryValueStyle}>{result.createdPlayerCount}</div>
              </div>
            </div>

            <div style={{ marginTop: '14px', color: '#475569' }}>
              Ratings recalculated: <strong>{result.ratingsRecalculated ? 'Yes' : 'No'}</strong>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function parsePasteTextWithInvalidRows(
  text: string,
  defaultDate: string,
  defaultSource: string
): {
  validRows: PreparedPasteRow[]
  invalidRows: InvalidPreviewRow[]
} {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const validRows: PreparedPasteRow[] = []
  const invalidRows: InvalidPreviewRow[] = []

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
): PreparedPasteRow {
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
    source: normalizeSource(rawSource),
    externalMatchId: normalizeNullableText(rawExternalMatchId),
    lineNumber: normalizeNullableText(rawLineNumber),
  }
}

function parseNaturalFormatLine(
  line: string,
  sourceIndex: number,
  defaultDate: string,
  defaultSource: string
): PreparedPasteRow {
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
    source: normalizeSource(defaultSource),
    externalMatchId: null,
    lineNumber: null,
  }
}

function validatePreparedRow(row: PreparedPasteRow, rawLine: string) {
  if (row.sideA.length === 0) {
    throw new Error('Missing Side A players')
  }

  if (row.sideB.length === 0) {
    throw new Error('Missing Side B players')
  }

  const allNames = [...row.sideA, ...row.sideB]
  const duplicateNames = findDuplicateNames(allNames)

  if (duplicateNames.length > 0) {
    throw new Error(`Player appears more than once in the same match: ${duplicateNames.join(', ')}`)
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
  const normalized = rawMatchType.trim().toLowerCase()

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

function parsePrefixedResult(result: string): { winnerSide: MatchSide; score: string } | null {
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

function buildDedupeKey(row: PreparedPasteRow) {
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
  return normalized || 'paste'
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

function getTodayLocalDate() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const local = new Date(now.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 10)
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

const mainStyle = {
  padding: '24px',
  fontFamily: 'Arial, sans-serif',
  maxWidth: '1100px',
  margin: '0 auto',
  background: '#f8fafc',
  minHeight: '100vh',
}

const navRowStyle = {
  display: 'flex',
  gap: '12px',
  marginBottom: '24px',
  flexWrap: 'wrap' as const,
}

const navLinkStyle = {
  padding: '10px 14px',
  border: '1px solid #dbeafe',
  borderRadius: '999px',
  textDecoration: 'none',
  color: '#1e3a8a',
  background: '#eff6ff',
  fontWeight: 600,
}

const heroCardStyle = {
  background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
  color: 'white',
  borderRadius: '20px',
  padding: '28px',
  boxShadow: '0 14px 30px rgba(37, 99, 235, 0.20)',
  marginBottom: '22px',
}

const cardStyle = {
  background: 'white',
  borderRadius: '20px',
  padding: '24px',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
  border: '1px solid #e2e8f0',
  marginBottom: '22px',
}

const sampleStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '14px',
  overflowX: 'auto' as const,
  color: '#334155',
}

const settingsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
  marginTop: '16px',
  marginBottom: '16px',
}

const labelStyle = {
  display: 'block',
  marginBottom: '8px',
  color: '#334155',
  fontWeight: 600,
}

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  fontSize: '15px',
  boxSizing: 'border-box' as const,
  fontFamily: 'inherit',
}

const textareaStyle = {
  width: '100%',
  minHeight: '220px',
  padding: '14px 16px',
  border: '1px solid #cbd5e1',
  borderRadius: '14px',
  fontSize: '15px',
  marginTop: '14px',
  boxSizing: 'border-box' as const,
  fontFamily: 'inherit',
}

const primaryButtonStyle = {
  padding: '14px 18px',
  border: 'none',
  borderRadius: '14px',
  background: '#2563eb',
  color: 'white',
  fontWeight: 700,
  fontSize: '15px',
}

const successButtonStyle = {
  padding: '14px 18px',
  border: 'none',
  borderRadius: '14px',
  background: '#16a34a',
  color: 'white',
  fontWeight: 700,
  fontSize: '15px',
}

const secondaryButtonStyle = {
  padding: '14px 18px',
  border: '1px solid #cbd5e1',
  borderRadius: '14px',
  background: 'white',
  color: '#0f172a',
  fontWeight: 700,
  fontSize: '15px',
}

const successBoxStyle = {
  marginTop: '16px',
  padding: '14px 16px',
  borderRadius: '14px',
  background: '#dcfce7',
  border: '1px solid #86efac',
  color: '#166534',
}

const errorBoxStyle = {
  marginTop: '16px',
  padding: '14px 16px',
  borderRadius: '14px',
  background: '#fee2e2',
  border: '1px solid #fca5a5',
  color: '#991b1b',
}

const infoBoxStyle = {
  marginTop: '16px',
  padding: '14px 16px',
  borderRadius: '14px',
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  color: '#1d4ed8',
}

const summaryGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '12px',
}

const summaryCardStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '14px',
  padding: '14px',
}

const summaryLabelStyle = {
  color: '#64748b',
  fontSize: '13px',
  marginBottom: '6px',
}

const summaryValueStyle = {
  color: '#0f172a',
  fontSize: '24px',
  fontWeight: 700,
}

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  marginTop: '8px',
}

const thStyle = {
  textAlign: 'left' as const,
  padding: '12px',
  borderBottom: '1px solid #cbd5e1',
  color: '#334155',
  background: '#f8fafc',
}

const tdStyle = {
  padding: '12px',
  borderBottom: '1px solid #e2e8f0',
  color: '#0f172a',
}

const readyRowStyle = {
  background: '#f0fdf4',
}

const duplicateFileRowStyle = {
  background: '#fff7ed',
}

const duplicateDbRowStyle = {
  background: '#fef2f2',
}

const invalidRowStyle = {
  background: '#fef2f2',
}