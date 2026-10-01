'use client'

import { ArrowRight, CalendarBlank, CheckCircle, Clock, Flask, MapPin, UsersThree, XCircle } from '@phosphor-icons/react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import LocationDirectionsLink from '@/app/components/location-directions-link'
import PremiumLeagueCourt from '@/app/components/premium-league-court'
import { ROTATING_PARTNER_DOUBLES_FORMAT, validateLeagueWeeklySetScore, type LeagueWeeklyCourt } from '@/lib/league-weekly-format'
import { MEMBERSHIP_TIERS } from '@/lib/product-story'
import styles from './weekly-league-response.module.css'

type WeeklyPayload = {
  league: { name: string; logoUrl: string; facility: string; players: string[]; weeklySettings: { collectPlayerStories: boolean } }
  week: {
    playOn: string
    responseDeadline: string | null
    status: string
    roster: string[]
    assignments: LeagueWeeklyCourt[]
    results: Array<{ court_number: number; set_number: number; side_a_games: number; side_b_games: number; submitted_by_name: string; review_status: 'pending' | 'confirmed' | 'disputed' | 'approved' }>
  }
}

const STORY_PROMPTS = [
  'Teammate shoutout',
  'Best point',
  'Great sportsmanship',
  'Fun moment',
] as const

function formatPlayDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(parsed)
}

function formatStartTime(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return value
  const hour = Number(match[1])
  const minute = match[2]
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`
}

export default function WeeklyLeagueResponse({ token }: { token: string }) {
  const [data, setData] = useState<WeeklyPayload | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [responseStatus, setResponseStatus] = useState<'in' | 'out'>('in')
  const [note, setNote] = useState('')
  const [positiveShare, setPositiveShare] = useState('')
  const [scores, setScores] = useState<Record<string, { a: string; b: string }>>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/leagues/weekly/${encodeURIComponent(token)}`)
    const payload = await response.json()
    if (!response.ok) setMessage(payload.message || 'This weekly league link could not be opened.')
    else setData(payload)
  }, [token])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [refresh])

  const assignedCourt = useMemo(
    () => data?.week.assignments.find((court) => court.players.includes(playerName)),
    [data?.week.assignments, playerName],
  )

  async function submit(body: Record<string, unknown>) {
    setBusy(true)
    try {
      const response = await fetch(`/api/leagues/weekly/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, playerName }),
      })
      const payload = await response.json()
      setMessage(payload.message || (response.ok ? 'Saved.' : 'That update could not be saved.'))
      if (response.ok) await refresh()
    } catch {
      setMessage('That update could not be saved. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  function chooseResponse(nextStatus: 'in' | 'out') {
    if (busy) return
    setResponseStatus(nextStatus)
    if (!playerName) {
      setMessage('Choose your name first, then tap your response.')
      return
    }
    void submit({ action: 'rsvp', responseStatus: nextStatus, note, positiveShare })
  }

  async function submitScorecard(court: LeagueWeeklyCourt) {
    const scorecard = court.sets.map((set) => {
      const key = `${court.courtNumber}-${set.setNumber}`
      const saved = data?.week.results.find((result) => result.court_number === court.courtNumber && result.set_number === set.setNumber)
      const rawA = scores[key]?.a ?? saved?.side_a_games ?? ''
      const rawB = scores[key]?.b ?? saved?.side_b_games ?? ''
      const sideAGames = rawA === '' ? Number.NaN : Number(rawA)
      const sideBGames = rawB === '' ? Number.NaN : Number(rawB)
      return { setNumber: set.setNumber, sideAGames, sideBGames, validation: validateLeagueWeeklySetScore(sideAGames, sideBGames) }
    })
    const invalid = scorecard.find((set) => !set.validation.valid)
    if (invalid) {
      setMessage(`Set ${invalid.setNumber}: ${invalid.validation.message}`)
      return
    }

    setBusy(true)
    try {
      const responses = await Promise.all(scorecard.map((set) => fetch(`/api/leagues/weekly/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'score', playerName, courtNumber: court.courtNumber, setNumber: set.setNumber, sideAGames: set.sideAGames, sideBGames: set.sideBGames, positiveShare }),
      })))
      const payloads = await Promise.all(responses.map((response) => response.json() as Promise<{ message?: string }>))
      const failedIndex = responses.findIndex((response) => !response.ok)
      if (failedIndex >= 0) setMessage(payloads[failedIndex]?.message || 'The scorecard could not be saved.')
      else {
        setMessage('All three set scores are saved.')
        await refresh()
      }
    } catch {
      setMessage('The scorecard could not be saved. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!data) return <main className={styles.page}><section className={styles.loading}><span className={styles.loadingBall} /><h1>Opening this week</h1><p>{message || 'Getting the court ready…'}</p></section></main>

  const collecting = data.week.status === 'collecting'
  const weekDate = formatWeekDate(data.week.playOn)
  const deadline = formatDeadline(data.week.responseDeadline)
  const activeStep = collecting ? 0 : assignedCourt ? 2 : 1

  return (
    <main className={styles.page} data-weekly-response-page>
      <section className={styles.hero} aria-labelledby="weekly-league-title">
        <div className={styles.leagueBar}>
          <div className={styles.leagueIdentity}>
            {data.league.logoUrl ? (
              // User-supplied league logos can be hosted on arbitrary domains.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.league.logoUrl} alt="" className={styles.leagueLogo} />
            ) : <span className={styles.leagueMonogram}><UsersThree size={22} weight="fill" /></span>}
            <div><span>TIQ League</span><strong id="weekly-league-title">{data.league.name}</strong></div>
          </div>
          <Link href="/my-leagues" className={styles.labLink}><Flask size={18} weight="duotone" />My TIQ Leagues<ArrowRight size={16} /></Link>
        </div>
        <div className={styles.weekHero}>
          <p className={styles.kicker}>Plan the week</p>
          <h1 aria-label={formatPlayDate(data.week.playOn)}><span>{weekDate.weekday},</span> {weekDate.monthDay}</h1>
          <div className={styles.weekMeta}>
            <span><Clock size={22} weight="duotone" />{assignedCourt ? formatStartTime(assignedCourt.startTime) : 'Thursday night'} · {data.league.facility || 'League site'}</span>
            <span><CalendarBlank size={22} weight="duotone" />{deadline}</span>
          </div>
        </div>
      </section>

      <section className={styles.identityBar}>
        <label htmlFor="weekly-player-name">Playing as</label>
        <select id="weekly-player-name" value={playerName} onChange={(event) => setPlayerName(event.target.value)}>
          <option value="">Choose your name</option>
          {data.league.players.map((player) => <option key={player}>{player}</option>)}
        </select>
      </section>

      {collecting ? (
        <section className={styles.decision} aria-labelledby="weekly-response-title">
          <div className={styles.decisionHeading}><p className={styles.kicker}>Your response</p><h2 id="weekly-response-title">Are you playing?</h2><p>Same great people. More great tennis.</p></div>
          <div className={styles.choiceRow}>
            <button type="button" disabled={busy} aria-pressed={responseStatus === 'in'} onClick={() => chooseResponse('in')} className={responseStatus === 'in' ? styles.choiceSelected : styles.choice}><CheckCircle size={29} weight="fill" /><span>I’m in</span><ArrowRight size={20} /></button>
            <button type="button" disabled={busy} aria-pressed={responseStatus === 'out'} onClick={() => chooseResponse('out')} className={responseStatus === 'out' ? styles.choiceSelected : styles.choice}><XCircle size={29} weight="duotone" /><span>I’m out</span><ArrowRight size={20} /></button>
          </div>
          <button type="button" className={styles.decideLater} onClick={() => setMessage('Nothing saved yet. Come back before the response deadline.')}><Clock size={19} />Decide later</button>
          <details className={styles.responseDetails}>
            <summary>Add a note or share a league moment</summary>
            <div className={styles.detailFields}>
              <label>Note for League Office<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Timing or anything the coordinator should know" /></label>
              {data.league.weeklySettings.collectPlayerStories ? <label>Positive share<textarea value={positiveShare} onChange={(event) => setPositiveShare(event.target.value)} placeholder="A thank-you, great point, or fun moment for the recap" /></label> : null}
              <button disabled={busy || !playerName} onClick={() => void submit({ action: 'rsvp', responseStatus, note, positiveShare })} className={styles.saveButton}>{busy ? 'Saving…' : `Update response: I’m ${responseStatus}`}<ArrowRight size={20} /></button>
            </div>
          </details>
        </section>
      ) : assignedCourt ? (
        <section className={styles.scorecard} aria-labelledby="weekly-scorecard-title">
          <p className={styles.kicker}>Court {assignedCourt.courtNumber} · {formatStartTime(assignedCourt.startTime)}</p>
          <h2 id="weekly-scorecard-title">Your three sets</h2>
          <p className={styles.rule}>{ROTATING_PARTNER_DOUBLES_FORMAT.scoringSummary} {ROTATING_PARTNER_DOUBLES_FORMAT.entrySummary}</p>
          <div className={styles.setList}>
            {assignedCourt.sets.map((set) => {
              const key = `${assignedCourt.courtNumber}-${set.setNumber}`
              const saved = data.week.results.find((result) => result.court_number === assignedCourt.courtNumber && result.set_number === set.setNumber)
              return <div key={key} className={styles.setRow}><div><span>Set {set.setNumber}</span><strong>{set.sideA.join(' + ')} <small>vs</small> {set.sideB.join(' + ')}</strong>{saved ? <em data-tone={saved.review_status === 'disputed' ? 'warning' : 'success'}>{saved.review_status === 'confirmed' ? 'Players agree' : saved.review_status === 'approved' ? 'League approved' : saved.review_status === 'disputed' ? 'Needs league review' : `Submitted by ${saved.submitted_by_name}`}</em> : <em>Score needed</em>}</div><div className={styles.scoreInputs}><input aria-label={`Set ${set.setNumber} first side games`} type="number" inputMode="numeric" min={0} max={7} value={scores[key]?.a ?? saved?.side_a_games ?? ''} onChange={(event) => setScores((current) => ({ ...current, [key]: { a: event.target.value, b: current[key]?.b ?? String(saved?.side_b_games ?? '') } }))} /><span>–</span><input aria-label={`Set ${set.setNumber} second side games`} type="number" inputMode="numeric" min={0} max={7} value={scores[key]?.b ?? saved?.side_b_games ?? ''} onChange={(event) => setScores((current) => ({ ...current, [key]: { a: current[key]?.a ?? String(saved?.side_a_games ?? ''), b: event.target.value } }))} /></div></div>
            })}
          </div>
          {data.league.weeklySettings.collectPlayerStories ? (
            <div className={styles.storyCard}>
              <div>
                <strong>Share a highlight or shoutout</strong>
                <p>Optional. Give League Office a positive moment for this week&apos;s recap.</p>
              </div>
              <div className={styles.storyPromptRow} aria-label="Recap prompt ideas">
                {STORY_PROMPTS.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => setPositiveShare((current) => current.trim() ? current : `${prompt}: `)}>{prompt}</button>
                ))}
              </div>
              <label className={styles.storyField}>Your moment<textarea value={positiveShare} onChange={(event) => setPositiveShare(event.target.value)} placeholder="What happened, and who deserves the credit?" /></label>
            </div>
          ) : null}
          <button disabled={busy} onClick={() => void submitScorecard(assignedCourt)} className={styles.saveButton}>{busy ? 'Saving scorecard…' : 'Submit all three set scores'}<ArrowRight size={20} /></button>
        </section>
      ) : playerName ? <section className={styles.emptyState}><h2>You’re not on a court this week</h2><p>Check with League Office if the roster changed.</p></section> : null}

      <section className={styles.courtBoard} aria-label="This week at a glance">
        <div className={styles.courtImage}>
          <PremiumLeagueCourt />
          <div className={styles.waveLabel}><span>Thursday night</span><strong>{assignedCourt ? formatStartTime(assignedCourt.startTime) : '8:00 · 8:30'}</strong></div>
        </div>
        <div className={styles.publishNote}><UsersThree size={25} weight="duotone" /><div><strong>{assignedCourt ? `Court ${assignedCourt.courtNumber} is ready` : 'Two start waves'}</strong><span>{assignedCourt ? assignedCourt.players.join(' · ') : 'Court, partners, and start time publish Thursday morning.'}</span></div></div>
      </section>

      <section className={styles.locationRow}><MapPin size={29} weight="duotone" /><div><strong>{data.league.facility || 'League site'}</strong><span>Open the court location in your maps app.</span></div><LocationDirectionsLink location={data.league.facility} className={styles.directionsLink} /></section>

      <nav className={styles.journey} aria-label="Weekly league journey">
        {['Response', 'Court', 'Scores', 'Recap'].map((step, index) => <div key={step} data-state={index < activeStep ? 'done' : index === activeStep ? 'active' : 'next'}><span>{index < activeStep ? '✓' : index + 1}</span><strong>{step}</strong></div>)}
      </nav>

      <section className={styles.playerPath} aria-labelledby="weekly-player-path-title">
        <div><p>Your TIQ player path</p><h2 id="weekly-player-path-title">Keep this league connected to your game.</h2><span>Connect your player profile so accepted sets can follow you into My TIQ Leagues. {MEMBERSHIP_TIERS.player_plus.upgradeCue}</span></div>
        <div className={styles.playerPathActions}><Link href="/profile">Connect your player profile</Link><Link href="/pricing#player_plus">See Player</Link></div>
        <small>Weekly replies, court assignments, scores, and basic standings stay part of your league experience.</small>
      </section>
      {message ? <p className={styles.message} role="status">{message}</p> : null}
    </main>
  )
}

function formatWeekDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return { weekday: 'This week', monthDay: value }
  return { weekday: parsed.toLocaleDateString(undefined, { weekday: 'long' }), monthDay: parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }
}

function formatDeadline(value: string | null) {
  if (!value) return 'Response deadline coming soon'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Response deadline coming soon'
  return `Respond by ${parsed.toLocaleDateString(undefined, { weekday: 'long' })} at ${parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: parsed.getMinutes() ? '2-digit' : undefined })}`
}
