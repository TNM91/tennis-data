'use client'

export const dynamic = 'force-dynamic'

import { useMemo, useState, type CSSProperties, type ChangeEvent } from 'react'
import SiteShell from '@/app/components/site-shell'
import { supabase } from '@/lib/supabase'
import {
  runScorecardImport,
  summarizeImportResponse,
  collectImportMessages,
  type RunImportResponse,
} from '@/lib/ingestion/runImport'
import { normalizeCapturedScorecardPayload } from '@/lib/ingestion/normalizeCapturedImports'

type PreviewLine = {
  lineNumber: number
  matchType: 'singles' | 'doubles'
  sideAPlayers: string[]
  sideBPlayers: string[]
  winnerSide: 'A' | 'B' | null
  score: string | null | undefined
}

type PreviewMatch = {
  externalMatchId: string
  matchDate: string
  homeTeam: string
  awayTeam: string
  facility: string | null | undefined
  leagueName: string | null | undefined
  flight: string | null | undefined
  lineCount: number
  lines: PreviewLine[]
}

const pageWrapStyle: CSSProperties = {
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '18px 24px 40px',
}

const glassCardStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderRadius: '28px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(17,34,63,0.76) 0%, rgba(9,18,34,0.94) 100%)',
  boxShadow: '0 24px 70px rgba(5,12,26,0.26), inset 0 1px 0 rgba(255,255,255,0.04)',
}

const panelStyle: CSSProperties = {
  ...glassCardStyle,
  padding: '18px',
}

const labelStyle: CSSProperties = {
  color: '#DCEBFF',
  fontSize: '0.8rem',
  fontWeight: 800,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 48,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(8,15,28,0.78)',
  color: '#F8FBFF',
  padding: '12px 14px',
  outline: 'none',
  fontSize: '0.95rem',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
}

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 280,
  resize: 'vertical',
  fontFamily:
    'ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, Liberation Mono, monospace',
  fontSize: '0.82rem',
  lineHeight: 1.5,
}

const primaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 48,
  borderRadius: 999,
  padding: '0 18px',
  border: '1px solid rgba(155,225,29,0.34)',
  background: 'linear-gradient(135deg, #9BE11D 0%, #C7F36B 100%)',
  color: '#08111d',
  fontWeight: 900,
  fontSize: '0.95rem',
  textDecoration: 'none',
  cursor: 'pointer',
  boxShadow: '0 12px 28px rgba(155,225,29,0.18)',
}

const secondaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 48,
  borderRadius: 999,
  padding: '0 18px',
  border: '1px solid rgba(116,190,255,0.20)',
  background: 'linear-gradient(180deg, rgba(21,42,77,0.82) 0%, rgba(11,20,36,0.96) 100%)',
  color: '#EAF4FF',
  fontWeight: 800,
  fontSize: '0.95rem',
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
}

const mutedButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  border: '1px solid rgba(148,163,184,0.18)',
  color: '#D6E1EF',
}

const pillBlueStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  padding: '6px 12px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(74,163,255,0.10)',
  color: '#BFE1FF',
  fontWeight: 800,
  fontSize: '0.77rem',
}

const pillGreenStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  padding: '6px 12px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'rgba(155,225,29,0.10)',
  color: '#C8F56B',
  fontWeight: 800,
  fontSize: '0.77rem',
}

const subtleTextStyle: CSSProperties = {
  color: '#AFC3DB',
  lineHeight: 1.6,
}

const summaryValueStyle: CSSProperties = {
  color: '#F8FBFF',
  fontWeight: 900,
  fontSize: '1.1rem',
  lineHeight: 1.1,
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function parseJsonInput(raw: string): { value: unknown | null; error: string | null } {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { value: null, error: 'No JSON provided.' }
  }

  try {
    return { value: JSON.parse(trimmed), error: null }
  } catch (error) {
    return {
      value: null,
      error: error instanceof Error ? error.message : 'Invalid JSON.',
    }
  }
}

function buildPreviewMatches(payload: unknown): PreviewMatch[] {
  const normalized = normalizeCapturedScorecardPayload(payload)

  return normalized.rows.map((row) => ({
    externalMatchId: row.externalMatchId,
    matchDate: row.matchDate,
    homeTeam: row.homeTeam,
    awayTeam: row.awayTeam,
    facility: row.facility,
    leagueName: row.leagueName,
    flight: row.flight,
    lineCount: row.lines.length,
    lines: row.lines.map((line) => ({
      lineNumber: line.lineNumber,
      matchType: line.matchType,
      sideAPlayers: line.sideAPlayers,
      sideBPlayers: line.sideBPlayers,
      winnerSide: line.winnerSide,
      score: line.score,
    })),
  }))
}

function SummaryMetric({
  label,
  value,
  helper,
}: {
  label: string
  value: string
  helper: string
}) {
  return (
    <div
      style={{
        borderRadius: 22,
        border: '1px solid rgba(116,190,255,0.10)',
        background: 'linear-gradient(180deg, rgba(17,34,63,0.55) 0%, rgba(8,15,28,0.88) 100%)',
        padding: '16px',
      }}
    >
      <div style={{ ...labelStyle, fontSize: '0.72rem' }}>{label}</div>
      <div style={{ ...summaryValueStyle, marginTop: 8 }}>{value}</div>
      <div style={{ ...subtleTextStyle, marginTop: 8, fontSize: '0.82rem' }}>{helper}</div>
    </div>
  )
}

function StatusPanel({
  title,
  tone,
  children,
}: {
  title: string
  tone: 'blue' | 'green' | 'slate'
  children: React.ReactNode
}) {
  const border =
    tone === 'green'
      ? '1px solid rgba(155,225,29,0.12)'
      : tone === 'slate'
        ? '1px solid rgba(148,163,184,0.14)'
        : '1px solid rgba(116,190,255,0.12)'

  const background =
    tone === 'green'
      ? 'linear-gradient(180deg, rgba(18,38,33,0.66) 0%, rgba(9,18,34,0.92) 100%)'
      : tone === 'slate'
        ? 'linear-gradient(180deg, rgba(19,28,45,0.74) 0%, rgba(9,18,34,0.92) 100%)'
        : 'linear-gradient(180deg, rgba(17,34,63,0.72) 0%, rgba(9,18,34,0.92) 100%)'

  return (
    <div
      style={{
        borderRadius: 22,
        border,
        background,
        padding: '16px',
      }}
    >
      <div style={{ color: '#F8FBFF', fontWeight: 800, fontSize: '1rem' }}>{title}</div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  )
}

export default function UploadScorecardPage() {
  const [jsonInput, setJsonInput] = useState('')
  const [isRunningPreview, setIsRunningPreview] = useState(false)
  const [isRunningCommit, setIsRunningCommit] = useState(false)
  const [importResponse, setImportResponse] = useState<RunImportResponse | null>(null)
  const [topLevelError, setTopLevelError] = useState('')
  const [selectedFileName, setSelectedFileName] = useState('')

  const parsed = useMemo(() => parseJsonInput(jsonInput), [jsonInput])

  const previewMatches = useMemo(() => {
    if (!parsed.value) return []
    try {
      return buildPreviewMatches(parsed.value)
    } catch {
      return []
    }
  }, [parsed.value])

  const normalizationWarnings = useMemo(() => {
    if (!parsed.value) return []
    try {
      return normalizeCapturedScorecardPayload(parsed.value).warnings
    } catch {
      return []
    }
  }, [parsed.value])

  const importSummary = useMemo(() => {
    if (!importResponse) return null
    return summarizeImportResponse(importResponse)
  }, [importResponse])

  const importMessages = useMemo(() => {
    if (!importResponse) return []
    return collectImportMessages(importResponse)
  }, [importResponse])

  async function handleRun(mode: 'preview' | 'commit') {
    setTopLevelError('')
    setImportResponse(null)

    if (!parsed.value) {
      setTopLevelError(parsed.error ?? 'Invalid JSON.')
      return
    }

  

    if (mode === 'preview') setIsRunningPreview(true)
    if (mode === 'commit') setIsRunningCommit(true)

    try {
      const response = await runScorecardImport(supabase, parsed.value, mode, {
        hasNormalizedPlayerNameColumn: true,
        matchPlayersDeleteBeforeInsert: true,
        scorecardLinesTable: null,
      })

      setImportResponse(response)

      if (!response.ok) {
        setTopLevelError(response.error)
      }
    } catch (error) {
      setTopLevelError(error instanceof Error ? error.message : 'Import failed.')
    } finally {
      setIsRunningPreview(false)
      setIsRunningCommit(false)
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setSelectedFileName(file.name)
    setTopLevelError('')
    setImportResponse(null)

    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      setJsonInput(text)
    }
    reader.onerror = () => {
      setTopLevelError('Could not read the selected file.')
    }
    reader.readAsText(file)
  }

  function handleLoadSample() {
    const sample = [
      {
        matchId: 'sample-2026-04-09-001',
        playedDate: '2026-04-09',
        homeTeam: 'TenAce Home',
        awayTeam: 'Rival Squad',
        facility: 'Sample Club',
        leagueName: '2026 Adult 18 & Over Spring',
        flight: 'Men 4.5',
        ustaSection: 'USTA/MISSOURI VALLEY',
        districtArea: 'ST. LOUIS – St. Louis Local Leagues',
        lines: [
          {
            lineNumber: 1,
            matchType: 'doubles',
            homePlayers: ['Nathan Meinert', 'Partner One'],
            awayPlayers: ['Opponent One', 'Opponent Two'],
            winnerSide: 'A',
            score: '6-4 6-3',
          },
          {
            lineNumber: 2,
            matchType: 'singles',
            homePlayers: ['Home Singles'],
            awayPlayers: ['Away Singles'],
            winnerSide: 'B',
            score: '3-6 4-6',
          },
        ],
      },
    ]

    setSelectedFileName('sample-scorecard.json')
    setJsonInput(prettyJson(sample))
    setTopLevelError('')
    setImportResponse(null)
  }

  function handleClearAll() {
    setSelectedFileName('')
    setJsonInput('')
    setTopLevelError('')
    setImportResponse(null)
  }

  return (
    <SiteShell active="/admin">
      <section style={pageWrapStyle}>
        <section
          style={{
            ...glassCardStyle,
            padding: '24px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-90px',
              right: '-54px',
              width: 220,
              height: 220,
              borderRadius: 999,
              background: 'radial-gradient(circle, rgba(74,163,255,0.16) 0%, transparent 72%)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-110px',
              left: '-70px',
              width: 240,
              height: 240,
              borderRadius: 999,
              background: 'radial-gradient(circle, rgba(155,225,29,0.10) 0%, transparent 74%)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={pillBlueStyle}>Scorecard ingest</div>
            <h1 className="page-title" style={{ marginTop: 10 }}>
              Upload Scorecard
            </h1>
            <p className="page-subtitle" style={{ maxWidth: 880 }}>
              This route is now wired to the ingestion engine. Drop in captured scorecard JSON,
              preview the normalized matches and lines, then commit directly into Supabase.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 14,
                marginTop: 18,
              }}
            >
              <SummaryMetric
                label="Primary input"
                value="Scorecard JSON"
                helper="Best for completed matches with line-level player detail."
              />
              <SummaryMetric
                label="Preview mode"
                value="Safe"
                helper="Validate mapping, warnings, and row counts before database writes."
              />
              <SummaryMetric
                label="Commit mode"
                value="Live"
                helper="Updates matches, creates missing players, and re-links match players."
              />
              <SummaryMetric
                label="Idempotency"
                value="Enabled"
                helper="Uses external match id as the core relinking key."
              />
            </div>
          </div>
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: '1.15fr 0.85fr',
            gap: 18,
            marginTop: 22,
            alignItems: 'start',
          }}
        >
          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
              <div>
                <div style={labelStyle}>Input</div>
                <div
                  style={{
                    color: '#F8FBFF',
                    fontWeight: 800,
                    fontSize: '1.06rem',
                    marginTop: 8,
                  }}
                >
                  Paste or upload captured scorecard JSON
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <label style={{ ...secondaryButtonStyle, cursor: 'pointer' }}>
                  <input
                    type="file"
                    accept=".json,text/plain,application/json"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  Choose file
                </label>
                <button type="button" style={mutedButtonStyle} onClick={handleLoadSample}>
                  Load sample
                </button>
                <button type="button" style={mutedButtonStyle} onClick={handleClearAll}>
                  Clear
                </button>
              </div>
            </div>

            <div style={{ ...subtleTextStyle, marginTop: 10, fontSize: '0.88rem' }}>
              Accepted forms: single object, array of scorecards, or wrapped payloads that contain a
              scorecard rows array.
            </div>

            {selectedFileName ? (
              <div style={{ marginTop: 12 }}>
                <span style={pillGreenStyle}>Loaded: {selectedFileName}</span>
              </div>
            ) : null}

            <div style={{ marginTop: 16 }}>
              <textarea
                value={jsonInput}
                onChange={(event) => setJsonInput(event.target.value)}
                placeholder="Paste captured scorecard JSON here..."
                style={textareaStyle}
                spellCheck={false}
              />
            </div>

            <div
              style={{
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                marginTop: 16,
              }}
            >
              <button
                type="button"
                onClick={() => handleRun('preview')}
                style={{
                  ...secondaryButtonStyle,
                  opacity: isRunningPreview ? 0.8 : 1,
                  cursor: isRunningPreview ? 'wait' : 'pointer',
                }}
                disabled={isRunningPreview || isRunningCommit}
              >
                {isRunningPreview ? 'Running preview…' : 'Preview import'}
              </button>

              <button
                type="button"
                onClick={() => handleRun('commit')}
                style={{
                  ...primaryButtonStyle,
                  opacity: isRunningCommit ? 0.82 : 1,
                  cursor: isRunningCommit ? 'wait' : 'pointer',
                }}
                disabled={isRunningPreview || isRunningCommit}
              >
                {isRunningCommit ? 'Committing…' : 'Commit import'}
              </button>
            </div>

            {topLevelError ? (
              <div
                style={{
                  marginTop: 14,
                  borderRadius: 18,
                  border: '1px solid rgba(255,99,132,0.18)',
                  background: 'linear-gradient(180deg, rgba(59,20,31,0.72) 0%, rgba(24,10,16,0.92) 100%)',
                  color: '#FFD5DF',
                  padding: '14px 16px',
                  fontWeight: 700,
                }}
              >
                {topLevelError}
              </div>
            ) : null}
          </div>

          <div style={panelStyle}>
            <div style={labelStyle}>Readiness</div>
            <div
              style={{
                color: '#F8FBFF',
                fontWeight: 800,
                fontSize: '1.06rem',
                marginTop: 8,
              }}
            >
              Normalization status
            </div>

            <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
              <StatusPanel title="Detected rows" tone="blue">
                <div style={summaryValueStyle}>{previewMatches.length}</div>
                <div style={{ ...subtleTextStyle, marginTop: 6 }}>
                  Scorecard records ready for preview or commit.
                </div>
              </StatusPanel>

              <StatusPanel title="Normalization warnings" tone="slate">
                <div style={summaryValueStyle}>{normalizationWarnings.length}</div>
                <div style={{ ...subtleTextStyle, marginTop: 6 }}>
                  Non-fatal issues found while shaping captured JSON into the import contract.
                </div>
              </StatusPanel>

              <StatusPanel title="Pipeline target" tone="green">
                <div style={{ ...subtleTextStyle }}>
                  Commit mode will attempt to:
                  <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                    <span style={pillGreenStyle}>Upsert completed matches</span>
                    <span style={pillGreenStyle}>Create missing players</span>
                    <span style={pillGreenStyle}>Delete and rebuild match_players</span>
                  </div>
                </div>
              </StatusPanel>
            </div>
          </div>
        </section>

        <section style={{ ...panelStyle, marginTop: 22 }}>
          <div style={labelStyle}>Preview</div>
          <div
            style={{
              color: '#F8FBFF',
              fontWeight: 800,
              fontSize: '1.06rem',
              marginTop: 8,
            }}
          >
            Normalized scorecard matches
          </div>

          {previewMatches.length === 0 ? (
            <div style={{ ...subtleTextStyle, marginTop: 14 }}>
              Paste or load scorecard JSON to see normalized matches and lines here.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
              {previewMatches.map((match) => (
                <div
                  key={`${match.externalMatchId}-${match.matchDate}`}
                  style={{
                    borderRadius: 22,
                    border: '1px solid rgba(116,190,255,0.10)',
                    background:
                      'linear-gradient(180deg, rgba(17,34,63,0.58) 0%, rgba(9,18,34,0.92) 100%)',
                    padding: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 14,
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div style={{ color: '#F8FBFF', fontWeight: 900, fontSize: '1rem' }}>
                        {match.homeTeam} vs {match.awayTeam}
                      </div>
                      <div style={{ ...subtleTextStyle, marginTop: 6 }}>
                        {match.matchDate}
                        {match.facility ? ` • ${match.facility}` : ''}
                        {match.flight ? ` • ${match.flight}` : ''}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span style={pillBlueStyle}>Match ID: {match.externalMatchId}</span>
                      <span style={pillGreenStyle}>{match.lineCount} lines</span>
                    </div>
                  </div>

                  {match.leagueName ? (
                    <div style={{ ...subtleTextStyle, marginTop: 10 }}>{match.leagueName}</div>
                  ) : null}

                  <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                    {match.lines.map((line) => (
                      <div
                        key={`${match.externalMatchId}-line-${line.lineNumber}`}
                        style={{
                          borderRadius: 18,
                          border: '1px solid rgba(116,190,255,0.08)',
                          background: 'rgba(8,15,28,0.55)',
                          padding: '14px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 12,
                            flexWrap: 'wrap',
                            alignItems: 'center',
                          }}
                        >
                          <div style={{ color: '#F8FBFF', fontWeight: 800 }}>
                            Line {line.lineNumber} • {line.matchType}
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {line.winnerSide ? (
                              <span style={pillGreenStyle}>Winner: {line.winnerSide}</span>
                            ) : (
                              <span style={pillBlueStyle}>Winner: pending</span>
                            )}
                            <span style={pillBlueStyle}>Score: {cleanString(line.score) || '—'}</span>
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 12,
                            marginTop: 12,
                          }}
                        >
                          <div
                            style={{
                              borderRadius: 16,
                              border: '1px solid rgba(116,190,255,0.08)',
                              background: 'rgba(12,22,40,0.72)',
                              padding: '12px',
                            }}
                          >
                            <div style={{ ...labelStyle, fontSize: '0.7rem' }}>Side A</div>
                            <div style={{ ...subtleTextStyle, marginTop: 8 }}>
                              {line.sideAPlayers.join(' / ') || '—'}
                            </div>
                          </div>

                          <div
                            style={{
                              borderRadius: 16,
                              border: '1px solid rgba(116,190,255,0.08)',
                              background: 'rgba(12,22,40,0.72)',
                              padding: '12px',
                            }}
                          >
                            <div style={{ ...labelStyle, fontSize: '0.7rem' }}>Side B</div>
                            <div style={{ ...subtleTextStyle, marginTop: 8 }}>
                              {line.sideBPlayers.join(' / ') || '—'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 18,
            marginTop: 22,
            alignItems: 'start',
          }}
        >
          <div style={panelStyle}>
            <div style={labelStyle}>Warnings</div>
            <div
              style={{
                color: '#F8FBFF',
                fontWeight: 800,
                fontSize: '1.06rem',
                marginTop: 8,
              }}
            >
              Normalization warnings
            </div>

            {normalizationWarnings.length === 0 ? (
              <div style={{ ...subtleTextStyle, marginTop: 14 }}>
                No normalization warnings yet.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                {normalizationWarnings.map((warning, index) => (
                  <div
                    key={`${warning.rowIndex}-${index}`}
                    style={{
                      borderRadius: 18,
                      border: '1px solid rgba(148,163,184,0.14)',
                      background:
                        'linear-gradient(180deg, rgba(19,28,45,0.72) 0%, rgba(9,18,34,0.92) 100%)',
                      padding: '12px 14px',
                      color: '#D6E1EF',
                    }}
                  >
                    Row {warning.rowIndex + 1}: {warning.message}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <div style={labelStyle}>Import result</div>
            <div
              style={{
                color: '#F8FBFF',
                fontWeight: 800,
                fontSize: '1.06rem',
                marginTop: 8,
              }}
            >
              Engine response
            </div>

            {!importResponse || !importSummary ? (
              <div style={{ ...subtleTextStyle, marginTop: 14 }}>
                Run preview or commit to see the ingestion response here.
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 10,
                    marginTop: 14,
                  }}
                >
                  <SummaryMetric
                    label="Normalized"
                    value={String(importSummary.normalizedRowCount)}
                    helper="Rows handed to the engine."
                  />
                  <SummaryMetric
                    label="Imported"
                    value={String(importSummary.successCount)}
                    helper="Fresh rows written."
                  />
                  <SummaryMetric
                    label="Updated"
                    value={String(importSummary.updatedCount)}
                    helper="Existing rows refreshed."
                  />
                  <SummaryMetric
                    label="Failed"
                    value={String(importSummary.failedCount)}
                    helper="Rows that did not complete."
                  />
                  <SummaryMetric
                    label="Players created"
                    value={String(importSummary.createdPlayersCount)}
                    helper="New player records inserted."
                  />
                  <SummaryMetric
                    label="Players linked"
                    value={String(importSummary.linkedPlayersCount)}
                    helper="match_players rows written."
                  />
                </div>

                <div
                  style={{
                    marginTop: 16,
                    borderRadius: 20,
                    border: '1px solid rgba(116,190,255,0.10)',
                    background: 'rgba(8,15,28,0.72)',
                    padding: '14px',
                    maxHeight: 360,
                    overflow: 'auto',
                  }}
                >
                  <pre
                    style={{
                      margin: 0,
                      color: '#D8E8FB',
                      fontSize: '0.8rem',
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {importMessages.join('\n')}
                  </pre>
                </div>
              </>
            )}
          </div>
        </section>
      </section>
    </SiteShell>
  )
}