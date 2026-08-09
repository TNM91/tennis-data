'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import { TEAM_MATCH_FORMATS, TOURNAMENT_DRAW_FORMATS } from '@/lib/competition-format-registry'
import { getClubRosterConnectionLabel, type ClubRosterConnectionStatus } from '@/lib/club-roster-reconciliation'
import { getClubCommunicationSummary, type ClubCommunicationItem } from '@/lib/club-communication'
import { notifyClubCommunicationUpdated } from '@/lib/club-communication-events'
import {
  CLUB_ROLES,
  buildClubCompetitionLaunchHref,
  buildClubWeeklyBrief,
  buildClubToolHref,
  canRunClubPrograms,
  getClubCompetitionRosterHandoff,
  getClubCompetitionTeamHandoff,
  getClubCalendarConflicts,
  getVisibleClubCalendarEvents,
  getClubWeeklyBriefTargets,
  getClubCompetitionReadiness,
  getClubGroupTypeLabel,
  getLinkableClubCompetitions,
  getClubProgramReadinessAction,
  getClubRoleLabel,
  getClubSetupSteps,
  hasClubTeamProgram,
  isClubManager,
  needsClubProgramLaunch,
  normalizeClubInviteEmails,
  type Club,
  type ClubCalendarEvent,
  type ClubCalendarEventType,
  type ClubCompetitionTemplate,
  type ClubGroup,
  type ClubGroupType,
  type ClubInvite,
  type ClubMembership,
  type ClubRole,
  type ClubSetupStep,
  type ClubInviteTargetType,
  type ClubLinkedCompetition,
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

type ClubRosterContact = {
  id: string
  importedByUserId: string
  importedByName: string
  ownedByYou: boolean
  sharedWithClub: boolean
  connectionStatus: ClubRosterConnectionStatus
  matchedMembershipId: string
  matchedUserId: string
  connectedDestinations: ClubRosterDestination[]
  teamName: string
  leagueName: string
  flight: string
  fullName: string
  phone: string
  email: string
  role: string
  isCaptain: boolean
  updatedAt: string
}

type ClubRosterDestination = {
  type: 'group' | 'league' | 'tournament'
  id: string
  name: string
  label: string
}

type ClubPeopleFilter = 'all' | 'unassigned' | 'teams' | 'clinics' | 'competition'

type ClubPeopleAssignment = ClubRosterDestination & {
  category: Exclude<ClubPeopleFilter, 'all' | 'unassigned'> | 'programs'
}

type ClubGroupRenewal = {
  membershipId: string
  playerName: string
  email: string
  phone: string
  responseToken: string
  status: 'pending' | 'confirmed' | 'declined'
  expiresAt: string
  respondedAt: string
}

type ClubAnnouncementDestination = {
  groupId: string
  name: string
  type: 'team' | 'clinic'
  href: string
}

type ClubAnnouncementHistory = {
  id: string
  clubId: string
  authorUserId: string
  authorName: string
  body: string
  destinations: ClubAnnouncementDestination[]
  createdAt: string
}

type WorkspaceTab = 'home' | 'calendar' | 'people' | 'groups' | 'compete' | 'settings'

const tabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'calendar', label: 'Schedule' },
  { id: 'people', label: 'People' },
  { id: 'groups', label: 'Programs' },
  { id: 'compete', label: 'Compete' },
  { id: 'settings', label: 'Club' },
]

const groupTypes: ClubGroupType[] = ['clinic', 'team', 'camp', 'development_group', 'league_division', 'tournament_field']

const clubPeopleFilters: Array<{ id: ClubPeopleFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'teams', label: 'Teams' },
  { id: 'clinics', label: 'Clinics' },
  { id: 'competition', label: 'Competition' },
]

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
  const [requestedRosterOpen, setRequestedRosterOpen] = useState(false)
  const [requestedRosterTeam, setRequestedRosterTeam] = useState('')
  const [inviteDestination, setInviteDestination] = useState('club:')
  const [openCommunicationOnLoad] = useState(() => readRequestedCommunicationOpen())

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

  const loadRosterContacts = useCallback(async () => {
    if (!selectedClubId) return []
    const response = await request<{ contacts?: ClubRosterContact[] }>(`/api/clubs/${selectedClubId}/roster-contacts`)
    return response.contacts ?? []
  }, [request, selectedClubId])

  const postClubMessage = useCallback(async (group: ClubGroup, text: string) => {
    if (group.groupType === 'team') {
      if (!group.teamChatScope) throw new Error('Link this team to your Captain profile before posting to Team Chat.')
      await request('/api/team-rooms', {
        method: 'POST',
        body: JSON.stringify({ action: 'send', ...group.teamChatScope, body: text, announcement: true }),
      })
      const params = new URLSearchParams({
        team: group.teamChatScope.teamName,
        league: group.teamChatScope.leagueName,
        flight: group.teamChatScope.flight,
      })
      return `/team-room?${params.toString()}`
    }
    await request(`/api/clubs/${group.clubId}/clinics/${group.id}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'message', body: text, kind: 'announcement' }),
    })
    return `/clubs/clinics/${group.id}?tab=messages`
  }, [request])

  const loadClubAnnouncements = useCallback(async () => {
    if (!selectedClubId) return []
    const response = await request<{ announcements?: ClubAnnouncementHistory[] }>(`/api/clubs/${selectedClubId}/announcements`)
    return response.announcements ?? []
  }, [request, selectedClubId])

  const recordClubAnnouncement = useCallback(async (body: string, destinations: ClubAnnouncementDestination[]) => {
    if (!selectedClubId) throw new Error('Choose a club before saving this announcement.')
    const response = await request<{ announcement?: ClubAnnouncementHistory }>(`/api/clubs/${selectedClubId}/announcements`, {
      method: 'POST',
      body: JSON.stringify({ body, destinations }),
    })
    if (!response.announcement) throw new Error('The announcement posted, but its history could not be saved.')
    return response.announcement
  }, [request, selectedClubId])

  const loadClubCommunication = useCallback(async () => {
    if (!selectedClubId) return []
    const response = await request<{ items?: ClubCommunicationItem[] }>(`/api/clubs/${selectedClubId}/communication`)
    return response.items ?? []
  }, [request, selectedClubId])

  const markClubCommunicationRead = useCallback(async (channelId = '') => {
    if (!selectedClubId) throw new Error('Choose a club before updating communication.')
    const response = await request<{ channelIds?: string[] }>(`/api/clubs/${selectedClubId}/communication`, {
      method: 'PATCH',
      body: JSON.stringify(channelId ? { channelId } : {}),
    })
    notifyClubCommunicationUpdated()
    return response.channelIds ?? []
  }, [request, selectedClubId])

  const setRosterSharing = useCallback(async (contactIds: string[], share: boolean) => {
    if (!selectedClubId) return ''
    const response = await request<{ message?: string }>(`/api/clubs/${selectedClubId}/roster-contacts`, {
      method: 'PATCH',
      body: JSON.stringify({ contactIds, share }),
    })
    return response.message ?? ''
  }, [request, selectedClubId])

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
    setRequestedRosterOpen(readRequestedRosterOpen())
    setRequestedRosterTeam(readRequestedRosterTeam())
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

  async function uploadClubLogo(file: File) {
    if (!workspace || !accessToken) throw new Error('Open a club before uploading its logo.')
    setWorking(true)
    try {
      const body = new FormData()
      body.set('file', file)
      const response = await fetch(`/api/clubs/${encodeURIComponent(workspace.club.id)}/branding`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body,
      })
      const payload = await response.json() as { club?: Club; logoUrl?: string; message?: string }
      if (!response.ok || !payload.logoUrl || !payload.club) throw new Error(payload.message || 'The club logo could not be uploaded.')
      const updatedClub = payload.club
      setWorkspace((current) => current ? { ...current, club: updatedClub } : current)
      setClubs((current) => current.map((club) => club.id === updatedClub.id ? updatedClub : club))
      showMessage('Club logo uploaded and saved.')
      return payload.logoUrl
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'The club logo could not be uploaded.', 'danger')
      throw error
    } finally {
      setWorking(false)
    }
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

  function openPeople(destination = 'club:', openRoster = false) {
    setGuidedStepId(null)
    setInviteDestination(destination)
    setRequestedRosterOpen(openRoster)
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

  async function copyPendingRenewalReminders() {
    if (!workspace || working) return
    const pendingGroups = workspace.groups.filter((group) => group.isActive && group.renewalPendingCount > 0)
    if (!pendingGroups.length) {
      showMessage('No returning players are waiting for a response.')
      return
    }
    setWorking(true)
    try {
      const groupRenewals = await Promise.all(pendingGroups.map(async (group) => {
        const result = await request<{ renewals?: ClubGroupRenewal[] }>(`/api/clubs/${workspace.club.id}/groups/${group.id}/renewals`, { method: 'POST' })
        return { group, renewals: result.renewals ?? [] }
      }))
      const messages = groupRenewals.flatMap(({ group, renewals }) => renewals
        .filter((renewal) => renewal.status === 'pending')
        .map((renewal) => `${renewal.playerName}, are you returning for ${group.name}${group.seasonLabel ? ` · ${group.seasonLabel}` : ''}? Confirm here: ${window.location.origin}/clubs/renew/${renewal.responseToken}`))
      if (!messages.length) {
        await refreshWorkspace()
        showMessage('Everyone has responded. Club Home is up to date.')
        return
      }
      await navigator.clipboard.writeText(messages.join('\n\n'))
      await refreshWorkspace()
      showMessage(`${messages.length} personalized ${messages.length === 1 ? 'reminder is' : 'reminders are'} copied. Paste ${messages.length === 1 ? 'it' : 'them'} into a team text or email.`)
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Pending reminders could not be copied.', 'danger')
    } finally {
      setWorking(false)
    }
  }

  async function prepareRenewals(groupId: string) {
    if (!workspace) return []
    setWorking(true)
    try {
      const result = await request<{ renewals?: ClubGroupRenewal[] }>(`/api/clubs/${workspace.club.id}/groups/${groupId}/renewals`, { method: 'POST' })
      await refreshWorkspace()
      return result.renewals ?? []
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Player renewal links could not be prepared.', 'danger')
      throw error
    } finally {
      setWorking(false)
    }
  }

  async function finalizeRenewals(groupId: string) {
    if (!workspace) return
    setWorking(true)
    try {
      const result = await request<{ message?: string }>(`/api/clubs/${workspace.club.id}/groups/${groupId}/renewals`, { method: 'PATCH' })
      await refreshWorkspace()
      showMessage(result.message || 'Roster finalized.')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'The roster could not be finalized.', 'danger')
      throw error
    } finally {
      setWorking(false)
    }
  }

  async function completeRenewalFill(groupId: string) {
    if (!workspace) return
    setWorking(true)
    try {
      const result = await request<{ message?: string }>(`/api/clubs/${workspace.club.id}/groups/${groupId}/renewals`, { method: 'PATCH', body: JSON.stringify({ action: 'complete-fill' }) })
      await refreshWorkspace()
      showMessage(result.message || 'The current roster is set.')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Open spots could not be closed.', 'danger')
      throw error
    } finally {
      setWorking(false)
    }
  }

  async function launchProgram(group: ClubGroup) {
    if (!workspace) return
    const launch = getClubProgramReadinessAction(group, workspace.club)
    setWorking(true)
    try {
      if (launch.syncCoachRoster) {
        await request(`/api/clubs/${workspace.club.id}/coach-sync`, { method: 'POST', body: JSON.stringify({ groupId: group.id }) })
      }
      await request(`/api/clubs/${workspace.club.id}/groups`, { method: 'PATCH', body: JSON.stringify({ action: 'mark-launched', groupId: group.id }) })
      window.location.assign(launch.href)
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'The program launch could not open.', 'danger')
      setWorking(false)
    }
  }

  async function syncCompetitionRoster(competition: ClubLinkedCompetition, membershipIds: string[]) {
    if (!workspace || !membershipIds.length) return
    setWorking(true)
    try {
      const result = await request<{ message?: string }>(`/api/clubs/${workspace.club.id}/roster-contacts`, {
        method: 'PUT',
        body: JSON.stringify({ membershipIds, targetType: competition.type, targetId: competition.id }),
      })
      await refreshWorkspace()
      showMessage(result.message || 'Club players added to the competition.')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Club players could not be added to the competition.', 'danger')
      throw error
    } finally {
      setWorking(false)
    }
  }

  async function syncCompetitionTeams(groupId: string, teamGroupIds: string[]) {
    if (!workspace || !teamGroupIds.length) return
    setWorking(true)
    try {
      const result = await request<{ message?: string }>(`/api/clubs/${workspace.club.id}/groups/${groupId}/competition`, {
        method: 'PUT',
        body: JSON.stringify({ teamGroupIds }),
      })
      await refreshWorkspace()
      showMessage(result.message || 'Club teams added to the competition.')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Club teams could not be added to the competition.', 'danger')
      throw error
    } finally {
      setWorking(false)
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

      {tab === 'home' ? <ClubHome workspace={workspace} roles={clubRoles} working={working} openCommunicationOnLoad={openCommunicationOnLoad} onPostMessage={postClubMessage} onLoadAnnouncements={loadClubAnnouncements} onRecordAnnouncement={recordClubAnnouncement} onLoadCommunication={loadClubCommunication} onMarkCommunicationRead={markClubCommunicationRead} onCopyPendingRenewals={copyPendingRenewalReminders} onPrepareRenewals={prepareRenewals} onFinalizeRenewals={finalizeRenewals} onFillOpenSpots={(groupId) => openPeople(`group:${groupId}`, true)} onCompleteRenewalFill={completeRenewalFill} onLaunchProgram={launchProgram} onSyncCompetitionRoster={syncCompetitionRoster} onOpenProgram={(groupId) => { setRequestedGroupId(groupId); setTab('groups') }} onOpenTab={(nextTab) => nextTab === 'people' ? openPeople() : setTab(nextTab)} onRunSetupStep={openGuidedStep} /> : null}
      {tab === 'calendar' ? <ClubCalendarPanel workspace={workspace} /> : null}
      {tab === 'people' ? (
        <PeoplePanel
          key={`${guidedStepId ?? 'people'}:${inviteDestination}`}
          workspace={workspace}
          manager={manager}
          working={working}
          initialDestination={inviteDestination}
          initialRosterOpen={requestedRosterOpen}
          requestedRosterTeam={requestedRosterTeam}
          guidedStepId={guidedStepId === 'staff' || guidedStepId === 'players' ? guidedStepId : null}
          onLoadRosterContacts={loadRosterContacts}
          onSetRosterSharing={setRosterSharing}
          onAddConnectedPlayers={async (membershipIds, targetType, targetId) => {
            const response = await request<{ message?: string }>(`/api/clubs/${workspace.club.id}/roster-contacts`, {
              method: 'PUT',
              body: JSON.stringify({ membershipIds, targetType, targetId }),
            })
            await refreshWorkspace()
            return response.message ?? ''
          }}
          onRemoveConnectedPlayers={async (membershipIds, targetType, targetId) => {
            const response = await request<{ message?: string }>(`/api/clubs/${workspace.club.id}/roster-contacts`, {
              method: 'DELETE',
              body: JSON.stringify({ membershipIds, targetType, targetId }),
            })
            await refreshWorkspace()
            return response.message ?? ''
          }}
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
          onRollover={async (sourceGroupIds, seasonLabel, copyMembers, copyCompetitionSetup) => {
            setWorking(true)
            try {
              const result = await request<{ message?: string }>(`/api/clubs/${workspace.club.id}/groups`, { method: 'PUT', body: JSON.stringify({ sourceGroupIds, seasonLabel, copyMembers, copyCompetitionSetup }) })
              await refreshWorkspace()
              showMessage(result.message || `${seasonLabel} is ready.`)
              return result.message || `${seasonLabel} is ready.`
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'The new season could not be created.'
              showMessage(errorMessage, 'danger')
              throw error
            } finally { setWorking(false) }
          }}
          onSeasonAction={async (action, seasonLabel) => {
            setWorking(true)
            try {
              const result = await request<{ message?: string }>(`/api/clubs/${workspace.club.id}/groups`, { method: 'PATCH', body: JSON.stringify({ action, seasonLabel }) })
              await refreshWorkspace()
              showMessage(result.message || `${seasonLabel} was updated.`)
              return result.message || `${seasonLabel} was updated.`
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'The season could not be updated.'
              showMessage(errorMessage, 'danger')
              throw error
            } finally { setWorking(false) }
          }}
          onPrepareRenewals={prepareRenewals}
          onFinalizeRenewals={finalizeRenewals}
          onFillOpenSpots={(groupId) => openPeople(`group:${groupId}`, true)}
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
              const group = workspace.groups.find((item) => item.id === groupId)
              if (result.synced) window.location.assign(`${buildClubToolHref('/coach', workspace.club, { source: 'club-program-card', groupId, program: group?.name ?? '' })}#coach-lesson-frame`)
            } catch (error) {
              showMessage(error instanceof Error ? error.message : 'The roster could not be connected.', 'danger')
            } finally { setWorking(false) }
          }}
          onLinkCompetition={async (groupId, competitionId) => {
            setWorking(true)
            try {
              const result = await request<{ message?: string }>(`/api/clubs/${workspace.club.id}/groups/${groupId}/competition`, { method: 'PATCH', body: JSON.stringify({ competitionId }) })
              await refreshWorkspace()
              showMessage(result.message || 'Competition connected.')
            } catch (error) {
              showMessage(error instanceof Error ? error.message : 'The competition could not be connected.', 'danger')
              throw error
            } finally { setWorking(false) }
          }}
          onSyncCompetitionRoster={syncCompetitionRoster}
          onSyncCompetitionTeams={syncCompetitionTeams}
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
          onUploadLogo={uploadClubLogo}
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

type ClubCalendarFilter = 'all' | ClubCalendarEventType

const clubCalendarFilters: Array<{ id: ClubCalendarFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'clinic', label: 'Clinics' },
  { id: 'team_match', label: 'Teams' },
  { id: 'league_match', label: 'Leagues' },
  { id: 'tournament_match', label: 'Tournaments' },
]

function ClubCalendarPanel({ workspace }: { workspace: ClubWorkspaceData }) {
  const [filter, setFilter] = useState<ClubCalendarFilter>('all')
  const calendarEvents = useMemo(() => {
    const today = getClubTodayForTimeZone(workspace.club.timeZone)
    return (workspace.calendarEvents ?? []).filter((event) => event.startsAt.slice(0, 10) >= today)
  }, [workspace.calendarEvents, workspace.club.timeZone])
  const conflicts = useMemo(() => getClubCalendarConflicts(calendarEvents), [calendarEvents])
  const conflictEventIds = useMemo(() => new Set(conflicts.flatMap((conflict) => conflict.eventIds)), [conflicts])
  const events = filter === 'all' ? calendarEvents : calendarEvents.filter((event) => event.type === filter)
  const days = events.reduce<Array<{ date: string; events: ClubCalendarEvent[] }>>((result, event) => {
    const date = event.startsAt.slice(0, 10)
    const current = result[result.length - 1]
    if (current?.date === date) current.events.push(event)
    else result.push({ date, events: [event] })
    return result
  }, [])

  return (
    <section className={styles.panel}>
      <div className={styles.headingRow}>
        <div className={styles.panelHeading}>
          <p className={styles.eyebrow}>Club schedule</p>
          <h2>Everything happening next.</h2>
          <p>Clinics, team matches, leagues, and tournaments in one place.</p>
        </div>
        <span className={styles.pill}>{events.length} upcoming</span>
      </div>

      {conflicts.length ? (
        <div className={styles.calendarAlert} role="status">
          <strong>{conflicts.length} schedule {conflicts.length === 1 ? 'check' : 'checks'}</strong>
          <span>TIQ found overlapping people or courts. Open the event that needs attention.</span>
          <ul>{conflicts.slice(0, 4).map((conflict) => <li key={conflict.id}>{conflict.detail}</li>)}</ul>
        </div>
      ) : null}

      <div className={styles.calendarFilters} aria-label="Filter club schedule">
        {clubCalendarFilters.map((item) => {
          const count = item.id === 'all' ? calendarEvents.length : calendarEvents.filter((event) => event.type === item.id).length
          return <button key={item.id} type="button" className={filter === item.id ? styles.calendarFilterActive : ''} onClick={() => setFilter(item.id)}>{item.label}<span>{count}</span></button>
        })}
      </div>

      {days.length ? (
        <div className={styles.calendarDays}>
          {days.map((day) => (
            <section className={styles.calendarDay} key={day.date}>
              <div className={styles.calendarDate}>
                <span>{formatClubCalendarWeekday(day.date)}</span>
                <strong>{formatClubCalendarDate(day.date)}</strong>
              </div>
              <div className={styles.calendarEventList}>
                {day.events.map((event) => (
                  <Link className={`${styles.calendarEvent} ${conflictEventIds.has(event.id) ? styles.calendarEventConflict : ''}`} href={event.href} key={event.id}>
                    <div className={styles.calendarEventTime}>{event.allDay ? 'All day' : formatClubCalendarTime(event.startsAt, workspace.club.timeZone)}</div>
                    <div className={styles.calendarEventBody}>
                      <span className={styles.calendarEventType}>{getClubCalendarTypeLabel(event.type)}</span>
                      <strong>{event.title}</strong>
                      <small>{[event.groupName !== event.title ? event.groupName : '', event.locationLabel, event.courtLabel].filter(Boolean).join(' · ')}</small>
                    </div>
                    <b>{conflictEventIds.has(event.id) ? 'Check' : 'Open'}</b>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}><strong>No upcoming {filter === 'all' ? 'club events' : getClubCalendarTypeLabel(filter).toLowerCase()}.</strong><span>Add the schedule in its TIQ tool and it will appear here automatically.</span></div>
      )}

      <p className={styles.calendarNote}>TIQ brings schedules together. Court booking stays in your club system.</p>
    </section>
  )
}

function formatClubCalendarWeekday(date: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(`${date}T12:00:00`))
}

function formatClubCalendarDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

function formatClubCalendarTime(startsAt: string, timeZone: string) {
  const date = new Date(startsAt)
  if (!Number.isFinite(date.getTime())) return 'Time TBD'
  const options: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
  if (startsAt.endsWith('Z') && timeZone) options.timeZone = timeZone
  return new Intl.DateTimeFormat('en-US', options).format(date)
}

function getClubCalendarTypeLabel(type: ClubCalendarEventType) {
  if (type === 'team_match') return 'Team match'
  if (type === 'league_match') return 'League match'
  if (type === 'tournament_match') return 'Tournament'
  return 'Clinic'
}

function ClubPulse({ workspace, roles, openCommunicationOnLoad, onPostMessage, onLoadAnnouncements, onRecordAnnouncement, onLoadCommunication, onMarkCommunicationRead, onOpenTab }: { workspace: ClubWorkspaceData; roles: ClubRole[]; openCommunicationOnLoad: boolean; onPostMessage: (group: ClubGroup, text: string) => Promise<string>; onLoadAnnouncements: () => Promise<ClubAnnouncementHistory[]>; onRecordAnnouncement: (body: string, destinations: ClubAnnouncementDestination[]) => Promise<ClubAnnouncementHistory>; onLoadCommunication: () => Promise<ClubCommunicationItem[]>; onMarkCommunicationRead: (channelId?: string) => Promise<string[]>; onOpenTab: (tab: WorkspaceTab) => void }) {
  const [shareStatus, setShareStatus] = useState('')
  const [showChatTargets, setShowChatTargets] = useState(false)
  const [showAnnouncementCenter, setShowAnnouncementCenter] = useState(false)
  const [communicationItems, setCommunicationItems] = useState<ClubCommunicationItem[]>([])
  const [communicationLoading, setCommunicationLoading] = useState(false)
  const [communicationError, setCommunicationError] = useState('')
  const [selectedTargetId, setSelectedTargetId] = useState('')
  const [postingTargetId, setPostingTargetId] = useState('')
  const [postedHref, setPostedHref] = useState('')
  const manager = isClubManager(roles)
  const today = getClubTodayForTimeZone(workspace.club.timeZone)
  const visibleEvents = getVisibleClubCalendarEvents(workspace.calendarEvents ?? [], workspace.groups, workspace.currentMembership, roles)
  const upcomingEvents = visibleEvents.filter((event) => event.startsAt.slice(0, 10) >= today)
  const todayEvents = upcomingEvents.filter((event) => event.startsAt.slice(0, 10) === today)
  const resultsNeeded = visibleEvents.filter((event) => event.needsResult)
  const conflicts = getClubCalendarConflicts(upcomingEvents)
  const pendingRenewals = manager ? workspace.groups.reduce((total, group) => total + group.renewalPendingCount, 0) : 0
  const openSpots = manager ? workspace.groups
    .filter((group) => group.isActive && Boolean(group.renewalsFinalizedAt) && !group.renewalFillCompletedAt)
    .reduce((total, group) => total + Math.max(0, group.renewalTargetRosterSize - group.memberIds.length), 0) : 0
  const nextEvent = upcomingEvents[0]
  const pulseClear = !conflicts.length && !resultsNeeded.length && !pendingRenewals && !openSpots
  const chatTargets = getClubWeeklyBriefTargets(workspace.groups, roles, workspace.currentMembership.userId)
  const selectedTarget = chatTargets.find((group) => group.id === selectedTargetId) ?? chatTargets[0]

  useEffect(() => {
    if (!openCommunicationOnLoad) return
    let active = true
    const timeout = window.setTimeout(async () => {
      setShareStatus('')
      setPostedHref('')
      setShowAnnouncementCenter(true)
      setCommunicationLoading(true)
      setCommunicationError('')
      try {
        const items = await onLoadCommunication()
        if (active) setCommunicationItems(items)
      } catch (loadError) {
        if (active) setCommunicationError(loadError instanceof Error ? loadError.message : 'Club communication could not load.')
      } finally {
        if (active) setCommunicationLoading(false)
      }
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [onLoadCommunication, openCommunicationOnLoad])

  async function openCommunication() {
    setShareStatus('')
    setPostedHref('')
    setShowAnnouncementCenter(true)
    if (communicationLoading) return
    setCommunicationLoading(true)
    setCommunicationError('')
    try {
      setCommunicationItems(await onLoadCommunication())
    } catch (loadError) {
      setCommunicationError(loadError instanceof Error ? loadError.message : 'Club communication could not load.')
    } finally {
      setCommunicationLoading(false)
    }
  }

  async function markCommunicationRead(channelId = '') {
    try {
      const channelIds = await onMarkCommunicationRead(channelId)
      const reviewedIds = new Set(channelIds)
      setCommunicationError('')
      setCommunicationItems((current) => current.map((item) => reviewedIds.has(item.channelId) ? { ...item, unreadCount: 0 } : item))
    } catch (reviewError) {
      setCommunicationError(reviewError instanceof Error ? reviewError.message : 'Communication could not be marked read.')
    }
  }

  function weeklyBrief(group?: ClubGroup) {
    const events = group ? visibleEvents.filter((event) => event.groupId === group.id) : visibleEvents
    const eventIds = new Set(events.map((event) => event.id))
    const groupOpenSpots = group && manager && group.renewalsFinalizedAt && !group.renewalFillCompletedAt
      ? Math.max(0, group.renewalTargetRosterSize - group.memberIds.length)
      : 0
    return buildClubWeeklyBrief({
      clubName: workspace.club.name,
      programName: group?.name,
      timeZone: workspace.club.timeZone,
      events,
      conflictCount: group ? conflicts.filter((conflict) => conflict.eventIds.some((eventId) => eventIds.has(eventId))).length : conflicts.length,
      resultCount: group ? events.filter((event) => event.needsResult).length : resultsNeeded.length,
      pendingRenewalCount: group && manager ? group.renewalPendingCount : pendingRenewals,
      openSpotCount: group ? groupOpenSpots : openSpots,
      publicUrl: `${window.location.origin}/clubs/${workspace.club.slug}`,
      today,
    })
  }

  async function shareWeeklyBrief() {
    const text = weeklyBrief()
    try {
      if (navigator.share) {
        await navigator.share({ title: `${workspace.club.name} weekly tennis brief`, text })
        setShareStatus('Weekly brief shared.')
      } else {
        await navigator.clipboard.writeText(text)
        setShareStatus('Weekly brief copied.')
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(text)
        setShareStatus('Weekly brief copied.')
      } catch {
        setShareStatus('The weekly brief could not be shared. Try again.')
      }
    }
  }

  async function postWeeklyBrief(group: ClubGroup) {
    setPostingTargetId(group.id)
    setShareStatus('')
    setPostedHref('')
    try {
      const href = await onPostMessage(group, weeklyBrief(group))
      setShareStatus(`Weekly brief posted to ${group.name}.`)
      setPostedHref(href)
      setShowChatTargets(false)
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : 'The weekly brief could not be posted. Try again.')
    } finally {
      setPostingTargetId('')
    }
  }

  function openChatPost() {
    if (chatTargets.length === 1) {
      void postWeeklyBrief(chatTargets[0])
      return
    }
    setSelectedTargetId(selectedTarget?.id ?? '')
    setShowChatTargets(true)
  }

  return (
    <section className={styles.clubPulse} aria-labelledby="club-pulse-title">
      <div className={styles.clubPulseHeading}>
        <div><p className={styles.eyebrow}>Club pulse</p><h3 id="club-pulse-title">{pulseClear ? 'Everything is moving.' : 'See what needs attention.'}</h3></div>
        <div className={styles.clubPulseActions}><button className={styles.quietButton} type="button" onClick={() => void shareWeeklyBrief()}>Share weekly brief</button>{chatTargets.length ? <><button className={styles.quietButton} disabled={Boolean(postingTargetId)} type="button" onClick={openChatPost}>{postingTargetId ? 'Posting...' : 'Post to chat'}</button><button className={styles.quietButton} disabled={Boolean(postingTargetId)} type="button" onClick={() => void openCommunication()}>Communication</button></> : null}<button className={styles.quietButton} type="button" onClick={() => onOpenTab('calendar')}>Open schedule</button></div>
      </div>
      {showChatTargets && selectedTarget ? <div className={styles.clubPulsePost}><label className={styles.field}><span>Post weekly brief to</span><select value={selectedTarget.id} onChange={(event) => setSelectedTargetId(event.target.value)}>{chatTargets.map((group) => <option key={group.id} value={group.id}>{group.name} — {group.groupType === 'team' ? 'Team Chat' : 'Clinic updates'}</option>)}</select></label><div><button className={styles.primary} disabled={Boolean(postingTargetId)} type="button" onClick={() => void postWeeklyBrief(selectedTarget)}>{postingTargetId ? 'Posting...' : 'Post brief'}</button><button className={styles.quietButton} disabled={Boolean(postingTargetId)} type="button" onClick={() => setShowChatTargets(false)}>Cancel</button></div></div> : null}
      <div className={styles.clubPulseStats}>
        <button type="button" onClick={() => onOpenTab('calendar')}><strong>{todayEvents.length}</strong><span>Today</span></button>
        <button type="button" onClick={() => onOpenTab('calendar')}><strong>{conflicts.length}</strong><span>Schedule checks</span></button>
        <div><strong>{resultsNeeded.length}</strong><span>Results to add</span></div>
        {manager ? <button type="button" onClick={() => onOpenTab('groups')}><strong>{pendingRenewals + openSpots}</strong><span>Roster follow-ups</span></button> : null}
      </div>
      <div className={styles.clubPulseList}>
        {conflicts.length ? <button type="button" onClick={() => onOpenTab('calendar')}><span>Check schedule</span><strong>{conflicts[0].detail}</strong><b>Review</b></button> : null}
        {resultsNeeded.length ? <Link href={resultsNeeded[0].href}><span>Add result</span><strong>{resultsNeeded[0].title}</strong><b>Open</b></Link> : null}
        {nextEvent ? <Link href={nextEvent.href}><span>{todayEvents.length ? 'Next today' : 'Next up'}</span><strong>{nextEvent.title}</strong><small>{nextEvent.allDay ? formatClubCalendarDate(nextEvent.startsAt.slice(0, 10)) : `${formatClubCalendarDate(nextEvent.startsAt.slice(0, 10))} · ${formatClubCalendarTime(nextEvent.startsAt, workspace.club.timeZone)}`}</small><b>Open</b></Link> : null}
        {!nextEvent && pulseClear ? <div className={styles.clubPulseClear}><strong>No immediate Club work.</strong><span>New schedules and follow-ups will appear here automatically.</span></div> : null}
      </div>
      {shareStatus ? <p className={styles.clubPulseShareStatus} role="status">{shareStatus}{postedHref ? <> <Link href={postedHref}>Open chat</Link></> : null}</p> : null}
      {showAnnouncementCenter ? <ClubAnnouncementCenter clubName={workspace.club.name} targets={chatTargets} communicationItems={communicationItems} communicationLoading={communicationLoading} communicationError={communicationError} onClose={() => setShowAnnouncementCenter(false)} onPost={onPostMessage} onLoadHistory={onLoadAnnouncements} onRecordHistory={onRecordAnnouncement} onReloadCommunication={openCommunication} onMarkCommunicationRead={markCommunicationRead} onPublished={(count, href, warning) => { setShareStatus(`Announcement posted to ${count} ${count === 1 ? 'chat' : 'chats'}.${warning ? ` ${warning}` : ''}`); setPostedHref(href); setShowAnnouncementCenter(false) }} /> : null}
    </section>
  )
}

function ClubAnnouncementCenter({ clubName, targets, communicationItems, communicationLoading, communicationError, onClose, onPost, onLoadHistory, onRecordHistory, onReloadCommunication, onMarkCommunicationRead, onPublished }: { clubName: string; targets: ClubGroup[]; communicationItems: ClubCommunicationItem[]; communicationLoading: boolean; communicationError: string; onClose: () => void; onPost: (group: ClubGroup, text: string) => Promise<string>; onLoadHistory: () => Promise<ClubAnnouncementHistory[]>; onRecordHistory: (body: string, destinations: ClubAnnouncementDestination[]) => Promise<ClubAnnouncementHistory>; onReloadCommunication: () => Promise<void>; onMarkCommunicationRead: (channelId?: string) => Promise<void>; onPublished: (count: number, href: string, warning: string) => void }) {
  const [mode, setMode] = useState<'followup' | 'compose' | 'history'>('followup')
  const [followupView, setFollowupView] = useState<'attention' | 'recent'>('attention')
  const [body, setBody] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>(targets.length === 1 ? [targets[0].id] : [])
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<ClubAnnouncementHistory[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const historyRequestId = useRef(0)
  const selectedTargets = targets.filter((group) => selectedIds.includes(group.id))
  const message = body.trim().slice(0, 2000)
  const communicationSummary = getClubCommunicationSummary(communicationItems)
  const visibleCommunication = followupView === 'attention'
    ? communicationItems.filter((item) => item.needsReply || item.unreadCount > 0)
    : communicationItems

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !working) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, working])

  useEffect(() => () => { historyRequestId.current += 1 }, [])

  async function openHistory(force = false) {
    setMode('history')
    if (historyLoading || historyLoaded && !force) return
    const requestId = ++historyRequestId.current
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const items = await onLoadHistory()
      if (requestId !== historyRequestId.current) return
      setHistory(items)
      setHistoryLoaded(true)
    } catch (loadError) {
      if (requestId !== historyRequestId.current) return
      setHistoryError(loadError instanceof Error ? loadError.message : 'Announcement history could not load.')
      setHistoryLoaded(true)
    } finally {
      if (requestId === historyRequestId.current) setHistoryLoading(false)
    }
  }

  function toggleTarget(groupId: string) {
    setSelectedIds((current) => current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId])
    setError('')
  }

  async function publishAnnouncement() {
    if (!message) {
      setError('Write the announcement first.')
      return
    }
    if (!selectedTargets.length) {
      setError('Choose at least one team or clinic.')
      return
    }
    setWorking(true)
    setError('')
    const results = await Promise.allSettled(selectedTargets.map(async (group) => ({ group, href: await onPost(group, message) })))
    const posted = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : [])
    const failed = results.flatMap((result, index) => result.status === 'rejected' ? [{ group: selectedTargets[index], reason: result.reason }] : [])
    let historyWarning = ''
    if (posted.length) {
      try {
        const saved = await onRecordHistory(message, posted.map(({ group, href }) => ({ groupId: group.id, name: group.name, type: group.groupType === 'team' ? 'team' as const : 'clinic' as const, href })))
        setHistory((current) => [saved, ...current.filter((item) => item.id !== saved.id)])
        setHistoryLoaded(true)
      } catch {
        historyWarning = 'The chats received it, but TIQ could not save the history receipt.'
      }
    }
    if (!failed.length) {
      setWorking(false)
      onPublished(posted.length, posted.length === 1 ? posted[0].href : '', historyWarning)
      return
    }
    setSelectedIds(failed.map((item) => item.group.id))
    const firstReason = failed[0].reason instanceof Error ? failed[0].reason.message : ''
    setError(`${posted.length ? `Posted to ${posted.length}. ` : ''}Could not post to ${failed.map((item) => item.group.name).join(', ')}.${firstReason ? ` ${firstReason}` : ''}${historyWarning ? ` ${historyWarning}` : ''}`)
    setWorking(false)
  }

  function reuseAnnouncement(item: ClubAnnouncementHistory) {
    const availableIds = new Set(targets.map((group) => group.id))
    const priorIds = item.destinations.map((destination) => destination.groupId).filter((groupId) => availableIds.has(groupId))
    setBody(item.body)
    setSelectedIds(priorIds.length ? priorIds : targets.length === 1 ? [targets[0].id] : [])
    setError(priorIds.length ? '' : 'Choose where this announcement should go now.')
    setMode('compose')
  }

  return (
    <div className={styles.clubAnnouncementBackdrop} onMouseDown={() => { if (!working) onClose() }}>
      <section className={styles.clubAnnouncementSheet} role="dialog" aria-modal="true" aria-labelledby="club-announcement-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.clubAnnouncementHeading}>
          <div><p className={styles.eyebrow}>Club communication</p><h2 id="club-announcement-title">Follow up without chasing threads.</h2><p>See what needs a response, then send the right update.</p></div>
          <button className={styles.quietButton} disabled={working} type="button" onClick={onClose}>Close</button>
        </div>
        <div className={styles.clubAnnouncementTabs} role="tablist" aria-label="Club communication">
          <button id="club-communication-followup-tab" aria-controls="club-communication-followup-panel" aria-selected={mode === 'followup'} disabled={working} role="tab" type="button" onClick={() => setMode('followup')}>Follow-up</button>
          <button id="club-announcement-compose-tab" aria-controls="club-announcement-compose-panel" aria-selected={mode === 'compose'} disabled={working} role="tab" type="button" onClick={() => setMode('compose')}>New</button>
          <button id="club-announcement-history-tab" aria-controls="club-announcement-history-panel" aria-selected={mode === 'history'} disabled={working} role="tab" type="button" onClick={() => void openHistory()}>History</button>
        </div>
        {mode === 'followup' ? (
          <div className={styles.clubCommunicationFollowup} id="club-communication-followup-panel" role="tabpanel" aria-labelledby="club-communication-followup-tab">
            <div className={styles.clubCommunicationSummary}>
              <span><strong>{communicationSummary.needsReplyCount}</strong> need reply</span>
              <span><strong>{communicationSummary.unreadCount}</strong> unread</span>
              {communicationSummary.unreadCount ? <button className={styles.quietButton} type="button" onClick={() => void onMarkCommunicationRead()}>Mark all read</button> : null}
            </div>
            <div className={styles.clubCommunicationViews} aria-label="Communication view">
              <button aria-pressed={followupView === 'attention'} type="button" onClick={() => setFollowupView('attention')}>Needs attention</button>
              <button aria-pressed={followupView === 'recent'} type="button" onClick={() => setFollowupView('recent')}>Recent</button>
              {communicationLoading ? <span role="status">Refreshing...</span> : null}
            </div>
            {communicationError ? <div className={styles.clubAnnouncementError} role="alert">{communicationError}<button className={styles.quietButton} type="button" onClick={() => void onReloadCommunication()}>Try again</button></div> : null}
            {communicationLoading && !communicationItems.length ? <div className={styles.emptyState}><strong>Checking Club conversations...</strong></div> : visibleCommunication.length ? (
              <div className={styles.clubCommunicationList}>
                {visibleCommunication.map((item) => (
                  <article key={item.id} data-needs-reply={item.needsReply || undefined}>
                    <div className={styles.clubCommunicationCardHeading}>
                      <div><span>{item.channelType === 'team' ? 'Team Chat' : 'Clinic'}</span><strong>{item.channelName}</strong></div>
                      <time dateTime={item.createdAt}>{formatClubAnnouncementDate(item.createdAt)}</time>
                    </div>
                    <p><strong>{item.authorName}:</strong> {item.body}</p>
                    <div className={styles.clubCommunicationBadges}>
                      {item.needsReply ? <span>Needs reply</span> : null}
                      {item.unreadCount ? <span>{item.unreadCount} unread</span> : null}
                      {item.activityType === 'availability_reply' ? <span>Availability reply</span> : null}
                    </div>
                    <div className={styles.clubCommunicationActions}>
                      <Link className={styles.primary} href={item.href}>{item.needsReply ? 'Open and reply' : 'Open conversation'}</Link>
                      {item.unreadCount ? <button className={styles.quietButton} type="button" onClick={() => void onMarkCommunicationRead(item.channelId)}>Mark read</button> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <strong>{followupView === 'attention' ? "You're caught up." : 'No recent Club conversations.'}</strong>
                <span>{followupView === 'attention' ? 'New replies and unread updates will appear here.' : 'Linked Team Chat and clinic activity will appear here.'}</span>
                {followupView === 'attention' && communicationItems.length ? <button className={styles.quietButton} type="button" onClick={() => setFollowupView('recent')}>See recent</button> : null}
              </div>
            )}
          </div>
        ) : mode === 'compose' ? (
          <div className={styles.clubAnnouncementCompose} id="club-announcement-compose-panel" role="tabpanel" aria-labelledby="club-announcement-compose-tab">
            <label className={styles.field}><span>Message</span><textarea autoFocus maxLength={2000} value={body} onChange={(event) => { setBody(event.target.value); setError('') }} placeholder="Practice moved to Court 4 at 6:30 PM." /><small>{body.length}/2000</small></label>
            <div className={styles.clubAnnouncementTargets} role="group" aria-labelledby="club-announcement-targets"><div><strong id="club-announcement-targets">Choose conversations</strong><button className={styles.quietButton} disabled={working} type="button" onClick={() => setSelectedIds(selectedIds.length === targets.length ? [] : targets.map((group) => group.id))}>{selectedIds.length === targets.length ? 'Clear all' : 'Select all'}</button></div><div>{targets.map((group) => <label key={group.id}><input checked={selectedIds.includes(group.id)} disabled={working} type="checkbox" onChange={() => toggleTarget(group.id)} /><span><strong>{group.name}</strong><small>{group.groupType === 'team' ? 'Team Chat' : 'Clinic updates'}</small></span></label>)}</div></div>
            <div className={styles.clubAnnouncementPreview}><div><span>Preview</span><small>{selectedTargets.length ? `${selectedTargets.length} selected` : 'Choose chats'}</small></div><strong>{clubName}</strong><p>{message || 'Your announcement will appear here.'}</p></div>
            {error ? <p className={styles.clubAnnouncementError} role="alert">{error}</p> : null}
            <div className={styles.clubAnnouncementFooter}><button className={styles.primary} disabled={working || !message || !selectedTargets.length} type="button" onClick={() => void publishAnnouncement()}>{working ? 'Publishing...' : `Publish to ${selectedTargets.length || 0} ${selectedTargets.length === 1 ? 'chat' : 'chats'}`}</button><button className={styles.quietButton} disabled={working} type="button" onClick={onClose}>Cancel</button></div>
          </div>
        ) : (
          <div className={styles.clubAnnouncementHistory} id="club-announcement-history-panel" role="tabpanel" aria-labelledby="club-announcement-history-tab">{historyLoading ? <div className={styles.emptyState}><strong>Loading announcement history...</strong></div> : historyError ? <div className={styles.clubAnnouncementError} role="alert">{historyError}<button className={styles.quietButton} type="button" onClick={() => void openHistory(true)}>Try again</button></div> : history.length ? history.map((item) => <article key={item.id}><div><div><strong>{item.authorName}</strong><time dateTime={item.createdAt}>{formatClubAnnouncementDate(item.createdAt)}</time></div><button className={styles.quietButton} type="button" onClick={() => reuseAnnouncement(item)}>Use again</button></div><p>{item.body}</p><div>{item.destinations.map((destination) => <Link href={destination.href} key={`${item.id}-${destination.groupId}`}>{destination.name}</Link>)}</div></article>) : <div className={styles.emptyState}><strong>No Club announcements yet.</strong><span>Your first published announcement will appear here for the staff team.</span><button className={styles.primary} type="button" onClick={() => setMode('compose')}>Write announcement</button></div>}</div>
        )}
      </section>
    </div>
  )
}

function formatClubAnnouncementDate(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Recently'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

function getClubTodayForTimeZone(timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timeZone || 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
    return `${value('year')}-${value('month')}-${value('day')}`
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

function ClubHome({ workspace, roles, working, openCommunicationOnLoad, onPostMessage, onLoadAnnouncements, onRecordAnnouncement, onLoadCommunication, onMarkCommunicationRead, onCopyPendingRenewals, onPrepareRenewals, onFinalizeRenewals, onFillOpenSpots, onCompleteRenewalFill, onLaunchProgram, onSyncCompetitionRoster, onOpenProgram, onOpenTab, onRunSetupStep }: { workspace: ClubWorkspaceData; roles: ClubRole[]; working: boolean; openCommunicationOnLoad: boolean; onPostMessage: (group: ClubGroup, text: string) => Promise<string>; onLoadAnnouncements: () => Promise<ClubAnnouncementHistory[]>; onRecordAnnouncement: (body: string, destinations: ClubAnnouncementDestination[]) => Promise<ClubAnnouncementHistory>; onLoadCommunication: () => Promise<ClubCommunicationItem[]>; onMarkCommunicationRead: (channelId?: string) => Promise<string[]>; onCopyPendingRenewals: () => Promise<void>; onPrepareRenewals: (groupId: string) => Promise<ClubGroupRenewal[]>; onFinalizeRenewals: (groupId: string) => Promise<void>; onFillOpenSpots: (groupId: string) => void; onCompleteRenewalFill: (groupId: string) => Promise<void>; onLaunchProgram: (group: ClubGroup) => Promise<void>; onSyncCompetitionRoster: (competition: ClubLinkedCompetition, membershipIds: string[]) => Promise<void>; onOpenProgram: (groupId: string) => void; onOpenTab: (tab: WorkspaceTab) => void; onRunSetupStep: (step: ClubSetupStep) => void }) {
  const staff = canRunClubPrograms(roles)
  const manager = isClubManager(roles)
  const actions = getRoleActions(roles, workspace)
  const setupSteps = getClubSetupSteps(workspace)
  const completedSetupSteps = setupSteps.filter((step) => step.completed).length
  const setupComplete = completedSetupSteps === setupSteps.length
  const [showSetup, setShowSetup] = useState(false)
  const [showAllSteps, setShowAllSteps] = useState(false)
  const [renewalReviewGroup, setRenewalReviewGroup] = useState<ClubGroup | null>(null)
  const [renewalReviewRows, setRenewalReviewRows] = useState<ClubGroupRenewal[]>([])
  const nextStep = setupSteps.find((step) => !step.completed) ?? setupSteps[setupSteps.length - 1]
  const showEverydayWorkspace = !manager || setupComplete || openCommunicationOnLoad
  const pendingRenewalCount = workspace.groups
    .filter((group) => group.isActive)
    .reduce((total, group) => total + group.renewalPendingCount, 0)
  const readyRenewalGroups = workspace.groups.filter((group) => group.isActive && !group.renewalsFinalizedAt && group.renewalPendingCount === 0 && group.renewalConfirmedCount + group.renewalDeclinedCount > 0)
  const readyConfirmedCount = readyRenewalGroups.reduce((total, group) => total + group.renewalConfirmedCount, 0)
  const readyDeclinedCount = readyRenewalGroups.reduce((total, group) => total + group.renewalDeclinedCount, 0)
  const fillOpenGroups = workspace.groups.filter((group) => group.isActive && Boolean(group.renewalsFinalizedAt) && !group.renewalFillCompletedAt && group.renewalTargetRosterSize > group.memberIds.length)
  const nextFillGroup = fillOpenGroups[0]
  const nextOpenSpotCount = nextFillGroup ? Math.max(0, nextFillGroup.renewalTargetRosterSize - nextFillGroup.memberIds.length) : 0
  const launchReadyGroups = workspace.groups.filter(needsClubProgramLaunch)
  const nextLaunchGroup = launchReadyGroups[0]
  const nextLaunchAction = nextLaunchGroup ? getClubProgramReadinessAction(nextLaunchGroup, workspace.club) : null
  const nextRosterHandoff = nextLaunchGroup ? getClubCompetitionRosterHandoff(nextLaunchGroup, workspace.competitions, workspace.memberships) : null
  const nextTeamHandoff = nextLaunchGroup ? getClubCompetitionTeamHandoff(nextLaunchGroup, workspace.competitions, workspace.groups) : null
  const competitionNeedsWork = workspace.competitions
    .map((competition) => ({ competition, readiness: getClubCompetitionReadiness(competition) }))
    .filter((item) => !item.readiness.ready)
  const nextCompetitionWork = competitionNeedsWork[0]
  const finishingClinicSchedule = Boolean(nextLaunchGroup?.groupType === 'clinic' && nextLaunchGroup.launchHandoffCompletedAt && nextLaunchGroup.clinicSessionCount === 0)
  const finishingTeamSetup = Boolean(nextLaunchGroup?.groupType === 'team')
  const finishingCoachSetup = Boolean(nextLaunchGroup?.groupType === 'camp' || nextLaunchGroup?.groupType === 'development_group')

  async function openRenewalReview(group: ClubGroup) {
    setRenewalReviewGroup(group)
    setRenewalReviewRows([])
    try {
      setRenewalReviewRows(await onPrepareRenewals(group.id))
    } catch {
      setRenewalReviewGroup(null)
    }
  }

  async function finalizeRenewalReview() {
    if (!renewalReviewGroup) return
    try {
      await onFinalizeRenewals(renewalReviewGroup.id)
      setRenewalReviewGroup(null)
      setRenewalReviewRows([])
    } catch {
      // The global Club notice explains what still needs attention.
    }
  }
  return (
    <section className={styles.panel}>
      <div className={styles.headingRow}>
        <div className={styles.panelHeading}><p className={styles.eyebrow}>{manager && !setupComplete ? 'Start here' : 'Right now'}</p><h2>{manager && !setupComplete ? 'Get the club ready, one step at a time.' : getHomeTitle(roles)}</h2><p>{manager && !setupComplete ? 'Finish the next job below. Club brings you back here automatically.' : getHomeCopy(roles)}</p></div>
        {manager && setupComplete && !showSetup ? <button className={styles.quietButton} type="button" onClick={() => setShowSetup(true)}>Setup help</button> : null}
      </div>
      {manager && pendingRenewalCount > 0 ? <section className={styles.renewalTask} aria-labelledby="pending-renewals-title">
        <div><p className={styles.eyebrow}>Needs attention</p><h3 id="pending-renewals-title">{pendingRenewalCount} returning {pendingRenewalCount === 1 ? 'player is' : 'players are'} still waiting.</h3><p>Copy private reminders for everyone who has not answered.</p></div>
        <div className={styles.renewalTaskActions}><button className={styles.primary} disabled={working} type="button" onClick={() => void onCopyPendingRenewals()}>{working ? 'Preparing reminders...' : 'Copy pending reminders'}</button><button className={styles.quietButton} type="button" onClick={() => onOpenTab('groups')}>Review responses</button></div>
      </section> : null}
      {manager && pendingRenewalCount === 0 && readyRenewalGroups.length ? <section className={styles.renewalTask} aria-labelledby="finalize-renewals-title">
        <div><p className={styles.eyebrow}>Ready to finish</p><h3 id="finalize-renewals-title">{readyRenewalGroups.length === 1 ? `${readyRenewalGroups[0].name} is ready to finalize.` : `${readyRenewalGroups.length} rosters are ready to finalize.`}</h3><p>{readyConfirmedCount} returning · {readyDeclinedCount} not returning</p></div>
        <div className={styles.renewalTaskActions}><button className={styles.primary} disabled={working} type="button" onClick={() => void openRenewalReview(readyRenewalGroups[0])}>{working ? 'Opening roster...' : 'Review and finalize'}</button><button className={styles.quietButton} type="button" onClick={() => onOpenTab('groups')}>Open Programs</button></div>
      </section> : null}
      {manager && pendingRenewalCount === 0 && !readyRenewalGroups.length && fillOpenGroups.length ? <section className={styles.renewalTask} aria-labelledby="fill-open-spots-title">
        <div><p className={styles.eyebrow}>Roster openings</p><h3 id="fill-open-spots-title">{nextFillGroup.name} has {nextOpenSpotCount} open {nextOpenSpotCount === 1 ? 'spot' : 'spots'}.</h3><p>Add Club members, use Player Roster contacts, or invite someone new.{fillOpenGroups.length > 1 ? ` ${fillOpenGroups.length - 1} more ${fillOpenGroups.length === 2 ? 'program' : 'programs'} will follow.` : ''}</p></div>
        <div className={styles.renewalTaskActions}><button className={styles.primary} disabled={working} type="button" onClick={() => onFillOpenSpots(nextFillGroup.id)}>Fill open spots</button><button className={styles.quietButton} disabled={working} type="button" onClick={() => void onCompleteRenewalFill(nextFillGroup.id)}>No replacements needed</button></div>
      </section> : null}
      {manager && setupComplete && pendingRenewalCount === 0 && !readyRenewalGroups.length && !fillOpenGroups.length && nextLaunchGroup && nextLaunchAction ? <section className={styles.renewalTask} aria-labelledby="launch-program-title">
        <div><p className={styles.eyebrow}>{nextRosterHandoff?.missingMemberIds.length || nextTeamHandoff?.missingTeams.length ? 'Roster ready' : finishingClinicSchedule || finishingTeamSetup || finishingCoachSetup ? 'Finish setup' : 'Ready to launch'}</p><h3 id="launch-program-title">{nextRosterHandoff?.missingMemberIds.length ? `${nextLaunchGroup.name} can use its Club roster.` : nextTeamHandoff?.missingTeams.length ? `${nextLaunchGroup.name} has Club teams ready.` : finishingClinicSchedule ? `${nextLaunchGroup.name} still needs its first date.` : nextLaunchAction.title}</h3><p>{nextRosterHandoff?.missingMemberIds.length ? `${nextRosterHandoff.missingMemberIds.length} connected ${nextRosterHandoff.missingMemberIds.length === 1 ? 'player is' : 'players are'} ready to add without duplicates.` : nextTeamHandoff?.missingTeams.length ? `Choose exactly which of the ${nextTeamHandoff.missingTeams.length} available Club ${nextTeamHandoff.missingTeams.length === 1 ? 'team enters' : 'teams enter'}.` : nextLaunchAction.detail}{launchReadyGroups.length > 1 ? ` ${launchReadyGroups.length - 1} more ${launchReadyGroups.length === 2 ? 'program' : 'programs'} will follow.` : ''}</p></div>
        <div className={styles.renewalTaskActions}><button className={styles.primary} disabled={working} type="button" onClick={() => nextRosterHandoff?.missingMemberIds.length ? void onSyncCompetitionRoster(nextRosterHandoff.competition, nextRosterHandoff.missingMemberIds) : nextTeamHandoff?.missingTeams.length ? onOpenProgram(nextLaunchGroup.id) : void onLaunchProgram(nextLaunchGroup)}>{working ? nextRosterHandoff?.missingMemberIds.length ? 'Adding players...' : 'Opening...' : nextRosterHandoff?.missingMemberIds.length ? `Add ${nextRosterHandoff.missingMemberIds.length} Club ${nextRosterHandoff.missingMemberIds.length === 1 ? 'player' : 'players'}` : nextTeamHandoff?.missingTeams.length ? 'Choose Club teams' : nextLaunchAction.label}</button><button className={styles.quietButton} type="button" onClick={() => onOpenTab('groups')}>Open Programs</button></div>
      </section> : null}
      {manager && setupComplete && pendingRenewalCount === 0 && !readyRenewalGroups.length && !fillOpenGroups.length && !nextLaunchGroup && nextCompetitionWork ? <section className={styles.renewalTask} aria-labelledby="finish-competition-title">
        <div><p className={styles.eyebrow}>Finish competition</p><h3 id="finish-competition-title">{nextCompetitionWork.competition.name}: {nextCompetitionWork.readiness.label.toLowerCase()}.</h3><p>{nextCompetitionWork.readiness.detail}{competitionNeedsWork.length > 1 ? ` ${competitionNeedsWork.length - 1} more ${competitionNeedsWork.length === 2 ? 'competition' : 'competitions'} will follow.` : ''}</p></div>
        <div className={styles.renewalTaskActions}><Link className={styles.primary} href={nextCompetitionWork.competition.href}>{nextCompetitionWork.readiness.actionLabel}</Link><button className={styles.quietButton} type="button" onClick={() => onOpenTab('compete')}>Open Competition</button></div>
      </section> : null}
      {showEverydayWorkspace ? <ClubPulse key={workspace.club.id} workspace={workspace} roles={roles} openCommunicationOnLoad={openCommunicationOnLoad} onPostMessage={onPostMessage} onLoadAnnouncements={onLoadAnnouncements} onRecordAnnouncement={onRecordAnnouncement} onLoadCommunication={onLoadCommunication} onMarkCommunicationRead={onMarkCommunicationRead} onOpenTab={onOpenTab} /> : null}
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
        <div className={styles.stat}><strong>{workspace.groups.filter((group) => group.isActive).length}</strong><span>Active programs</span></div>
        <div className={styles.stat}><strong>{workspace.competitions.length}</strong><span>Live competitions</span></div>
      </div>
      <div className={styles.actionGrid}>
        {actions.map((action) => action.tab
          ? <button key={action.title} className={`${styles.actionCard} ${styles.actionCardButton}`} type="button" onClick={() => onOpenTab(action.tab!)}><strong>{action.title}</strong><span>{action.detail}</span><b>{action.label}</b></button>
          : <Link key={action.title} className={styles.actionCard} href={action.href!}><strong>{action.title}</strong><span>{action.detail}</span><b>{action.label}</b></Link>)}
      </div>
      {staff ? <button className={styles.secondary} type="button" onClick={() => onOpenTab('compete')}>Set up club competition</button> : null}</> : null}
      {renewalReviewGroup ? <div className={styles.renewalBackdrop} role="presentation">
        <section className={styles.renewalSheet} role="dialog" aria-modal="true" aria-labelledby="finalize-roster-title">
          <div className={styles.headingRow}><div className={styles.panelHeading}><p className={styles.eyebrow}>Final roster check</p><h2 id="finalize-roster-title">{renewalReviewGroup.name}</h2><p>Review each answer. Finalizing closes these decisions for the season.</p></div><button className={styles.quietButton} type="button" onClick={() => setRenewalReviewGroup(null)}>Close</button></div>
          <div className={styles.renewalSummary} aria-label="Final renewal results"><span>{renewalReviewRows.filter((renewal) => renewal.status === 'confirmed').length} yes</span><span>{renewalReviewRows.filter((renewal) => renewal.status === 'declined').length} no</span></div>
          {working && !renewalReviewRows.length ? <p className={styles.muted}>Opening responses...</p> : <div className={styles.renewalList}>{renewalReviewRows.map((renewal) => <article className={styles.renewalRow} key={renewal.membershipId}><div><strong>{renewal.playerName}</strong><span>{renewal.phone || renewal.email || 'Club player'}</span></div><span className={`${styles.renewalStatus} ${renewal.status === 'confirmed' ? styles.renewalYes : styles.renewalNo}`}>{renewal.status === 'confirmed' ? 'Returning' : 'Not returning'}</span></article>)}</div>}
          <div className={styles.renewalActions}><button className={styles.primary} disabled={working || !renewalReviewRows.length} type="button" onClick={() => void finalizeRenewalReview()}>{working ? 'Finalizing...' : 'Finalize roster'}</button><button className={styles.secondary} type="button" onClick={() => setRenewalReviewGroup(null)}>Keep open</button></div>
        </section>
      </div> : null}
    </section>
  )
}

function PeoplePanel({ workspace, manager, working, guidedStepId, initialDestination, initialRosterOpen, requestedRosterTeam, onInvite, onShare, onRevoke, onLoadRosterContacts, onSetRosterSharing, onAddConnectedPlayers, onRemoveConnectedPlayers }: { workspace: ClubWorkspaceData; manager: boolean; working: boolean; guidedStepId: 'staff' | 'players' | null; initialDestination: string; initialRosterOpen: boolean; requestedRosterTeam: string; onInvite: (email: string, roles: ClubRole[], targetType: ClubInviteTargetType, targetId: string) => Promise<boolean>; onShare: (invite: ClubInvite) => Promise<void>; onRevoke: (inviteId: string) => Promise<void>; onLoadRosterContacts: () => Promise<ClubRosterContact[]>; onSetRosterSharing: (contactIds: string[], share: boolean) => Promise<string>; onAddConnectedPlayers: (membershipIds: string[], targetType: 'group' | 'league' | 'tournament', targetId: string) => Promise<string>; onRemoveConnectedPlayers: (membershipIds: string[], targetType: 'group' | 'league' | 'tournament', targetId: string) => Promise<string> }) {
  const activeGroups = useMemo(() => workspace.groups.filter((group) => group.isActive), [workspace.groups])
  const connectedDestinations = useMemo(() => [
    ...activeGroups.map((group) => ({ value: `group:${group.id}`, label: `${group.name} · ${getClubGroupTypeLabel(group.groupType)}` })),
    ...workspace.competitions.filter((competition) => competition.entrantType === 'players').map((competition) => ({ value: `${competition.type}:${competition.id}`, label: `${competition.name} · ${competition.type}` })),
  ], [activeGroups, workspace.competitions])
  const assignmentsByMemberId = useMemo(() => {
    const assignments = new Map<string, ClubPeopleAssignment[]>()
    const add = (membershipId: string, assignment: ClubPeopleAssignment) => assignments.set(membershipId, [...(assignments.get(membershipId) ?? []), assignment])
    for (const group of activeGroups) {
      const category = group.groupType === 'team' ? 'teams' : group.groupType === 'clinic' ? 'clinics' : 'programs'
      for (const membershipId of group.memberIds) add(membershipId, { type: 'group', id: group.id, name: group.name, label: getClubGroupTypeLabel(group.groupType), category })
      for (const membershipId of group.reviewMemberIds) add(membershipId, { type: 'group', id: group.id, name: group.name, label: `${getClubGroupTypeLabel(group.groupType)} · Review`, category })
    }
    for (const competition of workspace.competitions) {
      if (competition.entrantType !== 'players') continue
      for (const membershipId of competition.memberIds) add(membershipId, { type: competition.type, id: competition.id, name: competition.name, label: competition.type === 'league' ? 'League' : 'Tournament', category: 'competition' })
    }
    return assignments
  }, [activeGroups, workspace.competitions])
  const [email, setEmail] = useState('')
  const [roles, setRoles] = useState<ClubRole[]>(guidedStepId === 'staff' ? ['coach'] : ['player'])
  const [destination, setDestination] = useState(initialDestination)
  const [rosterOpen, setRosterOpen] = useState(initialRosterOpen)
  const [rosterLoading, setRosterLoading] = useState(false)
  const [rosterSharing, setRosterSharing] = useState(false)
  const [rosterAdding, setRosterAdding] = useState(false)
  const [rosterContacts, setRosterContacts] = useState<ClubRosterContact[]>([])
  const [rosterTeam, setRosterTeam] = useState('')
  const [selectedRosterEmails, setSelectedRosterEmails] = useState<string[]>([])
  const [selectedConnectedMembershipIds, setSelectedConnectedMembershipIds] = useState<string[]>([])
  const [connectedDestination, setConnectedDestination] = useState(() => connectedDestinations.some((item) => item.value === initialDestination) ? initialDestination : connectedDestinations[0]?.value ?? '')
  const [movingPlacement, setMovingPlacement] = useState<{ membershipId: string; playerName: string; source: ClubRosterDestination } | null>(null)
  const [rosterMessage, setRosterMessage] = useState('')
  const [peopleSearch, setPeopleSearch] = useState('')
  const [peopleFilter, setPeopleFilter] = useState<ClubPeopleFilter>('all')
  const [selectedPeopleIds, setSelectedPeopleIds] = useState<string[]>([])
  const [peopleDestination, setPeopleDestination] = useState(() => connectedDestinations[0]?.value ?? '')
  const [peopleWorking, setPeopleWorking] = useState(false)
  const [peopleMessage, setPeopleMessage] = useState('')
  const [inviteOpen, setInviteOpen] = useState(Boolean(guidedStepId))
  const inviteCount = normalizeClubInviteEmails(email).length
  const inviteLabel = inviteCount > 1 ? `Create ${inviteCount} invite links` : guidedStepId === 'staff' ? 'Invite staff member' : guidedStepId === 'players' ? 'Invite player' : 'Create invite link'
  const destinationSeparator = destination.indexOf(':')
  const targetType = destination.slice(0, destinationSeparator) as ClubInviteTargetType
  const targetId = destination.slice(destinationSeparator + 1)
  const rosterScopes = Array.from(new Map(rosterContacts.map((contact) => [getRosterScopeKey(contact), contact])).values())
  const visibleRosterContacts = rosterContacts.filter((contact) => getRosterScopeKey(contact) === rosterTeam)
  const activeRosterScope = visibleRosterContacts[0] ?? null
  const readyRosterCount = visibleRosterContacts.filter((contact) => contact.connectionStatus === 'ready').length
  const connectedRosterCount = visibleRosterContacts.filter((contact) => contact.connectionStatus === 'connected').length
  const pendingRosterCount = visibleRosterContacts.filter((contact) => contact.connectionStatus === 'pending').length
  const emailNeededRosterCount = visibleRosterContacts.filter((contact) => contact.connectionStatus === 'email_needed').length
  const sharedRosterCount = visibleRosterContacts.filter((contact) => contact.sharedWithClub).length
  const rosterIsFullyShared = Boolean(visibleRosterContacts.length && sharedRosterCount === visibleRosterContacts.length)
  const rosterSharingLabel = activeRosterScope?.ownedByYou
    ? rosterIsFullyShared
      ? 'Shared with authorized club managers.'
      : sharedRosterCount
        ? `${sharedRosterCount} of ${visibleRosterContacts.length} contacts shared. Share the whole roster to finish.`
        : 'Private to you until you share it with the club.'
    : activeRosterScope
      ? `Shared by ${activeRosterScope.importedByName}.`
      : ''
  const rosterUploadHref = `/data-assist?type=team_summary&help=1&context=Club%20People&returnTo=${encodeURIComponent(`/clubs?clubId=${workspace.club.id}&tab=people&roster=1`)}#upload`
  const normalizedPeopleSearch = peopleSearch.trim().toLowerCase()
  const memberMatchesFilter = (memberId: string, filter: ClubPeopleFilter) => {
    const assignments = assignmentsByMemberId.get(memberId) ?? []
    if (filter === 'all') return true
    if (filter === 'unassigned') return assignments.length === 0
    return assignments.some((assignment) => assignment.category === filter)
  }
  const peopleFilterCounts: Record<ClubPeopleFilter, number> = {
    all: workspace.memberships.length,
    unassigned: workspace.memberships.filter((member) => memberMatchesFilter(member.id, 'unassigned')).length,
    teams: workspace.memberships.filter((member) => memberMatchesFilter(member.id, 'teams')).length,
    clinics: workspace.memberships.filter((member) => memberMatchesFilter(member.id, 'clinics')).length,
    competition: workspace.memberships.filter((member) => memberMatchesFilter(member.id, 'competition')).length,
  }
  const visiblePeople = workspace.memberships
    .filter((member) => memberMatchesFilter(member.id, peopleFilter))
    .filter((member) => !normalizedPeopleSearch || [member.displayName, member.email, member.phone, ...member.roles].join(' ').toLowerCase().includes(normalizedPeopleSearch))
    .sort((left, right) => {
      const assignmentDifference = (assignmentsByMemberId.get(left.id)?.length ?? 0) - (assignmentsByMemberId.get(right.id)?.length ?? 0)
      if (peopleFilter === 'all' && assignmentDifference !== 0) return assignmentDifference
      return (left.displayName || left.email).localeCompare(right.displayName || right.email)
    })
  const selectedPeopleInDestination = selectedPeopleIds.filter((membershipId) => {
    const [type, id] = splitClubDestination(peopleDestination)
    return (assignmentsByMemberId.get(membershipId) ?? []).some((assignment) => assignment.type === type && assignment.id === id)
  })

  const openRosterContacts = useCallback(async () => {
    setRosterOpen(true)
    setRosterLoading(true)
    setRosterMessage('')
    try {
      const contacts = await onLoadRosterContacts()
      setRosterContacts(contacts)
      const requestedKey = normalizeRosterTeamKey(requestedRosterTeam)
      const requestedContact = contacts.find((contact) => normalizeRosterTeamKey(contact.teamName) === requestedKey)
      const nextTeam = requestedContact ? getRosterScopeKey(requestedContact) : contacts[0] ? getRosterScopeKey(contacts[0]) : ''
      setRosterTeam(nextTeam)
      setSelectedRosterEmails(getReadyRosterEmails(contacts, nextTeam))
      setSelectedConnectedMembershipIds([])
      setMovingPlacement(null)
      if (!contacts.length) setRosterMessage('No imported Player Roster contacts yet. Upload the roster, then Club will bring you back here.')
    } catch (error) {
      setRosterMessage(error instanceof Error ? error.message : 'Imported roster contacts could not be opened.')
    } finally {
      setRosterLoading(false)
    }
  }, [onLoadRosterContacts, requestedRosterTeam])

  useEffect(() => {
    if (!initialRosterOpen) return
    const timeout = window.setTimeout(() => void openRosterContacts(), 0)
    return () => window.clearTimeout(timeout)
  }, [initialRosterOpen, openRosterContacts])

  useEffect(() => {
    if (connectedDestinations.some((item) => item.value === connectedDestination)) return
    setConnectedDestination(connectedDestinations[0]?.value ?? '')
  }, [connectedDestination, connectedDestinations])

  useEffect(() => {
    if (connectedDestinations.some((item) => item.value === peopleDestination)) return
    setPeopleDestination(connectedDestinations[0]?.value ?? '')
  }, [connectedDestinations, peopleDestination])

  function choosePeopleFilter(filter: ClubPeopleFilter) {
    setPeopleFilter(filter)
    setSelectedPeopleIds([])
    setPeopleMessage('')
  }

  function togglePerson(membershipId: string) {
    setSelectedPeopleIds((current) => current.includes(membershipId) ? current.filter((id) => id !== membershipId) : [...current, membershipId])
  }

  async function updatePeopleAssignments(action: 'add' | 'remove') {
    const [targetType, targetId] = splitClubDestination(peopleDestination)
    const membershipIds = action === 'remove' ? selectedPeopleInDestination : selectedPeopleIds
    if (!membershipIds.length || !targetId) return
    if (action === 'remove' && !window.confirm(`Remove ${membershipIds.length} selected ${membershipIds.length === 1 ? 'person' : 'people'} from this destination?`)) return
    setPeopleWorking(true)
    setPeopleMessage('')
    try {
      const message = action === 'add'
        ? await onAddConnectedPlayers(membershipIds, targetType, targetId)
        : await onRemoveConnectedPlayers(membershipIds, targetType, targetId)
      setSelectedPeopleIds([])
      setPeopleMessage(message)
    } catch (error) {
      setPeopleMessage(error instanceof Error ? error.message : 'Club assignments could not be updated.')
    } finally {
      setPeopleWorking(false)
    }
  }

  function chooseRosterTeam(team: string) {
    setRosterTeam(team)
    setSelectedRosterEmails(getReadyRosterEmails(rosterContacts, team))
    setSelectedConnectedMembershipIds([])
    setMovingPlacement(null)
  }

  function toggleRosterContact(contact: ClubRosterContact) {
    if (contact.connectionStatus === 'ready' && contact.email) {
      setSelectedRosterEmails((current) => current.includes(contact.email) ? current.filter((emailAddress) => emailAddress !== contact.email) : [...current, contact.email])
      return
    }
    if (contact.connectionStatus === 'connected' && contact.matchedMembershipId) {
      setSelectedConnectedMembershipIds((current) => current.includes(contact.matchedMembershipId) ? current.filter((membershipId) => membershipId !== contact.matchedMembershipId) : [...current, contact.matchedMembershipId])
    }
  }

  async function addConnectedPlayers() {
    const separator = connectedDestination.indexOf(':')
    const targetType = connectedDestination.slice(0, separator) as 'group' | 'league' | 'tournament'
    const targetId = connectedDestination.slice(separator + 1)
    if (!selectedConnectedMembershipIds.length || !targetId) return
    setRosterAdding(true)
    setRosterMessage('')
    let addedToNewDestination = false
    try {
      let message = await onAddConnectedPlayers(selectedConnectedMembershipIds, targetType, targetId)
      addedToNewDestination = true
      if (movingPlacement) {
        await onRemoveConnectedPlayers([movingPlacement.membershipId], movingPlacement.source.type, movingPlacement.source.id)
        message = `${movingPlacement.playerName} moved to ${connectedDestinations.find((item) => item.value === connectedDestination)?.label.split(' · ')[0] ?? 'the selected destination'}.`
      }
      const contacts = await onLoadRosterContacts()
      setRosterContacts(contacts)
      setSelectedConnectedMembershipIds([])
      setMovingPlacement(null)
      setRosterMessage(message)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connected players could not be added.'
      setRosterMessage(addedToNewDestination && movingPlacement
        ? `${movingPlacement.playerName} was added to the new destination but still needs to be removed from ${movingPlacement.source.name}. ${errorMessage}`
        : errorMessage)
    } finally {
      setRosterAdding(false)
    }
  }

  async function removeConnectedPlayer(contact: ClubRosterContact, destination: ClubRosterDestination) {
    if (!contact.matchedMembershipId || rosterAdding) return
    if (!window.confirm(`Remove ${contact.fullName} from ${destination.name}?`)) return
    setRosterAdding(true)
    setRosterMessage('')
    try {
      const message = await onRemoveConnectedPlayers([contact.matchedMembershipId], destination.type, destination.id)
      const contacts = await onLoadRosterContacts()
      setRosterContacts(contacts)
      setSelectedConnectedMembershipIds((current) => current.filter((membershipId) => membershipId !== contact.matchedMembershipId))
      if (movingPlacement?.membershipId === contact.matchedMembershipId) setMovingPlacement(null)
      setRosterMessage(message)
    } catch (error) {
      setRosterMessage(error instanceof Error ? error.message : 'The player could not be removed.')
    } finally {
      setRosterAdding(false)
    }
  }

  function beginMove(contact: ClubRosterContact, source: ClubRosterDestination) {
    const sourceValue = `${source.type}:${source.id}`
    const nextDestination = connectedDestinations.find((item) => item.value !== sourceValue)?.value ?? ''
    if (!contact.matchedMembershipId || !nextDestination) return
    setMovingPlacement({ membershipId: contact.matchedMembershipId, playerName: contact.fullName, source })
    setSelectedConnectedMembershipIds([contact.matchedMembershipId])
    setConnectedDestination(nextDestination)
    setRosterMessage(`Choose where ${contact.fullName} should move.`)
  }

  async function updateRosterSharing() {
    if (!activeRosterScope || !visibleRosterContacts.length) return
    const share = activeRosterScope.ownedByYou ? !rosterIsFullyShared : false
    if (!activeRosterScope.ownedByYou && !window.confirm('Remove this shared roster from Club People?')) return
    setRosterSharing(true)
    setRosterMessage('')
    try {
      const message = await onSetRosterSharing(visibleRosterContacts.map((contact) => contact.id), share)
      const contacts = await onLoadRosterContacts()
      setRosterContacts(contacts)
      const nextTeam = contacts.some((contact) => getRosterScopeKey(contact) === rosterTeam)
        ? rosterTeam
        : contacts[0]
          ? getRosterScopeKey(contacts[0])
          : ''
      setRosterTeam(nextTeam)
      setSelectedRosterEmails(getReadyRosterEmails(contacts, nextTeam))
      setSelectedConnectedMembershipIds((current) => current.filter((membershipId) => contacts.some((contact) => contact.matchedMembershipId === membershipId)))
      setRosterMessage(message)
    } catch (error) {
      setRosterMessage(error instanceof Error ? error.message : 'Roster sharing could not be updated.')
    } finally {
      setRosterSharing(false)
    }
  }
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}><p className={styles.eyebrow}>{guidedStepId ? 'Your next connection' : 'Club roster'}</p><h2>{guidedStepId === 'staff' ? 'Who helps run the tennis experience?' : guidedStepId === 'players' ? 'Bring the first player into the club.' : 'Everyone connected to the club.'}</h2><p>{guidedStepId === 'staff' ? 'Choose every role they have. They can be staff and a player at the same time.' : guidedStepId === 'players' ? 'Their setup link is copied after you create it, ready to text or email.' : 'One person can be a player, coach, captain, or coordinator at the same time.'}</p></div>
      {workspace.memberships.length ? <div className={styles.peopleManager}>
        <div className={styles.peopleSearchRow}>
          <label className={styles.field}><span>Find a person</span><input type="search" value={peopleSearch} onChange={(event) => setPeopleSearch(event.target.value)} placeholder="Name, email, phone, or role" /></label>
          <span className={styles.muted}>{visiblePeople.length} shown · Unassigned first</span>
        </div>
        <div className={styles.peopleFilters} role="group" aria-label="Filter Club people">
          {clubPeopleFilters.map((filter) => <button aria-pressed={peopleFilter === filter.id} className={peopleFilter === filter.id ? styles.peopleFilterActive : ''} type="button" key={filter.id} onClick={() => choosePeopleFilter(filter.id)}>{filter.label}<span>{peopleFilterCounts[filter.id]}</span></button>)}
        </div>
        {manager ? <div className={styles.bulkPanel}>
          <div className={styles.row}><strong>{selectedPeopleIds.length ? `${selectedPeopleIds.length} selected` : 'Choose people for a bulk action'}</strong><button className={styles.quietButton} disabled={!visiblePeople.length || peopleWorking} type="button" onClick={() => setSelectedPeopleIds(visiblePeople.map((member) => member.id))}>Select results</button>{selectedPeopleIds.length ? <button className={styles.quietButton} disabled={peopleWorking} type="button" onClick={() => setSelectedPeopleIds([])}>Clear</button> : null}</div>
          {connectedDestinations.length ? <div className={styles.fieldGrid}><label className={styles.field}><span>Destination</span><select value={peopleDestination} onChange={(event) => setPeopleDestination(event.target.value)}>{connectedDestinations.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label><div className={styles.placementActions}><button className={styles.secondary} disabled={!selectedPeopleIds.length || peopleWorking} type="button" onClick={() => void updatePeopleAssignments('add')}>{peopleWorking ? 'Saving...' : 'Add selected'}</button><button className={styles.quietButton} disabled={!selectedPeopleInDestination.length || peopleWorking} type="button" onClick={() => void updatePeopleAssignments('remove')}>{selectedPeopleInDestination.length ? `Remove ${selectedPeopleInDestination.length} selected` : 'Remove from destination'}</button></div></div> : <p className={styles.muted}>Create a team, clinic, player league, or player tournament to start assigning people.</p>}
          {peopleMessage ? <p className={styles.muted} role="status">{peopleMessage}</p> : null}
        </div> : null}
        {visiblePeople.length ? <div className={styles.peopleGrid}>{visiblePeople.map((member) => {
          const assignments = assignmentsByMemberId.get(member.id) ?? []
          return <article className={styles.peopleCard} key={member.id}>{manager ? <input aria-label={`Select ${member.displayName || member.email || 'Club member'}`} type="checkbox" checked={selectedPeopleIds.includes(member.id)} onChange={() => togglePerson(member.id)} /> : null}<div><div className={styles.cardTop}><h3>{member.displayName || member.email || 'Club member'}</h3><span className={styles.pill}>{member.status}</span></div><div className={styles.roleList}>{member.roles.map((role) => <span key={role} className={styles.pill}>{getClubRoleLabel(role)}</span>)}</div>{member.email ? <span className={styles.muted}>{member.email}</span> : null}{assignments.length ? <div className={styles.peopleAssignments}>{assignments.map((assignment) => <span key={`${assignment.type}:${assignment.id}`}>{assignment.name} · {assignment.label}</span>)}</div> : <span className={styles.unassignedLabel}>Needs a destination</span>}</div></article>
        })}</div> : <div className={styles.emptyPeople}><strong>No people match this view.</strong><span>Try another filter or search.</span></div>}
      </div> : null}
      {manager ? (
        <>
          <div className={styles.row}>
            <button className={styles.secondary} disabled={rosterLoading} type="button" onClick={() => rosterOpen ? setRosterOpen(false) : void openRosterContacts()}>{rosterLoading ? 'Opening roster...' : rosterOpen ? 'Close Player Roster' : 'Use Player Roster'}</button>
            <Link className={styles.quietButton} href={rosterUploadHref}>Upload or refresh roster</Link>
          </div>
          {rosterOpen ? (
            <div className={styles.compactForm}>
              <div className={styles.panelHeading}><h2>Choose from Player Roster</h2><p>TIQ checks the roster against connected members and live invitations. Only new, email-ready people are selected.</p></div>
              {rosterScopes.length > 1 ? <label className={styles.field}><span>Team</span><select value={rosterTeam} onChange={(event) => chooseRosterTeam(event.target.value)}>{rosterScopes.map((contact) => <option key={getRosterScopeKey(contact)} value={getRosterScopeKey(contact)}>{getRosterScopeOptionLabel(contact)}</option>)}</select></label> : null}
              {rosterScopes.length === 1 ? <p className={styles.muted}>{getRosterScopeOptionLabel(rosterScopes[0])}</p> : null}
              {activeRosterScope ? <div className={styles.row}><p className={styles.muted}>{rosterSharingLabel}</p><button className={styles.quietButton} disabled={rosterSharing} type="button" onClick={() => void updateRosterSharing()}>{rosterSharing ? 'Updating...' : activeRosterScope.ownedByYou ? rosterIsFullyShared ? 'Stop sharing' : 'Share with club' : 'Remove from club'}</button></div> : null}
              {visibleRosterContacts.length ? <div className={styles.roleList}><span className={styles.pill}>{readyRosterCount} ready</span><span className={styles.pill}>{connectedRosterCount} connected</span><span className={styles.pill}>{pendingRosterCount} pending</span><span className={styles.pill}>{emailNeededRosterCount} need email</span></div> : null}
              {rosterMessage ? <p className={styles.muted}>{rosterMessage}</p> : null}
              {visibleRosterContacts.length ? <>
                <div className={styles.groupRoster}>{visibleRosterContacts.map((contact) => {
                  const selectable = !movingPlacement
                    ? contact.connectionStatus === 'ready' || (contact.connectionStatus === 'connected' && Boolean(contact.matchedMembershipId))
                    : contact.matchedMembershipId === movingPlacement.membershipId
                  const checked = contact.connectionStatus === 'ready' ? selectedRosterEmails.includes(contact.email) : selectedConnectedMembershipIds.includes(contact.matchedMembershipId)
                  return <div className={styles.memberRow} key={contact.id}><input aria-label={`Select ${contact.fullName}`} type="checkbox" disabled={!selectable} checked={selectable && checked} onChange={() => toggleRosterContact(contact)} /><span><strong>{contact.fullName}</strong><small>{getClubRosterConnectionLabel(contact.connectionStatus)}{contact.connectionStatus === 'connected' ? ' · Select to add directly' : ''}{contact.email ? ` · ${contact.email}` : ''}{contact.phone ? ` · ${contact.phone}` : ''}</small>{contact.connectedDestinations.length ? <span className={styles.destinationList}>{contact.connectedDestinations.map((item) => {
                    const hasMoveDestination = connectedDestinations.some((destination) => destination.value !== `${item.type}:${item.id}`)
                    return <span className={styles.destinationChip} key={`${item.type}:${item.id}`}><span>Already in {item.name} · {item.label}</span>{hasMoveDestination ? <button disabled={rosterAdding} type="button" onClick={() => beginMove(contact, item)}>Move</button> : null}<button disabled={rosterAdding} type="button" onClick={() => void removeConnectedPlayer(contact, item)}>Remove</button></span>
                  })}</span> : null}</span></div>
                })}</div>
                {connectedDestinations.length ? <div className={styles.fieldGrid}><label className={styles.field}><span>{movingPlacement ? `Move ${movingPlacement.playerName} to` : 'Add connected players to'}</span><select value={connectedDestination} onChange={(event) => setConnectedDestination(event.target.value)}>{connectedDestinations.filter((item) => !movingPlacement || item.value !== `${movingPlacement.source.type}:${movingPlacement.source.id}`).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><small>{movingPlacement ? `Moves from ${movingPlacement.source.name}.` : 'No invitation is sent.'}</small></label><div className={styles.placementActions}><button className={styles.secondary} disabled={!selectedConnectedMembershipIds.length || rosterAdding} type="button" onClick={() => void addConnectedPlayers()}>{rosterAdding ? 'Saving...' : movingPlacement ? 'Move player' : selectedConnectedMembershipIds.length ? `Add ${selectedConnectedMembershipIds.length} connected` : 'Select connected players'}</button>{movingPlacement ? <button className={styles.quietButton} disabled={rosterAdding} type="button" onClick={() => { setMovingPlacement(null); setSelectedConnectedMembershipIds([]); setRosterMessage('') }}>Cancel move</button> : null}</div></div> : connectedRosterCount ? <p className={styles.muted}>Create a team, clinic, player league, or player tournament before placing connected players.</p> : null}
                <div className={styles.row}><button className={styles.primary} disabled={!selectedRosterEmails.length} type="button" onClick={() => { setEmail(selectedRosterEmails.join('\n')); setRosterMessage(`${selectedRosterEmails.length} new ${selectedRosterEmails.length === 1 ? 'person is' : 'people are'} ready below. Choose roles and where they should open.`); setRosterOpen(false) }}>{selectedRosterEmails.length ? `Use ${selectedRosterEmails.length} new` : 'No new emails to invite'}</button><Link className={styles.quietButton} href={rosterUploadHref}>Refresh Player Roster</Link></div>
              </> : null}
            </div>
          ) : null}
          {rosterMessage && !rosterOpen ? <div className={styles.notice} role="status">{rosterMessage}</div> : null}
          <details className={styles.inviteDetails} open={inviteOpen} onToggle={(event) => setInviteOpen(event.currentTarget.open)}>
            <summary><span>Invite by email</span><small>Add one person or prepare several invitation links.</small></summary>
            <form className={styles.compactForm} onSubmit={(event) => { event.preventDefault(); void onInvite(email, roles, targetType, targetId).then((created) => { if (created) setEmail('') }) }}>
            <div className={styles.fieldGrid}>
              <label className={styles.field}><span>Email addresses</span><textarea required value={email} onChange={(event) => setEmail(event.target.value)} placeholder={'player@club.com\npartner@club.com'} /><small>One email or up to 50, separated by commas or new lines.</small></label>
              <label className={styles.field}><span>Invite into</span><select value={destination} onChange={(event) => setDestination(event.target.value)}><option value="club:">Club — general access</option>{activeGroups.length ? <optgroup label="Programs and teams">{activeGroups.map((group) => <option key={group.id} value={`group:${group.id}`}>{group.name} — {getClubGroupTypeLabel(group.groupType)}</option>)}</optgroup> : null}{workspace.competitions.length ? <optgroup label="Leagues and tournaments">{workspace.competitions.map((competition) => <option key={`${competition.type}-${competition.id}`} value={`${competition.type}:${competition.id}`}>{competition.name} — {competition.type}</option>)}</optgroup> : null}</select><small>They will open here after joining.</small></label>
              <div className={styles.field}><span>Club roles</span><RoleChecks value={roles} onChange={setRoles} /></div>
            </div>
            <button className={styles.primary} disabled={working} type="submit">{working ? 'Preparing...' : inviteLabel}</button>
            </form>
          </details>
        </>
      ) : null}
      {manager && workspace.invites.length ? <><hr className={styles.sectionDivider} /><div className={styles.panelHeading}><h2>Pending invitations</h2><p>Share a link again or revoke one that should no longer be used.</p></div><div className={styles.cardGrid}>{workspace.invites.map((invite) => <article className={styles.card} key={invite.id}><h3>{invite.email}</h3>{invite.target.type !== 'club' ? <span className={styles.muted}>Opens {invite.target.name}</span> : <span className={styles.muted}>Club-wide access</span>}<div className={styles.roleList}>{invite.roles.map((role) => <span className={styles.pill} key={role}>{getClubRoleLabel(role)}</span>)}</div><div className={styles.row}><button className={styles.quietButton} disabled={working} type="button" onClick={() => void onShare(invite)}>Share invite</button><button className={styles.dangerButton} disabled={working} type="button" onClick={() => { if (window.confirm('Revoke this invitation? Its current link will stop working.')) void onRevoke(invite.id) }}>Revoke</button></div></article>)}</div></> : null}
    </section>
  )
}

function GroupsPanel({ workspace, requestedGroupId, staff, manager, coachSync, working, onCreate, onRollover, onSeasonAction, onPrepareRenewals, onFinalizeRenewals, onFillOpenSpots, onSaveRoster, onCoachSync, onLinkCompetition, onSyncCompetitionRoster, onSyncCompetitionTeams, onInvite }: { workspace: ClubWorkspaceData; requestedGroupId: string; staff: boolean; manager: boolean; coachSync: boolean; working: boolean; onCreate: (payload: { name: string; groupType: ClubGroupType; description: string; seasonLabel: string; leadUserId: string; capacity: number; locationLabel: string; registrationUrl: string; defaultDurationMinutes: number }) => Promise<void>; onRollover: (sourceGroupIds: string[], seasonLabel: string, copyMembers: boolean, copyCompetitionSetup: boolean) => Promise<string>; onSeasonAction: (action: 'close-season' | 'reopen-season', seasonLabel: string) => Promise<string>; onPrepareRenewals: (groupId: string) => Promise<ClubGroupRenewal[]>; onFinalizeRenewals: (groupId: string) => Promise<void>; onFillOpenSpots: (groupId: string) => void; onSaveRoster: (groupId: string, membershipIds: string[]) => Promise<void>; onCoachSync: (groupId: string) => Promise<void>; onLinkCompetition: (groupId: string, competitionId: string) => Promise<void>; onSyncCompetitionRoster: (competition: ClubLinkedCompetition, membershipIds: string[]) => Promise<void>; onSyncCompetitionTeams: (groupId: string, teamGroupIds: string[]) => Promise<void>; onInvite: (groupId: string) => void }) {
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
  const [renewalGroup, setRenewalGroup] = useState<ClubGroup | null>(null)
  const [renewals, setRenewals] = useState<ClubGroupRenewal[]>([])
  const [renewalMessage, setRenewalMessage] = useState('')
  const [linkingGroupId, setLinkingGroupId] = useState('')
  const [linkingCompetitionId, setLinkingCompetitionId] = useState('')
  const [teamPickerGroupId, setTeamPickerGroupId] = useState('')
  const [selectedTeamGroupIds, setSelectedTeamGroupIds] = useState<string[]>([])
  const activeGroups = useMemo(() => workspace.groups.filter((group) => group.isActive), [workspace.groups])
  const archivedGroups = useMemo(() => workspace.groups.filter((group) => !group.isActive), [workspace.groups])
  const activeSeasonLabels = Array.from(new Set(activeGroups.map((group) => group.seasonLabel).filter(Boolean)))
  const archivedSeasonLabels = Array.from(new Set(archivedGroups.map((group) => group.seasonLabel).filter(Boolean)))
  const initialSourceSeason = activeSeasonLabels[0] ?? '__none__'
  const requestedArchived = Boolean(requestedGroupId && archivedGroups.some((group) => group.id === requestedGroupId))
  const [statusView, setStatusView] = useState<'active' | 'archive' | 'all'>(requestedArchived ? 'archive' : 'active')
  const [seasonView, setSeasonView] = useState('all')
  const [rolloverOpen, setRolloverOpen] = useState(false)
  const [rolloverSourceSeason, setRolloverSourceSeason] = useState(initialSourceSeason)
  const [nextSeasonLabel, setNextSeasonLabel] = useState('')
  const [copyReturningMembers, setCopyReturningMembers] = useState(true)
  const [copyCompetitionSetup, setCopyCompetitionSetup] = useState(true)
  const [closeSeasonLabel, setCloseSeasonLabel] = useState(activeSeasonLabels[0] ?? '')
  const [reopenSeasonLabel, setReopenSeasonLabel] = useState(archivedSeasonLabels[0] ?? '')
  const rolloverSourceGroups = useMemo(() => activeGroups.filter((group) => rolloverSourceSeason === '__none__' ? !group.seasonLabel : group.seasonLabel === rolloverSourceSeason), [activeGroups, rolloverSourceSeason])
  const [rolloverGroupIds, setRolloverGroupIds] = useState(() => rolloverSourceGroups.map((group) => group.id))
  const rolloverCompetitionCount = rolloverSourceGroups.filter((group) => rolloverGroupIds.includes(group.id) && group.linkedCompetitionId).length
  const statusGroups = statusView === 'active' ? activeGroups : statusView === 'archive' ? archivedGroups : workspace.groups
  const visibleGroups = seasonView === 'all' ? statusGroups : statusGroups.filter((group) => group.seasonLabel === seasonView)
  const visibleSeasonLabels = Array.from(new Set(statusGroups.map((group) => group.seasonLabel).filter(Boolean)))
  const repeatsSourceSeason = rolloverSourceSeason !== '__none__' && nextSeasonLabel.trim().toLowerCase() === rolloverSourceSeason.toLowerCase()
  useEffect(() => {
    if (!requestedGroupId) return
    const frame = window.requestAnimationFrame(() => document.getElementById(`club-group-${requestedGroupId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    return () => window.cancelAnimationFrame(frame)
  }, [requestedGroupId])

  async function openRenewals(group: ClubGroup) {
    setRenewalGroup(group)
    setRenewalMessage('')
    try {
      setRenewals(await onPrepareRenewals(group.id))
    } catch {
      setRenewalGroup(null)
    }
  }

  async function shareRenewal(renewal: ClubGroupRenewal) {
    if (!renewalGroup) return
    const url = `${window.location.origin}/clubs/renew/${renewal.responseToken}`
    const text = `${renewal.playerName}, are you returning for ${renewalGroup.name}${renewalGroup.seasonLabel ? ` · ${renewalGroup.seasonLabel}` : ''}? Confirm here: ${url}`
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: `${renewalGroup.name} season confirmation`, text })
        setRenewalMessage(`Shared with ${renewal.playerName}.`)
      } else {
        await navigator.clipboard.writeText(text)
        setRenewalMessage(`${renewal.playerName}'s message is copied.`)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setRenewalMessage('That message could not be shared. Try copying all messages.')
    }
  }

  async function copyAllRenewals() {
    if (!renewalGroup) return
    const pendingRenewals = renewals.filter((renewal) => renewal.status === 'pending')
    const messages = pendingRenewals.map((renewal) => `${renewal.playerName}, are you returning for ${renewalGroup.name}${renewalGroup.seasonLabel ? ` · ${renewalGroup.seasonLabel}` : ''}? Confirm here: ${window.location.origin}/clubs/renew/${renewal.responseToken}`).join('\n\n')
    try {
      await navigator.clipboard.writeText(messages)
      setRenewalMessage(`${pendingRenewals.length} personalized ${pendingRenewals.length === 1 ? 'reminder is' : 'reminders are'} copied.`)
    } catch {
      setRenewalMessage('The links could not be copied. Share them one at a time below.')
    }
  }
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}><p className={styles.eyebrow}>Programs + teams</p><h2>Put the right people together.</h2><p>Create clinics, teams, camps, or development groups from the same club roster.</p></div>
      {manager && activeGroups.length ? <details className={styles.rolloverDetails} open={rolloverOpen} onToggle={(event) => setRolloverOpen(event.currentTarget.open)}>
        <summary><span>Start next season</span><small>Copy the setup. Review returning players before they become active.</small></summary>
        <form className={styles.compactForm} onSubmit={(event) => { event.preventDefault(); void onRollover(rolloverGroupIds, nextSeasonLabel, copyReturningMembers, copyCompetitionSetup).then(() => { setSeasonView(nextSeasonLabel.trim()); setNextSeasonLabel(''); setRolloverOpen(false) }).catch(() => undefined) }}>
          <div className={styles.fieldGrid}>
            <label className={styles.field}><span>Copy from</span><select value={rolloverSourceSeason} onChange={(event) => { const sourceSeason = event.target.value; setRolloverSourceSeason(sourceSeason); setRolloverGroupIds(activeGroups.filter((group) => sourceSeason === '__none__' ? !group.seasonLabel : group.seasonLabel === sourceSeason).map((group) => group.id)) }}>{activeSeasonLabels.map((season) => <option value={season} key={season}>{season}</option>)}{activeGroups.some((group) => !group.seasonLabel) ? <option value="__none__">No season set</option> : null}</select></label>
            <label className={styles.field}><span>New season</span><input required maxLength={80} value={nextSeasonLabel} onChange={(event) => setNextSeasonLabel(event.target.value)} placeholder="Winter 2027" />{repeatsSourceSeason ? <small>Use a different season name.</small> : null}</label>
          </div>
          <fieldset className={styles.rolloverChoices}><legend>Programs to carry forward</legend>{rolloverSourceGroups.map((group) => <label className={styles.memberRow} key={group.id}><input type="checkbox" checked={rolloverGroupIds.includes(group.id)} onChange={() => setRolloverGroupIds((current) => current.includes(group.id) ? current.filter((id) => id !== group.id) : [...current, group.id])} /><span><strong>{group.name}</strong><small>{getClubGroupTypeLabel(group.groupType)} · {group.memberIds.length} current</small></span></label>)}</fieldset>
          <label className={styles.check}><input type="checkbox" checked={copyReturningMembers} onChange={(event) => setCopyReturningMembers(event.target.checked)} />Bring current players over for review</label>
          {rolloverCompetitionCount ? <label className={styles.check}><input type="checkbox" checked={copyCompetitionSetup} onChange={(event) => setCopyCompetitionSetup(event.target.checked)} />Prepare {rolloverCompetitionCount === 1 ? 'a fresh competition draft' : `${rolloverCompetitionCount} fresh competition drafts`}</label> : null}
          <p className={styles.muted}>The current season stays intact. New rosters remain in review.{rolloverCompetitionCount && copyCompetitionSetup ? ' Competition formats and rules carry forward; entries, dates, schedules, and results start fresh.' : ''}</p>
          <button className={styles.primary} disabled={working || !rolloverGroupIds.length || nextSeasonLabel.trim().length < 2 || repeatsSourceSeason} type="submit">{working ? 'Creating season...' : rolloverGroupIds.length ? `Create ${rolloverGroupIds.length} for new season` : 'Choose programs'}</button>
        </form>
      </details> : null}
      {manager && (activeSeasonLabels.length || archivedSeasonLabels.length) ? <details className={styles.rolloverDetails}>
        <summary><span>Manage seasons</span><small>Close finished seasons without deleting their programs or rosters.</small></summary>
        <div className={styles.compactForm}>
          {activeSeasonLabels.length ? <div className={styles.seasonAction}>
            <label className={styles.field}><span>Close season</span><select value={activeSeasonLabels.includes(closeSeasonLabel) ? closeSeasonLabel : activeSeasonLabels[0]} onChange={(event) => setCloseSeasonLabel(event.target.value)}>{activeSeasonLabels.map((season) => <option value={season} key={season}>{season}</option>)}</select><small>Programs become read-only and leave public pages, invitations, and everyday work.</small></label>
            <button className={styles.dangerButton} disabled={working} type="button" onClick={() => { const selected = activeSeasonLabels.includes(closeSeasonLabel) ? closeSeasonLabel : activeSeasonLabels[0]; void onSeasonAction('close-season', selected).then(() => { setStatusView('active'); setSeasonView('all') }).catch(() => undefined) }}>{working ? 'Closing...' : 'Close season'}</button>
          </div> : null}
          {archivedSeasonLabels.length ? <div className={styles.seasonAction}>
            <label className={styles.field}><span>Reopen season</span><select value={archivedSeasonLabels.includes(reopenSeasonLabel) ? reopenSeasonLabel : archivedSeasonLabels[0]} onChange={(event) => setReopenSeasonLabel(event.target.value)}>{archivedSeasonLabels.map((season) => <option value={season} key={season}>{season}</option>)}</select><small>Restore its programs if the season was closed by mistake.</small></label>
            <button className={styles.quietButton} disabled={working} type="button" onClick={() => { const selected = archivedSeasonLabels.includes(reopenSeasonLabel) ? reopenSeasonLabel : archivedSeasonLabels[0]; void onSeasonAction('reopen-season', selected).then(() => { setStatusView('active'); setSeasonView(selected) }).catch(() => undefined) }}>{working ? 'Reopening...' : 'Reopen season'}</button>
          </div> : null}
        </div>
      </details> : null}
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
      <div className={styles.programFilters}>
        <label className={styles.seasonView}><span>Showing</span><select value={statusView} onChange={(event) => { setStatusView(event.target.value as 'active' | 'archive' | 'all'); setSeasonView('all') }}><option value="active">Active programs</option><option value="archive">Season history{archivedGroups.length ? ` (${archivedGroups.length})` : ''}</option><option value="all">Everything</option></select></label>
        {visibleSeasonLabels.length ? <label className={styles.seasonView}><span>Season</span><select value={visibleSeasonLabels.includes(seasonView) ? seasonView : 'all'} onChange={(event) => setSeasonView(event.target.value)}><option value="all">All seasons</option>{visibleSeasonLabels.map((season) => <option value={season} key={season}>{season}</option>)}</select></label> : null}
      </div>
      <div className={styles.cardGrid}>
        {visibleGroups.map((group) => {
          const renewalCount = group.renewalPendingCount + group.renewalConfirmedCount + group.renewalDeclinedCount
          const groupOpenSpotCount = group.renewalFillCompletedAt ? 0 : Math.max(0, group.renewalTargetRosterSize - group.memberIds.length)
          const teamHubHref = buildClubToolHref('/captain', workspace.club, { source: 'club-program-card', groupId: group.id, program: group.name, team: group.name })
          const coachProgram = group.groupType === 'camp' || group.groupType === 'development_group'
          const competitionProgram = group.groupType === 'league_division' || group.groupType === 'tournament_field'
          const competitionAction = competitionProgram ? getClubProgramReadinessAction(group, workspace.club) : null
          const linkableCompetitions = competitionProgram ? getLinkableClubCompetitions(group, workspace.competitions) : []
          const competitionRosterHandoff = competitionProgram ? getClubCompetitionRosterHandoff(group, workspace.competitions, workspace.memberships) : null
          const competitionTeamHandoff = competitionProgram ? getClubCompetitionTeamHandoff(group, workspace.competitions, workspace.groups) : null
          const competitionReady = Boolean(group.linkedCompetitionId && group.competitionEntryCount >= 2 && group.competitionScheduleCount > 0)
          const missingCoachLinks = Math.max(0, group.coachExpectedPlayerCount - group.coachLinkedPlayerCount)
          const missingCoachPlans = Math.max(0, group.coachExpectedPlayerCount - group.coachPlannedPlayerCount)
          return <article id={`club-group-${group.id}`} className={`${styles.card} ${!group.isActive ? styles.archivedCard : ''} ${requestedGroupId === group.id ? styles.cardTargeted : ''}`} key={group.id}>
            <div className={styles.cardTop}><h3>{group.name}</h3><span className={group.isActive ? styles.pill : styles.archivePill}>{group.isActive ? getClubGroupTypeLabel(group.groupType) : 'Archived'}</span></div>
            {group.seasonLabel ? <span className={styles.muted}>{group.seasonLabel} · {getClubGroupTypeLabel(group.groupType)}</span> : null}
            <p>{group.description || (group.isActive ? 'Ready for players.' : 'Saved season history.')}</p>
            <span className={styles.muted}>{group.memberIds.length} connected{group.capacity ? ` · ${group.capacity} spots` : ''}</span>
            {group.isActive && group.reviewMemberIds.length ? <span className={styles.reviewLabel}>{group.reviewMemberIds.length} returning {group.reviewMemberIds.length === 1 ? 'player' : 'players'} to review</span> : null}
            {group.isActive && renewalCount ? <div className={styles.renewalSummary} aria-label="Season renewal responses"><span>{group.renewalConfirmedCount} yes</span><span>{group.renewalPendingCount} waiting</span><span>{group.renewalDeclinedCount} no</span></div> : null}
            {group.isActive && group.renewalsFinalizedAt ? <span className={styles.pill}>Roster finalized</span> : null}
            {group.isActive && group.groupType === 'clinic' && group.clinicSessionCount ? <span className={styles.pill}>Schedule ready</span> : null}
            {group.isActive && group.groupType === 'clinic' && group.nextClinicSessionAt ? <span className={styles.muted}>Next session {formatClubProgramDate(group.nextClinicSessionAt, workspace.club.timeZone)}</span> : null}
            {group.isActive && staff && group.groupType === 'clinic' && group.launchHandoffCompletedAt && !group.clinicSessionCount ? <span className={styles.reviewLabel}>Schedule not added</span> : null}
            {group.isActive && group.groupType === 'team' && group.teamRosterCount > 0 ? <span className={styles.muted}>Player Roster · {group.teamRosterCount} players</span> : null}
            {group.isActive && group.groupType === 'team' && group.teamRosterCount > 0 && group.teamMatchCount > 0 ? <span className={styles.pill}>Team ready</span> : null}
            {group.isActive && group.groupType === 'team' && group.nextTeamMatchAt ? <span className={styles.muted}>Next match {formatClubProgramDate(group.nextTeamMatchAt, workspace.club.timeZone)}</span> : null}
            {group.isActive && staff && group.groupType === 'team' && !group.teamRosterCount ? <span className={styles.reviewLabel}>Player Roster not connected</span> : null}
            {group.isActive && staff && group.groupType === 'team' && group.teamRosterCount > 0 && !group.teamMatchCount ? <span className={styles.reviewLabel}>Schedule not added</span> : null}
            {group.isActive && coachProgram && group.coachExpectedPlayerCount > 0 ? <span className={styles.muted}>Coach Hub · {group.coachLinkedPlayerCount} of {group.coachExpectedPlayerCount} players</span> : null}
            {group.isActive && coachProgram && group.coachExpectedPlayerCount > 0 && !missingCoachLinks && !missingCoachPlans && group.nextCoachSessionAt ? <span className={styles.pill}>Coach plan ready</span> : null}
            {group.isActive && coachProgram && group.nextCoachSessionAt ? <span className={styles.muted}>Next session {formatClubProgramDate(group.nextCoachSessionAt, workspace.club.timeZone)}</span> : null}
            {group.isActive && staff && coachProgram && missingCoachLinks > 0 ? <span className={styles.reviewLabel}>{missingCoachLinks} {missingCoachLinks === 1 ? 'player is' : 'players are'} not connected</span> : null}
            {group.isActive && staff && coachProgram && !missingCoachLinks && missingCoachPlans > 0 ? <span className={styles.reviewLabel}>{missingCoachPlans} {missingCoachPlans === 1 ? 'player needs' : 'players need'} a plan</span> : null}
            {group.isActive && staff && coachProgram && group.coachExpectedPlayerCount > 0 && !missingCoachLinks && !missingCoachPlans && !group.nextCoachSessionAt ? <span className={styles.reviewLabel}>Next session not added</span> : null}
            {group.isActive && competitionProgram && group.linkedCompetitionId ? <span className={styles.muted}>{group.competitionEntryCount} entries · {group.competitionScheduleCount} scheduled {group.competitionScheduleCount === 1 ? 'match' : 'matches'}</span> : null}
            {group.isActive && competitionProgram && competitionReady ? <span className={styles.pill}>Competition ready</span> : null}
            {group.isActive && staff && competitionProgram && !competitionReady ? <span className={styles.reviewLabel}>{group.linkedCompetitionId ? competitionAction?.label : 'Competition not connected'}</span> : null}
            {group.isActive && groupOpenSpotCount ? <span className={styles.reviewLabel}>{groupOpenSpotCount} open {groupOpenSpotCount === 1 ? 'spot' : 'spots'}</span> : null}
            {group.isActive && manager && (group.reviewMemberIds.length || renewalCount) ? <button type="button" disabled={working} className={styles.primary} onClick={() => void openRenewals(group)}>{group.renewalsFinalizedAt ? 'View renewal results' : renewalCount ? group.renewalPendingCount ? 'Open renewal messages' : 'Review and finalize' : 'Request player decisions'}</button> : null}
            {group.isActive && manager && groupOpenSpotCount ? <button type="button" className={styles.quietButton} onClick={() => onFillOpenSpots(group.id)}>Fill open spots</button> : null}
            {group.isActive && group.groupType === 'clinic' ? <Link className={styles.primary} href={`/clubs/clinics/${group.id}?clubId=${encodeURIComponent(workspace.club.id)}`}>Open Clinic Hub</Link> : null}
            {group.isActive && group.groupType === 'team' ? <Link className={styles.primary} href={teamHubHref}>Open Team Hub</Link> : null}
            {group.isActive && manager && competitionRosterHandoff?.missingMemberIds.length ? <button className={styles.primary} disabled={working} type="button" onClick={() => void onSyncCompetitionRoster(competitionRosterHandoff.competition, competitionRosterHandoff.missingMemberIds)}>{working ? 'Adding players...' : `Add ${competitionRosterHandoff.missingMemberIds.length} Club ${competitionRosterHandoff.missingMemberIds.length === 1 ? 'player' : 'players'}`}</button> : null}
            {group.isActive && Boolean(competitionRosterHandoff?.eligibleMemberIds.length) && !competitionRosterHandoff?.missingMemberIds.length ? <span className={styles.pill}>Club roster connected</span> : null}
            {group.isActive && manager && competitionTeamHandoff?.missingTeams.length ? <button className={styles.primary} disabled={working} type="button" onClick={() => { const opening = teamPickerGroupId !== group.id; setTeamPickerGroupId(opening ? group.id : ''); setSelectedTeamGroupIds(opening ? competitionTeamHandoff.missingTeams.map((team) => team.id) : []) }}>{teamPickerGroupId === group.id ? 'Cancel team selection' : 'Choose Club teams'}</button> : null}
            {group.isActive && Boolean(competitionTeamHandoff?.eligibleTeams.length) && !competitionTeamHandoff?.missingTeams.length ? <span className={styles.pill}>Club teams connected</span> : null}
            {teamPickerGroupId === group.id && competitionTeamHandoff ? <form className={styles.competitionLinkForm} onSubmit={(event) => { event.preventDefault(); void onSyncCompetitionTeams(group.id, selectedTeamGroupIds).then(() => { setTeamPickerGroupId(''); setSelectedTeamGroupIds([]) }).catch(() => undefined) }}><fieldset className={styles.rolloverChoices}><legend>Teams entering {competitionTeamHandoff.competition.name}</legend>{competitionTeamHandoff.missingTeams.map((team) => <label className={styles.memberRow} key={team.id}><input type="checkbox" checked={selectedTeamGroupIds.includes(team.id)} onChange={() => setSelectedTeamGroupIds((current) => current.includes(team.id) ? current.filter((id) => id !== team.id) : [...current, team.id])} /><span><strong>{team.name}</strong><small>{team.memberIds.length} connected players</small></span></label>)}</fieldset><button className={styles.primary} disabled={working || !selectedTeamGroupIds.length} type="submit">{working ? 'Adding teams...' : selectedTeamGroupIds.length ? `Add ${selectedTeamGroupIds.length} ${selectedTeamGroupIds.length === 1 ? 'team' : 'teams'}` : 'Choose teams'}</button></form> : null}
            {group.isActive && competitionProgram && competitionAction ? <Link className={competitionRosterHandoff?.missingMemberIds.length || competitionTeamHandoff?.missingTeams.length ? styles.quietButton : styles.primary} href={competitionAction.href}>{competitionRosterHandoff?.missingMemberIds.length || competitionTeamHandoff?.missingTeams.length ? `Open ${competitionRosterHandoff?.competition.type ?? competitionTeamHandoff?.competition.type}` : competitionAction.label}</Link> : null}
            {group.isActive && staff && competitionProgram && !group.linkedCompetitionId && linkableCompetitions.length ? <button className={styles.quietButton} disabled={working} type="button" onClick={() => { setLinkingGroupId((current) => current === group.id ? '' : group.id); setLinkingCompetitionId(linkableCompetitions[0]?.id ?? '') }}>{linkingGroupId === group.id ? 'Cancel connection' : 'Connect existing'}</button> : null}
            {linkingGroupId === group.id ? <form className={styles.competitionLinkForm} onSubmit={(event) => { event.preventDefault(); void onLinkCompetition(group.id, linkingCompetitionId).then(() => { setLinkingGroupId(''); setLinkingCompetitionId('') }).catch(() => undefined) }}><label className={styles.field}><span>{group.groupType === 'league_division' ? 'Club league' : 'Club tournament'}</span><select required value={linkingCompetitionId} onChange={(event) => setLinkingCompetitionId(event.target.value)}>{linkableCompetitions.map((competition) => <option value={competition.id} key={competition.id}>{competition.name} · {competition.entryCount} {competition.entryCount === 1 ? 'entry' : 'entries'}</option>)}</select><small>Keeps this program and its competition progress together.</small></label><button className={styles.primary} disabled={working || !linkingCompetitionId} type="submit">{working ? 'Connecting...' : 'Connect competition'}</button></form> : null}
            {group.isActive && manager ? <button type="button" className={styles.quietButton} onClick={() => onInvite(group.id)}>Invite people</button> : null}
            {staff ? <button type="button" className={styles.quietButton} onClick={() => { setEditingGroup(group); setMemberIds(Array.from(new Set([...group.memberIds, ...group.reviewMemberIds]))) }}>{group.isActive ? renewalCount ? 'Adjust roster manually' : group.reviewMemberIds.length ? 'Review returning players' : 'Manage roster' : 'View archived roster'}</button> : null}
            {group.isActive && coachSync && coachProgram ? <button type="button" disabled={working} className={styles.quietButton} onClick={() => void onCoachSync(group.id)}>Open Coach Hub</button> : null}
          </article>
        })}
      </div>
      {!visibleGroups.length ? <div className={styles.emptyState}><strong>{statusView === 'archive' ? 'No season history yet.' : 'No programs in this view.'}</strong><span>{statusView === 'archive' ? 'Closed seasons will stay here with their rosters intact.' : 'Change the filters or add the first program.'}</span></div> : null}
      {editingGroup ? (
        <div className={styles.compactForm}>
          <div className={styles.panelHeading}><h2>{editingGroup.name}</h2><p>{!editingGroup.isActive ? 'Read-only roster from this closed season.' : editingGroup.reviewMemberIds.length ? 'Confirm returning players. Uncheck anyone not continuing, then save.' : 'Choose who belongs in this program.'}</p></div>
          <div className={styles.groupRoster}>{workspace.memberships.map((member) => <label className={styles.memberRow} key={member.id}><input disabled={!editingGroup.isActive} type="checkbox" checked={memberIds.includes(member.id)} onChange={() => setMemberIds((current) => current.includes(member.id) ? current.filter((id) => id !== member.id) : [...current, member.id])} /><span>{member.displayName || member.email || 'Club member'}</span></label>)}</div>
          <div className={styles.row}>{editingGroup.isActive ? <button className={styles.primary} disabled={working} type="button" onClick={() => void onSaveRoster(editingGroup.id, memberIds).then(() => setEditingGroup(null))}>Save roster</button> : null}<button className={styles.secondary} type="button" onClick={() => setEditingGroup(null)}>{editingGroup.isActive ? 'Cancel' : 'Close'}</button></div>
        </div>
      ) : null}
      {renewalGroup ? <div className={styles.renewalBackdrop} role="presentation">
        <section className={styles.renewalSheet} role="dialog" aria-modal="true" aria-labelledby="club-renewal-title">
          <div className={styles.headingRow}><div className={styles.panelHeading}><p className={styles.eyebrow}>Returning players</p><h2 id="club-renewal-title">{renewalGroup.name}</h2><p>{renewalGroup.renewalsFinalizedAt ? 'Renewal decisions are closed. These results stay with the program.' : 'Share each private link. Yes adds the player; no removes them from this season.'}</p></div><button className={styles.quietButton} type="button" onClick={() => setRenewalGroup(null)}>Close</button></div>
          <div className={styles.renewalActions}>{!renewalGroup.renewalsFinalizedAt ? <button className={styles.secondary} disabled={!renewals.some((renewal) => renewal.status === 'pending')} type="button" onClick={() => void copyAllRenewals()}>Copy waiting reminders</button> : null}<button className={styles.quietButton} disabled={working} type="button" onClick={() => void openRenewals(renewalGroup)}>Refresh responses</button>{!renewalGroup.renewalsFinalizedAt && renewals.length && !renewals.some((renewal) => renewal.status === 'pending') ? <button className={styles.primary} disabled={working} type="button" onClick={() => void onFinalizeRenewals(renewalGroup.id).then(() => setRenewalGroup(null)).catch(() => undefined)}>{working ? 'Finalizing...' : 'Finalize roster'}</button> : null}</div>
          {renewalMessage ? <div className={`${styles.notice} ${styles.success}`} role="status">{renewalMessage}</div> : null}
          <div className={styles.renewalList}>{renewals.map((renewal) => <article className={styles.renewalRow} key={renewal.membershipId}><div><strong>{renewal.playerName}</strong><span>{renewal.phone || renewal.email || 'Club player'}</span></div><span className={`${styles.renewalStatus} ${renewal.status === 'confirmed' ? styles.renewalYes : renewal.status === 'declined' ? styles.renewalNo : ''}`}>{renewal.status === 'confirmed' ? 'Yes' : renewal.status === 'declined' ? 'No' : 'Waiting'}</span>{!renewalGroup.renewalsFinalizedAt ? <button className={styles.quietButton} type="button" onClick={() => void shareRenewal(renewal)}>{renewal.status === 'pending' ? 'Share' : 'Share again'}</button> : null}</article>)}</div>
        </section>
      </div> : null}
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
      {workspace.competitions.length ? <><hr className={styles.sectionDivider} /><div className={styles.panelHeading}><h2>Club competitions</h2><p>See what is ready and finish the one missing step.</p></div><div className={styles.cardGrid}>{workspace.competitions.map((competition) => {
        const readiness = getClubCompetitionReadiness(competition)
        return <article className={styles.card} key={`${competition.type}-${competition.id}`}><div className={styles.cardTop}><h3>{competition.name}</h3><span className={styles.pill}>{readiness.label}</span></div><p>{readiness.detail}</p><span className={styles.muted}>{competition.entryCount} {competition.entryCount === 1 ? 'entry' : 'entries'} · {competition.scheduleCount} scheduled {competition.scheduleCount === 1 ? 'match' : 'matches'}</span><Link className={styles.primary} href={competition.href}>{readiness.actionLabel}</Link>{manager ? <button className={styles.quietButton} type="button" onClick={() => onInvite(competition.type, competition.id)}>Invite people</button> : null}</article>
      })}</div></> : null}
    </section>
  )
}

function TemplateCard({ club, template }: { club: Club; template: ClubCompetitionTemplate }) {
  return <article className={styles.card}><div className={styles.cardTop}><h3>{template.name}</h3><span className={styles.pill}>{template.competitionType}</span></div><p>{[template.divisionLabel, template.defaultFacility, template.formatId.replaceAll('_', ' ')].filter(Boolean).join(' · ')}</p><Link className={styles.primary} href={buildClubCompetitionLaunchHref(club, template)}>Open {template.competitionType === 'league' ? 'League Office' : 'Tournament Desk'}</Link></article>
}

function ClubSettings({ club, working, onUploadLogo, onSave }: { club: Club; working: boolean; onUploadLogo: (file: File) => Promise<string>; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({ name: club.name, description: club.description, logoUrl: club.logoUrl, heroImageUrl: club.heroImageUrl, primaryColor: club.primaryColor, locationLabel: club.locationLabel, contactEmail: club.contactEmail, timeZone: club.timeZone, isPublic: club.isPublic })
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoNotice, setLogoNotice] = useState('')
  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) { setForm((current) => ({ ...current, [key]: value })) }

  async function uploadLogo(file: File | undefined) {
    if (!file) return
    setLogoUploading(true)
    setLogoNotice('')
    try {
      const logoUrl = await onUploadLogo(file)
      set('logoUrl', logoUrl)
      setLogoNotice('Logo uploaded and saved.')
    } catch (error) {
      setLogoNotice(error instanceof Error ? error.message : 'The club logo could not be uploaded.')
    } finally {
      setLogoUploading(false)
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}><p className={styles.eyebrow}>Club page</p><h2>Make the club feel like your club.</h2><p>These details carry into the public club home and new competition setups.</p></div>
      <form className={styles.compactForm} onSubmit={(event) => { event.preventDefault(); void onSave(form) }}>
        <div className={styles.fieldGrid}>
          <label className={styles.field}><span>Name</span><input value={form.name} onChange={(event) => set('name', event.target.value)} /></label>
          <label className={styles.field}><span>Club color</span><input type="color" value={form.primaryColor} onChange={(event) => set('primaryColor', event.target.value)} /></label>
          <section className={`${styles.clubLogoEditor} ${styles.full}`} aria-labelledby="club-logo-title">
            <div className={styles.clubLogoPreview}>
              {form.logoUrl
                ? <Image src={form.logoUrl} alt={`${form.name || club.name} logo preview`} width={88} height={88} unoptimized />
                : <span aria-hidden="true">{(form.name || club.name).slice(0, 2).toUpperCase()}</span>}
            </div>
            <div className={styles.clubLogoControls}>
              <div><strong id="club-logo-title">Club logo</strong><span>Upload a JPG, PNG, or WebP image up to 5 MB.</span></div>
              <div className={styles.clubLogoActions}>
                <label className={styles.primary} aria-disabled={working || logoUploading}>
                  <input className={styles.clubLogoInput} disabled={working || logoUploading} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; void uploadLogo(file) }} />
                  {logoUploading ? 'Uploading...' : form.logoUrl ? 'Replace logo' : 'Upload logo'}
                </label>
                {form.logoUrl ? <button className={styles.quietButton} disabled={working || logoUploading} type="button" onClick={() => { set('logoUrl', ''); setLogoNotice('Logo removed from this draft. Save the club page to finish.') }}>Remove</button> : null}
              </div>
              {logoNotice ? <p className={styles.clubLogoNotice} role="status">{logoNotice}</p> : null}
              <details className={styles.clubLogoUrlFallback}>
                <summary>Use an image URL instead</summary>
                <label className={styles.field}><span>Logo URL</span><input value={form.logoUrl} onChange={(event) => set('logoUrl', event.target.value)} placeholder="https://..." /></label>
              </details>
            </div>
          </section>
          <label className={styles.field}><span>Location</span><input value={form.locationLabel} onChange={(event) => set('locationLabel', event.target.value)} /></label>
          <label className={styles.field}><span>Public contact email (optional)</span><input type="email" value={form.contactEmail} onChange={(event) => set('contactEmail', event.target.value)} /></label>
          <label className={styles.field}><span>Time zone</span><input value={form.timeZone} onChange={(event) => set('timeZone', event.target.value)} /></label>
          <label className={`${styles.field} ${styles.full}`}><span>Hero image URL</span><input value={form.heroImageUrl} onChange={(event) => set('heroImageUrl', event.target.value)} /></label>
          <label className={`${styles.field} ${styles.full}`}><span>About the club</span><textarea value={form.description} onChange={(event) => set('description', event.target.value)} /></label>
          <label className={styles.check}><input type="checkbox" checked={form.isPublic} onChange={(event) => set('isPublic', event.target.checked)} />Public club page</label>
        </div>
        <button className={styles.primary} disabled={working || logoUploading} type="submit">Save club page</button>
      </form>
    </section>
  )
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
  const activeGroupCount = workspace.groups.filter((group) => group.isActive).length
  if (roles.some((role) => role === 'owner' || role === 'admin' || role === 'director')) return [
    { title: 'Develop players', detail: `${workspace.memberships.length} people connected to the club experience`, label: 'Open coaching view', href: buildClubToolHref('/coach', workspace.club) },
    { title: 'Run programs', detail: `${activeGroupCount} active clinics, teams, camps, or development groups`, label: 'Open programs', tab: 'groups' as WorkspaceTab },
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
function readRequestedWorkspaceTab(): WorkspaceTab | null { const value = new URL(window.location.href).searchParams.get('tab'); return value === 'calendar' || value === 'people' || value === 'groups' || value === 'compete' || value === 'settings' || value === 'home' ? value : null }
function readRequestedGroupId() { return new URL(window.location.href).searchParams.get('groupId') || '' }
function readRequestedRosterOpen() { return new URL(window.location.href).searchParams.get('roster') === '1' }
function readRequestedRosterTeam() { return new URL(window.location.href).searchParams.get('team') || '' }
function readRequestedCommunicationOpen() { return typeof window !== 'undefined' && new URL(window.location.href).searchParams.get('communication') === '1' }

function formatClubProgramDate(value: string, timeZone: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)
  }
}
function normalizeRosterTeamKey(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function getRosterScopeKey(contact: Pick<ClubRosterContact, 'importedByUserId' | 'teamName' | 'leagueName' | 'flight'>) { return [contact.importedByUserId, contact.teamName, contact.leagueName, contact.flight].join('\u001f') }
function getRosterScopeLabel(contact: Pick<ClubRosterContact, 'teamName' | 'leagueName' | 'flight'>) { return [contact.teamName, contact.flight, contact.leagueName].filter(Boolean).join(' · ') }
function getRosterScopeOptionLabel(contact: Pick<ClubRosterContact, 'ownedByYou' | 'importedByName' | 'teamName' | 'leagueName' | 'flight'>) { return `${getRosterScopeLabel(contact)} · ${contact.ownedByYou ? 'Your import' : `Shared by ${contact.importedByName}`}` }
function getReadyRosterEmails(contacts: ClubRosterContact[], scopeKey: string) { return normalizeClubInviteEmails(contacts.filter((contact) => getRosterScopeKey(contact) === scopeKey && contact.connectionStatus === 'ready').map((contact) => contact.email)) }
function splitClubDestination(value: string): ['group' | 'league' | 'tournament', string] { const separator = value.indexOf(':'); return [value.slice(0, separator) as 'group' | 'league' | 'tournament', value.slice(separator + 1)] }
