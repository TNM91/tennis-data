'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { LEVEL_UP_CARDS } from '@/lib/level-up/level-up-cards'
import {
  getWeeklyLevelUpPlanProgress,
  getWeeklyLevelUpPlanReps,
  type WeeklyLevelUpCoachResponse,
  type WeeklyLevelUpPlan,
} from '@/lib/level-up/weekly-plan'

type CoachSharedWeekProps = {
  plan: WeeklyLevelUpPlan
  playerName: string
  accessToken: string
  onSaved: (plan: WeeklyLevelUpPlan) => void
}

type CoachPlanAction = Exclude<WeeklyLevelUpCoachResponse['action'], 'answered'>

const actionOptions: Array<{ action: CoachPlanAction; label: string }> = [
  { action: 'acknowledged', label: 'Looks good' },
  { action: 'adjusted', label: 'Add cue' },
  { action: 'replaced', label: 'Swap rep' },
]

export default function CoachSharedWeek({ plan, playerName, accessToken, onSaved }: CoachSharedWeekProps) {
  const reps = getWeeklyLevelUpPlanReps(plan)
  const progress = getWeeklyLevelUpPlanProgress(plan)
  const firstOpenRep = reps.find((rep) => !rep.completedAt) ?? reps[0]
  const [action, setAction] = useState<CoachPlanAction | null>(null)
  const [targetRepId, setTargetRepId] = useState(firstOpenRep?.id ?? '')
  const [replacementCardId, setReplacementCardId] = useState('')
  const [note, setNote] = useState('')
  const [answer, setAnswer] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const replacementCards = useMemo(() => {
    const identityCards = LEVEL_UP_CARDS.filter((card) => card.assignable && card.identitySlugs?.includes(plan.identitySlug))
    return (identityCards.length ? identityCards : LEVEL_UP_CARDS.filter((card) => card.assignable)).slice(0, 18)
  }, [plan.identitySlug])
  const response = plan.coachResponse
  const playerReply = response?.playerReply ?? null
  const targetRep = response?.targetRepId ? plan.reps.find((rep) => rep.id === response.targetRepId) : null
  const responseLabel = response?.action === 'acknowledged'
    ? 'Plan reviewed'
    : response?.action === 'answered'
      ? 'Question answered'
    : response?.action === 'adjusted'
      ? `Cue added to ${targetRep?.title ?? 'one rep'}`
      : response?.action === 'replaced'
        ? `Rep changed to ${response.replacementRep?.title ?? 'coach pick'}`
        : ''
  const canSend = Boolean(action) && !saving
    && (action === 'acknowledged' || Boolean(targetRepId))
    && (action !== 'adjusted' || Boolean(note.trim()))
    && (action !== 'replaced' || Boolean(replacementCardId))

  function chooseAction(nextAction: CoachPlanAction) {
    setAction(nextAction)
    setMessage('')
    if (nextAction === 'acknowledged') {
      setNote('Plan looks good. Keep the week simple and finish the next rep.')
      return
    }
    const nextRep = reps.find((rep) => nextAction !== 'replaced' || !rep.completedAt) ?? reps[0]
    setTargetRepId(nextRep?.id ?? '')
    setNote(nextAction === 'adjusted' ? '' : 'Use this coach pick for the same tennis focus.')
    if (nextAction === 'replaced') setReplacementCardId((current) => current || replacementCards[0]?.id || '')
  }

  async function saveResponse(
    payload: {
      action: WeeklyLevelUpCoachResponse['action']
      note: string
      targetRepId: string | null
      replacementCardId: string | null
    },
    successMessage: string,
  ) {
    setSaving(true)
    setMessage('')
    try {
      const fetchResponse = await fetch('/api/coach/level-up-weekly-plans', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, ...payload }),
      })
      const json = await fetchResponse.json() as { ok?: boolean; plan?: WeeklyLevelUpPlan; message?: string }
      if (!fetchResponse.ok || !json.ok || !json.plan) throw new Error(json.message || 'Could not send this coach update.')
      onSaved(json.plan)
      setMessage(successMessage)
      return true
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send this coach update.')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function sendResponse() {
    if (!action || !canSend) return
    const saved = await saveResponse({
      action,
      note,
      targetRepId: action === 'acknowledged' ? null : targetRepId,
      replacementCardId: action === 'replaced' ? replacementCardId : null,
    }, 'Player plan updated.')
    if (saved) setAction(null)
  }

  async function answerQuestion() {
    if (playerReply?.action !== 'question' || saving || !answer.trim()) return
    const saved = await saveResponse({
      action: 'answered',
      note: answer,
      targetRepId: null,
      replacementCardId: null,
    }, 'Answer sent to player.')
    if (saved) setAnswer('')
  }

  return (
    <section style={shellStyle} aria-label={`${playerName} shared Level Up week`}>
      <div style={headerStyle}>
        <div>
          <span style={eyebrowStyle}>Shared Level Up week</span>
          <strong style={titleStyle}>{progress.completed}/{progress.total} reps</strong>
        </div>
        <span style={playerReply?.action === 'question' ? questionStatusStyle : statusStyle}>
          {playerReply?.action === 'question' ? 'Player question' : progress.complete ? 'Complete' : 'Coach review'}
        </span>
      </div>
      <p style={nextStyle}>
        {progress.complete ? 'Week complete. Use the proof trail for the next lesson.' : `Next: ${progress.nextRep?.title ?? plan.strongestFocus}`}
      </p>
      <div style={repGridStyle}>
        {reps.map((rep) => (
          <span key={rep.id} style={rep.completedAt ? repDoneStyle : repStyle} title={rep.title}>
            {rep.completedAt ? '✓' : '○'} {rep.title}
          </span>
        ))}
      </div>
      {playerReply ? (
        <div style={playerReply.action === 'question' ? questionStyle : acknowledgedStyle} aria-live="polite">
          <span>{playerReply.action === 'question' ? 'Player question' : 'Player got it'}</span>
          {playerReply.message ? <strong>{playerReply.message}</strong> : <strong>Coach update received.</strong>}
          {playerReply.action === 'question' ? (
            <div style={answerComposerStyle}>
              <label htmlFor={`coach-answer-${plan.id}`}>Your answer</label>
              <textarea
                id={`coach-answer-${plan.id}`}
                value={answer}
                maxLength={500}
                rows={3}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Give one clear answer."
                style={textareaStyle}
              />
              <button
                type="button"
                style={sendStyle}
                disabled={!accessToken || saving || !answer.trim()}
                onClick={() => void answerQuestion()}
              >
                {saving ? 'Sending…' : 'Answer player'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {response ? (
        <div style={sentStyle}>
          <span>Sent to player</span>
          <strong>{responseLabel}</strong>
          {response.note ? <p>{response.note}</p> : null}
        </div>
      ) : null}
      <div style={actionRowStyle} aria-label="Coach weekly plan response">
        {actionOptions.map((option) => (
          <button
            key={option.action}
            type="button"
            aria-pressed={action === option.action}
            style={action === option.action ? activeActionStyle : actionStyle}
            onClick={() => chooseAction(option.action)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {action ? (
        <div style={editorStyle}>
          {action !== 'acknowledged' ? (
            <label style={fieldStyle}>
              <span>Rep</span>
              <select value={targetRepId} onChange={(event) => setTargetRepId(event.target.value)} style={controlStyle}>
                {reps.map((rep) => (
                  <option key={rep.id} value={rep.id} disabled={action === 'replaced' && Boolean(rep.completedAt)}>
                    {rep.completedAt ? 'Done · ' : ''}{rep.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {action === 'replaced' ? (
            <label style={fieldStyle}>
              <span>Coach pick</span>
              <select value={replacementCardId} onChange={(event) => setReplacementCardId(event.target.value)} style={controlStyle}>
                {replacementCards.map((card) => <option key={card.id} value={card.id}>{card.title}</option>)}
              </select>
            </label>
          ) : null}
          <label style={fieldStyle}>
            <span>{action === 'adjusted' ? 'Your cue' : 'Note to player'}</span>
            <textarea
              value={note}
              maxLength={500}
              rows={3}
              onChange={(event) => setNote(event.target.value)}
              placeholder={action === 'adjusted' ? 'Give one short cue for this rep.' : 'Optional short note'}
              style={textareaStyle}
            />
          </label>
          <div style={editorActionsStyle}>
            <button type="button" style={sendStyle} disabled={!canSend} onClick={() => void sendResponse()}>
              {saving ? 'Sending…' : response ? 'Update player plan' : 'Send to player'}
            </button>
            <button type="button" style={cancelStyle} onClick={() => setAction(null)}>Cancel</button>
          </div>
        </div>
      ) : null}
      {message ? <p style={messageStyle} role="status">{message}</p> : null}
    </section>
  )
}

const shellStyle: CSSProperties = {
  display: 'grid', gap: 9, border: '1px solid rgba(155,225,29,0.24)', borderRadius: 14,
  background: 'linear-gradient(135deg, rgba(155,225,29,0.1), rgba(4,17,28,0.72))', padding: 11,
}
const headerStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }
const eyebrowStyle: CSSProperties = { display: 'block', color: 'var(--shell-copy-muted)', fontSize: 10, fontWeight: 950, letterSpacing: '.08em', textTransform: 'uppercase' }
const titleStyle: CSSProperties = { display: 'block', marginTop: 2, color: 'var(--foreground-strong)', fontSize: 14, fontWeight: 950 }
const statusStyle: CSSProperties = { border: '1px solid rgba(155,225,29,0.28)', borderRadius: 999, color: 'var(--brand-green)', padding: '4px 8px', fontSize: 10, fontWeight: 950 }
const questionStatusStyle: CSSProperties = { ...statusStyle, borderColor: 'rgba(255,196,87,0.38)', background: 'rgba(255,196,87,0.1)', color: '#ffd27a' }
const nextStyle: CSSProperties = { margin: 0, color: 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 780, lineHeight: 1.35 }
const repGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 145px), 1fr))', gap: 6 }
const repStyle: CSSProperties = { minWidth: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, background: 'rgba(3,12,24,0.46)', color: 'var(--shell-copy-muted)', padding: '7px 8px', fontSize: 11, fontWeight: 820, lineHeight: 1.25, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const repDoneStyle: CSSProperties = { ...repStyle, borderColor: 'rgba(155,225,29,0.28)', color: 'var(--brand-green-3)' }
const sentStyle: CSSProperties = { display: 'grid', gap: 3, border: '1px solid rgba(116,190,255,0.2)', borderRadius: 11, background: 'rgba(116,190,255,0.08)', color: 'var(--shell-copy-muted)', padding: 9, fontSize: 11, lineHeight: 1.35 }
const acknowledgedStyle: CSSProperties = { display: 'grid', gap: 3, border: '1px solid rgba(155,225,29,0.3)', borderRadius: 11, background: 'rgba(155,225,29,0.09)', color: 'var(--brand-green-3)', padding: 9, fontSize: 11, lineHeight: 1.35 }
const questionStyle: CSSProperties = { ...acknowledgedStyle, borderColor: 'rgba(255,196,87,0.38)', background: 'rgba(255,196,87,0.1)', color: '#ffd27a' }
const answerComposerStyle: CSSProperties = { display: 'grid', gap: 7, marginTop: 4, color: 'var(--shell-copy-muted)', fontSize: 10, fontWeight: 950, letterSpacing: '.06em', textTransform: 'uppercase' }
const actionRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }
const actionStyle: CSSProperties = { minWidth: 0, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, background: 'rgba(255,255,255,0.055)', color: 'var(--foreground-strong)', padding: '8px 6px', fontSize: 11, fontWeight: 900, cursor: 'pointer' }
const activeActionStyle: CSSProperties = { ...actionStyle, borderColor: 'rgba(155,225,29,0.4)', background: 'rgba(155,225,29,0.14)', color: 'var(--brand-green)' }
const editorStyle: CSSProperties = { display: 'grid', gap: 9, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 9 }
const fieldStyle: CSSProperties = { display: 'grid', gap: 5, color: 'var(--shell-copy-muted)', fontSize: 10, fontWeight: 950, letterSpacing: '.06em', textTransform: 'uppercase' }
const controlStyle: CSSProperties = { width: '100%', minWidth: 0, border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, background: '#091729', color: 'var(--foreground-strong)', padding: '9px 10px', font: 'inherit', textTransform: 'none' }
const textareaStyle: CSSProperties = { ...controlStyle, resize: 'vertical', lineHeight: 1.4 }
const editorActionsStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 7 }
const sendStyle: CSSProperties = { flex: '1 1 150px', border: 0, borderRadius: 999, background: 'var(--brand-green)', color: '#071226', padding: '9px 12px', fontSize: 11, fontWeight: 950, cursor: 'pointer' }
const cancelStyle: CSSProperties = { border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, background: 'transparent', color: 'var(--foreground-strong)', padding: '9px 12px', fontSize: 11, fontWeight: 900, cursor: 'pointer' }
const messageStyle: CSSProperties = { margin: 0, color: 'var(--brand-green-3)', fontSize: 11, fontWeight: 850 }
