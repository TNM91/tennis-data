'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { useAuth } from '@/app/components/auth-provider'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import { buildProductAccessState } from '@/lib/access-model'
import { supabase } from '@/lib/supabase'
import { getTiqTournamentMessagingProviderState } from '@/lib/tiq-tournament-messaging'
import {
  buildTournamentPreview,
  buildRoundRobinStandings,
  buildTournamentScheduleEvents,
  buildTiqTournamentAlertDraft,
  clearTiqTournamentMatchResultForUser,
  deleteTiqTournamentRecordForUser,
  getTournamentLimitSummary,
  loadTiqTournamentAlertRecordsForUser,
  loadTiqTournamentRegistry,
  loadTiqTournamentEntriesForUser,
  loadTiqTournamentPreferenceEventsForUser,
  parseTournamentEntrantsInput,
  queueTiqTournamentAlertRecordForUser,
  readTiqTournamentRegistry,
  saveTiqTournamentAlertRecordForUser,
  saveTiqTournamentRecord,
  summarizeTournamentResults,
  updateTiqTournamentEntryStatus,
  updateTiqTournamentMatchScheduleForUser,
  updateTiqTournamentMatchResultForUser,
  updateTiqTournamentParticipantContactForUser,
  updateTiqTournamentEntrantPlayerIdsForUser,
  upsertTiqTournamentRecordForUser,
  type TiqTournamentAlertRecord,
  type TiqTournamentFormat,
  type TiqTournamentCalendarEvent,
  type TiqTournamentEntryRecord,
  type TiqTournamentPreferenceEventRecord,
  type TiqTournamentRecord,
  type TiqTournamentMatchSchedule,
} from '@/lib/tiq-tournament-registry'
import {
  buildTiqAwardCertificateText,
  buildTiqTournamentAwardCandidates,
  loadTiqAwardsForSource,
  readTiqAwardsForSource,
  saveTiqAwardRecordForUser,
  type TiqAwardPlacement,
  type TiqAwardRecord,
} from '@/lib/tiq-awards-registry'
import { PRODUCT_MOTTO } from '@/lib/product-story'

const sampleEntrants = ['Avery Stone', 'Blake Carter', 'Casey Nguyen', 'Drew Patel']

const lockedTournamentActions = [
  {
    title: 'Create the draw',
    detail: 'Name the event, choose the format, seed the field, and publish the room.',
  },
  {
    title: 'Schedule the courts',
    detail: 'Put match times and courts on one shared tournament calendar.',
  },
  {
    title: 'Connect players',
    detail: 'Turn entrant names into TIQ player profiles, ratings, and trophy cases.',
  },
  {
    title: 'Finish with awards',
    detail: 'Issue certificates, badges, and recap alerts from Tournament Desk.',
  },
]

const tournamentDeskPaths = [
  {
    job: 'organize_schedules',
    question: 'How do I organize schedules?',
    label: 'Schedule and courts',
    title: 'Build the room',
    body: 'Name it, choose the format, add the field, and save before court times move.',
    href: '#tournament-setup',
    cta: 'Set up event',
    icon: 'schedule',
  },
  {
    job: 'manage_players_teams',
    question: 'How do I manage players or teams?',
    label: 'Entries and profiles',
    title: 'Clear the entry queue',
    body: 'Approve entries, connect TIQ profiles, and keep the field draw-ready.',
    href: '#tournament-entries',
    cta: 'Review entries',
    icon: 'teamRankings',
  },
  {
    job: 'track_scores',
    question: 'How do I track scores?',
    label: 'Scores and standings',
    title: 'Run the scorebook',
    body: 'Add match slots, post results, publish standings, and finish awards.',
    href: '#tournament-scorebook',
    cta: 'Open scorebook',
    icon: 'reports',
  },
  {
    job: 'reduce_admin_work',
    question: 'How do I reduce admin work?',
    label: 'Alerts and recaps',
    title: 'Send the useful update',
    body: 'Draft court changes, reminders, rules, and recaps from one place.',
    href: '#tournament-alerts',
    cta: 'Prepare alerts',
    icon: 'alerts',
  },
] as const

export default function TournamentBuilderWorkspace() {
  const { role, userId, entitlements, authResolved } = useAuth()
  const resolvedRole = authResolved || !userId ? role : 'member'
  const access = useMemo(() => buildProductAccessState(resolvedRole, entitlements), [entitlements, resolvedRole])
  const canUseLeague = access.canUseLeagueTools
  const isFullCourt = access.currentPlanId === 'full_court'
  const [records, setRecords] = useState<TiqTournamentRecord[]>([])
  const [name, setName] = useState('Saturday Smash')
  const [format, setFormat] = useState<TiqTournamentFormat>('single_elimination')
  const [entrantType, setEntrantType] = useState<'players' | 'teams'>('players')
  const [startsOn, setStartsOn] = useState('')
  const [locationLabel, setLocationLabel] = useState('')
  const [directorNotes, setDirectorNotes] = useState('')
  const [entrantsText, setEntrantsText] = useState(sampleEntrants.join('\n'))
  const [isPublic, setIsPublic] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [notice, setNotice] = useState('')
  const [syncNotice, setSyncNotice] = useState('')
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({})
  const [scheduleInputs, setScheduleInputs] = useState<Record<string, Pick<TiqTournamentMatchSchedule, 'date' | 'time' | 'court'>>>({})
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [contactInputs, setContactInputs] = useState<Record<string, { phone: string; smsOptIn: boolean; consentNote: string }>>({})
  const [alertKind, setAlertKind] = useState<'rules' | 'court_ready' | 'schedule_change' | 'recap'>('court_ready')
  const [alertBody, setAlertBody] = useState('')
  const [alertRecords, setAlertRecords] = useState<TiqTournamentAlertRecord[]>([])
  const [preferenceEvents, setPreferenceEvents] = useState<TiqTournamentPreferenceEventRecord[]>([])
  const [alertSaving, setAlertSaving] = useState(false)
  const [alertQueueingId, setAlertQueueingId] = useState('')
  const [alertPreviewingId, setAlertPreviewingId] = useState('')
  const [alertDeliveryPreview, setAlertDeliveryPreview] = useState<{
    alertId: string
    optedInCount: number
    expectedRecipientCount: number
    note: string
    recipients: Array<{ entrantName: string; phone: string }>
    skippedRecipients: Array<{ entrantName: string; phone: string; reason: string }>
  } | null>(null)
  const [highlightedContact, setHighlightedContact] = useState('')
  const [profileSyncing, setProfileSyncing] = useState(false)
  const [entryRecords, setEntryRecords] = useState<TiqTournamentEntryRecord[]>([])
  const [entryCounts, setEntryCounts] = useState<Record<string, number>>({})
  const [awardCounts, setAwardCounts] = useState<Record<string, number>>({})
  const [alertCounts, setAlertCounts] = useState<Record<string, number>>({})
  const [entrySyncingId, setEntrySyncingId] = useState('')
  const [awardRecipients, setAwardRecipients] = useState<Record<TiqAwardPlacement, string>>({
    first: '',
    second: '',
    third: '',
  })
  const [awardRefresh, setAwardRefresh] = useState(0)

  const selectedRecord = records.find((record) => record.id === selectedId) || null
  const selectedRecordId = selectedRecord?.id || ''
  const draftEntrants = parseTournamentEntrantsInput(entrantsText)
  const draftPreview = buildTournamentPreview({
    format,
    entrants: draftEntrants,
    results: selectedRecord?.results,
  })
  const selectedPreview = selectedRecord ? buildTournamentPreview(selectedRecord) : []
  const selectedSummary = selectedRecord ? summarizeTournamentResults(selectedRecord) : null
  const selectedStandings = selectedRecord?.format === 'round_robin' ? buildRoundRobinStandings(selectedRecord) : []
  const scheduledEvents = useMemo(() => buildTournamentScheduleEvents(records), [records])
  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth, scheduledEvents), [calendarMonth, scheduledEvents])
  const scheduledMonthEvents = useMemo(() => (
    scheduledEvents
      .filter((event) => event.date.startsWith(calendarMonth))
      .sort((a, b) => `${a.date} ${a.time || '99:99'}`.localeCompare(`${b.date} ${b.time || '99:99'}`))
      .slice(0, 6)
  ), [calendarMonth, scheduledEvents])
  const alertDraft = selectedRecord ? buildTiqTournamentAlertDraft({
    record: selectedRecord,
    kind: alertKind,
    body: alertBody,
    siteUrl: `https://www.tenaceiq.com/tournaments/${encodeURIComponent(selectedRecord.id)}`,
    preferencesUrl: `https://www.tenaceiq.com/tournaments/${encodeURIComponent(selectedRecord.id)}/preferences`,
  }) : ''
  const optedInCount = selectedRecord
    ? selectedRecord.entrants.filter((entrant) => selectedRecord.contacts[entrant]?.smsOptIn && selectedRecord.contacts[entrant]?.phone).length
    : 0
  const phoneReadyCount = selectedRecord
    ? selectedRecord.entrants.filter((entrant) => selectedRecord.contacts[entrant]?.phone).length
    : 0
  const queuedAlertCount = alertRecords.filter((alert) => alert.status === 'queued').length
  const draftAlertCount = alertRecords.filter((alert) => alert.status === 'draft').length
  const sentAlertCount = alertRecords.filter((alert) => alert.status === 'sent').length
  const visibleAlertRecords = alertRecords.slice(0, 4)
  const providerState = getTiqTournamentMessagingProviderState()
  const sendReadinessItems = selectedRecord ? [
    {
      label: 'Phone numbers',
      value: `${phoneReadyCount}/${selectedRecord.entrants.length}`,
      ready: phoneReadyCount === selectedRecord.entrants.length && selectedRecord.entrants.length > 0,
    },
    {
      label: 'SMS consent',
      value: `${optedInCount}/${selectedRecord.entrants.length}`,
      ready: optedInCount > 0,
    },
    {
      label: 'Queued alerts',
      value: String(queuedAlertCount),
      ready: queuedAlertCount > 0,
    },
    {
      label: 'Provider',
      value: providerState.label,
      ready: providerState.enabled,
    },
  ] : []
  const profileReadyCount = selectedRecord
    ? selectedRecord.entrants.filter((entrant) => selectedRecord.entrantPlayerIds[entrant]).length
    : 0
  const awardCandidates = selectedRecord ? buildTiqTournamentAwardCandidates(selectedRecord) : []
  const pendingEntries = entryRecords.filter((entry) => entry.status === 'pending')
  const recentEntries = entryRecords.filter((entry) => entry.status !== 'pending').slice(0, 4)
  void awardRefresh
  const [cloudAwardRecords, setCloudAwardRecords] = useState<TiqAwardRecord[]>([])
  const awardRecords = selectedRecordId
    ? mergeVisibleAwards(cloudAwardRecords, readTiqAwardsForSource('tournament', selectedRecordId))
    : []
  const scheduledMatchCount = selectedRecord
    ? selectedPreview.filter((match) => match.schedule?.date || match.schedule?.time || match.schedule?.court).length
    : 0
  const totalMatchCount = selectedSummary?.totalMatches ?? 0
  const completedMatchCount = selectedSummary?.completedMatches ?? 0
  const directorFlowItems = selectedRecord ? [
    {
      label: 'Entries',
      value: pendingEntries.length ? `${pendingEntries.length} waiting` : selectedRecord.isPublic ? 'Open' : 'Private',
      href: '#tournament-entries',
      ready: selectedRecord.isPublic ? pendingEntries.length === 0 : true,
    },
    {
      label: 'Profiles',
      value: `${profileReadyCount}/${selectedRecord.entrants.length}`,
      href: '#tournament-profiles',
      ready: profileReadyCount === selectedRecord.entrants.length && selectedRecord.entrants.length > 0,
    },
    {
      label: 'Schedule',
      value: `${scheduledMatchCount}/${totalMatchCount}`,
      href: '#tournament-scorebook',
      ready: scheduledMatchCount > 0,
    },
    {
      label: 'Results',
      value: `${completedMatchCount}/${totalMatchCount}`,
      href: '#tournament-scorebook',
      ready: totalMatchCount > 0 && completedMatchCount === totalMatchCount,
    },
    {
      label: 'Awards',
      value: awardRecords.length ? `${awardRecords.length} issued` : 'Ready',
      href: '#tournament-awards',
      ready: awardRecords.length > 0,
    },
  ] : []
  const directorNextMove = selectedRecord ? buildDirectorNextMove({
    record: selectedRecord,
    pendingEntriesCount: pendingEntries.length,
    profileReadyCount,
    scheduledMatchCount,
    completedMatchCount,
    totalMatchCount,
    awardCount: awardRecords.length,
    alertCount: alertRecords.length,
  }) : null
  const tournamentFinishChecklist = selectedRecord ? buildTournamentFinishChecklist({
    record: selectedRecord,
    pendingEntriesCount: pendingEntries.length,
    profileReadyCount,
    scheduledMatchCount,
    completedMatchCount,
    totalMatchCount,
    awardCount: awardRecords.length,
    alertCount: alertRecords.length,
  }) : []
  const activeCount = records.filter((record) => record.status !== 'completed').length
  const canCreateMore = isFullCourt || activeCount < 1 || Boolean(selectedId)
  const setupReadinessItems = [
    {
      label: 'Name',
      value: name.trim() ? 'Set' : 'Needed',
      ready: Boolean(name.trim()),
    },
    {
      label: 'Field',
      value: `${draftEntrants.length} ${entrantType}`,
      ready: draftEntrants.length >= 2,
    },
    {
      label: 'When',
      value: startsOn || 'TBD',
      ready: Boolean(startsOn),
    },
    {
      label: 'Entry',
      value: isPublic ? 'Public' : 'Private',
      ready: isPublic || draftEntrants.length >= 2,
    },
  ]
  const setupPathItems = [
    {
      step: '1',
      label: 'Name the room',
      detail: name.trim() ? name.trim() : 'Add the tournament name.',
      ready: Boolean(name.trim()),
    },
    {
      step: '2',
      label: 'Set the field',
      detail: draftEntrants.length >= 2 ? `${draftEntrants.length} ${entrantType} in the draw.` : 'Add at least two entrants.',
      ready: draftEntrants.length >= 2,
    },
    {
      step: '3',
      label: 'Save and schedule',
      detail: startsOn ? 'Date is set. Save before assigning courts.' : 'Pick a date, then save the room.',
      ready: Boolean(startsOn) && draftEntrants.length >= 2,
    },
  ]
  const tournamentPathStatusItems = selectedRecord ? [
    {
      label: 'Active room',
      value: selectedRecord.name,
      detail: selectedRecord.isPublic ? 'Public entry page is open.' : 'Private field is loaded.',
      ready: true,
    },
    {
      label: 'Next move',
      value: directorNextMove?.label || 'Review the event',
      detail: directorNextMove?.detail || 'Open the saved room and choose the next section.',
      ready: Boolean(directorNextMove),
    },
    {
      label: 'Match flow',
      value: `${completedMatchCount}/${totalMatchCount || selectedPreview.length}`,
      detail: `${scheduledMatchCount} match${scheduledMatchCount === 1 ? '' : 'es'} scheduled.`,
      ready: completedMatchCount > 0 || scheduledMatchCount > 0,
    },
  ] : [
    {
      label: 'Draft field',
      value: `${draftEntrants.length} ${entrantType}`,
      detail: draftEntrants.length >= 2 ? 'The draw can be previewed.' : 'Add at least two names.',
      ready: draftEntrants.length >= 2,
    },
    {
      label: 'Entry mode',
      value: isPublic ? 'Public' : 'Private',
      detail: isPublic ? 'Players can request a spot.' : 'Use the pasted field first.',
      ready: isPublic || draftEntrants.length >= 2,
    },
    {
      label: 'First save',
      value: canCreateMore ? 'Available' : 'Limit reached',
      detail: canCreateMore ? 'Save once, then run schedule, scores, alerts, and awards.' : 'Open an event or compare Full-Court.',
      ready: canCreateMore,
    },
  ]
  const tournamentPathActions = tournamentDeskPaths.map((path) => (
    selectedRecord || path.href === '#tournament-setup'
      ? path
      : {
          ...path,
          href: '#tournament-setup',
          cta: 'Save room first',
        }
  ))
  const scorebookCommandItems = selectedRecord ? [
    {
      label: 'Schedule',
      value: `${scheduledMatchCount}/${totalMatchCount}`,
      detail: scheduledMatchCount ? 'Court slots have started.' : 'Add the first date, time, and court.',
      href: '#tournament-scorebook',
      ready: scheduledMatchCount > 0,
    },
    {
      label: 'Results',
      value: `${completedMatchCount}/${totalMatchCount}`,
      detail: completedMatchCount ? 'Scores are moving.' : 'Record winners as matches finish.',
      href: '#tournament-scorebook',
      ready: completedMatchCount > 0,
    },
    {
      label: 'Player update',
      value: alertRecords.length ? `${alertRecords.length} drafts` : 'Draft next',
      detail: alertRecords.length ? 'Alerts are ready to review.' : 'Prepare a schedule or recap alert.',
      href: '#tournament-alerts',
      ready: alertRecords.length > 0,
    },
  ] : []
  const entryCommandItems = selectedRecord ? [
    {
      label: 'Registration',
      value: selectedRecord.isPublic ? 'Public' : 'Private',
      detail: selectedRecord.isPublic ? 'Review requests before they reach the draw.' : 'Open setup when you want public entry.',
      href: selectedRecord.isPublic ? '#tournament-entries' : '#tournament-setup',
      ready: selectedRecord.isPublic,
    },
    {
      label: 'Entry queue',
      value: pendingEntries.length ? `${pendingEntries.length} waiting` : 'Clear',
      detail: pendingEntries.length ? 'Approve players into the field.' : 'No entry decisions are waiting.',
      href: '#tournament-entries',
      ready: pendingEntries.length === 0,
    },
    {
      label: 'Player profiles',
      value: `${profileReadyCount}/${selectedRecord.entrants.length}`,
      detail: profileReadyCount === selectedRecord.entrants.length ? 'Profiles are linked.' : 'Create TIQ profiles for entrant follow-through.',
      href: '#tournament-profiles',
      ready: profileReadyCount === selectedRecord.entrants.length && selectedRecord.entrants.length > 0,
    },
  ] : []
  const alertCommandItems = selectedRecord ? [
    {
      label: 'Contact list',
      value: `${phoneReadyCount}/${selectedRecord.entrants.length}`,
      detail: phoneReadyCount ? 'Phone numbers are started.' : 'Add phone numbers before queueing alerts.',
      href: '#tournament-alerts',
      ready: phoneReadyCount === selectedRecord.entrants.length && selectedRecord.entrants.length > 0,
    },
    {
      label: 'Opt-ins',
      value: `${optedInCount}/${selectedRecord.entrants.length}`,
      detail: optedInCount ? 'Use confirmed consent only.' : 'Confirm opt-in before delivery review.',
      href: '#tournament-alerts',
      ready: optedInCount > 0,
    },
    {
      label: 'Drafts',
      value: alertRecords.length ? `${alertRecords.length} saved` : 'Start one',
      detail: queuedAlertCount ? 'Queued drafts can be previewed.' : 'Write the useful court, schedule, or recap update.',
      href: '#tournament-alerts',
      ready: alertRecords.length > 0,
    },
  ] : []
  const profileCommandItems = selectedRecord ? [
    {
      label: 'Profile links',
      value: `${profileReadyCount}/${selectedRecord.entrants.length}`,
      detail: profileReadyCount === selectedRecord.entrants.length ? 'Every entrant is TIQ-ready.' : 'Create profiles so results can follow each player.',
      href: '#tournament-profiles',
      ready: profileReadyCount === selectedRecord.entrants.length && selectedRecord.entrants.length > 0,
    },
    {
      label: 'Rating source',
      value: 'Self-rated',
      detail: 'New profiles start with S until verified results improve the rating source.',
      href: '#tournament-scorebook',
      ready: completedMatchCount > 0,
    },
    {
      label: 'Trophy cases',
      value: awardRecords.length ? 'Linked' : 'Next',
      detail: awardRecords.length ? 'Awards can land in player trophy cases.' : 'Issue awards after profiles and results are ready.',
      href: '#tournament-awards',
      ready: awardRecords.length > 0,
    },
  ] : []
  const awardCommandItems = selectedRecord ? [
    {
      label: 'Results',
      value: `${completedMatchCount}/${totalMatchCount}`,
      detail: completedMatchCount ? 'Use completed matches to pick honors.' : 'Finish results before issuing podium awards.',
      href: '#tournament-scorebook',
      ready: completedMatchCount > 0,
    },
    {
      label: 'Recipients',
      value: `${awardCandidates.length} slots`,
      detail: awardCandidates.length ? 'Confirm names before creating certificates.' : 'Complete the draw to unlock award slots.',
      href: '#tournament-awards',
      ready: awardCandidates.length > 0,
    },
    {
      label: 'Award follow-through',
      value: awardRecords.length ? `${awardRecords.length} issued` : 'Ready',
      detail: awardRecords.length ? 'Print, email, or send the recap alert.' : 'Create awards, then send the recap.',
      href: awardRecords.length ? '#tournament-alerts' : '#tournament-awards',
      ready: awardRecords.length > 0,
    },
  ] : []

  useEffect(() => {
    let active = true

    async function loadRecords() {
      const localRecords = readTiqTournamentRegistry()
      if (active) setRecords(localRecords)
      const result = await loadTiqTournamentRegistry(authResolved ? userId : null)
      if (!active) return
      setRecords(result.data)
      setSyncNotice(
        result.source === 'cloud'
          ? 'Tournament room synced.'
          : result.error
            ? 'Using this device until tournament cloud sync is ready.'
            : '',
      )
    }

    void loadRecords()

    return () => {
      active = false
    }
  }, [authResolved, userId])

  useEffect(() => {
    let active = true

    async function loadEntries() {
      if (!selectedRecordId || !userId) {
        if (active) setEntryRecords([])
        return
      }

      const result = await loadTiqTournamentEntriesForUser(selectedRecordId)
      if (active) setEntryRecords(result.data)
    }

    void loadEntries()

    return () => {
      active = false
    }
  }, [selectedRecordId, userId])

  useEffect(() => {
    let active = true

    async function loadAlerts() {
      if (!selectedRecordId || !userId) {
        if (active) setAlertRecords([])
        if (active) setPreferenceEvents([])
        return
      }

      const [alertResult, preferenceResult] = await Promise.all([
        loadTiqTournamentAlertRecordsForUser(selectedRecordId),
        loadTiqTournamentPreferenceEventsForUser(selectedRecordId),
      ])
      if (active) {
        setAlertRecords(alertResult.data)
        setPreferenceEvents(preferenceResult.data)
      }
    }

    void loadAlerts()

    return () => {
      active = false
    }
  }, [selectedRecordId, userId])

  useEffect(() => {
    let active = true

    async function loadEntryCounts() {
      if (!userId || !records.length) {
        if (active) setEntryCounts({})
        return
      }

      const pairs = await Promise.all(records.map(async (record) => {
        if (!record.isPublic) return [record.id, 0] as const
        const result = await loadTiqTournamentEntriesForUser(record.id)
        return [record.id, result.data.filter((entry) => entry.status === 'pending').length] as const
      }))

      if (active) setEntryCounts(Object.fromEntries(pairs))
    }

    void loadEntryCounts()

    return () => {
      active = false
    }
  }, [records, userId])

  useEffect(() => {
    let active = true

    async function loadAwardCounts() {
      if (!records.length) {
        if (active) setAwardCounts({})
        return
      }

      const pairs = await Promise.all(records.map(async (record) => {
        const result = await loadTiqAwardsForSource('tournament', record.id)
        const localCount = readTiqAwardsForSource('tournament', record.id).length
        return [record.id, Math.max(result.data.length, localCount)] as const
      }))

      if (active) setAwardCounts(Object.fromEntries(pairs))
    }

    void loadAwardCounts()

    return () => {
      active = false
    }
  }, [records, awardRefresh])

  useEffect(() => {
    let active = true

    async function loadAlertCounts() {
      if (!userId || !records.length) {
        if (active) setAlertCounts({})
        return
      }

      const pairs = await Promise.all(records.map(async (record) => {
        const result = await loadTiqTournamentAlertRecordsForUser(record.id)
        return [record.id, result.data.length] as const
      }))

      if (active) setAlertCounts(Object.fromEntries(pairs))
    }

    void loadAlertCounts()

    return () => {
      active = false
    }
  }, [records, userId])

  function refreshRecords(nextSelectedId?: string) {
    const nextRecords = readTiqTournamentRegistry()
    setRecords(nextRecords)
    if (nextSelectedId !== undefined) {
      setSelectedId(nextSelectedId)
    }
  }

  async function refreshTournamentEntries(tournamentId = selectedRecordId) {
    if (!tournamentId || !userId) {
      setEntryRecords([])
      return
    }

      const result = await loadTiqTournamentEntriesForUser(tournamentId)
      setEntryRecords(result.data)
      setEntryCounts((current) => ({
        ...current,
        [tournamentId]: result.data.filter((entry) => entry.status === 'pending').length,
      }))
    }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice('')

    if (!canUseLeague) {
      setNotice('Unlock League or Full-Court before saving tournament rooms.')
      return
    }

    if (!canCreateMore) {
      setNotice('League includes one tournament room. Full-Court unlocks unlimited tournaments.')
      return
    }

    if (!name.trim()) {
      setNotice('Name the tournament first.')
      return
    }

    if (draftEntrants.length < 2) {
      setNotice('Add at least two entrants before building the draw.')
      return
    }

    const saved = await upsertTiqTournamentRecordForUser({
      name,
      format,
      entrantType,
      status: 'draft',
      startsOn,
      locationLabel,
      directorNotes,
      entrants: draftEntrants,
      isPublic,
    }, selectedId, userId)

    refreshRecords(saved.data.id)
    setSyncNotice(saved.source === 'cloud' ? 'Tournament room synced.' : 'Saved on this device.')
    setNotice(`${saved.data.name} is saved. The draw preview is ready for scheduling.`)
    if (saved.error) setNotice(saved.error.message)
  }

  async function updateMatchResult(matchId: string, winner: string) {
    if (!selectedRecord) return
    const score = (scoreInputs[matchId] || '').trim()
    const updated = await updateTiqTournamentMatchResultForUser({
      tournamentId: selectedRecord.id,
      matchId,
      winner,
      score,
    }, userId)
    if (!updated) {
      setNotice('That match could not be updated. Check the draw and try again.')
      return
    }

    refreshRecords(updated.id)
    setScoreInputs(buildScoreInputState(updated))
    setScheduleInputs(buildScheduleInputState(updated))
    setAwardRecipients((current) => buildAwardRecipientState(updated, current))
    setSyncNotice(userId ? 'Tournament room synced.' : 'Saved on this device.')
    setNotice(`${winner} advanced in ${updated.name}${score ? ` with ${score}` : ''}.`)
  }

  async function clearMatchResult(matchId: string) {
    if (!selectedRecord) return
    const updated = await clearTiqTournamentMatchResultForUser(selectedRecord.id, matchId, userId)
    if (!updated) return

    refreshRecords(updated.id)
    setScoreInputs(buildScoreInputState(updated))
    setScheduleInputs(buildScheduleInputState(updated))
    setSyncNotice(userId ? 'Tournament room synced.' : 'Saved on this device.')
    setNotice('Match result cleared.')
  }

  async function updateMatchSchedule(matchId: string) {
    if (!selectedRecord) return
    const schedule = scheduleInputs[matchId] || selectedRecord.schedule[matchId] || { date: '', time: '', court: '' }
    const updated = await updateTiqTournamentMatchScheduleForUser({
      tournamentId: selectedRecord.id,
      matchId,
      date: schedule.date,
      time: schedule.time,
      court: schedule.court,
    }, userId)
    if (!updated) {
      setNotice('That schedule could not be saved. Check the draw and try again.')
      return
    }

    refreshRecords(updated.id)
    setScheduleInputs(buildScheduleInputState(updated))
    setSyncNotice(userId ? 'Tournament room synced.' : 'Saved on this device.')
    setNotice('Match schedule saved.')
  }

  function updateScheduleInput(matchId: string, key: 'date' | 'time' | 'court', value: string) {
    setScheduleInputs((current) => ({
      ...current,
      [matchId]: {
        date: current[matchId]?.date ?? selectedRecord?.schedule[matchId]?.date ?? '',
        time: current[matchId]?.time ?? selectedRecord?.schedule[matchId]?.time ?? '',
        court: current[matchId]?.court ?? selectedRecord?.schedule[matchId]?.court ?? '',
        [key]: value,
      },
    }))
  }

  useEffect(() => {
    let active = true

    async function loadAwards() {
      if (!selectedRecordId) {
        setCloudAwardRecords([])
        return
      }

      const result = await loadTiqAwardsForSource('tournament', selectedRecordId)
      if (!active) return
      setCloudAwardRecords(result.data)
    }

    void loadAwards()

    return () => {
      active = false
    }
  }, [selectedRecordId, awardRefresh])

  async function issueAwards() {
    if (!selectedRecord) return

    const savedAwards = (await Promise.all(awardCandidates
      .map((candidate) => {
        const recipientName = awardRecipients[candidate.placement]?.trim()
        if (!recipientName) return null
        return saveTiqAwardRecordForUser({
          sourceType: 'tournament',
          sourceId: selectedRecord.id,
          sourceName: selectedRecord.name,
          recipientName,
          recipientPlayerId: selectedRecord.entrantPlayerIds[recipientName] || '',
          placement: candidate.placement,
          title: candidate.label,
          subtitle: selectedRecord.locationLabel
            ? `${selectedRecord.locationLabel}${selectedRecord.startsOn ? ` - ${selectedRecord.startsOn}` : ''}`
            : selectedRecord.startsOn || 'Tournament finish',
          coordinatorName: '',
          notes: selectedRecord.directorNotes,
        }, userId)
      })))
      .map((result) => result?.data || null)
      .filter((award): award is TiqAwardRecord => Boolean(award))

    setAwardRefresh((current) => current + 1)
    if (savedAwards.length) {
      setAlertKind('recap')
      setAlertBody(buildTournamentAwardRecapBody(selectedRecord, savedAwards))
    }
    setNotice(savedAwards.length ? `${savedAwards.length} award${savedAwards.length === 1 ? '' : 's'} ready to print, email, or send as a recap.` : 'Add at least one recipient before creating awards.')
  }

  function updateAwardRecipient(placement: TiqAwardPlacement, value: string) {
    setAwardRecipients((current) => ({ ...current, [placement]: value }))
  }

  function draftAwardRecapAlert() {
    if (!selectedRecord || !awardRecords.length) return
    setAlertKind('recap')
    setAlertBody(buildTournamentAwardRecapBody(selectedRecord, awardRecords))
    if (typeof window !== 'undefined') window.location.hash = 'tournament-alerts'
    setNotice('Award recap is ready in tournament alerts.')
  }

  async function saveParticipantContact(entrant: string) {
    if (!selectedRecord) return
    const input = contactInputs[entrant] || selectedRecord.contacts[entrant] || { phone: '', smsOptIn: false, consentNote: '' }
    const updated = await updateTiqTournamentParticipantContactForUser({
      tournamentId: selectedRecord.id,
      entrantName: entrant,
      phone: input.phone,
      smsOptIn: input.smsOptIn,
      consentNote: input.consentNote,
    }, userId)
    if (!updated) {
      setNotice('That participant contact could not be saved.')
      return
    }

    refreshRecords(updated.id)
    setContactInputs(buildContactInputState(updated))
    setSyncNotice(userId ? 'Tournament room synced.' : 'Saved on this device.')
    setNotice(`${entrant} alert settings saved.`)
  }

  async function saveAlertDraft() {
    if (!selectedRecord || alertSaving) return
    if (!userId) {
      setNotice('Sign in before saving tournament alert drafts.')
      return
    }

    setAlertSaving(true)
    setNotice('')

    try {
      const result = await saveTiqTournamentAlertRecordForUser({
        tournamentId: selectedRecord.id,
        kind: alertKind,
        message: alertDraft,
        siteUrl: `https://www.tenaceiq.com/tournaments/${encodeURIComponent(selectedRecord.id)}`,
        recipientCount: selectedRecord.entrants.length,
        optedInCount,
      }, userId)

      if (result.error) throw result.error
      await refreshAlertAudit(selectedRecord.id)
      setNotice(result.data ? 'Alert draft saved with consent counts and opt-out language.' : 'Alert draft saved.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Alert draft could not be saved.')
    } finally {
      setAlertSaving(false)
    }
  }

  async function queueAlertDraft(alert: TiqTournamentAlertRecord) {
    if (alertQueueingId) return
    setAlertQueueingId(alert.id)
    setNotice('')

    try {
      const result = await queueTiqTournamentAlertRecordForUser(alert.id)
      if (result.error) throw result.error
      if (!result.data) throw new Error('Only draft alerts can be queued.')
      await refreshAlertAudit(alert.tournamentId)
      setNotice('Alert queued for delivery readiness. Live SMS is still off until provider compliance is connected.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Alert draft could not be queued.')
    } finally {
      setAlertQueueingId('')
    }
  }

  async function refreshAlertAudit(tournamentId = selectedRecordId) {
    if (!tournamentId || !userId) {
      setAlertRecords([])
      setPreferenceEvents([])
      return
    }

    const [alertResult, preferenceResult] = await Promise.all([
      loadTiqTournamentAlertRecordsForUser(tournamentId),
      loadTiqTournamentPreferenceEventsForUser(tournamentId),
    ])
    setAlertRecords(alertResult.data)
    setAlertCounts((current) => ({ ...current, [tournamentId]: alertResult.data.length }))
    setPreferenceEvents(preferenceResult.data)
  }

  async function previewAlertDelivery(alert: TiqTournamentAlertRecord) {
    if (alertPreviewingId) return
    setAlertPreviewingId(alert.id)
    setNotice('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setNotice('Sign in before previewing tournament alert delivery.')
        return
      }

      const response = await fetch('/api/tournaments/alerts/preview', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ alertId: alert.id }),
      })
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean
        message?: string
        optedInCount?: number
        expectedRecipientCount?: number
        note?: string
        recipients?: Array<{ entrantName?: string; phone?: string }>
        skippedRecipients?: Array<{ entrantName?: string; phone?: string; reason?: string }>
      } | null

      if (!response.ok || !body?.ok) {
        throw new Error(body?.message || 'Alert delivery preview failed.')
      }

      setAlertDeliveryPreview({
        alertId: alert.id,
        optedInCount: body.optedInCount || 0,
        expectedRecipientCount: body.expectedRecipientCount || 0,
        note: body.note || 'No SMS was sent.',
        recipients: (body.recipients || []).map((recipient) => ({
          entrantName: recipient.entrantName || 'Participant',
          phone: recipient.phone || '',
        })),
        skippedRecipients: (body.skippedRecipients || []).map((recipient) => ({
          entrantName: recipient.entrantName || 'Participant',
          phone: recipient.phone || '',
          reason: recipient.reason || 'not ready',
        })),
      })
      setNotice('Sandbox delivery preview ready. No SMS was sent.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Alert delivery preview failed.')
    } finally {
      setAlertPreviewingId('')
    }
  }

  async function syncEntrantPlayerProfiles() {
    if (!selectedRecord || profileSyncing) return
    setProfileSyncing(true)
    setNotice('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setNotice('Sign in before creating TIQ player profiles from tournament entrants.')
        return
      }

      const response = await fetch('/api/tournaments/entrants/profiles', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entrants: selectedRecord.entrants,
          selfRating: 3.5,
        }),
      })
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; entrantPlayerIds?: Record<string, string> } | null

      if (!response.ok || !body?.ok || !body.entrantPlayerIds) {
        throw new Error(body?.message || 'Unable to create tournament player profiles.')
      }

      const updated = await updateTiqTournamentEntrantPlayerIdsForUser(selectedRecord.id, body.entrantPlayerIds, userId)
      if (!updated) throw new Error('Player profiles were created, but the tournament could not be linked.')

      refreshRecords(updated.id)
      setSyncNotice(userId ? 'Tournament room synced.' : 'Saved on this device.')
      setNotice(`${Object.keys(body.entrantPlayerIds).length} entrant profile${Object.keys(body.entrantPlayerIds).length === 1 ? '' : 's'} ready for TIQ ratings and awards.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to create tournament player profiles.')
    } finally {
      setProfileSyncing(false)
    }
  }

  async function approveTournamentEntry(entry: TiqTournamentEntryRecord) {
    if (!selectedRecord || entrySyncingId) return
    setEntrySyncingId(entry.id)
    setNotice('')

    try {
      const entrantName = entry.playerName.trim()
      const entrants = selectedRecord.entrants.includes(entrantName)
        ? selectedRecord.entrants
        : [...selectedRecord.entrants, entrantName]
      const nextRecord: TiqTournamentRecord = {
        ...selectedRecord,
        entrants,
        contacts: {
          ...selectedRecord.contacts,
          [entrantName]: {
            name: entrantName,
            phone: entry.phone,
            smsOptIn: entry.smsOptIn,
            consentNote: entry.consentNote || (entry.smsOptIn ? 'Public tournament entry opt-in' : ''),
            updatedAt: new Date().toISOString(),
          },
        },
        updatedAt: new Date().toISOString(),
      }

      let saved = await saveTiqTournamentRecord(nextRecord, userId)
      let linkedPlayerId = entry.linkedPlayerId
      let profileWarning = ''

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.access_token) {
        try {
          const response = await fetch('/api/tournaments/entrants/profiles', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              entrants: [entrantName],
              selfRating: entry.selfRating,
            }),
          })
          const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string; entrantPlayerIds?: Record<string, string> } | null

          if (!response.ok || !body?.ok) {
            throw new Error(body?.message || 'TIQ profile could not be created yet.')
          }

          linkedPlayerId = body.entrantPlayerIds?.[entrantName] || ''
          if (linkedPlayerId) {
            const updatedWithProfile = await updateTiqTournamentEntrantPlayerIdsForUser(selectedRecord.id, {
              ...selectedRecord.entrantPlayerIds,
              [entrantName]: linkedPlayerId,
            }, userId)
            if (updatedWithProfile) saved = { data: updatedWithProfile, error: null, source: userId ? 'cloud' : 'local' }
          }
        } catch (error) {
          profileWarning = error instanceof Error ? error.message : 'TIQ profile could not be created yet.'
        }
      } else {
        profileWarning = 'Sign in again to create the linked TIQ profile.'
      }

      const statusResult = await updateTiqTournamentEntryStatus(entry.id, 'approved', linkedPlayerId || null)
      if (statusResult.error) throw statusResult.error

      refreshRecords(saved.data.id)
      setEntrantsText(saved.data.entrants.join('\n'))
      setContactInputs(buildContactInputState(saved.data))
      await refreshTournamentEntries(saved.data.id)
      setSyncNotice(userId ? 'Tournament room synced.' : 'Saved on this device.')
      setNotice(`${entrantName} joined the draw${linkedPlayerId ? ' and has a self-rated TIQ profile.' : '.'}${profileWarning ? ` ${profileWarning}` : ''}`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'That entry could not be approved.')
    } finally {
      setEntrySyncingId('')
    }
  }

  async function declineTournamentEntry(entry: TiqTournamentEntryRecord) {
    if (entrySyncingId) return
    setEntrySyncingId(entry.id)
    setNotice('')

    try {
      const result = await updateTiqTournamentEntryStatus(entry.id, 'declined')
      if (result.error) throw result.error
      await refreshTournamentEntries(entry.tournamentId)
      setNotice(`${entry.playerName} was declined from the entry queue.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'That entry could not be declined.')
    } finally {
      setEntrySyncingId('')
    }
  }

  function updateContactInput(entrant: string, key: 'phone' | 'smsOptIn' | 'consentNote', value: string | boolean) {
    setContactInputs((current) => ({
      ...current,
      [entrant]: {
        phone: current[entrant]?.phone ?? selectedRecord?.contacts[entrant]?.phone ?? '',
        smsOptIn: current[entrant]?.smsOptIn ?? selectedRecord?.contacts[entrant]?.smsOptIn ?? false,
        consentNote: current[entrant]?.consentNote ?? selectedRecord?.contacts[entrant]?.consentNote ?? '',
        [key]: value,
      },
    }))
  }

  function focusParticipantContact(entrant: string, reason: string) {
    setHighlightedContact(entrant)
    setNotice(reason === 'missing phone'
      ? `Add a phone number for ${entrant}, then save contact.`
      : `Confirm SMS opt-in for ${entrant}, then save contact.`)

    window.requestAnimationFrame(() => {
      document.getElementById(buildContactCardId(entrant))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  function loadRecord(record: TiqTournamentRecord) {
    setSelectedId(record.id)
    setName(record.name)
    setFormat(record.format)
    setEntrantType(record.entrantType)
    setStartsOn(record.startsOn)
    setLocationLabel(record.locationLabel)
    setDirectorNotes(record.directorNotes)
    setEntrantsText(record.entrants.join('\n'))
    setIsPublic(record.isPublic)
    setScoreInputs(buildScoreInputState(record))
    setScheduleInputs(buildScheduleInputState(record))
    setContactInputs(buildContactInputState(record))
    setAwardRecipients(buildAwardRecipientState(record))
    setAwardRefresh((current) => current + 1)
    setNotice('')
  }

  function loadRecordSection(record: TiqTournamentRecord, sectionId: string) {
    loadRecord(record)
    window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function startNew() {
    setSelectedId('')
    setName('Saturday Smash')
    setFormat('single_elimination')
    setEntrantType('players')
    setStartsOn('')
    setLocationLabel('')
    setDirectorNotes('')
    setEntrantsText(sampleEntrants.join('\n'))
    setIsPublic(false)
    setScoreInputs({})
    setScheduleInputs({})
    setContactInputs({})
    setAlertBody('')
    setAlertKind('court_ready')
    setAwardRecipients({ first: '', second: '', third: '' })
    setAwardRefresh((current) => current + 1)
    setNotice('')
  }

  async function removeRecord(record: TiqTournamentRecord) {
    const result = await deleteTiqTournamentRecordForUser(record.id, userId)
    refreshRecords(selectedId === record.id ? '' : selectedId)
    if (selectedId === record.id) startNew()
    setSyncNotice(result.source === 'cloud' ? 'Tournament removed.' : 'Removed from this device.')
    if (result.error) setNotice(result.error.message)
  }

  const tournamentHero = (
    <section style={heroStyle}>
      <span aria-hidden="true" style={watermarkStyle} />
      <div style={heroCopyStyle}>
        <div style={eyebrowStyle}>Tournament Desk</div>
        <h1 style={titleStyle}>Run the event without the desk chaos.</h1>
        <p style={textStyle}>
          Create the field, schedule courts, post scores, send alerts, and finish awards from one event desk.
        </p>
        <div style={statGridStyle}>
          <Stat label="Saved events" value={String(records.length)} />
          <Stat label="Active room" value={isFullCourt ? 'Unlimited' : `${Math.max(0, 1 - activeCount)} left`} />
          <Stat label="Preview" value={format === 'round_robin' ? 'Round robin' : 'Bracket'} />
        </div>
        {syncNotice ? <div style={syncNoticeStyle}>{syncNotice}</div> : null}
      </div>
      <div style={heroPanelStyle}>
        <TiqFeatureIcon name="teamRankings" size="lg" variant="surface" />
        <div style={fullCourtPanelCopyStyle}>
          <strong>Full-Court tournament command.</strong>
          <span>Unlimited tournament rooms plus the schedule, score, award, alert, league, and team actions around them.</span>
        </div>
        <div style={fullCourtFeatureGridStyle}>
          <span>Unlimited events</span>
          <span>Award studio</span>
          <span>Participant alerts</span>
          <span>League + team actions</span>
        </div>
      </div>
    </section>
  )

  if (!canUseLeague && authResolved) {
    const primaryHref = role === 'public'
      ? '/join?plan=full_court&next=%2Fleague-coordinator%2Ftournaments'
      : '/pricing'
    const primaryLabel = role === 'public' ? 'Create account' : 'Compare Full-Court'

    return (
      <main style={pageStyle}>
        {tournamentHero}

        <UpgradePrompt
          planId="full_court"
          headline="Unlock Tournament Desk with Full-Court"
          body="Unlimited tournament rooms, shared schedules, entrants, scorebooks, awards, and player alerts live inside Full-Court."
          ctaLabel="Unlock Full-Court"
          compact
        />

        <section style={lockedPreviewStyle} aria-label="Tournament Desk preview">
          <div style={lockedPreviewHeaderStyle}>
            <div>
              <div style={sectionEyebrowStyle}>Full-Court preview</div>
              <h2 style={sectionTitleStyle}>Run the event without a spreadsheet stack.</h2>
            </div>
            <div style={actionRowStyle}>
              <Link href={primaryHref} style={primaryButtonStyle}>{primaryLabel}</Link>
              <Link href="/pricing" style={secondaryButtonStyle}>View plans</Link>
            </div>
          </div>

          <div style={lockedPreviewGridStyle}>
            {lockedTournamentActions.map((action, index) => (
              <article key={action.title} style={lockedPreviewCardStyle}>
                <span style={lockedPreviewIndexStyle}>{index + 1}</span>
                <div style={lockedPreviewCopyStyle}>
                  <strong>{action.title}</strong>
                  <span>{action.detail}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    )
  }

  return (
    <main style={pageStyle}>
      {tournamentHero}

      <section style={tournamentPathStyle} aria-labelledby="tournament-desk-path-title">
        <div style={tournamentPathHeaderStyle}>
          <div>
            <div style={sectionEyebrowStyle}>Tournament Desk path</div>
            <h2 id="tournament-desk-path-title" style={tournamentPathTitleStyle}>{PRODUCT_MOTTO}</h2>
          </div>
          <p style={tournamentPathIntroStyle}>
            Scan the room, then jump to the tournament task that needs attention.
          </p>
        </div>
        <div style={tournamentPathCommandStyle}>
          <div style={tournamentPathStatusPanelStyle}>
            <div style={sectionEyebrowStyle}>Control tower</div>
            <strong style={tournamentPathStatusTitleStyle}>
              {selectedRecord ? 'Keep the event moving.' : 'Build the room first.'}
            </strong>
            <span style={tournamentPathStatusTextStyle}>
              {selectedRecord
                ? 'Use the live scan to see what is ready, then jump directly to entries, profiles, schedule, scores, alerts, or awards.'
                : 'Set the field once, preview the draw, then save the room before courts and results start changing.'}
            </span>
            <div style={tournamentPathStatusGridStyle} aria-label="Tournament Desk status scan">
              {tournamentPathStatusItems.map((item) => (
                <div key={item.label} style={tournamentPathStatusItemStyle}>
                  <span style={item.ready ? readinessDotReadyStyle : readinessDotBlockedStyle} />
                  <strong>{item.label}</strong>
                  <em>{item.value}</em>
                  <span style={tournamentPathStatusDetailStyle}>{item.detail}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={tournamentPathGridStyle}>
            {tournamentPathActions.map((path) => (
              <a
                key={path.job}
                href={path.href}
                style={tournamentPathCardStyle}
                data-tournament-path-job={path.job}
                aria-label={`${path.cta}: ${path.question}`}
              >
                <TiqFeatureIcon name={path.icon} size="sm" variant="ghost" />
                <span style={tournamentPathCopyStyle}>
                  <em>{path.label}</em>
                  <strong>{path.title}</strong>
                  <span>{path.body}</span>
                </span>
                <span style={tournamentPathCtaStyle}>{path.cta}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section style={calendarPanelStyle}>
        <div style={panelHeaderStyle}>
          <div>
            <div style={sectionEyebrowStyle}>Shared calendar</div>
            <h2 style={sectionTitleStyle}>{formatCalendarMonth(calendarMonth)}</h2>
          </div>
          <div style={calendarActionRowStyle}>
            <button type="button" onClick={() => setCalendarMonth(shiftCalendarMonth(calendarMonth, -1))} style={ghostButtonStyle}>
              Prev
            </button>
            <button type="button" onClick={() => setCalendarMonth(new Date().toISOString().slice(0, 7))} style={ghostButtonStyle}>
              Today
            </button>
            <button type="button" onClick={() => setCalendarMonth(shiftCalendarMonth(calendarMonth, 1))} style={ghostButtonStyle}>
              Next
            </button>
          </div>
        </div>

        <div style={calendarShellStyle}>
          <div style={calendarBoardStyle}>
            <div style={weekdayGridStyle}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div style={calendarGridStyle}>
              {calendarDays.map((day) => (
                <div key={day.date} style={{ ...calendarDayStyle, ...(day.inMonth ? null : mutedCalendarDayStyle) }}>
                  <div style={calendarDateStyle}>{Number(day.date.slice(-2))}</div>
                  <div style={calendarEventStackStyle}>
                    {day.events.slice(0, 3).map((event) => (
                      <Link key={event.id} href={`/tournaments/${encodeURIComponent(event.tournamentId)}`} style={calendarEventStyle}>
                        <strong>{event.time || 'TBD'}</strong>
                        <span>{event.sideA} vs {event.sideB}</span>
                        <small>{event.court || event.tournamentName}</small>
                      </Link>
                    ))}
                    {day.events.length > 3 ? <span style={calendarMoreStyle}>+{day.events.length - 3} more</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside style={calendarAgendaStyle} aria-label="Court agenda">
            <div style={calendarAgendaHeaderStyle}>
              <div>
                <div style={sectionEyebrowStyle}>Court agenda</div>
                <h3 style={calendarAgendaTitleStyle}>{scheduledMonthEvents.length ? 'Next scheduled matches' : 'Schedule from the scorebook'}</h3>
              </div>
              <span style={pillStyle}>{scheduledMonthEvents.length ? `${scheduledMonthEvents.length} listed` : 'No slots yet'}</span>
            </div>
            {scheduledMonthEvents.length ? (
              <div style={calendarAgendaListStyle}>
                {scheduledMonthEvents.map((event) => (
                  <Link key={event.id} href={`/tournaments/${encodeURIComponent(event.tournamentId)}`} style={calendarAgendaEventStyle}>
                    <span>{formatCalendarAgendaDate(event)}</span>
                    <strong>{event.sideA} vs {event.sideB}</strong>
                    <small>{event.court || event.tournamentName}</small>
                  </Link>
                ))}
              </div>
            ) : (
              <div style={calendarEmptyStateStyle}>
                <div style={emptySavedRoomCopyStyle}>
                  <strong>Calendar fills from match slots.</strong>
                  <span>Save a tournament, open the scorebook, then add date, time, and court assignments so players know where to go.</span>
                </div>
                <div style={emptySavedRoomActionStyle}>
                  <a href={selectedRecord ? '#tournament-scorebook' : '#tournament-setup'} style={secondaryButtonStyle}>
                    {selectedRecord ? 'Open scorebook' : 'Build room'}
                  </a>
                  <a href="#tournament-setup" style={secondaryButtonStyle}>
                    Set up tournament
                  </a>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      <section style={builderGridStyle}>
        <form id="tournament-setup" style={panelStyle} onSubmit={handleSubmit}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={sectionEyebrowStyle}>{selectedId ? 'Edit tournament' : 'Create tournament'}</div>
              <h2 style={sectionTitleStyle}>{selectedId ? name : 'New tournament'}</h2>
            </div>
            <button type="button" onClick={startNew} style={ghostButtonStyle}>New</button>
          </div>

          <div style={setupReadinessGridStyle} aria-label="Tournament setup readiness">
            {setupReadinessItems.map((item) => (
              <div key={item.label} style={setupReadinessItemStyle}>
                <span style={item.ready ? readinessDotReadyStyle : readinessDotBlockedStyle} />
                <strong>{item.label}</strong>
                <em>{item.value}</em>
              </div>
            ))}
          </div>

          <div style={setupPathStyle} aria-label="Event setup path">
            {setupPathItems.map((item) => (
              <div key={item.label} style={setupPathItemStyle}>
                <span style={item.ready ? setupPathStepReadyStyle : setupPathStepStyle}>{item.step}</span>
                <span style={setupPathCopyStyle}>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
              </div>
            ))}
          </div>

          <div style={fieldGridStyle}>
            <label style={fieldStyle}>
              Tournament name
              <input value={name} onChange={(event) => setName(event.target.value)} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              Start date
              <input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} style={inputStyle} />
            </label>
          </div>

          <div style={segmentedStyle} aria-label="Tournament format">
            {[
              ['single_elimination', 'Single elimination'],
              ['round_robin', 'Round robin'],
              ['compass_draw', 'Compass draw'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFormat(value as TiqTournamentFormat)}
                style={{
                  ...segmentButtonStyle,
                  ...(format === value ? segmentActiveStyle : null),
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={segmentedStyle} aria-label="Entrant type">
            {[
              ['players', 'Players'],
              ['teams', 'Teams'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setEntrantType(value as 'players' | 'teams')}
                style={{
                  ...segmentButtonStyle,
                  ...(entrantType === value ? segmentActiveStyle : null),
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <label style={fieldStyle}>
            Site
            <input
              value={locationLabel}
              onChange={(event) => setLocationLabel(event.target.value)}
              placeholder="Facility or city"
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            Entrants
            <textarea
              value={entrantsText}
              onChange={(event) => setEntrantsText(event.target.value)}
              placeholder="One player or team per line"
              style={textareaStyle}
            />
          </label>

          <label style={fieldStyle}>
            Director notes
            <textarea
              value={directorNotes}
              onChange={(event) => setDirectorNotes(event.target.value)}
              placeholder="Rules, site notes, entry cutoff, or scoring reminders"
              style={{ ...textareaStyle, minHeight: 76 }}
            />
          </label>

          <label style={toggleFieldStyle}>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(event) => setIsPublic(event.target.checked)}
              style={checkboxStyle}
            />
            <span>
              <strong>Public bracket</strong>
              <small>Anyone with the link can view the tournament page.</small>
            </span>
          </label>

          {notice ? <p style={noticeStyle}>{notice}</p> : null}

          <div style={actionRowStyle}>
            <button type="submit" style={primaryButtonStyle}>
              {selectedId ? 'Save tournament' : 'Build tournament'}
            </button>
            {selectedRecord ? (
              <Link href={`/tournaments/${encodeURIComponent(selectedRecord.id)}`} style={secondaryButtonStyle}>
                Open bracket
              </Link>
            ) : null}
            <Link href="/compete/schedule" style={secondaryButtonStyle}>Open calendar</Link>
          </div>
        </form>

        <section style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={sectionEyebrowStyle}>Draw preview</div>
              <h2 style={sectionTitleStyle}>{draftEntrants.length || 0} entrants</h2>
            </div>
            <span style={pillStyle}>{format.replace('_', ' ')}</span>
          </div>

          <div style={previewListStyle}>
            {draftPreview.length ? (
              draftPreview.slice(0, 16).map((match) => (
                <div key={`${match.round}-${match.court}-${match.sideA}-${match.sideB}`} style={matchCardStyle}>
                  <span style={matchMetaStyle}>{match.label} - Court {match.court}</span>
                  <strong>{match.sideA}</strong>
                  <span style={vsStyle}>vs</span>
                  <strong>{match.sideB}</strong>
                  {match.result?.winner ? (
                    <span style={winnerLineStyle}>
                      Winner: {match.result.winner}{match.result.score ? ` (${match.result.score})` : ''}
                    </span>
                  ) : null}
                </div>
              ))
            ) : (
              <div style={emptyStateStyle}>Add at least two entrants to preview the draw.</div>
            )}
          </div>

          {draftPreview.length > 16 ? (
            <div style={smallNoteStyle}>Showing the first 16 matches. Save the event to keep the full field.</div>
          ) : null}
        </section>
      </section>

      {selectedRecord ? (
        <section style={runSheetStyle} aria-label="Tournament run sheet">
          <div style={runSheetHeaderStyle}>
            <div>
              <div style={sectionEyebrowStyle}>Director run sheet</div>
              <h2 style={runSheetTitleStyle}>{selectedRecord.name}</h2>
            </div>
            <Link href={`/tournaments/${encodeURIComponent(selectedRecord.id)}`} style={secondaryButtonStyle}>
              Public view
            </Link>
          </div>
          {directorNextMove ? (
            <a href={directorNextMove.href} style={nextMoveStyle}>
              <span style={nextMoveIndexStyle}>Next</span>
              <div style={nextMoveCopyStyle}>
                <strong>{directorNextMove.label}</strong>
                <small>{directorNextMove.detail}</small>
              </div>
              <span style={nextMoveCtaStyle}>{directorNextMove.cta}</span>
            </a>
          ) : null}
          <div style={finishChecklistStyle} aria-label="Tournament finish checklist">
            {tournamentFinishChecklist.map((item) => (
              <a key={item.label} href={item.href} style={finishChecklistItemStyle}>
                <span style={item.ready ? readinessDotReadyStyle : readinessDotWaitingStyle} />
                <strong>{item.label}</strong>
                <em>{item.value}</em>
              </a>
            ))}
          </div>
          <div style={runSheetGridStyle}>
            {directorFlowItems.map((item, index) => (
              <a key={item.label} href={item.href} style={runSheetCardStyle}>
                <span style={item.ready ? readinessDotReadyStyle : readinessDotBlockedStyle} />
                <small>{index + 1}</small>
                <strong>{item.label}</strong>
                <em>{item.value}</em>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {selectedRecord ? (
        <section id="tournament-entries" style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={sectionEyebrowStyle}>Entry queue</div>
              <h2 style={sectionTitleStyle}>{pendingEntries.length} pending</h2>
            </div>
            <span style={pillStyle}>{selectedRecord.isPublic ? 'Public entry' : 'Private draw'}</span>
          </div>

          <div style={entryCommandStyle} aria-label="Entry command">
            {entryCommandItems.map((item) => (
              <a key={item.label} href={item.href} style={entryCommandItemStyle}>
                <span style={item.ready ? readinessDotReadyStyle : readinessDotWaitingStyle} aria-hidden="true" />
                <span style={entryCommandCopyStyle}>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                <span style={entryCommandValueStyle}>{item.value}</span>
              </a>
            ))}
          </div>

          {selectedRecord.isPublic ? (
            <div style={entryQueueGridStyle}>
              {pendingEntries.length ? pendingEntries.map((entry) => (
                <div key={entry.id} style={entryQueueCardStyle}>
                  <div style={entryQueueTopStyle}>
                    <div>
                      <strong>{entry.playerName}</strong>
                      <div style={smallNoteStyle}>
                        Self-rated {entry.selfRating.toFixed(1)} S{entry.smsOptIn ? ' - SMS opt-in' : ''}
                      </div>
                    </div>
                    <span style={pillStyle}>Pending</span>
                  </div>
                  <div style={entryContactLineStyle}>
                    <span>{entry.email || 'No email'}</span>
                    <span>{entry.phone || 'No phone'}</span>
                  </div>
                  <div style={actionRowStyle}>
                    <button
                      type="button"
                      onClick={() => approveTournamentEntry(entry)}
                      disabled={Boolean(entrySyncingId)}
                      style={{ ...secondaryButtonStyle, ...(entrySyncingId ? disabledButtonStyle : null) }}
                    >
                      {entrySyncingId === entry.id ? 'Approving...' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      onClick={() => declineTournamentEntry(entry)}
                      disabled={Boolean(entrySyncingId)}
                      style={{ ...ghostButtonStyle, ...(entrySyncingId ? disabledButtonStyle : null) }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              )) : (
                <div style={tournamentActionEmptyStyle}>
                  <div style={emptySavedRoomCopyStyle}>
                    <strong>Entry queue is clear.</strong>
                    <span>Share the public bracket link when registration opens, then approve players into the draw.</span>
                  </div>
                  <div style={emptySavedRoomActionStyle}>
                    <Link href={`/tournaments/${encodeURIComponent(selectedRecord.id)}`} style={secondaryButtonStyle}>
                      Public bracket
                    </Link>
                    <a href="#tournament-alerts" style={secondaryButtonStyle}>
                      Draft update
                    </a>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={tournamentActionEmptyStyle}>
              <div style={emptySavedRoomCopyStyle}>
                <strong>Private draw.</strong>
                <span>Turn on public registration in setup when you want players to request entry from the bracket page.</span>
              </div>
              <div style={emptySavedRoomActionStyle}>
                <a href="#tournament-setup" style={secondaryButtonStyle}>
                  Open setup
                </a>
                <Link href={`/tournaments/${encodeURIComponent(selectedRecord.id)}`} style={secondaryButtonStyle}>
                  Preview bracket
                </Link>
              </div>
            </div>
          )}

          {recentEntries.length ? (
            <div style={recentEntryListStyle}>
              {recentEntries.map((entry) => (
                <span key={entry.id} style={recentEntryPillStyle}>
                  {entry.playerName} - {entry.status}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {selectedRecord ? (
        <section id="tournament-scorebook" style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={sectionEyebrowStyle}>Tournament scorebook</div>
              <h2 style={sectionTitleStyle}>{selectedRecord.name}</h2>
            </div>
            <span style={pillStyle}>
              {selectedSummary?.champion ? `Champion: ${selectedSummary.champion}` : `${selectedSummary?.openMatches ?? 0} open`}
            </span>
          </div>

          <div style={recordMetricGridStyle}>
            <Stat label="Completed" value={`${selectedSummary?.completedMatches ?? 0}/${selectedSummary?.totalMatches ?? 0}`} compact />
            <Stat label="Open" value={String(selectedSummary?.openMatches ?? 0)} compact />
          </div>

          <div style={scorebookCommandStyle} aria-label="Scorebook command">
            {scorebookCommandItems.map((item) => (
              <a key={item.label} href={item.href} style={scorebookCommandItemStyle}>
                <span style={item.ready ? readinessDotReadyStyle : readinessDotWaitingStyle} aria-hidden="true" />
                <span style={scorebookCommandCopyStyle}>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                <span style={scorebookCommandValueStyle}>{item.value}</span>
              </a>
            ))}
          </div>

          {selectedStandings.length ? (
            <section style={standingsPanelStyle}>
              <div style={sectionEyebrowStyle}>Round-robin standings</div>
              <div style={standingsListStyle}>
                {selectedStandings.map((row, index) => (
                  <div key={row.entrant} style={standingsRowStyle}>
                    <span style={standingsRankStyle}>{index + 1}</span>
                    <strong>{row.entrant}</strong>
                    <span>{row.wins}-{row.losses}</span>
                    <span>{row.winPct}%</span>
                    <span>{formatGameDiff(row.gameDiff)}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div style={scorebookListStyle}>
            {selectedPreview.map((match) => {
              const sideAPlayable = match.sideA !== 'Bye' && !match.sideA.startsWith('Winner ')
              const sideBPlayable = match.sideB !== 'Bye' && !match.sideB.startsWith('Winner ')
              const canRecord = sideAPlayable && sideBPlayable
              const schedule = scheduleInputs[match.id] || match.schedule || { date: '', time: '', court: '' }
              const matchScheduleReady = Boolean(match.schedule?.date || match.schedule?.time || match.schedule?.court)
              const matchResultReady = Boolean(match.result?.winner)
              const matchFollowThroughItems = [
                {
                  label: 'Slot',
                  value: matchScheduleReady ? 'Set' : 'TBD',
                  ready: matchScheduleReady,
                },
                {
                  label: 'Players',
                  value: canRecord ? 'Ready' : 'Locked',
                  ready: canRecord,
                },
                {
                  label: 'Result',
                  value: matchResultReady ? 'Logged' : 'Open',
                  ready: matchResultReady,
                },
              ]
              const matchPrimaryLabel = !matchScheduleReady
                ? 'Save slot'
                : matchResultReady
                  ? 'Review result'
                  : canRecord
                    ? 'Record winner'
                    : 'Await players'
              return (
                <div key={match.id} style={scorebookMatchStyle}>
                  <span style={matchMetaStyle}>{match.label} - Court {match.court}</span>
                  <div style={scorebookSidesStyle}>
                    <strong>{match.sideA}</strong>
                    <span style={vsStyle}>vs</span>
                    <strong>{match.sideB}</strong>
                  </div>
                  {match.schedule?.date || match.schedule?.time || match.schedule?.court ? (
                    <div style={scheduleBannerStyle}>{formatMatchSchedule(match.schedule)}</div>
                  ) : null}
                  <div style={matchFollowThroughGridStyle}>
                    {matchFollowThroughItems.map((item) => (
                      <div key={item.label} style={matchFollowThroughItemStyle}>
                        <span style={item.ready ? readinessDotReadyStyle : readinessDotWaitingStyle} aria-hidden="true" />
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                    <span style={matchPrimaryActionStyle}>{matchPrimaryLabel}</span>
                  </div>
                  <div style={scheduleGridStyle}>
                    <label style={compactFieldStyle}>
                      Date
                      <input
                        type="date"
                        value={schedule.date}
                        onChange={(event) => updateScheduleInput(match.id, 'date', event.target.value)}
                        style={scoreInputStyle}
                      />
                    </label>
                    <label style={compactFieldStyle}>
                      Time
                      <input
                        type="time"
                        value={schedule.time}
                        onChange={(event) => updateScheduleInput(match.id, 'time', event.target.value)}
                        style={scoreInputStyle}
                      />
                    </label>
                    <label style={compactFieldStyle}>
                      Court
                      <input
                        value={schedule.court}
                        onChange={(event) => updateScheduleInput(match.id, 'court', event.target.value)}
                        placeholder="Court 1"
                        style={scoreInputStyle}
                      />
                    </label>
                    <button type="button" onClick={() => updateMatchSchedule(match.id)} style={secondaryButtonStyle}>
                      Save slot
                    </button>
                  </div>
                  {match.result?.winner ? (
                    <div style={resultBannerStyle}>
                      Winner: {match.result.winner}{match.result.score ? ` - ${match.result.score}` : ''}
                    </div>
                  ) : canRecord ? (
                    <div style={smallNoteStyle}>Waiting for result.</div>
                  ) : (
                    <div style={smallNoteStyle}>Complete earlier matches to unlock this slot.</div>
                  )}
                  <label style={scoreFieldStyle}>
                    <span>Score</span>
                    <input
                      value={scoreInputs[match.id] ?? match.result?.score ?? ''}
                      onChange={(event) => {
                        const nextScore = event.target.value
                        setScoreInputs((current) => ({ ...current, [match.id]: nextScore }))
                      }}
                      placeholder="6-4 6-4"
                      disabled={!canRecord}
                      style={{ ...scoreInputStyle, ...(!canRecord ? disabledInputStyle : null) }}
                    />
                  </label>
                  <div style={actionRowStyle}>
                    <button
                      type="button"
                      disabled={!canRecord}
                      onClick={() => updateMatchResult(match.id, match.sideA)}
                      style={{ ...secondaryButtonStyle, ...(!canRecord ? disabledButtonStyle : null) }}
                    >
                      {match.sideA}
                    </button>
                    <button
                      type="button"
                      disabled={!canRecord}
                      onClick={() => updateMatchResult(match.id, match.sideB)}
                      style={{ ...secondaryButtonStyle, ...(!canRecord ? disabledButtonStyle : null) }}
                    >
                      {match.sideB}
                    </button>
                    {match.result?.winner ? (
                      <button type="button" onClick={() => clearMatchResult(match.id)} style={ghostButtonStyle}>
                        Clear
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {selectedRecord ? (
        <section id="tournament-alerts" style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={sectionEyebrowStyle}>Tournament alerts</div>
              <h2 style={sectionTitleStyle}>{optedInCount}/{selectedRecord.entrants.length} opted in</h2>
            </div>
            <span style={pillStyle}>Draft only</span>
          </div>

          <div style={alertCommandStyle} aria-label="Alert command">
            {alertCommandItems.map((item) => (
              <a key={item.label} href={item.href} style={alertCommandItemStyle}>
                <span style={item.ready ? readinessDotReadyStyle : readinessDotWaitingStyle} aria-hidden="true" />
                <span style={alertCommandCopyStyle}>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                <span style={alertCommandValueStyle}>{item.value}</span>
              </a>
            ))}
          </div>

          <div style={sendReadinessStyle}>
            <div>
              <div style={sectionEyebrowStyle}>Send readiness</div>
              <div style={sendReadinessTextStyle}>
                {providerState.blocker || 'Provider is ready for the next live delivery checkpoint.'}
              </div>
            </div>
            <div style={sendReadinessGridStyle}>
              {sendReadinessItems.map((item) => (
                <div key={item.label} style={sendReadinessItemStyle}>
                  <span style={item.ready ? readinessDotReadyStyle : readinessDotBlockedStyle} />
                  <strong>{item.label}</strong>
                  <em>{item.value}</em>
                </div>
              ))}
            </div>
          </div>

          <div style={contactGridStyle}>
            {selectedRecord.entrants.map((entrant) => {
              const contact = contactInputs[entrant] || selectedRecord.contacts[entrant] || { phone: '', smsOptIn: false, consentNote: '' }
              return (
                <div
                  id={buildContactCardId(entrant)}
                  key={entrant}
                  style={{
                    ...contactCardStyle,
                    ...(highlightedContact === entrant ? highlightedContactCardStyle : null),
                  }}
                >
                  <strong>{entrant}</strong>
                  <label style={compactFieldStyle}>
                    Phone
                    <input
                      value={contact.phone}
                      onChange={(event) => updateContactInput(entrant, 'phone', event.target.value)}
                      placeholder="(555) 555-5555"
                      style={scoreInputStyle}
                    />
                  </label>
                  <label style={toggleFieldStyle}>
                    <input
                      type="checkbox"
                      checked={contact.smsOptIn}
                      onChange={(event) => updateContactInput(entrant, 'smsOptIn', event.target.checked)}
                      style={checkboxStyle}
                    />
                    <span>
                      <strong>SMS opt-in confirmed</strong>
                      <small>Participant agreed to tournament alerts from TenAceIQ.</small>
                    </span>
                  </label>
                  <label style={compactFieldStyle}>
                    Consent note
                    <input
                      value={contact.consentNote}
                      onChange={(event) => updateContactInput(entrant, 'consentNote', event.target.value)}
                      placeholder="Online signup, paper form, or desk check-in"
                      style={scoreInputStyle}
                    />
                  </label>
                  <button type="button" onClick={() => saveParticipantContact(entrant)} style={secondaryButtonStyle}>
                    Save contact
                  </button>
                </div>
              )
            })}
          </div>

          <div style={alertComposerStyle}>
            <div style={segmentedStyle} aria-label="Alert type">
              {[
                ['rules', 'Rules'],
                ['court_ready', 'Court ready'],
                ['schedule_change', 'Schedule'],
                ['recap', 'Recap'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAlertKind(value as typeof alertKind)}
                  style={{
                    ...segmentButtonStyle,
                    ...(alertKind === value ? segmentActiveStyle : null),
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <label style={fieldStyle}>
              Message
              <textarea
                value={alertBody}
                onChange={(event) => setAlertBody(event.target.value)}
                placeholder="Add the tournament update. The link and opt-out line are added automatically."
                style={{ ...textareaStyle, minHeight: 82 }}
              />
            </label>
            <div style={alertPreviewStyle}>{alertDraft}</div>
            <div style={actionRowStyle}>
              <button
                type="button"
                onClick={saveAlertDraft}
                disabled={alertSaving || !selectedRecord.entrants.length}
                style={{ ...secondaryButtonStyle, ...(alertSaving || !selectedRecord.entrants.length ? disabledButtonStyle : null) }}
              >
                {alertSaving ? 'Saving...' : 'Save alert draft'}
              </button>
              <span style={smallNoteStyle}>{alertRecords.length} saved draft{alertRecords.length === 1 ? '' : 's'}</span>
            </div>
            <div style={smallNoteStyle}>
              {providerState.blocker || 'Delivery previews remain review-only until a live send action is approved.'}
            </div>
            {alertRecords.length ? (
              <div style={alertQueuePanelStyle}>
                <div style={alertQueueHeaderStyle}>
                  <div>
                    <div style={sectionEyebrowStyle}>Delivery queue</div>
                    <strong>{queuedAlertCount} queued</strong>
                  </div>
                  <div style={alertQueueStatsStyle} aria-label="Alert queue status">
                    <span>{draftAlertCount} draft</span>
                    <span>{queuedAlertCount} queued</span>
                    <span>{sentAlertCount} sent</span>
                  </div>
                </div>
                <div style={alertHistoryStyle}>
                {visibleAlertRecords.map((alert) => (
                  <div key={alert.id} style={alertHistoryItemStyle}>
                    <div style={alertHistoryCopyStyle}>
                      <div style={alertHistoryTitleStyle}>
                        <strong>{formatAlertKind(alert.kind)}</strong>
                        <span style={getAlertStatusStyle(alert.status)}>{formatAlertStatus(alert.status)}</span>
                      </div>
                      <span>{alert.optedInCount}/{alert.recipientCount} opted in - {formatAlertTimestamp(alert.queuedAt || alert.updatedAt || alert.createdAt)}</span>
                      <small>{buildAlertMessageSnippet(alert.message)}</small>
                      {alert.deliveryNote ? <small>{alert.deliveryNote}</small> : null}
                    </div>
                    {alert.status === 'draft' ? (
                      <button
                        type="button"
                        onClick={() => queueAlertDraft(alert)}
                        disabled={Boolean(alertQueueingId)}
                        style={{ ...ghostButtonStyle, ...(alertQueueingId ? disabledButtonStyle : null) }}
                      >
                        {alertQueueingId === alert.id ? 'Queueing...' : 'Queue'}
                      </button>
                    ) : null}
                    {alert.status === 'queued' ? (
                      <button
                        type="button"
                        onClick={() => previewAlertDelivery(alert)}
                        disabled={Boolean(alertPreviewingId)}
                        style={{ ...secondaryButtonStyle, ...(alertPreviewingId ? disabledButtonStyle : null) }}
                      >
                        {alertPreviewingId === alert.id ? 'Previewing...' : 'Preview delivery'}
                      </button>
                    ) : null}
                    {alertDeliveryPreview?.alertId === alert.id ? (
                      <div style={alertPreviewResultStyle}>
                        <strong>{alertDeliveryPreview.optedInCount}/{alertDeliveryPreview.expectedRecipientCount} recipients ready.</strong>
                        <span>{alertDeliveryPreview.note}</span>
                        {alertDeliveryPreview.recipients.length ? (
                          <div style={alertRecipientPreviewListStyle}>
                            {alertDeliveryPreview.recipients.slice(0, 6).map((recipient) => (
                              <span key={`${recipient.entrantName}-${recipient.phone}`} style={alertRecipientPreviewPillStyle}>
                                {recipient.entrantName} - {recipient.phone}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span>No opted-in recipients found.</span>
                        )}
                        {alertDeliveryPreview.skippedRecipients.length ? (
                          <div style={alertSkippedPreviewListStyle}>
                            <strong>Skipped</strong>
                            {alertDeliveryPreview.skippedRecipients.slice(0, 6).map((recipient) => (
                              <button
                                key={`${recipient.entrantName}-${recipient.reason}`}
                                type="button"
                                onClick={() => focusParticipantContact(recipient.entrantName, recipient.reason)}
                                style={alertSkippedPreviewPillStyle}
                              >
                                {recipient.entrantName} - {recipient.reason === 'missing phone' ? 'Add phone' : 'Confirm opt-in'}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
                </div>
                {alertRecords.length > visibleAlertRecords.length ? (
                  <div style={smallNoteStyle}>{alertRecords.length - visibleAlertRecords.length} older alert{alertRecords.length - visibleAlertRecords.length === 1 ? '' : 's'} hidden.</div>
                ) : null}
              </div>
            ) : null}
            <div style={preferenceAuditStyle}>
              <div style={sectionEyebrowStyle}>Consent audit</div>
              {preferenceEvents.length ? preferenceEvents.slice(0, 5).map((event) => (
                <div key={event.id} style={preferenceAuditItemStyle}>
                  <strong>{event.playerName}</strong>
                  <span>{event.action === 'opt_in' ? 'Opted in' : 'Opted out'} - {event.phone}</span>
                  <small>{event.consentNote || formatPreferenceSource(event.source)}</small>
                </div>
              )) : (
                <div style={smallNoteStyle}>Preference changes from tournament links will appear here.</div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {selectedRecord ? (
        <section id="tournament-profiles" style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={sectionEyebrowStyle}>Player profiles</div>
              <h2 style={sectionTitleStyle}>{profileReadyCount}/{selectedRecord.entrants.length} TIQ-ready</h2>
            </div>
            <button type="button" onClick={syncEntrantPlayerProfiles} disabled={profileSyncing} style={{ ...secondaryButtonStyle, ...(profileSyncing ? disabledButtonStyle : null) }}>
              {profileSyncing ? 'Creating...' : 'Create TIQ profiles'}
            </button>
          </div>

          <div style={profileCommandStyle} aria-label="Profile command">
            {profileCommandItems.map((item) => (
              <a key={item.label} href={item.href} style={profileCommandItemStyle}>
                <span style={item.ready ? readinessDotReadyStyle : readinessDotWaitingStyle} aria-hidden="true" />
                <span style={profileCommandCopyStyle}>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                <span style={profileCommandValueStyle}>{item.value}</span>
              </a>
            ))}
          </div>

          <div style={profileLinkGridStyle}>
            {selectedRecord.entrants.map((entrant) => {
              const playerId = selectedRecord.entrantPlayerIds[entrant]
              return (
                <div key={entrant} style={profileLinkRowStyle}>
                  <strong>{entrant}</strong>
                  {playerId ? (
                    <Link href={`/players/${encodeURIComponent(playerId)}`} style={secondaryButtonStyle}>
                      Open profile
                    </Link>
                  ) : (
                    <span style={smallNoteStyle}>Self-rated profile not created yet.</span>
                  )}
                </div>
              )
            })}
          </div>
          <div style={smallNoteStyle}>
            New entrants start self-rated with an S until verified match or TennisLink data replaces the rating source.
          </div>
        </section>
      ) : null}

      {selectedRecord ? (
        <section id="tournament-awards" style={panelStyle}>
          <div style={panelHeaderStyle}>
            <div>
              <div style={sectionEyebrowStyle}>Award studio</div>
              <h2 style={sectionTitleStyle}>Print-ready honors</h2>
            </div>
            <span style={pillStyle}>{awardRecords.length ? `${awardRecords.length} issued` : 'Ready'}</span>
          </div>

          <p style={smallNoteStyle}>
            Issue TenAceIQ-branded awards for podium finishers. Winners can print certificates, email them, and carry the badge into their trophy case.
          </p>

          <div style={awardCommandStyle} aria-label="Award command">
            {awardCommandItems.map((item) => (
              <a key={item.label} href={item.href} style={awardCommandItemStyle}>
                <span style={item.ready ? readinessDotReadyStyle : readinessDotWaitingStyle} aria-hidden="true" />
                <span style={awardCommandCopyStyle}>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                <span style={awardCommandValueStyle}>{item.value}</span>
              </a>
            ))}
          </div>

          <div style={awardSetupGridStyle}>
            {awardCandidates.map((candidate) => (
              <label key={candidate.placement} style={fieldStyle}>
                {candidate.label}
                <input
                  value={awardRecipients[candidate.placement] || ''}
                  onChange={(event) => updateAwardRecipient(candidate.placement, event.target.value)}
                  placeholder={candidate.placement === 'third' ? 'Enter 3rd place finisher' : 'Winner name'}
                  style={inputStyle}
                />
                <span style={smallNoteStyle}>{candidate.helperText}</span>
                {candidate.recipientOptions.length ? (
                  <span style={awardChoiceRowStyle}>
                    {candidate.recipientOptions.map((option) => (
                      <button
                        key={`${candidate.placement}-${option}`}
                        type="button"
                        onClick={() => updateAwardRecipient(candidate.placement, option)}
                        style={{
                          ...awardChoiceButtonStyle,
                          ...(awardRecipients[candidate.placement] === option ? awardChoiceButtonActiveStyle : null),
                        }}
                      >
                        {option}
                      </button>
                    ))}
                  </span>
                ) : null}
              </label>
            ))}
          </div>

          <div style={actionRowStyle}>
            <button type="button" onClick={issueAwards} style={primaryButtonStyle}>
              Create awards
            </button>
            {awardRecords.length ? (
              <button type="button" onClick={draftAwardRecapAlert} style={secondaryButtonStyle}>
                Draft recap alert
              </button>
            ) : null}
          </div>

          {awardRecords.length ? (
            <div style={awardGridStyle}>
              {awardRecords.map((award) => {
                const awardPlayerId = award.recipientPlayerId || selectedRecord.entrantPlayerIds[award.recipientName] || ''
                return (
                  <article key={award.id} style={awardCardStyle}>
                    <div style={awardCertificatePreviewStyle}>
                      <span style={awardCertificateBrandStyle}>TenAceIQ</span>
                      <strong>{award.recipientName}</strong>
                      <span>{award.title}</span>
                      <div style={awardCertificateSealStyle}>{award.badgeCode}</div>
                    </div>
                    <div style={awardCardBodyStyle}>
                      <div style={sectionEyebrowStyle}>{award.badgeLabel}</div>
                      <h3 style={recordTitleStyle}>{award.recipientName}</h3>
                      <p style={recordTextStyle}>{award.sourceName}</p>
                      <p style={recordTextStyle}>{award.subtitle || 'More Tennis. Less Chaos.'}</p>
                      <div style={awardMetaRowStyle}>
                        <span>{formatAwardIssuedAt(award.issuedAt)}</span>
                        <span>{awardPlayerId ? 'Trophy case linked' : 'Profile needed'}</span>
                      </div>
                    </div>
                    <div style={awardActionRowStyle}>
                      <button type="button" onClick={() => printAwardCertificate(award)} style={secondaryButtonStyle}>
                        Print
                      </button>
                      <a href={buildAwardMailto(award)} style={secondaryButtonStyle}>
                        Email
                      </a>
                      <Link href={`/awards/${encodeURIComponent(award.id)}`} style={secondaryButtonStyle}>
                        Certificate
                      </Link>
                      {awardPlayerId ? (
                        <Link
                          href={`/players/${encodeURIComponent(awardPlayerId)}#profile-trophy-case`}
                          style={secondaryButtonStyle}
                        >
                          Trophy case
                        </Link>
                      ) : (
                        <a href="#tournament-profiles" style={secondaryButtonStyle}>
                          Create profile
                        </a>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div style={tournamentActionEmptyStyle}>
              <div style={emptySavedRoomCopyStyle}>
                <strong>Awards unlock from completed results.</strong>
                <span>Finish the scorebook, then create branded certificates and trophy-case badges for the podium.</span>
              </div>
              <div style={emptySavedRoomActionStyle}>
                <a href="#tournament-scorebook" style={secondaryButtonStyle}>
                  Open scorebook
                </a>
                <button type="button" onClick={issueAwards} style={primaryButtonStyle}>
                  Create awards
                </button>
              </div>
            </div>
          )}
        </section>
      ) : null}

      <section style={panelStyle}>
        <div style={panelHeaderStyle}>
          <div>
            <div style={sectionEyebrowStyle}>Tournament room</div>
            <h2 style={sectionTitleStyle}>Saved events</h2>
          </div>
          <span style={pillStyle}>{getTournamentLimitSummary(isFullCourt)}</span>
        </div>

        <div style={recordGridStyle}>
          {records.length ? records.map((record) => {
            const preview = buildTournamentPreview(record)
            const summary = summarizeTournamentResults(record)
            const pendingEntryCount = entryCounts[record.id] || 0
            const recordAwardCount = awardCounts[record.id] ?? readTiqAwardsForSource('tournament', record.id).length
            const recordAlertCount = alertCounts[record.id] || 0
            const recordProfileReadyCount = record.entrants.filter((entrant) => record.entrantPlayerIds[entrant]).length
            const recordScheduledMatchCount = preview.filter((match) => match.schedule?.date || match.schedule?.time || match.schedule?.court).length
            const recordNextMove = buildDirectorNextMove({
              record,
              pendingEntriesCount: pendingEntryCount,
              profileReadyCount: recordProfileReadyCount,
              scheduledMatchCount: recordScheduledMatchCount,
              completedMatchCount: summary.completedMatches,
              totalMatchCount: summary.totalMatches,
              awardCount: recordAwardCount,
              alertCount: recordAlertCount,
            })
            const recordFinishChecklist = buildTournamentFinishChecklist({
              record,
              pendingEntriesCount: pendingEntryCount,
              profileReadyCount: recordProfileReadyCount,
              scheduledMatchCount: recordScheduledMatchCount,
              completedMatchCount: summary.completedMatches,
              totalMatchCount: summary.totalMatches,
              awardCount: recordAwardCount,
              alertCount: recordAlertCount,
            })
            return (
              <article key={record.id} style={recordCardStyle}>
                <div style={recordTopStyle}>
                  <TiqFeatureIcon name="schedule" size="sm" variant="ghost" />
                  <span style={pillStyle}>
                    {record.isPublic ? pendingEntryCount ? `${pendingEntryCount} pending` : 'public entry' : record.status}
                  </span>
                </div>
                <h3 style={recordTitleStyle}>{record.name}</h3>
                <p style={recordTextStyle}>
                  {[record.entrantType, record.format.replace('_', ' '), record.startsOn || 'Date TBD', record.locationLabel]
                    .filter(Boolean)
                    .join(' - ')}
                </p>
                <div style={recordReadinessRailStyle} aria-label={`${record.name} readiness`}>
                  {recordFinishChecklist.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => loadRecordSection(record, item.href.replace('#', ''))}
                      style={recordReadinessItemStyle}
                    >
                      <span style={item.ready ? readinessDotReadyStyle : readinessDotWaitingStyle} aria-hidden="true" />
                      <span style={recordReadinessCopyStyle}>
                        <strong>{item.label}</strong>
                        <small>{item.value}</small>
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => loadRecordSection(record, recordNextMove.href.replace('#', ''))}
                  style={recordNextMoveStyle}
                >
                  <span style={nextMoveIndexStyle}>Next</span>
                  <span style={nextMoveCopyStyle}>
                    <strong>{recordNextMove.label}</strong>
                    <small>{recordNextMove.detail}</small>
                  </span>
                  <span style={nextMoveCtaStyle}>{recordNextMove.cta}</span>
                </button>
                <div style={recordActionGridStyle}>
                  <div style={recordToolRowStyle}>
                    <button type="button" onClick={() => loadRecord(record)} style={recordToolButtonStyle}>Open room</button>
                    <Link href={`/tournaments/${encodeURIComponent(record.id)}`} style={recordToolButtonStyle}>Public view</Link>
                  </div>
                  <button type="button" onClick={() => removeRecord(record)} style={recordRemoveButtonStyle}>Remove</button>
                </div>
              </article>
            )
          }) : (
            <div style={emptySavedRoomStyle}>
              <div style={emptySavedRoomCopyStyle}>
                <strong>Create the first tournament room.</strong>
                <span>Build the draw, choose public entry, then save the room so scheduling, alerts, and awards can follow it.</span>
              </div>
              <div style={emptySavedRoomActionStyle}>
                <button type="button" onClick={startNew} style={primaryButtonStyle}>
                  Build draw
                </button>
                <a href="#tournament-setup" style={secondaryButtonStyle}>
                  Add entrants
                </a>
                <a href="#tournament-setup" style={secondaryButtonStyle}>
                  Public entry
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      {selectedRecord ? <div style={smallNoteStyle}>Editing {selectedRecord.name}.</div> : null}
    </main>
  )
}

function Stat({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div style={compact ? compactStatStyle : statStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function buildAwardMailto(award: TiqAwardRecord) {
  const subject = encodeURIComponent(`TenAceIQ award: ${award.title}`)
  const certificateUrl = buildAwardCertificateUrl(award)
  const body = encodeURIComponent(`${buildTiqAwardCertificateText(award)}\n\nOpen certificate: ${certificateUrl}`)
  return `mailto:?subject=${subject}&body=${body}`
}

function buildDirectorNextMove(input: {
  record: TiqTournamentRecord
  pendingEntriesCount: number
  profileReadyCount: number
  scheduledMatchCount: number
  completedMatchCount: number
  totalMatchCount: number
  awardCount: number
  alertCount: number
}) {
  if (input.record.isPublic && input.pendingEntriesCount > 0) {
    return {
      label: 'Approve the waiting field',
      detail: `${input.pendingEntriesCount} player${input.pendingEntriesCount === 1 ? '' : 's'} waiting before the draw is final.`,
      href: '#tournament-entries',
      cta: 'Review entries',
    }
  }

  if (input.record.entrants.length > 0 && input.profileReadyCount < input.record.entrants.length) {
    return {
      label: 'Create player profiles',
      detail: `${input.profileReadyCount}/${input.record.entrants.length} entrants are linked for TIQ ratings and trophy cases.`,
      href: '#tournament-profiles',
      cta: 'Create profiles',
    }
  }

  if (input.totalMatchCount > 0 && input.scheduledMatchCount === 0) {
    return {
      label: 'Post the court plan',
      detail: 'Add dates, times, or courts so players know where to go.',
      href: '#tournament-scorebook',
      cta: 'Schedule matches',
    }
  }

  if (input.totalMatchCount > 0 && input.completedMatchCount < input.totalMatchCount) {
    return {
      label: 'Update the scorebook',
      detail: `${input.completedMatchCount}/${input.totalMatchCount} results are in.`,
      href: '#tournament-scorebook',
      cta: 'Enter results',
    }
  }

  if (input.totalMatchCount > 0 && input.awardCount === 0) {
    return {
      label: 'Create podium awards',
      detail: 'Certificates and trophy cases are ready once honors are issued.',
      href: '#tournament-awards',
      cta: 'Issue awards',
    }
  }

  if (input.awardCount > 0 && input.alertCount === 0) {
    return {
      label: 'Send the recap draft',
      detail: 'Turn the podium into a participant update with TenAceIQ links and opt-out language.',
      href: '#tournament-alerts',
      cta: 'Draft recap',
    }
  }

  return {
    label: 'Tournament room is current',
    detail: 'Entries, scoring, awards, and alerts are in working shape.',
    href: '#tournament-room',
    cta: 'Review room',
  }
}

function buildTournamentFinishChecklist(input: {
  record: TiqTournamentRecord
  pendingEntriesCount: number
  profileReadyCount: number
  scheduledMatchCount: number
  completedMatchCount: number
  totalMatchCount: number
  awardCount: number
  alertCount: number
}) {
  return [
    {
      label: 'Field',
      value: input.record.isPublic && input.pendingEntriesCount ? `${input.pendingEntriesCount} waiting` : `${input.record.entrants.length} in`,
      href: '#tournament-entries',
      ready: !input.record.isPublic || input.pendingEntriesCount === 0,
    },
    {
      label: 'Profiles',
      value: `${input.profileReadyCount}/${input.record.entrants.length}`,
      href: '#tournament-profiles',
      ready: input.record.entrants.length > 0 && input.profileReadyCount === input.record.entrants.length,
    },
    {
      label: 'Schedule',
      value: `${input.scheduledMatchCount}/${input.totalMatchCount}`,
      href: '#tournament-scorebook',
      ready: input.totalMatchCount > 0 && input.scheduledMatchCount > 0,
    },
    {
      label: 'Results',
      value: `${input.completedMatchCount}/${input.totalMatchCount}`,
      href: '#tournament-scorebook',
      ready: input.totalMatchCount > 0 && input.completedMatchCount === input.totalMatchCount,
    },
    {
      label: 'Awards',
      value: input.awardCount ? `${input.awardCount} issued` : 'Ready',
      href: '#tournament-awards',
      ready: input.awardCount > 0,
    },
    {
      label: 'Recap',
      value: input.alertCount ? `${input.alertCount} drafted` : 'Open',
      href: '#tournament-alerts',
      ready: input.alertCount > 0,
    },
  ]
}

function buildTournamentAwardRecapBody(record: TiqTournamentRecord, awards: TiqAwardRecord[]) {
  const orderedAwards = [...awards].sort((a, b) => getAwardPlacementRank(a.placement) - getAwardPlacementRank(b.placement))
  const podium = orderedAwards
    .slice(0, 3)
    .map((award) => `${award.badgeLabel}: ${award.recipientName}`)
    .join('. ')
  const resultNote = podium || 'The podium is posted'
  return `${resultNote}. Certificates and trophy cases are live for ${record.name}.`
}

function getAwardPlacementRank(placement: TiqAwardPlacement) {
  if (placement === 'first') return 1
  if (placement === 'second') return 2
  return 3
}

function buildAwardCertificateUrl(award: TiqAwardRecord) {
  const path = `/awards/${encodeURIComponent(award.id)}`
  if (typeof window === 'undefined') return path
  return `${window.location.origin}${path}`
}

function formatAwardIssuedAt(value: string) {
  if (!value) return 'Issued'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Issued'
  return `Issued ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

function buildAwardRecipientState(
  record: TiqTournamentRecord,
  current: Record<TiqAwardPlacement, string> = { first: '', second: '', third: '' },
) {
  const issuedAwards = readTiqAwardsForSource('tournament', record.id)
  const candidates = buildTiqTournamentAwardCandidates(record)
  return {
    first: current.first
      || issuedAwards.find((award) => award.placement === 'first')?.recipientName
      || candidates.find((candidate) => candidate.placement === 'first')?.recipientName
      || '',
    second: current.second
      || issuedAwards.find((award) => award.placement === 'second')?.recipientName
      || candidates.find((candidate) => candidate.placement === 'second')?.recipientName
      || '',
    third: current.third
      || issuedAwards.find((award) => award.placement === 'third')?.recipientName
      || candidates.find((candidate) => candidate.placement === 'third')?.recipientName
      || '',
  }
}

function buildScoreInputState(record: TiqTournamentRecord) {
  return Object.fromEntries(
    Object.entries(record.results).map(([matchId, result]) => [matchId, result.score || '']),
  )
}

function buildScheduleInputState(record: TiqTournamentRecord) {
  return Object.fromEntries(
    Object.entries(record.schedule).map(([matchId, schedule]) => [
      matchId,
      { date: schedule.date || '', time: schedule.time || '', court: schedule.court || '' },
    ]),
  )
}

function buildContactInputState(record: TiqTournamentRecord) {
  return Object.fromEntries(
    record.entrants.map((entrant) => {
      const contact = record.contacts[entrant]
      return [
        entrant,
        {
          phone: contact?.phone || '',
          smsOptIn: Boolean(contact?.smsOptIn),
          consentNote: contact?.consentNote || '',
        },
      ]
    }),
  )
}

function mergeVisibleAwards(primary: TiqAwardRecord[], secondary: TiqAwardRecord[]) {
  const byId = new Map<string, TiqAwardRecord>()
  for (const award of [...primary, ...secondary]) {
    byId.set(award.id, award)
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.issuedAt || b.updatedAt || 0).getTime() - new Date(a.issuedAt || a.updatedAt || 0).getTime(),
  )
}

function formatMatchSchedule(schedule: Pick<TiqTournamentMatchSchedule, 'date' | 'time' | 'court'>) {
  return [schedule.date, schedule.time, schedule.court].filter(Boolean).join(' - ')
}

function formatAlertKind(kind: TiqTournamentAlertRecord['kind']) {
  if (kind === 'rules') return 'Rules'
  if (kind === 'schedule_change') return 'Schedule'
  if (kind === 'recap') return 'Recap'
  return 'Court ready'
}

function formatAlertStatus(status: TiqTournamentAlertRecord['status']) {
  if (status === 'queued') return 'Queued'
  if (status === 'sent') return 'Sent'
  if (status === 'cancelled') return 'Cancelled'
  return 'Draft'
}

function getAlertStatusStyle(status: TiqTournamentAlertRecord['status']): CSSProperties {
  if (status === 'queued') return alertStatusQueuedStyle
  if (status === 'sent') return alertStatusSentStyle
  if (status === 'cancelled') return alertStatusCancelledStyle
  return alertStatusDraftStyle
}

function buildAlertMessageSnippet(message: string) {
  const cleanMessage = message.replace(/\s+/g, ' ').trim()
  return cleanMessage.length > 132 ? `${cleanMessage.slice(0, 129)}...` : cleanMessage
}

function formatAlertTimestamp(value: string) {
  if (!value) return 'Not queued'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Queued'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function buildContactCardId(entrant: string) {
  return `tournament-contact-${entrant.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function formatPreferenceSource(source: TiqTournamentPreferenceEventRecord['source']) {
  if (source === 'sms_reply') return 'SMS reply'
  if (source === 'director_update') return 'Director update'
  return 'Tournament link'
}

function buildCalendarDays(month: string, events: TiqTournamentCalendarEvent[]) {
  const [year, monthIndex] = month.split('-').map((part) => Number.parseInt(part, 10))
  const firstOfMonth = new Date(year, monthIndex - 1, 1)
  const start = new Date(firstOfMonth)
  start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const value = formatCalendarDateValue(date)
    return {
      date: value,
      inMonth: date.getMonth() === monthIndex - 1,
      events: events.filter((event) => event.date === value),
    }
  })
}

function formatCalendarDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shiftCalendarMonth(month: string, offset: number) {
  const [year, monthIndex] = month.split('-').map((part) => Number.parseInt(part, 10))
  const date = new Date(year, monthIndex - 1 + offset, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatCalendarMonth(month: string) {
  const [year, monthIndex] = month.split('-').map((part) => Number.parseInt(part, 10))
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(year, monthIndex - 1, 1))
}

function formatCalendarAgendaDate(event: TiqTournamentCalendarEvent) {
  const [year, month, day] = event.date.split('-').map((part) => Number.parseInt(part, 10))
  const date = new Date(year, month - 1, day)
  const label = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
  return event.time ? `${label} at ${event.time}` : `${label} time TBD`
}

function formatGameDiff(value: number) {
  if (value > 0) return `+${value}`
  return String(value)
}

function printAwardCertificate(award: TiqAwardRecord) {
  if (typeof window === 'undefined') return
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700')
  if (!printWindow) return

  printWindow.document.write(buildAwardPrintHtml(award))
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

function buildAwardPrintHtml(award: TiqAwardRecord) {
  const escaped = {
    badgeCode: escapeHtml(award.badgeCode),
    badgeLabel: escapeHtml(award.badgeLabel),
    recipientName: escapeHtml(award.recipientName),
    title: escapeHtml(award.title),
    sourceName: escapeHtml(award.sourceName),
    subtitle: escapeHtml(award.subtitle || 'More Tennis. Less Chaos.'),
    notes: escapeHtml(award.notes),
  }
  return `<!doctype html>
<html>
<head>
  <title>TenAceIQ Award</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #061326; color: #f8fafc; font-family: Arial, sans-serif; }
    .certificate { position: relative; overflow: hidden; width: min(10.5in, calc(100vw - 32px)); min-height: 7.4in; padding: .55in; border: 1px solid rgba(116,190,255,.34); border-radius: 28px; background: linear-gradient(180deg, #0c1a32 0%, #081428 100%); box-shadow: 0 30px 80px rgba(0,0,0,.34); }
    .ball { position: absolute; right: -1.1in; top: -.9in; width: 3in; height: 3in; border-radius: 50%; opacity: .16; background: radial-gradient(circle at 36% 34%, rgba(255,255,255,.9) 0 7%, transparent 8%), radial-gradient(circle at 50% 50%, rgba(155,225,29,.95) 0 48%, transparent 58%); }
    .brand { color: #74beff; font-size: 14px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
    h1 { margin: 40px 0 12px; font-size: 64px; line-height: .95; letter-spacing: 0; }
    .recipient { color: #9be11d; font-size: 48px; font-weight: 950; line-height: 1; margin: 20px 0; }
    .copy { max-width: 7.4in; color: #dbeafe; font-size: 20px; line-height: 1.55; font-weight: 700; }
    .badge { display: inline-grid; place-items: center; width: 72px; height: 72px; margin-top: 34px; border-radius: 50%; border: 1px solid rgba(155,225,29,.58); background: rgba(155,225,29,.13); color: #f8fafc; font-size: 24px; font-weight: 950; }
    .motto { position: absolute; left: .55in; bottom: .45in; color: #a7f3d0; font-size: 16px; font-weight: 950; }
    @media print { body { background: white; } .certificate { width: 10.5in; min-height: 7.4in; box-shadow: none; } }
  </style>
</head>
<body>
  <main class="certificate">
    <div class="ball"></div>
    <div class="brand">TenAceIQ Award Studio</div>
    <h1>${escaped.title}</h1>
    <div class="recipient">${escaped.recipientName}</div>
    <p class="copy">${escaped.badgeLabel} in ${escaped.sourceName}. ${escaped.subtitle}</p>
    ${escaped.notes ? `<p class="copy">${escaped.notes}</p>` : ''}
    <div class="badge">${escaped.badgeCode}</div>
    <div class="motto">More Tennis. Less Chaos.</div>
  </main>
</body>
</html>`
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const pageStyle: CSSProperties = {
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '0 auto',
  padding: '14px 0 36px',
  display: 'grid',
  gap: 16,
  minWidth: 0,
  overflowX: 'clip',
}

const heroStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
  gap: 12,
  alignItems: 'stretch',
  padding: 18,
  borderRadius: 24,
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
  aspectRatio: '1045 / 490',
  background: 'url("/tiq/logo/tiq-mark-light.png") center / contain no-repeat',
  opacity: 0.14,
  pointerEvents: 'none',
}

const heroCopyStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gap: 10,
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
  fontSize: 'clamp(1.9rem, 3.45vw, 3.45rem)',
  lineHeight: 0.98,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const textStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.55,
  fontWeight: 750,
  maxWidth: 760,
}

const syncNoticeStyle: CSSProperties = {
  width: 'fit-content',
  maxWidth: '100%',
  padding: '9px 11px',
  borderRadius: 999,
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(125,211,252,0.08)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const heroPanelStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gap: 10,
  alignContent: 'center',
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.30)',
  background: 'linear-gradient(145deg, rgba(155,225,29,0.12), rgba(116,190,255,0.07) 58%, rgba(15,23,42,0.62))',
  color: 'var(--foreground-strong)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), 0 20px 54px rgba(2,10,24,0.20)',
  overflow: 'hidden',
}

const fullCourtPanelCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const fullCourtFeatureGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 7,
  minWidth: 0,
  color: 'var(--foreground-strong)',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const statGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 132px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const statStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 900,
  textTransform: 'uppercase',
}

const tournamentPathStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
  padding: 16,
  borderRadius: 22,
  border: '1px solid rgba(155,225,29,0.18)',
  background:
    'linear-gradient(135deg, rgba(155,225,29,0.08), rgba(116,190,255,0.045)), linear-gradient(180deg, rgba(11,25,48,0.9), rgba(6,15,30,0.95))',
  boxShadow: '0 18px 46px rgba(2,10,24,0.22)',
  overflow: 'hidden',
}

const tournamentPathHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'end',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
}

const tournamentPathTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.45rem, 3vw, 2.25rem)',
  lineHeight: 1.04,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const tournamentPathIntroStyle: CSSProperties = {
  ...textStyle,
  maxWidth: 500,
}

const tournamentPathCommandStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
  gap: 12,
  minWidth: 0,
}

const tournamentPathStatusPanelStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'linear-gradient(180deg, rgba(14,35,57,0.78), rgba(7,17,33,0.88))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.045)',
  overflow: 'hidden',
}

const tournamentPathStatusTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 20,
  lineHeight: 1.12,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const tournamentPathStatusTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 780,
  overflowWrap: 'anywhere',
}

const tournamentPathStatusGridStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const tournamentPathStatusItemStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) minmax(0, auto)',
  gap: 7,
  alignItems: 'center',
  minWidth: 0,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(15,23,42,0.46)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 820,
  overflowWrap: 'anywhere',
}

const tournamentPathStatusDetailStyle: CSSProperties = {
  gridColumn: '2 / -1',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const tournamentPathGridStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  alignContent: 'start',
  minWidth: 0,
}

const tournamentPathCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '38px minmax(0, 1fr) minmax(0, auto)',
  gap: 10,
  alignItems: 'center',
  minWidth: 0,
  minHeight: 96,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(223,248,194,0.13)',
  background: 'linear-gradient(180deg, rgba(18,39,70,0.72), rgba(8,18,36,0.9))',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
  overflow: 'hidden',
}

const tournamentPathCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.42,
  fontWeight: 760,
  overflowWrap: 'anywhere',
}

const tournamentPathCtaStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  textAlign: 'right',
  overflowWrap: 'anywhere',
}

const lockedPreviewStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  minWidth: 0,
  padding: 18,
  borderRadius: 24,
  border: '1px solid rgba(155,225,29,0.20)',
  background: 'linear-gradient(135deg, rgba(12,26,50,0.92), rgba(8,17,34,0.94))',
  boxShadow: '0 20px 54px rgba(2,10,24,0.22)',
}

const lockedPreviewHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
}

const lockedPreviewGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const lockedPreviewCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: 10,
  minWidth: 0,
  minHeight: 116,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  overflow: 'hidden',
}

const lockedPreviewIndexStyle: CSSProperties = {
  display: 'inline-grid',
  placeItems: 'center',
  width: 34,
  height: 34,
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(155,225,29,0.10)',
  color: 'var(--brand-lime)',
  fontSize: 12,
  fontWeight: 950,
}

const lockedPreviewCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  alignContent: 'start',
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const compactStatStyle: CSSProperties = {
  ...statStyle,
  padding: 10,
}

const builderGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
  gap: 16,
  minWidth: 0,
  alignItems: 'start',
}

const runSheetStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
  padding: 16,
  borderRadius: 22,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(135deg, rgba(13,31,55,0.94), rgba(8,17,34,0.92))',
  boxShadow: '0 20px 52px rgba(2,10,24,0.2)',
}

const runSheetHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
}

const runSheetTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.05,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const nextMoveStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  gap: 12,
  alignItems: 'center',
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.13), rgba(34,211,238,0.07))',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
}

const nextMoveIndexStyle: CSSProperties = {
  display: 'inline-grid',
  placeItems: 'center',
  minWidth: 46,
  height: 32,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.30)',
  background: 'rgba(155,225,29,0.11)',
  color: 'var(--brand-lime)',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
}

const nextMoveCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  fontSize: 14,
  lineHeight: 1.35,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const nextMoveCtaStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  maxWidth: '100%',
  padding: '0 11px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.22)',
  background: 'rgba(116,190,255,0.10)',
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const runSheetGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 145px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const finishChecklistStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 128px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const finishChecklistItemStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  gap: 8,
  alignItems: 'center',
  minWidth: 0,
  minHeight: 42,
  padding: '9px 10px',
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(15,23,42,0.46)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const runSheetCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: '4px 8px',
  minWidth: 0,
  minHeight: 78,
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(15,23,42,0.55)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontWeight: 900,
}

const panelStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
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
  alignItems: 'start',
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

const fieldGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const setupReadinessGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const setupReadinessItemStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: '2px 8px',
  alignItems: 'center',
  minWidth: 0,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(15,23,42,0.48)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const setupPathStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 168px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const setupPathItemStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: 9,
  alignItems: 'start',
  minWidth: 0,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'rgba(255,255,255,0.04)',
  overflow: 'hidden',
}

const setupPathStepStyle: CSSProperties = {
  display: 'inline-grid',
  placeItems: 'center',
  width: 26,
  height: 26,
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(116,190,255,0.08)',
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
}

const setupPathStepReadyStyle: CSSProperties = {
  ...setupPathStepStyle,
  border: '1px solid rgba(155,225,29,0.32)',
  background: 'rgba(155,225,29,0.12)',
  color: 'var(--brand-lime)',
}

const setupPathCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  color: 'var(--foreground-strong)',
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  minWidth: 0,
}

const toggleFieldStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: 10,
  alignItems: 'center',
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.35,
  fontWeight: 850,
}

const checkboxStyle: CSSProperties = {
  width: 18,
  height: 18,
  accentColor: '#9be11d',
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
  minHeight: 128,
  padding: 12,
  resize: 'vertical',
  lineHeight: 1.45,
}

const segmentedStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const segmentButtonStyle: CSSProperties = {
  minHeight: 42,
  padding: '0 10px',
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--foreground)',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer',
}

const segmentActiveStyle: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.38)',
  background: 'rgba(155,225,29,0.13)',
  color: 'var(--foreground-strong)',
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 9,
  minWidth: 0,
}

const primaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  minHeight: 42,
  padding: '0 14px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.38)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.30), rgba(34,211,238,0.14))',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 950,
  cursor: 'pointer',
}

const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(255,255,255,0.045)',
}

const ghostButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  minHeight: 36,
  borderRadius: 14,
}

const dangerButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  border: '1px solid rgba(248,113,113,0.24)',
  color: '#fecaca',
}

const noticeStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 850,
}

const pillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 30,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground)',
  fontSize: 11,
  fontWeight: 900,
  textTransform: 'uppercase',
}

const previewListStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const matchCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr)',
  gap: 8,
  alignItems: 'center',
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  overflowWrap: 'anywhere',
}

const matchMetaStyle: CSSProperties = {
  gridColumn: '1 / -1',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 900,
  textTransform: 'uppercase',
}

const winnerLineStyle: CSSProperties = {
  gridColumn: '1 / -1',
  color: 'var(--brand-green)',
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const vsStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
}

const emptyStateStyle: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 750,
}

const emptySavedRoomStyle: CSSProperties = {
  ...emptyStateStyle,
  display: 'grid',
  gap: 12,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.08), rgba(116,190,255,0.055))',
  minWidth: 0,
}

const calendarEmptyStateStyle: CSSProperties = {
  ...emptySavedRoomStyle,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(255,255,255,0.045)',
}

const tournamentActionEmptyStyle: CSSProperties = {
  ...emptySavedRoomStyle,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(8,16,34,0.58)',
}

const emptySavedRoomCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const emptySavedRoomActionStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const smallNoteStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 750,
}

const scorebookListStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
}

const calendarPanelStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gap: 12,
  minWidth: 0,
  padding: 16,
  borderRadius: 24,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'var(--portal-surface-bg)',
  overflow: 'hidden',
}

const calendarActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: 8,
  minWidth: 0,
}

const calendarShellStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
  gap: 12,
  alignItems: 'start',
  minWidth: 0,
}

const calendarBoardStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const calendarAgendaStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  minWidth: 0,
  padding: 12,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'rgba(8,16,34,0.48)',
}

const calendarAgendaHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  alignItems: 'flex-start',
  minWidth: 0,
}

const calendarAgendaTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 17,
  lineHeight: 1.2,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const calendarAgendaListStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const calendarAgendaEventStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
}

const weekdayGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 6,
  minWidth: 0,
  color: 'var(--brand-blue-2)',
  fontSize: 10,
  fontWeight: 950,
  textTransform: 'uppercase',
}

const calendarGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: 6,
  minWidth: 0,
}

const calendarDayStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 5,
  minWidth: 0,
  minHeight: 112,
  padding: 8,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  overflow: 'hidden',
}

const mutedCalendarDayStyle: CSSProperties = {
  opacity: 0.48,
}

const calendarDateStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 950,
}

const calendarEventStackStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
}

const calendarEventStyle: CSSProperties = {
  display: 'grid',
  gap: 2,
  minWidth: 0,
  padding: 7,
  borderRadius: 10,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(155,225,29,0.08)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: 10,
  lineHeight: 1.25,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const calendarMoreStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 10,
  fontWeight: 900,
}

const scorebookCommandStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 185px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const scorebookCommandItemStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  gap: 9,
  alignItems: 'center',
  minWidth: 0,
  minHeight: 64,
  padding: 11,
  borderRadius: 15,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(15,23,42,0.48)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  overflow: 'hidden',
}

const scorebookCommandCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 820,
  overflowWrap: 'anywhere',
}

const scorebookCommandValueStyle: CSSProperties = {
  color: 'var(--brand-lime)',
  fontSize: 12,
  fontWeight: 950,
  textAlign: 'right',
  overflowWrap: 'anywhere',
}

const entryCommandStyle: CSSProperties = {
  ...scorebookCommandStyle,
}

const entryCommandItemStyle: CSSProperties = {
  ...scorebookCommandItemStyle,
}

const entryCommandCopyStyle: CSSProperties = {
  ...scorebookCommandCopyStyle,
}

const entryCommandValueStyle: CSSProperties = {
  ...scorebookCommandValueStyle,
}

const alertCommandStyle: CSSProperties = {
  ...scorebookCommandStyle,
}

const alertCommandItemStyle: CSSProperties = {
  ...scorebookCommandItemStyle,
}

const alertCommandCopyStyle: CSSProperties = {
  ...scorebookCommandCopyStyle,
}

const alertCommandValueStyle: CSSProperties = {
  ...scorebookCommandValueStyle,
}

const profileCommandStyle: CSSProperties = {
  ...scorebookCommandStyle,
}

const profileCommandItemStyle: CSSProperties = {
  ...scorebookCommandItemStyle,
}

const profileCommandCopyStyle: CSSProperties = {
  ...scorebookCommandCopyStyle,
}

const profileCommandValueStyle: CSSProperties = {
  ...scorebookCommandValueStyle,
}

const awardCommandStyle: CSSProperties = {
  ...scorebookCommandStyle,
}

const awardCommandItemStyle: CSSProperties = {
  ...scorebookCommandItemStyle,
}

const awardCommandCopyStyle: CSSProperties = {
  ...scorebookCommandCopyStyle,
}

const awardCommandValueStyle: CSSProperties = {
  ...scorebookCommandValueStyle,
}

const scorebookMatchStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
}

const scorebookSidesStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr)',
  gap: 8,
  alignItems: 'center',
  minWidth: 0,
  color: 'var(--foreground-strong)',
  overflowWrap: 'anywhere',
}

const matchFollowThroughGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 112px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const matchFollowThroughItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  minHeight: 34,
  minWidth: 0,
  padding: '7px 9px',
  borderRadius: 12,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.035)',
  color: '#dfeeff',
  fontSize: 12,
  fontWeight: 850,
  overflow: 'hidden',
}

const matchPrimaryActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 34,
  minWidth: 0,
  padding: '7px 12px',
  borderRadius: 12,
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(155,225,29,0.11)',
  color: '#f5ffe2',
  fontSize: 12,
  fontWeight: 900,
  overflowWrap: 'anywhere',
  textAlign: 'center',
}

const scoreFieldStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, auto) minmax(0, 220px)',
  gap: 10,
  alignItems: 'center',
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
}

const scheduleGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 132px), 1fr))',
  gap: 9,
  alignItems: 'end',
  minWidth: 0,
}

const entryQueueGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const entryQueueCardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  overflowWrap: 'anywhere',
}

const entryQueueTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  alignItems: 'flex-start',
  minWidth: 0,
}

const entryContactLineStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 800,
}

const recentEntryListStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const recentEntryPillStyle: CSSProperties = {
  display: 'inline-flex',
  maxWidth: '100%',
  padding: '7px 10px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(15,23,42,0.5)',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const contactGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const contactCardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--foreground-strong)',
  overflowWrap: 'anywhere',
}

const highlightedContactCardStyle: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.42)',
  boxShadow: '0 0 0 3px rgba(155,225,29,0.10)',
  background: 'rgba(155,225,29,0.07)',
}

const sendReadinessStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(15,23,42,0.48)',
}

const sendReadinessTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 800,
}

const sendReadinessGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const sendReadinessItemStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  gap: 8,
  alignItems: 'center',
  minWidth: 0,
  padding: '9px 10px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
}

const readinessDotReadyStyle: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: 'var(--brand-green)',
  boxShadow: '0 0 0 4px rgba(155,225,29,0.12)',
  flex: '0 0 auto',
}

const readinessDotWaitingStyle: CSSProperties = {
  ...readinessDotReadyStyle,
  background: 'rgba(116,190,255,0.46)',
  boxShadow: '0 0 0 4px rgba(116,190,255,0.08)',
}

const readinessDotBlockedStyle: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: 'rgba(248,113,113,0.9)',
  boxShadow: '0 0 0 4px rgba(248,113,113,0.10)',
}

const profileLinkGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const profileLinkRowStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--foreground-strong)',
  overflowWrap: 'anywhere',
}

const alertComposerStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  padding: 12,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'rgba(155,225,29,0.06)',
}

const alertPreviewStyle: CSSProperties = {
  minWidth: 0,
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(15,23,42,0.62)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const alertHistoryStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const alertQueuePanelStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(15,23,42,0.42)',
}

const alertQueueHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  minWidth: 0,
  flexWrap: 'wrap',
  color: 'var(--foreground-strong)',
  fontSize: 16,
  fontWeight: 950,
}

const alertQueueStatsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 900,
}

const alertHistoryItemStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  minWidth: 0,
  padding: 10,
  borderRadius: 12,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(15,23,42,0.54)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 850,
  flexWrap: 'wrap',
}

const alertHistoryCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  flex: '1 1 280px',
}

const alertHistoryTitleStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  flexWrap: 'wrap',
  color: 'var(--foreground-strong)',
}

const alertStatusBaseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 22,
  padding: '0 8px',
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 950,
  textTransform: 'uppercase',
}

const alertStatusDraftStyle: CSSProperties = {
  ...alertStatusBaseStyle,
  border: '1px solid rgba(116,190,255,0.20)',
  background: 'rgba(116,190,255,0.08)',
  color: '#9bd8ff',
}

const alertStatusQueuedStyle: CSSProperties = {
  ...alertStatusBaseStyle,
  border: '1px solid rgba(155,225,29,0.24)',
  background: 'rgba(155,225,29,0.10)',
  color: '#b7ff4c',
}

const alertStatusSentStyle: CSSProperties = {
  ...alertStatusBaseStyle,
  border: '1px solid rgba(45,212,191,0.24)',
  background: 'rgba(45,212,191,0.10)',
  color: '#7dd3fc',
}

const alertStatusCancelledStyle: CSSProperties = {
  ...alertStatusBaseStyle,
  border: '1px solid rgba(248,113,113,0.24)',
  background: 'rgba(248,113,113,0.10)',
  color: '#fca5a5',
}

const alertPreviewResultStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  flexBasis: '100%',
  minWidth: 0,
  padding: 10,
  borderRadius: 12,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(155,225,29,0.07)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const alertRecipientPreviewListStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  minWidth: 0,
}

const alertRecipientPreviewPillStyle: CSSProperties = {
  display: 'inline-flex',
  maxWidth: '100%',
  padding: '6px 8px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(15,23,42,0.5)',
  color: 'var(--foreground-strong)',
  fontSize: 11,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const alertSkippedPreviewListStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  minWidth: 0,
  alignItems: 'center',
  paddingTop: 4,
  borderTop: '1px solid rgba(255,255,255,0.08)',
}

const alertSkippedPreviewPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  maxWidth: '100%',
  padding: '6px 8px',
  borderRadius: 999,
  border: '1px solid rgba(248,113,113,0.20)',
  background: 'rgba(248,113,113,0.08)',
  color: 'var(--foreground-strong)',
  fontSize: 11,
  fontWeight: 900,
  overflowWrap: 'anywhere',
  cursor: 'pointer',
}

const preferenceAuditStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(15,23,42,0.4)',
}

const preferenceAuditItemStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  padding: 10,
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const compactFieldStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 10,
  fontWeight: 950,
  textTransform: 'uppercase',
}

const scoreInputStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  minHeight: 38,
  padding: '0 11px',
  borderRadius: 12,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(15,23,42,0.66)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 850,
  outline: 'none',
  boxSizing: 'border-box',
}

const disabledInputStyle: CSSProperties = {
  opacity: 0.54,
  cursor: 'not-allowed',
}

const resultBannerStyle: CSSProperties = {
  padding: '9px 11px',
  borderRadius: 14,
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'rgba(155,225,29,0.09)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const scheduleBannerStyle: CSSProperties = {
  padding: '8px 10px',
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(116,190,255,0.08)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const standingsPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 9,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(155,225,29,0.07)',
}

const standingsListStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
}

const standingsRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '32px minmax(0, 1fr) minmax(0, 56px) minmax(0, 56px) minmax(0, 54px)',
  gap: 8,
  alignItems: 'center',
  minWidth: 0,
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const standingsRankStyle: CSSProperties = {
  display: 'inline-grid',
  placeItems: 'center',
  width: 26,
  height: 26,
  borderRadius: '50%',
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(15,23,42,0.58)',
  color: 'var(--brand-lime)',
  fontSize: 11,
  fontWeight: 950,
}

const awardSetupGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const awardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
  gap: 12,
  minWidth: 0,
}

const awardCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 150px) minmax(0, 1fr)',
  gap: 12,
  alignItems: 'start',
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.24)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.10) 0%, rgba(15,23,42,0.78) 52%, rgba(116,190,255,0.08) 100%)',
  color: 'var(--foreground-strong)',
}

const awardCertificatePreviewStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  alignContent: 'center',
  gap: 5,
  minHeight: 132,
  minWidth: 0,
  padding: 14,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'radial-gradient(circle at 80% 20%, rgba(155,225,29,0.22), transparent 34%), linear-gradient(180deg, rgba(12,26,50,0.96) 0%, rgba(8,20,40,0.98) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)',
  overflow: 'hidden',
  overflowWrap: 'anywhere',
}

const awardCertificateBrandStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const awardCertificateSealStyle: CSSProperties = {
  display: 'inline-grid',
  placeItems: 'center',
  width: 42,
  height: 42,
  marginTop: 4,
  borderRadius: '50%',
  border: '1px solid rgba(155,225,29,0.42)',
  background: 'rgba(155,225,29,0.14)',
  color: 'var(--brand-lime)',
  fontSize: 12,
  fontWeight: 950,
}

const awardCardBodyStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
}

const awardMetaRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 7,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 850,
}

const awardActionRowStyle: CSSProperties = {
  ...actionRowStyle,
  gridColumn: '1 / -1',
}

const awardChoiceRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 7,
  minWidth: 0,
}

const awardChoiceButtonStyle: CSSProperties = {
  minHeight: 32,
  maxWidth: '100%',
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground)',
  fontSize: 11,
  lineHeight: 1.2,
  fontWeight: 900,
  cursor: 'pointer',
  overflowWrap: 'anywhere',
}

const awardChoiceButtonActiveStyle: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.44)',
  background: 'rgba(155,225,29,0.14)',
  color: 'var(--foreground-strong)',
}

const disabledButtonStyle: CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
}

const recordGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
  gap: 12,
  minWidth: 0,
}

const recordCardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
}

const recordTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  alignItems: 'center',
}

const recordTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 18,
  lineHeight: 1.12,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const recordTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const recordMetricGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
  minWidth: 0,
}

const recordReadinessRailStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 104px), 1fr))',
  gap: 7,
  minWidth: 0,
}

const recordReadinessItemStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: 7,
  alignItems: 'center',
  minWidth: 0,
  minHeight: 42,
  padding: '8px 9px',
  borderRadius: 13,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(15,23,42,0.42)',
  color: 'var(--foreground-strong)',
  cursor: 'pointer',
  textAlign: 'left',
  overflow: 'hidden',
}

const recordReadinessCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 2,
  minWidth: 0,
  fontSize: 11,
  lineHeight: 1.15,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const recordActionGridStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const recordToolRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 116px), 1fr))',
  gap: 7,
  minWidth: 0,
}

const recordNextMoveStyle: CSSProperties = {
  ...nextMoveStyle,
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  width: '100%',
  padding: 12,
  borderRadius: 14,
  cursor: 'pointer',
  textAlign: 'left',
}

const recordToolButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  minHeight: 34,
  padding: '0 8px',
  borderRadius: 12,
  fontSize: 11,
  lineHeight: 1.1,
  overflowWrap: 'anywhere',
}

const recordRemoveButtonStyle: CSSProperties = {
  ...dangerButtonStyle,
  minHeight: 32,
  justifySelf: 'start',
  padding: '0 10px',
  borderColor: 'rgba(248,113,113,0.20)',
  background: 'rgba(248,113,113,0.08)',
  fontSize: 11,
}
