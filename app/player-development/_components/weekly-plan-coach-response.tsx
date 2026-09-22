'use client'

import { useState } from 'react'
import type { WeeklyLevelUpPlan, WeeklyLevelUpPlayerReply } from '@/lib/level-up/weekly-plan'
import styles from './player-development.module.css'

type WeeklyPlanCoachResponseProps = {
  plan: WeeklyLevelUpPlan
  accessToken: string
  onSaved: (plan: WeeklyLevelUpPlan) => void
}

export default function WeeklyPlanCoachResponse({ plan, accessToken, onSaved }: WeeklyPlanCoachResponseProps) {
  const response = plan.coachResponse
  const [asking, setAsking] = useState(false)
  const [question, setQuestion] = useState(response?.playerReply?.action === 'question' ? response.playerReply.message : '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  if (!response) return null

  const reply = response.playerReply

  async function sendReply(action: WeeklyLevelUpPlayerReply['action']) {
    if (!accessToken || saving || (action === 'question' && !question.trim())) return
    setSaving(true)
    setMessage('')
    try {
      const fetchResponse = await fetch('/api/player/level-up-weekly-plan', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, action, message: action === 'question' ? question : '' }),
      })
      const json = await fetchResponse.json() as { ok?: boolean; plan?: WeeklyLevelUpPlan; message?: string }
      if (!fetchResponse.ok || !json.ok || !json.plan) throw new Error(json.message || 'Could not send your reply.')
      onSaved(json.plan)
      setAsking(false)
      setMessage(action === 'question' ? 'Question sent to coach.' : 'Coach notified.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send your reply.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.liveWeeklyCoachResponse} data-action={response.action}>
      <span>Coach update</span>
      <strong>
        {response.action === 'acknowledged'
          ? 'Your coach reviewed this week.'
          : response.action === 'answered'
            ? 'Your coach answered.'
          : response.action === 'adjusted'
            ? 'Your coach added a cue.'
            : `Your coach changed one rep to ${response.replacementRep?.title ?? 'a coach pick'}.`}
      </strong>
      {response.note ? <p>{response.note}</p> : null}

      {reply ? (
        <div className={styles.liveWeeklyPlayerReply} data-reply={reply.action}>
          <span>{reply.action === 'question' ? 'Question sent' : 'Coach notified'}</span>
          {reply.message ? <p>{reply.message}</p> : <strong>Got it</strong>}
        </div>
      ) : null}

      {asking ? (
        <div className={styles.liveWeeklyReplyComposer}>
          <label htmlFor={`weekly-plan-question-${plan.id}`}>Ask one short question</label>
          <textarea
            id={`weekly-plan-question-${plan.id}`}
            value={question}
            maxLength={500}
            rows={3}
            autoFocus
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What do you want your coach to clarify?"
          />
          <div>
            <button type="button" disabled={saving || !question.trim()} onClick={() => void sendReply('question')}>
              {saving ? 'Sending…' : reply?.action === 'question' ? 'Update question' : 'Send question'}
            </button>
            <button type="button" disabled={saving} onClick={() => setAsking(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className={styles.liveWeeklyReplyActions}>
          {!reply ? (
            <button type="button" disabled={!accessToken || saving} onClick={() => void sendReply('acknowledged')}>
              {saving ? 'Sending…' : 'Got it'}
            </button>
          ) : null}
          {reply?.action !== 'question' ? (
            <button type="button" disabled={!accessToken || saving} onClick={() => setAsking(true)}>Ask coach</button>
          ) : (
            <button type="button" disabled={!accessToken || saving} onClick={() => setAsking(true)}>Update question</button>
          )}
        </div>
      )}
      {!accessToken ? <p className={styles.liveWeeklyReplyStatus}>Sign in to reply.</p> : null}
      {message ? <p className={styles.liveWeeklyReplyStatus} role="status">{message}</p> : null}
    </div>
  )
}
