'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle, CurrencyDollar, Plus, Users } from '@phosphor-icons/react'
import type { TiqTournamentRecord } from '@/lib/tiq-tournament-registry'
import { loadEventRegistrations, saveEventRegistration } from '@/lib/tournament-event-registration-client'
import { registrationReadiness, untrackedRegistrations, validateRegistration, type EventRegistration, type RegistrationDraft, type RegistrationStatus } from '@/lib/tournament-event-registration'
import styles from './tournament-event-registration.module.css'

type Props = { event: TiqTournamentRecord; divisions: TiqTournamentRecord[]; onChanged: (divisionId: string) => Promise<void>; courtActions?: React.ReactNode; onManage: (division: TiqTournamentRecord, section: string) => void }
const statusLabels: Record<RegistrationStatus, string> = { pending: 'Needs review', confirmed: 'Confirmed', waitlisted: 'Waitlisted', withdrawn: 'Withdrawn' }
export default function TournamentEventRegistration({ event, divisions, onChanged, onManage, courtActions }: Props) {
  const [rows, setRows] = useState<EventRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [revision, setRevision] = useState(0)
  const [divisionFilter, setDivisionFilter] = useState('all')
  const [filter, setFilter] = useState('active')
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<RegistrationDraft | null>(null)
  const [fee, setFee] = useState('0')
  const [paid, setPaid] = useState('0')
  const editor = useRef<HTMLDivElement>(null)
  const firstInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    let active = true
    setLoading(true)
    void loadEventRegistrations(event.id).then(data => {
      if (active) { setRows(data); setLoadError('') }
    }).catch(cause => { if (active) setLoadError(cause instanceof Error ? cause.message : 'Registration records could not load.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [event.id, revision])
  const all = [...rows, ...untrackedRegistrations(event.id, divisions, rows)]
  const active = all.filter(row => row.status !== 'withdrawn')
  const ready = active.filter(row => { const division = divisions.find(item => item.id === row.tournament_id); return division && !row.id.startsWith('existing:') && registrationReadiness(row, division).ready })
  const waiting = active.filter(row => row.status === 'waitlisted')
  const partners = active.filter(row => divisions.find(item => item.id === row.tournament_id)?.entrantType === 'teams' && !row.player_two)
  const balance = rows.filter(row => row.status !== 'withdrawn').reduce((sum, row) => sum + Math.max(0, row.fee_cents - row.paid_cents), 0)
  const currency = event.eventDetails?.currency || 'USD'
  const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)
  const visible = all.filter(row => (divisionFilter === 'all' || row.tournament_id === divisionFilter)
    && (!query || row.entrant_name.toLowerCase().includes(query.toLowerCase()))
    && (filter === 'all' || (filter === 'active' ? row.status !== 'withdrawn' : filter === 'partners' ? row.status !== 'withdrawn' && divisions.find(item => item.id === row.tournament_id)?.entrantType === 'teams' && !row.player_two : filter === 'balance' ? row.status !== 'withdrawn' && row.paid_cents < row.fee_cents : row.status === filter)))
  const actionable = active.filter(row => row.status !== 'waitlisted')
  const checks = [
    { label: 'Missing partners', rows: actionable.filter(row => divisions.find(division => division.id === row.tournament_id)?.entrantType === 'teams' && !row.player_two.trim()) },
    { label: 'Outstanding payments', rows: actionable.filter(row => !row.id.startsWith('existing:') && row.paid_cents < row.fee_cents) },
    { label: 'Payments to verify', rows: actionable.filter(row => row.id.startsWith('existing:')) },
    { label: 'Entries to confirm', rows: actionable.filter(row => row.status === 'pending' || !divisions.find(division => division.id === row.tournament_id)?.entrants.includes(row.entrant_name)) },
  ]
  const selectedDivision = divisions.find(division => division.id === draft?.tournament_id)
  function edit(row?: EventRegistration) {
    const division = divisions.find(item => item.id === row?.tournament_id) || divisions.find(item => item.id === divisionFilter) || divisions[0]
    if (!division) return
    const feeCents = row?.fee_cents ?? Math.round((division.entrantType === 'teams' ? event.eventDetails?.feePerTeam ?? (event.eventDetails?.feePerPlayer ?? 0) * 2 : event.eventDetails?.feePerPlayer ?? 0) * 100)
    const existing = row?.id.startsWith('existing:')
    setDraft({ tournament_id: division.id, player_one: row?.player_one || '', player_two: row?.player_two || '', status: row?.status || 'pending', fee_cents: feeCents, paid_cents: row?.paid_cents || 0, note: row?.note || '',
      ...(row ? existing ? { original_entrant: row.entrant_name } : { id: row.id, expected_updated_at: row.updated_at } : {}) })
    setFee(String(feeCents / 100)); setPaid(String((row?.paid_cents || 0) / 100)); setError(''); setNotice('')
    requestAnimationFrame(() => { editor.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); firstInput.current?.focus() })
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!draft || !selectedDivision || saving || loadError) return
    const next = { ...draft, fee_cents: Math.round(Number(fee) * 100), paid_cents: Math.round(Number(paid) * 100) }
    const invalid = validateRegistration(next, selectedDivision)
    if (invalid) { setError(invalid); return }
    setSaving(true); setError(''); setNotice('')
    try {
      const saved = await saveEventRegistration(event.id, next)
      setRows(previous => previous.some(row => row.id === saved.id) ? previous.map(row => row.id === saved.id ? saved : row) : [...previous, saved])
      setDraft(null)
      try { await onChanged(saved.tournament_id); setNotice(`${saved.entrant_name} saved. ${saved.status === 'confirmed' ? 'Confirmed in the division draw.' : statusLabels[saved.status] + '.'}`) }
      catch { setNotice('Registration saved. Refresh the event to see the updated draw.'); setRevision(value => value + 1) }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Registration could not be saved.') }
    finally { setSaving(false) }
  }
  return <section id="event-registration" className={styles.panel} aria-labelledby="event-registration-heading">
    <section className={styles.readiness} aria-labelledby="event-readiness-heading">
      <p className={styles.eyebrow}>Before the first serve</p><h2 id="event-readiness-heading">Event readiness</h2>
      <p>Review registrations and court assignments before play. Waitlisted teams stay outside the field.</p>
      <div className={styles.readinessGrid}>{checks.map(check => <button key={check.label} type="button" disabled={loading || !!loadError || saving || !check.rows.length} onClick={() => edit(check.rows[0])}><span>{check.label}</span><strong>{loading || loadError ? '—' : check.rows.length}</strong><small>{loading ? 'Checking roster…' : loadError ? 'Refresh roster to check' : check.rows.length ? `Review ${check.rows[0].entrant_name}` : 'No action needed'}</small></button>)}{courtActions}</div>
      {!loading && !loadError && !actionable.length ? <p className={styles.note}>Confirm your field to prepare the event.</p> : null}
    </section>
    <header className={styles.heading}><div><p className={styles.eyebrow}>Registration desk</p><h2 id="event-registration-heading">One roster. Every division.</h2><p>Pair partners, record entry payments, and confirm the field before play.</p></div><button className={styles.primary} type="button" disabled={saving || loading || !!loadError || !divisions.length} onClick={() => edit()}><Plus size={18} aria-hidden="true" /> Add registration</button></header>
    <div className={styles.stats} aria-label="Event registration totals">
      <div><Users size={19} aria-hidden="true" /><span>Ready to play</span><strong>{loading || loadError ? '—' : ready.length}<small> / {active.length}</small></strong></div>
      <div><span>Needs a partner</span><strong>{loading || loadError ? '—' : partners.length}</strong></div>
      <div><span>Waitlisted</span><strong>{loading || loadError ? '—' : waiting.length}</strong></div>
      <div><CurrencyDollar size={19} aria-hidden="true" /><span>Balance to collect</span><strong>{loading || loadError ? '—' : money(balance)}</strong></div>
    </div>
    {event.registrationEmail ? <p className={styles.note}>Sign-ups go directly through the director. Add each registration here after receiving it.</p> : null}
    {all.some(row => row.id.startsWith('existing:')) ? <p className={styles.note}>Existing draw entries need payment review. Their unrecorded payments are excluded from the balance total.</p> : null}
    <div className={styles.toolbar}><label className={styles.search}>Find a player or team<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search names" /></label><label>Division<select value={divisionFilter} onChange={e => setDivisionFilter(e.target.value)}><option value="all">All divisions</option>{divisions.map(division => <option key={division.id} value={division.id}>{division.name}</option>)}</select></label><label>Show<select value={filter} onChange={e => setFilter(e.target.value)}><option value="active">Active registrations</option><option value="partners">Needs a partner</option><option value="balance">Balance due</option><option value="pending">Needs review</option><option value="confirmed">Confirmed</option><option value="waitlisted">Waitlisted</option><option value="all">All, including withdrawn</option></select></label><button type="button" disabled={saving || loading} onClick={() => { setRevision(value => value + 1); setDraft(null); setError('') }}>Refresh roster</button></div>
    {loadError ? <div className={styles.error} role="alert"><strong>Roster unavailable</strong><p>{loadError} Saved registrations will appear after a successful refresh.</p></div> : loading ? <p role="status" className={styles.empty}>Loading registrations…</p> : <div className={styles.workspace}><div className={styles.roster}>
      {visible.map(row => {
        const division = divisions.find(item => item.id === row.tournament_id)
        if (!division) return null
        const check = registrationReadiness(row, division)
        const existing = row.id.startsWith('existing:')
        return <article key={row.id} className={styles.row} data-ready={check.ready && !existing}>
          <div className={styles.rowHeading}><div><span className={styles.division}>{division.name}</span><h3>{row.entrant_name}</h3></div><span className={styles.badge} data-status={row.status}>{statusLabels[row.status]}</span></div>
          <div className={styles.checklist} aria-label={`${row.entrant_name} readiness`}><span data-done={check.paired}>{check.paired ? <CheckCircle size={16} aria-hidden="true" /> : <Users size={16} aria-hidden="true" />}{division.entrantType === 'teams' ? check.paired ? 'Partners paired' : 'Partner needed' : 'Player named'}</span><span data-done={check.paid && !existing}>{existing ? 'Payment unrecorded' : check.paid ? 'Entry paid' : `${money(row.fee_cents - row.paid_cents)} due`}</span><span data-done={check.confirmed}>{division.entrants.includes(row.entrant_name) ? row.status === 'confirmed' ? 'In the draw' : 'Draw place needs review' : 'Outside the draw'}</span></div>
          {row.note ? <p className={styles.note}>{row.note}</p> : null}
          <div className={styles.rowFooter}><span>{existing ? 'Review this existing entry to start tracking payments.' : `${money(row.paid_cents)} recorded · ${money(row.fee_cents)} entry fee`}</span><button type="button" disabled={saving} onClick={() => edit(row)} aria-label={`Edit registration for ${row.entrant_name}`}>Review <ArrowRight size={15} aria-hidden="true" /></button></div>
        </article>
      })}
      {!visible.length ? <div className={styles.empty}><Users size={30} aria-hidden="true" /><h3>{all.length ? 'No registrations in this view.' : 'Your field starts here.'}</h3><p>{all.length ? 'Try another filter or search.' : 'Add a player with their partner, choose a division, then track their entry fee.'}</p>{!all.length ? <button type="button" disabled={!divisions.length} onClick={() => edit()}>Add first registration <Plus size={16} aria-hidden="true" /></button> : null}</div> : null}
    </div><div className={styles.editor} ref={editor}>
      {draft ? <form onSubmit={submit}><p className={styles.eyebrow}>{draft.id || draft.original_entrant ? 'Review registration' : 'New registration'}</p><h3>Build a ready team.</h3><fieldset disabled={saving}><label>Division<select value={draft.tournament_id} disabled={!!draft.id || !!draft.original_entrant} onChange={e => { const division = divisions.find(item => item.id === e.target.value); setDraft({ ...draft, tournament_id: e.target.value, player_two: division?.entrantType === 'players' ? '' : draft.player_two }); setFee(String(division?.entrantType === 'teams' ? event.eventDetails?.feePerTeam ?? (event.eventDetails?.feePerPlayer ?? 0) * 2 : event.eventDetails?.feePerPlayer ?? 0)) }}>{divisions.map(division => <option key={division.id} value={division.id}>{division.name}</option>)}</select></label><label>{selectedDivision?.entrantType === 'teams' ? 'Player 1' : 'Player name'}<input ref={firstInput} required maxLength={90} value={draft.player_one} onChange={e => setDraft({ ...draft, player_one: e.target.value })} /></label>{selectedDivision?.entrantType === 'teams' ? <label>Player 2<input maxLength={90} value={draft.player_two} onChange={e => setDraft({ ...draft, player_two: e.target.value })} placeholder="Leave blank while finding a partner" /></label> : null}<label>Registration status<select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as RegistrationStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className={styles.amounts}><label>Entry fee ({currency})<input type="number" min="0" max="100000" step="0.01" required value={fee} onChange={e => setFee(e.target.value)} /></label><label>Paid ({currency})<input type="number" min="0" max={fee || '0'} step="0.01" required value={paid} onChange={e => setPaid(e.target.value)} /></label></div><label>Organizer note<input maxLength={300} value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="e.g. Partner to confirm by Wednesday" /></label></fieldset><p className={styles.note}>{draft.status === 'confirmed' ? 'Confirming adds this team to the division draw. Existing courts or scores must be cleared before changing the field.' : 'Review and waitlist entries stay outside the draw.'} Payment records are visible only to organizers.</p><button type="submit" className={styles.primary} disabled={saving}>{saving ? 'Saving registration…' : 'Save registration'}</button><button type="button" disabled={saving} onClick={() => { setDraft(null); setError('') }}>Cancel</button></form> : <><p className={styles.eyebrow}>Ready to play</p><h3>A clear path to court.</h3><ol><li>Name both partners.</li><li>Record the entry payment.</li><li>Confirm the team into its division.</li></ol><p className={styles.note}>Waitlisted teams remain outside the draw until you confirm their place.</p>{divisions.map(division => <button type="button" key={division.id} className={styles.drawLink} onClick={() => onManage(division, 'tournament-setup')}>Manage {division.name}<ArrowRight size={16} aria-hidden="true" /></button>)}</>}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </div></div>}
    {notice ? <p className={styles.success} role="status">{notice}</p> : null}
  </section>
}
