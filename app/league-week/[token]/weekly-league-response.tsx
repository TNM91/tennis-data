'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { LeagueWeeklyCourt } from '@/lib/league-weekly-format'

type WeeklyPayload = {
  league: { name: string; logoUrl: string; facility: string; players: string[]; weeklySettings: { collectPlayerStories: boolean } }
  week: {
    playOn: string
    responseDeadline: string | null
    status: string
    roster: string[]
    assignments: LeagueWeeklyCourt[]
    results: Array<{ court_number: number; set_number: number; side_a_games: number; side_b_games: number }>
  }
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

  const assignedCourt = useMemo(() => data?.week.assignments.find((court) => court.players.includes(playerName)), [data?.week.assignments, playerName])

  async function submit(body: Record<string, unknown>) {
    setBusy(true)
    const response = await fetch(`/api/leagues/weekly/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, playerName }),
    })
    const payload = await response.json()
    setMessage(payload.message || (response.ok ? 'Saved.' : 'That update could not be saved.'))
    if (response.ok) await refresh()
    setBusy(false)
  }

  if (!data) return <main style={pageStyle}><section style={cardStyle}><h1>Weekly league</h1><p>{message || 'Opening this week…'}</p></section></main>
  const collecting = data.week.status === 'collecting'

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        {data.league.logoUrl ? (
          // User-supplied league logos can be hosted on arbitrary domains.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.league.logoUrl} alt="" style={logoStyle} />
        ) : null}
        <div><p style={eyebrowStyle}>Weekly doubles · {data.week.playOn}</p><h1 style={titleStyle}>{data.league.name}</h1><p>{data.league.facility || 'League site'}</p></div>
      </section>

      <section style={cardStyle}>
        <label style={labelStyle}>Your name<select value={playerName} onChange={(event) => setPlayerName(event.target.value)} style={inputStyle}><option value="">Choose your name</option>{data.league.players.map((player) => <option key={player}>{player}</option>)}</select></label>
      </section>

      {collecting ? (
        <section style={cardStyle}>
          <p style={eyebrowStyle}>Reply for this week</p>
          <div style={choiceRowStyle}><button onClick={() => setResponseStatus('in')} style={responseStatus === 'in' ? selectedChoiceStyle : choiceStyle}>I’m in</button><button onClick={() => setResponseStatus('out')} style={responseStatus === 'out' ? selectedChoiceStyle : choiceStyle}>I’m out</button></div>
          <label style={labelStyle}>Note for the league owner (optional)<textarea value={note} onChange={(event) => setNote(event.target.value)} style={textareaStyle} placeholder="Timing or anything the owner should know" /></label>
          {data.league.weeklySettings.collectPlayerStories ? <label style={labelStyle}>Positive share (optional)<textarea value={positiveShare} onChange={(event) => setPositiveShare(event.target.value)} style={textareaStyle} placeholder="A thank-you, great point, or fun moment for the weekly recap" /></label> : null}
          <button disabled={busy || !playerName} onClick={() => void submit({ action: 'rsvp', responseStatus, note, positiveShare })} style={buttonStyle}>{busy ? 'Saving…' : `Save: I’m ${responseStatus}`}</button>
        </section>
      ) : assignedCourt ? (
        <section style={cardStyle}>
          <p style={eyebrowStyle}>Court {assignedCourt.courtNumber} · {assignedCourt.startTime}</p>
          <h2>Your three sets</h2>
          {assignedCourt.sets.map((set) => {
            const key = `${assignedCourt.courtNumber}-${set.setNumber}`
            const saved = data.week.results.find((result) => result.court_number === assignedCourt.courtNumber && result.set_number === set.setNumber)
            return <div key={key} style={scoreRowStyle}><div><strong>Set {set.setNumber}</strong><small style={smallStyle}>{set.sideA.join(' + ')} vs {set.sideB.join(' + ')}</small></div><input aria-label={`Set ${set.setNumber} first side games`} type="number" min={0} max={99} value={scores[key]?.a ?? saved?.side_a_games ?? ''} onChange={(event) => setScores((current) => ({ ...current, [key]: { a: event.target.value, b: current[key]?.b || '' } }))} style={scoreInputStyle} /><span>–</span><input aria-label={`Set ${set.setNumber} second side games`} type="number" min={0} max={99} value={scores[key]?.b ?? saved?.side_b_games ?? ''} onChange={(event) => setScores((current) => ({ ...current, [key]: { a: current[key]?.a || '', b: event.target.value } }))} style={scoreInputStyle} /><button disabled={busy} onClick={() => void submit({ action: 'score', courtNumber: assignedCourt.courtNumber, setNumber: set.setNumber, sideAGames: Number(scores[key]?.a ?? saved?.side_a_games), sideBGames: Number(scores[key]?.b ?? saved?.side_b_games), positiveShare })} style={smallButtonStyle}>Save</button></div>
          })}
          {data.league.weeklySettings.collectPlayerStories ? <label style={labelStyle}>Add a moment for the recap<textarea value={positiveShare} onChange={(event) => setPositiveShare(event.target.value)} style={textareaStyle} placeholder="Celebrate someone or share what made today fun" /></label> : null}
        </section>
      ) : playerName ? <section style={cardStyle}><h2>You’re not on a court this week</h2><p>Check with the league owner if the roster changed.</p></section> : null}

      {message ? <p style={messageStyle} role="status">{message}</p> : null}
    </main>
  )
}

const pageStyle: CSSProperties = { maxWidth: 760, margin: '0 auto', padding: '28px 16px 80px', display: 'grid', gap: 16 }
const heroStyle: CSSProperties = { display: 'flex', gap: 16, alignItems: 'center', padding: 22, borderRadius: 22, color: '#fff', background: 'linear-gradient(135deg,#0a3b2b,#176d4f)' }
const logoStyle: CSSProperties = { width: 72, height: 72, borderRadius: 14, objectFit: 'cover', background: '#fff' }
const eyebrowStyle: CSSProperties = { margin: '0 0 6px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', fontSize: 12 }
const titleStyle: CSSProperties = { margin: 0, fontSize: 'clamp(2rem,8vw,3.5rem)', letterSpacing: '-.05em' }
const cardStyle: CSSProperties = { padding: 20, border: '1px solid #dce4df', borderRadius: 18, background: '#fff', color: '#14231d', boxShadow: '0 10px 30px rgba(24,55,43,.06)' }
const labelStyle: CSSProperties = { display: 'grid', gap: 7, fontWeight: 750, marginBottom: 14 }
const inputStyle: CSSProperties = { minHeight: 46, border: '1px solid #cbd8d1', borderRadius: 10, padding: '9px 12px', background: '#fff', color: '#14231d' }
const textareaStyle: CSSProperties = { ...inputStyle, minHeight: 84, resize: 'vertical' }
const choiceRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '14px 0' }
const choiceStyle: CSSProperties = { padding: 14, border: '1px solid #cbd8d1', borderRadius: 12, background: '#fff', fontWeight: 850 }
const selectedChoiceStyle: CSSProperties = { ...choiceStyle, color: '#fff', background: '#126044', borderColor: '#126044' }
const buttonStyle: CSSProperties = { width: '100%', padding: 13, border: 0, borderRadius: 999, background: '#126044', color: '#fff', fontWeight: 850 }
const smallButtonStyle: CSSProperties = { ...buttonStyle, width: 'auto', padding: '9px 13px' }
const scoreRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 58px auto 58px auto', gap: 8, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #e7ece9' }
const scoreInputStyle: CSSProperties = { ...inputStyle, width: 58, padding: 8, textAlign: 'center' }
const smallStyle: CSSProperties = { display: 'block', marginTop: 3, color: '#59655f', fontWeight: 500 }
const messageStyle: CSSProperties = { position: 'sticky', bottom: 16, padding: 12, borderRadius: 12, background: '#12231d', color: '#fff', textAlign: 'center' }
