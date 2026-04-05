'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import SiteShell from '@/app/components/site-shell'
import { supabase } from '@/lib/supabase'

type ContactRow = {
  id: string
  team_name: string
  league_name: string | null
  flight: string | null
  season_label: string | null
  session_label: string | null
  full_name: string
  phone: string
  role: string | null
  is_captain: boolean | null
  is_active: boolean | null
  opt_in_text: boolean | null
  notes: string | null
}

type TemplateRow = {
  id: string
  team_name: string
  league_name: string | null
  flight: string | null
  season_label: string | null
  session_label: string | null
  template_name: string
  message_body: string
}

type MatchRow = {
  id: string
  match_date: string | null
  league_name: string | null
  flight: string | null
  home_team: string | null
  away_team: string | null
}

type ScenarioRow = {
  id: string
  scenario_name: string
  league_name: string | null
  flight: string | null
  match_date: string | null
  team_name: string | null
  opponent_team: string | null
  slots_json: unknown
  notes: string | null
}

type WeeklyAvailability = {
  id: string
  event_key: string
  contact_id: string
  status: 'available' | 'unavailable' | 'tentative' | 'no-response'
  note: string
  updated_at: string
}

type WeeklyResponse = {
  id: string
  event_key: string
  contact_id: string
  status: 'confirmed' | 'declined' | 'viewed' | 'no-response' | 'running-late' | 'need-sub'
  note: string
  updated_at: string
}

type LineupAssignment = {
  id: string
  event_key: string
  court_label: string
  slot_type: 'singles' | 'doubles'
  players: string[]
}
type ExternalAvailabilityRow = {
  source_table: string
  raw: Record<string, unknown>
  player_name: string
  status: WeeklyAvailability['status']
  team_name: string | null
  league_name: string | null
  flight: string | null
  season_label: string | null
  session_label: string | null
  match_date: string | null
}


type DraftContact = {
  full_name: string
  phone: string
  role: string
  is_captain: boolean
  is_active: boolean
  opt_in_text: boolean
  notes: string
}

type RecipientMode = 'all-opted-in' | 'captains' | 'active-only' | 'available-only' | 'lineup-only' | 'non-responders' | 'custom'
type MessageKind = 'availability' | 'lineup' | 'directions' | 'reminder' | 'follow-up'

type NormalizedSlot = {
  key: string
  label: string
  slotType: 'singles' | 'doubles'
  players: string[]
}

const CONTACTS_TABLE = 'captain_message_contacts'
const TEMPLATES_TABLE = 'captain_message_templates'
const CONTACTS_STORAGE_KEY = 'tenaceiq_captain_message_contacts'
const TEMPLATES_STORAGE_KEY = 'tenaceiq_captain_message_templates'
const AVAILABILITY_STORAGE_KEY = 'tenaceiq_weekly_availability'
const RESPONSES_STORAGE_KEY = 'tenaceiq_weekly_responses'
const LINEUPS_STORAGE_KEY = 'tenaceiq_weekly_lineups'
const EVENT_DETAILS_STORAGE_KEY = 'tenaceiq_weekly_event_details'
const AVAILABILITY_SOURCE_TABLES = [
  'captain_availability',
  'lineup_availability',
  'weekly_availability',
  'player_availability',
  'availability_responses',
  'captain_lineup_availability',
] as const

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim()
}

function cleanPhone(phone: string) {
  return phone.replace(/[^\d+]/g, '')
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((v) => normalizeText(v)).filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

function safeKey(...parts: Array<string | null | undefined>) {
  return parts.map((part) => normalizeText(part).toLowerCase() || '—').join('|')
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function inferSeasonLabel(matchDate: string | null) {
  if (!matchDate) return null
  const date = new Date(matchDate)
  if (Number.isNaN(date.getTime())) return null
  return String(date.getFullYear())
}

function inferSessionLabel(matchDate: string | null) {
  if (!matchDate) return null
  const date = new Date(matchDate)
  if (Number.isNaN(date.getTime())) return null
  const month = date.getMonth()
  if (month <= 2) return 'Winter'
  if (month <= 5) return 'Spring'
  if (month <= 7) return 'Summer'
  return 'Fall'
}

function buildSmsHref(recipients: string[], body: string) {
  const cleaned = recipients.map(cleanPhone).filter(Boolean)
  const address = cleaned.join(',')
  const query = body.trim() ? `?body=${encodeURIComponent(body.trim())}` : ''
  return `sms:${address}${query}`
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}


function parseBooleanLike(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['true', 'yes', 'y', '1', 'available', 'in', 'confirmed'].includes(normalized)) return true
    if (['false', 'no', 'n', '0', 'unavailable', 'out', 'declined'].includes(normalized)) return false
  }
  return null
}

function pickFirstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function pickNullableString(record: Record<string, unknown>, keys: string[]) {
  const value = pickFirstString(record, keys)
  return value || null
}

function coerceAvailabilityStatus(record: Record<string, unknown>): WeeklyAvailability['status'] {
  const candidates = [
    pickFirstString(record, ['status', 'availability_status', 'response_status', 'reply', 'availability', 'state']),
    typeof record.is_available === 'boolean' ? (record.is_available ? 'available' : 'unavailable') : '',
    typeof record.available === 'boolean' ? (record.available ? 'available' : 'unavailable') : '',
    typeof record.confirmed === 'boolean' ? (record.confirmed ? 'available' : 'unavailable') : '',
  ]

  for (const candidate of candidates) {
    const normalized = candidate.trim().toLowerCase()
    if (!normalized) continue
    if (['available', 'yes', 'in', 'confirmed', 'going', 'playing'].includes(normalized)) return 'available'
    if (['tentative', 'maybe', 'late', 'waitlist'].includes(normalized)) return 'tentative'
    if (['unavailable', 'no', 'out', 'declined', 'cannot-play', 'cant-play', 'not-playing'].includes(normalized)) return 'unavailable'
    if (['no-response', 'pending', 'unknown', 'waiting'].includes(normalized)) return 'no-response'
  }

  const boolCandidate =
    parseBooleanLike(record.is_available) ??
    parseBooleanLike(record.available) ??
    parseBooleanLike(record.confirmed)

  if (boolCandidate === true) return 'available'
  if (boolCandidate === false) return 'unavailable'
  return 'no-response'
}

function normalizeExternalAvailabilityRows(tableName: string, rows: unknown[]): ExternalAvailabilityRow[] {
  return rows
    .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    .map((row) => ({
      source_table: tableName,
      raw: row,
      player_name: pickFirstString(row, ['player_name', 'full_name', 'name', 'player', 'member_name']),
      status: coerceAvailabilityStatus(row),
      team_name: pickNullableString(row, ['team_name', 'team', 'team_label']),
      league_name: pickNullableString(row, ['league_name', 'league']),
      flight: pickNullableString(row, ['flight']),
      season_label: pickNullableString(row, ['season_label', 'season']),
      session_label: pickNullableString(row, ['session_label', 'session']),
      match_date: pickNullableString(row, ['match_date', 'event_date', 'date', 'week_of', 'scheduled_for']),
    }))
    .filter((row) => row.player_name)
}

function datesLookEqual(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) return false
  const leftDate = String(left).slice(0, 10)
  const rightDate = String(right).slice(0, 10)
  return !!leftDate && leftDate === rightDate
}

function readLocal<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    return JSON.parse(raw) as T[]
  } catch {
    return []
  }
}

function writeLocal<T>(key: string, rows: T[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(rows))
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function extractPlayers(value: unknown): string[] {
  if (!value) return []
  if (typeof value === 'string') return value.trim() ? [value.trim()] : []
  if (Array.isArray(value)) return value.flatMap((item) => extractPlayers(item))
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>
    const direct = cleanText(obj.playerName) || cleanText(obj.name) || cleanText(obj.player) || cleanText(obj.player_name)
    if (direct) return [direct]
    return [
      ...extractPlayers(obj.players),
      ...extractPlayers(obj.names),
      ...extractPlayers(obj.roster),
      ...extractPlayers(obj.player_1),
      ...extractPlayers(obj.player_2),
    ]
  }
  return []
}

function inferSlotType(label: string, count: number): 'singles' | 'doubles' {
  const lower = label.toLowerCase()
  if (lower.includes('double') || lower.includes('court')) return 'doubles'
  return count >= 2 ? 'doubles' : 'singles'
}

function normalizeSlots(raw: unknown): NormalizedSlot[] {
  if (!raw) return []
  const rows: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw !== null
      ? (((raw as Record<string, unknown>).slots as unknown[]) || ((raw as Record<string, unknown>).lines as unknown[]) || [])
      : []

  return rows.map((item, index) => {
    if (typeof item === 'string') {
      return {
        key: `slot-${index}`,
        label: `Slot ${index + 1}`,
        slotType: 'singles' as const,
        players: item.trim() ? [item.trim()] : [],
      }
    }

    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>
      const label =
        cleanText(obj.label) ||
        cleanText(obj.line_name) ||
        cleanText(obj.position) ||
        cleanText(obj.court) ||
        cleanText(obj.line) ||
        `Slot ${index + 1}`
      const players = extractPlayers(
        obj.players ?? obj.player_names ?? obj.names ?? obj.roster ?? [obj.player_1, obj.player_2].filter(Boolean)
      )
      return {
        key: cleanText(obj.id) || `slot-${index}`,
        label,
        slotType: inferSlotType(label, players.length),
        players,
      }
    }

    return {
      key: `slot-${index}`,
      label: `Slot ${index + 1}`,
      slotType: 'singles' as const,
      players: [],
    }
  })
}

function eventDefaultMessage(kind: MessageKind, params: {
  teamName: string
  opponent: string
  dateText: string
  location: string
  arrivalTime: string
  lineupText: string
}) {
  const { teamName, opponent, dateText, location, arrivalTime, lineupText } = params
  if (kind === 'availability') {
    return `Hey ${teamName || 'team'} — please reply YES, NO, or MAYBE for ${dateText}. I am locking the lineup soon.`
  }
  if (kind === 'lineup') {
    return `Lineup is set for ${dateText} vs ${opponent || 'our opponent'}:\n${lineupText || 'Line assignments coming shortly.'}\nPlease arrive by ${arrivalTime || 'match time'}.`
  }
  if (kind === 'directions') {
    return `Match details for ${dateText}: ${location || 'facility details coming shortly.'} Please plan to arrive by ${arrivalTime || 'match time'}. Reply if you have any issues getting there.`
  }
  if (kind === 'reminder') {
    return `Reminder for ${dateText} vs ${opponent || 'our opponent'} — please arrive by ${arrivalTime || 'match time'}. Let me know immediately if your status changes.`
  }
  return `Following up for ${dateText}. I still need your response. Please reply ASAP so I can finalize the lineup.`
}

export default function CaptainMessagingPage() {
  const [screenWidth, setScreenWidth] = useState(1280)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [storageMode, setStorageMode] = useState<'supabase' | 'local'>('supabase')

  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([])
  const [availability, setAvailability] = useState<WeeklyAvailability[]>([])
  const [responses, setResponses] = useState<WeeklyResponse[]>([])
  const [lineups, setLineups] = useState<LineupAssignment[]>([])
  const [externalAvailabilityRows, setExternalAvailabilityRows] = useState<ExternalAvailabilityRow[]>([])
  const [availabilitySyncSource, setAvailabilitySyncSource] = useState<string | null>(null)

  const [leagueFilter, setLeagueFilter] = useState('')
  const [flightFilter, setFlightFilter] = useState('')
  const [seasonFilter, setSeasonFilter] = useState('')
  const [sessionFilter, setSessionFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [eventMatchId, setEventMatchId] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [eventDirections, setEventDirections] = useState('')
  const [eventArrivalTime, setEventArrivalTime] = useState('')
  const [eventNotes, setEventNotes] = useState('')
  const [selectedScenarioId, setSelectedScenarioId] = useState('')

  const [draftContact, setDraftContact] = useState<DraftContact>({
    full_name: '',
    phone: '',
    role: 'Player',
    is_captain: false,
    is_active: true,
    opt_in_text: true,
    notes: '',
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [bulkImportText, setBulkImportText] = useState('')

  const [recipientMode, setRecipientMode] = useState<RecipientMode>('available-only')
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([])
  const [messageKind, setMessageKind] = useState<MessageKind>('availability')
  const [messageTitle, setMessageTitle] = useState('Availability Check')
  const [messageBody, setMessageBody] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [copiedState, setCopiedState] = useState<'none' | 'body' | 'numbers'>('none')

  const isTablet = screenWidth < 1080
  const isMobile = screenWidth < 820
  const isSmallMobile = screenWidth < 560

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [matchesResult, contactsResult, templatesResult, scenariosResult] = await Promise.all([
          supabase.from('matches').select('id, match_date, league_name, flight, home_team, away_team').order('match_date', { ascending: false }),
          supabase.from(CONTACTS_TABLE).select('*').order('team_name', { ascending: true }).order('full_name', { ascending: true }),
          supabase.from(TEMPLATES_TABLE).select('*').order('template_name', { ascending: true }),
          supabase
            .from('lineup_scenarios')
            .select('id, scenario_name, league_name, flight, match_date, team_name, opponent_team, slots_json, notes')
            .order('match_date', { ascending: false })
            .order('scenario_name', { ascending: true }),
        ])

        if (!mounted) return

        const contactsOk = !contactsResult.error
        const templatesOk = !templatesResult.error

        if (matchesResult.error) throw matchesResult.error
        if (!contactsOk || !templatesOk) {
          setStorageMode('local')
          setContacts(readLocal<ContactRow>(CONTACTS_STORAGE_KEY))
          setTemplates(readLocal<TemplateRow>(TEMPLATES_STORAGE_KEY))
        } else {
          setStorageMode('supabase')
          setContacts((contactsResult.data ?? []) as ContactRow[])
          setTemplates((templatesResult.data ?? []) as TemplateRow[])
        }

        setMatches((matchesResult.data ?? []) as MatchRow[])
        setScenarios(((scenariosResult.data ?? []) as ScenarioRow[]) || [])

        let syncedAvailability: ExternalAvailabilityRow[] = []
        let syncedSource: string | null = null
        for (const tableName of AVAILABILITY_SOURCE_TABLES) {
          const availabilityResult = await supabase.from(tableName).select('*').limit(1000)
          if (!availabilityResult.error && availabilityResult.data) {
            const normalized = normalizeExternalAvailabilityRows(tableName, availabilityResult.data as unknown[])
            if (normalized.length) {
              syncedAvailability = normalized
              syncedSource = tableName
              break
            }
          }
        }
        setExternalAvailabilityRows(syncedAvailability)
        setAvailabilitySyncSource(syncedSource)

        setAvailability(readLocal<WeeklyAvailability>(AVAILABILITY_STORAGE_KEY))
        setResponses(readLocal<WeeklyResponse>(RESPONSES_STORAGE_KEY))
        setLineups(readLocal<LineupAssignment>(LINEUPS_STORAGE_KEY))

        const eventDetails = readLocal<Array<{ key: string; location: string; directions: string; arrivalTime: string; notes: string }>>(EVENT_DETAILS_STORAGE_KEY)
        if (eventDetails[0]) {
          setEventLocation(eventDetails[0].location || '')
          setEventDirections(eventDetails[0].directions || '')
          setEventArrivalTime(eventDetails[0].arrivalTime || '')
          setEventNotes(eventDetails[0].notes || '')
        }
      } catch (err) {
        if (!mounted) return
        setStorageMode('local')
        setContacts(readLocal<ContactRow>(CONTACTS_STORAGE_KEY))
        setTemplates(readLocal<TemplateRow>(TEMPLATES_STORAGE_KEY))
        setExternalAvailabilityRows([])
        setAvailabilitySyncSource(null)
        setAvailability(readLocal<WeeklyAvailability>(AVAILABILITY_STORAGE_KEY))
        setResponses(readLocal<WeeklyResponse>(RESPONSES_STORAGE_KEY))
        setLineups(readLocal<LineupAssignment>(LINEUPS_STORAGE_KEY))
        setError(err instanceof Error ? err.message : 'Unable to load captain messaging data.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const leagueOptions = useMemo(() => uniqueSorted([...contacts.map((c) => c.league_name), ...matches.map((m) => m.league_name), ...scenarios.map((s) => s.league_name)]), [contacts, matches, scenarios])
  const flightOptions = useMemo(() => uniqueSorted([...contacts.map((c) => c.flight), ...matches.map((m) => m.flight), ...scenarios.map((s) => s.flight)]), [contacts, matches, scenarios])
  const seasonOptions = useMemo(() => uniqueSorted([...contacts.map((c) => c.season_label), ...matches.map((m) => inferSeasonLabel(m.match_date))]), [contacts, matches])
  const sessionOptions = useMemo(() => uniqueSorted([...contacts.map((c) => c.session_label), ...matches.map((m) => inferSessionLabel(m.match_date))]), [contacts, matches])
  const teamOptions = useMemo(() => uniqueSorted([...contacts.map((c) => c.team_name), ...matches.flatMap((m) => [m.home_team, m.away_team]), ...scenarios.map((s) => s.team_name)]), [contacts, matches, scenarios])

  const scopedContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const leagueMatch = !leagueFilter || contact.league_name === leagueFilter
      const flightMatch = !flightFilter || contact.flight === flightFilter
      const seasonMatch = !seasonFilter || normalizeText(contact.season_label) === seasonFilter
      const sessionMatch = !sessionFilter || normalizeText(contact.session_label) === sessionFilter
      const teamMatch = !teamFilter || contact.team_name === teamFilter
      return leagueMatch && flightMatch && seasonMatch && sessionMatch && teamMatch
    })
  }, [contacts, leagueFilter, flightFilter, seasonFilter, sessionFilter, teamFilter])

  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      const inferredSeason = inferSeasonLabel(match.match_date)
      const inferredSession = inferSessionLabel(match.match_date)
      const matchTeam = [normalizeText(match.home_team), normalizeText(match.away_team)]
      const leagueMatch = !leagueFilter || match.league_name === leagueFilter
      const flightMatch = !flightFilter || match.flight === flightFilter
      const seasonMatch = !seasonFilter || normalizeText(inferredSeason) === seasonFilter
      const sessionMatch = !sessionFilter || normalizeText(inferredSession) === sessionFilter
      const teamMatch = !teamFilter || matchTeam.includes(teamFilter)
      return leagueMatch && flightMatch && seasonMatch && sessionMatch && teamMatch
    })
  }, [matches, leagueFilter, flightFilter, seasonFilter, sessionFilter, teamFilter])

  useEffect(() => {
    if (filteredMatches.length && !filteredMatches.some((match) => match.id === eventMatchId)) {
      setEventMatchId(filteredMatches[0].id)
    }
    if (!filteredMatches.length) setEventMatchId('')
  }, [filteredMatches, eventMatchId])

  const selectedMatch = filteredMatches.find((match) => match.id === eventMatchId) ?? null
  const inferredTeamName = teamFilter || normalizeText(selectedMatch?.home_team)
  const inferredOpponent = selectedMatch
    ? normalizeText(selectedMatch.home_team) === inferredTeamName
      ? normalizeText(selectedMatch.away_team)
      : normalizeText(selectedMatch.home_team)
    : ''
  const eventKey = safeKey(inferredTeamName, selectedMatch?.league_name, selectedMatch?.flight, selectedMatch?.match_date)

  const scenarioOptions = useMemo(() => {
    return scenarios.filter((scenario) => {
      const teamMatch = !inferredTeamName || scenario.team_name === inferredTeamName
      const leagueMatch = !leagueFilter || scenario.league_name === leagueFilter
      const flightMatch = !flightFilter || scenario.flight === flightFilter
      const dateMatch = !selectedMatch?.match_date || scenario.match_date === selectedMatch.match_date
      return teamMatch && leagueMatch && flightMatch && dateMatch
    })
  }, [scenarios, inferredTeamName, leagueFilter, flightFilter, selectedMatch])

  useEffect(() => {
    if (scenarioOptions.length && !scenarioOptions.some((scenario) => scenario.id === selectedScenarioId)) {
      setSelectedScenarioId(scenarioOptions[0].id)
    }
    if (!scenarioOptions.length) setSelectedScenarioId('')
  }, [scenarioOptions, selectedScenarioId])

  const selectedScenario = scenarioOptions.find((scenario) => scenario.id === selectedScenarioId) ?? null
  const lineupRows = useMemo(() => lineups.filter((row) => row.event_key === eventKey), [lineups, eventKey])
  const availabilityRows = useMemo(() => availability.filter((row) => row.event_key === eventKey), [availability, eventKey])
  const responseRows = useMemo(() => responses.filter((row) => row.event_key === eventKey), [responses, eventKey])

  const syncedAvailabilityCandidates = useMemo(() => {
    return externalAvailabilityRows.filter((row) => {
      const nameMatch = scopedContacts.some((contact) => contact.full_name.trim().toLowerCase() === row.player_name.trim().toLowerCase())
      const teamMatch = !teamFilter || !row.team_name || row.team_name === teamFilter
      const leagueMatch = !leagueFilter || !row.league_name || row.league_name === leagueFilter
      const flightMatch = !flightFilter || !row.flight || row.flight === flightFilter
      const seasonMatch = !seasonFilter || !row.season_label || normalizeText(row.season_label) === seasonFilter
      const sessionMatch = !sessionFilter || !row.session_label || normalizeText(row.session_label) === sessionFilter
      const dateMatch = !selectedMatch?.match_date || !row.match_date || datesLookEqual(row.match_date, selectedMatch.match_date)
      return nameMatch && teamMatch && leagueMatch && flightMatch && seasonMatch && sessionMatch && dateMatch
    })
  }, [externalAvailabilityRows, scopedContacts, teamFilter, leagueFilter, flightFilter, seasonFilter, sessionFilter, selectedMatch])

  useEffect(() => {
    const details = [{ key: eventKey, location: eventLocation, directions: eventDirections, arrivalTime: eventArrivalTime, notes: eventNotes }]
    writeLocal(EVENT_DETAILS_STORAGE_KEY, details)
  }, [eventKey, eventLocation, eventDirections, eventArrivalTime, eventNotes])

  useEffect(() => {
    if (!eventKey || !scopedContacts.length || !syncedAvailabilityCandidates.length) return
    const localRowsForEvent = availability.filter((row) => row.event_key === eventKey)
    if (localRowsForEvent.length) return

    const syncedRows: WeeklyAvailability[] = syncedAvailabilityCandidates
      .map((externalRow) => {
        const matchingContact = scopedContacts.find(
          (contact) => contact.full_name.trim().toLowerCase() === externalRow.player_name.trim().toLowerCase()
        )
        if (!matchingContact) return null
        return {
          id: createId(),
          event_key: eventKey,
          contact_id: matchingContact.id,
          status: externalRow.status,
          note: `Synced from ${externalRow.source_table}`,
          updated_at: new Date().toISOString(),
        } satisfies WeeklyAvailability
      })
      .filter((row): row is WeeklyAvailability => !!row)

    if (syncedRows.length) {
      saveAvailability([...availability.filter((row) => row.event_key !== eventKey), ...syncedRows])
    }
  }, [eventKey, scopedContacts, syncedAvailabilityCandidates, availability])

  useEffect(() => {
    if (!eventKey || lineupRows.length || !selectedScenario) return
    const slots = normalizeSlots(selectedScenario.slots_json)
    if (!slots.length) return
    const seededRows: LineupAssignment[] = slots.map((slot) => ({
      id: createId(),
      event_key: eventKey,
      court_label: slot.label,
      slot_type: slot.slotType,
      players: slot.players,
    }))
    saveLineups([...lineups.filter((row) => row.event_key !== eventKey), ...seededRows])
  }, [eventKey, lineupRows.length, selectedScenario])

  useEffect(() => {
    if (!selectedMatch) return
    const lineupText = lineupRows.length
      ? lineupRows.map((row) => `${row.court_label}: ${row.players.join(' / ') || 'Open'}`).join('\n')
      : ''
    const nextTitleMap: Record<MessageKind, string> = {
      availability: 'Availability Check',
      lineup: 'Lineup Announcement',
      directions: 'Directions + Match Details',
      reminder: 'Match Reminder',
      'follow-up': 'Follow-Up Reminder',
    }
    setMessageTitle(nextTitleMap[messageKind])
    setMessageBody((current) => {
      if (selectedTemplateId) return current
      return eventDefaultMessage(messageKind, {
        teamName: inferredTeamName,
        opponent: inferredOpponent,
        dateText: formatDate(selectedMatch.match_date),
        location: eventLocation,
        arrivalTime: eventArrivalTime,
        lineupText,
      })
    })
  }, [messageKind, selectedMatch, inferredTeamName, inferredOpponent, lineupRows, eventLocation, eventArrivalTime, selectedTemplateId])

  const availabilityMap = useMemo(() => new Map(availabilityRows.map((row) => [row.contact_id, row])), [availabilityRows])
  const responseMap = useMemo(() => new Map(responseRows.map((row) => [row.contact_id, row])), [responseRows])
  const lineupPlayerSet = useMemo(() => new Set(lineupRows.flatMap((row) => row.players.map((player) => player.toLowerCase()))), [lineupRows])

  const selectedRecipients = useMemo(() => {
    const base = scopedContacts.filter((contact) => contact.phone && contact.opt_in_text)
    if (recipientMode === 'captains') return base.filter((contact) => contact.is_captain)
    if (recipientMode === 'active-only') return base.filter((contact) => contact.is_active)
    if (recipientMode === 'available-only') {
      return base.filter((contact) => (availabilityMap.get(contact.id)?.status ?? 'no-response') === 'available')
    }
    if (recipientMode === 'lineup-only') {
      return base.filter((contact) => lineupPlayerSet.has(contact.full_name.toLowerCase()))
    }
    if (recipientMode === 'non-responders') {
      return base.filter((contact) => (responseMap.get(contact.id)?.status ?? 'no-response') === 'no-response')
    }
    if (recipientMode === 'custom') {
      return base.filter((contact) => selectedRecipientIds.includes(contact.id))
    }
    return base
  }, [scopedContacts, recipientMode, availabilityMap, lineupPlayerSet, responseMap, selectedRecipientIds])

  const recipientsPhones = useMemo(() => selectedRecipients.map((recipient) => recipient.phone).filter(Boolean), [selectedRecipients])
  const smsHref = buildSmsHref(recipientsPhones, messageBody)

  const availabilitySummary = useMemo(() => {
    let availableCount = 0
    let unavailableCount = 0
    let tentativeCount = 0
    let noResponseCount = 0
    scopedContacts.forEach((contact) => {
      const status = availabilityMap.get(contact.id)?.status ?? 'no-response'
      if (status === 'available') availableCount += 1
      else if (status === 'unavailable') unavailableCount += 1
      else if (status === 'tentative') tentativeCount += 1
      else noResponseCount += 1
    })
    return { availableCount, unavailableCount, tentativeCount, noResponseCount }
  }, [scopedContacts, availabilityMap])

  const responseSummary = useMemo(() => {
    let confirmedCount = 0
    let declinedCount = 0
    let viewedCount = 0
    let noResponseCount = 0
    let runningLateCount = 0
    let needSubCount = 0
    scopedContacts.forEach((contact) => {
      const status = responseMap.get(contact.id)?.status ?? 'no-response'
      if (status === 'confirmed') confirmedCount += 1
      else if (status === 'declined') declinedCount += 1
      else if (status === 'viewed') viewedCount += 1
      else if (status === 'running-late') runningLateCount += 1
      else if (status === 'need-sub') needSubCount += 1
      else noResponseCount += 1
    })
    return { confirmedCount, declinedCount, viewedCount, noResponseCount, runningLateCount, needSubCount }
  }, [scopedContacts, responseMap])

  async function saveContacts(nextContacts: ContactRow[]) {
    setContacts(nextContacts)
    if (storageMode === 'local') {
      writeLocal(CONTACTS_STORAGE_KEY, nextContacts)
      return
    }
    setSaving(true)
    const { error: upsertError } = await supabase.from(CONTACTS_TABLE).upsert(nextContacts)
    setSaving(false)
    if (upsertError) {
      setStorageMode('local')
      writeLocal(CONTACTS_STORAGE_KEY, nextContacts)
      setError(`Saved locally because remote contacts table is unavailable: ${upsertError.message}`)
    }
  }

  async function saveTemplates(nextTemplates: TemplateRow[]) {
    setTemplates(nextTemplates)
    if (storageMode === 'local') {
      writeLocal(TEMPLATES_STORAGE_KEY, nextTemplates)
      return
    }
    setSaving(true)
    const { error: upsertError } = await supabase.from(TEMPLATES_TABLE).upsert(nextTemplates)
    setSaving(false)
    if (upsertError) {
      setStorageMode('local')
      writeLocal(TEMPLATES_STORAGE_KEY, nextTemplates)
      setError(`Saved locally because remote templates table is unavailable: ${upsertError.message}`)
    }
  }

  function saveAvailability(nextRows: WeeklyAvailability[]) {
    setAvailability(nextRows)
    writeLocal(AVAILABILITY_STORAGE_KEY, nextRows)
  }

  function saveResponses(nextRows: WeeklyResponse[]) {
    setResponses(nextRows)
    writeLocal(RESPONSES_STORAGE_KEY, nextRows)
  }

  function saveLineups(nextRows: LineupAssignment[]) {
    setLineups(nextRows)
    writeLocal(LINEUPS_STORAGE_KEY, nextRows)
  }

  async function handleSaveContact() {
    const fullName = normalizeText(draftContact.full_name)
    const phone = normalizeText(draftContact.phone)
    if (!fullName || !phone || !teamFilter) {
      setError('Add a full name, phone number, and select a team scope before saving a contact.')
      return
    }

    const row: ContactRow = {
      id: editingId || createId(),
      team_name: teamFilter,
      league_name: leagueFilter || null,
      flight: flightFilter || null,
      season_label: seasonFilter || inferSeasonLabel(selectedMatch?.match_date) || null,
      session_label: sessionFilter || inferSessionLabel(selectedMatch?.match_date) || null,
      full_name: fullName,
      phone,
      role: draftContact.role || null,
      is_captain: draftContact.is_captain,
      is_active: draftContact.is_active,
      opt_in_text: draftContact.opt_in_text,
      notes: normalizeText(draftContact.notes) || null,
    }

    const withoutExisting = contacts.filter((contact) => contact.id !== row.id)
    await saveContacts([...withoutExisting, row].sort((a, b) => a.full_name.localeCompare(b.full_name)))
    setEditingId(null)
    setDraftContact({ full_name: '', phone: '', role: 'Player', is_captain: false, is_active: true, opt_in_text: true, notes: '' })
    setError(null)
  }

  function handleEditContact(contact: ContactRow) {
    setEditingId(contact.id)
    setDraftContact({
      full_name: contact.full_name,
      phone: contact.phone,
      role: contact.role || 'Player',
      is_captain: !!contact.is_captain,
      is_active: !!contact.is_active,
      opt_in_text: !!contact.opt_in_text,
      notes: contact.notes || '',
    })
  }

  async function handleDeleteContact(id: string) {
    const next = contacts.filter((contact) => contact.id !== id)
    setContacts(next)
    if (storageMode === 'local') {
      writeLocal(CONTACTS_STORAGE_KEY, next)
      return
    }
    const { error: deleteError } = await supabase.from(CONTACTS_TABLE).delete().eq('id', id)
    if (deleteError) {
      setStorageMode('local')
      writeLocal(CONTACTS_STORAGE_KEY, next)
      setError(`Deleted locally because remote contacts table is unavailable: ${deleteError.message}`)
    }
  }

  async function handleSaveTemplate() {
    if (!teamFilter || !messageTitle.trim() || !messageBody.trim()) {
      setError('Select a team and add a template title and message body first.')
      return
    }
    const template: TemplateRow = {
      id: createId(),
      team_name: teamFilter,
      league_name: leagueFilter || null,
      flight: flightFilter || null,
      season_label: seasonFilter || null,
      session_label: sessionFilter || null,
      template_name: messageTitle.trim(),
      message_body: messageBody.trim(),
    }
    await saveTemplates([...templates, template].sort((a, b) => a.template_name.localeCompare(b.template_name)))
  }

  async function handleDeleteTemplate(id: string) {
    const next = templates.filter((template) => template.id !== id)
    setTemplates(next)
    if (storageMode === 'local') {
      writeLocal(TEMPLATES_STORAGE_KEY, next)
      return
    }
    const { error: deleteError } = await supabase.from(TEMPLATES_TABLE).delete().eq('id', id)
    if (deleteError) {
      setStorageMode('local')
      writeLocal(TEMPLATES_STORAGE_KEY, next)
      setError(`Deleted locally because remote templates table is unavailable: ${deleteError.message}`)
    }
  }

  function handleBulkImport() {
    if (!teamFilter) {
      setError('Select a team scope before importing contacts.')
      return
    }
    const rows = bulkImportText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(',').map((part) => part.trim())
        const [full_name, phone, role = 'Player', tag = '', notes = ''] = parts
        return {
          id: createId(),
          team_name: teamFilter,
          league_name: leagueFilter || null,
          flight: flightFilter || null,
          season_label: seasonFilter || inferSeasonLabel(selectedMatch?.match_date) || null,
          session_label: sessionFilter || inferSessionLabel(selectedMatch?.match_date) || null,
          full_name,
          phone,
          role,
          is_captain: /capt/i.test(tag),
          is_active: !/inactive/i.test(tag),
          opt_in_text: !/optout/i.test(tag),
          notes: notes || null,
        } as ContactRow
      })
      .filter((row) => row.full_name && row.phone)

    if (!rows.length) {
      setError('Nothing valid to import. Use lines like: Name, Phone, Role, captain, note')
      return
    }

    void saveContacts([...contacts, ...rows].sort((a, b) => a.full_name.localeCompare(b.full_name)))
    setBulkImportText('')
    setError(null)
  }

  function setAvailabilityStatus(contactId: string, status: WeeklyAvailability['status']) {
    const next = availability.filter((row) => !(row.event_key === eventKey && row.contact_id === contactId))
    next.push({ id: createId(), event_key: eventKey, contact_id: contactId, status, note: availabilityMap.get(contactId)?.note || '', updated_at: new Date().toISOString() })
    saveAvailability(next)
  }

  function setResponseStatus(contactId: string, status: WeeklyResponse['status']) {
    const next = responses.filter((row) => !(row.event_key === eventKey && row.contact_id === contactId))
    next.push({ id: createId(), event_key: eventKey, contact_id: contactId, status, note: responseMap.get(contactId)?.note || '', updated_at: new Date().toISOString() })
    saveResponses(next)
  }

  function importScenarioToLineup() {
    if (!selectedScenario) return
    const slots = normalizeSlots(selectedScenario.slots_json)
    const next = lineups.filter((row) => row.event_key !== eventKey)
    next.push(
      ...slots.map((slot) => ({
        id: createId(),
        event_key: eventKey,
        court_label: slot.label,
        slot_type: slot.slotType,
        players: slot.players,
      }))
    )
    saveLineups(next)
  }

  function updateLineupPlayer(assignmentId: string, playerIndex: number, value: string) {
    const next = lineups.map((row) => {
      if (row.id !== assignmentId) return row
      const players = [...row.players]
      players[playerIndex] = value
      return { ...row, players }
    })
    saveLineups(next)
  }

  function addLineAssignment(slotType: 'singles' | 'doubles') {
    const next = [...lineups, {
      id: createId(),
      event_key: eventKey,
      court_label: slotType === 'singles' ? `Singles ${lineupRows.filter((r) => r.slot_type === 'singles').length + 1}` : `Court ${lineupRows.filter((r) => r.slot_type === 'doubles').length + 1}`,
      slot_type: slotType,
      players: slotType === 'singles' ? [''] : ['', ''],
    }]
    saveLineups(next)
  }

  function removeLineAssignment(assignmentId: string) {
    saveLineups(lineups.filter((row) => row.id !== assignmentId))
  }

  async function copyBody() {
    try {
      await navigator.clipboard.writeText(messageBody)
      setCopiedState('body')
      window.setTimeout(() => setCopiedState('none'), 1400)
    } catch {}
  }

  async function copyNumbers() {
    try {
      await navigator.clipboard.writeText(recipientsPhones.join(', '))
      setCopiedState('numbers')
      window.setTimeout(() => setCopiedState('none'), 1400)
    } catch {}
  }

  const scopedTemplates = useMemo(() => templates.filter((template) => !teamFilter || template.team_name === teamFilter), [templates, teamFilter])

  return (
    <SiteShell active="/captain">
      <section style={pageContentStyle}>
        <section style={heroShellResponsive(isTablet, isMobile)}>
          <div>
            <div style={eyebrow}>Captain communications</div>
            <h1 style={heroTitleResponsive(isSmallMobile, isMobile)}>Weekly Captain Console</h1>
            <p style={heroTextStyle}>
              Run the full weekly workflow in one place: choose the correct team and season group,
              see availability, build or import the lineup, text match details and directions, and
              track who has confirmed, declined, or still needs follow-up.
            </p>
            <div style={heroButtonRowStyle}>
              <Link href="/captains-corner/lineup-builder" style={primaryButton}>Open Lineup Builder</Link>
              <Link href="/captain" style={ghostButton}>Back to Captain&apos;s Corner</Link>
            </div>
            <div style={heroMetricGridStyle(isSmallMobile)}>
              <MetricStat label="Team contacts" value={String(scopedContacts.length)} />
              <MetricStat label="Available this week" value={String(availabilitySummary.availableCount)} />
              <MetricStat label="No response" value={String(responseSummary.noResponseCount)} />
            </div>
          </div>

          <div style={quickStartCard}>
            <p style={sectionKicker}>Weekly flow</p>
            <h2 style={quickStartTitle}>Built around how captains actually run a week</h2>
            <div style={workflowListStyle}>
              {[
                ['1', 'Pick the roster scope', 'League, flight, season, session, and team keep the correct contact list loaded.'],
                ['2', 'Track availability', 'Mark players available, unavailable, tentative, or no response for the upcoming week.'],
                ['3', 'Communicate lineup + details', 'Send lineup, arrival time, directions, and reminders only to the right group.'],
              ].map(([step, title, text]) => (
                <div key={step} style={workflowRowStyle}>
                  <div style={workflowNumberStyle}>{step}</div>
                  <div>
                    <div style={workflowTitleStyle}>{title}</div>
                    <div style={workflowTextStyle}>{text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={contentWrap}>
          <section style={surfaceCardStrong}>
            <div style={sectionHeaderStyle}>
              <div>
                <p style={sectionKicker}>Team scope</p>
                <h2 style={sectionTitle}>Roster + season/session filters</h2>
                <p style={sectionBodyTextStyle}>Load the correct contact list for the right league team and session before sending anything.</p>
              </div>
              <span style={storageMode === 'supabase' ? miniPillGreen : miniPillSlate}>{storageMode === 'supabase' ? 'Supabase-backed' : 'Local fallback mode'}</span>
            </div>

            <div style={filtersGridStyle}>
              <Field label="League">
                <select value={leagueFilter} onChange={(e) => setLeagueFilter(e.target.value)} style={inputStyle}>
                  <option value="">All</option>
                  {leagueOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Flight">
                <select value={flightFilter} onChange={(e) => setFlightFilter(e.target.value)} style={inputStyle}>
                  <option value="">All</option>
                  {flightOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Season">
                <select value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)} style={inputStyle}>
                  <option value="">All</option>
                  {seasonOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Session">
                <select value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)} style={inputStyle}>
                  <option value="">All</option>
                  {sessionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Team">
                <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} style={inputStyle}>
                  <option value="">All</option>
                  {teamOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Upcoming match">
                <select value={eventMatchId} onChange={(e) => setEventMatchId(e.target.value)} style={inputStyle}>
                  <option value="">Select match</option>
                  {filteredMatches.map((match) => (
                    <option key={match.id} value={match.id}>
                      {formatDate(match.match_date)} • {match.home_team || 'TBD'} vs {match.away_team || 'TBD'}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div style={pillRowStyle}>
              <span style={miniPillSlate}>{scopedContacts.length} in roster scope</span>
              <span style={miniPillBlue}>{availabilitySummary.availableCount} available</span>
              <span style={miniPillGreen}>{responseSummary.confirmedCount} confirmed</span>
              <span style={warnPill}>{responseSummary.noResponseCount} still waiting</span>
              {availabilitySyncSource ? <span style={miniPillBlue}>Availability sync: {availabilitySyncSource}</span> : <span style={miniPillSlate}>Availability sync: manual/local</span>}
            </div>
          </section>

          {loading ? (
            <section style={surfaceCard}><p style={mutedTextStyle}>Loading captain console...</p></section>
          ) : (
            <>
              {error ? <section style={surfaceCard}><p style={errorTextStyle}>{error}</p></section> : null}

              <section style={twoColumnGridResponsive(isTablet)}>
                <section style={surfaceCard}>
                  <div style={tableHeaderStyle}>
                    <div>
                      <p style={sectionKicker}>Weekly event setup</p>
                      <h3 style={sectionTitleSmall}>Match details + directions</h3>
                    </div>
                    <span style={miniPillSlate}>{selectedMatch ? formatDate(selectedMatch.match_date) : 'No match selected'}</span>
                  </div>

                  <div style={filtersGridStyle}>
                    <Field label="Opponent">
                      <input value={inferredOpponent} readOnly style={inputStyleMuted} />
                    </Field>
                    <Field label="Arrival time">
                      <input value={eventArrivalTime} onChange={(e) => setEventArrivalTime(e.target.value)} placeholder="7:15 PM" style={inputStyle} />
                    </Field>
                    <Field label="Location">
                      <input value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="Club name + address" style={inputStyle} />
                    </Field>
                    <Field label="Directions / parking / gate code">
                      <textarea value={eventDirections} onChange={(e) => setEventDirections(e.target.value)} placeholder="Parking lot entry, courts, pro shop, etc." style={textareaStyle} />
                    </Field>
                  </div>

                  <Field label="Captain notes for the week">
                    <textarea value={eventNotes} onChange={(e) => setEventNotes(e.target.value)} placeholder="Rain plan, warm-up court, expected finish, balls, uniforms, snacks..." style={textareaStyle} />
                  </Field>
                </section>

                <section style={surfaceCard}>
                  <div style={tableHeaderStyle}>
                    <div>
                      <p style={sectionKicker}>Availability pulse</p>
                      <h3 style={sectionTitleSmall}>Who is in this week?</h3>
                    </div>
                    <span style={miniPillSlate}>{scopedContacts.length} tracked</span>
                  </div>

                  <div style={statsGridStyle}>
                    <MetricMini label="Available" value={String(availabilitySummary.availableCount)} pill={miniPillGreen} />
                    <MetricMini label="Tentative" value={String(availabilitySummary.tentativeCount)} pill={miniPillBlue} />
                    <MetricMini label="Unavailable" value={String(availabilitySummary.unavailableCount)} pill={warnPill} />
                    <MetricMini label="No response" value={String(availabilitySummary.noResponseCount)} pill={miniPillSlate} />
                  </div>
                </section>
              </section>

              <section style={surfaceCard}>
                <div style={tableHeaderStyle}>
                  <div>
                    <p style={sectionKicker}>Roster availability + responses</p>
                    <h3 style={sectionTitleSmall}>Update the week contact by contact</h3>
                  </div>
                </div>
                <div style={tableWrapStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Player</th>
                        <th style={thStyle}>Phone</th>
                        <th style={thStyle}>Availability</th>
                        <th style={thStyle}>Response</th>
                        <th style={thStyle}>Flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scopedContacts.map((contact) => {
                        const availabilityStatus = availabilityMap.get(contact.id)?.status ?? 'no-response'
                        const responseStatus = responseMap.get(contact.id)?.status ?? 'no-response'
                        return (
                          <tr key={contact.id}>
                            <td style={tdLabelStyle}>
                              <div>{contact.full_name}</div>
                              <div style={rowSubtleText}>{contact.role || 'Player'}</div>
                            </td>
                            <td style={tdStyle}>{formatPhone(contact.phone)}</td>
                            <td style={tdStyle}>
                              <div style={rowControlWrapStyle}>
                                {(['available', 'tentative', 'unavailable', 'no-response'] as WeeklyAvailability['status'][]).map((status) => (
                                  <button key={status} type="button" onClick={() => setAvailabilityStatus(contact.id, status)} style={availabilityStatus === status ? statusButtonActive(status) : statusButtonStyle}>
                                    {status.replace('-', ' ')}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td style={tdStyle}>
                              <div style={rowControlWrapStyle}>
                                {(['confirmed', 'viewed', 'declined', 'running-late', 'need-sub', 'no-response'] as WeeklyResponse['status'][]).map((status) => (
                                  <button key={status} type="button" onClick={() => setResponseStatus(contact.id, status)} style={responseStatus === status ? responseButtonActive(status) : statusButtonStyle}>
                                    {status.replace('-', ' ')}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td style={tdStyle}>
                              <div style={pillRowStyle}>
                                {contact.is_captain ? <span style={miniPillBlue}>Captain</span> : null}
                                {contact.is_active ? <span style={miniPillGreen}>Active</span> : <span style={miniPillSlate}>Inactive</span>}
                                {contact.opt_in_text ? <span style={miniPillSlate}>Text OK</span> : <span style={warnPill}>Opted out</span>}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section style={twoColumnGridResponsive(isTablet)}>
                <section style={surfaceCardStrong}>
                  <div style={tableHeaderStyle}>
                    <div>
                      <p style={sectionKicker}>Lineup communication</p>
                      <h3 style={sectionTitleSmall}>Import or build the weekly lineup</h3>
                    </div>
                    <div style={pillRowStyle}>
                      <button type="button" style={ghostButtonSmallButton} onClick={() => addLineAssignment('singles')}>Add singles</button>
                      <button type="button" style={ghostButtonSmallButton} onClick={() => addLineAssignment('doubles')}>Add doubles</button>
                      {selectedScenario ? <span style={miniPillSlate}>Auto-seeded from {selectedScenario.scenario_name}</span> : null}
                    </div>
                  </div>

                  <div style={filtersGridStyle}>
                    <Field label="Saved scenario">
                      <select value={selectedScenarioId} onChange={(e) => setSelectedScenarioId(e.target.value)} style={inputStyle}>
                        <option value="">Select scenario</option>
                        {scenarioOptions.map((scenario) => (
                          <option key={scenario.id} value={scenario.id}>{scenario.scenario_name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Import to weekly lineup">
                      <button type="button" style={primaryButtonBlock} onClick={importScenarioToLineup} disabled={!selectedScenario}>Import scenario</button>
                    </Field>
                  </div>

                  <div style={lineupStackStyle}>
                    {lineupRows.length === 0 ? (
                      <p style={mutedTextStyle}>No lineup assignments yet. Import a saved scenario or add courts manually.</p>
                    ) : lineupRows.map((row) => (
                      <div key={row.id} style={lineupCardStyle}>
                        <div style={lineupHeaderStyle}>
                          <span style={row.slot_type === 'doubles' ? miniPillBlue : miniPillGreen}>{row.court_label}</span>
                          <button type="button" style={linkButtonStyle} onClick={() => removeLineAssignment(row.id)}>Remove</button>
                        </div>
                        <div style={row.slot_type === 'doubles' ? lineupPlayersGrid : singlePlayerGrid}>
                          {row.players.map((player, index) => (
                            <input
                              key={`${row.id}-${index}`}
                              value={player}
                              onChange={(e) => updateLineupPlayer(row.id, index, e.target.value)}
                              placeholder={row.slot_type === 'doubles' ? `Player ${index + 1}` : 'Player'}
                              style={inputStyle}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section style={surfaceCard}>
                  <div style={tableHeaderStyle}>
                    <div>
                      <p style={sectionKicker}>Composer</p>
                      <h3 style={sectionTitleSmall}>Availability, lineup, directions, reminders</h3>
                    </div>
                    <span style={miniPillSlate}>{selectedRecipients.length} recipients</span>
                  </div>

                  <div style={filtersGridStyle}>
                    <Field label="Message type">
                      <select value={messageKind} onChange={(e) => setMessageKind(e.target.value as MessageKind)} style={inputStyle}>
                        <option value="availability">Availability check</option>
                        <option value="lineup">Lineup announcement</option>
                        <option value="directions">Directions + details</option>
                        <option value="reminder">Match reminder</option>
                        <option value="follow-up">Follow-up</option>
                      </select>
                    </Field>
                    <Field label="Recipient mode">
                      <select value={recipientMode} onChange={(e) => setRecipientMode(e.target.value as RecipientMode)} style={inputStyle}>
                        <option value="all-opted-in">All opted-in</option>
                        <option value="captains">Captains only</option>
                        <option value="active-only">Active only</option>
                        <option value="available-only">Available only</option>
                        <option value="lineup-only">Lineup only</option>
                        <option value="non-responders">Non-responders only</option>
                        <option value="custom">Custom</option>
                      </select>
                    </Field>
                    <Field label="Saved template">
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => {
                          const value = e.target.value
                          setSelectedTemplateId(value)
                          const template = scopedTemplates.find((item) => item.id === value)
                          if (template) {
                            setMessageTitle(template.template_name)
                            setMessageBody(template.message_body)
                          }
                        }}
                        style={inputStyle}
                      >
                        <option value="">None</option>
                        {scopedTemplates.map((template) => <option key={template.id} value={template.id}>{template.template_name}</option>)}
                      </select>
                    </Field>
                    <Field label="Message title">
                      <input value={messageTitle} onChange={(e) => setMessageTitle(e.target.value)} style={inputStyle} />
                    </Field>
                  </div>

                  {recipientMode === 'custom' ? (
                    <div style={recipientChooserStyle}>
                      {scopedContacts.filter((c) => c.phone && c.opt_in_text).map((contact) => (
                        <label key={contact.id} style={checkboxRowStyle}>
                          <input
                            type="checkbox"
                            checked={selectedRecipientIds.includes(contact.id)}
                            onChange={(e) => {
                              setSelectedRecipientIds((current) =>
                                e.target.checked ? [...current, contact.id] : current.filter((id) => id !== contact.id)
                              )
                            }}
                          />
                          <span>{contact.full_name}</span>
                        </label>
                      ))}
                    </div>
                  ) : null}

                  <Field label="Message body">
                    <textarea value={messageBody} onChange={(e) => setMessageBody(e.target.value)} style={textareaStyleLarge} />
                  </Field>

                  <div style={pillRowStyle}>
                    <span style={miniPillSlate}>{selectedRecipients.map((r) => r.full_name).join(', ') || 'No recipients selected'}</span>
                  </div>

                  <div style={actionRowStyle}>
                    <a href={smsHref} style={primaryButton}>Open texts</a>
                    <button type="button" style={ghostButtonSmallButton} onClick={copyBody}>{copiedState === 'body' ? 'Copied body' : 'Copy body'}</button>
                    <button type="button" style={ghostButtonSmallButton} onClick={copyNumbers}>{copiedState === 'numbers' ? 'Copied numbers' : 'Copy numbers'}</button>
                    <button type="button" style={ghostButtonSmallButton} onClick={() => void handleSaveTemplate()}>Save template</button>
                  </div>
                </section>
              </section>

              <section style={twoColumnGridResponsive(isTablet)}>
                <section style={surfaceCard}>
                  <div style={tableHeaderStyle}>
                    <div>
                      <p style={sectionKicker}>Response dashboard</p>
                      <h3 style={sectionTitleSmall}>Who replied and who needs a follow-up</h3>
                    </div>
                  </div>
                  <div style={statsGridStyle}>
                    <MetricMini label="Confirmed" value={String(responseSummary.confirmedCount)} pill={miniPillGreen} />
                    <MetricMini label="Declined" value={String(responseSummary.declinedCount)} pill={warnPill} />
                    <MetricMini label="Viewed" value={String(responseSummary.viewedCount)} pill={miniPillBlue} />
                    <MetricMini label="Need sub" value={String(responseSummary.needSubCount)} pill={warnPill} />
                    <MetricMini label="Running late" value={String(responseSummary.runningLateCount)} pill={miniPillBlue} />
                    <MetricMini label="Still waiting" value={String(responseSummary.noResponseCount)} pill={miniPillSlate} />
                  </div>
                  <div style={actionRowStyle}>
                    <button type="button" style={ghostButtonSmallButton} onClick={() => setRecipientMode('non-responders')}>Target non-responders</button>
                    <button type="button" style={ghostButtonSmallButton} onClick={() => setMessageKind('follow-up')}>Load follow-up message</button>
                  </div>
                </section>

                <section style={surfaceCard}>
                  <div style={tableHeaderStyle}>
                    <div>
                      <p style={sectionKicker}>Contact roster manager</p>
                      <h3 style={sectionTitleSmall}>Add or edit team cell numbers</h3>
                    </div>
                    {saving ? <span style={miniPillSlate}>Saving…</span> : null}
                  </div>

                  <div style={filtersGridStyle}>
                    <Field label="Full name"><input value={draftContact.full_name} onChange={(e) => setDraftContact((c) => ({ ...c, full_name: e.target.value }))} style={inputStyle} /></Field>
                    <Field label="Cell phone"><input value={draftContact.phone} onChange={(e) => setDraftContact((c) => ({ ...c, phone: e.target.value }))} style={inputStyle} /></Field>
                    <Field label="Role"><input value={draftContact.role} onChange={(e) => setDraftContact((c) => ({ ...c, role: e.target.value }))} style={inputStyle} /></Field>
                    <Field label="Notes"><input value={draftContact.notes} onChange={(e) => setDraftContact((c) => ({ ...c, notes: e.target.value }))} style={inputStyle} /></Field>
                  </div>

                  <div style={checkboxGridStyle}>
                    <label style={checkboxRowStyle}><input type="checkbox" checked={draftContact.is_captain} onChange={(e) => setDraftContact((c) => ({ ...c, is_captain: e.target.checked }))} /> Captain</label>
                    <label style={checkboxRowStyle}><input type="checkbox" checked={draftContact.is_active} onChange={(e) => setDraftContact((c) => ({ ...c, is_active: e.target.checked }))} /> Active</label>
                    <label style={checkboxRowStyle}><input type="checkbox" checked={draftContact.opt_in_text} onChange={(e) => setDraftContact((c) => ({ ...c, opt_in_text: e.target.checked }))} /> Opted in to text</label>
                  </div>

                  <div style={actionRowStyle}>
                    <button type="button" style={primaryButton} onClick={() => void handleSaveContact()}>{editingId ? 'Update contact' : 'Save contact'}</button>
                    {editingId ? <button type="button" style={ghostButtonSmallButton} onClick={() => {
                      setEditingId(null)
                      setDraftContact({ full_name: '', phone: '', role: 'Player', is_captain: false, is_active: true, opt_in_text: true, notes: '' })
                    }}>Cancel edit</button> : null}
                  </div>

                  <Field label="Bulk import (Name, Phone, Role, captain, note)">
                    <textarea value={bulkImportText} onChange={(e) => setBulkImportText(e.target.value)} style={textareaStyle} placeholder={'Jane Smith, 314-555-1111, Player, captain, early arrival\nJohn Doe, 314-555-2222, Player, , doubles only'} />
                  </Field>
                  <button type="button" style={ghostButtonSmallButton} onClick={handleBulkImport}>Import contacts</button>
                </section>
              </section>

              <section style={surfaceCard}>
                <div style={tableHeaderStyle}>
                  <div>
                    <p style={sectionKicker}>Current roster in scope</p>
                    <h3 style={sectionTitleSmall}>Team contacts</h3>
                  </div>
                </div>
                <div style={tableWrapStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Name</th>
                        <th style={thStyle}>Phone</th>
                        <th style={thStyle}>Scope</th>
                        <th style={thStyle}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scopedContacts.map((contact) => (
                        <tr key={contact.id}>
                          <td style={tdLabelStyle}>{contact.full_name}</td>
                          <td style={tdStyle}>{formatPhone(contact.phone)}</td>
                          <td style={tdStyle}>{[contact.team_name, contact.season_label, contact.session_label].filter(Boolean).join(' • ') || '—'}</td>
                          <td style={tdStyle}>
                            <div style={actionRowStyleCompact}>
                              <button type="button" style={linkButtonStyle} onClick={() => handleEditContact(contact)}>Edit</button>
                              <button type="button" style={linkButtonStyleDanger} onClick={() => void handleDeleteContact(contact.id)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section style={surfaceCard}>
                <div style={tableHeaderStyle}>
                  <div>
                    <p style={sectionKicker}>Saved message templates</p>
                    <h3 style={sectionTitleSmall}>Reusable captain texts</h3>
                  </div>
                </div>
                <div style={templateGridStyle}>
                  {scopedTemplates.length === 0 ? (
                    <p style={mutedTextStyle}>No templates saved yet.</p>
                  ) : scopedTemplates.map((template) => (
                    <div key={template.id} style={templateCardStyle}>
                      <div style={lineupHeaderStyle}>
                        <div style={templateTitleStyle}>{template.template_name}</div>
                        <button type="button" style={linkButtonStyleDanger} onClick={() => void handleDeleteTemplate(template.id)}>Delete</button>
                      </div>
                      <p style={templateBodyStyle}>{template.message_body}</p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </section>
      </section>
    </SiteShell>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function MetricStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={heroMetricCardStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={metricValueStyleHero}>{value}</div>
    </div>
  )
}

function MetricMini({ label, value, pill }: { label: string; value: string; pill: CSSProperties }) {
  return (
    <div style={miniMetricCardStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={miniMetricValueStyle}>{value}</div>
      <span style={pill}>{label}</span>
    </div>
  )
}

function heroShellResponsive(isTablet: boolean, isMobile: boolean): CSSProperties {
  return {
    ...heroShell,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.45fr) minmax(320px, 0.95fr)',
    gap: isMobile ? 18 : 24,
    padding: isMobile ? '26px 18px' : '34px 26px',
  }
}

function heroTitleResponsive(isSmallMobile: boolean, isMobile: boolean): CSSProperties {
  return {
    ...heroTitleStyle,
    fontSize: isSmallMobile ? '34px' : isMobile ? '42px' : '50px',
  }
}

function heroMetricGridStyle(isSmallMobile: boolean): CSSProperties {
  return {
    ...heroMetricGridBaseStyle,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  }
}

function twoColumnGridResponsive(isTablet: boolean): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: isTablet ? '1fr' : 'repeat(2, minmax(0, 1fr))',
    gap: 18,
  }
}

function statusButtonActive(status: WeeklyAvailability['status']): CSSProperties {
  if (status === 'available') return { ...statusButtonStyle, ...miniPillGreen }
  if (status === 'tentative') return { ...statusButtonStyle, ...miniPillBlue }
  if (status === 'unavailable') return { ...statusButtonStyle, ...warnPill }
  return { ...statusButtonStyle, ...miniPillSlate }
}

function responseButtonActive(status: WeeklyResponse['status']): CSSProperties {
  if (status === 'confirmed') return { ...statusButtonStyle, ...miniPillGreen }
  if (status === 'declined' || status === 'need-sub') return { ...statusButtonStyle, ...warnPill }
  if (status === 'viewed' || status === 'running-late') return { ...statusButtonStyle, ...miniPillBlue }
  return { ...statusButtonStyle, ...miniPillSlate }
}

const pageContentStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '18px 24px 0',
}

const heroShell: CSSProperties = {
  position: 'relative',
  display: 'grid',
  borderRadius: '34px',
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'linear-gradient(135deg, rgba(14,39,82,0.88) 0%, rgba(11,30,64,0.90) 52%, rgba(8,27,56,0.92) 100%)',
  boxShadow: '0 28px 80px rgba(3, 10, 24, 0.30)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '38px',
  padding: '8px 14px',
  borderRadius: '999px',
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(155,225,29,0.12)',
  color: '#d9e7ef',
  fontWeight: 800,
  fontSize: '14px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '4px',
}

const heroTitleStyle: CSSProperties = {
  margin: 0,
  color: '#f7fbff',
  fontWeight: 900,
  lineHeight: 0.98,
  letterSpacing: '-0.055em',
  maxWidth: '760px',
}

const heroTextStyle: CSSProperties = {
  marginTop: 16,
  marginBottom: 0,
  maxWidth: 820,
  color: 'rgba(231,239,251,0.78)',
  fontSize: '1.02rem',
  lineHeight: 1.72,
}

const heroButtonRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  marginTop: 22,
}

const heroMetricGridBaseStyle: CSSProperties = {
  marginTop: 22,
  display: 'grid',
  gap: 14,
}

const heroMetricCardStyle: CSSProperties = {
  borderRadius: '22px',
  padding: '16px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(58,115,212,0.16) 0%, rgba(20,43,86,0.34) 100%)',
}

const metricLabelStyle: CSSProperties = {
  color: 'rgba(225,236,250,0.72)',
  fontSize: '0.82rem',
  marginBottom: '0.42rem',
  fontWeight: 700,
}

const metricValueStyleHero: CSSProperties = {
  color: '#f8fbff',
  fontSize: '1.05rem',
  fontWeight: 800,
  lineHeight: 1.4,
}

const quickStartCard: CSSProperties = {
  borderRadius: '28px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'linear-gradient(180deg, rgba(29,56,105,0.62), rgba(14,30,59,0.78))',
  padding: '20px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const quickStartTitle: CSSProperties = {
  marginTop: 10,
  marginBottom: 14,
  fontSize: '1.35rem',
  lineHeight: 1.14,
  color: '#ffffff',
}

const workflowListStyle: CSSProperties = { display: 'grid', gap: 12 }
const workflowRowStyle: CSSProperties = { display: 'flex', gap: 12, alignItems: 'flex-start' }
const workflowNumberStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  fontSize: '.92rem',
  color: '#0f1632',
  background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)',
  flexShrink: 0,
}
const workflowTitleStyle: CSSProperties = { fontWeight: 700, color: '#ffffff', marginBottom: 4 }
const workflowTextStyle: CSSProperties = { color: 'rgba(231,239,251,0.72)', lineHeight: 1.55, fontSize: '.95rem' }

const contentWrap: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 18, marginTop: 18 }

const surfaceCardStrong: CSSProperties = {
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'radial-gradient(circle at top right, rgba(155,225,29,0.10), transparent 34%), linear-gradient(135deg, rgba(13,42,90,0.82) 0%, rgba(8,27,59,0.90) 58%, rgba(7,30,62,0.94) 100%)',
  boxShadow: '0 24px 60px rgba(2, 8, 23, 0.24)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
}

const surfaceCard: CSSProperties = {
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(180deg, rgba(58,115,212,0.14) 0%, rgba(16,34,70,0.42) 100%)',
  boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
}

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  flexWrap: 'wrap',
  marginBottom: 16,
}

const sectionKicker: CSSProperties = {
  color: '#8fb7ff',
  fontWeight: 800,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  margin: 0,
}

const sectionTitle: CSSProperties = {
  margin: '8px 0',
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '28px',
  letterSpacing: '-0.04em',
  lineHeight: 1.1,
}

const sectionTitleSmall: CSSProperties = {
  margin: '8px 0 0 0',
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '22px',
  letterSpacing: '-0.03em',
  lineHeight: 1.15,
}

const sectionBodyTextStyle: CSSProperties = { margin: 0, color: 'rgba(224,234,247,0.76)', lineHeight: 1.65, maxWidth: 780 }

const filtersGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }
const statsGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }
const miniMetricCardStyle: CSSProperties = { borderRadius: 18, padding: 14, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }
const miniMetricValueStyle: CSSProperties = { color: '#f8fbff', fontSize: '1.15rem', fontWeight: 900, marginBottom: 10 }

const labelStyle: CSSProperties = { display: 'block', marginBottom: 8, color: 'rgba(198,216,248,0.84)', fontSize: '13px', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }
const inputStyle: CSSProperties = { width: '100%', height: '48px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#f8fbff', padding: '0 14px', fontSize: '14px', outline: 'none' }
const inputStyleMuted: CSSProperties = { ...inputStyle, opacity: 0.78 }
const textareaStyle: CSSProperties = { width: '100%', minHeight: '100px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#f8fbff', padding: '12px 14px', fontSize: '14px', outline: 'none', resize: 'vertical' }
const textareaStyleLarge: CSSProperties = { ...textareaStyle, minHeight: 180 }

const primaryButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 46, padding: '0 16px', borderRadius: 999, textDecoration: 'none', fontWeight: 800, background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)', color: '#071622', border: '1px solid rgba(155,225,29,0.34)', boxShadow: '0 16px 32px rgba(74, 222, 128, 0.14)' }
const primaryButtonBlock: CSSProperties = { ...primaryButton, width: '100%', appearance: 'none', cursor: 'pointer' }
const ghostButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 46, padding: '0 16px', borderRadius: 999, textDecoration: 'none', fontWeight: 800, background: 'linear-gradient(180deg, rgba(58,115,212,0.18) 0%, rgba(27,62,120,0.14) 100%)', color: '#ebf1fd', border: '1px solid rgba(116,190,255,0.18)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }
const ghostButtonSmallButton: CSSProperties = { ...ghostButton, minHeight: 42, cursor: 'pointer', appearance: 'none' }

const badgeBase: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 30, padding: '0 12px', borderRadius: 999, fontSize: 12, fontWeight: 800 }
const miniPillSlate: CSSProperties = { ...badgeBase, background: 'rgba(255,255,255,0.08)', color: '#dfe8f8' }
const miniPillBlue: CSSProperties = { ...badgeBase, background: 'rgba(37, 91, 227, 0.16)', color: '#c7dbff' }
const miniPillGreen: CSSProperties = { ...badgeBase, background: 'rgba(155,225,29,0.14)', color: '#e7ffd1' }
const warnPill: CSSProperties = { ...badgeBase, background: 'rgba(255, 93, 93, 0.10)', color: '#fecaca' }
const pillRowStyle: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }

const tableHeaderStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }
const tableWrapStyle: CSSProperties = { width: '100%', overflowX: 'auto', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.08)' }
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse' }
const thStyle: CSSProperties = { textAlign: 'left', padding: '14px', background: 'rgba(255,255,255,0.06)', color: '#c7dbff', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.06em' }
const tdStyle: CSSProperties = { padding: '14px', borderTop: '1px solid rgba(255,255,255,0.08)', color: '#f8fbff', verticalAlign: 'top' }
const tdLabelStyle: CSSProperties = { ...tdStyle, fontWeight: 800 }
const mutedTextStyle: CSSProperties = { color: 'rgba(224,234,247,0.72)', margin: 0, lineHeight: 1.65 }
const errorTextStyle: CSSProperties = { color: '#fca5a5', margin: 0, lineHeight: 1.65 }
const rowSubtleText: CSSProperties = { color: 'rgba(224,234,247,0.62)', fontSize: 12, fontWeight: 600, marginTop: 4 }

const rowControlWrapStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6 }
const statusButtonStyle: CSSProperties = { borderRadius: 999, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#dfe8f8', padding: '6px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer', textTransform: 'capitalize' }

const lineupStackStyle: CSSProperties = { display: 'grid', gap: 12, marginTop: 14 }
const lineupCardStyle: CSSProperties = { borderRadius: 18, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', padding: 14 }
const lineupHeaderStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }
const lineupPlayersGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }
const singlePlayerGrid: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr', gap: 10 }
const linkButtonStyle: CSSProperties = { border: 'none', background: 'transparent', color: '#9cc6ff', fontWeight: 800, cursor: 'pointer', padding: 0 }
const linkButtonStyleDanger: CSSProperties = { ...linkButtonStyle, color: '#fca5a5' }
const recipientChooserStyle: CSSProperties = { maxHeight: 180, overflow: 'auto', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', padding: 12, display: 'grid', gap: 8, marginBottom: 14 }
const checkboxGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }
const checkboxRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, color: '#f8fbff' }
const actionRowStyle: CSSProperties = { display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }
const actionRowStyleCompact: CSSProperties = { display: 'flex', gap: 12, flexWrap: 'wrap' }

const templateGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }
const templateCardStyle: CSSProperties = { borderRadius: 18, padding: 14, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }
const templateTitleStyle: CSSProperties = { color: '#f8fbff', fontWeight: 800 }
const templateBodyStyle: CSSProperties = { color: 'rgba(231,239,251,0.76)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }
