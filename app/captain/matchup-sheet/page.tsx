'use client'

import Link from 'next/link'
import Image from 'next/image'
import QRCode from 'qrcode'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import { buildTeamRoomHref } from '@/lib/team-room'
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

function escapePrintText(value: string | null | undefined) {
  return (value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character)
}

function createPrintableScorecard(input: {
  teamName: string
  leagueName: string
  flight: string
  matchDate: string
  matchTime: string
  facility: string
  opponent: string
  lineup: Array<{ label?: string; players?: string[] }>
}) {
  const matchDetails = [formatDate(input.matchDate), input.matchTime, input.facility].filter(Boolean).join(' · ') || 'Match details to be confirmed'
  // The printed sheet stays deliberately white through the court area. Some mobile
  // print renderers were turning that surface into a large grey ink block.
  const inkSafePrintStyle = '<style media="print">.courts { background: #fff !important; } .court { box-shadow: none !important; } .details { background: #fff !important; border-bottom: 1px solid #d6e0e8; }</style>'
  const courts = `${inkSafePrintStyle}${input.lineup.map((court, index) => `
    <article class="court">
      <h2>${escapePrintText(court.label || `Court ${index + 1}`)}</h2>
      <div class="grid">
        <div class="head"><span>Player(s)</span><span>Set 1</span><span>Set 2</span><span>TB</span><span>W/L</span></div>
        <div class="row"><strong>${escapePrintText((court.players || []).filter(Boolean).join(' / ') || 'Your pair')}</strong><i></i><i></i><i></i><i></i></div>
        <div class="row"><strong class="blank"></strong><i></i><i></i><i></i><i></i></div>
      </div>
    </article>`).join('') || '<p class="empty">Save a lineup first, then print its court scorecard.</p>'}`
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TenAceIQ scorecard</title>
<style>
@page { size: letter portrait; margin: .25in; }
* { box-sizing: border-box; } body { margin: 0; background: #fff; color: #102035; font-family: Arial, Helvetica, sans-serif; } .sheet { width: 8in; min-height: 10.5in; display: grid; grid-template-rows: auto auto 1fr auto; border: 1px solid #c9d3dc; } .top { padding: 18px 20px 15px; background: #08213c; color: #fff; } .brand { color: #c9ef75; font-size: 10px; font-weight: 900; letter-spacing: .12em; } h1 { margin: 5px 0 0; font-size: 23px; } .league { margin: 5px 0 0; color: #cfdae7; font-size: 11px; font-weight: 700; } .matchup { display: grid; grid-template-columns: 1fr auto 1fr; gap: 14px; align-items: center; padding: 12px 20px; border-bottom: 1px solid #d6e0e8; } .matchup div { min-width: 0; } .matchup div:last-child { text-align: right; } .label { display: block; color: #5279a3; font-size: 9px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; } .team { display: block; margin-top: 4px; font-size: 15px; font-weight: 900; overflow-wrap: anywhere; } .vs { display: grid; width: 29px; height: 29px; place-items: center; border: 1px solid #bedc75; border-radius: 50%; background: #f3fae8; color: #557a16; font-size: 10px; font-weight: 900; } .details { padding: 8px 20px; background: #eef7e5; color: #526171; font-size: 10px; font-weight: 700; } .courts { display: grid; grid-template-columns: ${input.lineup.length > 3 ? 'repeat(2, minmax(0, 1fr))' : '1fr'}; align-content: stretch; gap: 7px; padding: 9px; background: #edf1f4; } .court { min-height: 0; padding: 9px; border: 1px solid #ccd7df; border-radius: 7px; background: #fff; break-inside: avoid; } h2 { margin: 0 0 6px; font-size: 12px; } .grid { overflow: hidden; border: 1px solid #bdceda; border-radius: 5px; } .head, .row { display: grid; grid-template-columns: minmax(0, 1.45fr) repeat(3, minmax(35px, .6fr)) minmax(38px, .62fr); } .head { background: #102e4c; color: #d6eeff; font-size: 8px; font-weight: 900; text-align: center; text-transform: uppercase; } .head span { padding: 4px 2px; border-right: 1px solid rgba(213,238,255,.18); } .head span:last-child { border: 0; } .row { min-height: 28px; } .row + .row { border-top: 1px solid #d8e2e9; } .row strong, .row i { display: grid; border-right: 1px solid #d8e2e9; } .row strong { place-items: center start; padding: 4px 6px; color: #173b61; font-size: 9px; line-height: 1.15; } .row i:last-child { border: 0; } .blank { background: linear-gradient(transparent 62%, #aab7c1 63%, #aab7c1 65%, transparent 66%); } footer { display: flex; justify-content: space-between; gap: 12px; padding: 8px 20px; background: #08213c; color: #dce9f2; font-size: 9px; font-weight: 700; } footer b { color: #c9ef75; letter-spacing: .08em; text-transform: uppercase; } .empty { padding: 20px; color: #526171; text-align: center; }
</style></head><body><main class="sheet"><header class="top"><div class="brand">TENACEIQ · CAPTAIN SCORECARD</div><h1>${escapePrintText(input.teamName || 'Team')} scorecard</h1><p class="league">${escapePrintText([input.leagueName, input.flight].filter(Boolean).join(' · ') || 'Verified match record')}</p></header><section class="matchup"><div><span class="label">Your side</span><span class="team">${escapePrintText(input.teamName || 'Team')}</span></div><span class="vs">VS</span><div><span class="label">Opponent</span><span class="team">${escapePrintText(input.opponent || 'Opponent')}</span></div></section><p class="details">${escapePrintText(matchDetails)}</p><section class="courts">${courts}</section><footer><span><b>TiQ verified match record</b> · Record final scores in TenAceIQ</span><span>More Tennis. Less Chaos.</span></footer></main></body></html>`
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
  const courtHeight = 156
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 484 + Math.max(input.lineup.length, 1) * courtHeight
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
  context.fillRect(0, 0, canvas.width, 12)

  try {
    const watermark = await loadCanvasImage('/brand/web/header-iq-compact.png')
    const watermarkHeight = 300
    const watermarkWidth = watermarkHeight * (watermark.naturalWidth / watermark.naturalHeight)
    context.save()
    context.globalAlpha = 0.1
    context.drawImage(watermark, canvas.width - watermarkWidth - 110, 170, watermarkWidth, watermarkHeight)
    context.restore()
  } catch {
    // The branded card remains usable if the optional watermark cannot be loaded.
  }

  context.fillStyle = 'rgba(6, 23, 47, 0.42)'
  context.beginPath()
  context.roundRect(44, 34, 1112, canvas.height - 68, 30)
  context.fill()
  context.strokeStyle = 'rgba(183, 222, 248, 0.22)'
  context.lineWidth = 2
  context.stroke()

  try {
    const logo = await loadCanvasImage('/brand/web/header-logo-transparent.png')
    context.drawImage(logo, 78, 58, 300, 78)
  } catch {
    // The share card remains usable if the approved logo asset is temporarily unavailable.
  }
  context.fillStyle = '#c7ef7a'
  context.font = '900 18px Arial, sans-serif'
  context.fillText('MATCH DAY  /  CAPTAIN SERIES', 78, 174)
  context.fillStyle = '#1c4d4a'
  context.beginPath()
  context.roundRect(874, 58, 258, 48, 24)
  context.fill()
  context.strokeStyle = 'rgba(215, 255, 74, 0.7)'
  context.lineWidth = 2
  context.stroke()
  context.fillStyle = '#d7ff78'
  context.font = '900 15px Arial, sans-serif'
  context.textAlign = 'center'
  context.fillText(input.confirmed ? 'FINAL • CONFIRMED' : 'LINEUP • IN PROGRESS', 1003, 88)
  context.textAlign = 'left'
  context.fillStyle = '#ffffff'
  context.font = '900 46px Arial, sans-serif'
  for (const [index, line] of wrapCanvasText(context, input.teamName || 'Team', 940).slice(0, 2).entries()) {
    context.fillText(line, 78, 226 + index * 50)
  }
  context.fillStyle = 'rgba(4, 24, 45, 0.82)'
  context.beginPath()
  context.roundRect(78, 292, 1044, 112, 18)
  context.fill()
  context.strokeStyle = 'rgba(183, 222, 248, 0.28)'
  context.lineWidth = 2
  context.stroke()
  context.fillStyle = '#c7ef7a'
  context.font = '900 14px Arial, sans-serif'
  context.fillText('MATCH DETAILS', 104, 319)
  context.fillStyle = '#ffffff'
  context.font = '800 19px Arial, sans-serif'
  context.fillText(`${formatDate(input.matchDate)}${input.matchTime ? `  •  ${input.matchTime}` : ''}`, 104, 350)
  context.fillStyle = '#d7ff78'
  context.font = '900 17px Arial, sans-serif'
  context.fillText(`VS  ${(input.opponent || 'OPPONENT TO BE CONFIRMED').toUpperCase()}`, 104, 378)
  context.fillStyle = '#aec1d7'
  context.font = '700 15px Arial, sans-serif'
  context.fillText(input.facility || 'Location to be confirmed', 104, 398)
  context.fillStyle = '#8cb2d3'
  context.font = '800 13px Arial, sans-serif'
  context.textAlign = 'right'
  context.fillText([input.leagueName, input.flight].filter(Boolean).join('  •  ').toUpperCase() || 'TENACEIQ CAPTAIN LINEUP', 1096, 319)
  context.textAlign = 'left'

  input.lineup.forEach((court, index) => {
    const top = 426 + index * courtHeight
    context.fillStyle = 'rgba(5, 25, 48, 0.88)'
    context.strokeStyle = 'rgba(155, 225, 29, 0.55)'
    context.lineWidth = 2
    context.beginPath()
    context.roundRect(72, top, 1056, 126, 20)
    context.fill()
    context.stroke()
    context.fillStyle = '#9be11d'
    context.beginPath()
    context.roundRect(96, top + 22, 46, 46, 14)
    context.fill()
    context.fillStyle = '#10250e'
    context.font = '900 20px Arial, sans-serif'
    context.textAlign = 'center'
    context.fillText(String(index + 1), 119, top + 53)
    context.textAlign = 'left'
    context.fillStyle = '#b9ec5d'
    context.font = '900 18px Arial, sans-serif'
    context.fillText((court.label || `Court ${index + 1}`).toUpperCase(), 166, top + 46)
    context.fillStyle = '#8cb2d3'
    context.font = '800 13px Arial, sans-serif'
    context.fillText(input.confirmed ? 'CONFIRMED PAIR' : 'PROJECTED PAIR', 166, top + 70)
    context.fillStyle = '#ffffff'
    context.font = '800 30px Arial, sans-serif'
    const names = (court.players || []).filter(Boolean).join('  /  ') || 'Player to be set'
    for (const [lineIndex, line] of wrapCanvasText(context, names, 890).slice(0, 2).entries()) {
      context.fillText(line, 166, top + 105 + lineIndex * 29)
    }
  })

  context.fillStyle = '#c7ef7a'
  context.font = '900 15px Arial, sans-serif'
  context.fillText('MORE TENNIS. LESS CHAOS.', 78, canvas.height - 28)
  context.fillStyle = '#8cb2d3'
  context.font = '800 13px Arial, sans-serif'
  context.textAlign = 'right'
  context.fillText('TENACEIQ  /  CAPTAIN', 1122, canvas.height - 28)
  context.textAlign = 'left'

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
  const teamChatHref = useMemo(() => buildTeamRoomHref({
    teamName,
    leagueName,
    flight,
    date: matchDate,
    opponent,
    time: matchTime,
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
      const teamChatUrl = new URL(teamChatHref, window.location.origin).toString()
      const shareText = [
        confirmedLineup ? 'Final lineup confirmed.' : 'Match lineup.',
        `${teamName || 'Team'} vs ${opponent || 'Opponent to be confirmed'}.`,
        [formatDate(matchDate), matchTime, facility].filter(Boolean).join(' • '),
        `Team Chat: ${teamChatUrl}`,
      ].filter(Boolean).join('\n')
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `${teamName || 'Team'} ${confirmedLineup ? 'confirmed ' : ''}lineup`, text: shareText, files: [file] })
        setShareNotice('Final lineup image and Team Chat link are ready to send.')
      } else {
        const url = URL.createObjectURL(image)
        const download = document.createElement('a')
        download.href = url
        download.download = file.name
        document.body.append(download)
        download.click()
        download.remove()
        URL.revokeObjectURL(url)
        setShareNotice('Lineup image downloaded. Attach it to your team text, then use Team Chat for changes.')
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setShareNotice('The lineup image could not be shared. Please try again.')
    } finally {
      setSharing(false)
    }
  }

  function printScorecard() {
    if (!lineup.length) {
      setShareNotice('Save or load a lineup before printing its scorecard.')
      return
    }
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setShareNotice('Allow pop-ups for TenAceIQ, then try Print one-page scorecard again.')
      return
    }
    printWindow.document.open()
    printWindow.document.write(createPrintableScorecard({
      teamName,
      leagueName,
      flight,
      matchDate,
      matchTime,
      facility,
      opponent,
      lineup,
    }))
    printWindow.document.close()
    window.setTimeout(() => {
      printWindow.focus()
      printWindow.print()
    }, 180)
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
          {sharing ? 'Preparing image…' : 'Share final lineup + chat'}
        </button>
        <button type="button" className={styles.actionSecondary} onClick={printScorecard}>Print one-page scorecard</button>
        <Link href={scanHref} className={styles.actionSecondary}>Capture completed scorecard</Link>
        <Link href={recordResultHref} className={styles.actionSecondary}>Open live scorecard</Link>
      </section>
      {shareNotice ? <p className={styles.shareNotice} role="status">{shareNotice} <Link href={teamChatHref}>Open Team Chat</Link></p> : null}

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
