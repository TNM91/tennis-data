'use client'

import { useId, useMemo, useRef, useState, type FormEvent } from 'react'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import { formatCalendarDay, isValidCalendarDate } from '@/lib/calendar-date'
import type { TiqLeagueCalendarRow } from '@/lib/tiq-league-calendar'
import {
  buildLeagueDraftContext,
  buildLeagueMatchDraft,
  findLeagueDraftBatchConflicts,
  leagueDraftOpenSlots,
  type LeagueDraftMatch,
  type LeagueDraftPair,
  type LeagueDraftParticipant,
} from '@/lib/tiq-league-match-draft'
import type { TiqLeagueBatchMatch, TiqLeagueBatchResult, TiqLeagueScheduleItem } from '@/lib/tiq-league-schedule-service'
import styles from './league-match-draft.module.css'

type Props = {
  weeks: TiqLeagueCalendarRow[]
  defaultTime: string
  defaultFacility: string
  timeZoneLabel: string
  earliestDate: string
  latestDate: string
  sites: string[]
  participants: LeagueDraftParticipant[]
  schedule: TiqLeagueScheduleItem[]
  played: LeagueDraftPair[]
  remainingMatchEvents: number
  scheduleReady: boolean
  editorBusy: boolean
  onReview: (match: LeagueDraftMatch) => void
  onPublish: (matches: TiqLeagueBatchMatch[], matchesPerStart: number) => Promise<TiqLeagueBatchResult>
}

export default function LeagueMatchDraft({
  weeks, defaultTime, defaultFacility, timeZoneLabel, earliestDate, latestDate, sites, participants, schedule, played,
  remainingMatchEvents, scheduleReady, editorBusy, onReview, onPublish,
}: Props) {
  const sitesId = useId()
  const [excluded, setExcluded] = useState<string[]>([])
  const [time, setTime] = useState(defaultTime.slice(0, 5))
  const [facility, setFacility] = useState(defaultFacility)
  const [capacity, setCapacity] = useState('1')
  const [draft, setDraft] = useState<ReturnType<typeof buildLeagueMatchDraft> | null>(null)
  const [omittedMatches, setOmittedMatches] = useState<string[]>([])
  const [pending, setPending] = useState<TiqLeagueBatchMatch[] | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishStatus, setPublishStatus] = useState('')
  const publishInFlight = useRef(false)
  const locked = publishing || pending !== null
  const selected = weeks.filter(({ date }) => !excluded.includes(date))
  const context = useMemo(() => buildLeagueDraftContext(participants, schedule, played), [participants, schedule, played])
  const selectedMatches = (draft?.rows ?? []).filter((row) => !omittedMatches.includes(row.key) && !context.pairs.has(row.key))
  const batchConflicts = findLeagueDraftBatchConflicts(selectedMatches, context, Number(capacity))
  const issue = !scheduleReady ? 'Load the league schedule before drafting matches.'
    : participants.length < 2 ? 'Add at least two participants to plan matches.'
    : !context.unique ? 'Use a distinct name for each participant before drafting matches.'
    : !weeks.length ? 'Set a play day and upcoming season dates in League Office.'
    : remainingMatchEvents <= 0 ? 'This season has reached its match limit.'
    : ''

  function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (issue || !selected.length || locked) return
    setOmittedMatches([])
    setPublishStatus('')
    setDraft(buildLeagueMatchDraft({
      context, weeks: selected, time, facility,
      simultaneousMatches: Number(capacity), remainingMatchEvents,
    }))
  }

  function reviewStatus(match: LeagueDraftMatch) {
    if (context.pairs.has(match.key)) return 'Already on the schedule or recorded.'
    if (context.byValue.get(match.a.value)?.playerName !== match.a.playerName
        || context.byValue.get(match.b.value)?.playerName !== match.b.playerName) return 'The roster changed. Preview again.'
    if (!isValidCalendarDate(match.date) || match.date < earliestDate || latestDate && match.date > latestDate) {
      return 'Choose an upcoming date within the season.'
    }
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(match.time) || !match.facility.trim()) return 'Add a start time and venue.'
    const day = context.days.get(match.date)
    if (day?.busy.has(match.a.value) || day?.busy.has(match.b.value)
        || leagueDraftOpenSlots(day, match.facility, match.time, Number(capacity)) === 0) return 'This slot is booked. Choose another date, time, or venue.'
    return issue
  }

  const batchIssue = selectedMatches.length > remainingMatchEvents ? 'Select fewer matches to stay within the season limit.' : ''
  const canPublish = selectedMatches.length > 0 && !batchIssue
    && !selectedMatches.some((match) => reviewStatus(match) || batchConflicts.has(match.key))

  function editSlot(key: string, field: 'date' | 'time' | 'facility', value: string) {
    setDraft((current) => current && ({
      ...current,
      rows: current.rows.map((row) => row.key === key ? { ...row, [field]: value } : row),
    }))
    setPublishStatus('')
  }

  async function publish() {
    if (publishInFlight.current || editorBusy || (!pending && !canPublish)) return
    const matches = pending ?? selectedMatches.map((match) => ({ ...match, id: crypto.randomUUID() }))
    publishInFlight.current = true
    setPending(matches)
    setPublishing(true)
    setPublishStatus('Publishing matches…')
    try {
      const result = await onPublish(matches, Number(capacity))
      setPending(null)
      if (!result.ok) {
        setPublishStatus(result.message)
        return
      }
      const saved = new Set(matches.map(({ key }) => key))
      setDraft((current) => {
        if (!current) return current
        const rows = current.rows.filter(({ key }) => !saved.has(key))
        return rows.length || current.unplaced ? { ...current, rows } : null
      })
      setPublishStatus(`Published ${result.ids.length} ${result.ids.length === 1 ? 'match' : 'matches'} to the league schedule.`)
    } catch {
      setPublishStatus('The save could not be confirmed. Check this publish before changing the batch.')
    } finally {
      publishInFlight.current = false
      setPublishing(false)
    }
  }

  return (
    <details className={styles.planner}>
      <summary><TiqFeatureIcon name="schedule" size="sm" variant="ghost" /> Plan season matches</summary>
      <div className={styles.body}>
        <p>Pick the weeks, start time, and venue for one round robin. Review the matchups, adjust exceptions, then publish the selected matches.</p>
        {issue && !draft ? <p role="status">{issue}</p> : null}
        {weeks.length ? (
          <form className={styles.form} onSubmit={preview}>
            <fieldset className={styles.weeks} disabled={locked}>
              <legend>Season weeks</legend>
              {weeks.map(({ week, date }) => (
                <label key={date}>
                  <input
                    type="checkbox"
                    checked={!excluded.includes(date)}
                    onChange={(event) => {
                      const included = event.target.checked
                      setExcluded((current) => included ? current.filter((item) => item !== date) : [...current, date])
                      setDraft(null)
                    }}
                  />
                  <span><strong>Week {week}</strong> · {formatCalendarDay(date, false)}</span>
                </label>
              ))}
            </fieldset>
            <div className={styles.fields}>
              <label>
                <span>Start time · {timeZoneLabel}</span>
                <input type="time" value={time} required disabled={locked} onChange={(event) => { setTime(event.target.value); setDraft(null) }} />
              </label>
              <label>
                <span>Venue</span>
                <input type="text" list={sitesId} value={facility} required maxLength={160} disabled={locked} onChange={(event) => { setFacility(event.target.value); setDraft(null) }} />
                <datalist id={sitesId}>{sites.map((site) => <option key={site} value={site} />)}</datalist>
              </label>
              <label>
                <span>Matches at the same time</span>
                <input type="number" min={1} max={32} value={capacity} required disabled={locked} onChange={(event) => { setCapacity(event.target.value); setDraft(null) }} />
              </label>
            </div>
            <div><button type="submit" className={styles.primary} disabled={locked || Boolean(issue) || !selected.length || !facility.trim()}>Preview matchups</button></div>
          </form>
        ) : null}
        {draft ? (
          <div className={styles.preview}>
            <p role="status">
              {draft.rows.length ? `${draft.rows.length} proposed ${draft.rows.length === 1 ? 'match' : 'matches'}.`
                : draft.unplaced ? 'No open slots for these pairings.' : 'Every pairing is already scheduled or recorded.'}
              {draft.unplaced ? ` ${draft.unplaced} ${draft.unplaced === 1 ? 'pairing still needs' : 'pairings still need'} a slot.` : ''}
            </p>
            {editorBusy && !publishing ? <p>Finish your current match edit to review or publish this draft.</p> : null}
            {draft.rows.length ? (
              <ol className={styles.matches}>
                {draft.rows.map((match) => {
                  const alreadySaved = context.pairs.has(match.key)
                  const status = reviewStatus(match)
                  const conflict = batchConflicts.get(match.key)
                  const pairing = `${match.a.playerName} vs ${match.b.playerName}`
                  return (
                    <li key={match.key}>
                      <div className={styles.matchSummary}>
                        <label className={styles.pick}>
                          <input type="checkbox" aria-label={`Include ${pairing}`} disabled={locked || alreadySaved}
                            checked={!alreadySaved && !omittedMatches.includes(match.key)}
                            onChange={(event) => {
                              const included = event.target.checked
                              setOmittedMatches((current) => included ? current.filter((key) => key !== match.key) : [...current, match.key])
                            }} />
                          <strong>{pairing}</strong>
                        </label>
                        <p>{formatCalendarDay(match.date, false)} · {match.time || 'Time pending'} · {match.facility || 'Venue pending'}</p>
                        {status ? <p>{status}</p> : null}
                        {!status && conflict ? <p>{conflict}</p> : null}
                      </div>
                      <button type="button" className={styles.review} disabled={locked || editorBusy || Boolean(status)}
                        aria-label={`Review match: ${pairing}`}
                        onClick={() => onReview(match)}>
                        Review match
                      </button>
                      {!alreadySaved ? (
                        <details className={styles.slot}>
                          <summary aria-label={`Adjust slot for ${pairing}`}>Adjust slot</summary>
                          <fieldset className={styles.fields} disabled={locked}>
                            <label><span>Date</span><input type="date" min={earliestDate} max={latestDate || undefined} value={match.date}
                              onChange={(event) => editSlot(match.key, 'date', event.target.value)} /></label>
                            <label><span>Start time</span><input type="time" value={match.time}
                              onChange={(event) => editSlot(match.key, 'time', event.target.value)} /></label>
                            <label><span>Venue</span><input type="text" list={sitesId} maxLength={160} value={match.facility}
                              onChange={(event) => editSlot(match.key, 'facility', event.target.value)} /></label>
                          </fieldset>
                        </details>
                      ) : null}
                    </li>
                  )
                })}
              </ol>
            ) : null}
            {batchIssue && !pending ? <p>{batchIssue}</p> : null}
            {draft.rows.length || pending ? (
              <div>
                <button type="button" className={styles.primary} disabled={publishing || editorBusy || (!pending && !canPublish)} onClick={() => void publish()}>
                  {publishing ? 'Publishing…' : pending ? 'Check publish'
                    : `Publish ${selectedMatches.length} ${selectedMatches.length === 1 ? 'match' : 'matches'}`}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {publishStatus ? <p role="status">{publishStatus}</p> : null}
      </div>
    </details>
  )
}
