'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import { TEAM_MATCH_FORMATS, TOURNAMENT_DRAW_FORMATS } from '@/lib/competition-format-registry'
import {
  CLUB_ROLES,
  buildClubCompetitionLaunchHref,
  buildClubToolHref,
  canRunClubPrograms,
  getClubGroupTypeLabel,
  getClubRoleLabel,
  getClubSetupSteps,
  hasClubTeamProgram,
  isClubManager,
  normalizeClubInviteEmails,
  type Club,
  type ClubCompetitionTemplate,
  type ClubGroup,
  type ClubGroupType,
  type ClubInvite,
  type ClubMembership,
  type ClubRole,
  type ClubSetupStep,
  type ClubInviteTargetType,
  type ClubWorkspaceData,
} from '@/lib/club-workspace'
import styles from './club-workspace.module.css'

type ClubListResponse = {
  ok: boolean
  message?: string
  clubs?: Club[]
  memberships?: ClubMembership[]
  workspace?: ClubWorkspaceData
}

type WorkspaceTab = 'home' | 'people' | 'groups' | 'compete' | 'settings'

const tabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'people', label: 'People' },
  { id: 'groups', label: 'Programs' },
  { id: 'compete', label: 'Compete' },
  { id: 'settings', label: 'Club' },
]

const groupTypes: ClubGroupType[] = ['clinic', 'team', 'camp', 'development_group', 'league_division', 'tournament_field']

export default function ClubWorkspace() {
  const { authResolved, session, userId } = useAuth()
  const accessToken = session?.access_token ?? ''
  const [clubs, setClubs] = useState<Club[]>([])
  const [workspace, setWorkspace] = useState<ClubWorkspaceData | null>(null)
  const [selectedClubId, setSelectedClubId] = useState('')
  const [tab, setTab] = useState<WorkspaceTab>('home')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success')
  const [guidedStepId, setGuidedStepId] = useState<ClubSetupStep['id'] | null>(null)
  const [requestedGroupId, setRequestedGroupId] = useState('')
  const [inviteDestination, setInviteDestination] = useState('club:')

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
    if (!response.ok) throw new Error(payload.message || 'Club could not complete that action.')
    return payload
  }, [accessToken])

  const loadClubs = useCallback(async (preferredClubId?: string) => {
    if (!accessToken) return
    setLoading(true)
    try {
      const list = await request<ClubListResponse>('/api/clubs')
      const nextClubs = list.clubs ?? []
      setClubs(nextClubs)
      const storedClubId = readStoredClubId()
      const requestedClubId = preferredClubId || readRequestedClubId() || storedClubId
      const nextClubId = nextClubs.some((club) => club.id === requestedClubId) ? requestedClubId : nextClubs[0]?.id || ''
      setSelectedClubId(nextClubId)
      if (nextClubId) {
        const detail = await request<ClubListResponse>(`/api/clubs?clubId=${encodeURIComponent(nextClubId)}`)
        setWorkspace(detail.workspace ?? null)
        rememberClubId(nextClubId)
      } else {
        setWorkspace(null)
      }
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Club could not load.', 'danger')
    } finally {
      setLoading(false)
    }
  }, [accessToken, request])

  useEffect(() => {
    if (!authResolved) return
    if (!userId || !accessToken) {
      setLoading(false)
      return
    }
    const timeout = window.setTimeout(() => void loadClubs(), 0)
    return () => window.clearTimeout(timeout)
  }, [accessToken, authResolved, loadClubs, userId])

  useEffect(() => {
    const requestedTab = readRequestedWorkspaceTab()
    if (requestedTab) setTab(requestedTab)
    setRequestedGroupId(readRequestedGroupId())
  }, [])

  async function selectClub(clubId: string) {
    setSelectedClubId(clubId)
    setInviteDestination('club:')
    setTab('home')
    setLoading(true)
    try {
      const detail = await request<ClubListResponse>(`/api/clubs?clubId=${encodeURIComponent(clubId)}`)
      setWorkspace(detail.workspace ?? null)
      rememberClubId(clubId)
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'This club could not load.', 'danger')
    } finally {
      setLoading(false)
    }
  }

  function showMessage(value: string, tone: 'success' | 'danger' = 'success') {
    setMessage(value)
    setMessageTone(tone)
  }

  async function refreshWorkspace() {
    if (!selectedClubId) return
    const detail = await request<ClubListResponse>(`/api/clubs?clubId=${encodeURIComponent(selectedClubId)}`)
    setWorkspace(detail.workspace ?? null)
    if (detail.clubs) setClubs(detail.clubs)
  }

  function openGuidedStep(step: ClubSetupStep) {
    if (step.id === 'access') {
      void shareClubPage()
      return
    }
    if (step.tab === 'people') setInviteDestination('club:')
    setGuidedStepId(step.id)
    setTab(step.tab)
  }

  function openPeople(destination = 'club:') {
    setGuidedStepId(null)
    setInviteDestination(destination)
    setTab('people')
  }

  function finishGuidedStep(stepId: ClubSetupStep['id'], successMessage: string) {
    if (guidedStepId !== stepId) return
    setGuidedStepId(null)
    setTab('home')
    showMessage(successMessage)
  }

  async function shareClubPage() {
    if (!workspace || working) return
    const publicUrl = `${window.location.origin}/clubs/${workspace.club.slug}`
    const useNativeShare = typeof navigator.share === 'function'
    setWorking(true)
    try {
      if (useNativeShare) {
        await navigator.share({ title: workspace.club.name, text: `Open ${workspace.club.name} on TenAceIQ.`, url: publicUrl })
      } else {
        await navigator.clipboard.writeText(publicUrl)
      }
      await request(`/api/clubs/${workspace.club.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'complete_onboarding' }) })
      await refreshWorkspace()
      setGuidedStepId(null)
      setTab('home')
      showMessage(useNativeShare ? 'Club page shared. Setup is complete.' : 'Club page copied. Setup is complete.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      showMessage(error instanceof Error ? error.message : 'The club page could not be shared.', 'danger')
    } finally {
      setWorking(false)
    }
  }

  async function shareInvite(invite: ClubInvite) {
    const inviteUrl = `${window.location.origin}/clubs/invite/${invite.inviteToken}`
    const destination = invite.target.type === 'club' ? workspace?.club.name || 'the club' : invite.target.name
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: `Join ${destination}`, text: `You are invited to join ${destination} on TenAceIQ.`, url: inviteUrl })
        showMessage('Invitation shared.')
      } else {
        await navigator.clipboard.writeText(inviteUrl)
        showMessage('Invitation link copied. Send it by text or email.')
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      showMessage('The invitation could not be shared. Try copying it again.', 'danger')
    }
  }

  if (!authResolved || loading) {
    return <main className={styles.page}><div className={styles.loading}><p className={styles.eyebrow}>Club</p><h1 className={styles.title}>Opening your club...</h1></div></main>
  }

  if (!userId || !accessToken) {
    return (
      <main className={styles.page}>
        <section className={styles.empty}>
          <p className={styles.eyebrow}>Club</p>
          <h1 className={styles.title}>One home for your club.</h1>
          <p className={styles.copy}>Sign in to connect players, coaches, programs, leagues, and tournaments.</p>
          <div className={styles.row}>
            <Link className={styles.primary} href="/login?next=%2Fclubs">Sign in</Link>
            <Link className={styles.secondary} href="/join?next=%2Fclubs">Create account</Link>
          </div>
        </section>
      </main>
    )
  }

  if (!clubs.length || !workspace) {
    return (
      <main className={styles.page}>
        <CreateClubForm
          working={working}
          message={message}
          messageTone={messageTone}
          onCreate={async (payload) => {
            setWorking(true)
            try {
              const response = await request<{ ok: boolean; club: Club }>('/api/clubs', { method: 'POST', body: JSON.stringify(payload) })
              showMessage(`${response.club.name} is ready.`)
              await loadClubs(response.club.id)
            } catch (error) {
              showMessage(error instanceof Error ? error.message : 'The club could not be created.', 'danger')
            } finally {
              setWorking(false)
            }
          }}
        />
      </main>
    )
  }

  const clubRoles = workspace.currentMembership.roles
  const manager = isClubManager(clubRoles)
  const staff = canRunClubPrograms(clubRoles)
  const clubStyle = { '--club-color': workspace.club.primaryColor } as CSSProperties
  const heroAction = getClubHeroAction(workspace, clubRoles)
  const guidedStep = guidedStepId ? getClubSetupSteps(workspace).find((step) => step.id === guidedStepId) ?? null : null

  return (
    <main className={styles.page} style={clubStyle}>
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <div className={styles.clubIdentity}>
            {workspace.club.logoUrl
              ? <Image className={styles.logo} src={workspace.club.logoUrl} alt={`${workspace.club.name} logo`} width={64} height={64} unoptimized />
              : <div className={styles.logoFallback} aria-hidden="true">{workspace.club.name.slice(0, 2).toUpperCase()}</div>}
            <div>
              <p className={styles.eyebrow}>Club</p>
              <h1 className={styles.clubName}>{workspace.club.name}</h1>
              <p className={styles.clubMeta}>{[workspace.club.locationLabel, clubRoles.map(getClubRoleLabel).join(' + ')].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          {clubs.length > 1 ? (
            <label className={styles.switcher}>
              <span className={styles.eyebrow}>Club</span>
              <select value={selectedClubId} onChange={(event) => void selectClub(event.target.value)}>
                {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
              </select>
            </label>
          ) : <span className={styles.powered}>Powered by TenAceIQ</span>}
        </div>
        <p className={styles.copy}>{workspace.club.description || 'One connected tennis experience for players, coaches, programs, leagues, and tournaments.'}</p>
        <div className={styles.heroActions}>
          {heroAction.setupStep
            ? <button className={styles.primary} type="button" onClick={() => openGuidedStep(heroAction.setupStep!)}>{heroAction.label}</button>
            : heroAction.tab
            ? <button className={styles.primary} type="button" onClick={() => setTab(heroAction.tab!)}>{heroAction.label}</button>
            : <Link className={styles.primary} href={heroAction.href!}>{heroAction.label}</Link>}
          {!heroAction.setupStep ? <Link className={styles.secondary} href={`/clubs/${workspace.club.slug}`}>View public club page</Link> : null}
          {manager && !heroAction.setupStep && heroAction.tab !== 'people' ? <button className={styles.secondary} type="button" onClick={() => openPeople()}>Invite people</button> : null}
        </div>
      </section>

      {message ? <div className={`${styles.notice} ${messageTone === 'danger' ? styles.danger : styles.success}`} role="status">{message}</div> : null}

      <nav className={styles.tabs} aria-label="Club workspace sections">
        {tabs.filter((item) => item.id !== 'settings' || manager).map((item) => (
          <button key={item.id} type="button" className={`${styles.tab} ${tab === item.id ? styles.tabActive : ''}`} onClick={() => item.id === 'people' ? openPeople() : setTab(item.id)}>{item.label}</button>
        ))}
      </nav>

      {guidedStep ? (
        <section className={styles.guidedBanner} aria-label="Current club setup step">
          <div><p className={styles.eyebrow}>Guided setup</p><strong>{guidedStep.label}</strong><span>{guidedStep.detail}</span></div>
          <button className={styles.quietButton} type="button" onClick={() => { setGuidedStepId(null); setTab('home') }}>Back to setup</button>
        </section>
      ) : null}

      {tab === 'home' ? <ClubHome workspace={workspace} roles={clubRoles} onOpenTab={(nextTab) => nextTab === 'people' ? openPeople() : setTab(nextTab)} onRunSetupStep={openGuidedStep} /> : null}
      {tab === 'people' ? (
        <PeoplePanel
          key={`${guidedStepId ?? 'people'}:${inviteDestination}`}
          workspace={workspace}
          manager={manager}
          working={working}
          initialDestination={inviteDestination}
          guidedStepId={guidedStepId === 'staff' || guidedStepId === 'players' ? guidedStepId : null}
          onShare={shareInvite}
          onRevoke={async (inviteId) => {
            setWorking(true)
            try {
              await request(`/api/clubs/${workspace.club.id}/members?inviteId=${encodeURIComponent(inviteId)}`, { method: 'DELETE' })
              showMessage('Invitation revoked. Its link no longer works.')
              await refreshWorkspace()
            } catch (error) {
              showMessage(error instanceof Error ? error.message : 'The invitation could not be revoked.', 'danger')
            } finally {
              setWorking(false)
            }
          }}
          onInvite={async (emailInput, roles, targetType, targetId) => {
            setWorking(true)
            try {
              const response = await request<{ invite: ClubInvite; invites?: ClubInvite[]; skippedEmails?: string[] }>(`/api/clubs/${workspace.club.id}/members`, { method: 'POST', body: JSON.stringify({ email: emailInput, roles, targetType, targetId }) })
              const invites = response.invites?.length ? response.invites : [response.invite]
              const inviteLinks = invites.map((invite) => `${invite.email}: ${window.location.origin}/clubs/invite/${invite.inviteToken}`).join('\n')
              await navigator.clipboard?.writeText(inviteLinks).catch(() => undefined)
              const skippedCount = response.skippedEmails?.length ?? 0
              showMessage(invites.length === 1
                ? `Invitation ready. Its link was copied${skippedCount ? `; ${skippedCount} already pending` : ''}.`
                : `${invites.length} invitations ready and copied together${skippedCount ? `; ${skippedCount} already pending` : ''}.`)
              await refreshWorkspace()
              const staffRoles: ClubRole[] = ['admin', 'director', 'coach', 'captain', 'coordinator']
              if (guidedStepId === 'staff' && roles.some((role) => staffRoles.includes(role))) finishGuidedStep('staff', 'Staff invite ready. Next: invite a player.')
              if (guidedStepId === 'players' && roles.some((role) => role === 'player' || role === 'guardian')) finishGuidedStep('players', 'Player invite ready. Next: add the first program.')
              return true
            } catch (error) {
              showMessage(error instanceof Error ? error.message : 'The invitation could not be created.', 'danger')
              return false
            } finally {
              setWorking(false)
            }
          }}
        />
      ) : null}
      {tab === 'groups' ? (
        <GroupsPanel
          workspace={workspace}
          requestedGroupId={requestedGroupId}
          staff={staff}
          manager={manager}
          coachSync={clubRoles.includes('coach')}
          working={working}
          onInvite={(groupId) => openPeople(`group:${groupId}`)}
          onCreate={async (payload) => {
            setWorking(true)
            try {
              await request(`/api/clubs/${workspace.club.id}/groups`, { method: 'POST', body: JSON.stringify(payload) })
              showMessage(`${payload.name} was added.`)
              await refreshWorkspace()
              finishGuidedStep('programs', `${payload.name} is ready. Next: share the club page.`)
            } catch (error) {
              showMessage(error instanceof Error ? error.message : 'The program could not be added.', 'danger')
            } finally { setWorking(false) }
          }}
          onSaveRoster={async (groupId, membershipIds) => {
            setWorking(true)
            try {
              await request(`/api/clubs/${workspace.club.id}/groups`, { method: 'PATCH', body: JSON.stringify({ groupId, membershipIds }) })
              showMessage('Program roster saved.')
              await refreshWorkspace()
            } catch (error) {
              showMessage(error instanceof Error ? error.message : 'The roster could not be saved.', 'danger')
            } finally { setWorking(false) }
          }}
          onCoachSync={async (groupId) => {
            setWorking(true)
            try {
              const result = await request<{ synced: number }>(`/api/clubs/${workspace.club.id}/coach-sync`, { method: 'POST', body: JSON.stringify({ groupId }) })
              showMessage(result.synced ? `${result.synced} players are ready in Coach Hub.` : 'Add players to this program before opening it in Coach Hub.')
              if (result.synced) window.location.assign(`/coach?clubId=${encodeURIComponent(workspace.club.id)}&clubName=${encodeURIComponent(workspace.club.name)}`)
            } catch (error) {
              showMessage(error instanceof Error ? error.message : 'The roster could not be connected.', 'danger')
            } finally { setWorking(false) }
          }}
        />
      ) : null}
      {tab === 'compete' ? (
        <CompetitionPanel
          workspace={workspace}
          staff={staff}
          manager={manager}
          working={working}
          onInvite={(targetType, targetId) => openPeople(`${targetType}:${targetId}`)}
          onCreate={async (payload) => {
            setWorking(true)
            try {
              await request(`/api/clubs/${workspace.club.id}/templates`, { method: 'POST', body: JSON.stringify(payload) })
              showMessage(`${payload.name} is ready to launch.`)
              await refreshWorkspace()
            } catch (error) {
              showMessage(error instanceof Error ? error.message : 'The competition could not be saved.', 'danger')
            } finally { setWorking(false) }
          }}
        />
      ) : null}
      {tab === 'settings' && manager ? (
        <ClubSettings
          club={workspace.club}
          working={working}
          onSave={async (payload) => {
            setWorking(true)
            try {
              await request(`/api/clubs/${workspace.club.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
              showMessage('Club page updated.')
              await refreshWorkspace()
              finishGuidedStep('club', 'Club identity saved. Next: invite the first staff member.')
            } catch (error) {
              showMessage(error instanceof Error ? error.message : 'Club details could not be saved.', 'danger')
            } finally { setWorking(false) }
          }}
        />
      ) : null}
    </main>
  )
}

function ClubHome({ workspace, roles, onOpenTab, onRunSetupStep }: { workspace: ClubWorkspaceData; roles: ClubRole[]; onOpenTab: (tab: WorkspaceTab) => void; onRunSetupStep: (step: ClubSetupStep) => void }) {
  const staff = canRunClubPrograms(roles)
  const manager = isClubManager(roles)
  const actions = getRoleActions(roles, workspace)
  const setupSteps = getClubSetupSteps(workspace)
  const completedSetupSteps = setupSteps.filter((step) => step.completed).length
  const setupComplete = completedSetupSteps === setupSteps.length
  const [showSetup, setShowSetup] = useState(false)
  const [showAllSteps, setShowAllSteps] = useState(false)
  const nextStep = setupSteps.find((step) => !step.completed) ?? setupSteps[setupSteps.length - 1]
  const showEverydayWorkspace = !manager || setupComplete
  return (
    <section className={styles.panel}>
      <div className={styles.headingRow}>
        <div className={styles.panelHeading}><p className={styles.eyebrow}>{manager && !setupComplete ? 'Start here' : 'Right now'}</p><h2>{manager && !setupComplete ? 'Get the club ready, one step at a time.' : getHomeTitle(roles)}</h2><p>{manager && !setupComplete ? 'Finish the next job below. Club brings you back here automatically.' : getHomeCopy(roles)}</p></div>
        {manager && setupComplete && !showSetup ? <button className={styles.quietButton} type="button" onClick={() => setShowSetup(true)}>Setup help</button> : null}
      </div>
      {showEverydayWorkspace ? <div className={styles.experienceStrip} aria-label="Connected club value">
        <div><strong>Players</strong><span>Know what to work on and what comes next.</span></div>
        <div><strong>Coaches</strong><span>Keep lessons, assignments, and progress connected.</span></div>
        <div><strong>Club staff</strong><span>Run programs and competition without rebuilding context.</span></div>
      </div> : null}
      {manager && (!setupComplete || showSetup) ? (
        <section className={styles.setupCard} aria-labelledby="club-setup-title">
          <div className={styles.setupTop}>
            <div>
              <p className={styles.eyebrow}>Club setup · {completedSetupSteps} of {setupSteps.length}</p>
              <h3 id="club-setup-title">{setupComplete ? 'Your club is ready.' : nextStep.label}</h3>
              <p>{setupComplete ? 'Open any step whenever the club changes.' : nextStep.detail}</p>
            </div>
            {setupComplete ? <button className={styles.quietButton} type="button" onClick={() => setShowSetup(false)}>Close</button> : null}
          </div>
          <div className={styles.setupProgress} role="progressbar" aria-label="Club setup progress" aria-valuemin={0} aria-valuemax={setupSteps.length} aria-valuenow={completedSetupSteps}>
            <span style={{ width: `${(completedSetupSteps / setupSteps.length) * 100}%` }} />
          </div>
          {!setupComplete ? <button className={styles.primary} type="button" onClick={() => onRunSetupStep(nextStep)}>{nextStep.actionLabel}</button> : null}
          <button className={styles.setupToggle} type="button" aria-expanded={showAllSteps} onClick={() => setShowAllSteps((current) => !current)}>{showAllSteps ? 'Hide steps' : 'View all steps'}</button>
          {showAllSteps ? (
            <ol className={styles.setupSteps}>
              {setupSteps.map((step) => (
                <li key={step.id} className={step.completed ? styles.setupStepDone : ''}>
                  <div><strong>{step.label}</strong><span>{step.completed ? 'Done' : step.detail}</span></div>
                  <button className={styles.quietButton} type="button" onClick={() => step.completed ? onOpenTab(step.tab) : onRunSetupStep(step)}>{step.completed ? 'Review' : step.actionLabel}</button>
                </li>
              ))}
            </ol>
          ) : null}
        </section>
      ) : null}
      {showEverydayWorkspace ? <><div className={styles.statGrid}>
        <div className={styles.stat}><strong>{workspace.memberships.length}</strong><span>People</span></div>
        <div className={styles.stat}><strong>{workspace.groups.length}</strong><span>Programs + teams</span></div>
        <div className={styles.stat}><strong>{workspace.competitions.length}</strong><span>Live competitions</span></div>
      </div>
      <div className={styles.actionGrid}>
        {actions.map((action) => action.tab
          ? <button key={action.title} className={`${styles.actionCard} ${styles.actionCardButton}`} type="button" onClick={() => onOpenTab(action.tab!)}><strong>{action.title}</strong><span>{action.detail}</span><b>{action.label}</b></button>
          : <Link key={action.title} className={styles.actionCard} href={action.href!}><strong>{action.title}</strong><span>{action.detail}</span><b>{action.label}</b></Link>)}
      </div>
      {staff ? <button className={styles.secondary} type="button" onClick={() => onOpenTab('compete')}>Set up club competition</button> : null}</> : null}
    </section>
  )
}

function PeoplePanel({ workspace, manager, working, guidedStepId, initialDestination, onInvite, onShare, onRevoke }: { workspace: ClubWorkspaceData; manager: boolean; working: boolean; guidedStepId: 'staff' | 'players' | null; initialDestination: string; onInvite: (email: string, roles: ClubRole[], targetType: ClubInviteTargetType, targetId: string) => Promise<boolean>; onShare: (invite: ClubInvite) => Promise<void>; onRevoke: (inviteId: string) => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [roles, setRoles] = useState<ClubRole[]>(guidedStepId === 'staff' ? ['coach'] : ['player'])
  const [destination, setDestination] = useState(initialDestination)
  const inviteCount = normalizeClubInviteEmails(email).length
  const inviteLabel = inviteCount > 1 ? `Create ${inviteCount} invite links` : guidedStepId === 'staff' ? 'Invite staff member' : guidedStepId === 'players' ? 'Invite player' : 'Create invite link'
  const destinationSeparator = destination.indexOf(':')
  const targetType = destination.slice(0, destinationSeparator) as ClubInviteTargetType
  const targetId = destination.slice(destinationSeparator + 1)
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}><p className={styles.eyebrow}>{guidedStepId ? 'Your next connection' : 'Club roster'}</p><h2>{guidedStepId === 'staff' ? 'Who helps run the tennis experience?' : guidedStepId === 'players' ? 'Bring the first player into the club.' : 'Everyone connected to the club.'}</h2><p>{guidedStepId === 'staff' ? 'Choose every role they have. They can be staff and a player at the same time.' : guidedStepId === 'players' ? 'Their setup link is copied after you create it, ready to text or email.' : 'One person can be a player, coach, captain, or coordinator at the same time.'}</p></div>
      {manager ? (
        <form className={styles.compactForm} onSubmit={(event) => { event.preventDefault(); void onInvite(email, roles, targetType, targetId).then((created) => { if (created) setEmail('') }) }}>
          <div className={styles.fieldGrid}>
            <label className={styles.field}><span>Email addresses</span><textarea required value={email} onChange={(event) => setEmail(event.target.value)} placeholder={'player@club.com\npartner@club.com'} /><small>One email or up to 50, separated by commas or new lines.</small></label>
            <label className={styles.field}><span>Invite into</span><select value={destination} onChange={(event) => setDestination(event.target.value)}><option value="club:">Club — general access</option>{workspace.groups.length ? <optgroup label="Programs and teams">{workspace.groups.map((group) => <option key={group.id} value={`group:${group.id}`}>{group.name} — {getClubGroupTypeLabel(group.groupType)}</option>)}</optgroup> : null}{workspace.competitions.length ? <optgroup label="Leagues and tournaments">{workspace.competitions.map((competition) => <option key={`${competition.type}-${competition.id}`} value={`${competition.type}:${competition.id}`}>{competition.name} — {competition.type}</option>)}</optgroup> : null}</select><small>They will open here after joining.</small></label>
            <div className={styles.field}><span>Club roles</span><RoleChecks value={roles} onChange={setRoles} /></div>
          </div>
          <button className={styles.primary} disabled={working} type="submit">{working ? 'Preparing...' : inviteLabel}</button>
        </form>
      ) : null}
      <div className={styles.cardGrid}>
        {workspace.memberships.map((member) => (
          <article className={styles.card} key={member.id}>
            <div className={styles.cardTop}><h3>{member.displayName || member.email || 'Club member'}</h3><span className={styles.pill}>{member.status}</span></div>
            <div className={styles.roleList}>{member.roles.map((role) => <span key={role} className={styles.pill}>{getClubRoleLabel(role)}</span>)}</div>
            {member.email ? <span className={styles.muted}>{member.email}</span> : null}
          </article>
        ))}
      </div>
      {manager && workspace.invites.length ? <><hr className={styles.sectionDivider} /><div className={styles.panelHeading}><h2>Pending invitations</h2><p>Share a link again or revoke one that should no longer be used.</p></div><div className={styles.cardGrid}>{workspace.invites.map((invite) => <article className={styles.card} key={invite.id}><h3>{invite.email}</h3>{invite.target.type !== 'club' ? <span className={styles.muted}>Opens {invite.target.name}</span> : <span className={styles.muted}>Club-wide access</span>}<div className={styles.roleList}>{invite.roles.map((role) => <span className={styles.pill} key={role}>{getClubRoleLabel(role)}</span>)}</div><div className={styles.row}><button className={styles.quietButton} disabled={working} type="button" onClick={() => void onShare(invite)}>Share invite</button><button className={styles.dangerButton} disabled={working} type="button" onClick={() => { if (window.confirm('Revoke this invitation? Its current link will stop working.')) void onRevoke(invite.id) }}>Revoke</button></div></article>)}</div></> : null}
    </section>
  )
}

function GroupsPanel({ workspace, requestedGroupId, staff, manager, coachSync, working, onCreate, onSaveRoster, onCoachSync, onInvite }: { workspace: ClubWorkspaceData; requestedGroupId: string; staff: boolean; manager: boolean; coachSync: boolean; working: boolean; onCreate: (payload: { name: string; groupType: ClubGroupType; description: string; seasonLabel: string; leadUserId: string; capacity: number; locationLabel: string; registrationUrl: string; defaultDurationMinutes: number }) => Promise<void>; onSaveRoster: (groupId: string, membershipIds: string[]) => Promise<void>; onCoachSync: (groupId: string) => Promise<void>; onInvite: (groupId: string) => void }) {
  const [name, setName] = useState('')
  const [groupType, setGroupType] = useState<ClubGroupType>('clinic')
  const [description, setDescription] = useState('')
  const [seasonLabel, setSeasonLabel] = useState('')
  const [leadUserId, setLeadUserId] = useState('')
  const [capacity, setCapacity] = useState(0)
  const [locationLabel, setLocationLabel] = useState(workspace.club.locationLabel)
  const [registrationUrl, setRegistrationUrl] = useState('')
  const [defaultDurationMinutes, setDefaultDurationMinutes] = useState(90)
  const [editingGroup, setEditingGroup] = useState<ClubGroup | null>(null)
  const [memberIds, setMemberIds] = useState<string[]>([])
  useEffect(() => {
    if (!requestedGroupId) return
    const frame = window.requestAnimationFrame(() => document.getElementById(`club-group-${requestedGroupId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    return () => window.cancelAnimationFrame(frame)
  }, [requestedGroupId])
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}><p className={styles.eyebrow}>Programs + teams</p><h2>Put the right people together.</h2><p>Create clinics, teams, camps, or development groups from the same club roster.</p></div>
      {staff ? (
        <form className={styles.compactForm} onSubmit={(event) => { event.preventDefault(); void onCreate({ name, groupType, description, seasonLabel, leadUserId, capacity, locationLabel, registrationUrl, defaultDurationMinutes }).then(() => { setName(''); setDescription('') }) }}>
          <div className={styles.fieldGrid}>
            <label className={styles.field}><span>Name</span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="12U green ball" /></label>
            <label className={styles.field}><span>Type</span><select value={groupType} onChange={(event) => setGroupType(event.target.value as ClubGroupType)}>{groupTypes.map((type) => <option key={type} value={type}>{getClubGroupTypeLabel(type)}</option>)}</select></label>
            <label className={styles.field}><span>Season</span><input value={seasonLabel} onChange={(event) => setSeasonLabel(event.target.value)} placeholder="Fall 2026" /></label>
            {groupType === 'clinic' ? <><label className={styles.field}><span>Lead coach</span><select value={leadUserId} onChange={(event) => setLeadUserId(event.target.value)}><option value="">Choose coach</option>{workspace.memberships.filter((member) => member.roles.some((role) => role === 'coach' || role === 'owner' || role === 'admin' || role === 'director')).map((member) => <option value={member.userId} key={member.id}>{member.displayName || member.email}</option>)}</select></label><label className={styles.field}><span>Capacity</span><input type="number" min="0" max="500" value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} /></label><label className={styles.field}><span>Location</span><input value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)} /></label><label className={styles.field}><span>Duration</span><select value={defaultDurationMinutes} onChange={(event) => setDefaultDurationMinutes(Number(event.target.value))}><option value="60">60 minutes</option><option value="75">75 minutes</option><option value="90">90 minutes</option><option value="120">120 minutes</option></select></label><label className={`${styles.field} ${styles.full}`}><span>Club registration link</span><input type="url" value={registrationUrl} onChange={(event) => setRegistrationUrl(event.target.value)} placeholder="https://your-club.com/register" /></label></> : null}
            <label className={`${styles.field} ${styles.full}`}><span>What is this group working on?</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          </div>
          <button className={styles.primary} disabled={working} type="submit">Add program</button>
        </form>
      ) : null}
      <div className={styles.cardGrid}>
        {workspace.groups.map((group) => <article id={`club-group-${group.id}`} className={`${styles.card} ${requestedGroupId === group.id ? styles.cardTargeted : ''}`} key={group.id}><div className={styles.cardTop}><h3>{group.name}</h3><span className={styles.pill}>{getClubGroupTypeLabel(group.groupType)}</span></div><p>{group.description || group.seasonLabel || 'Ready for players.'}</p><span className={styles.muted}>{group.memberIds.length} connected{group.capacity ? ` · ${group.capacity} spots` : ''}</span>{group.groupType === 'clinic' ? <Link className={styles.primary} href={`/clubs/clinics/${group.id}?clubId=${encodeURIComponent(workspace.club.id)}`}>Open Clinic Hub</Link> : null}{manager ? <button type="button" className={styles.quietButton} onClick={() => onInvite(group.id)}>Invite people</button> : null}{staff ? <button type="button" className={styles.quietButton} onClick={() => { setEditingGroup(group); setMemberIds(group.memberIds) }}>Manage roster</button> : null}{coachSync ? <button type="button" disabled={working} className={styles.quietButton} onClick={() => void onCoachSync(group.id)}>Open roster in Coach Hub</button> : null}</article>)}
      </div>
      {editingGroup ? (
        <div className={styles.compactForm}>
          <div className={styles.panelHeading}><h2>{editingGroup.name}</h2><p>Choose who belongs in this program.</p></div>
          <div className={styles.groupRoster}>{workspace.memberships.map((member) => <label className={styles.memberRow} key={member.id}><input type="checkbox" checked={memberIds.includes(member.id)} onChange={() => setMemberIds((current) => current.includes(member.id) ? current.filter((id) => id !== member.id) : [...current, member.id])} /><span>{member.displayName || member.email || 'Club member'}</span></label>)}</div>
          <div className={styles.row}><button className={styles.primary} disabled={working} type="button" onClick={() => void onSaveRoster(editingGroup.id, memberIds).then(() => setEditingGroup(null))}>Save roster</button><button className={styles.secondary} type="button" onClick={() => setEditingGroup(null)}>Cancel</button></div>
        </div>
      ) : null}
    </section>
  )
}

function CompetitionPanel({ workspace, staff, manager, working, onCreate, onInvite }: { workspace: ClubWorkspaceData; staff: boolean; manager: boolean; working: boolean; onCreate: (payload: { name: string; competitionType: 'league' | 'tournament'; entrantType: 'players' | 'teams'; formatId: string; divisionLabel: string; defaultFacility: string }) => Promise<void>; onInvite: (targetType: 'league' | 'tournament', targetId: string) => void }) {
  const [name, setName] = useState('')
  const [competitionType, setCompetitionType] = useState<'league' | 'tournament'>('league')
  const [entrantType, setEntrantType] = useState<'players' | 'teams'>('players')
  const [formatId, setFormatId] = useState('round_robin')
  const [divisionLabel, setDivisionLabel] = useState('')
  const [defaultFacility, setDefaultFacility] = useState(workspace.club.locationLabel)
  const formatOptions: ReadonlyArray<readonly [string, string]> = competitionType === 'tournament'
    ? TOURNAMENT_DRAW_FORMATS.map((item) => [item.id, item.label] as const)
    : entrantType === 'teams'
      ? TEAM_MATCH_FORMATS.map((item) => [item.id, item.label] as const)
      : [['round_robin', 'Round robin'], ['ladder', 'Ladder'], ['challenge', 'Challenge league'], ['standard', 'Scheduled season']]
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}><p className={styles.eyebrow}>Club competition</p><h2>Reuse the setup that works.</h2><p>Save club defaults once, then open League Office or Tournament Desk ready to finish the field and schedule.</p></div>
      {staff ? (
        <form className={styles.compactForm} onSubmit={(event) => { event.preventDefault(); void onCreate({ name, competitionType, entrantType, formatId, divisionLabel, defaultFacility }).then(() => setName('')) }}>
          <div className={styles.fieldGrid}>
            <label className={styles.field}><span>Name</span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Friday night ladder" /></label>
            <label className={styles.field}><span>Competition</span><select value={competitionType} onChange={(event) => { const value = event.target.value as 'league' | 'tournament'; setCompetitionType(value); setFormatId(value === 'tournament' ? 'single_elimination' : entrantType === 'teams' ? 'standard_2s_3d' : 'round_robin') }}><option value="league">League</option><option value="tournament">Tournament</option></select></label>
            <label className={styles.field}><span>Entry</span><select value={entrantType} onChange={(event) => { const value = event.target.value as 'players' | 'teams'; setEntrantType(value); if (competitionType === 'league') setFormatId(value === 'teams' ? 'standard_2s_3d' : 'round_robin') }}><option value="players">Players</option><option value="teams">Teams</option></select></label>
            <label className={styles.field}><span>Format</span><select value={formatId} onChange={(event) => setFormatId(event.target.value)}>{formatOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className={styles.field}><span>Division</span><input value={divisionLabel} onChange={(event) => setDivisionLabel(event.target.value)} placeholder="3.5 mixed" /></label>
            <label className={styles.field}><span>Facility</span><input value={defaultFacility} onChange={(event) => setDefaultFacility(event.target.value)} /></label>
          </div>
          <button className={styles.primary} disabled={working} type="submit">Save competition setup</button>
        </form>
      ) : null}
      {workspace.templates.length ? <div className={styles.cardGrid}>{workspace.templates.map((template) => <TemplateCard club={workspace.club} template={template} key={template.id} />)}</div> : <p className={styles.copy}>No saved competition setups yet.</p>}
      {workspace.competitions.length ? <><hr className={styles.sectionDivider} /><div className={styles.panelHeading}><h2>Club competitions</h2></div><div className={styles.cardGrid}>{workspace.competitions.map((competition) => <article className={styles.card} key={`${competition.type}-${competition.id}`}><div className={styles.cardTop}><h3>{competition.name}</h3><span className={styles.pill}>{competition.type}</span></div><span className={styles.muted}>{competition.status}</span><Link className={styles.primary} href={competition.href}>Open</Link>{manager ? <button className={styles.quietButton} type="button" onClick={() => onInvite(competition.type, competition.id)}>Invite people</button> : null}</article>)}</div></> : null}
    </section>
  )
}

function TemplateCard({ club, template }: { club: Club; template: ClubCompetitionTemplate }) {
  return <article className={styles.card}><div className={styles.cardTop}><h3>{template.name}</h3><span className={styles.pill}>{template.competitionType}</span></div><p>{[template.divisionLabel, template.defaultFacility, template.formatId.replaceAll('_', ' ')].filter(Boolean).join(' · ')}</p><Link className={styles.primary} href={buildClubCompetitionLaunchHref(club, template)}>Open {template.competitionType === 'league' ? 'League Office' : 'Tournament Desk'}</Link></article>
}

function ClubSettings({ club, working, onSave }: { club: Club; working: boolean; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({ name: club.name, description: club.description, logoUrl: club.logoUrl, heroImageUrl: club.heroImageUrl, primaryColor: club.primaryColor, locationLabel: club.locationLabel, contactEmail: club.contactEmail, timeZone: club.timeZone, isPublic: club.isPublic })
  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) { setForm((current) => ({ ...current, [key]: value })) }
  return <section className={styles.panel}><div className={styles.panelHeading}><p className={styles.eyebrow}>Club page</p><h2>Make the club feel like your club.</h2><p>These details carry into the public club home and new competition setups.</p></div><form className={styles.compactForm} onSubmit={(event) => { event.preventDefault(); void onSave(form) }}><div className={styles.fieldGrid}><label className={styles.field}><span>Name</span><input value={form.name} onChange={(event) => set('name', event.target.value)} /></label><label className={styles.field}><span>Club color</span><input type="color" value={form.primaryColor} onChange={(event) => set('primaryColor', event.target.value)} /></label><label className={styles.field}><span>Location</span><input value={form.locationLabel} onChange={(event) => set('locationLabel', event.target.value)} /></label><label className={styles.field}><span>Public contact email (optional)</span><input type="email" value={form.contactEmail} onChange={(event) => set('contactEmail', event.target.value)} /></label><label className={styles.field}><span>Time zone</span><input value={form.timeZone} onChange={(event) => set('timeZone', event.target.value)} /></label><label className={styles.field}><span>Logo URL</span><input value={form.logoUrl} onChange={(event) => set('logoUrl', event.target.value)} /></label><label className={`${styles.field} ${styles.full}`}><span>Hero image URL</span><input value={form.heroImageUrl} onChange={(event) => set('heroImageUrl', event.target.value)} /></label><label className={`${styles.field} ${styles.full}`}><span>About the club</span><textarea value={form.description} onChange={(event) => set('description', event.target.value)} /></label><label className={styles.check}><input type="checkbox" checked={form.isPublic} onChange={(event) => set('isPublic', event.target.checked)} />Public club page</label></div><button className={styles.primary} disabled={working} type="submit">Save club page</button></form></section>
}

function CreateClubForm({ working, message, messageTone, onCreate }: { working: boolean; message: string; messageTone: 'success' | 'danger'; onCreate: (payload: Record<string, unknown>) => Promise<void> }) {
  const [name, setName] = useState('')
  const [locationLabel, setLocationLabel] = useState('')
  const [description, setDescription] = useState('')
  return <section className={styles.empty}><p className={styles.eyebrow}>Club</p><h1 className={styles.title}>Give the club one home.</h1><p className={styles.copy}>Start with the club. Add people, clinics, teams, leagues, and tournaments next.</p>{message ? <div className={`${styles.notice} ${messageTone === 'danger' ? styles.danger : styles.success}`}>{message}</div> : null}<form className={styles.compactForm} onSubmit={(event: FormEvent) => { event.preventDefault(); void onCreate({ name, locationLabel, description }) }}><label className={styles.field}><span>Club name</span><input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Westside Tennis Club" /></label><label className={styles.field}><span>Location</span><input value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)} placeholder="St. Louis, Missouri" /></label><label className={styles.field}><span>What should players know?</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label><button className={styles.primary} disabled={working} type="submit">{working ? 'Creating...' : 'Create club'}</button></form></section>
}

function RoleChecks({ value, onChange }: { value: ClubRole[]; onChange: (roles: ClubRole[]) => void }) {
  return <div className={styles.checkGrid}>{CLUB_ROLES.filter((role) => role !== 'owner').map((role) => <label className={styles.check} key={role}><input type="checkbox" checked={value.includes(role)} onChange={() => onChange(value.includes(role) ? value.filter((item) => item !== role) : [...value, role])} />{getClubRoleLabel(role)}</label>)}</div>
}

function getRoleActions(roles: ClubRole[], workspace: ClubWorkspaceData) {
  if (roles.some((role) => role === 'owner' || role === 'admin' || role === 'director')) return [
    { title: 'Develop players', detail: `${workspace.memberships.length} people connected to the club experience`, label: 'Open coaching view', href: buildClubToolHref('/coach', workspace.club) },
    { title: 'Run programs', detail: `${workspace.groups.length} clinics, teams, camps, or development groups`, label: 'Open programs', tab: 'groups' as WorkspaceTab },
    { title: 'Host competition', detail: 'Club leagues and tournaments with schedules, draws, and results', label: 'Open competition', tab: 'compete' as WorkspaceTab },
    ...(hasClubTeamProgram(workspace) ? [{ title: 'Support teams', detail: 'Availability, projected lineups, and team messages', label: 'Open Team Hub', href: buildClubToolHref('/captain', workspace.club) }] : []),
  ]
  if (roles.includes('coach')) return [
    { title: 'Player book', detail: 'Goals, assignments, and reviews', label: 'Open Coach Hub', href: buildClubToolHref('/coach', workspace.club) },
    { title: 'Programs', detail: 'Open the groups you coach from the club roster', label: 'Open programs', tab: 'groups' as WorkspaceTab },
    { title: 'Video feedback', detail: 'Review a clip and return cues', label: 'Open Video Review', href: buildClubToolHref('/video-review', workspace.club) },
  ]
  if (roles.some((role) => role === 'captain' || role === 'coordinator')) return [
    ...(hasClubTeamProgram(workspace) ? [{ title: 'Team work', detail: 'Availability, projected lineups, and messages', label: 'Open Team Hub', href: buildClubToolHref('/captain', workspace.club) }] : []),
    { title: 'Club league', detail: 'Schedules, entries, and results', label: 'Open League Office', href: buildClubToolHref('/league-coordinator', workspace.club) },
    { title: 'Tournament day', detail: 'Entries, draws, courts, and scores', label: 'Open Tournament Desk', href: buildClubToolHref('/league-coordinator/tournaments', workspace.club) },
  ]
  return [
    { title: 'My development', detail: 'Your assignments and next focus', label: 'Open My Lab', href: buildClubToolHref('/mylab', workspace.club) },
    { title: 'My programs', detail: 'See the clinics, teams, and groups connected to you', label: 'Open programs', tab: 'groups' as WorkspaceTab },
    { title: 'Club competition', detail: 'Schedules, draws, and results', label: 'Open Compete', href: buildClubToolHref('/compete', workspace.club) },
  ]
}

function getHomeTitle(roles: ClubRole[]) { return isClubManager(roles) ? 'Keep the tennis experience moving.' : roles.includes('coach') ? 'Who needs your next step?' : roles.some((role) => role === 'captain' || role === 'coordinator') ? 'What needs organizing?' : 'What is next for your tennis?' }
function getHomeCopy(roles: ClubRole[]) { return isClubManager(roles) ? 'Open the player, program, or competition job that matters today.' : roles.includes('coach') ? 'Keep each player’s lesson, assignment, and progress connected.' : roles.some((role) => role === 'captain' || role === 'coordinator') ? 'Move the team or competition without hunting for the right tool.' : 'Your club programs, coaching, and competition stay together here.' }
function getClubHeroAction(workspace: ClubWorkspaceData, roles: ClubRole[]): { label: string; href?: string; tab?: WorkspaceTab; setupStep?: ClubSetupStep } {
  if (isClubManager(roles)) {
    const nextSetupStep = getClubSetupSteps(workspace).find((step) => !step.completed)
    if (nextSetupStep) return { label: nextSetupStep.actionLabel, setupStep: nextSetupStep }
    return { label: 'Open coaching view', href: buildClubToolHref('/coach', workspace.club) }
  }
  if (roles.includes('coach')) return { label: 'Open Coach Hub', href: buildClubToolHref('/coach', workspace.club) }
  if (roles.includes('captain') && hasClubTeamProgram(workspace)) return { label: 'Open Team Hub', href: buildClubToolHref('/captain', workspace.club) }
  return { label: 'Open My Lab', href: buildClubToolHref('/mylab', workspace.club) }
}
function readStoredClubId() { try { return window.localStorage.getItem('tenaceiq.club.active') || '' } catch { return '' } }
function rememberClubId(clubId: string) { try { window.localStorage.setItem('tenaceiq.club.active', clubId) } catch { /* best effort */ } }
function readRequestedClubId() { return new URL(window.location.href).searchParams.get('clubId') || '' }
function readRequestedWorkspaceTab(): WorkspaceTab | null { const value = new URL(window.location.href).searchParams.get('tab'); return value === 'people' || value === 'groups' || value === 'compete' || value === 'settings' || value === 'home' ? value : null }
function readRequestedGroupId() { return new URL(window.location.href).searchParams.get('groupId') || '' }
