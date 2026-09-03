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

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Image could not be loaded.'))
    image.src = src
  })
}

async function createLineupImage(input: {
  teamName: string
  leagueName: string
  flight: string
  matchDate: string
  opponent: string
  matchTime: string
  facility: string
  confirmed: boolean
  lineup: Array<{ label?: string; players?: string[] }>
}) {
  const courtHeight = 146
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 390 + Math.max(input.lineup.length, 1) * courtHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Lineup image could not be created.')

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, '#0b1f3b')
  gradient.addColorStop(0.52, '#0c2746')
  gradient.addColorStop(1, '#102d26')
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)

  const topBar = context.createLinearGradient(0, 0, canvas.width, 0)
  topBar.addColorStop(0, '#9be11d')
  topBar.addColorStop(0.6, '#d7ff4a')
  topBar.addColorStop(1, '#78b9ee')
  context.fillStyle = topBar
  context.fillRect(0, 0, canvas.width, 10)

  context.fillStyle = 'rgba(182, 242, 72, 0.16)'
  context.beginPath()
  context.arc(1040, 120, 255, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = 'rgba(78, 146, 224, 0.12)'
  context.beginPath()
  context.arc(160, canvas.height - 80, 330, 0, Math.PI * 2)
  context.fill()

  try {
    const logo = await loadCanvasImage('/brand/web/header-logo-transparent.png')
    context.drawImage(logo, 70, 50, 300, 78)
  } catch {
    // The share card remains usable if the approved logo asset is temporarily unavailable.
  }
  context.fillStyle = '#c7ef7a'
  context.font = '900 20px Arial, sans-serif'
  context.fillText('CAPTAIN LINEUP', 70, 174)
  context.fillStyle = '#173b61'
  context.beginPath()
  context.roundRect(930, 54, 202, 44, 22)
  context.fill()
  context.fillStyle = '#d7ff78'
  context.font = '900 15px Arial, sans-serif'
  context.textAlign = 'center'
  context.fillText(input.confirmed ? 'CONFIRMED LINEUP' : 'MATCH LINEUP', 1031, 82)
  context.textAlign = 'left'
  context.fillStyle = '#ffffff'
  context.font = '800 48px Arial, sans-serif'
  for (const [index, line] of wrapCanvasText(context, input.teamName || 'Team', 1000).slice(0, 2).entries()) {
    context.fillText(line, 70, 234 + index * 54)
  }
  context.fillStyle = '#aec1d7'
  context.font = '700 22px Arial, sans-serif'
  context.fillText(`${formatDate(input.matchDate)}${input.matchTime ? `  •  ${input.matchTime}` : ''}`, 70, 306)
  context.fillText(`vs ${input.opponent || 'Opponent to be confirmed'}${input.facility ? `  •  ${input.facility}` : ''}`, 70, 338)

  input.lineup.forEach((court, index) => {
    const top = 370 + index * courtHeight
    context.fillStyle = 'rgba(4, 20, 40, 0.84)'
    context.strokeStyle = 'rgba(155, 225, 29, 0.5)'
    context.lineWidth = 2
    context.beginPath()
    context.roundRect(58, top, 1084, 118, 18)
    context.fill()
    context.stroke()
    context.fillStyle = '#9be11d'
    context.beginPath()
    context.roundRect(82, top + 22, 34, 34, 9)
    context.fill()
    context.fillStyle = '#10250e'
    context.font = '900 16px Arial, sans-serif'
    context.textAlign = 'center'
    context.fillText(String(index + 1), 99, top + 45)
    context.textAlign = 'left'
    context.fillStyle = '#b9ec5d'
    context.font = '900 16px Arial, sans-serif'
    context.fillText((court.label || `Court ${index + 1}`).toUpperCase(), 138, top + 44)
    context.fillStyle = '#ffffff'
    context.font = '800 29px Arial, sans-serif'
    const names = (court.players || []).filter(Boolean).join('  /  ') || 'Player to be set'
    for (const [lineIndex, line] of wrapCanvasText(context, names, 930).slice(0, 2).entries()) {
      context.fillText(line, 138, top + 82 + lineIndex * 31)
    }
  })

  context.fillStyle = '#c7ef7a'
  context.font = '800 15px Arial, sans-serif'
  context.fillText('MORE TENNIS. LESS CHAOS.', 70, canvas.height - 22)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Lineup image could not be created.')), 'image/png')
  })
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
  const confirmedLineup = searchParams.get('confirmed') === '1'
  const [card, setCard] = useState<MatchupCard | null>(null)
  const [loading, setLoading] = useState(() => Boolean(teamName && requestedDate && requestedOpponent))
  const [qrCode, setQrCode] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareNotice, setShareNotice] = useState('')

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

  async function shareLineupImage() {
    if (!lineup.length || sharing) return
    setSharing(true)
    setShareNotice('')
    try {
      const image = await createLineupImage({ teamName, leagueName, flight, matchDate, opponent, matchTime, facility, confirmed: confirmedLineup, lineup })
      const file = new File([image], `tenaceiq-${teamName || 'team'}-lineup.png`.replace(/[^a-z0-9._-]+/gi, '-'), { type: 'image/png' })
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `${teamName || 'Team'} ${confirmedLineup ? 'confirmed ' : ''}lineup`, files: [file] })
        setShareNotice('Lineup image ready to send.')
      } else {
        const url = URL.createObjectURL(image)
        const download = document.createElement('a')
        download.href = url
        download.download = file.name
        document.body.append(download)
        download.click()
        download.remove()
        URL.revokeObjectURL(url)
        setShareNotice('Lineup image downloaded. Attach it to your team text.')
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setShareNotice('The lineup image could not be shared. Please try again.')
    } finally {
      setSharing(false)
    }
  }

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
        <button type="button" className={styles.actionPrimary} disabled={!lineup.length || sharing} onClick={() => void shareLineupImage()}>
          {sharing ? 'Preparing image…' : 'Share lineup image'}
        </button>
        <button type="button" className={styles.actionSecondary} onClick={() => window.print()}>Print scorecard</button>
        <Link href={scanHref} className={styles.actionSecondary}>Capture completed scorecard</Link>
        <Link href={recordResultHref} className={styles.actionSecondary}>Open live scorecard</Link>
      </section>
      {shareNotice ? <p className={styles.shareNotice} role="status">{shareNotice}</p> : null}

      <article className={`${styles.sheet} ${lineup.length > 3 ? styles.denseSheet : ''}`} aria-label="Printable matchup sheet">
        <header className={styles.sheetHeader}>
          <div className={styles.brandBlock}>
            <Image
              className={styles.brandLogo}
              src="/brand/web/header-logo-transparent.png"
              alt="TenAceIQ"
              width={300}
              height={78}
              priority
            />
            <div>
              <p>Captain scorecard</p>
              <span>{leagueName || 'League'}{flight ? ` · ${flight}` : ''}</span>
            </div>
          </div>
          <div className={styles.matchMeta}>
            <span className={styles.matchMetaLabel}>Match day</span>
            <strong>{formatDate(matchDate)}</strong>
            <span>{matchTime || 'Time to be confirmed'} · {facility || 'Location to be confirmed'}</span>
          </div>
        </header>

        <section className={styles.matchup}>
          <div>
            <span>Your side</span>
            <strong>{teamName || 'Team'}</strong>
          </div>
          <b aria-label="versus">vs</b>
          <div>
            <span>Opponent</span>
            <strong>{opponent || 'Opponent to be confirmed'}</strong>
          </div>
        </section>

        <section className={styles.instructions}>
          <div>
            <p>Match-day kit</p>
            <strong>Bring the lineup. Capture every court.</strong>
            <span>Circle the winner, write each set, then scan to save the verified result in TiQ.</span>
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
              </header>
              <div className={styles.scoreGrid} aria-label={`Score entry for ${court.label || `Court ${index + 1}`}`}>
                <div className={styles.scoreGridHead}>
                  <span>Player(s)</span>
                  <span>Set 1</span>
                  <span>Set 2</span>
                  <span className={styles.tieBreakLabel} aria-label="Match tie-break"><b>Match tie-break</b><i>TB</i></span>
                  <span>W/L</span>
                </div>
                <div className={styles.scoreGridRow}>
                  <strong>{(court.players || []).filter(Boolean).join(' / ') || 'Your pair'}</strong>
                  <i aria-hidden="true" />
                  <i aria-hidden="true" />
                  <i aria-hidden="true" />
                  <i aria-hidden="true" />
                </div>
                <div className={styles.scoreGridRow}>
                  <strong className={styles.opponentPlayerBlank} aria-label="Opponent player names, write in" />
                  <i aria-hidden="true" />
                  <i aria-hidden="true" />
                  <i aria-hidden="true" />
                  <i aria-hidden="true" />
                </div>
              </div>
            </article>
          )) : (
            <div className={styles.emptyState}>
              {loading ? 'Loading the saved lineup…' : 'Save a lineup first, then print the exact courts from TiQ.'}
            </div>
          )}
        </section>

        <footer className={styles.sheetFooter}>
          <div>
            <strong>TiQ verified match record</strong>
            <span>This scorecard stays connected to the confirmed lineup and match.</span>
          </div>
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
