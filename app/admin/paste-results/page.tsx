'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { recalculateDynamicRatings } from '../../../lib/recalculateRatings'

type MatchType = 'singles' | 'doubles'

type ImportResult = {
  parsedCount: number
  expandedRowCount: number
  uniqueRowCount: number
  insertedRowCount: number
  skippedDuplicateRowCount: number
  createdPlayerCount: number
}

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

type PreparedPasteRow = {
  sourceIndex: number
  player: string
  opponent: string
  result: string
  date: string
  matchType: MatchType
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

type PreviewState = {
  preparedRows: PreparedPasteRow[]
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

export default function PasteResultsPage() {
  const router = useRouter()

  const [text, setText] = useState('')
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
      const parsed = parsePasteTextWithInvalidRows(text)

      if (parsed.validRows.length === 0 && parsed.invalidRows.length === 0) {
        throw new Error('No rows found.')
      }

      const preparedRows: PreparedPasteRow[] = parsed.validRows

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
            raw: `${row.player} | ${row.opponent} | ${row.result} | ${row.date} | ${row.matchType}`,
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
          reason = 'Duplicate inside this paste import'
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
      const createdPlayers = await createMissingPlayers(preview.missingNames)
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
        `Imported ${importResult.insertedRowCount} rows. Skipped ${importResult.skippedDuplicateRowCount} duplicates. Created ${importResult.createdPlayerCount} players.`
      )
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
          Preview pasted match results, including singles or doubles match type, see duplicates and invalid rows before import, create missing players automatically, and rebuild ratings plus snapshots.
        </p>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Paste Match Results</h2>
        <p style={{ color: '#64748b' }}>Use one of these formats:</p>

        <pre style={sampleStyle}>
{`Nathan Meinert | John Doe | W 6-3 6-4 | 2026-03-22
Nathan Meinert | Jane Smith | L 4-6 6-7 | 2026-03-25

Nathan Meinert | John Doe | W 6-3 6-4 | 2026-03-22 | singles
Nathan Meinert | Jane Smith | W 6-4 6-4 | 2026-03-25 | doubles`}
        </pre>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Nathan Meinert | John Doe | W 6-3 6-4 | 2026-03-22 | singles
Nathan Meinert | Jane Smith | W 6-4 6-4 | 2026-03-25 | doubles`}
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

function parsePasteTextWithInvalidRows(text: string): {
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
    const parts = line.split('|').map((p) => p.trim())

    if (parts.length < 4) {
      invalidRows.push({
        sourceIndex,
        raw: line,
        reason: 'Expected format: player | opponent | result | date | optional match_type',
      })
      return
    }

    const player = normalizeName(parts[0])
    const opponent = normalizeName(parts[1])
    const result = normalizeResult(parts[2])
    const rawDate = parts[3]
    const rawMatchType = parts[4] ?? 'singles'

    if (!player) {
      invalidRows.push({ sourceIndex, raw: line, reason: 'Missing player name' })
      return
    }

    if (!opponent) {
      invalidRows.push({ sourceIndex, raw: line, reason: 'Missing opponent name' })
      return
    }

    if (player.toLowerCase() === opponent.toLowerCase()) {
      invalidRows.push({ sourceIndex, raw: line, reason: 'Player and opponent cannot be the same' })
      return
    }

    if (!result) {
      invalidRows.push({ sourceIndex, raw: line, reason: 'Missing result' })
      return
    }

    if (!isValidMatchType(rawMatchType)) {
      invalidRows.push({
        sourceIndex,
        raw: line,
        reason: 'match_type must be singles or doubles',
      })
      return
    }

    let date = ''
    try {
      date = normalizeDate(rawDate)
    } catch {
      invalidRows.push({ sourceIndex, raw: line, reason: 'Invalid date' })
      return
    }

    validRows.push({
      sourceIndex,
      player,
      opponent,
      result,
      date,
      matchType: normalizeMatchType(rawMatchType),
    })
  })

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

async function createMissingPlayers(names: string[]) {
  const uniqueMissingNames = [...new Set(names)]

  if (uniqueMissingNames.length === 0) return []

  const { data, error } = await supabase
    .from('players')
    .insert(
      uniqueMissingNames.map((name) => ({
        name,
        rating: '3.5',
        dynamic_rating: 3.5,
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

function normalizeResult(result: string) {
  return result.trim().replace(/\s+/g, ' ')
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