'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import CoordinatorSubnav from '@/app/components/coordinator-subnav'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import SiteShell from '@/app/components/site-shell'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import { getClientAuthState } from '@/lib/auth'
import { LEAGUE_COORDINATOR_STORY } from '@/lib/product-story'
import { getLeagueFormatLabel } from '@/lib/competition-layers'
import {
  getTiqIndividualCompetitionFormatDescription,
  getTiqIndividualCompetitionFormatLabel,
  TIQ_INDIVIDUAL_COMPETITION_FORMATS,
} from '@/lib/tiq-individual-format'
import { uploadTiqLeaguePhoto } from '@/lib/tiq-league-photo-service'
import {
  buildLeagueCardsFromRegistry,
  getTiqLeagueScoringSystemDescription,
  getTiqLeagueScoringSystemLabel,
  parseRegistryListInput,
  type TiqLeagueDraft,
  type TiqLeagueRecord,
} from '@/lib/tiq-league-registry'
import { type UserRole } from '@/lib/roles'
import {
  listTiqLeagues,
  removeTiqLeague,
  saveTiqLeague,
  type TiqLeagueStorageSource,
} from '@/lib/tiq-league-service'
import { cleanText as safeText } from '@/lib/captain-formatters'

const EMPTY_DRAFT: TiqLeagueDraft = {
  leagueFormat: 'team',
  individualCompetitionFormat: 'standard',
  scoringSystem: 'standard',
  leagueName: '',
  seasonLabel: '',
  flight: '',
  locationLabel: '',
  photoUrl: '',
  captainTeamName: '',
  notes: '',
  teams: [],
  players: [],
}

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function buildTeamResultEntryHref(leagueId?: string) {
  return leagueId ? `/league-coordinator/results?leagueId=${encodeURIComponent(leagueId)}` : '/league-coordinator/results'
}

function buildIndividualResultEntryHref(leagueId?: string) {
  if (!leagueId) return '/explore/leagues'

  const encodedLeagueId = encodeURIComponent(leagueId)
  return `/explore/leagues/tiq/${encodedLeagueId}?league_id=${encodedLeagueId}`
}

export function LeagueCoordinatorWorkspace({ activeRoute = '/league-coordinator' }: { activeRoute?: string }) {
  const [role, setRole] = useState<UserRole>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)
  const [records, setRecords] = useState<TiqLeagueRecord[]>([])
  const [draft, setDraft] = useState<TiqLeagueDraft>(EMPTY_DRAFT)
  const [teamListInput, setTeamListInput] = useState('')
  const [playerListInput, setPlayerListInput] = useState('')
  const [editingId, setEditingId] = useState('')
  const [status, setStatus] = useState('')
  const [photoUploadStatus, setPhotoUploadStatus] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [storageSource, setStorageSource] = useState<TiqLeagueStorageSource>('local')
  const [storageWarning, setStorageWarning] = useState('')

  const refreshRegistry = useCallback(async () => {
    const result = await listTiqLeagues()
    setRecords(result.records)
    setStorageSource(result.source)
    setStorageWarning(result.warning || '')
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void refreshRegistry()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [refreshRegistry])

  useEffect(() => {
    let active = true

    async function loadAuth() {
      const authState = await getClientAuthState()
      if (!active) return
      setRole(authState.role)
      setEntitlements(authState.entitlements)
    }

    void loadAuth()

    return () => {
      active = false
    }
  }, [])

  const leagueCards = useMemo(() => buildLeagueCardsFromRegistry(records), [records])
  const access = useMemo(() => buildProductAccessState(role, entitlements), [entitlements, role])
  const teamLeagues = useMemo(
    () => records.filter((record) => record.leagueFormat === 'team'),
    [records],
  )
  const latestTeamLeague = useMemo(
    () => [...teamLeagues].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0],
    [teamLeagues],
  )
  const individualLeagues = useMemo(
    () => records.filter((record) => record.leagueFormat === 'individual'),
    [records],
  )
  const latestIndividualLeague = useMemo(
    () => [...individualLeagues].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0],
    [individualLeagues],
  )
  const canSaveCurrentDraft =
    draft.leagueFormat === 'team'
      ? access.canCreateTiqTeamLeague
      : access.canCreateTiqIndividualLeague
  const accessBannerText =
    draft.leagueFormat === 'team' ? access.teamLeagueMessage : access.individualLeagueMessage
  const shouldShowLeagueUpgradePrompt = !canSaveCurrentDraft
  const activeParticipantCount = records.reduce(
    (sum, record) => sum + (record.leagueFormat === 'team' ? record.teams.length : record.players.length),
    0,
  )
  const latestRecord = [...records].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0]
  const teamResultEntryHref = buildTeamResultEntryHref(latestTeamLeague?.id)
  const individualResultEntryHref = buildIndividualResultEntryHref(latestIndividualLeague?.id)
  const hasResultReadyLeague = teamLeagues.length > 0 || individualLeagues.length > 0
  const resultEntryHref = hasResultReadyLeague
    ? latestTeamLeague
      ? teamResultEntryHref
      : individualResultEntryHref
    : '#league-setup-form'
  const resultReadinessDetail =
    teamLeagues.length > 0 && individualLeagues.length > 0
      ? 'Team and individual leagues are ready for result entry.'
      : teamLeagues.length > 0
        ? 'Team leagues are ready for team match result entry.'
        : individualLeagues.length > 0
          ? 'Individual leagues are ready for player result logging.'
          : 'Save a team or individual league before logging results.'
  const leagueOpsChecks = [
    {
      label: 'Access',
      complete: access.canUseLeagueTools,
      detail: access.canUseLeagueTools ? 'Coordinator tools are active.' : 'Coordinator access is not active yet.',
      href: '/pricing#league',
      cta: 'See plan',
    },
    {
      label: 'Setup',
      complete: records.length > 0,
      detail: records.length > 0 ? `${records.length} league setup${records.length === 1 ? '' : 's'} saved.` : 'Create the first league setup.',
      href: '#league-setup-form',
      cta: records.length > 0 ? 'Edit setup' : 'Add league',
    },
    {
      label: 'Participants',
      complete: activeParticipantCount > 0,
      detail: activeParticipantCount > 0 ? `${activeParticipantCount} participants tracked.` : 'Add teams or players to the league.',
      href: '#league-setup-form',
      cta: 'Add participants',
    },
    {
      label: 'Sync',
      complete: storageSource === 'supabase',
      detail: storageSource === 'supabase' ? 'League setup is synced.' : 'League setup is saved as a local preview.',
      href: '#league-registry',
      cta: 'Review registry',
    },
    {
      label: 'Results',
      complete: hasResultReadyLeague,
      detail: resultReadinessDetail,
      href: hasResultReadyLeague ? resultEntryHref : '#league-setup-form',
      cta: hasResultReadyLeague ? 'Record results' : 'Finish setup',
    },
  ]
  const leagueOpsCompleteCount = leagueOpsChecks.filter((item) => item.complete).length
  const leagueOpsReadinessScore = Math.round((leagueOpsCompleteCount / leagueOpsChecks.length) * 100)
  const nextLeagueOpsStep = leagueOpsChecks.find((item) => !item.complete) || leagueOpsChecks[leagueOpsChecks.length - 1]

  function resetDraft() {
    setDraft(EMPTY_DRAFT)
    setTeamListInput('')
    setPlayerListInput('')
    setEditingId('')
    setPhotoUploadStatus('')
  }

  async function handlePhotoUpload(file: File | null) {
    if (!file) return

    setPhotoUploading(true)
    setPhotoUploadStatus('Uploading league photo...')

    const result = await uploadTiqLeaguePhoto({
      file,
      leagueName: draft.leagueName,
      existingLeagueId: editingId,
    })

    if (result.warning) {
      setPhotoUploadStatus(result.warning)
    } else {
      setDraft((current) => ({ ...current, photoUrl: result.publicUrl }))
      setPhotoUploadStatus('League photo uploaded.')
    }

    setPhotoUploading(false)
  }

  async function persistDraft() {
    if (!canSaveCurrentDraft) {
      setStatus(accessBannerText)
      return
    }

    const parsedTeams = parseRegistryListInput(teamListInput)
    const parsedPlayers = parseRegistryListInput(playerListInput)

    const nextDraft: TiqLeagueDraft = {
      ...draft,
      teams: draft.leagueFormat === 'team' ? parsedTeams : [],
      players: draft.leagueFormat === 'individual' ? parsedPlayers : [],
    }

    if (!safeText(nextDraft.leagueName) || !safeText(nextDraft.seasonLabel)) {
      setStatus('League name and season are required before saving.')
      return
    }

    if (nextDraft.leagueFormat === 'team' && nextDraft.teams.length === 0) {
      setStatus('Team leagues need at least one team in the participant list.')
      return
    }

    if (nextDraft.leagueFormat === 'individual' && nextDraft.players.length === 0) {
      setStatus('Individual leagues need at least one player in the participant list.')
      return
    }

    const saved = await saveTiqLeague(nextDraft, editingId || undefined)
    await refreshRegistry()
    setStatus(
      editingId
        ? `${saved.record.leagueName} was updated in the TIQ season registry.`
        : `${saved.record.leagueName} was added to the TIQ season registry.`,
    )
    setStorageSource(saved.source)
    setStorageWarning(saved.warning || '')
    resetDraft()
  }

  function startEditing(record: TiqLeagueRecord) {
    setEditingId(record.id)
    setDraft({
      leagueFormat: record.leagueFormat,
      individualCompetitionFormat: record.individualCompetitionFormat,
      scoringSystem: record.scoringSystem,
      leagueName: record.leagueName,
      seasonLabel: record.seasonLabel,
      flight: record.flight,
      locationLabel: record.locationLabel,
      photoUrl: record.photoUrl,
      captainTeamName: record.captainTeamName,
      notes: record.notes,
      teams: record.teams,
      players: record.players,
    })
    setTeamListInput(record.teams.join('\n'))
    setPlayerListInput(record.players.join('\n'))
    setStatus(`Editing ${record.leagueName}.`)
  }

  async function removeRecord(id: string) {
    const result = await removeTiqLeague(id)
    await refreshRegistry()
    if (editingId === id) resetDraft()
    setStatus(
      result.source === 'supabase'
        ? 'The TIQ league was removed from the TIQ season registry.'
        : 'The TIQ league was removed from the local TIQ season registry.',
    )
    setStorageSource(result.source)
    setStorageWarning(result.warning || '')
  }

  return (
    <SiteShell active={activeRoute}>
      <section style={pageWrap}>
        <div style={heroCard}>
          <div style={heroEyebrow}>{LEAGUE_COORDINATOR_STORY.eyebrow}</div>
          <h1 style={heroTitle}>{LEAGUE_COORDINATOR_STORY.headline}</h1>
          <p style={heroText}>
            {LEAGUE_COORDINATOR_STORY.body}
          </p>

          <div style={heroPillRow}>
            <span style={pillBlue}>{records.length} TIQ leagues</span>
            <span style={pillGreen}>{teamLeagues.length} team leagues</span>
            <span style={pillSlate}>{individualLeagues.length} individual leagues</span>
            <span style={storageSource === 'supabase' ? pillGreen : pillSlate}>
              {storageSource === 'supabase' ? 'Live data' : 'Saved preview'}
            </span>
            <span style={access.canUseLeagueTools ? pillGreen : pillSlate}>
              {access.leagueTierLabel}
            </span>
          </div>

          {storageWarning ? <div style={statusBanner}>{storageWarning}</div> : null}
          {!access.canUseLeagueTools ? <div style={noteBanner}>{access.leagueTierMessage}</div> : null}

          <div style={heroActionRow}>
            <GhostLink href={resultEntryHref}>Record results</GhostLink>
            <GhostLink href="/compete/leagues">My leagues</GhostLink>
            <GhostLink href="/explore/leagues">Browse leagues</GhostLink>
          </div>
        </div>

        <CoordinatorSubnav
          title={LEAGUE_COORDINATOR_STORY.subnavTitle}
          description={LEAGUE_COORDINATOR_STORY.subnavDescription}
          tierLabel={access.leagueTierLabel}
          tierActive={access.canUseLeagueTools}
        />

        <section style={commandCard}>
          <div>
            <div style={sectionEyebrow}>League command center</div>
            <h2 style={sectionTitle}>{records.length ? 'Your TIQ league system is active.' : 'Create the first league.'}</h2>
            <p style={sectionText}>
              Keep setup simple: create the league, add participants, record results, then let standings and schedules tell the story.
            </p>
          </div>
          <div style={commandGrid}>
            <div style={commandTile}>
              <span style={commandLabel}>Leagues</span>
              <strong style={commandValue}>{records.length}</strong>
              <span style={commandText}>{teamLeagues.length} team - {individualLeagues.length} individual</span>
            </div>
            <div style={commandTile}>
              <span style={commandLabel}>Participants</span>
              <strong style={commandValue}>{activeParticipantCount}</strong>
              <span style={commandText}>Teams and players tracked</span>
            </div>
            <div style={commandTile}>
              <span style={commandLabel}>Latest</span>
              <strong style={commandValue}>{latestRecord?.leagueName || 'None yet'}</strong>
              <span style={commandText}>{latestRecord ? formatDateTime(latestRecord.updatedAt) : 'Start with setup'}</span>
            </div>
          </div>
          <div style={heroActionRow}>
            {hasResultReadyLeague ? (
              <>
                {latestTeamLeague ? <GhostLink href={teamResultEntryHref}>Team results</GhostLink> : null}
                {latestIndividualLeague ? <GhostLink href={individualResultEntryHref}>Individual results</GhostLink> : null}
              </>
            ) : (
              <GhostLink href={resultEntryHref}>Record results</GhostLink>
            )}
            <GhostLink href="/compete/leagues">View leagues</GhostLink>
            <GhostLink href="/explore/rankings">View rankings</GhostLink>
          </div>
        </section>

        <section style={leagueOpsPanelStyle}>
          <div style={leagueOpsHeaderStyle}>
            <div>
              <div style={sectionEyebrow}>Season readiness</div>
              <h2 style={leagueOpsTitleStyle}>
                {leagueOpsReadinessScore === 100 ? 'This league is ready to operate.' : 'Tighten setup before the season moves.'}
              </h2>
              <p style={leagueOpsTextStyle}>
                {leagueOpsReadinessScore === 100
                  ? 'Setup, participants, sync, and result entry are all in usable shape.'
                  : `Next: ${nextLeagueOpsStep.label.toLowerCase()}. ${nextLeagueOpsStep.detail}`}
              </p>
            </div>
            <div style={leagueOpsScoreStyle}>
              <strong>{leagueOpsReadinessScore}%</strong>
              <span>{leagueOpsCompleteCount}/{leagueOpsChecks.length} ready</span>
            </div>
          </div>
          <div style={leagueOpsTrackStyle} aria-label={`League season readiness ${leagueOpsReadinessScore} percent`}>
            <span style={leagueOpsFillStyle(leagueOpsReadinessScore)} />
          </div>
          <div style={leagueOpsCheckGridStyle}>
            {leagueOpsChecks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                style={item.complete ? leagueOpsCheckCompleteStyle : leagueOpsCheckStyle}
              >
                <span>{item.label}</span>
                <small>{item.detail}</small>
              </Link>
            ))}
          </div>
          <div style={heroActionRow}>
            <GhostLink href={nextLeagueOpsStep.href}>{nextLeagueOpsStep.cta}</GhostLink>
            {latestTeamLeague ? <GhostLink href={teamResultEntryHref}>Team results</GhostLink> : null}
            {latestIndividualLeague ? <GhostLink href={individualResultEntryHref}>Individual results</GhostLink> : null}
            {!hasResultReadyLeague ? <GhostLink href={resultEntryHref}>Record results</GhostLink> : null}
          </div>
        </section>

        <div style={layoutGrid}>
          <details id="league-setup-form" style={panelCard} open={!!editingId || records.length === 0}>
            <summary style={detailsSummary}>
              <div>
                <div style={sectionEyebrow}>{editingId ? 'Editing' : 'Setup'}</div>
                <h2 style={sectionTitle}>
                  {editingId ? 'Edit league setup' : 'Add a league'}
                </h2>
                <p style={sectionText}>
                  Use only the fields needed to create the structure. Results and rankings come later.
                </p>
              </div>
              <span style={pillSlate}>{editingId ? 'Editing' : 'Open form'}</span>
            </summary>

            {shouldShowLeagueUpgradePrompt ? (
              <UpgradePrompt
                planId="league"
                headline={
                  draft.leagueFormat === 'team'
                    ? LEAGUE_COORDINATOR_STORY.upgradeHeadline
                    : LEAGUE_COORDINATOR_STORY.upgradeHeadline
                }
                body={
                  draft.leagueFormat === 'team'
                    ? LEAGUE_COORDINATOR_STORY.upgradeBody
                    : LEAGUE_COORDINATOR_STORY.upgradeBody
                }
                ctaLabel={LEAGUE_COORDINATOR_STORY.cta}
                secondaryLabel="Keep drafting"
                footnote={accessBannerText}
                compact
              />
            ) : (
              <div
                style={{
                  ...statusBanner,
                  ...noteBanner,
                }}
              >
                {accessBannerText}
              </div>
            )}

            <div style={fieldGrid}>
              <label style={fieldLabel}>
                <span>League format</span>
                <select
                  value={draft.leagueFormat}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      leagueFormat: event.target.value === 'individual' ? 'individual' : 'team',
                      individualCompetitionFormat:
                        event.target.value === 'individual'
                          ? current.individualCompetitionFormat
                          : 'standard',
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="team">Team League</option>
                  <option value="individual">Individual League</option>
                </select>
              </label>

              <label style={fieldLabel}>
                <span>League name</span>
                <input
                  value={draft.leagueName}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, leagueName: event.target.value }))
                  }
                  placeholder="TIQ Spring Doubles Cup"
                  style={inputStyle}
                />
              </label>

              <label style={fieldLabel}>
                <span>Season label</span>
                <input
                  value={draft.seasonLabel}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, seasonLabel: event.target.value }))
                  }
                  placeholder="Spring 2026"
                  style={inputStyle}
                />
              </label>

              <label style={fieldLabel}>
                <span>Flight or tier</span>
                <input
                  value={draft.flight}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, flight: event.target.value }))
                  }
                  placeholder="4.0 / Advanced / Open"
                  style={inputStyle}
                />
              </label>

              <label style={fieldLabel}>
                <span>Location / market</span>
                <input
                  value={draft.locationLabel}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, locationLabel: event.target.value }))
                  }
                  placeholder="Dallas Indoor"
                  style={inputStyle}
                />
              </label>

              <label style={fieldLabel}>
                <span>League photo or logo</span>
                <div style={photoUploadBox}>
                  {draft.photoUrl ? (
                    <div style={photoPreviewWrap}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={draft.photoUrl} alt="League photo preview" style={photoPreviewImage} />
                    </div>
                  ) : (
                    <div style={photoPlaceholder}>No photo uploaded</div>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    disabled={photoUploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null
                      void handlePhotoUpload(file)
                      event.target.value = ''
                    }}
                    style={fileInputStyle}
                  />
                  <input
                    value={draft.photoUrl}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, photoUrl: event.target.value }))
                    }
                    placeholder="Optional image URL fallback"
                    style={inputStyle}
                  />
                </div>
                <span style={fieldHelpText}>
                  Upload a JPG, PNG, WebP, or GIF up to 5 MB. The URL fallback is there for hosted club logos.
                </span>
                {photoUploadStatus ? <span style={fieldHelpText}>{photoUploadStatus}</span> : null}
              </label>

              <label style={fieldLabel}>
                <span>Organizer / owner</span>
                <input
                  value={draft.captainTeamName}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, captainTeamName: event.target.value }))
                  }
                  placeholder="North Dallas Aces"
                  style={inputStyle}
                />
              </label>

              {draft.leagueFormat === 'individual' ? (
                <label style={fieldLabel}>
                  <span>Individual competition format</span>
                  <select
                    value={draft.individualCompetitionFormat}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        individualCompetitionFormat:
                          event.target.value === 'ladder'
                            ? 'ladder'
                            : event.target.value === 'round_robin'
                              ? 'round_robin'
                              : event.target.value === 'challenge'
                                ? 'challenge'
                                : 'standard',
                      }))
                    }
                    style={inputStyle}
                  >
                    {TIQ_INDIVIDUAL_COMPETITION_FORMATS.map((format) => (
                      <option key={format} value={format}>
                        {getTiqIndividualCompetitionFormatLabel(format)}
                      </option>
                    ))}
                  </select>
                  <span style={fieldHelpText}>
                    {getTiqIndividualCompetitionFormatDescription(draft.individualCompetitionFormat)}
                  </span>
                </label>
              ) : null}

              <label style={fieldLabel}>
                <span>Scoring system</span>
                <select
                  value={draft.scoringSystem}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      scoringSystem: event.target.value === 'dynamic_points' ? 'dynamic_points' : 'standard',
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="standard">Standard wins</option>
                  <option value="dynamic_points">Dynamic points</option>
                </select>
                <span style={fieldHelpText}>
                  {getTiqLeagueScoringSystemDescription(draft.scoringSystem)}
                </span>
              </label>
            </div>

            <label style={fieldLabel}>
              <span>{draft.leagueFormat === 'team' ? 'Teams' : 'Players'}</span>
              <textarea
                value={draft.leagueFormat === 'team' ? teamListInput : playerListInput}
                onChange={(event) =>
                  draft.leagueFormat === 'team'
                    ? setTeamListInput(event.target.value)
                    : setPlayerListInput(event.target.value)
                }
                placeholder={
                  draft.leagueFormat === 'team'
                    ? 'North Dallas Aces\nPlano Pace\nFrisco Spin'
                    : 'Amy Chen\nLauren Diaz\nMina Patel'
                }
                style={textareaStyle}
              />
            </label>

            <label style={fieldLabel}>
              <span>Season notes</span>
              <textarea
                value={draft.notes}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Format rules, schedule notes, eligibility, defaults, or league reminders."
                style={textareaStyle}
              />
            </label>

            {status ? <div style={statusBanner}>{status}</div> : null}

            <div style={buttonRow}>
              <PrimaryBtn onClick={persistDraft} disabled={!canSaveCurrentDraft}>
                {editingId ? 'Update league' : 'Save league'}
              </PrimaryBtn>
              <GhostBtn onClick={resetDraft}>Clear form</GhostBtn>
            </div>

            {!canSaveCurrentDraft ? (
              <div style={{ marginTop: 18 }}>
                <UpgradePrompt
                  planId="league"
                  compact
                  headline={
                    draft.leagueFormat === 'team'
                      ? LEAGUE_COORDINATOR_STORY.draftUpgradeHeadline
                      : LEAGUE_COORDINATOR_STORY.draftUpgradeHeadline
                  }
                  body={
                    draft.leagueFormat === 'team'
                      ? LEAGUE_COORDINATOR_STORY.draftUpgradeBody
                      : LEAGUE_COORDINATOR_STORY.draftUpgradeBody
                  }
                  ctaLabel={LEAGUE_COORDINATOR_STORY.cta}
                  secondaryLabel="Compare plans"
                />
              </div>
            ) : null}
          </details>

          <section id="league-registry" style={panelCard}>
            <div style={sectionEyebrow}>League registry</div>
            <h2 style={sectionTitle}>{LEAGUE_COORDINATOR_STORY.registryTitle}</h2>
            <p style={sectionText}>
              {LEAGUE_COORDINATOR_STORY.registryBody}
            </p>

            {records.length === 0 ? (
              <div style={emptyCard}>
                No TIQ leagues have been created yet. Start with a team league or an individual league to
                create structure for participants, schedules, and results.
              </div>
            ) : (
              <div style={stackList}>
                {records.map((record) => {
                  const participantLabel =
                    record.leagueFormat === 'team'
                      ? `${record.teams.length} teams`
                      : `${record.players.length} players`

                  return (
                    <div key={record.id} style={registryCard}>
                      {record.photoUrl ? (
                        <div style={registryPhotoWrap}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={record.photoUrl} alt={`${record.leagueName} league`} style={registryPhoto} />
                        </div>
                      ) : null}
                      <div style={registryMetaRow}>
                        <span style={record.leagueFormat === 'team' ? pillGreen : pillBlue}>
                          {getLeagueFormatLabel(record.leagueFormat)}
                        </span>
                        <span style={pillSlate}>{record.seasonLabel || 'Season label missing'}</span>
                        <span style={pillSlate}>{getTiqLeagueScoringSystemLabel(record.scoringSystem)}</span>
                      </div>

                      <div style={registryTitle}>{record.leagueName}</div>
                      <div style={registryText}>
                        {[
                          record.leagueFormat === 'individual'
                            ? getTiqIndividualCompetitionFormatLabel(record.individualCompetitionFormat)
                            : null,
                          record.flight,
                          record.locationLabel,
                          participantLabel,
                        ]
                          .filter(Boolean)
                          .join(' | ')}
                      </div>
                      {record.notes ? <div style={registryNotes}>{record.notes}</div> : null}

                      <div style={registryFooter}>
                        <span style={registryTimestamp}>Updated {formatDateTime(record.updatedAt)}</span>
                        <div style={buttonRow}>
                          <GhostBtn onClick={() => startEditing(record)}>Edit</GhostBtn>
                          <DangerBtn onClick={() => removeRecord(record.id)}>Remove</DangerBtn>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {leagueCards.length > 0 ? (
              <div style={noteCard}>
                <div style={sectionEyebrow}>League records</div>
                <div style={sectionText}>
                  {leagueCards.length} TIQ league records are now available for browsing and result entry.
                </div>
              </div>
            ) : null}

            {!access.canUseLeagueTools ? (
              <div style={{ marginTop: 18 }}>
                <UpgradePrompt
                  planId="league"
                  compact
                  headline={LEAGUE_COORDINATOR_STORY.finalUpgradeHeadline}
                  body={LEAGUE_COORDINATOR_STORY.finalUpgradeBody}
                  ctaLabel={LEAGUE_COORDINATOR_STORY.cta}
                  secondaryLabel="See league value"
                />
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </SiteShell>
  )
}

function GhostLink({ href, children }: { href: string; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      style={{
        ...ghostButton,
        ...(hovered ? { background: 'rgba(255,255,255,0.10)', transform: 'translateY(-2px)', boxShadow: '0 6px 18px rgba(2,10,24,0.28)' } : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </Link>
  )
}

function GhostBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...ghostButtonButton,
        ...(hovered ? { background: 'rgba(255,255,255,0.10)', transform: 'translateY(-2px)', boxShadow: '0 6px 18px rgba(2,10,24,0.28)' } : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  )
}

function PrimaryBtn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...primaryButton,
        ...(disabled ? disabledPrimaryButton : {}),
        ...(hovered && !disabled ? { transform: 'translateY(-2px)', boxShadow: '0 8px 22px rgba(155,225,29,0.30)' } : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  )
}

function DangerBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...dangerButton,
        ...(hovered ? { background: 'rgba(80,20,30,0.90)', transform: 'translateY(-2px)', boxShadow: '0 6px 18px rgba(248,113,113,0.20)' } : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  )
}

const pageWrap: CSSProperties = {
  width: 'min(1280px, calc(100% - 40px))',
  margin: '0 auto',
  padding: '18px 0 30px',
  display: 'grid',
  gap: '18px',
}

const heroCard: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '28px',
  borderRadius: '30px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(180deg, rgba(16,38,70,0.78) 0%, rgba(8,19,38,0.94) 100%)',
  boxShadow: '0 28px 60px rgba(2,10,24,0.22)',
}

const heroEyebrow: CSSProperties = {
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: '#93c5fd',
}

const heroTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontSize: '52px',
  lineHeight: 0.98,
  letterSpacing: 0,
  maxWidth: '940px',
}

const heroText: CSSProperties = {
  margin: 0,
  color: 'rgba(229,238,251,0.78)',
  fontSize: '16px',
  lineHeight: 1.75,
  maxWidth: '920px',
}

const heroPillRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
}

const pillBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '32px',
  padding: '0 12px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const pillBlue: CSSProperties = {
  ...pillBase,
  background: 'rgba(74,163,255,0.14)',
  color: '#dfeeff',
}

const pillGreen: CSSProperties = {
  ...pillBase,
  background: 'rgba(155,225,29,0.14)',
  color: '#e7ffd1',
}

const pillSlate: CSSProperties = {
  ...pillBase,
  background: 'rgba(142, 161, 189, 0.14)',
  color: '#dfe8f8',
}

const heroActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
}

const layoutGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)',
  gap: '18px',
}

const commandCard: CSSProperties = {
  display: 'grid',
  gap: '18px',
  padding: '24px',
  borderRadius: '28px',
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'linear-gradient(135deg, rgba(14,30,58,0.86) 0%, rgba(11,24,45,0.94) 58%, rgba(39,72,37,0.28) 100%)',
  boxShadow: '0 24px 52px rgba(2,10,24,0.18)',
}

const commandGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: '12px',
}

const commandTile: CSSProperties = {
  display: 'grid',
  gap: '8px',
  padding: '16px',
  borderRadius: '20px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(255,255,255,0.045)',
  minWidth: 0,
}

const commandLabel: CSSProperties = {
  color: '#93c5fd',
  fontSize: '12px',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const commandValue: CSSProperties = {
  color: '#f8fbff',
  fontSize: '26px',
  fontWeight: 950,
  lineHeight: 1.05,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const commandText: CSSProperties = {
  color: 'rgba(229,238,251,0.72)',
  fontSize: '13px',
  lineHeight: 1.5,
}

const leagueOpsPanelStyle: CSSProperties = {
  display: 'grid',
  gap: '14px',
  padding: '20px',
  borderRadius: '24px',
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(135deg, rgba(23,47,37,0.72) 0%, rgba(10,24,45,0.94) 68%)',
  boxShadow: '0 18px 46px rgba(2,10,24,0.16)',
}

const leagueOpsHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '16px',
  flexWrap: 'wrap',
}

const leagueOpsTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: '#f8fbff',
  fontSize: '24px',
  lineHeight: 1.1,
  fontWeight: 950,
}

const leagueOpsTextStyle: CSSProperties = {
  margin: '8px 0 0',
  color: 'rgba(229,238,251,0.76)',
  fontSize: '14px',
  lineHeight: 1.65,
}

const leagueOpsScoreStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  justifyItems: 'end',
  color: 'rgba(229,238,251,0.76)',
  fontSize: '12px',
  fontWeight: 900,
}

const leagueOpsTrackStyle: CSSProperties = {
  height: '14px',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(7,17,33,0.72)',
  overflow: 'hidden',
  padding: '2px',
}

const leagueOpsFillStyle = (value: number): CSSProperties => ({
  display: 'block',
  height: '100%',
  width: `${Math.max(0, Math.min(value, 100))}%`,
  borderRadius: '999px',
  background: 'linear-gradient(90deg, #4ade80, #9be11d)',
})

const leagueOpsCheckGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '10px',
}

const leagueOpsCheckStyle: CSSProperties = {
  display: 'grid',
  gap: '6px',
  minHeight: '94px',
  padding: '12px',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(255,255,255,0.045)',
  color: 'rgba(229,238,251,0.76)',
  textDecoration: 'none',
  fontSize: '12px',
  fontWeight: 750,
}

const leagueOpsCheckCompleteStyle: CSSProperties = {
  ...leagueOpsCheckStyle,
  border: '1px solid rgba(74,222,128,0.22)',
  background: 'rgba(155,225,29,0.10)',
  color: '#f8fbff',
}

const panelCard: CSSProperties = {
  display: 'grid',
  gap: '16px',
  padding: '24px',
  borderRadius: '28px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'linear-gradient(180deg, rgba(14,30,58,0.82) 0%, rgba(8,18,35,0.96) 100%)',
}

const detailsSummary: CSSProperties = {
  cursor: 'pointer',
  listStyle: 'none',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '14px',
  flexWrap: 'wrap',
}

const sectionEyebrow: CSSProperties = {
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#93c5fd',
}

const sectionTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontSize: '28px',
  lineHeight: 1.08,
  letterSpacing: 0,
}

const sectionText: CSSProperties = {
  color: 'rgba(229,238,251,0.76)',
  fontSize: '14px',
  lineHeight: 1.72,
}

const fieldGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '14px',
}

const fieldLabel: CSSProperties = {
  display: 'grid',
  gap: '8px',
  color: '#e7eefb',
  fontSize: '13px',
  fontWeight: 700,
}

const fieldHelpText: CSSProperties = {
  color: 'rgba(214,228,246,0.72)',
  fontSize: '12px',
  lineHeight: 1.6,
  fontWeight: 500,
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: '48px',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(7,17,33,0.72)',
  color: '#f8fbff',
  padding: '0 14px',
  outline: 'none',
}

const photoUploadBox: CSSProperties = {
  display: 'grid',
  gap: '10px',
}

const photoPreviewWrap: CSSProperties = {
  width: '100%',
  aspectRatio: '16 / 7',
  overflow: 'hidden',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(255,255,255,0.05)',
}

const photoPreviewImage: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
}

const photoPlaceholder: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  minHeight: '112px',
  borderRadius: '16px',
  border: '1px dashed rgba(116,190,255,0.24)',
  background: 'rgba(255,255,255,0.04)',
  color: 'rgba(229,238,251,0.62)',
  fontSize: '13px',
  fontWeight: 800,
}

const fileInputStyle: CSSProperties = {
  width: '100%',
  color: 'rgba(229,238,251,0.82)',
  fontSize: '13px',
}

const textareaStyle: CSSProperties = {
  width: '100%',
  minHeight: '126px',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(7,17,33,0.72)',
  color: '#f8fbff',
  padding: '14px',
  outline: 'none',
  resize: 'vertical',
}

const statusBanner: CSSProperties = {
  padding: '12px 14px',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(255,255,255,0.05)',
  color: '#dbeafe',
  fontWeight: 700,
}

const noteBanner: CSSProperties = {
  border: '1px solid rgba(74,222,128,0.16)',
  background: 'rgba(17, 39, 27, 0.58)',
  color: '#dcfce7',
}

const buttonRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
}

const primaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '44px',
  padding: '0 16px',
  borderRadius: '999px',
  border: 'none',
  background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)',
  color: '#04121a',
  fontWeight: 900,
  cursor: 'pointer',
}

const disabledPrimaryButton: CSSProperties = {
  opacity: 0.58,
  cursor: 'not-allowed',
  boxShadow: 'none',
}

const ghostButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '42px',
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.05)',
  color: '#e7eefb',
  textDecoration: 'none',
  fontWeight: 800,
}

const ghostButtonButton: CSSProperties = {
  ...ghostButton,
  cursor: 'pointer',
}

const dangerButton: CSSProperties = {
  ...ghostButtonButton,
  border: '1px solid rgba(248,113,113,0.22)',
  background: 'rgba(60,16,24,0.76)',
  color: '#fecaca',
}

const emptyCard: CSSProperties = {
  padding: '18px',
  borderRadius: '20px',
  border: '1px dashed rgba(116,190,255,0.18)',
  color: 'rgba(229,238,251,0.76)',
  background: 'rgba(255,255,255,0.04)',
  lineHeight: 1.7,
}

const stackList: CSSProperties = {
  display: 'grid',
  gap: '12px',
}

const registryCard: CSSProperties = {
  display: 'grid',
  gap: '10px',
  padding: '18px',
  borderRadius: '22px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
}

const registryPhotoWrap: CSSProperties = {
  width: '100%',
  aspectRatio: '16 / 7',
  overflow: 'hidden',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(255,255,255,0.05)',
}

const registryPhoto: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
}

const registryMetaRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
}

const registryTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '22px',
  fontWeight: 900,
  lineHeight: 1.1,
}

const registryText: CSSProperties = {
  color: '#dbeafe',
  fontSize: '14px',
  lineHeight: 1.65,
}

const registryNotes: CSSProperties = {
  color: 'rgba(229,238,251,0.76)',
  fontSize: '14px',
  lineHeight: 1.72,
}

const registryFooter: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap',
  paddingTop: '8px',
}

const registryTimestamp: CSSProperties = {
  color: 'rgba(197,213,234,0.82)',
  fontSize: '12px',
  fontWeight: 700,
}

const noteCard: CSSProperties = {
  padding: '16px 18px',
  borderRadius: '20px',
  border: '1px solid rgba(74,222,128,0.16)',
  background: 'linear-gradient(180deg, rgba(32,58,31,0.24) 0%, rgba(18,36,66,0.62) 100%)',
}
