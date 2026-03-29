'use client'

import Link from 'next/link'
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
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [loadingFile, setLoadingFile] = useState(false)
  const [importing, setImporting] = useState(false)

  const previewCount = useMemo(() => parsed?.lines.length ?? 0, [parsed])

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null

    setError('')
    setStatus('')
    setParsed(null)
    setFileName(file?.name || '')

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

  async function getOrCreatePlayerId(name: string): Promise<{ id: string; created: boolean }> {
    const normalized = normalizeName(name)

    const { data: existing, error: existingError } = await supabase
      .from('players')
      .select('id,name')
      .ilike('name', normalized)
      .limit(1)

    if (existingError) throw existingError

    if (existing && existing.length > 0) {
      return { id: existing[0].id, created: false }
    }

    const { data: inserted, error: insertError } = await supabase
      .from('players')
      .insert({
        name: normalized,
        location: null,
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

    const matchDate = formatDateForDb(parsed.matchDate)
    if (!matchDate) {
      setError('Could not determine a valid match date from the scorecard.')
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
          const player = await getOrCreatePlayerId(name)
          if (player.created) result.createdPlayers += 1
          teamAPlayerIds.push(player.id)
        }

        for (const name of line.teamBPlayers) {
          const player = await getOrCreatePlayerId(name)
          if (player.created) result.createdPlayers += 1
          teamBPlayerIds.push(player.id)
        }

        const sourceParts = [
          'scorecard-upload',
          parsed.leagueName || null,
          parsed.matchNumber ? `match-${parsed.matchNumber}` : null,
          parsed.homeTeam || null,
          parsed.awayTeam || null,
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
        setStatus(
          `Imported ${result.inserted} lines. Recalculating ratings now...`
        )
        await recalculateDynamicRatings()
        setStatus(
          `Import complete. Inserted ${result.inserted}, skipped ${result.skipped}, created ${result.createdPlayers} new players, and recalculated ratings.`
        )
      } else {
        setStatus(
          `No new lines were inserted. Skipped ${result.skipped} duplicates.`
        )
      }
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <main style={mainStyle}>
      <div style={navRowStyle}>
        <Link href="/" style={navLinkStyle}>Home</Link>
        <Link href="/admin" style={navLinkStyle}>Admin</Link>
        <Link href="/admin/manage-matches" style={navLinkStyle}>Manage Matches</Link>
      </div>

      <div style={heroCardStyle}>
        <h1 style={{ margin: 0, fontSize: 36 }}>Upload Scorecard</h1>
        <p style={{ margin: '12px 0 0', color: '#dbeafe', fontSize: 16, maxWidth: 760 }}>
          Upload a USTA scorecard export, preview the parsed singles and doubles lines,
          then import them into matches and match_players with duplicate protection.
        </p>
      </div>

      <div style={cardStyle}>
        <div style={fieldWrapStyle}>
          <label style={labelStyle}>Scorecard file</label>
          <input
            type="file"
            accept=".xls,.html"
            onChange={onFileChange}
            style={fileInputStyle}
          />
          <div style={helpTextStyle}>
            Supports HTML-based `.xls` scorecards and `.html` files.
          </div>
        </div>

        {fileName ? <p style={mutedStyle}>Loaded file: {fileName}</p> : null}
        {loadingFile ? <p style={mutedStyle}>Parsing scorecard...</p> : null}
        {error ? <div style={errorBoxStyle}>{error}</div> : null}
        {status ? <div style={successBoxStyle}>{status}</div> : null}

        {parsed ? (
          <>
            <div style={summaryGridStyle}>
              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Match Date</div>
                <div style={summaryValueStyle}>{displayDate(parsed.matchDate)}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>League</div>
                <div style={summaryValueStyle}>{parsed.leagueName || 'Unknown'}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Match #</div>
                <div style={summaryValueStyle}>{parsed.matchNumber || 'Unknown'}</div>
              </div>

              <div style={summaryCardStyle}>
                <div style={summaryLabelStyle}>Lines Found</div>
                <div style={summaryValueStyle}>{previewCount}</div>
              </div>
            </div>

            <div style={teamsRowStyle}>
              <div style={teamBadgeStyle}>
                <span style={teamBadgeLabelStyle}>Home</span>
                <strong>{parsed.homeTeam || 'Unknown'}</strong>
              </div>

              <div style={teamBadgeStyle}>
                <span style={teamBadgeLabelStyle}>Away</span>
                <strong>{parsed.awayTeam || 'Unknown'}</strong>
              </div>
            </div>

            <div style={{ marginTop: 22 }}>
              <h2 style={sectionTitleStyle}>Preview</h2>
              <div style={previewListStyle}>
                {parsed.lines.map((line, index) => (
                  <div key={`${line.lineNumber}-${index}`} style={previewCardStyle}>
                    <div style={previewTitleRowStyle}>
                      <div style={previewTitleStyle}>
                        {line.lineNumber} # {capitalize(line.matchType)}
                      </div>
                      <div
                        style={{
                          ...winnerPillStyle,
                          ...(line.winnerSide === 'A' ? winnerPillAStyle : winnerPillBStyle),
                        }}
                      >
                        Winner: Side {line.winnerSide}
                      </div>
                    </div>

                    <div style={previewTextStyle}>
                      <strong>Side A:</strong> {line.teamAPlayers.join(' / ')}
                    </div>

                    <div style={previewTextStyle}>
                      <strong>Side B:</strong> {line.teamBPlayers.join(' / ')}
                    </div>

                    <div style={previewTextStyle}>
                      <strong>Score:</strong> {line.score}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={actionRowStyle}>
              <button
                onClick={importScorecard}
                disabled={importing}
                style={{
                  ...primaryButtonStyle,
                  ...(importing ? disabledButtonStyle : {}),
                }}
              >
                {importing ? 'Importing + Recalculating...' : 'Confirm Import'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </main>
  )
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

const mainStyle = {
  maxWidth: '1180px',
  margin: '0 auto',
  padding: '20px',
}

const navRowStyle = {
  display: 'flex',
  gap: '16px',
  marginBottom: '20px',
  flexWrap: 'wrap' as const,
}

const navLinkStyle = {
  textDecoration: 'none',
  color: '#2563eb',
  fontWeight: 700,
}

const heroCardStyle = {
  background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
  color: 'white',
  padding: '28px',
  borderRadius: '22px',
  marginBottom: '20px',
  boxShadow: '0 16px 32px rgba(37, 99, 235, 0.18)',
}

const cardStyle = {
  background: '#ffffff',
  padding: '22px',
  borderRadius: '22px',
  boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
  border: '1px solid #e2e8f0',
}

const fieldWrapStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '8px',
}

const labelStyle = {
  display: 'block',
  color: '#334155',
  fontSize: '13px',
  fontWeight: 700,
}

const fileInputStyle = {
  fontSize: '14px',
}

const helpTextStyle = {
  color: '#64748b',
  fontSize: '13px',
}

const mutedStyle = {
  color: '#64748b',
  marginTop: '12px',
}

const errorBoxStyle = {
  marginTop: '14px',
  background: '#fef2f2',
  color: '#b91c1c',
  border: '1px solid #fecaca',
  borderRadius: '16px',
  padding: '14px',
}

const successBoxStyle = {
  marginTop: '14px',
  background: '#ecfdf5',
  color: '#166534',
  border: '1px solid #bbf7d0',
  borderRadius: '16px',
  padding: '14px',
}

const summaryGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
  marginTop: '20px',
}

const summaryCardStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '14px',
}

const summaryLabelStyle = {
  color: '#64748b',
  fontSize: '12px',
  marginBottom: '6px',
}

const summaryValueStyle = {
  color: '#0f172a',
  fontSize: '18px',
  fontWeight: 800,
}

const teamsRowStyle = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap' as const,
  marginTop: '16px',
}

const teamBadgeStyle = {
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  borderRadius: '16px',
  padding: '12px 14px',
  color: '#1e3a8a',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '4px',
}

const teamBadgeLabelStyle = {
  fontSize: '12px',
  color: '#64748b',
}

const sectionTitleStyle = {
  margin: '0 0 12px 0',
  color: '#0f172a',
  fontSize: '24px',
  fontWeight: 800,
}

const previewListStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '12px',
}

const previewCardStyle = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '14px',
}

const previewTitleRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '10px',
  alignItems: 'center',
  marginBottom: '10px',
  flexWrap: 'wrap' as const,
}

const previewTitleStyle = {
  color: '#0f172a',
  fontWeight: 800,
  fontSize: '16px',
}

const previewTextStyle = {
  color: '#334155',
  fontSize: '14px',
  marginBottom: '6px',
  lineHeight: 1.5,
}

const winnerPillStyle = {
  padding: '6px 10px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
}

const winnerPillAStyle = {
  background: '#dbeafe',
  color: '#1d4ed8',
}

const winnerPillBStyle = {
  background: '#ede9fe',
  color: '#6d28d9',
}

const actionRowStyle = {
  marginTop: '22px',
  display: 'flex',
  justifyContent: 'flex-start',
}

const primaryButtonStyle = {
  border: '1px solid #2563eb',
  background: '#2563eb',
  color: 'white',
  padding: '12px 16px',
  borderRadius: '999px',
  fontWeight: 700,
  cursor: 'pointer',
}

const disabledButtonStyle = {
  opacity: 0.7,
  cursor: 'not-allowed',
}