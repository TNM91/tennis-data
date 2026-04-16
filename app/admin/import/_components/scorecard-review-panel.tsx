'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type {
  ReviewDecision,
  ReviewedScorecardLine,
  ScorecardMatchReviewOverride,
  ScorecardPreviewModel,
  ScorecardLineOverride,
} from '@/lib/ingestion/scorecardReview'
import type { MatchSide, ScoreEventType } from '@/lib/ingestion/importEngine'

type ReviewFilterMode = 'all' | 'needs_review' | 'ready' | 'blocked'

type Props = {
  previews: ScorecardPreviewModel[]
  reviewerName: string
  onReviewerNameChange: (value: string) => void
  onMatchDecisionChange: (externalMatchId: string, decision: ReviewDecision) => void
  onApproveMatch: (externalMatchId: string) => void
  onApproveAndSubmitMatch: (preview: ScorecardPreviewModel) => void
  onReviewerNoteChange: (externalMatchId: string, note: string) => void
  onLineOverrideChange: (
    externalMatchId: string,
    lineNumber: number,
    patch: Partial<ScorecardLineOverride>,
  ) => void
  onCommitCleanOnly: () => void
  onCommitApprovedItems: () => void
  onReviewFlagged: () => void
  isRunningCommit: boolean
  defaultFilter?: ReviewFilterMode
  commitFeedbackMessage?: string
  commitFeedbackMatchId?: string | null
  committedMatchIds?: string[]
}

const panelStyle: CSSProperties = {
  borderRadius: 28,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(17,34,63,0.76) 0%, rgba(9,18,34,0.94) 100%)',
  boxShadow: '0 24px 70px rgba(5,12,26,0.26), inset 0 1px 0 rgba(255,255,255,0.04)',
  padding: '18px',
}

const labelStyle: CSSProperties = {
  color: '#DCEBFF',
  fontSize: '0.8rem',
  fontWeight: 800,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
}

const subtleTextStyle: CSSProperties = {
  color: '#AFC3DB',
  lineHeight: 1.6,
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 42,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(8,15,28,0.78)',
  color: '#F8FBFF',
  padding: '10px 12px',
  outline: 'none',
  fontSize: '0.9rem',
}

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 84,
  resize: 'vertical',
}

const selectStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 42,
}

const primaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 46,
  borderRadius: 999,
  padding: '0 18px',
  border: '1px solid rgba(155,225,29,0.34)',
  background: 'linear-gradient(135deg, #9BE11D 0%, #C7F36B 100%)',
  color: '#08111d',
  fontWeight: 900,
  fontSize: '0.95rem',
  cursor: 'pointer',
}

const secondaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 46,
  borderRadius: 999,
  padding: '0 18px',
  border: '1px solid rgba(116,190,255,0.20)',
  background: 'linear-gradient(180deg, rgba(21,42,77,0.82) 0%, rgba(11,20,36,0.96) 100%)',
  color: '#EAF4FF',
  fontWeight: 800,
  fontSize: '0.95rem',
  cursor: 'pointer',
}

function badgeStyle(tone: 'green' | 'amber' | 'red' | 'blue' | 'slate'): CSSProperties {
  const palette =
    tone === 'green'
      ? {
          border: '1px solid rgba(155,225,29,0.18)',
          background: 'rgba(155,225,29,0.10)',
          color: '#C8F56B',
        }
      : tone === 'amber'
        ? {
            border: '1px solid rgba(250,204,21,0.18)',
            background: 'rgba(250,204,21,0.10)',
            color: '#FDE68A',
          }
        : tone === 'red'
          ? {
              border: '1px solid rgba(248,113,113,0.22)',
              background: 'rgba(127,29,29,0.24)',
              color: '#FCA5A5',
            }
          : tone === 'blue'
            ? {
                border: '1px solid rgba(116,190,255,0.16)',
                background: 'rgba(74,163,255,0.10)',
                color: '#BFE1FF',
              }
            : {
                border: '1px solid rgba(148,163,184,0.18)',
                background: 'rgba(148,163,184,0.10)',
                color: '#D6E1EF',
              }

  return {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 30,
    padding: '5px 11px',
    borderRadius: 999,
    fontSize: '0.78rem',
    fontWeight: 800,
    ...palette,
  }
}

function filterButtonStyle(active: boolean): CSSProperties {
  return active
    ? {
        ...primaryButtonStyle,
        minHeight: 38,
        padding: '0 14px',
        fontSize: '0.86rem',
      }
    : {
        ...secondaryButtonStyle,
        minHeight: 38,
        padding: '0 14px',
        fontSize: '0.86rem',
      }
}

function formatWinner(line: ReviewedScorecardLine, preview: ScorecardPreviewModel) {
  if (line.winnerSide === 'A') return preview.finalPreview.homeTeam || 'Home'
  if (line.winnerSide === 'B') return preview.finalPreview.awayTeam || 'Away'
  return 'Unresolved'
}

function lineWinnerSideValue(value: MatchSide | null | undefined): 'A' | 'B' | 'unresolved' {
  if (value === 'A' || value === 'B') return value
  return 'unresolved'
}

function statusTone(status: ScorecardPreviewModel['status']): 'green' | 'amber' | 'red' | 'blue' {
  if (status === 'clean') return 'green'
  if (status === 'repaired') return 'blue'
  if (status === 'blocked') return 'red'
  return 'amber'
}

function decisionTone(decision: ReviewDecision): 'green' | 'amber' | 'red' | 'blue' | 'slate' {
  if (decision === 'approve_with_overrides') return 'green'
  if (decision === 'accept_parser_result' || decision === 'accept_suggested_repair') return 'blue'
  if (decision === 'exclude_from_commit') return 'red'
  if (decision === 'needs_review_later') return 'amber'
  return 'slate'
}

function decisionLabel(decision: ReviewDecision) {
  if (decision === 'accept_parser_result') return 'Accept parser result'
  if (decision === 'accept_suggested_repair') return 'Accept suggested repair'
  if (decision === 'exclude_from_commit') return 'Exclude from commit'
  if (decision === 'approve_with_overrides') return 'Approve with overrides'
  return 'Needs review later'
}

function statusLabel(status: ScorecardPreviewModel['status']) {
  if (status === 'needs_review') return 'Needs review'
  if (status === 'repaired') return 'Auto-repaired'
  if (status === 'blocked') return 'Blocked'
  return 'Clean'
}

function countByStatus(previews: ScorecardPreviewModel[]) {
  return previews.reduce(
    (acc, preview) => {
      acc[preview.status] += 1
      return acc
    },
    { clean: 0, repaired: 0, needs_review: 0, blocked: 0 },
  )
}

function isReadyPreview(preview: ScorecardPreviewModel) {
  return (
    !preview.blocked &&
    preview.reviewDecision !== 'exclude_from_commit' &&
    (preview.commitEligible || preview.status === 'clean' || preview.status === 'repaired')
  )
}

function getReviewFocusLineNumbers(preview: ScorecardPreviewModel): number[] {
  const focus = preview.finalPreview.lines
    .filter((line) => {
      if (line.winnerSide === null) return true
      if (line.timedMatch && line.winnerSide === null) return true
      if (line.evidenceClass === 'conflict_candidate') return true
      if (!line.isLocked && (line.captureConfidence ?? 0) < 0.75) return true
      if ((line.parseNotes ?? []).some((note) => note.toLowerCase().includes('missing deciding set'))) return true
      return false
    })
    .map((line) => line.lineNumber)

  return [...new Set(focus)].sort((a, b) => a - b)
}

export default function ScorecardReviewPanel({
  previews,
  reviewerName,
  onReviewerNameChange,
  onMatchDecisionChange,
  onApproveMatch,
  onApproveAndSubmitMatch,
  onReviewerNoteChange,
  onLineOverrideChange,
  onCommitCleanOnly,
  onCommitApprovedItems,
  onReviewFlagged,
  isRunningCommit,
  defaultFilter = 'all',
  commitFeedbackMessage,
  commitFeedbackMatchId,
  committedMatchIds = [],
}: Props) {
  const counts = countByStatus(previews)
  const flaggedCount = previews.filter((preview) => preview.status === 'needs_review').length
  const blockedCount = previews.filter((preview) => preview.blocked).length
  const readyCount = previews.filter((preview) => isReadyPreview(preview)).length
  const [filterMode, setFilterMode] = useState<ReviewFilterMode>(defaultFilter)
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null)
  const [showAllLinesByMatch, setShowAllLinesByMatch] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setFilterMode(defaultFilter)
  }, [defaultFilter])

  useEffect(() => {
    if (activeMatchId && previews.some((preview) => preview.externalMatchId === activeMatchId)) {
      return
    }

    const fallbackMatchId =
      previews.find((preview) => preview.status === 'needs_review')?.externalMatchId ??
      previews.find((preview) => preview.status === 'blocked')?.externalMatchId ??
      previews.find((preview) => isReadyPreview(preview))?.externalMatchId ??
      previews[0]?.externalMatchId ??
      null

    setActiveMatchId(fallbackMatchId)
  }, [activeMatchId, previews])

  useEffect(() => {
    if (!activeMatchId || typeof window === 'undefined') return

    const activePreview = previews.find((preview) => preview.externalMatchId === activeMatchId)
    if (!activePreview) return

    const focusLine = getReviewFocusLineNumbers(activePreview)[0]
    if (!focusLine) return

    window.requestAnimationFrame(() => {
      const target = document.querySelector(
        `[data-review-line="${activeMatchId}-${focusLine}"]`,
      )
      if (target instanceof HTMLElement) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
  }, [activeMatchId, previews])

  const filteredPreviews = useMemo(() => {
    if (filterMode === 'needs_review') {
      return previews.filter((preview) => preview.status === 'needs_review')
    }

    if (filterMode === 'blocked') {
      return previews.filter((preview) => preview.status === 'blocked')
    }

    if (filterMode === 'ready') {
      return previews.filter((preview) => isReadyPreview(preview))
    }

    return previews
  }, [filterMode, previews])

  const activeFilterCount =
    filterMode === 'all'
      ? previews.length
      : filterMode === 'needs_review'
        ? counts.needs_review
        : filterMode === 'blocked'
          ? counts.blocked
          : readyCount

  function jumpToMatch(predicate: (preview: ScorecardPreviewModel) => boolean) {
    const targetPreview = filteredPreviews.find(predicate) ?? previews.find(predicate)
    if (!targetPreview) return

    setActiveMatchId(targetPreview.externalMatchId)

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        const target = document.querySelector(
          `[data-review-id="${targetPreview.externalMatchId}"]`,
        )
        if (target instanceof HTMLElement) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      })
    }
  }

  return (
    <section style={{ ...panelStyle, marginTop: 22 }}>
      <div style={labelStyle}>Scorecard Review</div>
      <div style={{ color: '#F8FBFF', fontWeight: 800, fontSize: '1.06rem', marginTop: 8 }}>
        Validation summary and approval flow
      </div>
      <div style={{ ...subtleTextStyle, marginTop: 10 }}>
        Clean matches can move fast. Repaired matches keep a repair log. Conflicts and ambiguous winners stay visible until you explicitly approve or exclude them. Line edits are saved automatically and marked ready for reviewed submission.
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 12,
          marginTop: 16,
        }}
      >
        <MetricCard label="Clean" value={counts.clean} tone="green" />
        <MetricCard label="Auto-repaired" value={counts.repaired} tone="blue" />
        <MetricCard label="Needs review" value={counts.needs_review} tone="amber" />
        <MetricCard label="Blocked" value={counts.blocked} tone="red" />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 260px) 1fr',
          gap: 14,
          marginTop: 18,
        }}
      >
        <div
          style={{
            borderRadius: 20,
            border: '1px solid rgba(116,190,255,0.10)',
            background: 'rgba(8,15,28,0.62)',
            padding: '14px',
          }}
        >
          <div style={{ ...labelStyle, fontSize: '0.72rem' }}>Reviewer</div>
          <input
            value={reviewerName}
            onChange={(event) => onReviewerNameChange(event.target.value)}
            style={{ ...inputStyle, marginTop: 10 }}
            placeholder="Reviewer name"
          />
          <div style={{ ...subtleTextStyle, marginTop: 10, fontSize: '0.86rem' }}>
            Reviewer identity is threaded into approved overrides so raw, validated, and reviewed values stay attributable.
          </div>
        </div>

        <div
          style={{
            borderRadius: 20,
            border: '1px solid rgba(116,190,255,0.10)',
            background: 'rgba(8,15,28,0.62)',
            padding: '14px',
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <button type="button" style={primaryButtonStyle} onClick={onCommitCleanOnly} disabled={isRunningCommit}>
            {isRunningCommit ? 'Committing...' : 'Commit clean only'}
          </button>
          <button type="button" style={secondaryButtonStyle} onClick={onReviewFlagged}>
            Jump to flagged match
          </button>
          <button type="button" style={secondaryButtonStyle} onClick={onCommitApprovedItems} disabled={isRunningCommit}>
            {isRunningCommit ? 'Committing...' : 'Submit reviewed matches'}
          </button>
          <div style={{ ...subtleTextStyle, fontSize: '0.86rem' }}>
            {flaggedCount} flagged match{flaggedCount === 1 ? '' : 'es'}, {blockedCount} blocked, {readyCount} ready.
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginTop: 16,
        }}
      >
        <button type="button" style={filterButtonStyle(filterMode === 'needs_review')} onClick={() => setFilterMode('needs_review')}>
          Needs review ({counts.needs_review})
        </button>
        <button type="button" style={filterButtonStyle(filterMode === 'ready')} onClick={() => setFilterMode('ready')}>
          Ready to submit ({readyCount})
        </button>
        <button type="button" style={filterButtonStyle(filterMode === 'blocked')} onClick={() => setFilterMode('blocked')}>
          Blocked ({counts.blocked})
        </button>
        <button type="button" style={filterButtonStyle(filterMode === 'all')} onClick={() => setFilterMode('all')}>
          All matches ({previews.length})
        </button>
        <button
          type="button"
          style={secondaryButtonStyle}
          onClick={() =>
            jumpToMatch(
              (preview) => preview.status === 'needs_review' || preview.status === 'blocked',
            )
          }
        >
          Next unresolved
        </button>
        <div style={{ ...subtleTextStyle, fontSize: '0.86rem' }}>
          Showing {activeFilterCount} match{activeFilterCount === 1 ? '' : 'es'} in the current view.
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
        {filteredPreviews.length === 0 ? (
          <div
            style={{
              borderRadius: 18,
              border: '1px solid rgba(116,190,255,0.10)',
              background: 'rgba(8,15,28,0.55)',
              padding: '16px',
            }}
          >
            <div style={{ color: '#F8FBFF', fontWeight: 800 }}>Nothing in this filter yet.</div>
            <div style={{ ...subtleTextStyle, marginTop: 8 }}>
              Switch filters to see the rest of the batch, or use &ldquo;Commit clean only&rdquo; to move the safe items through first.
            </div>
          </div>
        ) : filteredPreviews.map((preview) => {
          if (committedMatchIds.includes(preview.externalMatchId)) {
            return (
              <div
                key={preview.externalMatchId}
                style={{
                  borderRadius: 22,
                  border: '1px solid rgba(155,225,29,0.22)',
                  background: 'linear-gradient(180deg, rgba(18,38,33,0.82) 0%, rgba(9,18,34,0.96) 100%)',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ color: '#DFFFC2', fontWeight: 800 }}>
                    {preview.finalPreview.homeTeam} vs {preview.finalPreview.awayTeam}
                  </div>
                  <div style={{ ...subtleTextStyle, marginTop: 4, fontSize: '0.88rem' }}>
                    {preview.finalPreview.matchDate}
                    {preview.finalPreview.flight ? ` · ${preview.finalPreview.flight}` : ''}
                  </div>
                </div>
                <span style={badgeStyle('green')}>Committed</span>
              </div>
            )
          }

          const focusLineNumbers = getReviewFocusLineNumbers(preview)
          const shouldShowAllLines =
            showAllLinesByMatch[preview.externalMatchId] || focusLineNumbers.length === 0
          const linesToRender = shouldShowAllLines
            ? (preview.finalPreview.lines as ReviewedScorecardLine[])
            : (preview.finalPreview.lines as ReviewedScorecardLine[]).filter((line) =>
                focusLineNumbers.includes(line.lineNumber),
              )

          return (
          <details
            key={preview.externalMatchId}
            open={
              activeMatchId === preview.externalMatchId ||
              (!activeMatchId && preview.status !== 'clean')
            }
            data-review-match={preview.status === 'needs_review' ? 'flagged' : 'unflagged'}
            data-review-id={preview.externalMatchId}
            style={{
              borderRadius: 22,
              border:
                preview.status === 'blocked'
                  ? '1px solid rgba(248,113,113,0.26)'
                  : preview.status === 'needs_review'
                    ? '1px solid rgba(250,204,21,0.24)'
                    : '1px solid rgba(116,190,255,0.10)',
              background:
                preview.status === 'blocked'
                  ? 'linear-gradient(180deg, rgba(68,18,18,0.76) 0%, rgba(23,12,17,0.95) 100%)'
                  : preview.status === 'needs_review'
                    ? 'linear-gradient(180deg, rgba(58,44,12,0.72) 0%, rgba(24,18,10,0.96) 100%)'
                    : 'linear-gradient(180deg, rgba(17,34,63,0.58) 0%, rgba(9,18,34,0.92) 100%)',
              padding: '16px',
            }}
          >
            <summary style={{ listStyle: 'none', cursor: 'pointer' }} onClick={() => setActiveMatchId(preview.externalMatchId)}>
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
                    {preview.finalPreview.homeTeam} vs {preview.finalPreview.awayTeam}
                  </div>
                  <div style={{ ...subtleTextStyle, marginTop: 6 }}>
                    {preview.finalPreview.matchDate}
                    {preview.finalPreview.matchTime ? ` • ${preview.finalPreview.matchTime}` : ''}
                    {preview.finalPreview.facility ? ` • ${preview.finalPreview.facility}` : ''}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <span style={badgeStyle(statusTone(preview.status))}>{statusLabel(preview.status)}</span>
                  <span style={badgeStyle(decisionTone(preview.reviewDecision))}>
                    {decisionLabel(preview.reviewDecision)}
                  </span>
                  <span style={badgeStyle('blue')}>Match ID: {preview.externalMatchId}</span>
                  <span style={badgeStyle('slate')}>Confidence {preview.confidenceScore}</span>
                  <span style={badgeStyle('slate')}>
                    Official {preview.officialTeamTotal.home ?? '—'}-{preview.officialTeamTotal.away ?? '—'}
                  </span>
                  <span style={badgeStyle('slate')}>
                    Derived {preview.derivedTeamTotal.home}-{preview.derivedTeamTotal.away}
                    {preview.derivedTeamTotal.unresolved > 0 ? ` (+${preview.derivedTeamTotal.unresolved} unresolved)` : ''}
                  </span>
                  {committedMatchIds.includes(preview.externalMatchId) ? (
                    <span style={badgeStyle('green')}>Submitted</span>
                  ) : null}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                {preview.issues.map((issue) => (
                  <span
                    key={`${preview.externalMatchId}-${issue.code}-${issue.message}`}
                    style={badgeStyle(issue.severity === 'error' ? 'red' : issue.severity === 'warning' ? 'amber' : 'blue')}
                  >
                    {issue.code}
                  </span>
                ))}
                {preview.repairLog.map((repair) => (
                  <span key={`${preview.externalMatchId}-${repair.code}`} style={badgeStyle('blue')}>
                    {repair.label}
                  </span>
                ))}
              </div>
            </summary>

            <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
              {focusLineNumbers.length > 0 ? (
                <section
                  style={{
                    borderRadius: 18,
                    border: '1px solid rgba(250,204,21,0.18)',
                    background: 'rgba(40,28,8,0.42)',
                    padding: '14px',
                  }}
                >
                  <div style={{ ...labelStyle, fontSize: '0.72rem' }}>Review focus</div>
                  <div style={{ color: '#F8FBFF', fontWeight: 800, marginTop: 8 }}>
                    Start with line {focusLineNumbers[0]}
                    {focusLineNumbers.length > 1 ? `, then ${focusLineNumbers.slice(1).join(', ')}` : ''}
                  </div>
                  <div style={{ ...subtleTextStyle, marginTop: 8 }}>
                    Only the lines that need attention are shown first so you can fix the issue, approve the match, and move on.
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                    <button
                      type="button"
                      style={secondaryButtonStyle}
                      onClick={() =>
                        setShowAllLinesByMatch((current) => ({
                          ...current,
                          [preview.externalMatchId]: !shouldShowAllLines,
                        }))
                      }
                    >
                      {shouldShowAllLines ? 'Show issue lines only' : 'Show all lines'}
                    </button>
                    <button
                      type="button"
                      style={secondaryButtonStyle}
                      onClick={() => {
                        setActiveMatchId(preview.externalMatchId)
                        window.requestAnimationFrame(() => {
                          const target = document.querySelector(
                            `[data-review-line="${preview.externalMatchId}-${focusLineNumbers[0]}"]`,
                          )
                          if (target instanceof HTMLElement) {
                            target.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          }
                        })
                      }}
                    >
                      Go to line {focusLineNumbers[0]}
                    </button>
                  </div>
                </section>
              ) : null}

              <section
                style={{
                  borderRadius: 18,
                  border: '1px solid rgba(116,190,255,0.08)',
                  background: 'rgba(8,15,28,0.55)',
                  padding: '14px',
                }}
              >
                <div style={{ ...labelStyle, fontSize: '0.72rem' }}>Match approval</div>

                <label style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                  <span style={subtleTextStyle}>Reviewer note (optional)</span>
                  <textarea
                    value={preview.finalPreview.reviewer_note ?? ''}
                    onChange={(event) => onReviewerNoteChange(preview.externalMatchId, event.target.value)}
                    style={{ ...textareaStyle, minHeight: 60 }}
                    placeholder="Any notes about this match"
                  />
                </label>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                  <button
                    type="button"
                    style={primaryButtonStyle}
                    onClick={() => onApproveAndSubmitMatch(preview)}
                    disabled={isRunningCommit}
                  >
                    {isRunningCommit ? 'Submitting...' : 'Approve and submit'}
                  </button>
                  <button
                    type="button"
                    style={secondaryButtonStyle}
                    onClick={() => onMatchDecisionChange(preview.externalMatchId, 'exclude_from_commit')}
                  >
                    Skip this match
                  </button>
                </div>
              </section>

              {preview.diagnostics.length > 0 ? (
                <TextListCard title="Diagnostics" items={preview.diagnostics} tone="amber" />
              ) : null}

              {preview.parserNotes.length > 0 ? (
                <TextListCard title="Parser notes" items={preview.parserNotes} tone="blue" />
              ) : null}

              <section
                style={{
                  borderRadius: 18,
                  border: '1px solid rgba(116,190,255,0.08)',
                  background: 'rgba(8,15,28,0.55)',
                  padding: '14px',
                }}
              >
                <div style={{ ...labelStyle, fontSize: '0.72rem' }}>Line-by-line review</div>
                {!shouldShowAllLines && focusLineNumbers.length > 0 ? (
                  <div style={{ ...subtleTextStyle, marginTop: 8 }}>
                    Showing the specific line{focusLineNumbers.length === 1 ? '' : 's'} that need review first.
                  </div>
                ) : null}
                <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                  {linesToRender.map((line) => (
                    <LineReviewCard
                      key={`${preview.externalMatchId}-${line.lineNumber}`}
                      line={line}
                      preview={preview}
                      onLineOverrideChange={onLineOverrideChange}
                      onApproveAndSubmitMatch={onApproveAndSubmitMatch}
                      isRunningCommit={isRunningCommit}
                      commitFeedbackMessage={
                        commitFeedbackMatchId === preview.externalMatchId
                          ? commitFeedbackMessage
                          : null
                      }
                    />
                  ))}
                </div>
              </section>
            </div>
          </details>
          )
        })}
      </div>
    </section>
  )
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'green' | 'blue' | 'amber' | 'red'
}) {
  return (
    <div
      style={{
        borderRadius: 18,
        border:
          tone === 'red'
            ? '1px solid rgba(248,113,113,0.18)'
            : tone === 'amber'
              ? '1px solid rgba(250,204,21,0.16)'
              : tone === 'green'
                ? '1px solid rgba(155,225,29,0.16)'
                : '1px solid rgba(116,190,255,0.16)',
        background: 'rgba(8,15,28,0.62)',
        padding: '14px',
      }}
    >
      <div style={{ ...labelStyle, fontSize: '0.72rem' }}>{label}</div>
      <div style={{ color: '#F8FBFF', fontWeight: 900, fontSize: '1.18rem', marginTop: 8 }}>{value}</div>
    </div>
  )
}

function TextListCard({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: 'blue' | 'amber'
}) {
  return (
    <section
      style={{
        borderRadius: 18,
        border: tone === 'amber' ? '1px solid rgba(250,204,21,0.18)' : '1px solid rgba(116,190,255,0.10)',
        background: 'rgba(8,15,28,0.55)',
        padding: '14px',
      }}
    >
      <div style={{ ...labelStyle, fontSize: '0.72rem' }}>{title}</div>
      <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
        {items.map((item) => (
          <div key={`${title}-${item}`} style={{ ...subtleTextStyle, fontSize: '0.9rem' }}>
            {item}
          </div>
        ))}
      </div>
    </section>
  )
}

function LineReviewCard({
  line,
  preview,
  onLineOverrideChange,
  onApproveAndSubmitMatch,
  isRunningCommit,
  commitFeedbackMessage,
}: {
  line: ReviewedScorecardLine
  preview: ScorecardPreviewModel
  onLineOverrideChange: Props['onLineOverrideChange']
  onApproveAndSubmitMatch: Props['onApproveAndSubmitMatch']
  isRunningCommit: boolean
  commitFeedbackMessage?: string | null
}) {
  return (
    <div
      data-review-line={`${preview.externalMatchId}-${line.lineNumber}`}
      style={{
        borderRadius: 18,
        border:
          line.winnerSide === null
            ? '1px solid rgba(250,204,21,0.20)'
            : '1px solid rgba(116,190,255,0.08)',
        background: 'rgba(12,22,40,0.72)',
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
          <span style={badgeStyle(line.isLocked ? 'green' : line.winnerSide ? 'blue' : 'amber')}>
            {line.isLocked ? 'Locked' : line.evidenceClass}
          </span>
          <span style={badgeStyle(line.winnerSide ? 'slate' : 'amber')}>
            Winner: {formatWinner(line, preview)}
          </span>
          <span style={badgeStyle('slate')}>Source: {line.winnerSource}</span>
          <span style={badgeStyle('slate')}>Confidence: {line.captureConfidence}</span>
          <span style={badgeStyle('slate')}>{line.scoreEventType}</span>
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
        <PlayerCard title="Home side" players={line.sideAPlayers} />
        <PlayerCard title="Away side" players={line.sideBPlayers} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 12,
          marginTop: 12,
        }}
      >
        <ValueRow label="Raw score text" value={line.rawScoreText || line.score || '—'} />
        <ValueRow label="Parsed sets" value={line.visibleSetScores?.join(' | ') || line.score || '—'} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 12,
          marginTop: 12,
        }}
      >
        <label style={{ display: 'grid', gap: 8 }}>
          <span style={subtleTextStyle}>Winner side</span>
          <select
            value={lineWinnerSideValue(line.winnerSide)}
            onChange={(event) =>
              onLineOverrideChange(preview.externalMatchId, line.lineNumber, {
                winnerSide:
                  event.target.value === 'A' || event.target.value === 'B'
                    ? (event.target.value as MatchSide)
                    : null,
              })
            }
            style={selectStyle}
          >
            <option value="A">Home</option>
            <option value="B">Away</option>
            <option value="unresolved">Unresolved</option>
          </select>
        </label>

        <label style={{ display: 'grid', gap: 8 }}>
          <span style={subtleTextStyle}>Score event type</span>
          <select
            value={line.scoreEventType}
            onChange={(event) =>
              onLineOverrideChange(preview.externalMatchId, line.lineNumber, {
                scoreEventType: event.target.value as ScoreEventType,
              })
            }
            style={selectStyle}
          >
            <option value="standard">Standard</option>
            <option value="third_set_match_tiebreak">Third-set match tiebreak</option>
            <option value="timed_match">Timed match</option>
          </select>
        </label>
      </div>

      {line.scoreEventType === 'timed_match' ? (
        <div
          style={{
            marginTop: 12,
            borderRadius: 14,
            border: '1px solid rgba(116,190,255,0.14)',
            background: 'rgba(8,15,28,0.55)',
            padding: '10px 12px',
            ...subtleTextStyle,
            fontSize: '0.88rem',
          }}
        >
          Timed match — select the winner above, no score needed.
        </div>
      ) : line.scoreEventType === 'third_set_match_tiebreak' ? (
        <div
          style={{
            marginTop: 12,
            borderRadius: 14,
            border: '1px solid rgba(116,190,255,0.14)',
            background: 'rgba(8,15,28,0.55)',
            padding: '10px 12px',
            ...subtleTextStyle,
            fontSize: '0.88rem',
          }}
        >
          Third-set match tiebreak — winning team is recorded as 1-0 in the deciding set.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 12,
            marginTop: 12,
          }}
        >
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={subtleTextStyle}>Score text correction</span>
            <input
              defaultValue={line.rawScoreText || line.score || ''}
              onBlur={(event) =>
                onLineOverrideChange(preview.externalMatchId, line.lineNumber, {
                  scoreTextCorrection: event.target.value,
                })
              }
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: 8 }}>
            <span style={subtleTextStyle}>Admin note</span>
            <input
              onBlur={(event) =>
                onLineOverrideChange(preview.externalMatchId, line.lineNumber, {
                  adminNote: event.target.value,
                })
              }
              style={inputStyle}
              placeholder="Why this line was adjusted"
            />
          </label>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
        <button
          type="button"
          style={primaryButtonStyle}
          disabled={isRunningCommit}
          onClick={() => onApproveAndSubmitMatch(preview)}
        >
          {isRunningCommit ? 'Submitting match...' : 'Approve and submit this match'}
        </button>
        <div style={{ ...subtleTextStyle, fontSize: '0.86rem' }}>
          Your line changes already update the match preview immediately. This submits the full match using the latest line edits.
        </div>
      </div>

      {commitFeedbackMessage ? (
        <div
          style={{
            marginTop: 12,
            borderRadius: 14,
            border: '1px solid rgba(116,190,255,0.16)',
            background: 'rgba(17,34,63,0.48)',
            color: '#EAF4FF',
            padding: '10px 12px',
            fontWeight: 700,
          }}
        >
          {commitFeedbackMessage}
        </div>
      ) : null}

      {line.parseNotes.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {line.parseNotes.map((note) => (
            <span key={`${line.lineNumber}-${note}`} style={badgeStyle('slate')}>
              {note}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function PlayerCard({ title, players }: { title: string; players: string[] }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: '1px solid rgba(116,190,255,0.08)',
        background: 'rgba(8,15,28,0.55)',
        padding: '12px',
      }}
    >
      <div style={{ ...labelStyle, fontSize: '0.7rem' }}>{title}</div>
      <div style={{ ...subtleTextStyle, marginTop: 8 }}>{players.join(' / ') || '—'}</div>
    </div>
  )
}

function ValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: '1px solid rgba(116,190,255,0.08)',
        background: 'rgba(8,15,28,0.55)',
        padding: '12px',
      }}
    >
      <div style={{ ...labelStyle, fontSize: '0.7rem' }}>{label}</div>
      <div style={{ ...subtleTextStyle, marginTop: 8 }}>{value}</div>
    </div>
  )
}
