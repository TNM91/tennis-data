'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SiteShell from '@/app/components/site-shell'
import LockedPlanPage from '@/app/components/locked-plan-page'
import { AuthProvider, useAuth } from '@/app/components/auth-provider'
import { buildProductAccessState } from '@/lib/access-model'
import { buildTeamResultCue } from '@/lib/league-result-cues'
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
import { updateTiqLeagueScheduleStatus } from '@/lib/tiq-league-schedule-service'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/captain-formatters'
import {
  formatDynamicPointsForSides,
  getDynamicPointsRulesSummary,
  getDynamicPointsValidationMessage,
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
type TeamResultCompletionFilter = 'all' | 'complete' | 'incomplete'
type TeamResultDateFilter = 'all' | 'week' | 'month'


const pageWrap: CSSProperties = { maxWidth: 1000, margin: '0 auto', padding: '32px 16px', minWidth: 0 }
const heading: CSSProperties = { fontSize: 32, fontWeight: 900, marginBottom: 8, letterSpacing: 0, overflowWrap: 'anywhere' }
const subheading: CSSProperties = { color: '#b8c7dc', fontSize: 15, lineHeight: 1.55, marginBottom: 0, maxWidth: 640, overflowWrap: 'anywhere' }
const introCard: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(13, 31, 55, 0.92), rgba(6, 17, 33, 0.96))',
  border: '1px solid rgba(124, 167, 255, 0.18)',
  borderRadius: 16,
  padding: '24px',
  marginTop: 18,
  marginBottom: 22,
  minWidth: 0,
}
const sectionTitle: CSSProperties = { fontSize: 16, fontWeight: 700, marginBottom: 14, marginTop: 28, overflowWrap: 'anywhere' }
const card: CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  padding: '18px 20px',
  marginBottom: 14,
  minWidth: 0,
}
const row: CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10, minWidth: 0 }
const fieldWrap: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 160px', minWidth: 0 }
const labelStyle: CSSProperties = { fontSize: 11, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.04em', overflowWrap: 'anywhere' }
const inputStyle: CSSProperties = { width: '100%', padding: '8px 11px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#f1f5f9', fontSize: 14, minWidth: 0 }
const selectStyle: CSSProperties = { ...inputStyle }
const scoreHelpStyle: CSSProperties = { color: '#94a3b8', fontSize: 12, lineHeight: 1.4, fontWeight: 600, overflowWrap: 'anywhere' }
const btnPrimary: CSSProperties = { padding: '9px 18px', borderRadius: 8, background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)', color: 'var(--foreground-strong)', fontWeight: 700, fontSize: 14, border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)', cursor: 'pointer', minWidth: 0, maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', textAlign: 'center', boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)' }
const btnDanger: CSSProperties = { padding: '7px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', color: '#f87171', fontWeight: 600, fontSize: 13, border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer', minWidth: 0, maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', textAlign: 'center' }
const btnSecondary: CSSProperties = { padding: '7px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: '#e2e8f0', fontWeight: 600, fontSize: 13, border: '1px solid rgba(255,255,255,0.10)', cursor: 'pointer', minWidth: 0, maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere', textAlign: 'center' }
const msgOk: CSSProperties = { color: '#9be11d', fontSize: 13, marginTop: 6, overflowWrap: 'anywhere' }
const msgErr: CSSProperties = { color: '#f87171', fontSize: 13, marginTop: 6, overflowWrap: 'anywhere' }
const pill: CSSProperties = { display: 'inline-block', padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', fontSize: 12, color: '#94a3b8', maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere' }
const pillGreen: CSSProperties = { ...pill, background: 'rgba(155,225,29,0.12)', color: '#9be11d' }
const eventHeaderCopy: CSSProperties = { minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' }
const eventTitleText: CSSProperties = { fontWeight: 700, fontSize: 15, marginBottom: 4, minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' }
const eventMetaText: CSSProperties = { fontSize: 13, color: '#94a3b8', minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' }
const lineHeaderRow: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8, flexWrap: 'wrap', minWidth: 0 }
const lineTypeRow: CSSProperties = { display: 'flex', gap: 5, flexWrap: 'wrap', minWidth: 0 }
const lineNumberText: CSSProperties = { fontWeight: 700, fontSize: 14, overflowWrap: 'anywhere' }
const linePlayerText: CSSProperties = { fontSize: 13, color: '#cbd5e1', marginBottom: 4, minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' }
const lineScoreText: CSSProperties = { fontSize: 13, color: '#94a3b8', marginBottom: 8, minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' }
const divider: CSSProperties = { borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 14, paddingTop: 14 }
const lineGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 10, marginTop: 12, minWidth: 0 }
const lineCard: CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
  padding: '12px 14px',
  minWidth: 0,
  overflowWrap: 'anywhere',
}
const scorekeeperGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 10, marginTop: 18, minWidth: 0 }
const scorekeeperTile: CSSProperties = {
  padding: '14px 16px',
  borderRadius: 14,
  border: '1px solid rgba(124,167,255,0.14)',
  background: 'rgba(255,255,255,0.055)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}
const tileLabel: CSSProperties = { color: '#93b7ea', fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', overflowWrap: 'anywhere' }
const tileValue: CSSProperties = { color: '#f8fbff', fontSize: 24, fontWeight: 950, marginTop: 5, lineHeight: 1.05, overflowWrap: 'anywhere' }
const tileText: CSSProperties = { color: '#b8c7dc', fontSize: 13, lineHeight: 1.5, marginTop: 6, overflowWrap: 'anywhere' }
const actionRow: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12, minWidth: 0 }
const detailsCard: CSSProperties = { ...card, display: 'grid', gap: 12, minWidth: 0 }
const detailsSummary: CSSProperties = {
  cursor: 'pointer',
  listStyle: 'none',
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  minWidth: 0,
}
const readinessPanel: CSSProperties = {
  display: 'grid',
  gap: 14,
  background: 'rgba(255,255,255,0.045)',
  border: '1px solid rgba(155,225,29,0.14)',
  borderRadius: 16,
  padding: 18,
  marginBottom: 18,
  minWidth: 0,
}
const readinessKicker: CSSProperties = {
  color: '#93b7ea',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}
const readinessTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: 20,
  lineHeight: 1.16,
  fontWeight: 950,
  marginTop: 5,
  overflowWrap: 'anywhere',
}
const readinessText: CSSProperties = {
  color: '#b8c7dc',
  fontSize: 13,
  lineHeight: 1.55,
  marginTop: 6,
  overflowWrap: 'anywhere',
}
const readinessGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
  gap: 10,
  minWidth: 0,
}
const readinessItem: CSSProperties = {
  display: 'grid',
  gap: 8,
  minHeight: 86,
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  minWidth: 0,
}
const readinessItemComplete: CSSProperties = {
  ...readinessItem,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(155,225,29,0.08)',
}
const readinessItemText: CSSProperties = {
  color: '#e2e8f0',
  fontSize: 13,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
}

function Field({ label: lbl, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={fieldWrap}>
      <span style={labelStyle}>{lbl}</span>
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
      <option value="">{placeholder ?? 'Select player...'}</option>
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

    if (scoringSystem === 'dynamic_points') {
      const dynamicPointsWarning = getDynamicPointsValidationMessage(form.score, form.winnerSide || null)
      if (dynamicPointsWarning) return dynamicPointsWarning
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
      <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>
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
        <Field label={`SIDE A - ${event.teamAName} - P1`}>
          <PlayerSelect
            value={form.sideAPlayer1Id}
            onChange={(v) => setForm((f) => ({ ...f, sideAPlayer1Id: v }))}
            players={players}
            excludedPlayerIds={activePlayerIds}
          />
        </Field>
        {isDoubles && (
          <Field label="SIDE A - P2">
            <PlayerSelect
              value={form.sideAPlayer2Id}
              onChange={(v) => setForm((f) => ({ ...f, sideAPlayer2Id: v }))}
              players={players}
              excludedPlayerIds={activePlayerIds}
            />
          </Field>
        )}
      </div>

      <div style={row}>
        <Field label={`SIDE B - ${event.teamBName} - P1`}>
          <PlayerSelect
            value={form.sideBPlayer1Id}
            onChange={(v) => setForm((f) => ({ ...f, sideBPlayer1Id: v }))}
            players={players}
            excludedPlayerIds={activePlayerIds}
          />
        </Field>
        {isDoubles && (
          <Field label="SIDE B - P2">
            <PlayerSelect
              value={form.sideBPlayer2Id}
              onChange={(v) => setForm((f) => ({ ...f, sideBPlayer2Id: v }))}
              players={players}
              excludedPlayerIds={activePlayerIds}
            />
          </Field>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', minWidth: 0 }}>
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
  canEditResults,
  startLineEntry = false,
  lineSummary,
  scoringSystem,
  onDeleted,
}: {
  event: TiqTeamMatchEventRecord
  players: PlayerOption[]
  canEditResults: boolean
  startLineEntry?: boolean
  lineSummary?: MatchLineSummary
  scoringSystem: TiqLeagueScoringSystem
  onDeleted: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(startLineEntry)
  const [lines, setLines] = useState<TiqTeamMatchLineRecord[]>([])
  const [linesLoaded, setLinesLoaded] = useState(false)
  const [addingLine, setAddingLine] = useState(startLineEntry)
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

  useEffect(() => {
    if (!startLineEntry || linesLoaded) return

    const timeoutId = window.setTimeout(() => {
      void loadLines()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [linesLoaded, loadLines, startLineEntry])

  async function handleDeleteEvent() {
    if (!confirm(`Delete "${event.teamAName} vs ${event.teamBName}" on ${formatDate(event.matchDate)}? This cannot be undone.`)) return
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

  function nextOpenLineNumberForLines(matchLines: TiqTeamMatchLineRecord[]) {
    const usedLines = new Set(matchLines.map((line) => line.lineNumber))
    for (let lineNumber = 1; lineNumber <= 20; lineNumber += 1) {
      if (!usedLines.has(lineNumber)) return String(lineNumber)
    }
    return ''
  }

  function handleLineSaved(line: TiqTeamMatchLineRecord, keepAddingLine = false) {
    const idx = lines.findIndex((l) => l.lineNumber === line.lineNumber)
    const nextLines = idx >= 0
      ? lines.map((item, itemIndex) => (itemIndex === idx ? line : item))
      : [...lines, line].sort((a, b) => a.lineNumber - b.lineNumber)

    setLines(nextLines)
    setAddingLine(keepAddingLine && Boolean(nextOpenLineNumberForLines(nextLines)))
    setEditingLine(null)
  }

  function nextOpenLineNumber() {
    return nextOpenLineNumberForLines(lines)
  }

  const teamAWins = lines.filter((l) => l.winnerSide === 'A').length
  const teamBWins = lines.filter((l) => l.winnerSide === 'B').length
  const completedLines = teamAWins + teamBWins
  const displayTotalLines = linesLoaded ? lines.length : lineSummary?.total ?? 0
  const displayCompletedLines = linesLoaded ? completedLines : lineSummary?.completed ?? 0
  const displayPendingLines = Math.max(displayTotalLines - displayCompletedLines, 0)
  const displayTeamAWins = linesLoaded ? teamAWins : lineSummary?.teamAWins ?? 0
  const displayTeamBWins = linesLoaded ? teamBWins : lineSummary?.teamBWins ?? 0
  const showDynamicPoints = scoringSystem === 'dynamic_points'
  const dynamicPoints = summarizeDynamicPoints(lines)
  const dynamicScoreReviewCount = showDynamicPoints
    ? lines.filter((line) => line.winnerSide && line.score && !formatDynamicPointsForSides(line.score, line.winnerSide)).length
    : 0
  const displayTeamAPoints = linesLoaded ? dynamicPoints.teamAPoints : lineSummary?.teamAPoints ?? 0
  const displayTeamBPoints = linesLoaded ? dynamicPoints.teamBPoints : lineSummary?.teamBPoints ?? 0
  const defaultLineNumber = nextOpenLineNumber()

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
        <div style={eventHeaderCopy}>
          <div style={eventTitleText}>
            {event.teamAName} <span style={{ color: '#64748b' }}>vs</span> {event.teamBName}
          </div>
          <div style={eventMetaText}>
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
                  {dynamicScoreReviewCount > 0 ? (
                    <>
                      {' '}
                      <span style={pill}>{dynamicScoreReviewCount} score review</span>
                    </>
                  ) : null}
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <button style={btnSecondary} onClick={handleExpand}>
            {expanded ? 'Collapse' : `Lines${displayTotalLines ? ` (${displayTotalLines})` : ''}`}
          </button>
          {canEditResults ? (
            <button style={btnDanger} onClick={handleDeleteEvent} disabled={deleting}>
              {deleting ? '...' : 'Delete'}
            </button>
          ) : null}
        </div>
      </div>

      {warning ? <p style={msgErr}>{warning}</p> : null}

      {expanded && (
        <div style={divider}>
          {showDynamicPoints && (
            <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.45, marginBottom: 12, overflowWrap: 'anywhere' }}>
              {getDynamicPointsRulesSummary()}
            </div>
          )}
          {!linesLoaded ? (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>Loading...</p>
          ) : lines.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>No lines yet.</p>
          ) : (
            <div style={lineGrid}>
              {lines.map((line) =>
                canEditResults && editingLine?.id === line.id ? (
                  <LineForm
                    key={line.id}
                    event={event}
                    players={players}
                    scoringSystem={scoringSystem}
                    existingLine={line}
                    onSaved={(savedLine) => handleLineSaved(savedLine)}
                    onCancel={() => setEditingLine(null)}
                  />
                ) : (
                  <div key={line.id} style={lineCard}>
                    <div style={lineHeaderRow}>
                      <span style={lineNumberText}>Line {line.lineNumber}</span>
                      <div style={lineTypeRow}>
                        <span style={line.matchType === 'doubles' ? pillGreen : pill}>{line.matchType}</span>
                        {line.winnerSide ? (
                          <span style={pillGreen}>{line.winnerSide === 'A' ? event.teamAName : event.teamBName} won</span>
                        ) : (
                          <span style={pill}>Pending</span>
                        )}
                      </div>
                    </div>
                    <div style={linePlayerText}>
                      <div>A: {line.sideAPlayer1Name}{line.sideAPlayer2Name ? ` / ${line.sideAPlayer2Name}` : ''}</div>
                      <div>B: {line.sideBPlayer1Name}{line.sideBPlayer2Name ? ` / ${line.sideBPlayer2Name}` : ''}</div>
                    </div>
                    {line.score && <div style={lineScoreText}>{line.score}</div>}
                    {showDynamicPoints && line.winnerSide && line.score && (
                      <DynamicPointsLine line={line} />
                    )}
                    {canEditResults ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
                        <button style={btnSecondary} onClick={() => setEditingLine(line)}>Edit</button>
                        <button style={btnDanger} onClick={() => handleDeleteLine(line.id)}>Delete</button>
                      </div>
                    ) : null}
                  </div>
                )
              )}
            </div>
          )}

          {canEditResults && !addingLine && !editingLine && defaultLineNumber && (
            <button style={{ ...btnSecondary, marginTop: 12 }} onClick={() => setAddingLine(true)}>
              + Add line {defaultLineNumber}
            </button>
          )}

          {canEditResults && !addingLine && !editingLine && !defaultLineNumber && (
            <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 12 }}>All 20 line slots are filled.</p>
          )}

          {!canEditResults ? (
            <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 12 }}>
              Coordinator result entry is not active for this account.
            </p>
          ) : null}

          {canEditResults && addingLine && (
            <div style={{ marginTop: 12 }}>
              <LineForm
                key={`add-line-${defaultLineNumber || lines.length}`}
                event={event}
                players={players}
                scoringSystem={scoringSystem}
                defaultLineNumber={defaultLineNumber}
                onSaved={(savedLine) => handleLineSaved(savedLine, true)}
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
  scheduleItemId: string
  leagueId: string
  teamAName: string
  teamBName: string
  matchDate: string
  facility: string
  notes: string
}

const emptyEvent = (): EventFormState => ({
  scheduleItemId: '',
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

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

function slugText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function exportDateValue(value: string) {
  const parsed = value ? new Date(value) : null
  if (!parsed || Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

function resultDateIsWithinDays(value: string, days: number) {
  const parsed = value ? new Date(value).getTime() : 0
  if (!parsed) return false

  return parsed >= Date.now() - days * 24 * 60 * 60 * 1000
}

function buildCurrentLoginNextHref(fallbackHref: string) {
  if (typeof window === 'undefined') return fallbackHref
  const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`
  return currentHref || fallbackHref
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

function defaultEventForLeague(
  leagues: TiqLeagueRecord[],
  leagueId: string,
  defaults?: Partial<EventFormState>,
): EventFormState {
  const league = leagues.find((item) => item.id === leagueId)
  const teamOptions = teamOptionsForLeague(league)

  return {
    ...emptyEvent(),
    leagueId,
    scheduleItemId: defaults?.scheduleItemId || '',
    teamAName: defaults?.teamAName || league?.captainTeamName || teamOptions[0] || '',
    teamBName: defaults?.teamBName || '',
    matchDate: defaults?.matchDate || todayInputValue(),
    facility: defaults?.facility || '',
    notes: defaults?.notes || '',
  }
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
  defaultLeagueId,
  scheduledDefaults,
  onCreated,
}: {
  leagues: TiqLeagueRecord[]
  defaultLeagueId: string
  scheduledDefaults?: Partial<EventFormState>
  onCreated: (event: TiqTeamMatchEventRecord) => void
}) {
  const [form, setForm] = useState<EventFormState>(() =>
    defaultEventForLeague(leagues, scheduledDefaults?.leagueId || defaultLeagueId, scheduledDefaults),
  )
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
      setWarning('League, both team names, and date are required.')
      return
    }
    setSaving(true)
    setWarning('')
    setMessage('')
    const { event, warning: w } = await saveTiqTeamMatchEvent({
      leagueId: form.leagueId,
      scheduleItemId: form.scheduleItemId || null,
      teamAName: form.teamAName,
      teamBName: form.teamBName,
      matchDate: form.matchDate,
      facility: form.facility || null,
      notes: form.notes || null,
    })
    const scheduleCompletion =
      event && form.scheduleItemId
        ? await updateTiqLeagueScheduleStatus({
            scheduleItemId: form.scheduleItemId,
            status: 'completed',
          })
        : null
    setSaving(false)
    if (w || scheduleCompletion?.warning) setWarning(w || scheduleCompletion?.warning || '')
    if (event) {
      setMessage(
        scheduleCompletion
          ? 'Match created and schedule marked complete. Expand below to add lines.'
          : 'Match created. Expand below to add lines.',
      )
      setForm(defaultEventForLeague(leagues, defaultLeagueId))
      onCreated(event)
    }
  }

  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>New team match</div>

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
        <Field label="DATE">
          <input style={inputStyle} type="date" value={form.matchDate} onChange={(e) => setForm((f) => ({ ...f, matchDate: e.target.value }))} />
        </Field>
      </div>

      <div style={row}>
        <Field label="YOUR TEAM (SIDE A)">
          <input
            style={inputStyle}
            list="tiq-match-team-options"
            placeholder={teamOptions.length ? 'Choose or type team name' : 'Your team name'}
            value={form.teamAName}
            onChange={(e) => setForm((f) => ({ ...f, teamAName: e.target.value }))}
          />
        </Field>
        <Field label="OPPONENT TEAM (SIDE B)">
          <input
            style={inputStyle}
            list="tiq-match-team-options"
            placeholder={teamOptions.length ? 'Choose or type opponent' : 'Opponent team name'}
            value={form.teamBName}
            onChange={(e) => setForm((f) => ({ ...f, teamBName: e.target.value }))}
          />
        </Field>
      </div>
      <datalist id="tiq-match-team-options">
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


type TeamLeagueResultsWorkspaceProps = {
  activeRoute?: string
  loginNextHref?: string
  resultsHref?: string
}

export function TeamLeagueResultsWorkspace(props: TeamLeagueResultsWorkspaceProps) {
  return (
    <AuthProvider>
      <TeamLeagueResultsWorkspaceInner {...props} />
    </AuthProvider>
  )
}

function TeamLeagueResultsWorkspaceInner({
  activeRoute = '/league-coordinator',
  loginNextHref = '/league-coordinator/results',
  resultsHref = '/league-coordinator/results',
}: TeamLeagueResultsWorkspaceProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { role, userId, entitlements, authResolved } = useAuth()
  const initialLeagueId = searchParams.get('leagueId') || searchParams.get('league_id') || ''
  const scheduledEventItemId = searchParams.get('scheduleItemId') || searchParams.get('schedule_item_id') || ''
  const scheduledTeamA = searchParams.get('teamA') || searchParams.get('team_a') || ''
  const scheduledTeamB = searchParams.get('teamB') || searchParams.get('team_b') || ''
  const scheduledMatchDate = searchParams.get('matchDate') || searchParams.get('match_date') || ''
  const scheduledFacility = searchParams.get('facility') || ''
  const scheduledNotes = searchParams.get('notes') || ''

  const [leagues, setLeagues] = useState<TiqLeagueRecord[]>([])
  const [events, setEvents] = useState<TiqTeamMatchEventRecord[]>([])
  const [lineSummaries, setLineSummaries] = useState<Map<string, MatchLineSummary>>(new Map())
  const [players, setPlayers] = useState<PlayerOption[]>([])
  const [filterLeagueId, setFilterLeagueId] = useState(initialLeagueId)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [resultSearch, setResultSearch] = useState('')
  const [completionFilter, setCompletionFilter] = useState<TeamResultCompletionFilter>('all')
  const [dateFilter, setDateFilter] = useState<TeamResultDateFilter>('all')
  const [newMatchFormOpen, setNewMatchFormOpen] = useState(false)
  const [activeEntryEventId, setActiveEntryEventId] = useState('')
  const access = useMemo(() => buildProductAccessState(role, entitlements), [entitlements, role])
  const canEditResults = access.canEnterTiqTeamLeague
  const accessResolved = authResolved && Boolean(userId)
  const selectedFilterLeague = useMemo(
    () => leagues.find((league) => league.id === filterLeagueId) || null,
    [filterLeagueId, leagues],
  )
  const latestEvent = useMemo(
    () =>
      [...events].sort(
        (a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime(),
      )[0],
    [events],
  )
  const normalizedResultSearch = resultSearch.trim().toLowerCase()
  const visibleEvents = useMemo(() => {
    return events.filter((event) => {
      const summary = lineSummaries.get(event.id)
      const isComplete = Boolean(summary && summary.total > 0 && summary.completed === summary.total)
      if (completionFilter === 'complete' && !isComplete) return false
      if (completionFilter === 'incomplete' && isComplete) return false
      if (dateFilter === 'week' && !resultDateIsWithinDays(event.matchDate, 7)) return false
      if (dateFilter === 'month' && !resultDateIsWithinDays(event.matchDate, 30)) return false

      if (!normalizedResultSearch) return true

      const league = leagues.find((item) => item.id === event.leagueId)
      const haystack = [
        event.teamAName,
        event.teamBName,
        event.facility,
        event.notes,
        event.winnerTeamName,
        league?.leagueName,
        formatDate(event.matchDate),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedResultSearch)
    })
  }, [completionFilter, dateFilter, events, leagues, lineSummaries, normalizedResultSearch])
  const activeReviewFilterCount =
    (filterLeagueId ? 1 : 0) +
    (normalizedResultSearch ? 1 : 0) +
    (completionFilter !== 'all' ? 1 : 0) +
    (dateFilter !== 'all' ? 1 : 0)
  const completeEventCount = events.filter((event) => {
    const summary = lineSummaries.get(event.id)
    return Boolean(summary && summary.total > 0 && summary.completed === summary.total)
  }).length
  const totalLineCount = Array.from(lineSummaries.values()).reduce((sum, summary) => sum + summary.total, 0)
  const completedLineCount = Array.from(lineSummaries.values()).reduce((sum, summary) => sum + summary.completed, 0)
  const teamResultCue = buildTeamResultCue({
    leagueCount: leagues.length,
    selectedLeagueName: selectedFilterLeague?.leagueName,
    teamCount: selectedFilterLeague
      ? selectedFilterLeague.teams.length
      : Math.max(...leagues.map((league) => league.teams.length), 0),
    matchCount: events.length,
    completeMatchCount: completeEventCount,
    completedLineCount,
    totalLineCount,
  })
  const scheduledEventDefaults = useMemo<Partial<EventFormState>>(
    () => ({
      scheduleItemId: scheduledEventItemId,
      leagueId: initialLeagueId,
      teamAName: scheduledTeamA,
      teamBName: scheduledTeamB,
      matchDate: scheduledMatchDate,
      facility: scheduledFacility,
      notes: scheduledNotes,
    }),
    [
      initialLeagueId,
      scheduledEventItemId,
      scheduledFacility,
      scheduledMatchDate,
      scheduledNotes,
      scheduledTeamA,
      scheduledTeamB,
    ],
  )

  useEffect(() => {
    if (!authResolved) return

    if (!userId) {
      router.replace(`/login?next=${encodeURIComponent(buildCurrentLoginNextHref(loginNextHref))}`)
    }
  }, [authResolved, loginNextHref, router, userId])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    const [leaguesResult, playersResult] = await Promise.all([
      listTiqLeagues(),
      supabase.from('players').select('id, name').order('name', { ascending: true }),
    ])
    const teamLeagues = leaguesResult.records.filter((league) => league.leagueFormat === 'team')
    const requestedTeamLeagueId = teamLeagues.some((league) => league.id === initialLeagueId)
      ? initialLeagueId
      : ''

    if (leaguesResult.warning) setError(leaguesResult.warning)
    if (playersResult.error) setError(playersResult.error.message)

    setLeagues(teamLeagues)
    setFilterLeagueId(requestedTeamLeagueId)
    setPlayers((playersResult.data || []) as PlayerOption[])

    const { events: evts, warning } = await listTiqTeamMatchEvents({ leagueId: requestedTeamLeagueId || null })
    if (warning) setError(warning)
    setEvents(evts)
    setLineSummaries(await loadLineSummaries(evts))
    setLoading(false)
  }, [initialLeagueId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadData])

  async function handleFilterChange(leagueId: string) {
    setFilterLeagueId(leagueId)
    const nextHref = leagueId
      ? `${resultsHref}?leagueId=${encodeURIComponent(leagueId)}`
      : resultsHref
    router.replace(nextHref, { scroll: false })
    setLoading(true)
    setError('')
    const { events: evts, warning } = await listTiqTeamMatchEvents({ leagueId: leagueId || null })
    if (warning) setError(warning)
    setEvents(evts)
    setLineSummaries(await loadLineSummaries(evts))
    setLoading(false)
  }

  function teamResultExportRows() {
    return visibleEvents.map((event) => {
      const league = leagues.find((item) => item.id === event.leagueId)
      const summary = lineSummaries.get(event.id)
      const scoringSystem = league?.scoringSystem ?? 'standard'

      return {
        league: league?.leagueName || '',
        date: exportDateValue(event.matchDate),
        teamA: event.teamAName,
        teamB: event.teamBName,
        facility: event.facility,
        lines: summary?.total ?? 0,
        completed: summary?.completed ?? 0,
        teamAWins: summary?.teamAWins ?? 0,
        teamBWins: summary?.teamBWins ?? 0,
        teamAPoints: scoringSystem === 'dynamic_points' ? summary?.teamAPoints ?? 0 : '',
        teamBPoints: scoringSystem === 'dynamic_points' ? summary?.teamBPoints ?? 0 : '',
        winner: event.winnerTeamName,
        notes: event.notes,
      }
    })
  }

  function handleExportResults() {
    if (visibleEvents.length === 0) {
      setStatus('There are no team results to export.')
      return
    }

    const header = [
      'League',
      'Date',
      'Team A',
      'Team B',
      'Facility',
      'Lines',
      'Completed',
      'Team A Line Wins',
      'Team B Line Wins',
      'Team A Points',
      'Team B Points',
      'Winner',
      'Notes',
    ]
    const csv = [
      header.map(csvCell).join(','),
      ...teamResultExportRows().map((row) =>
        [
          row.league,
          row.date,
          row.teamA,
          row.teamB,
          row.facility,
          row.lines,
          row.completed,
          row.teamAWins,
          row.teamBWins,
          row.teamAPoints,
          row.teamBPoints,
          row.winner,
          row.notes,
        ].map(csvCell).join(','),
      ),
    ].join('\r\n')

    const selectedLeagueName = filterLeagueId
      ? leagues.find((league) => league.id === filterLeagueId)?.leagueName || 'team-results'
      : 'team-results'
    const filename = `tenaceiq-${slugText(selectedLeagueName) || 'team-results'}-${new Date().toISOString().slice(0, 10)}.csv`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.append(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
    setStatus(`Exported ${visibleEvents.length} team match${visibleEvents.length === 1 ? '' : 'es'}.`)
  }

  async function handleCopyResultSummary() {
    if (visibleEvents.length === 0) {
      setStatus('There are no team results to copy.')
      return
    }

    const selectedLeagueName = filterLeagueId
      ? leagues.find((league) => league.id === filterLeagueId)?.leagueName || 'Filtered team results'
      : 'Filtered team results'
    const lines = [
      `${selectedLeagueName}: ${visibleEvents.length} team match${visibleEvents.length === 1 ? '' : 'es'}`,
      ...teamResultExportRows().map((row) => {
        const score = `${row.teamA} ${row.teamAWins}, ${row.teamB} ${row.teamBWins}`
        const details = [
          row.date,
          `${row.completed}/${row.lines} lines complete`,
          row.teamAPoints !== '' || row.teamBPoints !== '' ? `points ${row.teamAPoints}-${row.teamBPoints}` : null,
        ].filter(Boolean).join(' - ')
        return `${score}${details ? ` (${details})` : ''}`
      }),
    ]

    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setStatus(`Copied ${visibleEvents.length} team match${visibleEvents.length === 1 ? '' : 'es'} to clipboard.`)
    } catch {
      setStatus('Clipboard access was blocked by the browser.')
    }
  }

  async function handleClearReviewFilters() {
    setResultSearch('')
    setCompletionFilter('all')
    setDateFilter('all')
    if (filterLeagueId) {
      await handleFilterChange('')
    }
  }

  function handleOpenTeamMatchEntry() {
    setNewMatchFormOpen(true)
    window.requestAnimationFrame(() => {
      document.getElementById('team-match-entry')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }

  function handleReviewTeamMatches() {
    setCompletionFilter('incomplete')
    window.requestAnimationFrame(() => {
      document.getElementById('team-match-review')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }

  if (!accessResolved) {
    return (
      <SiteShell active={activeRoute}>
        <div style={pageWrap}>
          <div style={card}>Checking Coordinator access...</div>
        </div>
      </SiteShell>
    )
  }

  if (accessResolved && !canEditResults) {
    return (
      <LockedPlanPage
        active={activeRoute}
        planId="league"
        headline="Need to record TIQ team results?"
        body="Unlock TIQ League Coordinator to enter team match results, manage season structure, and keep standings out of spreadsheets."
        ctaLabel="Unlock League"
        secondaryLabel="Back to League"
        secondaryHref="/league-coordinator"
      />
    )
  }

  return (
    <SiteShell active={activeRoute}>
      <div style={pageWrap}>
        <div style={introCard}>
          <div style={heading}>Record league results fast.</div>
          <div style={subheading}>Create the team match, enter each line, and keep TIQ ratings, standings, and history current.</div>
          <div style={scorekeeperGrid}>
            <div style={scorekeeperTile}>
              <div style={tileLabel}>Leagues</div>
              <div style={tileValue}>{leagues.length}</div>
              <div style={tileText}>Available result groups</div>
            </div>
            <div style={scorekeeperTile}>
              <div style={tileLabel}>Matches</div>
              <div style={tileValue}>{visibleEvents.length}</div>
              <div style={tileText}>
                {activeReviewFilterCount ? `${events.length} total in scope` : 'All recorded events'}
              </div>
            </div>
            <div style={scorekeeperTile}>
              <div style={tileLabel}>Latest</div>
              <div style={tileValue}>{latestEvent ? formatDate(latestEvent.matchDate) : '-'}</div>
              <div style={tileText}>{latestEvent ? `${latestEvent.teamAName} vs ${latestEvent.teamBName}` : 'No result yet'}</div>
            </div>
          </div>
        </div>

        <section style={readinessPanel}>
          <div>
            <div style={readinessKicker}>Result entry readiness</div>
            <div style={readinessTitle}>{teamResultCue.title}</div>
            <div style={readinessText}>{teamResultCue.detail}</div>
            <div style={actionRow}>
              {canEditResults ? (
                <button
                  type="button"
                  style={btnPrimary}
                  onClick={events.length > 0 ? handleReviewTeamMatches : handleOpenTeamMatchEntry}
                  disabled={leagues.length === 0}
                >
                  {events.length > 0 ? 'Review matches' : 'Create match'}
                </button>
              ) : null}
              {selectedFilterLeague ? (
                <Link href={`/explore/leagues/tiq/${encodeURIComponent(selectedFilterLeague.id)}?league_id=${encodeURIComponent(selectedFilterLeague.id)}`} style={btnSecondary}>
                  View league
                </Link>
              ) : (
                <Link href="/league-coordinator#league-setup-form" style={btnSecondary}>
                  Set up league
                </Link>
              )}
            </div>
          </div>
          <div style={readinessGrid}>
            {teamResultCue.items.map((item) => (
              <div key={item.label} style={item.complete ? readinessItemComplete : readinessItem}>
                <span style={item.complete ? pillGreen : pill}>{item.label}</span>
                <strong style={readinessItemText}>{item.detail}</strong>
              </div>
            ))}
          </div>
        </section>

        {error ? <p style={msgErr}>{error}</p> : null}
        {status ? <p style={status.startsWith('Exported') || status.startsWith('Copied') ? msgOk : msgErr}>{status}</p> : null}
        <details
          id="team-match-entry"
          style={detailsCard}
          open={canEditResults && (events.length === 0 || newMatchFormOpen || Boolean(scheduledEventItemId))}
          onToggle={(event) => setNewMatchFormOpen(event.currentTarget.open)}
        >
          <summary style={detailsSummary}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>New match</div>
              <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
                {canEditResults ? 'Open only when you need to record another result.' : 'Result entry unlocks with team-league Coordinator access.'}
              </div>
            </div>
            <span style={canEditResults ? pillGreen : pill}>Add result</span>
          </summary>
          {canEditResults ? (
            <NewEventForm
              key={`${filterLeagueId || 'all-leagues'}::${scheduledEventItemId || 'manual'}`}
              leagues={leagues}
              defaultLeagueId={filterLeagueId}
              scheduledDefaults={scheduledEventDefaults}
              onCreated={(event) => {
                setActiveEntryEventId(event.id)
                setLineSummaries((prev) => new Map(prev).set(event.id, { total: 0, completed: 0, teamAWins: 0, teamBWins: 0, teamAPoints: 0, teamBPoints: 0 }))
                setEvents((prev) => [event, ...prev])
              }}
            />
          ) : null}
        </details>

        <div id="team-match-review" style={sectionTitle}>Recorded matches</div>

        <div style={{ ...row, marginBottom: 14 }}>
          <input
            style={{ ...inputStyle, maxWidth: 260 }}
            value={resultSearch}
            onChange={(event) => setResultSearch(event.target.value)}
            placeholder="Team, facility, note..."
          />
          <select
            style={{ ...selectStyle, maxWidth: 260 }}
            value={filterLeagueId}
            onChange={(e) => void handleFilterChange(e.target.value)}
          >
            <option value="">All leagues</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>{l.leagueName}</option>
            ))}
          </select>
          <select
            style={{ ...selectStyle, maxWidth: 180 }}
            value={completionFilter}
            onChange={(event) => setCompletionFilter(event.target.value as TeamResultCompletionFilter)}
          >
            <option value="all">All statuses</option>
            <option value="complete">Complete only</option>
            <option value="incomplete">Needs lines</option>
          </select>
          <select
            style={{ ...selectStyle, maxWidth: 180 }}
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value as TeamResultDateFilter)}
          >
            <option value="all">Any date</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
          </select>
          <button type="button" style={btnSecondary} onClick={() => void handleClearReviewFilters()}>
            Clear
          </button>
          <button
            type="button"
            style={{ ...btnSecondary, ...(visibleEvents.length === 0 ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
            onClick={handleExportResults}
            disabled={visibleEvents.length === 0}
          >
            Export CSV
          </button>
          <button
            type="button"
            style={{ ...btnSecondary, ...(visibleEvents.length === 0 ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
            onClick={() => void handleCopyResultSummary()}
            disabled={visibleEvents.length === 0}
          >
            Copy Summary
          </button>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>
            Showing {visibleEvents.length} of {events.length} team match{events.length === 1 ? '' : 'es'}.
          </span>
        </div>

        {loading ? (
          <p style={{ color: '#94a3b8' }}>Loading...</p>
        ) : events.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>No events yet. Create one above.</p>
        ) : visibleEvents.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>No team matches match the current review filters.</p>
        ) : (
          visibleEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              players={players}
              canEditResults={canEditResults}
              startLineEntry={event.id === activeEntryEventId}
              lineSummary={lineSummaries.get(event.id)}
              scoringSystem={leagues.find((league) => league.id === event.leagueId)?.scoringSystem ?? 'standard'}
              onDeleted={(id) => setEvents((prev) => prev.filter((e) => e.id !== id))}
            />
          ))
        )}
      </div>
    </SiteShell>
  )
}


