'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  buildMatchWeekGoogleCalendarHref,
  buildMatchWeekPhoneCalendarHref,
  buildMatchWeekMapsHref,
} from '@/lib/captain-match-week-links'

type InvitedPlayer = { playerId: string; playerName: string }
type MatchOption = {
  id: string
  matchDate: string
  matchTime: string
  facility: string
  opponent: string
}
type AvailabilityStatus = 'available' | 'maybe' | 'unavailable'
type AvailabilityPayload = {
  lockedPlayer: InvitedPlayer | null
  request: {
    teamName: string
    leagueName: string
    flight: string
    matchDate: string
    opponentTeam: string
    matchTime: string
    facility: string
    invitedPlayers: InvitedPlayer[]
  }
  matches: MatchOption[]
  responses: Array<{
    player_id: string | null
    player_name: string
    match_date: string
    status: AvailabilityStatus
  }>
}

export default function AvailabilityResponseClient({ token }: { token: string }) {
  const [data, setData] = useState<AvailabilityPayload | null>(null)
  const [playerKey, setPlayerKey] = useState('')
  const [statuses, setStatuses] = useState<Record<string, AvailabilityStatus>>({})
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetch(`/api/captain/availability-requests/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const result = await response.json() as AvailabilityPayload & { message?: string }
        if (!response.ok) throw new Error(result.message || 'This availability link could not be opened.')
        if (active) {
          setData(result)
          if (result.lockedPlayer) setPlayerKey(playerKeyFor(result.lockedPlayer))
        }
      })
      .catch((nextError: unknown) => {
        if (active) setError(nextError instanceof Error ? nextError.message : 'This availability link could not be opened.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [token])

  const selectedPlayer = useMemo(() => {
    if (!data) return null
    return data.request.invitedPlayers.find((player) => playerKeyFor(player) === playerKey) ?? null
  }, [data, playerKey])

  useEffect(() => {
    if (!data || !selectedPlayer) return
    const next: Record<string, AvailabilityStatus> = {}
    data.responses
      .filter((response) =>
        response.player_name.toLowerCase() === selectedPlayer.playerName.toLowerCase() ||
        (selectedPlayer.playerId && response.player_id === selectedPlayer.playerId)
      )
      .forEach((response) => { next[response.match_date] = response.status })
    setStatuses(next)
    setSaved(false)
  }, [data, selectedPlayer])

  async function submitAvailability(responsesOverride?: Array<{ matchDate: string; status: AvailabilityStatus }>) {
    if (!selectedPlayer) {
      setError('Choose your name first.')
      return
    }
    const responses = responsesOverride ?? Object.entries(statuses).map(([matchDate, status]) => ({ matchDate, status }))
    if (!responses.length) {
      setError('Set your availability for at least one match.')
      return
    }

    setSaving(true)
    setSaved(false)
    setError('')
    try {
      const response = await fetch(`/api/captain/availability-requests/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: selectedPlayer.playerId,
          playerName: selectedPlayer.playerName,
          notes,
          responses,
        }),
      })
      const result = await response.json() as { message?: string }
      if (!response.ok) throw new Error(result.message || 'Availability could not be saved.')
      setSaved(true)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Availability could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function answerThisMatch(status: Extract<AvailabilityStatus, 'available' | 'unavailable'>) {
    if (!data) return
    setStatuses((current) => ({ ...current, [data.request.matchDate]: status }))
    await submitAvailability([{ matchDate: data.request.matchDate, status }])
  }

  if (loading) return <main style={pageStyle}><section style={cardStyle}>Loading match details...</section></main>
  if (error && !data) return <main style={pageStyle}><section style={cardStyle}><h1 style={titleStyle}>Link unavailable</h1><p style={bodyStyle}>{error}</p></section></main>
  if (!data) return null

  const calendarHref = buildMatchWeekGoogleCalendarHref({
    eventDate: data.request.matchDate,
    eventTime: data.request.matchTime,
    opponent: data.request.opponentTeam,
    location: data.request.facility,
    details: `Availability request for ${data.request.teamName}.`,
  })
  const mapsHref = buildMatchWeekMapsHref(data.request.facility)
  const phoneCalendarHref = buildMatchWeekPhoneCalendarHref(
    typeof window === 'undefined' ? '' : `${window.location.origin}/availability/${token}`
  )
  const currentMatch = data.matches.find((match) => match.matchDate === data.request.matchDate) ?? {
    id: 'requested-match',
    matchDate: data.request.matchDate,
    matchTime: data.request.matchTime,
    facility: data.request.facility,
    opponent: data.request.opponentTeam,
  }
  const futureMatches = data.matches.filter((match) => match.matchDate !== data.request.matchDate)

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <p style={kickerStyle}>Availability request</p>
        <h1 style={titleStyle}>Can you play?</h1>
        <p style={bodyStyle}>
          {data.request.teamName} vs {data.request.opponentTeam || 'opponent'} on {formatDate(data.request.matchDate)}
          {data.request.matchTime ? ` at ${data.request.matchTime}` : ''}.
        </p>
        {data.request.facility ? <p style={detailStyle}>{data.request.facility}</p> : null}
      </section>

      <section style={cardStyle}>
        {data.lockedPlayer ? (
          <div>
            <p style={kickerStyle}>Private response link</p>
            <strong style={matchDateStyle}>Responding as {data.lockedPlayer.playerName}</strong>
          </div>
        ) : (
          <>
            <label htmlFor="availability-player" style={labelStyle}>Your name</label>
            <select id="availability-player" value={playerKey} onChange={(event) => setPlayerKey(event.target.value)} style={inputStyle}>
              <option value="">Choose your name</option>
              {data.request.invitedPlayers.map((player) => (
                <option key={playerKeyFor(player)} value={playerKeyFor(player)}>{player.playerName}</option>
              ))}
            </select>
          </>
        )}
      </section>

      {selectedPlayer ? (
        <>
          <section style={cardStyle}>
            <div>
              <p style={kickerStyle}>One-tap reply</p>
              <h2 style={sectionTitleStyle}>Can you play?</h2>
              <p style={bodyStyle}>Answer for {formatDate(currentMatch.matchDate)} vs {currentMatch.opponent || 'opponent'}.</p>
            </div>
            <div style={quickReplyRowStyle} role="group" aria-label="Reply for this match">
              <button
                type="button"
                disabled={saving}
                onClick={() => void answerThisMatch('available')}
                style={statuses[currentMatch.matchDate] === 'available' ? activeStatusStyle('available') : quickReplyYesStyle}
              >
                {saving ? 'Saving...' : 'Yes, I’m in'}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void answerThisMatch('unavailable')}
                style={statuses[currentMatch.matchDate] === 'unavailable' ? activeStatusStyle('unavailable') : quickReplyNoStyle}
              >
                {saving ? 'Saving...' : 'No, I’m out'}
              </button>
            </div>
            {saved ? (
              <div role="status" style={successStyle}>
                <strong>Reply sent.</strong> Your captain can use it while finalizing the lineup.
              </div>
            ) : null}
          </section>

          <section style={cardStyle}>
            <div>
              <p style={kickerStyle}>Match details</p>
              <h2 style={sectionTitleStyle}>Keep the week in sync</h2>
            </div>
            {calendarHref || mapsHref ? (
              <div style={quickLinkRowStyle}>
                {calendarHref ? <a href={calendarHref} target="_blank" rel="noreferrer" style={quickLinkStyle}>Add to Google Calendar</a> : null}
                {phoneCalendarHref ? <a href={phoneCalendarHref} style={quickLinkStyle}>Add to iPhone calendar</a> : null}
                {mapsHref ? <a href={mapsHref} target="_blank" rel="noreferrer" style={quickLinkStyle}>Open directions</a> : null}
              </div>
            ) : null}
          </section>

          <section style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <p style={kickerStyle}>Plan ahead</p>
              <h2 style={sectionTitleStyle}>Future availability</h2>
              <p style={bodyStyle}>Help your captain by marking any upcoming dates below.</p>
            </div>
            <span style={countPillStyle}>{futureMatches.filter((match) => statuses[match.matchDate]).length} future dates set</span>
          </div>

          <div style={matchListStyle}>
            {futureMatches.map((match) => (
              <article key={`${match.id}-${match.matchDate}`} style={matchCardStyle}>
                <div>
                  <strong style={matchDateStyle}>{formatDate(match.matchDate)}</strong>
                  <div style={detailStyle}>vs {match.opponent || 'opponent'}{match.matchTime ? ` · ${match.matchTime}` : ''}</div>
                  {match.facility ? <div style={smallStyle}>{match.facility}</div> : null}
                </div>
                <div style={statusRowStyle} role="group" aria-label={`Availability for ${formatDate(match.matchDate)}`}>
                  {(['available', 'maybe', 'unavailable'] as AvailabilityStatus[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      aria-pressed={statuses[match.matchDate] === status}
                      onClick={() => setStatuses((current) => ({ ...current, [match.matchDate]: status }))}
                      style={statuses[match.matchDate] === status ? activeStatusStyle(status) : statusButtonStyle}
                    >
                      {status === 'available' ? 'Yes' : status === 'maybe' ? 'Maybe' : 'No'}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>

          {!futureMatches.length ? <p style={bodyStyle}>No later team matches are scheduled yet. Your captain will send the next check when the schedule is ready.</p> : null}

          <label htmlFor="availability-notes" style={labelStyle}>Note for your captain (optional)</label>
          <textarea id="availability-notes" value={notes} onChange={(event) => setNotes(event.target.value)} style={textareaStyle} placeholder="Timing, travel, or anything your captain should know" />

          {error ? <div role="alert" style={errorStyle}>{error}</div> : null}
          <button type="button" onClick={() => void submitAvailability()} disabled={saving || !futureMatches.some((match) => statuses[match.matchDate])} style={primaryButtonStyle}>
            {saving ? 'Saving...' : 'Save future availability'}
          </button>
          </section>
        </>
      ) : null}

      <section style={joinCardStyle}>
        <div>
          <h2 style={sectionTitleStyle}>Want fewer availability texts?</h2>
          <p style={bodyStyle}>Join TiQ to keep your player profile and future availability in one place.</p>
        </div>
        <Link href="/join" style={joinLinkStyle}>Join TiQ</Link>
      </section>
    </main>
  )
}

function playerKeyFor(player: InvitedPlayer) {
  return player.playerId || player.playerName.toLowerCase()
}

function formatDate(value: string) {
  if (!value) return 'Match date'
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .format(new Date(year, month - 1, day))
}

const pageStyle: CSSProperties = { width: 'min(760px, 100%)', margin: '0 auto', padding: '24px 16px 80px', display: 'grid', gap: 16 }
const heroStyle: CSSProperties = { padding: '28px 22px', borderRadius: 24, border: '1px solid color-mix(in srgb, var(--brand-green) 34%, var(--shell-panel-border) 66%)', background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-green) 14%, var(--shell-panel-bg) 86%), var(--shell-panel-bg))' }
const cardStyle: CSSProperties = { padding: 20, borderRadius: 22, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)', display: 'grid', gap: 16 }
const joinCardStyle: CSSProperties = { ...cardStyle, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }
const kickerStyle: CSSProperties = { margin: '0 0 6px', color: 'var(--brand-blue-2)', textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 12, fontWeight: 800 }
const titleStyle: CSSProperties = { margin: 0, fontSize: 'clamp(30px, 7vw, 46px)', lineHeight: 1.02, color: 'var(--shell-copy)' }
const sectionTitleStyle: CSSProperties = { margin: 0, fontSize: 22, color: 'var(--shell-copy)' }
const bodyStyle: CSSProperties = { margin: '8px 0 0', color: 'var(--shell-copy-muted)', lineHeight: 1.55 }
const detailStyle: CSSProperties = { margin: '5px 0 0', color: 'var(--shell-copy)', lineHeight: 1.4 }
const quickLinkRowStyle: CSSProperties = { marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 10 }
const quickLinkStyle: CSSProperties = { minHeight: 40, display: 'inline-flex', alignItems: 'center', padding: '0 14px', borderRadius: 12, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-chip-bg)', color: 'var(--shell-copy)', textDecoration: 'none', fontWeight: 800, fontSize: 14 }
const quickReplyRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }
const quickReplyYesStyle: CSSProperties = { minHeight: 52, borderRadius: 14, border: '1px solid var(--brand-green)', background: 'color-mix(in srgb, var(--brand-green) 18%, var(--shell-panel-bg) 82%)', color: 'var(--shell-copy)', fontWeight: 850, fontSize: 16, cursor: 'pointer' }
const quickReplyNoStyle: CSSProperties = { minHeight: 52, borderRadius: 14, border: '1px solid #df6a70', background: 'color-mix(in srgb, #df6a70 12%, var(--shell-panel-bg) 88%)', color: 'var(--shell-copy)', fontWeight: 850, fontSize: 16, cursor: 'pointer' }
const smallStyle: CSSProperties = { marginTop: 4, color: 'var(--shell-copy-muted)', fontSize: 13 }
const labelStyle: CSSProperties = { color: 'var(--shell-copy)', fontWeight: 750, fontSize: 14 }
const inputStyle: CSSProperties = { width: '100%', minHeight: 48, borderRadius: 12, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-input-bg, var(--shell-chip-bg))', color: 'var(--shell-copy)', padding: '0 12px', font: 'inherit' }
const textareaStyle: CSSProperties = { ...inputStyle, minHeight: 92, padding: 12, resize: 'vertical' }
const sectionHeaderStyle: CSSProperties = { display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'start' }
const countPillStyle: CSSProperties = { borderRadius: 999, padding: '6px 10px', background: 'color-mix(in srgb, var(--brand-green) 18%, var(--shell-chip-bg) 82%)', color: 'var(--shell-copy)', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }
const matchListStyle: CSSProperties = { display: 'grid', gap: 10 }
const matchCardStyle: CSSProperties = { padding: 14, borderRadius: 16, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-chip-bg)', display: 'grid', gap: 12 }
const matchDateStyle: CSSProperties = { color: 'var(--shell-copy)', fontSize: 17 }
const statusRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }
const statusButtonStyle: CSSProperties = { minHeight: 42, borderRadius: 12, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)', color: 'var(--shell-copy)', fontWeight: 800, cursor: 'pointer' }
const activeStatusStyle = (status: AvailabilityStatus): CSSProperties => ({ ...statusButtonStyle, borderColor: status === 'available' ? 'var(--brand-green)' : status === 'maybe' ? '#d6a62a' : '#df6a70', background: status === 'available' ? 'color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-bg) 76%)' : status === 'maybe' ? 'color-mix(in srgb, #d6a62a 20%, var(--shell-panel-bg) 80%)' : 'color-mix(in srgb, #df6a70 20%, var(--shell-panel-bg) 80%)' })
const primaryButtonStyle: CSSProperties = { minHeight: 50, border: 0, borderRadius: 14, padding: '0 18px', color: '#fff', background: 'linear-gradient(135deg, var(--brand-green), var(--brand-blue-2))', fontWeight: 850, fontSize: 16, cursor: 'pointer' }
const errorStyle: CSSProperties = { padding: 12, borderRadius: 12, border: '1px solid #df6a70', background: 'color-mix(in srgb, #df6a70 12%, var(--shell-panel-bg) 88%)', color: 'var(--shell-copy)' }
const successStyle: CSSProperties = { padding: 12, borderRadius: 12, border: '1px solid var(--brand-green)', background: 'color-mix(in srgb, var(--brand-green) 14%, var(--shell-panel-bg) 86%)', color: 'var(--shell-copy)', display: 'grid', gap: 3 }
const joinLinkStyle: CSSProperties = { minHeight: 42, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', borderRadius: 12, background: 'var(--shell-chip-bg)', border: '1px solid var(--shell-panel-border)', color: 'var(--shell-copy)', textDecoration: 'none', fontWeight: 800, whiteSpace: 'nowrap' }
