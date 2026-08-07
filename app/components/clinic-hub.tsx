'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import {
  canCoachClinic,
  canManageClinic,
  type ClinicAttendanceStatus,
  type ClinicRosterStatus,
  type ClubClinicSession,
  type ClubClinicWorkspace,
} from '@/lib/club-clinics'
import styles from './clinic-hub.module.css'

type ClinicTab = 'home' | 'schedule' | 'people' | 'plan' | 'messages'
type ClinicResponse = { ok: boolean; message?: string; workspace?: ClubClinicWorkspace }

const tabs: Array<{ id: ClinicTab; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'people', label: 'People' },
  { id: 'plan', label: 'Session' },
  { id: 'messages', label: 'Updates' },
]

const rosterStatuses: Array<{ value: ClinicRosterStatus; label: string }> = [
  { value: 'active', label: 'Roster' },
  { value: 'waitlist', label: 'Waitlist' },
  { value: 'inactive', label: 'Not in clinic' },
]

const attendanceStatuses: Array<{ value: ClinicAttendanceStatus; label: string }> = [
  { value: 'expected', label: 'Expected' },
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'excused', label: 'Excused' },
]

export default function ClinicHub({ groupId }: { groupId: string }) {
  const { authResolved, session, userId } = useAuth()
  const accessToken = session?.access_token ?? ''
  const [workspace, setWorkspace] = useState<ClubClinicWorkspace | null>(null)
  const [tab, setTab] = useState<ClinicTab>('home')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeTone, setNoticeTone] = useState<'success' | 'danger'>('success')

  const request = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(init?.headers ?? {}),
      },
    })
    const payload = await response.json() as T & { message?: string }
    if (!response.ok) throw new Error(payload.message || 'Clinic Hub could not complete that action.')
    return payload
  }, [accessToken])

  const load = useCallback(async () => {
    if (!accessToken) return
    const clubId = readClubId()
    if (!clubId) {
      setNotice('Open this clinic from Club so the club stays connected.')
      setNoticeTone('danger')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const response = await request<ClinicResponse>(`/api/clubs/${encodeURIComponent(clubId)}/clinics/${encodeURIComponent(groupId)}`)
      setWorkspace(response.workspace ?? null)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Clinic Hub could not load.')
      setNoticeTone('danger')
    } finally {
      setLoading(false)
    }
  }, [accessToken, groupId, request])

  useEffect(() => {
    if (!authResolved) return
    if (!userId || !accessToken) {
      setLoading(false)
      return
    }
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [accessToken, authResolved, load, userId])

  async function mutate(body: Record<string, unknown>, method: 'POST' | 'PATCH', success: string) {
    if (!workspace) return
    setWorking(true)
    try {
      await request(`/api/clubs/${encodeURIComponent(workspace.club.id)}/clinics/${encodeURIComponent(groupId)}`, {
        method,
        body: JSON.stringify(body),
      })
      setNotice(success)
      setNoticeTone('success')
      await load()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Clinic Hub could not save that change.')
      setNoticeTone('danger')
    } finally {
      setWorking(false)
    }
  }

  if (!authResolved || loading) return <ClinicShell title="Opening Clinic Hub..." copy="Connecting the clinic schedule, roster, and next session." />
  if (!userId || !accessToken) return <ClinicShell title="Sign in to open Clinic Hub." copy="Your club role decides what you can see and do." action={<Link className={styles.primary} href={`/login?next=${encodeURIComponent(`/clubs/clinics/${groupId}`)}`}>Sign in</Link>} />
  if (!workspace) return <ClinicShell title="Clinic Hub could not open." copy={notice || 'Open the clinic again from Club.'} action={<Link className={styles.secondary} href="/clubs">Back to Club</Link>} />

  const manager = canManageClinic(workspace.currentMembership.roles, workspace.clinic.leadUserId, userId)
  const coach = manager || canCoachClinic(workspace.currentMembership.roles) && workspace.clinic.leadUserId === userId
  const activeRoster = workspace.roster.filter((member) => member.rosterStatus === 'active')
  const waitlist = workspace.roster.filter((member) => member.rosterStatus === 'waitlist')
  const nextSession = findNextSession(workspace.sessions)
  const activeMember = workspace.roster.find((member) => member.id === workspace.currentMembership.id)?.rosterStatus === 'active'
  const clubStyle = { '--club-color': workspace.club.primaryColor } as React.CSSProperties

  return (
    <main className={styles.page} style={clubStyle}>
      <section className={styles.hero}>
        <div className={styles.identity}>
          {workspace.club.logoUrl
            ? <Image className={styles.logo} src={workspace.club.logoUrl} alt={`${workspace.club.name} logo`} width={58} height={58} unoptimized />
            : <span className={styles.logoFallback}>{workspace.club.name.slice(0, 2).toUpperCase()}</span>}
          <div className={styles.identityCopy}>
            <Link className={styles.backLink} href={`/clubs?clubId=${encodeURIComponent(workspace.club.id)}&tab=groups`}>{workspace.club.name}</Link>
            <p className={styles.eyebrow}>Clinic Hub</p>
            <h1>{workspace.clinic.name}</h1>
            <p>{[workspace.clinic.seasonLabel, workspace.clinic.leadCoachName, workspace.clinic.locationLabel].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <div className={styles.heroActions}>
          {workspace.clinic.registrationUrl ? <a className={styles.secondary} href={workspace.clinic.registrationUrl} target="_blank" rel="noreferrer">Club registration</a> : null}
          <button className={styles.primary} type="button" onClick={() => setTab(nextSession && coach ? 'plan' : nextSession ? 'home' : 'schedule')}>
            {nextSession ? coach ? 'Run next session' : 'View next clinic' : manager ? 'Add schedule' : 'Check schedule'}
          </button>
        </div>
      </section>

      {notice ? <div className={`${styles.notice} ${noticeTone === 'danger' ? styles.noticeDanger : ''}`} role="status">{notice}</div> : null}

      <nav className={styles.tabs} aria-label="Clinic sections">
        {tabs.filter((item) => item.id !== 'plan' || coach || activeMember).map((item) => (
          <button key={item.id} className={`${styles.tab} ${tab === item.id ? styles.tabActive : ''}`} type="button" onClick={() => setTab(item.id)}>{item.label}</button>
        ))}
      </nav>

      {tab === 'home' ? (
        <ClinicHome
          workspace={workspace}
          nextSession={nextSession}
          manager={manager}
          coach={coach}
          activeCount={activeRoster.length}
          waitlistCount={waitlist.length}
          onOpen={setTab}
          onSave={(payload) => mutate({ action: 'setup', ...payload }, 'PATCH', 'Clinic setup saved.')}
          working={working}
        />
      ) : null}
      {tab === 'schedule' ? <ClinicSchedule workspace={workspace} manager={manager} working={working} onCreate={(payload) => mutate({ action: 'create_sessions', ...payload }, 'POST', 'Clinic schedule added.')} /> : null}
      {tab === 'people' ? <ClinicPeople workspace={workspace} manager={manager} working={working} onSave={(roster) => mutate({ action: 'roster', roster }, 'PATCH', 'Clinic roster and waitlist saved.')} /> : null}
      {tab === 'plan' ? <ClinicSession workspace={workspace} coach={coach} working={working} onSaveSession={(payload) => mutate({ action: 'session', ...payload }, 'PATCH', 'Session plan saved.')} onSaveAttendance={(payload) => mutate({ action: 'attendance', ...payload }, 'PATCH', 'Attendance saved.')} /> : null}
      {tab === 'messages' ? <ClinicMessages workspace={workspace} coach={coach} working={working} onPost={(body, kind) => mutate({ action: 'message', body, kind }, 'POST', 'Update posted.')} /> : null}
    </main>
  )
}

function ClinicHome({ workspace, nextSession, manager, coach, activeCount, waitlistCount, onOpen, onSave, working }: { workspace: ClubClinicWorkspace; nextSession: ClubClinicSession | null; manager: boolean; coach: boolean; activeCount: number; waitlistCount: number; onOpen: (tab: ClinicTab) => void; onSave: (payload: Record<string, unknown>) => Promise<void>; working: boolean }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: workspace.clinic.name,
    description: workspace.clinic.description,
    seasonLabel: workspace.clinic.seasonLabel,
    leadUserId: workspace.clinic.leadUserId,
    capacity: workspace.clinic.capacity,
    locationLabel: workspace.clinic.locationLabel,
    registrationUrl: workspace.clinic.registrationUrl,
    defaultDurationMinutes: workspace.clinic.defaultDurationMinutes,
    isPublic: workspace.clinic.isPublic,
  })
  const coaches = workspace.roster.filter((member) => member.roles.includes('coach') || member.roles.some((role) => role === 'owner' || role === 'admin' || role === 'director'))
  return (
    <div className={styles.stack}>
      <section className={styles.nextCard}>
        <div>
          <p className={styles.eyebrow}>{nextSession ? 'Next clinic' : 'Start here'}</p>
          <h2>{nextSession ? formatSessionDate(nextSession.startsAt) : manager ? 'Add the first clinic date.' : 'The club is building the schedule.'}</h2>
          <p>{nextSession ? [formatSessionTime(nextSession), nextSession.locationLabel || workspace.clinic.locationLabel, nextSession.courtLabel].filter(Boolean).join(' · ') : 'One schedule will drive the coach plan, attendance, player view, and updates.'}</p>
          {nextSession?.focus ? <strong className={styles.focus}>Focus: {nextSession.focus}</strong> : null}
        </div>
        <button className={styles.primary} type="button" onClick={() => onOpen(nextSession && coach ? 'plan' : 'schedule')}>{nextSession ? coach ? 'Open session' : 'View schedule' : 'Add schedule'}</button>
      </section>

      <section className={styles.actionGrid}>
        <button className={styles.actionCard} type="button" onClick={() => onOpen('people')}><TiqFeatureIcon name="playerRatings" size="sm" variant="ghost" /><strong>{activeCount} players</strong><span>{waitlistCount ? `${waitlistCount} waiting` : 'Roster ready'}</span></button>
        <button className={styles.actionCard} type="button" onClick={() => onOpen('schedule')}><TiqFeatureIcon name="schedule" size="sm" variant="ghost" /><strong>{workspace.sessions.filter((session) => session.status === 'scheduled').length} upcoming</strong><span>Clinic schedule</span></button>
        <button className={styles.actionCard} type="button" onClick={() => onOpen('messages')}><TiqFeatureIcon name="messagingCenter" size="sm" variant="ghost" /><strong>{workspace.messages.length} updates</strong><span>Clinic conversation</span></button>
        {coach ? <button className={styles.actionCard} type="button" onClick={() => onOpen('plan')}><TiqFeatureIcon name="scenarioBuilder" size="sm" variant="ghost" /><strong>Coach session</strong><span>Plan, attendance, follow-through</span></button> : null}
      </section>

      {manager ? (
        <section className={styles.panel}>
          <div className={styles.panelHeading}><div><p className={styles.eyebrow}>Clinic setup</p><h2>Keep the source clear.</h2><p>Set this once so every connected view uses the same clinic details.</p></div><button className={styles.quiet} type="button" onClick={() => setEditing((value) => !value)}>{editing ? 'Close' : 'Edit setup'}</button></div>
          {editing ? <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void onSave(form).then(() => setEditing(false)) }}><div className={styles.formGrid}>
            <Field label="Clinic name"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <Field label="Season"><input value={form.seasonLabel} onChange={(event) => setForm({ ...form, seasonLabel: event.target.value })} placeholder="Fall 2026" /></Field>
            <Field label="Lead coach"><select value={form.leadUserId} onChange={(event) => setForm({ ...form, leadUserId: event.target.value })}><option value="">Choose coach</option>{coaches.map((member) => <option value={member.userId} key={member.id}>{member.displayName || member.email}</option>)}</select></Field>
            <Field label="Capacity"><input type="number" min="0" max="500" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: Number(event.target.value) })} /></Field>
            <Field label="Default duration"><select value={form.defaultDurationMinutes} onChange={(event) => setForm({ ...form, defaultDurationMinutes: Number(event.target.value) })}><option value="60">60 minutes</option><option value="75">75 minutes</option><option value="90">90 minutes</option><option value="120">120 minutes</option></select></Field>
            <Field label="Location"><input value={form.locationLabel} onChange={(event) => setForm({ ...form, locationLabel: event.target.value })} /></Field>
            <Field label="Club registration link" full><input type="url" value={form.registrationUrl} onChange={(event) => setForm({ ...form, registrationUrl: event.target.value })} placeholder="https://club-registration.example/clinic" /></Field>
            <Field label="What is this clinic for?" full><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
            <label className={styles.check}><input type="checkbox" checked={form.isPublic} onChange={(event) => setForm({ ...form, isPublic: event.target.checked })} />Show on the public club page</label>
          </div><button className={styles.primary} disabled={working} type="submit">Save setup</button></form> : null}
        </section>
      ) : null}
    </div>
  )
}

function ClinicSchedule({ workspace, manager, working, onCreate }: { workspace: ClubClinicWorkspace; manager: boolean; working: boolean; onCreate: (payload: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({ startsAt: '', weeks: 8, durationMinutes: workspace.clinic.defaultDurationMinutes, title: workspace.clinic.name, locationLabel: workspace.clinic.locationLabel || workspace.club.locationLabel, courtLabel: '' })
  return <div className={styles.stack}>
    {manager ? <section className={styles.panel}><div className={styles.panelHeading}><div><p className={styles.eyebrow}>Recurring schedule</p><h2>Add the clinic once.</h2><p>Choose the first date and how many weekly sessions to create.</p></div></div><form className={styles.form} onSubmit={(event) => { event.preventDefault(); void onCreate(form).then(() => setForm({ ...form, startsAt: '' })) }}><div className={styles.formGrid}>
      <Field label="First session"><input required type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></Field>
      <Field label="Number of weeks"><input type="number" min="1" max="52" value={form.weeks} onChange={(event) => setForm({ ...form, weeks: Number(event.target.value) })} /></Field>
      <Field label="Duration"><select value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })}><option value="60">60 minutes</option><option value="75">75 minutes</option><option value="90">90 minutes</option><option value="120">120 minutes</option></select></Field>
      <Field label="Location"><input value={form.locationLabel} onChange={(event) => setForm({ ...form, locationLabel: event.target.value })} /></Field>
      <Field label="Court(s)"><input value={form.courtLabel} onChange={(event) => setForm({ ...form, courtLabel: event.target.value })} placeholder="Courts 3–5" /></Field>
    </div><button className={styles.primary} disabled={working} type="submit">Add weekly sessions</button></form></section> : null}
    <section className={styles.panel}><div className={styles.panelHeading}><div><p className={styles.eyebrow}>Clinic calendar</p><h2>{workspace.sessions.length ? 'Every session in one place.' : 'No sessions yet.'}</h2></div></div><div className={styles.sessionList}>{workspace.sessions.map((session) => <article className={styles.sessionRow} key={session.id}><div className={styles.dateTile}><strong>{new Date(session.startsAt).toLocaleDateString([], { month: 'short' })}</strong><span>{new Date(session.startsAt).getDate()}</span></div><div><h3>{formatSessionDate(session.startsAt)}</h3><p>{[formatSessionTime(session), session.locationLabel, session.courtLabel].filter(Boolean).join(' · ')}</p>{session.focus ? <span className={styles.focus}>Focus: {session.focus}</span> : null}</div><span className={styles.status}>{session.status}</span></article>)}</div></section>
  </div>
}

function ClinicPeople({ workspace, manager, working, onSave }: { workspace: ClubClinicWorkspace; manager: boolean; working: boolean; onSave: (roster: Array<{ membershipId: string; status: ClinicRosterStatus }>) => Promise<void> }) {
  const [roster, setRoster] = useState(() => workspace.roster.map((member) => ({ membershipId: member.id, status: member.rosterStatus })))
  const active = roster.filter((item) => item.status === 'active').length
  const capacity = workspace.clinic.capacity
  return <section className={styles.panel}><div className={styles.panelHeading}><div><p className={styles.eyebrow}>Roster + waitlist</p><h2>{capacity ? `${active} of ${capacity} spots filled.` : `${active} players in the clinic.`}</h2><p>Move a player between the roster and waitlist without rebuilding the group.</p></div>{manager ? <button className={styles.primary} disabled={working} type="button" onClick={() => void onSave(roster)}>Save people</button> : null}</div><div className={styles.peopleList}>{workspace.roster.map((member) => { const status = roster.find((item) => item.membershipId === member.id)?.status || 'inactive'; if (!manager && status === 'inactive') return null; return <article className={styles.personRow} key={member.id}><div><strong>{member.displayName || member.email || 'Club member'}</strong><span>{member.roles.join(' + ')}</span></div>{manager ? <select value={status} onChange={(event) => setRoster((current) => current.map((item) => item.membershipId === member.id ? { ...item, status: event.target.value as ClinicRosterStatus } : item))}>{rosterStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <span className={styles.status}>{status}</span>}</article> })}</div></section>
}

function ClinicSession({ workspace, coach, working, onSaveSession, onSaveAttendance }: { workspace: ClubClinicWorkspace; coach: boolean; working: boolean; onSaveSession: (payload: Record<string, unknown>) => Promise<void>; onSaveAttendance: (payload: Record<string, unknown>) => Promise<void> }) {
  const initialSession = findNextSession(workspace.sessions) || workspace.sessions[0] || null
  const [selectedId, setSelectedId] = useState(initialSession?.id || '')
  const session = workspace.sessions.find((item) => item.id === selectedId) || initialSession

  if (!session) return <section className={styles.panel}><p className={styles.eyebrow}>Session</p><h2>Add the clinic schedule first.</h2><p className={styles.muted}>The plan and attendance will open after the first date is on the calendar.</p></section>
  return <ClinicSessionEditor key={session.id} workspace={workspace} session={session} selectedId={selectedId} setSelectedId={setSelectedId} coach={coach} working={working} onSaveSession={onSaveSession} onSaveAttendance={onSaveAttendance} />
}

function ClinicSessionEditor({ workspace, session, selectedId, setSelectedId, coach, working, onSaveSession, onSaveAttendance }: { workspace: ClubClinicWorkspace; session: ClubClinicSession; selectedId: string; setSelectedId: (id: string) => void; coach: boolean; working: boolean; onSaveSession: (payload: Record<string, unknown>) => Promise<void>; onSaveAttendance: (payload: Record<string, unknown>) => Promise<void> }) {
  const activeRoster = workspace.roster.filter((member) => member.rosterStatus === 'active')
  const [form, setForm] = useState({ focus: session.focus, plan: session.plan, playerNextStep: session.playerNextStep, status: session.status })
  const [attendance, setAttendance] = useState(() => activeRoster.map((member) => ({ membershipId: member.id, status: workspace.attendance.find((item) => item.sessionId === session.id && item.membershipId === member.id)?.status || 'expected' as ClinicAttendanceStatus })))

  return <div className={styles.stack}><section className={styles.panel}><div className={styles.panelHeading}><div><p className={styles.eyebrow}>Session command</p><h2>{formatSessionDate(session.startsAt)}</h2><p>{[formatSessionTime(session), session.locationLabel, session.courtLabel].filter(Boolean).join(' · ')}</p></div><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{workspace.sessions.map((item) => <option value={item.id} key={item.id}>{formatSessionDate(item.startsAt)}</option>)}</select></div>
    {coach ? <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void onSaveSession({ sessionId: session.id, ...form }) }}><div className={styles.formGrid}><Field label="Session focus" full><input value={form.focus} onChange={(event) => setForm({ ...form, focus: event.target.value })} placeholder="Return positioning and first volley" /></Field><Field label="Coach plan" full><textarea value={form.plan} onChange={(event) => setForm({ ...form, plan: event.target.value })} placeholder="Warm-up, progressions, live-ball pattern, finish..." /></Field><Field label="What players do next" full><textarea value={form.playerNextStep} onChange={(event) => setForm({ ...form, playerNextStep: event.target.value })} placeholder="One cue, drill, or assignment players can carry into the week." /></Field><Field label="Session status"><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ClubClinicSession['status'] })}><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="canceled">Canceled</option></select></Field></div><button className={styles.primary} disabled={working} type="submit">Save session</button></form> : <div className={styles.playerPlan}><div><span>Focus</span><strong>{session.focus || 'Coach will add the session focus.'}</strong></div><div><span>Your next step</span><strong>{session.playerNextStep || 'Follow-through will appear here after the session.'}</strong></div></div>}
    </section>
    {coach ? <section className={styles.panel}><div className={styles.panelHeading}><div><p className={styles.eyebrow}>Attendance</p><h2>Tap once as players arrive.</h2></div><button className={styles.primary} disabled={working} type="button" onClick={() => void onSaveAttendance({ sessionId: session.id, attendance })}>Save attendance</button></div><div className={styles.peopleList}>{activeRoster.map((member) => { const status = attendance.find((item) => item.membershipId === member.id)?.status || 'expected'; return <article className={styles.personRow} key={member.id}><strong>{member.displayName || member.email}</strong><select value={status} onChange={(event) => setAttendance((current) => current.map((item) => item.membershipId === member.id ? { ...item, status: event.target.value as ClinicAttendanceStatus } : item))}>{attendanceStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></article> })}</div></section> : null}</div>
}

function ClinicMessages({ workspace, coach, working, onPost }: { workspace: ClubClinicWorkspace; coach: boolean; working: boolean; onPost: (body: string, kind: 'announcement' | 'update') => Promise<void> }) {
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<'announcement' | 'update'>(coach ? 'announcement' : 'update')
  return <section className={styles.panel}><div className={styles.panelHeading}><div><p className={styles.eyebrow}>Clinic updates</p><h2>Keep the conversation with the clinic.</h2><p>Schedule changes, coach notes, and player replies stay out of scattered text threads.</p></div></div><form className={styles.messageForm} onSubmit={(event: FormEvent) => { event.preventDefault(); void onPost(body, kind).then(() => setBody('')) }}><textarea required value={body} onChange={(event) => setBody(event.target.value)} placeholder={coach ? 'Share an update with the clinic...' : 'Reply to the clinic...'} />{coach ? <select value={kind} onChange={(event) => setKind(event.target.value as 'announcement' | 'update')}><option value="announcement">Announcement</option><option value="update">Update</option></select> : null}<button className={styles.primary} disabled={working} type="submit">Post</button></form><div className={styles.messageList}>{workspace.messages.map((message) => <article className={styles.message} key={message.id}><div><strong>{message.authorName}</strong><span>{message.kind} · {new Date(message.createdAt).toLocaleString()}</span></div><p>{message.body}</p></article>)}</div></section>
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return <label className={`${styles.field} ${full ? styles.full : ''}`}><span>{label}</span>{children}</label>
}

function ClinicShell({ title, copy, action }: { title: string; copy: string; action?: React.ReactNode }) {
  return <main className={styles.page}><section className={styles.panel}><p className={styles.eyebrow}>Clinic Hub</p><h1>{title}</h1><p className={styles.muted}>{copy}</p>{action}</section></main>
}

function findNextSession(sessions: ClubClinicSession[]) {
  const now = Date.now()
  return sessions.find((session) => session.status === 'scheduled' && new Date(session.endsAt).getTime() >= now)
    || sessions.find((session) => session.status === 'scheduled')
    || null
}

function formatSessionDate(value: string) {
  return new Date(value).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

function formatSessionTime(session: ClubClinicSession) {
  const start = new Date(session.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const end = new Date(session.endsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${start}–${end}`
}

function readClubId() {
  try {
    const params = new URL(window.location.href).searchParams
    return params.get('clubId') || window.sessionStorage.getItem('tenaceiq.club.active') || window.localStorage.getItem('tenaceiq.club.active') || ''
  } catch {
    return ''
  }
}
