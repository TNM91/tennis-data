'use client'

import Link from 'next/link'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useAuth } from './auth-provider'
import ProductTourVideoButton from './product-tour-video'
import { buildProductAccessState } from '@/lib/access-model'
import { getPlanUnlockHref } from '@/lib/plan-intent'
import { CAPTAIN_QUICK_START_HREF, getCaptainQuickStartSteps, type CaptainQuickStartEvidence } from '@/lib/captain-quick-start'
import { isCaptainTeamConnection, type TeamConnection } from '@/lib/team-profile-links'
import styles from './captain-quick-start.module.css'

function subscribeGuideSelection(onChange: () => void) {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}
function readGuideSelection(userId: string) {
  try { return localStorage.getItem(`tiq:captain-guide-team:${userId}`) } catch { return null }
}
function subscribeGuideRoute(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  window.addEventListener('hashchange', onChange)
  return () => { window.removeEventListener('popstate', onChange); window.removeEventListener('hashchange', onChange) }
}

export default function CaptainQuickStart({ connections, pending, loading, error }: {
  connections: TeamConnection[]; pending: TeamConnection[]; loading: boolean; error: string
}) {
  const { userId, role, entitlements, session } = useAuth()
  const access = buildProductAccessState(role, entitlements).canUseCaptainWorkflow
  const choices = [...connections, ...pending].filter((team) => !team.archivedAt && isCaptainTeamConnection(team.roles))
  return <QuickStart key={userId || 'public'} choices={choices} userId={userId || ''}
    token={session?.access_token || ''} access={access} loading={loading} error={error} />
}

function QuickStart({ choices, userId, token, access, loading, error }: {
  choices: TeamConnection[]; userId: string; token: string; access: boolean; loading: boolean; error: string
}) {
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const storedId = useSyncExternalStore(subscribeGuideSelection, () => readGuideSelection(userId), () => null)
  const routeQuery = useSyncExternalStore(subscribeGuideRoute, () => window.location.search, () => '')
  const params = new URLSearchParams(routeQuery)
  const requested = choices.find((team) => team.teamName === params.get('team') && team.leagueName === params.get('league') && team.flight === params.get('flight'))
  const activeId = selectedId ?? requested?.id ?? storedId
  const preferred = choices.find((team) => team.isDefault) || choices.find((team) => team.status === 'accepted') || choices[0]
  const selected = activeId === null ? preferred : choices.find((team) => team.id === activeId)
  useEffect(() => {
    const checkHash = () => { if (window.location.hash === '#captain-setup') setOpen(true) }
    checkHash()
    window.addEventListener('hashchange', checkHash)
    return () => window.removeEventListener('hashchange', checkHash)
  }, [userId])
  // If a stored connection was removed, do not show that team's old progress.
  const current = selected || (activeId !== '' ? preferred : undefined)
  return (
    <details id="captain-setup" className={styles.guide} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary><span><strong>Set up your team</strong><small>Five steps · pick up where you left off</small></span><span className={styles.toggle}>{open ? 'Close guide' : 'Open guide'}</span></summary>
      {open ? <div className={styles.content}>
        <p>One team, one clear next step. Completed work is checked from your saved team records.</p>
        <ProductTourVideoButton videoId="captain" label="Watch the 18-second Captain intro" variant="compact" source="captain-quick-start" />
        {!access ? <Link className={styles.action} href={getPlanUnlockHref('captain', CAPTAIN_QUICK_START_HREF)}>{userId ? 'Unlock Captain tools' : 'Sign in or get Captain access'}</Link> : null}
        {choices.length ? <label className={styles.team}>Team for this guide
          <select value={current?.id || ''} onChange={(event) => {
            setSelectedId(event.target.value)
            try { localStorage.setItem(`tiq:captain-guide-team:${userId}`, event.target.value) } catch { /* Selection still works for this visit. */ }
          }}>
            <option value="">Add another team</option>
            {choices.map((team) => <option key={team.id} value={team.id}>{team.teamName} · {team.leagueName} · {team.flight}{team.status === 'pending' ? ' (link pending)' : ''}</option>)}
          </select>
        </label> : null}
        <GuideSteps key={`${current?.id || 'new'}:${access}`} connection={current} token={token} access={access} loadingTeams={loading} teamError={error} />
      </div> : null}
    </details>
  )
}

function GuideSteps({ connection, token, access, loadingTeams, teamError }: {
  connection?: TeamConnection; token: string; access: boolean; loadingTeams: boolean; teamError: string
}) {
  const [evidence, setEvidence] = useState<CaptainQuickStartEvidence | null>(null)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(Boolean(token && access && connection?.status === 'accepted'))
  const [revision, setRevision] = useState(0)
  const linked = connection?.status === 'accepted'
  const connectionId = connection?.id || ''
  useEffect(() => {
    if (!token || !access || !linked || !connectionId) return
    const controller = new AbortController()
    let active = true
    const timer = window.setTimeout(() => controller.abort(), 15_000)
    void fetch(`/api/captain/quick-start?connection=${encodeURIComponent(connectionId)}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal,
    }).then(async (response) => {
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Progress could not be checked.')
      if (active) setEvidence(result)
    }).catch(() => {
      if (active) setError('Progress could not be checked. Your saved work has not changed. Try again.')
    }).finally(() => { window.clearTimeout(timer); if (active) setChecking(false) })
    return () => { active = false; controller.abort(); window.clearTimeout(timer) }
  }, [access, connectionId, linked, revision, token])
  useEffect(() => {
    const refresh = () => { setChecking(Boolean(token && access && linked)); setError(''); setRevision((value) => value + 1) }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [access, linked, token])
  const steps = getCaptainQuickStartSteps(connection, evidence)
  const completeCount = steps.filter((step) => step.complete).length
  const unknown = Boolean(loadingTeams || teamError || (linked && access && (!evidence || error || checking)))
  const next = unknown ? undefined : steps.find((step) => !step.complete)
  return <>
    <div className={styles.status} role="status">
      <strong>{loadingTeams || checking ? 'Checking your saved progress…' : unknown ? 'Progress needs a refresh' : `${completeCount} of 5 complete`}</strong>
      {linked && access ? <button type="button" disabled={checking} onClick={() => { setChecking(true); setError(''); setRevision((value) => value + 1) }}>Refresh progress</button> : null}
    </div>
    {teamError || error ? <p role="alert">{teamError || error}</p> : null}
    {completeCount === 5 && !unknown ? <p className={styles.success}>First setup complete. Open your team to plan the next match, or revisit any step below.</p> : null}
    <ol className={styles.steps}>
      {steps.map((step, index) => <li key={step.id} className={next?.id === step.id ? styles.next : ''} aria-current={next?.id === step.id ? 'step' : undefined}>
        <details open={next?.id === step.id} className={styles.step}>
        <summary className={styles.stepTop}><span className={styles.number}>{index + 1}</span><strong>{step.title}</strong><span className={styles.badge}>{unknown && index > 1 ? 'Not checked' : step.complete ? 'Complete' : next?.id === step.id ? 'Next' : 'To do'} · View</span></summary>
        <div className={styles.stepBody}>
        <p>{step.detail}</p>
        <div className={styles.actions}>
          <Link className={styles.action} href={step.href}>{step.action}</Link>
          {step.id === 'add' && !step.complete ? <Link href="/explore/leagues?layer=tiq">Enter a TIQ team manually</Link> : null}
        </div>
        {step.id === 'add' && !step.complete ? <small>In TennisLink, open your team and export Team Summary. No file? Open your TIQ league and enter an existing or custom team.</small> : null}
        {step.id === 'share' && evidence?.lineupSent ? <small>Lineup sent. Printing is optional and is not tracked.</small> : null}
        </div>
        </details>
      </li>)}
    </ol>
  </>
}
