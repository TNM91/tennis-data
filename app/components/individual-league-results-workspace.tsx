'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SiteShell from '@/app/components/site-shell'
import LockedPlanPage from '@/app/components/locked-plan-page'
import LeagueSuitePanel from '@/app/components/league-suite-panel'
import { AuthProvider, useAuth } from '@/app/components/auth-provider'
import { buildProductAccessState } from '@/lib/access-model'
import { buildIndividualResultCue } from '@/lib/league-result-cues'
import {
  getTiqLeagueById,
  listTiqLeagues,
  listTiqPlayerLeagueEntries,
  type TiqPlayerLeagueEntryRecord,
} from '@/lib/tiq-league-service'
import type { TiqLeagueRecord } from '@/lib/tiq-league-registry'
import {
  deleteTiqIndividualLeagueResult,
  listTiqIndividualLeagueResults,
  saveTiqIndividualLeagueResult,
  type TiqIndividualLeagueResultRecord,
  type TiqLeagueStorageSource as TiqResultStorageSource,
} from '@/lib/tiq-individual-results-service'
import { updateTiqLeagueScheduleStatus } from '@/lib/tiq-league-schedule-service'
import { buildTiqIndividualLeagueSummaries } from '@/lib/tiq-individual-results-summary'
import { completeTiqIndividualSuggestionsForPair } from '@/lib/tiq-individual-suggestions-service'
import {
  getTiqIndividualCompetitionFormatExperience,
  getTiqIndividualCompetitionFormatLabel,
} from '@/lib/tiq-individual-format'
import { validateTiqTennisMatchScore } from '@/lib/tiq-scoring'
import { formatDate } from '@/lib/captain-formatters'

type ResultParticipantOption = {
  value: string
  playerId: string
  playerName: string
}

type PlayerResultStanding = {
  rank: number
  playerId: string
  playerName: string
  wins: number
  losses: number
  matches: number
  recentForm: Array<'W' | 'L'>
  uniqueOpponents: number
  possibleOpponents: number
  completionRate: number | null
}

type ResultReviewFilter = 'all' | 'edited' | 'clean'
type ResultDateFilter = 'all' | 'week' | 'month'

const dataAssistIndividualResultsHref = '/data-assist?intent=upload-source&context=Individual%20league%20results'

const emptyIndividualResultActions = [
  { href: '#player-result-entry', label: 'Log player result' },
  { href: '/league-coordinator#league-setup-form', label: 'Set up league' },
  { href: dataAssistIndividualResultsHref, label: 'Upload scorecard' },
] as const

const pageWrap: CSSProperties = {
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '0 auto',
  padding: '18px 0 64px',
  display: 'grid',
  gap: 18,
  minWidth: 0,
  overflowX: 'clip',
  boxSizing: 'border-box',
}
const heading: CSSProperties = { color: 'var(--foreground-strong)', fontSize: 32, fontWeight: 900, margin: 0, marginBottom: 8, letterSpacing: 0, overflowWrap: 'anywhere' }
const subheading: CSSProperties = { color: 'var(--shell-copy-muted)', fontSize: 15, lineHeight: 1.55, marginBottom: 0, maxWidth: 700, overflowWrap: 'anywhere' }
const introCard: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(8,13,30,0.96), rgba(4,10,24,0.9))',
  border: '1px solid rgba(116,190,255,0.15)',
  borderRadius: 28,
  padding: 24,
  boxShadow: '0 26px 78px rgba(2, 8, 23, 0.42), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
  position: 'relative',
  overflow: 'hidden',
}
const portalWatermarkStyle: CSSProperties = {
  position: 'absolute',
  right: '-72px',
  top: '-88px',
  width: 260,
  aspectRatio: '1 / 1',
  borderRadius: 999,
  border: '28px solid rgba(155,225,29,0.07)',
  boxShadow: 'inset 0 0 0 2px rgba(125,211,252,0.05), 0 0 70px rgba(125,211,252,0.08)',
  opacity: 0.72,
  pointerEvents: 'none',
}
const portalPanelContentStyle: CSSProperties = { position: 'relative', zIndex: 1, minWidth: 0 }
const card: CSSProperties = {
  background: 'rgba(8, 16, 34, 0.74)',
  border: '1px solid rgba(125,211,252,0.13)',
  borderRadius: 18,
  padding: '18px 20px',
  marginBottom: 14,
  minWidth: 0,
  boxShadow: '0 18px 48px rgba(2,10,24,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
}
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
const sectionTitle: CSSProperties = { color: 'var(--foreground-strong)', fontSize: 16, fontWeight: 800, marginBottom: 14, marginTop: 28, overflowWrap: 'anywhere' }
const row: CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10, minWidth: 0 }
const fieldWrap: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 190px', minWidth: 0 }
const labelStyle: CSSProperties = { fontSize: 11, color: 'var(--shell-copy-muted)', fontWeight: 700, letterSpacing: 0, textTransform: 'uppercase', overflowWrap: 'anywhere' }
const inputStyle: CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: 14,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(8, 16, 34, 0.78)',
  color: 'var(--foreground-strong)',
  fontSize: 14,
  minWidth: 0,
}
const scoreHelpStyle: CSSProperties = { color: 'var(--shell-copy-muted)', fontSize: 12, lineHeight: 1.4, fontWeight: 600, overflowWrap: 'anywhere' }
const textareaStyle: CSSProperties = { ...inputStyle, minHeight: 82, resize: 'vertical' }
const btnPrimary: CSSProperties = {
  padding: '9px 18px',
  borderRadius: 999,
  background: 'linear-gradient(135deg, rgba(155,225,29,0.28), rgba(125,211,252,0.14))',
  color: 'var(--foreground-strong)',
  fontWeight: 800,
  fontSize: 14,
  border: '1px solid rgba(155,225,29,0.34)',
  cursor: 'pointer',
  whiteSpace: 'normal',
  minWidth: 0,
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  textAlign: 'center',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 24px rgba(2,10,24,0.2)',
}
const btnSecondary: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 999,
  background: 'rgba(8, 16, 34, 0.78)',
  color: 'var(--foreground)',
  fontWeight: 700,
  fontSize: 13,
  border: '1px solid rgba(125,211,252,0.14)',
  cursor: 'pointer',
  textDecoration: 'none',
  minWidth: 0,
  maxWidth: '100%',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
  textAlign: 'center',
}
const btnDanger: CSSProperties = {
  ...btnSecondary,
  background: 'rgba(239,68,68,0.14)',
  color: '#fca5a5',
  border: '1px solid rgba(239,68,68,0.24)',
}
const disabledButton: CSSProperties = { opacity: 0.6, cursor: 'not-allowed' }
const msgOk: CSSProperties = { color: '#9be11d', fontSize: 13, marginTop: 6 }
const msgErr: CSSProperties = { color: '#f87171', fontSize: 13, marginTop: 6 }
const pill: CSSProperties = { display: 'inline-block', padding: '2px 8px', borderRadius: 999, background: 'var(--shell-chip-bg)', fontSize: 12, color: 'var(--shell-copy-muted)', maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere' }
const pillGreen: CSSProperties = { ...pill, background: 'rgba(155,225,29,0.12)', color: '#9be11d' }
const pillAmber: CSSProperties = { ...pill, background: 'rgba(251,191,36,0.13)', color: '#fbbf24' }
const scorekeeperGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: 10, marginTop: 18, minWidth: 0 }
const scorekeeperTile: CSSProperties = {
  padding: '14px 16px',
  borderRadius: 14,
  border: '1px solid rgba(125,211,252,0.13)',
  background: 'rgba(8, 16, 34, 0.72)',
  minWidth: 0,
  overflowWrap: 'anywhere',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}
const tileLabel: CSSProperties = { color: '#93b7ea', fontSize: 11, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', overflowWrap: 'anywhere' }
const tileValue: CSSProperties = { color: '#f8fbff', fontSize: 24, fontWeight: 950, marginTop: 5, lineHeight: 1.05, overflowWrap: 'anywhere' }
const tileText: CSSProperties = { color: '#b8c7dc', fontSize: 13, lineHeight: 1.5, marginTop: 6, overflowWrap: 'anywhere' }
const resultPathStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
  padding: 16,
  borderRadius: 22,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.08), rgba(116,190,255,0.045)), linear-gradient(180deg, rgba(11,25,48,0.9), rgba(6,15,30,0.95))',
  boxShadow: '0 18px 46px rgba(2,10,24,0.22)',
  overflow: 'hidden',
}
const resultPathHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'end',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
}
const resultPathTitle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.35rem, 3vw, 2.1rem)',
  lineHeight: 1.05,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}
const resultPathIntro: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.55,
  maxWidth: 520,
  overflowWrap: 'anywhere',
}
const resultPathCommandStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
  gap: 12,
  minWidth: 0,
}
const resultPathStatusPanelStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
  minHeight: 112,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(180deg, rgba(155,225,29,0.1), rgba(8,18,36,0.86))',
  color: 'var(--shell-copy-muted)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
  overflowWrap: 'anywhere',
}
const resultPathStatusGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))',
  gap: 8,
  minWidth: 0,
}
const resultPathStatusItemStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  minHeight: 78,
  padding: '9px 10px',
  borderRadius: 14,
  border: '1px solid rgba(223,248,194,0.12)',
  background: 'rgba(255,255,255,0.04)',
  color: '#dbeafe',
  fontSize: 12,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
}
const resultPathGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
  gap: 12,
  minWidth: 0,
}
const resultPathCard: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
  minHeight: 112,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(223,248,194,0.13)',
  background: 'linear-gradient(180deg, rgba(18,39,70,0.72), rgba(8,18,36,0.9))',
  color: 'var(--shell-copy-muted)',
  textDecoration: 'none',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
  overflowWrap: 'anywhere',
  textAlign: 'left',
}
const resultPathButton: CSSProperties = {
  ...resultPathCard,
  cursor: 'pointer',
}
const resultPathQuestion: CSSProperties = {
  color: '#93b7ea',
  fontSize: 12,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}
const resultPathCardTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 15,
  lineHeight: 1.2,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}
const resultPathCta: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}
const listWrap: CSSProperties = { display: 'grid', gap: 10, minWidth: 0 }
const resultCard: CSSProperties = {
  ...card,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
  gap: 14,
  alignItems: 'flex-start',
  minWidth: 0,
  overflowWrap: 'anywhere',
}
const resultCopy: CSSProperties = { minWidth: 0 }
const resultTitle: CSSProperties = { color: '#f8fbff', fontSize: 15, fontWeight: 850, marginBottom: 5, overflowWrap: 'anywhere' }
const resultMeta: CSSProperties = { color: '#94a3b8', fontSize: 13, lineHeight: 1.5, overflowWrap: 'anywhere' }
const actionRow: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12, minWidth: 0 }
const resultFollowThroughGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 112px), 1fr))',
  gap: 8,
  marginTop: 10,
  minWidth: 0,
}
const resultFollowThroughItem: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  minHeight: 34,
  minWidth: 0,
  padding: '7px 9px',
  borderRadius: 12,
  border: '1px solid rgba(125,211,252,0.12)',
  background: 'rgba(255,255,255,0.035)',
  color: '#dfeeff',
  fontSize: 12,
  fontWeight: 850,
  overflow: 'hidden',
}
const resultPrimaryAction: CSSProperties = {
  ...btnPrimary,
  minHeight: 34,
  padding: '7px 12px',
  fontSize: 12,
  borderRadius: 12,
  textDecoration: 'none',
}
const readinessDotReady: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: 'var(--brand-lime)',
  boxShadow: '0 0 0 4px rgba(155,225,29,0.10)',
  flex: '0 0 auto',
}
const readinessDotWaiting: CSSProperties = {
  ...readinessDotReady,
  background: 'rgba(116,190,255,0.46)',
  boxShadow: '0 0 0 4px rgba(116,190,255,0.08)',
}
const insightGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
  gap: 14,
  marginTop: 18,
  minWidth: 0,
}
const standingsList: CSSProperties = { display: 'grid', gap: 8, minWidth: 0 }
const standingRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 32px) minmax(0, 1fr) minmax(0, auto)',
  gap: 10,
  alignItems: 'center',
  padding: '10px 12px',
  borderRadius: 10,
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}
const standingRank: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  display: 'grid',
  placeItems: 'center',
  color: 'var(--foreground-strong)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  fontSize: 12,
  fontWeight: 900,
}
const standingName: CSSProperties = { color: '#f8fbff', fontWeight: 850, fontSize: 14, minWidth: 0, overflowWrap: 'anywhere' }
const standingSubtext: CSSProperties = { color: '#94a3b8', fontSize: 12, marginTop: 3, overflowWrap: 'anywhere' }
const standingCopy: CSSProperties = { minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere' }
const metricStack: CSSProperties = { display: 'grid', gap: 5, justifyItems: 'end', color: '#dbeafe', fontSize: 12, fontWeight: 800, minWidth: 0, overflowWrap: 'anywhere' }
const emptyCard: CSSProperties = {
  ...card,
  color: '#94a3b8',
  lineHeight: 1.5,
  overflowWrap: 'anywhere',
}
const emptyResultPanel: CSSProperties = {
  ...card,
  display: 'grid',
  gap: 14,
  color: 'var(--shell-copy-muted)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}
const emptyResultCopy: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
  overflowWrap: 'anywhere',
}
const emptyResultActions: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}
const emptyResultAction: CSSProperties = {
  ...btnSecondary,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  whiteSpace: 'normal',
  textDecoration: 'none',
}
const reviewPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 16,
  borderRadius: 22,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8, 16, 34, 0.68)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
  minWidth: 0,
}
const reviewPanelHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
}
const reviewPanelTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.1,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}
const reviewCommandGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 8,
  minWidth: 0,
}
const reviewCommandItemStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  minHeight: 48,
  padding: '9px 10px',
  borderRadius: 14,
  border: '1px solid rgba(125,211,252,0.12)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  overflow: 'hidden',
}
const reviewCommandCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 2,
  minWidth: 0,
  overflowWrap: 'anywhere',
}
const reviewFilterGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 8,
  alignItems: 'end',
  minWidth: 0,
}
const reviewActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
  justifyContent: 'space-between',
  minWidth: 0,
}
const reviewCountStyle: CSSProperties = {
  color: '#94a3b8',
  fontSize: 13,
  lineHeight: 1.4,
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label style={{ ...fieldWrap, ...(wide ? { flexBasis: '100%' } : {}) }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  )
}

function EmptyIndividualResultsPanel() {
  return (
    <div style={emptyResultPanel}>
      <div style={emptyResultCopy}>
        <strong>Player results start with one finished match.</strong>
        <span>Log the first result, make sure the league has players, or upload a reviewed scorecard so standings can start moving.</span>
      </div>
      <div style={emptyResultActions}>
        {emptyIndividualResultActions.map((action) => (
          <Link key={action.href} href={action.href} style={emptyResultAction}>
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function resultOpponentName(result: TiqIndividualLeagueResultRecord) {
  return result.winnerPlayerName === result.playerAName ? result.playerBName : result.playerAName
}

function buildCurrentLoginNextHref(fallbackHref: string) {
  if (typeof window === 'undefined') return fallbackHref
  const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`
  return currentHref || fallbackHref
}

function participantValue(playerId: string, playerName: string) {
  return playerId || `name:${playerName}`
}

function findParticipantOption(options: ResultParticipantOption[], value: string) {
  const normalizedValue = value.trim()
  if (!normalizedValue) return null

  const normalizedNameValue = normalizedValue.startsWith('name:')
    ? normalizedValue.slice(5).toLowerCase()
    : normalizedValue.toLowerCase()

  return (
    options.find((option) => option.value === normalizedValue) ||
    options.find((option) => option.playerId && option.playerId === normalizedValue) ||
    options.find((option) => option.playerName.toLowerCase() === normalizedNameValue) ||
    null
  )
}

function dateInputValue(value: string) {
  const parsed = value ? new Date(value) : null
  if (!parsed || Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10)
  return parsed.toISOString().slice(0, 10)
}

function isEditedResult(result: TiqIndividualLeagueResultRecord) {
  const createdTime = result.createdAt ? new Date(result.createdAt).getTime() : 0
  const updatedTime = result.updatedAt ? new Date(result.updatedAt).getTime() : 0
  if (!createdTime || !updatedTime) return false

  return updatedTime - createdTime > 1000
}

function formatResultTimestamp(value: string) {
  const parsed = value ? new Date(value) : null
  if (!parsed || Number.isNaN(parsed.getTime())) return ''

  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function resultDateIsWithinDays(value: string, days: number) {
  const parsed = value ? new Date(value).getTime() : 0
  if (!parsed) return false

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return parsed >= cutoff
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

function hasResultBetween(results: TiqIndividualLeagueResultRecord[], leftName: string, rightName: string) {
  const left = leftName.toLowerCase()
  const right = rightName.toLowerCase()

  return results.some((result) => {
    const playerA = result.playerAName.toLowerCase()
    const playerB = result.playerBName.toLowerCase()
    return (playerA === left && playerB === right) || (playerA === right && playerB === left)
  })
}

function buildPlayerResultStandings(
  entries: TiqPlayerLeagueEntryRecord[],
  leagueResults: TiqIndividualLeagueResultRecord[],
): PlayerResultStanding[] {
  const totalEntrants = entries.length

  return entries
    .map((entry) => {
      const normalizedName = entry.playerName.toLowerCase()
      const playerResults = leagueResults.filter((result) => {
        return result.playerAName.toLowerCase() === normalizedName || result.playerBName.toLowerCase() === normalizedName
      })
      const wins = playerResults.filter((result) => result.winnerPlayerName.toLowerCase() === normalizedName).length
      const losses = playerResults.length - wins
      const uniqueOpponents = new Set(
        playerResults.map((result) =>
          result.playerAName.toLowerCase() === normalizedName ? result.playerBName : result.playerAName,
        ),
      ).size
      const possibleOpponents = Math.max(totalEntrants - 1, 0)

      return {
        rank: 0,
        playerId: entry.playerId,
        playerName: entry.playerName,
        wins,
        losses,
        matches: playerResults.length,
        recentForm: playerResults.slice(0, 5).map((result) =>
          result.winnerPlayerName.toLowerCase() === normalizedName ? 'W' : 'L',
        ),
        uniqueOpponents,
        possibleOpponents,
        completionRate: possibleOpponents > 0 ? uniqueOpponents / possibleOpponents : null,
      }
    })
    .sort((left, right) => {
      if (right.wins !== left.wins) return right.wins - left.wins
      if (left.losses !== right.losses) return left.losses - right.losses
      if (right.matches !== left.matches) return right.matches - left.matches
      if (right.uniqueOpponents !== left.uniqueOpponents) return right.uniqueOpponents - left.uniqueOpponents
      return left.playerName.localeCompare(right.playerName)
    })
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
}

function findNextPairing(
  standings: PlayerResultStanding[],
  leagueResults: TiqIndividualLeagueResultRecord[],
): [PlayerResultStanding, PlayerResultStanding] | null {
  if (standings.length < 2) return null

  const byNeed = [...standings].sort((left, right) => {
    if (left.matches !== right.matches) return left.matches - right.matches
    if (left.uniqueOpponents !== right.uniqueOpponents) return left.uniqueOpponents - right.uniqueOpponents
    return left.rank - right.rank
  })

  for (const left of byNeed) {
    const right = standings.find(
      (candidate) =>
        candidate.playerName !== left.playerName &&
        !hasResultBetween(leagueResults, left.playerName, candidate.playerName),
    )
    if (right) return [left, right]
  }

  return [byNeed[0], byNeed[1]]
}

function fallbackEntriesForLeague(league: TiqLeagueRecord | null): TiqPlayerLeagueEntryRecord[] {
  if (!league || league.leagueFormat !== 'individual') return []

  return (league.players || []).map((playerName) => ({
    leagueId: league.id,
    playerName,
    playerId: '',
    playerLocation: '',
    entryStatus: 'active' as const,
  }))
}

type IndividualLeagueResultsWorkspaceProps = {
  activeRoute?: string
  loginNextHref?: string
  resultsHref?: string
}

export function IndividualLeagueResultsWorkspace(props: IndividualLeagueResultsWorkspaceProps) {
  return (
    <AuthProvider>
      <IndividualLeagueResultsWorkspaceInner {...props} />
    </AuthProvider>
  )
}

function IndividualLeagueResultsWorkspaceInner({
  activeRoute = '/league-coordinator',
  loginNextHref = '/league-coordinator/individual-results',
  resultsHref = '/league-coordinator/individual-results',
}: IndividualLeagueResultsWorkspaceProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { role, userId, entitlements, authResolved } = useAuth()
  const initialLeagueId = searchParams.get('leagueId') || searchParams.get('league_id') || ''
  const suggestedResultPlayerA =
    searchParams.get('suggest_player_a') || searchParams.get('playerA') || searchParams.get('player_a') || ''
  const suggestedResultPlayerB =
    searchParams.get('suggest_player_b') || searchParams.get('playerB') || searchParams.get('player_b') || ''
  const scheduledResultItemId = searchParams.get('scheduleItemId') || searchParams.get('schedule_item_id') || ''
  const scheduledResultDate = searchParams.get('resultDate') || searchParams.get('result_date') || ''

  const [leagues, setLeagues] = useState<TiqLeagueRecord[]>([])
  const [results, setResults] = useState<TiqIndividualLeagueResultRecord[]>([])
  const [playerEntries, setPlayerEntries] = useState<TiqPlayerLeagueEntryRecord[]>([])
  const [filterLeagueId, setFilterLeagueId] = useState(initialLeagueId)
  const [formLeagueId, setFormLeagueId] = useState(initialLeagueId)
  const [resultPlayerA, setResultPlayerA] = useState('')
  const [resultPlayerB, setResultPlayerB] = useState('')
  const [resultWinner, setResultWinner] = useState('')
  const [resultScore, setResultScore] = useState('')
  const [resultDate, setResultDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [resultNotes, setResultNotes] = useState('')
  const [editingResultId, setEditingResultId] = useState('')
  const [resultSearch, setResultSearch] = useState('')
  const [resultReviewFilter, setResultReviewFilter] = useState<ResultReviewFilter>('all')
  const [resultDateFilter, setResultDateFilter] = useState<ResultDateFilter>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [resultStorageSource, setResultStorageSource] = useState<TiqResultStorageSource>('local')
  const [resultFormOpen, setResultFormOpen] = useState(false)
  const [appliedSuggestedResultKey, setAppliedSuggestedResultKey] = useState('')
  const access = useMemo(() => buildProductAccessState(role, entitlements), [entitlements, role])
  const canEditResults = access.canCreateTiqIndividualLeague
  const accessMessage = access.individualLeagueMessage
  const accessResolved = authResolved && Boolean(userId)

  const selectedLeague = useMemo(
    () => leagues.find((league) => league.id === formLeagueId) || null,
    [formLeagueId, leagues],
  )
  const selectedLeagueExperience = getTiqIndividualCompetitionFormatExperience(
    selectedLeague?.individualCompetitionFormat,
  )
  const editingResult = results.find((result) => result.id === editingResultId) || null
  const visiblePlayerEntries = playerEntries.length > 0 ? playerEntries : fallbackEntriesForLeague(selectedLeague)
  const resultParticipantOptions = useMemo<ResultParticipantOption[]>(
    () => {
      const options = visiblePlayerEntries.map((entry) => ({
        value: participantValue(entry.playerId, entry.playerName),
        playerId: entry.playerId,
        playerName: entry.playerName,
      }))

      if (editingResult && editingResult.leagueId === selectedLeague?.id) {
        const editingPlayers = [
          { playerId: editingResult.playerAId, playerName: editingResult.playerAName },
          { playerId: editingResult.playerBId, playerName: editingResult.playerBName },
        ]

        editingPlayers.forEach((player) => {
          const value = participantValue(player.playerId, player.playerName)
          if (!options.some((option) => option.value === value)) {
            options.push({
              value,
              playerId: player.playerId,
              playerName: player.playerName,
            })
          }
        })
      }

      return options
    },
    [editingResult, selectedLeague?.id, visiblePlayerEntries],
  )
  const resultPlayerAOption =
    resultParticipantOptions.find((option) => option.value === resultPlayerA) || null
  const resultPlayerBOption =
    resultParticipantOptions.find((option) => option.value === resultPlayerB) || null
  const resultWinnerOptions = [resultPlayerAOption, resultPlayerBOption].filter(
    (option): option is ResultParticipantOption => Boolean(option),
  )
  const latestResult = results[0] || null
  const editedResultsCount = results.filter(isEditedResult).length
  const normalizedResultSearch = resultSearch.trim().toLowerCase()
  const visibleResults = useMemo(() => {
    return results.filter((result) => {
      const edited = isEditedResult(result)
      if (resultReviewFilter === 'edited' && !edited) return false
      if (resultReviewFilter === 'clean' && edited) return false
      if (resultDateFilter === 'week' && !resultDateIsWithinDays(result.resultDate, 7)) return false
      if (resultDateFilter === 'month' && !resultDateIsWithinDays(result.resultDate, 30)) return false

      if (!normalizedResultSearch) return true

      const league = leagues.find((item) => item.id === result.leagueId)
      const haystack = [
        result.winnerPlayerName,
        resultOpponentName(result),
        result.playerAName,
        result.playerBName,
        result.score,
        result.notes,
        league?.leagueName,
        formatDate(result.resultDate),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedResultSearch)
    })
  }, [leagues, normalizedResultSearch, resultDateFilter, resultReviewFilter, results])
  const activeResultFilterCount =
    (filterLeagueId ? 1 : 0) +
    (normalizedResultSearch ? 1 : 0) +
    (resultReviewFilter !== 'all' ? 1 : 0) +
    (resultDateFilter !== 'all' ? 1 : 0)
  const selectedLeagueResults = useMemo(
    () => (selectedLeague ? results.filter((result) => result.leagueId === selectedLeague.id) : []),
    [results, selectedLeague],
  )
  const selectedLeagueStandings = useMemo(
    () => buildPlayerResultStandings(visiblePlayerEntries, selectedLeagueResults),
    [selectedLeagueResults, visiblePlayerEntries],
  )
  const nextPairing = useMemo(
    () => findNextPairing(selectedLeagueStandings, selectedLeagueResults),
    [selectedLeagueResults, selectedLeagueStandings],
  )
  const summaryByLeague = useMemo(() => buildTiqIndividualLeagueSummaries(results), [results])
  const selectedSummary = formLeagueId ? summaryByLeague.get(formLeagueId) || null : null
  const activeParticipantCount = selectedLeague
    ? visiblePlayerEntries.length
    : leagues.reduce((sum, league) => sum + (league.players || []).length, 0)
  const reviewCommandItems = [
    {
      label: 'Shown',
      value: `${visibleResults.length}/${results.length}`,
      detail: activeResultFilterCount ? `${activeResultFilterCount} review filter${activeResultFilterCount === 1 ? '' : 's'} active.` : 'Full player result book in view.',
      ready: visibleResults.length > 0,
    },
    {
      label: 'Clean',
      value: `${Math.max(0, results.length - editedResultsCount)}/${results.length}`,
      detail: results.length ? 'Original entries are separated from corrections.' : 'Log the first player result.',
      ready: results.length > 0 && editedResultsCount === 0,
    },
    {
      label: 'Corrections',
      value: String(editedResultsCount),
      detail: editedResultsCount ? 'Review edited results before sharing standings.' : 'No edited results in this book.',
      ready: editedResultsCount === 0,
    },
    {
      label: 'Players',
      value: String(activeParticipantCount),
      detail: selectedLeague ? 'Players available for result entry.' : 'Players across individual leagues.',
      ready: activeParticipantCount > 1,
    },
  ]
  const individualResultCue = buildIndividualResultCue({
    leagueCount: leagues.length,
    selectedLeagueName: selectedLeague?.leagueName,
    playerCount: activeParticipantCount,
    resultCount: selectedLeagueResults.length,
    nextPairingLabel: nextPairing ? `${nextPairing[0].playerName} vs ${nextPairing[1].playerName}` : '',
  })

  useEffect(() => {
    if (!authResolved) return

    if (!userId) {
      router.replace(`/login?next=${encodeURIComponent(buildCurrentLoginNextHref(loginNextHref))}`)
    }
  }, [authResolved, loginNextHref, router, userId])

  const refreshResults = useCallback(async (leagueId: string) => {
    const result = await listTiqIndividualLeagueResults({ leagueId: leagueId || null })
    setResults(result.results)
    setResultStorageSource(result.source)
    if (result.warning) setError(result.warning)
  }, [])

  const refreshPlayerEntries = useCallback(async (leagueId: string) => {
    setPlayerEntries([])
    if (!leagueId) return

    const leagueResult = await getTiqLeagueById(leagueId)
    if (leagueResult.warning) setError((current) => current || leagueResult.warning || '')
    if (!leagueResult.record || leagueResult.record.leagueFormat !== 'individual') return

    const result = await listTiqPlayerLeagueEntries(leagueResult.record.id)
    setPlayerEntries(result.entries)
    if (result.warning) setError((current) => current || result.warning || '')
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    const leaguesResult = await listTiqLeagues()
    const individualLeagues = leaguesResult.records.filter((league) => league.leagueFormat === 'individual')
    const requestedIndividualLeagueId = individualLeagues.some((league) => league.id === initialLeagueId)
      ? initialLeagueId
      : ''
    const nextFormLeagueId = requestedIndividualLeagueId || individualLeagues[0]?.id || ''

    setLeagues(individualLeagues)
    setFilterLeagueId(requestedIndividualLeagueId)
    setFormLeagueId((current) => current || nextFormLeagueId)
    if (leaguesResult.warning) setError(leaguesResult.warning)
    await Promise.all([
      refreshResults(requestedIndividualLeagueId),
      refreshPlayerEntries(nextFormLeagueId),
    ])
    setLoading(false)
  }, [initialLeagueId, refreshPlayerEntries, refreshResults])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadData])

  useEffect(() => {
    if (!canEditResults) return
    if (!selectedLeague) return
    if (!suggestedResultPlayerA || !suggestedResultPlayerB) return
    if (suggestedResultPlayerA === suggestedResultPlayerB) return
    if (resultParticipantOptions.length === 0) return

    const nextSuggestedKey = `${selectedLeague.id}::${suggestedResultPlayerA}::${suggestedResultPlayerB}::${scheduledResultItemId}::${scheduledResultDate}`
    if (appliedSuggestedResultKey === nextSuggestedKey) return

    const playerAOption = findParticipantOption(resultParticipantOptions, suggestedResultPlayerA)
    const playerBOption = findParticipantOption(resultParticipantOptions, suggestedResultPlayerB)
    if (!playerAOption || !playerBOption) return

    setEditingResultId('')
    setResultPlayerA(playerAOption.value)
    setResultPlayerB(playerBOption.value)
    setResultWinner('')
    setResultScore('')
    if (scheduledResultDate) setResultDate(scheduledResultDate)
    setResultNotes('')
    setResultFormOpen(true)
    setStatus(
      scheduledResultItemId
        ? `Loaded scheduled match: ${playerAOption.playerName} vs ${playerBOption.playerName}. Choose the winner and score.`
        : `Loaded ${playerAOption.playerName} vs ${playerBOption.playerName}. Choose the winner and score.`,
    )
    setAppliedSuggestedResultKey(nextSuggestedKey)
  }, [
    appliedSuggestedResultKey,
    canEditResults,
    resultParticipantOptions,
    selectedLeague,
    scheduledResultDate,
    scheduledResultItemId,
    suggestedResultPlayerA,
    suggestedResultPlayerB,
  ])

  async function handleFilterChange(leagueId: string) {
    setFilterLeagueId(leagueId)
    const nextHref = leagueId ? `${resultsHref}?leagueId=${encodeURIComponent(leagueId)}` : resultsHref
    router.replace(nextHref, { scroll: false })
    setLoading(true)
    setError('')
    resetResultForm()
    await refreshResults(leagueId)
    if (leagueId) {
      setFormLeagueId(leagueId)
      await refreshPlayerEntries(leagueId)
    }
    setLoading(false)
  }

  function resetResultForm() {
    setEditingResultId('')
    setResultPlayerA('')
    setResultPlayerB('')
    setResultWinner('')
    setResultScore('')
    setResultDate(new Date().toISOString().slice(0, 10))
    setResultNotes('')
  }

  async function handleFormLeagueChange(leagueId: string) {
    setFormLeagueId(leagueId)
    resetResultForm()
    setStatus('')
    if (leagueId && filterLeagueId !== leagueId) {
      setFilterLeagueId(leagueId)
      router.replace(`${resultsHref}?leagueId=${encodeURIComponent(leagueId)}`, { scroll: false })
      await refreshResults(leagueId)
    }
    await refreshPlayerEntries(leagueId)
  }

  function handleUsePairing(left: PlayerResultStanding, right: PlayerResultStanding) {
    if (!selectedLeague) return

    setEditingResultId('')
    setResultPlayerA(participantValue(left.playerId, left.playerName))
    setResultPlayerB(participantValue(right.playerId, right.playerName))
    setResultWinner('')
    setResultScore('')
    setResultNotes('')
    setResultFormOpen(true)
    setStatus(`Loaded ${left.playerName} vs ${right.playerName}. Choose the winner and score.`)
    window.requestAnimationFrame(() => {
      document.getElementById('player-result-entry')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }

  function handleOpenPlayerResultEntry() {
    setResultFormOpen(true)
    window.requestAnimationFrame(() => {
      document.getElementById('player-result-entry')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    })
  }

  async function handleEditResult(result: TiqIndividualLeagueResultRecord) {
    setEditingResultId(result.id)
    setFormLeagueId(result.leagueId)
    setFilterLeagueId(result.leagueId)
    router.replace(`${resultsHref}?leagueId=${encodeURIComponent(result.leagueId)}`, { scroll: false })
    await refreshPlayerEntries(result.leagueId)
    setResultPlayerA(participantValue(result.playerAId, result.playerAName))
    setResultPlayerB(participantValue(result.playerBId, result.playerBName))
    setResultWinner(participantValue(result.winnerPlayerId, result.winnerPlayerName))
    setResultScore(result.score)
    setResultDate(dateInputValue(result.resultDate))
    setResultNotes(result.notes)
    setResultFormOpen(true)
    setStatus(`Editing ${result.winnerPlayerName} over ${resultOpponentName(result)}.`)
  }

  async function handleResultSubmit() {
    if (!canEditResults) {
      setStatus(accessMessage || 'League Office access is required before logging individual results.')
      return
    }

    if (!selectedLeague) {
      setStatus('Choose an individual TIQ league before logging a result.')
      return
    }

    if (!resultPlayerAOption || !resultPlayerBOption) {
      setStatus('Choose two players before logging a TIQ individual result.')
      return
    }

    if (resultPlayerAOption.value === resultPlayerBOption.value) {
      setStatus('A TIQ individual result needs two different players.')
      return
    }

    const winnerOption = resultWinnerOptions.find((option) => option.value === resultWinner) || null
    if (!winnerOption) {
      setStatus('Choose the winner before saving this TIQ individual result.')
      return
    }

    const winnerSide = winnerOption.value === resultPlayerAOption.value ? 'A' : 'B'
    const scoreValidation = validateTiqTennisMatchScore(resultScore, winnerSide)
    if (!scoreValidation.valid) {
      setStatus(scoreValidation.message)
      return
    }

    setSaving(true)
    setStatus('')

    try {
      const editingExistingResult = Boolean(editingResultId)
      const saveResult = await saveTiqIndividualLeagueResult({
        resultId: editingResultId || null,
        leagueId: selectedLeague.id,
        scheduleItemId: scheduledResultItemId || null,
        playerAName: resultPlayerAOption.playerName,
        playerAId: resultPlayerAOption.playerId,
        playerBName: resultPlayerBOption.playerName,
        playerBId: resultPlayerBOption.playerId,
        winnerPlayerName: winnerOption.playerName,
        winnerPlayerId: winnerOption.playerId,
        score: resultScore,
        resultDate: resultDate ? new Date(`${resultDate}T12:00:00`).toISOString() : new Date().toISOString(),
        notes: resultNotes,
      })
      const completion = await completeTiqIndividualSuggestionsForPair({
        leagueId: selectedLeague.id,
        playerAName: resultPlayerAOption.playerName,
        playerBName: resultPlayerBOption.playerName,
      })
      const scheduleCompletion =
        scheduledResultItemId && !editingExistingResult
          ? await updateTiqLeagueScheduleStatus({
              scheduleItemId: scheduledResultItemId,
              status: 'completed',
            })
          : null

      await refreshResults(filterLeagueId)
      setResultStorageSource(saveResult.source)
      setError(saveResult.warning || completion.warning || scheduleCompletion?.warning || '')
      setStatus(
        `${editingExistingResult ? 'Updated' : 'Saved'} TIQ result: ${winnerOption.playerName} over ${
          winnerOption.value === resultPlayerAOption.value ? resultPlayerBOption.playerName : resultPlayerAOption.playerName
        }.${scheduleCompletion ? ' Scheduled match marked complete.' : ''}`,
      )
      resetResultForm()
    } catch (saveError) {
      setStatus(saveError instanceof Error ? saveError.message : 'Unable to save this TIQ result.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteResult(result: TiqIndividualLeagueResultRecord) {
    if (!canEditResults) return
    if (!confirm(`Delete ${result.winnerPlayerName} over ${resultOpponentName(result)}? This cannot be undone.`)) return

    const deleteResult = await deleteTiqIndividualLeagueResult(result.id)
    await refreshResults(filterLeagueId)
    if (editingResultId === result.id) resetResultForm()
    setResultStorageSource(deleteResult.source)
    setStatus(deleteResult.warning || 'Result deleted.')
  }

  async function handleClearResultFilters() {
    setResultSearch('')
    setResultReviewFilter('all')
    setResultDateFilter('all')
    if (filterLeagueId) {
      await handleFilterChange('')
    }
  }

  function resultExportRows() {
    return visibleResults.map((result) => {
      const league = leagues.find((item) => item.id === result.leagueId)
      const edited = isEditedResult(result)
      return {
        league: league?.leagueName || '',
        date: exportDateValue(result.resultDate),
        winner: result.winnerPlayerName,
        opponent: resultOpponentName(result),
        score: result.score,
        status: edited ? 'Edited' : 'Original',
        editedAt: edited ? formatResultTimestamp(result.updatedAt) : '',
        notes: result.notes,
      }
    })
  }

  function handleExportResults() {
    if (visibleResults.length === 0) {
      setStatus('There are no filtered player results to export.')
      return
    }

    const rows = resultExportRows()
    const header = ['League', 'Date', 'Winner', 'Opponent', 'Score', 'Status', 'Edited At', 'Notes']
    const csv = [
      header.map(csvCell).join(','),
      ...rows.map((row) =>
        [
          row.league,
          row.date,
          row.winner,
          row.opponent,
          row.score,
          row.status,
          row.editedAt,
          row.notes,
        ].map(csvCell).join(','),
      ),
    ].join('\r\n')

    const selectedLeagueName = filterLeagueId
      ? leagues.find((league) => league.id === filterLeagueId)?.leagueName || 'player-results'
      : 'player-results'
    const filename = `tenaceiq-${slugText(selectedLeagueName) || 'player-results'}-${new Date().toISOString().slice(0, 10)}.csv`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.append(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
    setStatus(`Exported ${visibleResults.length} player result${visibleResults.length === 1 ? '' : 's'}.`)
  }

  async function handleCopyResultSummary() {
    if (visibleResults.length === 0) {
      setStatus('There are no filtered player results to copy.')
      return
    }

    const selectedLeagueName = filterLeagueId
      ? leagues.find((league) => league.id === filterLeagueId)?.leagueName || 'Filtered player results'
      : 'Filtered player results'
    const lines = [
      `${selectedLeagueName}: ${visibleResults.length} result${visibleResults.length === 1 ? '' : 's'}`,
      ...resultExportRows().map((row) => {
        const details = [row.score, row.date, row.status === 'Edited' ? `Edited ${row.editedAt}` : null]
          .filter(Boolean)
          .join(' - ')
        return `${row.winner} def. ${row.opponent}${details ? ` (${details})` : ''}`
      }),
    ]

    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setStatus(`Copied ${visibleResults.length} result${visibleResults.length === 1 ? '' : 's'} to clipboard.`)
    } catch {
      setStatus('Clipboard access was blocked by the browser.')
    }
  }

  if (!accessResolved) {
    return (
      <SiteShell active={activeRoute}>
        <div style={pageWrap}>
          <div style={card}>Checking League Office access...</div>
        </div>
      </SiteShell>
    )
  }

  if (accessResolved && !canEditResults) {
    return (
      <LockedPlanPage
        active={activeRoute}
        planId="league"
        headline="Need to record individual league results?"
        body="Unlock League Office to enter player results, keep standings current, and manage the season without spreadsheet cleanup."
        ctaLabel="Unlock League"
        secondaryLabel="Back to League"
        secondaryHref="/league-coordinator"
      />
    )
  }

  return (
    <SiteShell active={activeRoute}>
      <div style={pageWrap}>
        <section style={resultPathStyle} aria-labelledby="player-result-path-title">
          <div style={resultPathHeader}>
            <div>
              <div style={tileLabel}>Player Results path</div>
              <h1 id="player-result-path-title" style={resultPathTitle}>Log or review player results</h1>
            </div>
            <p style={resultPathIntro}>
              Choose players, save scores, check standings, or upload scorecards.
            </p>
          </div>
          <div style={resultPathCommandStyle} aria-label="Player result command center">
            <div style={resultPathGrid}>
              <button
                type="button"
                style={resultPathButton}
                onClick={() => nextPairing ? handleUsePairing(nextPairing[0], nextPairing[1]) : handleOpenPlayerResultEntry()}
                disabled={!selectedLeague}
                data-player-result-path-job="log_result"
                aria-label="Log player result"
              >
                <span style={resultPathQuestion}>Log</span>
                <strong style={resultPathCardTitle}>Add result</strong>
                <span>Choose players, winner, score, and date so standings update.</span>
                <span style={resultPathCta}>{nextPairing ? 'Use next pairing' : 'Log result'}</span>
              </button>
              <Link
                href="#player-result-review"
                style={resultPathCard}
                data-player-result-path-job="review_standings"
                aria-label="Review standings"
              >
                <span style={resultPathQuestion}>Review</span>
                <strong style={resultPathCardTitle}>Check standings</strong>
                <span>Scan leaders, useful pairings, corrections, and missing head-to-heads.</span>
                <span style={resultPathCta}>Review standings</span>
              </Link>
              <Link
                href={dataAssistIndividualResultsHref}
                style={resultPathCard}
                data-player-result-path-job="upload_scorecard"
                aria-label="Upload scorecard"
              >
                <span style={resultPathQuestion}>Upload</span>
                <strong style={resultPathCardTitle}>Use Data Assist</strong>
                <span>Send source scorecards through review before standings move.</span>
                <span style={resultPathCta}>Upload scorecard</span>
              </Link>
              {canEditResults ? (
                <button
                  type="button"
                  style={resultPathButton}
                  onClick={() =>
                    nextPairing ? handleUsePairing(nextPairing[0], nextPairing[1]) : handleOpenPlayerResultEntry()
                  }
                  disabled={!selectedLeague}
                  data-player-result-path-job="next_best_action"
                  aria-label="Open next player result action"
                >
                  <span style={resultPathQuestion}>Next</span>
                  <strong style={resultPathCardTitle}>{nextPairing ? 'Use pairing' : 'Start entry'}</strong>
                  <span>{nextPairing ? 'Preload the next useful matchup.' : 'Open the player result form.'}</span>
                  <span style={resultPathCta}>{nextPairing ? 'Use next pairing' : 'Log player result'}</span>
                </button>
              ) : null}
              {selectedLeague ? (
                <Link
                  href={`/explore/leagues/tiq/${encodeURIComponent(selectedLeague.id)}?league_id=${encodeURIComponent(selectedLeague.id)}`}
                  style={resultPathCard}
                  data-player-result-path-job="view_league"
                  aria-label="View selected league"
                >
                  <span style={resultPathQuestion}>League</span>
                  <strong style={resultPathCardTitle}>Public view</strong>
                  <span>Check what players see after results and standings settle.</span>
                  <span style={resultPathCta}>View league</span>
                </Link>
              ) : (
                <Link
                  href="/league-coordinator#league-setup-form"
                  style={resultPathCard}
                  data-player-result-path-job="set_up_league"
                  aria-label="Set up league"
                >
                  <span style={resultPathQuestion}>League</span>
                  <strong style={resultPathCardTitle}>Set up first</strong>
                  <span>Create an individual league before player results can connect to standings.</span>
                  <span style={resultPathCta}>Set up league</span>
                </Link>
              )}
            </div>
            <details style={resultPathStatusPanelStyle}>
              <summary style={detailsSummary}>
                <span style={resultPathQuestion}>Result book scan</span>
                <span style={pill}>Open when needed</span>
              </summary>
              <strong style={resultPathCardTitle}>{individualResultCue.title}</strong>
              <span>{individualResultCue.detail}</span>
              <div style={resultPathStatusGridStyle} aria-label="Player result readiness scan">
                {individualResultCue.items.map((item) => (
                  <div key={item.label} style={resultPathStatusItemStyle}>
                    <span style={item.complete ? pillGreen : pill}>{item.label}</span>
                    <strong>{item.detail}</strong>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </section>

        {error ? <p style={msgErr}>{error}</p> : null}
        {status ? (
          <p style={
            status.startsWith('Saved') ||
            status.startsWith('Updated') ||
            status.startsWith('Loaded') ||
            status.startsWith('Exported') ||
            status.startsWith('Copied') ||
            status.toLowerCase().includes('deleted')
              ? msgOk
              : msgErr
          }>
            {status}
          </p>
        ) : null}
        <details
          id="player-result-entry"
          style={detailsCard}
          open={canEditResults && (results.length === 0 || resultFormOpen)}
          onToggle={(event) => setResultFormOpen(event.currentTarget.open)}
        >
          <summary style={detailsSummary}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>
                {editingResultId ? 'Edit player result' : 'New player result'}
              </div>
              <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
                {canEditResults
                  ? editingResultId
                    ? 'Update the saved scoreline, winner, date, or notes.'
                    : 'Use this for individual TIQ league matches only.'
                  : 'Result entry unlocks with Individual League Office access.'}
              </div>
            </div>
            <span style={canEditResults ? pillGreen : pill}>{editingResultId ? 'Editing' : 'Add result'}</span>
          </summary>

          {canEditResults ? (
            <>
              <div style={row}>
                <Field label="League">
                  <select
                    style={inputStyle}
                    value={formLeagueId}
                    onChange={(event) => void handleFormLeagueChange(event.target.value)}
                    disabled={saving || Boolean(editingResultId)}
                  >
                    <option value="">Choose league</option>
                    {leagues.map((league) => (
                      <option key={league.id} value={league.id}>{league.leagueName}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Player A">
                  <select
                    value={resultPlayerA}
                    onChange={(event) => setResultPlayerA(event.target.value)}
                    style={inputStyle}
                    disabled={saving || !selectedLeague}
                  >
                    <option value="">Choose player A</option>
                    {resultParticipantOptions.map((option) => (
                      <option key={`a-${option.value}`} value={option.value}>{option.playerName}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Player B">
                  <select
                    value={resultPlayerB}
                    onChange={(event) => setResultPlayerB(event.target.value)}
                    style={inputStyle}
                    disabled={saving || !selectedLeague}
                  >
                    <option value="">Choose player B</option>
                    {resultParticipantOptions.map((option) => (
                      <option key={`b-${option.value}`} value={option.value}>{option.playerName}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div style={row}>
                <Field label="Winner">
                  <select
                    value={resultWinner}
                    onChange={(event) => setResultWinner(event.target.value)}
                    style={inputStyle}
                    disabled={saving}
                  >
                    <option value="">Choose winner</option>
                    {resultWinnerOptions.map((option) => (
                      <option key={`w-${option.value}`} value={option.value}>{option.playerName}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Score">
                  <input
                    value={resultScore}
                    onChange={(event) => setResultScore(event.target.value)}
                    placeholder={selectedLeagueExperience.scorePlaceholder}
                    style={inputStyle}
                    disabled={saving}
                  />
                  <small style={scoreHelpStyle}>
                    Completed sets only: 6-4, 7-6, or a deciding 10-point tiebreak like 10-8.
                  </small>
                </Field>
                <Field label="Result date">
                  <input
                    type="date"
                    value={resultDate}
                    onChange={(event) => setResultDate(event.target.value)}
                    style={inputStyle}
                    disabled={saving}
                  />
                </Field>
              </div>

              <div style={row}>
                <Field label="Notes" wide>
                  <textarea
                    value={resultNotes}
                    onChange={(event) => setResultNotes(event.target.value)}
                    placeholder={selectedLeagueExperience.notesPlaceholder}
                    style={textareaStyle}
                    disabled={saving}
                  />
                </Field>
              </div>

              <div style={actionRow}>
                <button
                  type="button"
                  onClick={handleResultSubmit}
                  disabled={saving}
                  style={{ ...btnPrimary, ...(saving ? disabledButton : {}) }}
                >
                  {saving ? 'Saving result...' : editingResultId ? 'Update Result' : selectedLeagueExperience.actionLabel}
                </button>
                <span style={pillGreen}>{resultStorageSource === 'supabase' ? 'Live results' : 'Saved preview results'}</span>
                {editingResultId ? (
                  <button type="button" onClick={resetResultForm} style={btnSecondary}>
                    Cancel edit
                  </button>
                ) : null}
                {selectedLeague ? (
                  <Link href={`/explore/leagues/tiq/${encodeURIComponent(selectedLeague.id)}?league_id=${encodeURIComponent(selectedLeague.id)}`} style={btnSecondary}>
                    View league
                  </Link>
                ) : null}
              </div>
            </>
          ) : null}
        </details>

        <div style={insightGrid}>
          <section id="player-result-review" style={card}>
            <div style={sectionTitle}>
              {selectedLeague
                ? `${getTiqIndividualCompetitionFormatLabel(selectedLeague.individualCompetitionFormat)} standings`
                : 'Player standings'}
            </div>
            {selectedLeagueStandings.length === 0 ? (
              <div style={resultMeta}>Choose an individual league with players to see the working standings.</div>
            ) : (
              <div style={standingsList}>
                {selectedLeagueStandings.slice(0, 8).map((entry) => (
                  <div key={`${entry.playerName}-${entry.playerId || entry.rank}`} style={standingRow}>
                    <div style={standingRank}>{entry.rank}</div>
                    <div style={standingCopy}>
                      <div style={standingName}>{entry.playerName}</div>
                      <div style={standingSubtext}>
                        {entry.uniqueOpponents}/{entry.possibleOpponents} opponents
                        {entry.recentForm.length ? ` - ${entry.recentForm.join('')}` : ''}
                      </div>
                    </div>
                    <div style={metricStack}>
                      <span>{entry.wins}-{entry.losses}</span>
                      <span>{entry.matches} results</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section style={card}>
            <div style={sectionTitle}>Next useful result</div>
            {nextPairing ? (
              <>
                <div style={resultTitle}>
                  {nextPairing[0].playerName} vs {nextPairing[1].playerName}
                </div>
                <div style={resultMeta}>
                  Prioritizes players with fewer logged results and missing head-to-head coverage.
                </div>
                <div style={actionRow}>
                  <button
                    type="button"
                    onClick={() => handleUsePairing(nextPairing[0], nextPairing[1])}
                    style={btnPrimary}
                  >
                    Use pairing
                  </button>
                </div>
              </>
            ) : (
              <div style={resultMeta}>Add at least two players to get a next-result prompt.</div>
            )}
          </section>
        </div>

        <section style={reviewPanelStyle} aria-labelledby="player-result-book-title">
          <div style={reviewPanelHeaderStyle}>
            <div>
              <div style={tileLabel}>Result book</div>
              <h2 id="player-result-book-title" style={reviewPanelTitleStyle}>Recorded player results</h2>
            </div>
            <span style={activeResultFilterCount ? pillGreen : pill}>
              {activeResultFilterCount ? `${activeResultFilterCount} active` : 'All results'}
            </span>
          </div>

          <div style={reviewCommandGridStyle} aria-label="Player result review status">
            {reviewCommandItems.map((item) => (
              <div key={item.label} style={reviewCommandItemStyle}>
                <span style={item.ready ? readinessDotReady : readinessDotWaiting} aria-hidden="true" />
                <span style={reviewCommandCopyStyle}>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                <em>{item.value}</em>
              </div>
            ))}
          </div>

          <div style={reviewFilterGridStyle} aria-label="Player result review filters">
            <Field label="Find result">
              <input
                value={resultSearch}
                onChange={(event) => setResultSearch(event.target.value)}
                placeholder="Player, score, note..."
                style={inputStyle}
              />
            </Field>
            <Field label="League">
              <select
                style={inputStyle}
                value={filterLeagueId}
                onChange={(event) => void handleFilterChange(event.target.value)}
              >
                <option value="">All leagues</option>
                {leagues.map((league) => (
                  <option key={league.id} value={league.id}>{league.leagueName}</option>
                ))}
              </select>
            </Field>
            <Field label="Review">
              <select
                style={inputStyle}
                value={resultReviewFilter}
                onChange={(event) => setResultReviewFilter(event.target.value as ResultReviewFilter)}
              >
                <option value="all">All results</option>
                <option value="edited">Corrections only</option>
                <option value="clean">Original entries</option>
              </select>
            </Field>
            <Field label="Date">
              <select
                style={inputStyle}
                value={resultDateFilter}
                onChange={(event) => setResultDateFilter(event.target.value as ResultDateFilter)}
              >
                <option value="all">Any date</option>
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
              </select>
            </Field>
          </div>

          <div style={reviewActionRowStyle}>
            <button type="button" onClick={() => void handleClearResultFilters()} style={btnSecondary}>
              Clear filters
            </button>
            <button
              type="button"
              onClick={handleExportResults}
              disabled={visibleResults.length === 0}
              style={{ ...btnSecondary, ...(visibleResults.length === 0 ? disabledButton : {}) }}
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => void handleCopyResultSummary()}
              disabled={visibleResults.length === 0}
              style={{ ...btnSecondary, ...(visibleResults.length === 0 ? disabledButton : {}) }}
            >
              Copy Summary
            </button>
            <span style={reviewCountStyle}>
              Showing {visibleResults.length} of {results.length} result{results.length === 1 ? '' : 's'}.
            </span>
          </div>
        </section>

        {loading ? (
          <p style={{ color: '#94a3b8' }}>Loading...</p>
        ) : results.length === 0 ? (
          <EmptyIndividualResultsPanel />
        ) : visibleResults.length === 0 ? (
          <div style={emptyCard}>No player results match the current review filters.</div>
        ) : (
          <div style={listWrap}>
            {visibleResults.map((result) => {
              const league = leagues.find((item) => item.id === result.leagueId)
              const edited = isEditedResult(result)
              const editedAt = edited ? formatResultTimestamp(result.updatedAt) : ''
              const profilesReady = Boolean(result.playerAId && result.playerBId && result.winnerPlayerId)
              const scoreReady = Boolean(result.score)
              const dateReady = Boolean(result.resultDate)
              const resultFollowThroughItems = [
                { label: 'Profiles', value: profilesReady ? 'Ready' : 'Needed', ready: profilesReady },
                { label: 'Score', value: scoreReady ? result.score : 'Missing', ready: scoreReady },
                { label: 'Date', value: dateReady ? formatDate(result.resultDate) : 'Missing', ready: dateReady },
              ]
              const metaParts = [
                league?.leagueName,
                result.score,
                formatDate(result.resultDate),
                editedAt ? `Edited ${editedAt}` : null,
                result.notes,
              ].filter(Boolean)

              return (
                <div key={result.id} style={resultCard}>
                  <div style={resultCopy}>
                    <div style={resultTitle}>
                      {result.winnerPlayerName} def. {resultOpponentName(result)}
                    </div>
                    <div style={resultMeta}>
                      {metaParts.join(' - ')}
                    </div>
                    <div style={resultFollowThroughGrid}>
                      {resultFollowThroughItems.map((item) => (
                        <div key={item.label} style={resultFollowThroughItem}>
                          <span style={item.ready ? readinessDotReady : readinessDotWaiting} aria-hidden="true" />
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </div>
                      ))}
                      {profilesReady ? (
                        <Link href={`/players/${encodeURIComponent(result.winnerPlayerId)}`} style={resultPrimaryAction}>
                          Open winner
                        </Link>
                      ) : canEditResults ? (
                        <button type="button" onClick={() => void handleEditResult(result)} style={resultPrimaryAction}>
                          Create profiles
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div style={actionRow}>
                    {edited ? <span style={pillAmber}>Edited</span> : null}
                    {canEditResults ? (
                      <>
                        <button type="button" onClick={() => void handleEditResult(result)} style={btnSecondary}>
                          Edit
                        </button>
                        <button type="button" onClick={() => void handleDeleteResult(result)} style={btnDanger}>
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <LeagueSuitePanel active="player-results" leagueLabel={selectedLeague?.leagueName || 'League season'} />
        <details style={introCard}>
          <summary style={detailsSummary}>
            <div>
              <div style={heading}>Season snapshot</div>
              <div style={subheading}>Open this when you want counts, leader, and correction status.</div>
            </div>
            <span style={pill}>Details</span>
          </summary>
          <span aria-hidden="true" style={portalWatermarkStyle} />
          <div style={portalPanelContentStyle}>
            <div style={scorekeeperGrid}>
              <div style={scorekeeperTile}>
                <div style={tileLabel}>Individual leagues</div>
                <div style={tileValue}>{leagues.length}</div>
                <div style={tileText}>Available result groups</div>
              </div>
              <div style={scorekeeperTile}>
                <div style={tileLabel}>Results</div>
                <div style={tileValue}>{visibleResults.length}</div>
                <div style={tileText}>
                  {activeResultFilterCount ? `${results.length} total in scope` : 'All recorded player results'}
                </div>
              </div>
              <div style={scorekeeperTile}>
                <div style={tileLabel}>Latest</div>
                <div style={tileValue}>{latestResult ? formatDate(latestResult.resultDate) : '-'}</div>
                <div style={tileText}>
                  {latestResult ? `${latestResult.winnerPlayerName} def. ${resultOpponentName(latestResult)}` : 'Log the first result'}
                </div>
              </div>
              <div style={scorekeeperTile}>
                <div style={tileLabel}>Leader</div>
                <div style={tileValue}>{selectedSummary?.leaderName || '-'}</div>
                <div style={tileText}>{selectedSummary ? `${selectedSummary.leaderRecord} ${selectedSummary.leaderRecentForm}` : `${activeParticipantCount} players tracked`}</div>
              </div>
              <div style={scorekeeperTile}>
                <div style={tileLabel}>Corrections</div>
                <div style={tileValue}>{editedResultsCount}</div>
                <div style={tileText}>{editedResultsCount === 1 ? 'Edited player result' : 'Edited player results'}</div>
              </div>
            </div>
          </div>
        </details>
      </div>
    </SiteShell>
  )
}
