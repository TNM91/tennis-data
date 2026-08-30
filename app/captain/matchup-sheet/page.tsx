'use client'

import Link from 'next/link'
import Image from 'next/image'
import QRCode from 'qrcode'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import styles from './matchup-sheet.module.css'

type MatchupCard = {
  matchDate?: string
  opponent?: string
  matchTime?: string
  facility?: string
  lineup?: Array<{ label?: string; players?: string[] }>
}

type TeamRoomResponse = {
  ok?: boolean
  room?: {
    teamName?: string
    messages?: Array<{ card?: MatchupCard | null }>
  } | null
}

function cleanText(value: string | null | undefined) {
  return (value || '').trim().replace(/\s+/g, ' ')
}

function formatDate(value: string) {
  if (!value) return 'Date to be confirmed'
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
}

function buildRecordResultHref(input: {
  teamName: string
  leagueName: string
  flight: string
  matchDate: string
  opponent: string
  matchTime: string
  facility: string
}) {
  const params = new URLSearchParams()
  if (input.teamName) params.set('team', input.teamName)
  if (input.leagueName) params.set('league', input.leagueName)
  if (input.flight) params.set('flight', input.flight)
  if (input.matchDate) params.set('date', input.matchDate)
  if (input.opponent) params.set('opponent', input.opponent)
  if (input.matchTime) params.set('time', input.matchTime)
  if (input.facility) params.set('facility', input.facility)
  return `/captain/record-result?${params.toString()}`
}

function MatchupSheetContent() {
  const searchParams = useSearchParams()
  const { authResolved, session } = useAuth()
  const teamName = cleanText(searchParams.get('team'))
  const leagueName = cleanText(searchParams.get('league'))
  const flight = cleanText(searchParams.get('flight'))
  const requestedDate = cleanText(searchParams.get('date'))
  const requestedOpponent = cleanText(searchParams.get('opponent'))
  const requestedTime = cleanText(searchParams.get('time'))
  const requestedFacility = cleanText(searchParams.get('facility'))
  const [card, setCard] = useState<MatchupCard | null>(null)
  const [loading, setLoading] = useState(() => Boolean(teamName && requestedDate && requestedOpponent))
  const [qrCode, setQrCode] = useState('')

  const matchDate = card?.matchDate || requestedDate
  const opponent = card?.opponent || requestedOpponent
  const matchTime = card?.matchTime || requestedTime
  const facility = card?.facility || requestedFacility
  const lineup = card?.lineup || []
  const recordResultHref = useMemo(() => buildRecordResultHref({
    teamName,
    leagueName,
    flight,
    matchDate,
    opponent,
    matchTime,
    facility,
  }), [facility, flight, leagueName, matchDate, matchTime, opponent, teamName])
  const scanHref = useMemo(() => {
    const params = new URLSearchParams({
      intent: 'upload-source',
      context: `Matchup sheet: ${teamName || 'Team'}${opponent ? ` vs ${opponent}` : ''}`,
      type: 'scorecard',
      capture: 'camera',
      returnTo: recordResultHref,
    })
    return `/data-assist?${params.toString()}#upload`
  }, [opponent, recordResultHref, teamName])

  useEffect(() => {
    if (!authResolved || !session?.access_token || !teamName || !requestedDate || !requestedOpponent) return
    let active = true
    const params = new URLSearchParams({ team: teamName, date: requestedDate, opponent: requestedOpponent })
    if (leagueName) params.set('league', leagueName)
    if (flight) params.set('flight', flight)
    void fetch(`/api/team-rooms?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    })
      .then(async (response) => response.ok ? response.json() as Promise<TeamRoomResponse> : null)
      .then((payload) => {
        if (!active || !payload?.ok) return
        const expectedOpponent = requestedOpponent.toLowerCase()
        const found = (payload.room?.messages || [])
          .map((message) => message.card)
          .find((candidate) => candidate?.matchDate === requestedDate && cleanText(candidate.opponent).toLowerCase() === expectedOpponent)
        setCard(found || null)
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [authResolved, flight, leagueName, requestedDate, requestedOpponent, session?.access_token, teamName])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const absoluteUrl = new URL(recordResultHref, window.location.origin).toString()
    let active = true
    void QRCode.toDataURL(absoluteUrl, {
      width: 184,
      margin: 1,
      color: { dark: '#0b1628', light: '#ffffff' },
    }).then((value) => {
      if (active) setQrCode(value)
    }).catch(() => {
      if (active) setQrCode('')
    })
    return () => { active = false }
  }, [recordResultHref])

  return (
    <main className={styles.page}>
      <section className={styles.screenControls} aria-label="Matchup sheet actions">
        <Link href={recordResultHref} className={styles.actionSecondary}>Record results</Link>
        <Link href={scanHref} className={styles.actionSecondary}>Capture scorecard</Link>
        <button type="button" className={styles.actionPrimary} onClick={() => window.print()}>Print matchup sheet</button>
      </section>

      <article className={styles.sheet} aria-label="Printable matchup sheet">
        <header className={styles.sheetHeader}>
          <div>
            <p>TiQ Captain match sheet</p>
            <h1>{teamName || 'Team matchup'}</h1>
            <span>{leagueName || 'League'}{flight ? ` · ${flight}` : ''}</span>
          </div>
          <div className={styles.matchMeta}>
            <strong>{formatDate(matchDate)}</strong>
            <span>{matchTime || 'Time to be confirmed'}</span>
            <span>{facility || 'Location to be confirmed'}</span>
          </div>
        </header>

        <section className={styles.matchup}>
          <div>
            <span>Your team</span>
            <strong>{teamName || 'Team'}</strong>
          </div>
          <b>vs</b>
          <div>
            <span>Opponent</span>
            <strong>{opponent || 'Opponent to be confirmed'}</strong>
          </div>
        </section>

        <section className={styles.instructions}>
          <div>
            <strong>Bring this to the match.</strong>
            <span>Write scores below, then scan the code to enter a verified TiQ result.</span>
          </div>
          <div className={styles.qrBlock}>
            {qrCode ? <Image src={qrCode} alt="Scan to record this match's result in TiQ" width={94} height={94} unoptimized /> : <span>TiQ</span>}
            <small>Scan to record results</small>
          </div>
        </section>

        <section className={styles.courts} aria-label="Lineup courts">
          {lineup.length ? lineup.map((court, index) => (
            <article className={styles.court} key={`${court.label || 'Court'}-${index}`}>
              <header>
                <strong>{court.label || `Court ${index + 1}`}</strong>
                <span>Team</span>
              </header>
              <div className={styles.playerRow}>
                <p>{(court.players || []).filter(Boolean).join(' / ') || 'Player to be set'}</p>
                <span className={styles.resultBlank}>Result: __________</span>
              </div>
              <div className={styles.scoreLine}>
                <span>Opponent(s): __________________________________</span>
                <span>Score: ________________________</span>
              </div>
            </article>
          )) : (
            <div className={styles.emptyState}>
              {loading ? 'Loading the saved lineup…' : 'Save a lineup first, then print the exact courts from TiQ.'}
            </div>
          )}
        </section>

        <footer className={styles.sheetFooter}>
          <span>TiQ keeps this scorecard connected to the correct match.</span>
          <span>More Tennis. Less Chaos.</span>
        </footer>
      </article>
    </main>
  )
}

export default function MatchupSheetPage() {
  return (
    <SiteShell active="/captain">
      <Suspense fallback={<main className={styles.page}><div className={styles.loading}>Loading matchup sheet…</div></main>}>
        <MatchupSheetContent />
      </Suspense>
    </SiteShell>
  )
}
