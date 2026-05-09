'use client'

export const dynamic = 'force-dynamic'


import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import { listTiqLeagues } from '@/lib/tiq-league-service'
import type { TiqLeagueRecord, TiqLeagueScoringSystem } from '@/lib/tiq-league-registry'
import {
  listTiqTeamMatchEvents,
  listTiqTeamMatchLines,
  saveTiqTeamMatchEvent,
  saveTiqTeamMatchLine,
  deleteTiqTeamMatchEvent,
  deleteTiqTeamMatchLine,
  type TiqTeamMatchEventRecord,
  type TiqTeamMatchLineRecord,
} from '@/lib/tiq-team-results-service'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/captain-formatters'
import {
  formatDynamicPointsForSides,
  getDynamicPointsRulesSummary,
  validateTiqTennisMatchScore,
} from '@/lib/tiq-scoring'

type PlayerOption = { id: string; name: string }
type MatchLineSummary = {
  total: number
  completed: number
  teamAWins: number
  teamBWins: number
  teamAPoints: number
  teamBPoints: number
}


const pageWrap: CSSProperties = { maxWidth: 1100, margin: '0 auto', padding: '32px 16px' }
const heading: CSSProperties = { fontSize: 26, fontWeight: 700, marginBottom: 6 }
const subheading: CSSProperties = { color: '#94a3b8', fontSize: 14, marginBottom: 32 }
const sectionTitle: CSSProperties = { fontSize: 17, fontWeight: 700, marginBottom: 14, marginTop: 32 }
const card: CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: '20px 22px',
  marginBottom: 16,
}
const row: CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }
const fieldWrap: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px' }
const label: CSSProperties = { fontSize: 12, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.04em' }
const inputStyle: CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#f1f5f9', fontSize: 14 }
const selectStyle: CSSProperties = { ...inputStyle }
const scoreHelpStyle: CSSProperties = { color: '#94a3b8', fontSize: 12, lineHeight: 1.4, fontWeight: 600 }
const btnPrimary: CSSProperties = { padding: '9px 18px', borderRadius: 8, background: '#9be11d', color: '#0a0a0a', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', whiteSpace: 'normal' }
const btnDanger: CSSProperties = { padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', color: '#f87171', fontWeight: 600, fontSize: 13, border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer' }
const btnSecondary: CSSProperties = { padding: '7px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', fontWeight: 600, fontSize: 13, border: '1px solid rgba(255,255,255,0.10)', cursor: 'pointer' }
const msgOk: CSSProperties = { color: '#9be11d', fontSize: 13, marginTop: 6 }
const msgErr: CSSProperties = { color: '#f87171', fontSize: 13, marginTop: 6 }
const pill: CSSProperties = { display: 'inline-block', padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', fontSize: 12, color: '#94a3b8' }
const pillGreen: CSSProperties = { ...pill, background: 'rgba(155,225,29,0.12)', color: '#9be11d' }
const divider: CSSProperties = { borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 16, paddingTop: 16 }
const lineGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 12, marginTop: 14 }
const lineCard: CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
  padding: '14px 16px',
}

function Field({ label: lbl, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={fieldWrap}>
      <span style={label}>{lbl}</span>
      {children}
    </div>
  )
}

function PlayerSelect({
  value,
  onChange,
  players,
  placeholder,
  excludedPlayerIds = [],
}: {
  value: string
  onChange: (v: string) => void
  players: PlayerOption[]
  placeholder?: string
  excludedPlayerIds?: string[]
}) {
  const excludedIds = new Set(excludedPlayerIds.filter((id) => id && id !== value))
  const availablePlayers = players.filter((player) => !excludedIds.has(player.id))

  return (
    <select style={selectStyle} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder || 'Select player...'}</option>
      {availablePlayers.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  )
}


type LineFormState = {
  lineNumber: string
  matchType: 'singles' | 'doubles'
  sideAPlayer1Id: string
  sideAPlayer2Id: string
  sideBPlayer1Id: string
  sideBPlayer2Id: string
  winnerSide: 'A' | 'B' | ''
  score: string
}

const emptyLine = (lineNumber = ''): LineFormState => ({
  lineNumber,
  matchType: 'singles',
  sideAPlayer1Id: '',
  sideAPlayer2Id: '',
  sideBPlayer1Id: '',
  sideBPlayer2Id: '',
  winnerSide: '',
  score: '',
})

function LineForm({
  event,
  players,
  scoringSystem,
  existingLine,
  defaultLineNumber = '',
  onSaved,
  onCancel,
}: {
  event: TiqTeamMatchEventRecord
  players: PlayerOption[]
  scoringSystem: TiqLeagueScoringSystem
  existingLine?: TiqTeamMatchLineRecord
  defaultLineNumber?: string
  onSaved: (line: TiqTeamMatchLineRecord) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<LineFormState>(() =>
    existingLine
      ? {
          lineNumber: String(existingLine.lineNumber),
          matchType: existingLine.matchType,
          sideAPlayer1Id: existingLine.sideAPlayer1Id,
          sideAPlayer2Id: existingLine.sideAPlayer2Id,
          sideBPlayer1Id: existingLine.sideBPlayer1Id,
          sideBPlayer2Id: existingLine.sideBPlayer2Id,
          winnerSide: existingLine.winnerSide ?? '',
          score: existingLine.score,
        }
      : emptyLine(defaultLineNumber)
  )
  const [saving, setSaving] = useState(false)
  const [warning, setWarning] = useState('')

  function playerName(id: string) {
    return players.find((p) => p.id === id)?.name ?? ''
  }

  function validateLine() {
    if (!form.lineNumber || !form.sideAPlayer1Id || !form.sideBPlayer1Id) {
      return 'Line number and at least one player per side are required.'
    }

    const lineNumber = Number(form.lineNumber)
    if (!Number.isInteger(lineNumber) || lineNumber < 1 || lineNumber > 20) {
      return 'Line number must be a whole number from 1 to 20.'
    }

    if (form.matchType === 'doubles' && (!form.sideAPlayer2Id || !form.sideBPlayer2Id)) {
      return 'Doubles lines need two players on each side.'
    }

    const selectedPlayerIds = form.matchType === 'doubles'
      ? [
          form.sideAPlayer1Id,
          form.sideAPlayer2Id,
          form.sideBPlayer1Id,
          form.sideBPlayer2Id,
        ].filter(Boolean)
      : [form.sideAPlayer1Id, form.sideBPlayer1Id].filter(Boolean)
    if (new Set(selectedPlayerIds).size !== selectedPlayerIds.length) {
      return 'Each player can only appear once on a line.'
    }

    if (form.winnerSide && !form.score.trim()) {
      return 'Completed lines need a score.'
    }

    if (form.score.trim() && !form.winnerSide) {
      return 'Choose a winner before saving a scored line.'
    }

    if (form.winnerSide || form.score.trim()) {
      const scoreValidation = validateTiqTennisMatchScore(form.score, form.winnerSide || null)
      if (!scoreValidation.valid) return scoreValidation.message
    }

    return ''
  }

  async function handleSave() {
    const validationWarning = validateLine()
    if (validationWarning) {
      setWarning(validationWarning)
      return
    }

    setSaving(true)
    setWarning('')
    const { line, warning: w } = await saveTiqTeamMatchLine(event, {
      lineNumber: Number(form.lineNumber),
      matchType: form.matchType,
      sideAPlayer1Name: playerName(form.sideAPlayer1Id),
      sideAPlayer1Id: form.sideAPlayer1Id || null,
      sideAPlayer2Name: form.matchType === 'doubles' ? playerName(form.sideAPlayer2Id) : '',
      sideAPlayer2Id: form.matchType === 'doubles' ? form.sideAPlayer2Id || null : null,
      sideBPlayer1Name: playerName(form.sideBPlayer1Id),
      sideBPlayer1Id: form.sideBPlayer1Id || null,
      sideBPlayer2Name: form.matchType === 'doubles' ? playerName(form.sideBPlayer2Id) : '',
      sideBPlayer2Id: form.matchType === 'doubles' ? form.sideBPlayer2Id || null : null,
      winnerSide: form.winnerSide || null,
      score: form.score || null,
    })
    setSaving(false)
    if (w) setWarning(w)
    if (line) onSaved(line)
  }

  const isDoubles = form.matchType === 'doubles'
  const activePlayerIds = isDoubles
    ? [form.sideAPlayer1Id, form.sideAPlayer2Id, form.sideBPlayer1Id, form.sideBPlayer2Id]
    : [form.sideAPlayer1Id, form.sideBPlayer1Id]

  return (
    <div style={card}>
      <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>
        {existingLine ? `Edit line ${existingLine.lineNumber}` : `Add line${defaultLineNumber ? ` ${defaultLineNumber}` : ''}`}
      </div>

      <div style={row}>
        <Field label="LINE #">
          <input style={inputStyle} type="number" min={1} max={20} value={form.lineNumber} onChange={(e) => setForm((f) => ({ ...f, lineNumber: e.target.value }))} />
        </Field>
        <Field label="MATCH TYPE">
          <select
            style={selectStyle}
            value={form.matchType}
            onChange={(e) => {
              const matchType = e.target.value as 'singles' | 'doubles'
              setForm((f) => ({
                ...f,
                matchType,
                sideAPlayer2Id: matchType === 'singles' ? '' : f.sideAPlayer2Id,
                sideBPlayer2Id: matchType === 'singles' ? '' : f.sideBPlayer2Id,
              }))
            }}
          >
            <option value="singles">Singles</option>
            <option value="doubles">Doubles</option>
          </select>
        </Field>
        <Field label="WINNER">
          <select style={selectStyle} value={form.winnerSide} onChange={(e) => setForm((f) => ({ ...f, winnerSide: e.target.value as 'A' | 'B' | '' }))}>
            <option value="">TBD</option>
            <option value="A">{event.teamAName} (Side A)</option>
            <option value="B">{event.teamBName} (Side B)</option>
          </select>
        </Field>
        <Field label="SCORE">
          <input style={inputStyle} placeholder="e.g. 6-4, 7-5" value={form.score} onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))} />
          <small style={scoreHelpStyle}>
            Completed sets only: 6-4, 7-6, or a deciding 10-point tiebreak like 10-8.
          </small>
        </Field>
      </div>

      {scoringSystem === 'dynamic_points' ? (
        <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.45, marginBottom: 8 }}>
          {getDynamicPointsRulesSummary()}
        </div>
      ) : null}

      <div style={row}>
        <Field label={`SIDE A - ${event.teamAName} - PLAYER 1`}>
          <PlayerSelect value={form.sideAPlayer1Id} onChange={(v) => setForm((f) => ({ ...f, sideAPlayer1Id: v }))} players={players} excludedPlayerIds={activePlayerIds} />
        </Field>
        {isDoubles && (
          <Field label="SIDE A - PLAYER 2">
            <PlayerSelect value={form.sideAPlayer2Id} onChange={(v) => setForm((f) => ({ ...f, sideAPlayer2Id: v }))} players={players} excludedPlayerIds={activePlayerIds} />
          </Field>
        )}
      </div>

      <div style={row}>
        <Field label={`SIDE B - ${event.teamBName} - PLAYER 1`}>
          <PlayerSelect value={form.sideBPlayer1Id} onChange={(v) => setForm((f) => ({ ...f, sideBPlayer1Id: v }))} players={players} excludedPlayerIds={activePlayerIds} />
        </Field>
        {isDoubles && (
          <Field label="SIDE B - PLAYER 2">
            <PlayerSelect value={form.sideBPlayer2Id} onChange={(v) => setForm((f) => ({ ...f, sideBPlayer2Id: v }))} players={players} excludedPlayerIds={activePlayerIds} />
          </Field>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button style={btnPrimary} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save line'}
        </button>
        <button style={btnSecondary} onClick={onCancel}>Cancel</button>
      </div>
      {warning ? <p style={warning.startsWith('Line saved') ? msgOk : msgErr}>{warning}</p> : null}
    </div>
  )
}


function EventCard({
  event,
  players,
  lineSummary,
  scoringSystem,
  onDeleted,
}: {
  event: TiqTeamMatchEventRecord
  players: PlayerOption[]
  lineSummary?: MatchLineSummary
  scoringSystem: TiqLeagueScoringSystem
  onDeleted: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [lines, setLines] = useState<TiqTeamMatchLineRecord[]>([])
  const [linesLoaded, setLinesLoaded] = useState(false)
  const [addingLine, setAddingLine] = useState(false)
  const [editingLine, setEditingLine] = useState<TiqTeamMatchLineRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [warning, setWarning] = useState('')

  const loadLines = useCallback(async () => {
    const { lines: l } = await listTiqTeamMatchLines(event.id)
    setLines(l)
    setLinesLoaded(true)
  }, [event.id])

  async function handleExpand() {
    setExpanded((v) => !v)
    if (!linesLoaded) await loadLines()
  }

  async function handleDeleteEvent() {
    if (!confirm(`Delete event "${event.teamAName} vs ${event.teamBName}" on ${formatDate(event.matchDate)}? This cannot be undone.`)) return
    setDeleting(true)
    const { deleted, warning: w } = await deleteTiqTeamMatchEvent(event.id)
    setDeleting(false)
    if (w) setWarning(w)
    if (deleted) onDeleted(event.id)
  }

  async function handleDeleteLine(lineId: string) {
    if (!confirm('Delete this line? Ratings will be recalculated.')) return
    const { deleted, warning: w } = await deleteTiqTeamMatchLine(lineId)
    if (w) {
      setWarning(w)
    } else {
      setWarning('')
    }
    if (deleted) setLines((prev) => prev.filter((l) => l.id !== lineId))
  }

  function handleLineSaved(line: TiqTeamMatchLineRecord) {
    const idx = lines.findIndex((l) => l.lineNumber === line.lineNumber)
    const nextLines = idx >= 0
      ? lines.map((item, itemIndex) => (itemIndex === idx ? line : item))
      : [...lines, line].sort((a, b) => a.lineNumber - b.lineNumber)

    setLines(nextLines)
    setAddingLine(Boolean(nextOpenLineNumberForLines(nextLines)))
    setEditingLine(null)
  }

  function nextOpenLineNumberForLines(matchLines: TiqTeamMatchLineRecord[]) {
    const usedLines = new Set(matchLines.map((line) => line.lineNumber))
    for (let lineNumber = 1; lineNumber <= 20; lineNumber += 1) {
      if (!usedLines.has(lineNumber)) return String(lineNumber)
    }
    return ''
  }

  const completedLines = lines.filter((l) => l.winnerSide)
  const teamAWins = lines.filter((l) => l.winnerSide === 'A').length
  const teamBWins = lines.filter((l) => l.winnerSide === 'B').length
  const displayTotalLines = linesLoaded ? lines.length : lineSummary?.total ?? 0
  const displayCompletedLines = linesLoaded ? completedLines.length : lineSummary?.completed ?? 0
  const displayPendingLines = Math.max(displayTotalLines - displayCompletedLines, 0)
  const displayTeamAWins = linesLoaded ? teamAWins : lineSummary?.teamAWins ?? 0
  const displayTeamBWins = linesLoaded ? teamBWins : lineSummary?.teamBWins ?? 0
  const dynamicPoints = summarizeDynamicPoints(lines)
  const displayTeamAPoints = linesLoaded ? dynamicPoints.teamAPoints : lineSummary?.teamAPoints ?? 0
  const displayTeamBPoints = linesLoaded ? dynamicPoints.teamBPoints : lineSummary?.teamBPoints ?? 0
  const showDynamicPoints = scoringSystem === 'dynamic_points'
  const defaultLineNumber = nextOpenLineNumberForLines(lines)

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            {event.teamAName} <span style={{ color: '#64748b' }}>vs</span> {event.teamBName}
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>
            {formatDate(event.matchDate)}{event.facility ? ` - ${event.facility}` : ''}
          </div>
          {displayTotalLines > 0 && (
            <div style={{ marginTop: 6, fontSize: 13 }}>
              <span style={pill}>{displayTotalLines} line{displayTotalLines === 1 ? '' : 's'}</span>
              {' '}
              <span style={displayCompletedLines === displayTotalLines ? pillGreen : pill}>{displayCompletedLines} complete</span>
              {' '}
              <span style={displayPendingLines > 0 ? pill : pillGreen}>{displayPendingLines} pending</span>
              {' '}
              <span style={displayTeamAWins > displayTeamBWins ? pillGreen : pill}>{event.teamAName}: {displayTeamAWins}</span>
              {' '}
              <span style={displayTeamBWins > displayTeamAWins ? pillGreen : pill}>{event.teamBName}: {displayTeamBWins}</span>
              {showDynamicPoints && (
                <>
                  {' '}
                  <span style={displayTeamAPoints > displayTeamBPoints ? pillGreen : pill}>{event.teamAName} pts: {displayTeamAPoints}</span>
                  {' '}
                  <span style={displayTeamBPoints > displayTeamAPoints ? pillGreen : pill}>{event.teamBName} pts: {displayTeamBPoints}</span>
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnSecondary} onClick={handleExpand}>
            {expanded ? 'Collapse' : `Lines${displayTotalLines ? ` (${displayTotalLines})` : ''}`}
          </button>
          <button style={btnDanger} onClick={handleDeleteEvent} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      {warning ? <p style={msgErr}>{warning}</p> : null}

      {expanded && (
        <div style={divider}>
          {showDynamicPoints && (
            <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.45, marginBottom: 12 }}>
              {getDynamicPointsRulesSummary()}
            </div>
          )}
          {!linesLoaded ? (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>Loading lines...</p>
          ) : lines.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>No lines yet.</p>
          ) : (
            <div style={lineGrid}>
              {lines.map((line) => (
                editingLine?.id === line.id ? (
                  <LineForm
                    key={line.id}
                    event={event}
                    players={players}
                    scoringSystem={scoringSystem}
                    existingLine={line}
                    onSaved={handleLineSaved}
                    onCancel={() => setEditingLine(null)}
                  />
                ) : (
                  <div key={line.id} style={lineCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>Line {line.lineNumber}</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span style={line.matchType === 'doubles' ? pillGreen : pill}>{line.matchType}</span>
                        {line.winnerSide && (
                          <span style={pillGreen}>
                            {line.winnerSide === 'A' ? event.teamAName : event.teamBName} won
                          </span>
                        )}
                        {!line.winnerSide && <span style={pill}>Pending</span>}
                      </div>
                    </div>

                    <div style={{ fontSize: 13, color: '#cbd5e1', marginBottom: 4 }}>
                      <div>A: {line.sideAPlayer1Name}{line.sideAPlayer2Name ? ` / ${line.sideAPlayer2Name}` : ''}</div>
                      <div>B: {line.sideBPlayer1Name}{line.sideBPlayer2Name ? ` / ${line.sideBPlayer2Name}` : ''}</div>
                    </div>

                    {line.score && <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>{line.score}</div>}
                    {showDynamicPoints && line.winnerSide && line.score && (
                      <DynamicPointsLine line={line} />
                    )}

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={btnSecondary} onClick={() => setEditingLine(line)}>Edit</button>
                      <button style={btnDanger} onClick={() => handleDeleteLine(line.id)}>Delete</button>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}

          {!addingLine && !editingLine && defaultLineNumber && (
            <button style={{ ...btnSecondary, marginTop: 14 }} onClick={() => setAddingLine(true)}>
              + Add line {defaultLineNumber}
            </button>
          )}

          {!addingLine && !editingLine && !defaultLineNumber && (
            <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 14 }}>All 20 line slots are filled.</p>
          )}

          {addingLine && (
            <div style={{ marginTop: 14 }}>
              <LineForm
                key={`add-line-${defaultLineNumber || lines.length}`}
                event={event}
                players={players}
                scoringSystem={scoringSystem}
                defaultLineNumber={defaultLineNumber}
                onSaved={handleLineSaved}
                onCancel={() => setAddingLine(false)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function summarizeDynamicPoints(lines: TiqTeamMatchLineRecord[]) {
  return lines.reduce(
    (summary, line) => {
      const points = formatDynamicPointsForSides(line.score, line.winnerSide)
      if (!points) return summary

      return {
        teamAPoints: summary.teamAPoints + points.sideAPoints,
        teamBPoints: summary.teamBPoints + points.sideBPoints,
      }
    },
    { teamAPoints: 0, teamBPoints: 0 },
  )
}

function DynamicPointsLine({ line }: { line: TiqTeamMatchLineRecord }) {
  const points = formatDynamicPointsForSides(line.score, line.winnerSide)
  if (!points) {
    return (
      <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 8 }}>
        Dynamic points need a standard set score.
      </div>
    )
  }

  return (
    <div style={{ fontSize: 12, color: '#9be11d', marginBottom: 8 }}>
      Dynamic points: {points.label}
    </div>
  )
}


type EventFormState = {
  leagueId: string
  teamAName: string
  teamBName: string
  matchDate: string
  facility: string
  notes: string
}

const emptyEvent = (): EventFormState => ({
  leagueId: '',
  teamAName: '',
  teamBName: '',
  matchDate: '',
  facility: '',
  notes: '',
})

function todayInputValue() {
  if (typeof window === 'undefined') return ''
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 10)
}

function teamOptionsForLeague(league: TiqLeagueRecord | undefined) {
  if (!league) return []

  return Array.from(
    new Set([
      league.captainTeamName,
      ...league.teams,
    ].map((team) => team.trim()).filter(Boolean)),
  )
}

async function loadLineSummaries(events: TiqTeamMatchEventRecord[]) {
  const eventIds = events.map((event) => event.id)
  if (eventIds.length === 0) return new Map<string, MatchLineSummary>()

  const { data } = await supabase
    .from('tiq_team_league_match_lines')
    .select('event_id, winner_side, score')
    .in('event_id', eventIds)

  const summaries = new Map<string, MatchLineSummary>()
  for (const eventId of eventIds) {
    summaries.set(eventId, { total: 0, completed: 0, teamAWins: 0, teamBWins: 0, teamAPoints: 0, teamBPoints: 0 })
  }

  for (const row of data || []) {
    const eventId = String(row.event_id || '')
    const summary = summaries.get(eventId)
    if (!summary) continue

    summary.total += 1
    if (row.winner_side === 'A') {
      summary.completed += 1
      summary.teamAWins += 1
    }
    if (row.winner_side === 'B') {
      summary.completed += 1
      summary.teamBWins += 1
    }

    const points = formatDynamicPointsForSides(
      typeof row.score === 'string' ? row.score : null,
      row.winner_side === 'A' || row.winner_side === 'B' ? row.winner_side : null,
    )
    if (points) {
      summary.teamAPoints += points.sideAPoints
      summary.teamBPoints += points.sideBPoints
    }
  }

  return summaries
}

function NewEventForm({
  leagues,
  onCreated,
}: {
  leagues: TiqLeagueRecord[]
  onCreated: (event: TiqTeamMatchEventRecord) => void
}) {
  const [form, setForm] = useState<EventFormState>(() => ({ ...emptyEvent(), matchDate: todayInputValue() }))
  const [saving, setSaving] = useState(false)
  const [warning, setWarning] = useState('')
  const [message, setMessage] = useState('')
  const selectedLeague = useMemo(
    () => leagues.find((league) => league.id === form.leagueId),
    [form.leagueId, leagues],
  )
  const teamOptions = useMemo(() => teamOptionsForLeague(selectedLeague), [selectedLeague])

  async function handleCreate() {
    if (!form.leagueId || !form.teamAName || !form.teamBName || !form.matchDate) {
      setWarning('League, both team names, and match date are required.')
      return
    }
    setSaving(true)
    setWarning('')
    setMessage('')
    const { event, warning: w } = await saveTiqTeamMatchEvent({
      leagueId: form.leagueId,
      teamAName: form.teamAName,
      teamBName: form.teamBName,
      matchDate: form.matchDate,
      facility: form.facility || null,
      notes: form.notes || null,
    })
    setSaving(false)
    if (w) setWarning(w)
    if (event) {
      setMessage('Event created.')
      setForm({ ...emptyEvent(), matchDate: todayInputValue() })
      onCreated(event)
    }
  }

  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>New team match</div>

      <div style={row}>
        <Field label="LEAGUE">
          <select
            style={selectStyle}
            value={form.leagueId}
            onChange={(e) => {
              const nextLeagueId = e.target.value
              const nextLeague = leagues.find((league) => league.id === nextLeagueId)
              const nextTeamOptions = teamOptionsForLeague(nextLeague)
              setForm((current) => ({
                ...current,
                leagueId: nextLeagueId,
                teamAName: current.teamAName || nextLeague?.captainTeamName || nextTeamOptions[0] || '',
                matchDate: current.matchDate || todayInputValue(),
              }))
            }}
          >
            <option value="">Select league...</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>{l.leagueName}</option>
            ))}
          </select>
        </Field>
        <Field label="MATCH DATE">
          <input style={inputStyle} type="date" value={form.matchDate} onChange={(e) => setForm((f) => ({ ...f, matchDate: e.target.value }))} />
        </Field>
      </div>

      <div style={row}>
        <Field label="TEAM A NAME">
          <input
            style={inputStyle}
            list="admin-tiq-match-team-options"
            placeholder={teamOptions.length ? 'Choose or type team name' : 'Home team'}
            value={form.teamAName}
            onChange={(e) => setForm((f) => ({ ...f, teamAName: e.target.value }))}
          />
        </Field>
        <Field label="TEAM B NAME">
          <input
            style={inputStyle}
            list="admin-tiq-match-team-options"
            placeholder={teamOptions.length ? 'Choose or type opponent' : 'Away team'}
            value={form.teamBName}
            onChange={(e) => setForm((f) => ({ ...f, teamBName: e.target.value }))}
          />
        </Field>
      </div>
      <datalist id="admin-tiq-match-team-options">
        {teamOptions.map((team) => <option key={team} value={team} />)}
      </datalist>

      <div style={row}>
        <Field label="FACILITY (optional)">
          <input style={inputStyle} placeholder="Facility name" value={form.facility} onChange={(e) => setForm((f) => ({ ...f, facility: e.target.value }))} />
        </Field>
        <Field label="NOTES (optional)">
          <input style={inputStyle} placeholder="Any notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </Field>
      </div>

      <button style={btnPrimary} onClick={handleCreate} disabled={saving}>
        {saving ? 'Creating...' : 'Create match'}
      </button>
      {warning ? <p style={msgErr}>{warning}</p> : null}
      {message ? <p style={msgOk}>{message}</p> : null}
    </div>
  )
}


export default function TiqTeamMatchesPage() {
  const [leagues, setLeagues] = useState<TiqLeagueRecord[]>([])
  const [events, setEvents] = useState<TiqTeamMatchEventRecord[]>([])
  const [lineSummaries, setLineSummaries] = useState<Map<string, MatchLineSummary>>(new Map())
  const [players, setPlayers] = useState<PlayerOption[]>([])
  const [filterLeagueId, setFilterLeagueId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')

    const [leaguesResult, playersResult] = await Promise.all([
      listTiqLeagues(),
      supabase.from('players').select('id, name').order('name', { ascending: true }),
    ])

    if (leaguesResult.warning) setError(leaguesResult.warning)
    if (playersResult.error) setError(playersResult.error.message)

    setLeagues(leaguesResult.records)
    setPlayers((playersResult.data || []) as PlayerOption[])

    const { events: evts, warning } = await listTiqTeamMatchEvents()
    if (warning) setError(warning)
    setEvents(evts)
    setLineSummaries(await loadLineSummaries(evts))
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadAll()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadAll])

  async function handleFilterChange(leagueId: string) {
    setFilterLeagueId(leagueId)
    setLoading(true)
    const { events: evts, warning } = await listTiqTeamMatchEvents({ leagueId: leagueId || null })
    if (warning) setError(warning)
    setEvents(evts)
    setLineSummaries(await loadLineSummaries(evts))
    setLoading(false)
  }

  function handleEventCreated(event: TiqTeamMatchEventRecord) {
    setLineSummaries((prev) => new Map(prev).set(event.id, { total: 0, completed: 0, teamAWins: 0, teamBWins: 0, teamAPoints: 0, teamBPoints: 0 }))
    setEvents((prev) => [event, ...prev])
  }

  function handleEventDeleted(id: string) {
    setLineSummaries((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }

  const leagueMap = Object.fromEntries(leagues.map((l) => [l.id, l.leagueName]))
  const leagueScoringMap = Object.fromEntries(leagues.map((l) => [l.id, l.scoringSystem]))

  return (
    <SiteShell>
      <AdminGate>
        <div style={pageWrap}>
          <div style={heading}>League results</div>
          <div style={subheading}>Create team matches, enter the lines, and keep TIQ ratings current.</div>

          {error ? <p style={msgErr}>{error}</p> : null}

          <NewEventForm leagues={leagues} onCreated={handleEventCreated} />

          <div style={sectionTitle}>Recorded matches</div>

          <div style={{ marginBottom: 16 }}>
            <select
              style={{ ...selectStyle, maxWidth: 280 }}
              value={filterLeagueId}
              onChange={(e) => handleFilterChange(e.target.value)}
            >
              <option value="">All leagues</option>
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>{l.leagueName}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <p style={{ color: '#94a3b8' }}>Loading...</p>
          ) : events.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>No recorded matches yet. Create one above.</p>
          ) : (
            events.map((event) => (
              <EventCard
                key={event.id}
                event={{ ...event, teamAName: event.teamAName || leagueMap[event.leagueId] || event.leagueId }}
                players={players}
                lineSummary={lineSummaries.get(event.id)}
                scoringSystem={leagueScoringMap[event.leagueId] ?? 'standard'}
                onDeleted={handleEventDeleted}
              />
            ))
          )}
        </div>
      </AdminGate>
    </SiteShell>
  )
}

