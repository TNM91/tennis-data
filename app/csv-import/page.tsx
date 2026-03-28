'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { recalculateDynamicRatings } from '../../lib/recalculateRatings'

type MatchType = 'singles' | 'doubles'

type Player = {
  id: string
  name: string
  rating: string
  dynamic_rating?: number | null
  singles_dynamic_rating?: number | null
  doubles_dynamic_rating?: number | null
  overall_dynamic_rating?: number | null
  location?: string | null
}

type MatchInsertRow = {
  player_id: string
  opponent_id: string
  opponent: string
  result: string
  date: string
  match_type: MatchType
}

type PreparedCSVRow = {
  sourceIndex: number
  player: string
  opponent: string
  result: string
  date: string
  matchType: MatchType
  location: string | null
}

type InvalidPreviewRow = {
  sourceIndex: number
  raw: string
  reason: string
}

type PreviewRow = {
  sourceIndex: number
  player: string
  opponent: string
  result: string
  date: string
  matchType: MatchType
  status: 'ready' | 'duplicate_in_file' | 'duplicate_in_db'
  reason: string
}

type ImportResult = {
  parsedCount: number
  expandedRowCount: number
  uniqueRowCount: number
  insertedRowCount: number
  skippedDuplicateRowCount: number
  createdPlayerCount: number
}

type PreviewState = {
  preparedRows: PreparedCSVRow[]
  insertRows: MatchInsertRow[]
  previewRows: PreviewRow[]
  invalidRows: InvalidPreviewRow[]
  missingNames: string[]
  parsedCount: number
  invalidCount: number
  expandedRowCount: number
  uniqueRowCount: number
  duplicateInFileCount: number
  duplicateInDbCount: number
}

const ADMIN_ID = 'accc3471-8912-491c-b8d9-4a84dcc7c42e'

export default function CSVImportPage() {
  const router = useRouter()

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

  async function handlePreview() {
    setPreviewLoading(true)
    setError('')
    setMessage('')
    setResult(null)
    setPreview(null)

    try {
      const parsed = parseCSVWithInvalidRows(csvText)

      if (parsed.validRows.length === 0 && parsed.invalidRows.length === 0) {
        throw new Error('No rows found.')
      }

      const preparedRows: PreparedCSVRow[] = parsed.validRows.map((row) => ({
        sourceIndex: row.sourceIndex,
        player: row.player,
        opponent: row.opponent,
        result: row.result,
        date: row.date,
        matchType: row.matchType,
        location: row.location ?? null,
      }))

      const allNames = [...new Set(preparedRows.flatMap((row) => [row.player, row.opponent]))]
      const playerMap = await fetchPlayersByNames(allNames)
      const missingNames = allNames.filter((name) => !playerMap[name.toLowerCase()])

      const tempPlayerMap = { ...playerMap }

      for (const missingName of missingNames) {
        tempPlayerMap[missingName.toLowerCase()] = {
          id: `preview:${missingName.toLowerCase()}`,
          name: missingName,
          rating: '3.5',
          dynamic_rating: 3.5,
          singles_dynamic_rating: 3.5,
          doubles_dynamic_rating: 3.5,
          overall_dynamic_rating: 3.5,
          location: null,
        }
      }

      const expandedRows: Array<MatchInsertRow & { sourceIndex: number }> = []

      for (const row of preparedRows) {
        const player = tempPlayerMap[row.player.toLowerCase()]
        const opponent = tempPlayerMap[row.opponent.toLowerCase()]

        if (!player || !opponent) {
          parsed.invalidRows.push({
            sourceIndex: row.sourceIndex,
            raw: `${row.player},${row.opponent},${row.result},${row.date},${row.matchType}`,
            reason: 'Could not resolve player IDs',
          })
          continue
        }

        expandedRows.push({
          sourceIndex: row.sourceIndex,
          player_id: player.id,
          opponent_id: opponent.id,
          opponent: opponent.name,
          result: row.result,
          date: row.date,
          match_type: row.matchType,
        })

        expandedRows.push({
          sourceIndex: row.sourceIndex,
          player_id: opponent.id,
          opponent_id: player.id,
          opponent: player.name,
          result: reverseResult(row.result),
          date: row.date,
          match_type: row.matchType,
        })
      }

      const fileDuplicateSourceIndexes = new Set<number>()
      const uniqueRowMap = new Map<string, MatchInsertRow & { sourceIndex: number }>()
      const fileSeenKeys = new Set<string>()

      for (const row of expandedRows) {
        const key = buildMatchKey(row)

        if (fileSeenKeys.has(key)) {
          fileDuplicateSourceIndexes.add(row.sourceIndex)
        } else {
          fileSeenKeys.add(key)
          uniqueRowMap.set(key, row)
        }
      }

      const dedupedRows = [...uniqueRowMap.values()]
      const dbDuplicateKeys = await findExistingMatchKeys(
        dedupedRows.map((row) => ({
          player_id: row.player_id,
          opponent_id: row.opponent_id,
          opponent: row.opponent,
          result: row.result,
          date: row.date,
          match_type: row.match_type,
        }))
      )

      const insertRows = dedupedRows
        .filter((row) => !dbDuplicateKeys.has(buildMatchKey(row)))
        .map((row) => ({
          player_id: row.player_id,
          opponent_id: row.opponent_id,
          opponent: row.opponent,
          result: row.result,
          date: row.date,
          match_type: row.match_type,
        }))

      const previewRows: PreviewRow[] = preparedRows.map((row) => {
        const player = tempPlayerMap[row.player.toLowerCase()]
        const opponent = tempPlayerMap[row.opponent.toLowerCase()]

        if (!player || !opponent) {
          return {
            sourceIndex: row.sourceIndex,
            player: row.player,
            opponent: row.opponent,
            result: row.result,
            date: row.date,
            matchType: row.matchType,
            status: 'duplicate_in_file',
            reason: 'Skipped due to unresolved player mapping',
          }
        }

        const forwardKey = buildMatchKey({
          player_id: player.id,
          opponent_id: opponent.id,
          opponent: opponent.name,
          result: row.result,
          date: row.date,
          match_type: row.matchType,
        })

        let status: PreviewRow['status'] = 'ready'
        let reason = 'Will be imported'

        if (fileDuplicateSourceIndexes.has(row.sourceIndex)) {
          status = 'duplicate_in_file'
          reason = 'Duplicate inside this CSV import'
        } else if (dbDuplicateKeys.has(forwardKey)) {
          status = 'duplicate_in_db'
          reason = 'Already exists in database'
        }

        return {
          sourceIndex: row.sourceIndex,
          player: row.player,
          opponent: row.opponent,
          result: row.result,
          date: row.date,
          matchType: row.matchType,
          status,
          reason,
        }
      })

      setPreview({
        preparedRows,
        insertRows,
        previewRows,
        invalidRows: parsed.invalidRows,
        missingNames,
        parsedCount: preparedRows.length,
        invalidCount: parsed.invalidRows.length,
        expandedRowCount: expandedRows.length,
        uniqueRowCount: dedupedRows.length,
        duplicateInFileCount: previewRows.filter((row) => row.status === 'duplicate_in_file').length,
        duplicateInDbCount: previewRows.filter((row) => row.status === 'duplicate_in_db').length,
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
      const createdPlayers = await createMissingPlayers(
        preview.missingNames,
        preview.preparedRows.map((row) => ({ location: row.location }))
      )

      const createdPlayerMap: Record<string, Player> = {}
      for (const player of createdPlayers) {
        createdPlayerMap[normalizeName(player.name).toLowerCase()] = player
      }

      const finalInsertRows = preview.insertRows.map((row) => {
        const playerId = row.player_id.startsWith('preview:')
          ? createdPlayerMap[row.player_id.replace('preview:', '')]?.id
          : row.player_id

        const opponentId = row.opponent_id.startsWith('preview:')
          ? createdPlayerMap[row.opponent_id.replace('preview:', '')]?.id
          : row.opponent_id

        if (!playerId || !opponentId) {
          throw new Error('Failed to resolve created player IDs during import.')
        }

        return {
          player_id: playerId,
          opponent_id: opponentId,
          opponent: row.opponent,
          result: row.result,
          date: row.date,
          match_type: row.match_type,
        }
      })

      let insertedRowCount = 0

      for (const chunk of chunkArray(finalInsertRows, 500)) {
        const { data, error } = await supabase
          .from('matches')
          .upsert(chunk, {
            onConflict: 'player_id,opponent_id,date,result,match_type',
            ignoreDuplicates: true,
          })
          .select('id')

        if (error) {
          throw new Error(error.message)
        }

        insertedRowCount += data?.length ?? 0
      }

      if (insertedRowCount > 0) {
        await recalculateDynamicRatings()
      }

      const importResult: ImportResult = {
        parsedCount: preview.parsedCount,
        expandedRowCount: preview.expandedRowCount,
        uniqueRowCount: preview.uniqueRowCount,
        insertedRowCount,
        skippedDuplicateRowCount: preview.uniqueRowCount - insertedRowCount,
        createdPlayerCount: createdPlayers.length,
      }

      setResult(importResult)
      setMessage(
        `Imported ${importResult.insertedRowCount} match rows. Skipped ${importResult.skippedDuplicateRowCount} duplicates. Created ${importResult.createdPlayerCount} players.`
      )
      setCsvText('')
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
        <Link href="/add-match" style={navLinkStyle}>Add Match</Link>
        <Link href="/csv-import" style={navLinkStyle}>CSV Import</Link>
        <Link href="/paste-results" style={navLinkStyle}>Paste Results</Link>
        <Link href="/matchup" style={navLinkStyle}>Matchup</Link>
        <Link href="/manage-matches" style={navLinkStyle}>Manage Matches</Link>
        <Link href="/manage-players" style={navLinkStyle}>Manage Players</Link>
      </div>

      <div style={heroCardStyle}>
        <h1 style={{ margin: 0, fontSize: '36px' }}>CSV Import</h1>
        <p style={{ margin: '12px 0 0 0', color: '#dbeafe', fontSize: '17px', maxWidth: '760px' }}>
          Preview CSV match data, including singles or doubles match type, see duplicates and invalid rows before import, create missing players automatically, and rebuild ratings plus snapshots.
        </p>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Paste CSV Data</h2>
        <p style={{ color: '#64748b' }}>Use one of these formats:</p>

        <pre style={sampleStyle}>
{`player,opponent,result,date
Nathan Meinert,John Doe,W 6-3 6-4,2026-03-22

player,opponent,result,date,match_type
Nathan Meinert,John Doe,W 6-3 6-4,2026-03-22,singles
Nathan Meinert,Jane Smith,W 6-4 6-4,2026-03-25,doubles`}
        </pre>

        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={`player,opponent,result,date,match_type
Nathan Meinert,John Doe,W 6-3 6-4,2026-03-22,singles
Nathan Meinert,Jane Smith,W 6-4 6-4,2026-03-25,doubles`}
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
            disabled={previewLoading || loading || !csvText.trim()}
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
                <div style={summaryLabelStyle}>Valid Rows</div>
                <div style={summaryValueStyle}>{preview.parsedCount}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Invalid Rows</div>
                <div style={summaryValueStyle}>{preview.invalidCount}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Expanded Rows</div>
                <div style={summaryValueStyle}>{preview.expandedRowCount}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Unique Rows</div>
                <div style={summaryValueStyle}>{preview.uniqueRowCount}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Ready To Import</div>
                <div style={summaryValueStyle}>{readyCount}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Duplicates In File</div>
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
                    <th style={thStyle}>Player</th>
                    <th style={thStyle}>Opponent</th>
                    <th style={thStyle}>Result</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.previewRows.map((row) => (
                    <tr
                      key={`${row.sourceIndex}-${row.player}-${row.opponent}-${row.date}-${row.result}-${row.matchType}`}
                      style={
                        row.status === 'ready'
                          ? readyRowStyle
                          : row.status === 'duplicate_in_file'
                            ? duplicateFileRowStyle
                            : duplicateDbRowStyle
                      }
                    >
                      <td style={tdStyle}>{row.sourceIndex}</td>
                      <td style={tdStyle}>{row.player}</td>
                      <td style={tdStyle}>{row.opponent}</td>
                      <td style={tdStyle}>{row.result}</td>
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
                <div style={summaryLabelStyle}>Source Rows</div>
                <div style={summaryValueStyle}>{result.parsedCount}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Expanded Rows</div>
                <div style={summaryValueStyle}>{result.expandedRowCount}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Unique Rows</div>
                <div style={summaryValueStyle}>{result.uniqueRowCount}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Inserted Rows</div>
                <div style={summaryValueStyle}>{result.insertedRowCount}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Skipped Duplicates</div>
                <div style={summaryValueStyle}>{result.skippedDuplicateRowCount}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Created Players</div>
                <div style={summaryValueStyle}>{result.createdPlayerCount}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function parseCSVWithInvalidRows(text: string): {
  validRows: PreparedCSVRow[]
  invalidRows: InvalidPreviewRow[]
} {
  const trimmed = text.trim()

  if (!trimmed) {
    return { validRows: [], invalidRows: [] }
  }

  const lines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length <= 1) {
    return { validRows: [], invalidRows: [] }
  }

  const validRows: PreparedCSVRow[] = []
  const invalidRows: InvalidPreviewRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]
    const parts = raw.split(',')

    if (parts.length < 4) {
      invalidRows.push({
        sourceIndex: i,
        raw,
        reason: 'Expected at least 4 comma-separated values',
      })
      continue
    }

    const player = normalizeName(parts[0] ?? '')
    const opponent = normalizeName(parts[1] ?? '')

    let date = ''
    let result = ''
    let matchType: MatchType = 'singles'

    if (parts.length === 4) {
      date = parts[3]?.trim() ?? ''
      result = normalizeResult(parts[2] ?? '')
    } else {
      const rawMatchType = parts[parts.length - 1]?.trim() ?? ''
      date = parts[parts.length - 2]?.trim() ?? ''
      result = normalizeResult(parts.slice(2, parts.length - 2).join(',').trim())
      matchType = normalizeMatchType(rawMatchType)
    }

    if (!player) {
      invalidRows.push({ sourceIndex: i, raw, reason: 'Missing player name' })
      continue
    }

    if (!opponent) {
      invalidRows.push({ sourceIndex: i, raw, reason: 'Missing opponent name' })
      continue
    }

    if (player.toLowerCase() === opponent.toLowerCase()) {
      invalidRows.push({
        sourceIndex: i,
        raw,
        reason: 'Player and opponent cannot be the same',
      })
      continue
    }

    if (!result) {
      invalidRows.push({ sourceIndex: i, raw, reason: 'Missing result' })
      continue
    }

    if (parts.length > 4) {
      const rawMatchType = parts[parts.length - 1]?.trim() ?? ''
      if (!isValidMatchType(rawMatchType)) {
        invalidRows.push({
          sourceIndex: i,
          raw,
          reason: 'match_type must be singles or doubles',
        })
        continue
      }
    }

    let normalizedDate = ''
    try {
      normalizedDate = normalizeDate(date)
    } catch {
      invalidRows.push({ sourceIndex: i, raw, reason: 'Invalid date' })
      continue
    }

    validRows.push({
      sourceIndex: i,
      player,
      opponent,
      result,
      date: normalizedDate,
      matchType,
      location: null,
    })
  }

  return { validRows, invalidRows }
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
        rating,
        dynamic_rating,
        singles_dynamic_rating,
        doubles_dynamic_rating,
        overall_dynamic_rating,
        location
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

async function createMissingPlayers(
  missingNames: string[],
  sourceRows: Array<{ location: string | null }>
): Promise<Player[]> {
  const uniqueMissingNames = [...new Set(missingNames)]

  if (uniqueMissingNames.length === 0) {
    return []
  }

  const defaultLocation = sourceRows.find((row) => row.location)?.location ?? null

  const insertRows = uniqueMissingNames.map((name) => ({
    name,
    rating: '3.5',
    dynamic_rating: 3.5,
    singles_rating: 3.5,
    singles_dynamic_rating: 3.5,
    doubles_rating: 3.5,
    doubles_dynamic_rating: 3.5,
    overall_rating: 3.5,
    overall_dynamic_rating: 3.5,
    location: defaultLocation,
  }))

  const { data, error } = await supabase
    .from('players')
    .insert(insertRows)
    .select(`
      id,
      name,
      rating,
      dynamic_rating,
      singles_dynamic_rating,
      doubles_dynamic_rating,
      overall_dynamic_rating,
      location
    `)

  if (error) {
    throw new Error(error.message)
  }

  return (data || []) as Player[]
}

async function findExistingMatchKeys(rows: MatchInsertRow[]): Promise<Set<string>> {
  const existingKeys = new Set<string>()

  for (const chunk of chunkArray(rows, 200)) {
    for (const row of chunk) {
      const { data, error } = await supabase
        .from('matches')
        .select('player_id, opponent_id, result, date, match_type')
        .eq('player_id', row.player_id)
        .eq('opponent_id', row.opponent_id)
        .eq('date', row.date)
        .eq('result', row.result)
        .eq('match_type', row.match_type)
        .limit(1)

      if (error) {
        throw new Error(error.message)
      }

      if ((data || []).length > 0) {
        existingKeys.add(buildMatchKey(row))
      }
    }
  }

  return existingKeys
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
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

function normalizeResult(result: string) {
  return result.trim().replace(/\s+/g, ' ')
}

function normalizeMatchType(value: string): MatchType {
  return value.trim().toLowerCase() === 'doubles' ? 'doubles' : 'singles'
}

function isValidMatchType(value: string) {
  const normalized = value.trim().toLowerCase()
  return normalized === 'singles' || normalized === 'doubles'
}

function reverseResult(result: string) {
  const trimmed = normalizeResult(result)

  if (trimmed.startsWith('W')) return trimmed.replace(/^W/, 'L')
  if (trimmed.startsWith('L')) return trimmed.replace(/^L/, 'W')

  return trimmed
}

function buildMatchKey(row: MatchInsertRow) {
  return `${row.player_id}|${row.opponent_id}|${row.date}|${row.result}|${row.match_type}`
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