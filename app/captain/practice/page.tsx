'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import LockedPlanPage from '@/app/components/locked-plan-page'
import ScheduleMessageComposer from '@/app/components/schedule-message-composer'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import { buildProductAccessState } from '@/lib/access-model'

export default function CaptainPracticePage() {
  return (
    <SiteShell active="/captain">
      <CaptainPracticeContent />
    </SiteShell>
  )
}

function CaptainPracticeContent() {
  const router = useRouter()
  const { role, userId, entitlements, authResolved } = useAuth()
  const resolvedRole = authResolved || !userId ? role : 'member'
  const access = useMemo(() => buildProductAccessState(resolvedRole, entitlements), [entitlements, resolvedRole])
  const [teamName, setTeamName] = useState('')
  const [leagueName, setLeagueName] = useState('')
  const [flight, setFlight] = useState('')
  const [practiceDate, setPracticeDate] = useState('')
  const [practiceTime, setPracticeTime] = useState('')
  const [facility, setFacility] = useState('')
  const [practiceFocus, setPracticeFocus] = useState('')

  useEffect(() => {
    if (!authResolved || role !== 'public') return
    router.replace('/login?next=/captain/practice')
  }, [authResolved, role, router])

  if (!authResolved || role === 'public') {
    return null
  }

  if (!access.canUseCaptainWorkflow) {
    return (
      <LockedPlanPage
        active="/captain"
        planId="captain"
        headline="Unlock practice coordination with Captain"
        body="Captain lets you schedule practices, invite the team, collect RSVPs, and keep practice messages with the rest of the team week."
        ctaLabel="Unlock Captain"
        secondaryLabel="Back to Team"
        secondaryHref="/captain"
      />
    )
  }

  const practiceNotes = [
    practiceFocus ? `Practice focus: ${practiceFocus}` : '',
    'Please mark In, Out, or Maybe so the captain can plan courts.',
  ].filter(Boolean).join('\n')
  const canSchedule = Boolean(teamName.trim() && practiceDate)

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <span aria-hidden="true" style={watermarkStyle} />
        <div style={heroCopyStyle}>
          <div style={eyebrowStyle}>Captain practice</div>
          <h1 style={titleStyle}>Plan practice without a separate thread.</h1>
          <p style={textStyle}>
            Pick the team, date, time, site, and focus. TenAceIQ opens a practice thread and collects In, Out, or Maybe responses from linked player accounts.
          </p>
          <div style={proofGridStyle}>
            <ProofItem label="Invite" value="Roster-linked" />
            <ProofItem label="Responses" value="In / Out / Maybe" />
            <ProofItem label="Thread" value="Messages" />
          </div>
        </div>
        <div style={heroPanelStyle}>
          <TiqFeatureIcon name="schedule" size="lg" variant="surface" />
          <strong>Practice sits in Team.</strong>
          <span>Use it before lineup week, between matches, or whenever the roster needs a shared training plan.</span>
        </div>
      </section>

      <section style={workspaceStyle} aria-label="Practice scheduler setup">
        <div style={panelHeaderStyle}>
          <div>
            <div style={sectionEyebrowStyle}>Setup</div>
            <h2 style={sectionTitleStyle}>Create the practice invite.</h2>
          </div>
          <span style={statusPillStyle}>{canSchedule ? 'Ready to schedule' : 'Team and date needed'}</span>
        </div>

        <div style={fieldGridStyle}>
          <label style={fieldStyle}>
            Team
            <input value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Team name" style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            League
            <input value={leagueName} onChange={(event) => setLeagueName(event.target.value)} placeholder="Optional league" style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            Flight
            <input value={flight} onChange={(event) => setFlight(event.target.value)} placeholder="Optional flight" style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            Date
            <input type="date" value={practiceDate} onChange={(event) => setPracticeDate(event.target.value)} style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            Time
            <input type="time" value={practiceTime} onChange={(event) => setPracticeTime(event.target.value)} style={inputStyle} />
          </label>
          <label style={fieldStyle}>
            Site
            <input value={facility} onChange={(event) => setFacility(event.target.value)} placeholder="Courts or club" style={inputStyle} />
          </label>
        </div>

        <label style={fieldStyle}>
          Practice focus
          <textarea
            value={practiceFocus}
            onChange={(event) => setPracticeFocus(event.target.value)}
            placeholder="Examples: doubles patterns, second serves, live-ball points, court assignments..."
            style={textareaStyle}
          />
        </label>

        <div style={actionRowStyle}>
          {teamName.trim() ? (
            <ScheduleMessageComposer
              mode="captain-practice"
              triggerLabel="Schedule practice"
              teamName={teamName}
              leagueName={leagueName}
              flight={flight}
              defaultDate={practiceDate}
              defaultTime={practiceTime}
              defaultFacility={facility}
              defaultNotes={practiceNotes}
            />
          ) : (
            <button type="button" disabled style={{ ...disabledButtonStyle }}>Enter team first</button>
          )}
        </div>

        <div style={hintGridStyle}>
          {practiceHints.map((hint) => (
            <div key={hint.title} style={hintCardStyle}>
              <strong>{hint.title}</strong>
              <span>{hint.detail}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

function ProofItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={proofItemStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

const practiceHints = [
  {
    title: 'Use roster names',
    detail: 'Linked player accounts receive RSVP tracking; unlinked names still appear in the invite preview.',
  },
  {
    title: 'Keep it specific',
    detail: 'Add the court, focus, rain plan, or arrival note so players know what the practice is for.',
  },
  {
    title: 'Follow up in Messages',
    detail: 'The scheduler creates the thread, then replies and updates stay with team communication.',
  },
]

const pageStyle: CSSProperties = {
  width: 'min(1180px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '0 auto',
  padding: '16px 0 42px',
  display: 'grid',
  gap: 16,
  minWidth: 0,
  overflowX: 'clip',
}

const heroStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
  gap: 16,
  alignItems: 'stretch',
  padding: 22,
  borderRadius: 28,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'var(--portal-surface-bg)',
  boxShadow: '0 24px 70px rgba(2, 8, 23, 0.42)',
  minWidth: 0,
}

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: '-110px',
  top: '-120px',
  width: 320,
  height: 320,
  borderRadius: '50%',
  pointerEvents: 'none',
  opacity: 0.14,
  background:
    'radial-gradient(circle at 36% 34%, rgba(255,255,255,0.88) 0 7%, transparent 8%), radial-gradient(circle at 50% 50%, rgba(155,225,29,0.96) 0 48%, rgba(155,225,29,0.1) 49%, transparent 58%)',
}

const heroCopyStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gap: 12,
  alignContent: 'center',
  minWidth: 0,
}

const eyebrowStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(2rem, 4vw, 4rem)',
  lineHeight: 0.98,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const textStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 15,
  lineHeight: 1.7,
  fontWeight: 750,
  maxWidth: 760,
}

const proofGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const proofItemStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 900,
  textTransform: 'uppercase',
}

const heroPanelStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gap: 10,
  alignContent: 'center',
  minWidth: 0,
  padding: 18,
  borderRadius: 20,
  border: '1px solid rgba(155,225,29,0.24)',
  background: 'linear-gradient(145deg, rgba(155,225,29,0.12), rgba(116,190,255,0.07) 58%, rgba(15,23,42,0.62))',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const workspaceStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  minWidth: 0,
  padding: 18,
  borderRadius: 24,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(12,26,50,0.82) 0%, rgba(9,20,39,0.92) 100%)',
  boxShadow: '0 18px 46px rgba(2,10,24,0.18)',
}

const panelHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
}

const sectionEyebrowStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const sectionTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 24,
  lineHeight: 1.05,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const statusPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  padding: '0 11px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'rgba(155,225,29,0.08)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 950,
}

const fieldGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  minHeight: 44,
  padding: '0 12px',
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(15,23,42,0.66)',
  color: 'var(--foreground-strong)',
  fontSize: 14,
  fontWeight: 750,
  outline: 'none',
  boxSizing: 'border-box',
}

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 104,
  padding: 12,
  resize: 'vertical',
  lineHeight: 1.45,
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 9,
  minWidth: 0,
}

const disabledButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 38,
  padding: '0 13px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 900,
}

const hintGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const hintCardStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
  padding: 14,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 780,
  overflowWrap: 'anywhere',
}
