'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import CaptainFormField from '@/app/components/captain-form-field'
import SiteShell from '@/app/components/site-shell'
import { supabase } from '@/lib/supabase'
import { uniqueSorted } from '@/lib/captain-formatters'
import { normalizeUserRole, isCaptain, type UserRole } from '@/lib/roles'
import { demoMatch, demoScenario, demoAvailability, demoResponses } from '@/lib/demo-data'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

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

function safeKey(...parts: Array<string | null | undefined>) {
  return parts.map((part) => normalizeText(part).toLowerCase() || '—').join('|')
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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


function demoEventKey() {
  return safeKey(demoScenario.team_name || demoMatch.home_team, demoScenario.league_name || demoMatch.league_name, demoScenario.flight || demoMatch.flight, demoScenario.match_date || demoMatch.match_date)
}

function buildDemoContacts(): ContactRow[] {
  const names = Array.from(
    new Set([
      ...normalizeSlots(demoScenario.slots_json).flatMap((slot) => slot.players),
      ...demoAvailability.map((row) => normalizeText((row as { name?: string }).name)),
      ...demoResponses.map((row) => normalizeText((row as { name?: string }).name)),
    ].map((name) => normalizeText(name)).filter(Boolean))
  )

  return names.map((name, index) => ({
    id: `demo-contact-${index + 1}`,
    team_name: demoScenario.team_name || demoMatch.home_team || 'Demo Team',
    league_name: demoScenario.league_name || demoMatch.league_name || null,
    flight: demoScenario.flight || demoMatch.flight || null,
    season_label: inferSeasonLabel(demoScenario.match_date || demoMatch.match_date) || null,
    session_label: inferSessionLabel(demoScenario.match_date || demoMatch.match_date) || null,
    full_name: name,
    phone: `555000${String(index + 1).padStart(4, '0')}`,
    role: index === 0 ? 'Captain' : 'Player',
    is_captain: index === 0,
    is_active: true,
    opt_in_text: true,
    notes: 'Demo contact',
  }))
}

function buildDemoAvailabilityRows(contacts: ContactRow[]): WeeklyAvailability[] {
  const eventKey = demoEventKey()
  const statusByName = new Map(
    demoAvailability.map((row) => [
      normalizeText((row as { name?: string }).name).toLowerCase(),
      normalizeText((row as { status?: string }).status).toLowerCase(),
    ])
  )

  return contacts.map((contact) => {
    const rawStatus = statusByName.get(contact.full_name.toLowerCase()) || 'no-response'
    const normalizedStatus: WeeklyAvailability['status'] =
      rawStatus === 'yes' || rawStatus === 'available'
        ? 'available'
        : rawStatus === 'no' || rawStatus === 'unavailable'
          ? 'unavailable'
          : rawStatus === 'maybe' || rawStatus === 'tentative'
            ? 'tentative'
            : 'no-response'

    return {
      id: `demo-availability-${contact.id}`,
      event_key: eventKey,
      contact_id: contact.id,
      status: normalizedStatus,
      note: 'Demo availability',
      updated_at: new Date().toISOString(),
    }
  })
}

function buildDemoResponseRows(contacts: ContactRow[]): WeeklyResponse[] {
  const eventKey = demoEventKey()
  const statusByName = new Map(
    demoResponses.map((row) => [
      normalizeText((row as { name?: string }).name).toLowerCase(),
      normalizeText((row as { response?: string }).response).toLowerCase(),
    ])
  )

  return contacts.map((contact) => {
    const rawStatus = statusByName.get(contact.full_name.toLowerCase()) || 'no-response'
    const normalizedStatus: WeeklyResponse['status'] =
      rawStatus === 'confirmed'
        ? 'confirmed'
        : rawStatus === 'declined' || rawStatus === 'no'
          ? 'declined'
          : rawStatus === 'tentative'
            ? 'viewed'
            : rawStatus === 'running-late'
              ? 'running-late'
              : rawStatus === 'need-sub'
                ? 'need-sub'
                : rawStatus === 'viewed'
                  ? 'viewed'
                  : 'no-response'

    return {
      id: `demo-response-${contact.id}`,
      event_key: eventKey,
      contact_id: contact.id,
      status: normalizedStatus,
      note: 'Demo response',
      updated_at: new Date().toISOString(),
    }
  })
}

function buildDemoLineupRows(): LineupAssignment[] {
  const eventKey = demoEventKey()
  return normalizeSlots(demoScenario.slots_json).map((slot, index) => ({
    id: `demo-lineup-${index + 1}`,
    event_key: eventKey,
    court_label: slot.label,
    slot_type: slot.slotType,
    players: slot.players,
  }))
}


export default function CaptainMessagingPage() {
  const router = useRouter()
  const [role, setRole] = useState<UserRole>('public')
  const [authLoading, setAuthLoading] = useState(true)
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

  const [prefillScenarioRaw, setPrefillScenarioRaw] = useState<ScenarioRow | null>(null)
  const [prefillFlowSource, setPrefillFlowSource] = useState('')
  const [prefillApplied, setPrefillApplied] = useState(false)

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

  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const captainAccess = isCaptain(role)

  function requireCaptainAccess(message = 'Captain tier required to use Messaging.') {
    if (captainAccess) return true
    setError(message)
    return false
  }

  useEffect(() => {
    let mounted = true

    async function loadAuth() {
      try {
        const { data } = await supabase.auth.getUser()
        const user = data.user

        if (!user) {
          if (mounted) {
            setRole('public')
            setAuthLoading(false)
          }
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        if (!mounted) return

        setRole(normalizeUserRole(profile?.role))
      } finally {
        if (mounted) setAuthLoading(false)
      }
    }

    void loadAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadAuth()
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (role === 'public') {
      router.replace('/login')
    }
  }, [authLoading, role, router])

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const rawScenario = window.localStorage.getItem('tenace_selected_scenario')
      const rawFlowSource = window.localStorage.getItem('tenace_flow_source') || ''

      if (rawScenario) {
        const parsed = JSON.parse(rawScenario) as ScenarioRow
        setPrefillScenarioRaw(parsed)
      }

      const params = new URLSearchParams(window.location.search)
      const sourceFromUrl = params.get('source') || ''
      if (sourceFromUrl || rawFlowSource) {
        setPrefillFlowSource(sourceFromUrl || rawFlowSource)
      }

      const teamFromUrl = params.get('team') || ''
      const leagueFromUrl = params.get('league') || ''
      const flightFromUrl = params.get('flight') || ''

      if (teamFromUrl) setTeamFilter(teamFromUrl)
      if (leagueFromUrl) setLeagueFilter(leagueFromUrl)
      if (flightFromUrl) setFlightFilter(flightFromUrl)
    } catch {
      // ignore malformed local storage payloads
    }
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

        const demoContacts = buildDemoContacts()
        const demoAvailabilityRows = buildDemoAvailabilityRows(demoContacts)
        const demoResponseRows = buildDemoResponseRows(demoContacts)
        const demoLineupRows = buildDemoLineupRows()

        const contactsOk = !contactsResult.error
        const templatesOk = !templatesResult.error
        const matchesData = (matchesResult.data ?? []) as MatchRow[]
        const scenariosData = (scenariosResult.data ?? []) as ScenarioRow[]
        const localContacts = readLocal<ContactRow>(CONTACTS_STORAGE_KEY)
        const localTemplates = readLocal<TemplateRow>(TEMPLATES_STORAGE_KEY)
        const localAvailability = readLocal<WeeklyAvailability>(AVAILABILITY_STORAGE_KEY)
        const localResponses = readLocal<WeeklyResponse>(RESPONSES_STORAGE_KEY)
        const localLineups = readLocal<LineupAssignment>(LINEUPS_STORAGE_KEY)

        if (matchesResult.error) throw matchesResult.error

        const shouldUseDemo = matchesData.length === 0 && scenariosData.length === 0 && localContacts.length === 0

        if (!contactsOk || !templatesOk) {
          setStorageMode('local')
          setContacts(localContacts.length ? localContacts : shouldUseDemo ? demoContacts : [])
          setTemplates(localTemplates)
        } else {
          setStorageMode('supabase')
          setContacts(
            (contactsResult.data ?? []).length
              ? ((contactsResult.data ?? []) as ContactRow[])
              : shouldUseDemo
                ? demoContacts
                : []
          )
          setTemplates((templatesResult.data ?? []) as TemplateRow[])
        }

        setMatches(matchesData.length ? matchesData : shouldUseDemo ? [demoMatch as MatchRow] : [])
        setScenarios(scenariosData.length ? scenariosData : shouldUseDemo ? [demoScenario as ScenarioRow] : [])

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

        setAvailability(localAvailability.length ? localAvailability : shouldUseDemo ? demoAvailabilityRows : [])
        setResponses(localResponses.length ? localResponses : shouldUseDemo ? demoResponseRows : [])
        setLineups(localLineups.length ? localLineups : shouldUseDemo ? demoLineupRows : [])

        if (shouldUseDemo) {
          setLeagueFilter((current) => current || (demoScenario.league_name || ''))
          setFlightFilter((current) => current || (demoScenario.flight || ''))
          setTeamFilter((current) => current || (demoScenario.team_name || demoMatch.home_team || ''))
          setEventMatchId((current) => current || demoMatch.id)
          setSelectedScenarioId((current) => current || demoScenario.id)
          if (!eventArrivalTime) setEventArrivalTime('7:15 PM')
          if (!eventLocation) setEventLocation('Demo Tennis Club')
          if (!eventNotes) setEventNotes('Demo mode active — seeded workflow for testing.')
        }

        type EventDetail = {
          key: string
          location: string
          directions: string
          arrivalTime: string
          notes: string
        }

        const eventDetails = readLocal<EventDetail>(EVENT_DETAILS_STORAGE_KEY)
        const detail = eventDetails[0]
        if (detail) {
          setEventLocation(detail.location || '')
          setEventDirections(detail.directions || '')
          setEventArrivalTime(detail.arrivalTime || '')
          setEventNotes(detail.notes || '')
        }
      } catch (err) {
        if (!mounted) return
        const demoContacts = buildDemoContacts()
        setStorageMode('local')
        setContacts(readLocal<ContactRow>(CONTACTS_STORAGE_KEY).length ? readLocal<ContactRow>(CONTACTS_STORAGE_KEY) : demoContacts)
        setTemplates(readLocal<TemplateRow>(TEMPLATES_STORAGE_KEY))
        setExternalAvailabilityRows([])
        setAvailabilitySyncSource(null)
        setAvailability(readLocal<WeeklyAvailability>(AVAILABILITY_STORAGE_KEY).length ? readLocal<WeeklyAvailability>(AVAILABILITY_STORAGE_KEY) : buildDemoAvailabilityRows(demoContacts))
        setResponses(readLocal<WeeklyResponse>(RESPONSES_STORAGE_KEY).length ? readLocal<WeeklyResponse>(RESPONSES_STORAGE_KEY) : buildDemoResponseRows(demoContacts))
        setLineups(readLocal<LineupAssignment>(LINEUPS_STORAGE_KEY).length ? readLocal<LineupAssignment>(LINEUPS_STORAGE_KEY) : buildDemoLineupRows())
        setMatches([demoMatch as MatchRow])
        setScenarios([demoScenario as ScenarioRow])
        setLeagueFilter((current) => current || (demoScenario.league_name || ''))
        setFlightFilter((current) => current || (demoScenario.flight || ''))
        setTeamFilter((current) => current || (demoScenario.team_name || demoMatch.home_team || ''))
        setEventMatchId((current) => current || demoMatch.id)
        setSelectedScenarioId((current) => current || demoScenario.id)
        if (!eventArrivalTime) setEventArrivalTime('7:15 PM')
        if (!eventLocation) setEventLocation('Demo Tennis Club')
        if (!eventNotes) setEventNotes('Demo mode active — seeded workflow for testing.')
        setError(err instanceof Error ? `${err.message} — demo mode loaded.` : 'Unable to load captain messaging data. Demo mode loaded.')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (loading) return
    if (prefillApplied) return
    if (!prefillScenarioRaw) return

    const scenarioId = prefillScenarioRaw.id || ''
    const scenarioName = prefillScenarioRaw.scenario_name || ''
    const nextTeam = prefillScenarioRaw.team_name || ''
    const nextLeague = prefillScenarioRaw.league_name || ''
    const nextFlight = prefillScenarioRaw.flight || ''
    const nextMatchDate = prefillScenarioRaw.match_date || ''
    const nextNotes = prefillScenarioRaw.notes || ''

    if (nextTeam) setTeamFilter(nextTeam)
    if (nextLeague) setLeagueFilter(nextLeague)
    if (nextFlight) setFlightFilter(nextFlight)

    const matchedScenario =
      scenarios.find((scenario) => scenario.id === scenarioId) ??
      scenarios.find((scenario) => {
        return (
          scenario.scenario_name === scenarioName &&
          (scenario.team_name || '') === nextTeam &&
          (scenario.match_date || '') === nextMatchDate
        )
      }) ??
      null

    if (matchedScenario) {
      setSelectedScenarioId(matchedScenario.id)
    }

    const matchedEvent =
      matches.find((match) => {
        const home = (match.home_team || '').trim()
        const away = (match.away_team || '').trim()
        const teamMatch = !nextTeam || home === nextTeam || away === nextTeam
        const leagueMatch = !nextLeague || (match.league_name || '') === nextLeague
        const flightMatch = !nextFlight || (match.flight || '') === nextFlight
        const dateMatch = !nextMatchDate || (match.match_date || '').slice(0, 10) === nextMatchDate.slice(0, 10)
        return teamMatch && leagueMatch && flightMatch && dateMatch
      }) ?? null

    if (matchedEvent) {
      setEventMatchId(matchedEvent.id)
    }

    if (nextNotes && !eventNotes.trim()) {
      setEventNotes(nextNotes)
    }

    setRecipientMode('lineup-only')
    setMessageKind('lineup')
    setMessageTitle('Lineup Announcement')
    setPrefillApplied(true)
  }, [loading, prefillApplied, prefillScenarioRaw, scenarios, matches, eventNotes])

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const recipientIntelligence = useMemo(() => {
    const base = scopedContacts.filter((contact) => contact.phone && contact.opt_in_text)
    const lineupOnly = base.filter((contact) => lineupPlayerSet.has(contact.full_name.toLowerCase()))
    const captainsOnly = base.filter((contact) => contact.is_captain)
    const availableOnly = base.filter((contact) => (availabilityMap.get(contact.id)?.status ?? 'no-response') === 'available')
    const nonRespondersOnly = base.filter((contact) => (responseMap.get(contact.id)?.status ?? 'no-response') === 'no-response')

    return {
      totalOptedIn: base.length,
      lineupOnly: lineupOnly.length,
      captainsOnly: captainsOnly.length,
      availableOnly: availableOnly.length,
      nonRespondersOnly: nonRespondersOnly.length,
    }
  }, [scopedContacts, lineupPlayerSet, availabilityMap, responseMap])

  const sendStrategy = useMemo(() => {
    const hasWinningScenario = !!selectedScenario
    const hasLineup = lineupRows.length > 0
    const hasRecipients = selectedRecipients.length > 0
    const currentFollowUpTargets = scopedContacts.filter((contact) => {
      const availabilityStatus = availabilityMap.get(contact.id)?.status ?? 'no-response'
      const responseStatus = responseMap.get(contact.id)?.status ?? 'no-response'
      return availabilityStatus === 'no-response' || responseStatus === 'no-response' || responseStatus === 'viewed'
    })
    const shouldFollowUp = currentFollowUpTargets.length > 0
    const bestMode: RecipientMode = shouldFollowUp
      ? 'non-responders'
      : hasLineup
        ? 'lineup-only'
        : 'available-only'
    const bestKind: MessageKind = shouldFollowUp
      ? 'follow-up'
      : hasLineup
        ? 'lineup'
        : 'availability'

    return {
      hasWinningScenario,
      hasLineup,
      hasRecipients,
      shouldFollowUp,
      bestMode,
      bestKind,
      label: shouldFollowUp
        ? 'Follow up first'
        : hasLineup
          ? 'Send lineup next'
          : 'Collect availability first',
    }
  }, [selectedScenario, lineupRows.length, selectedRecipients.length, scopedContacts, availabilityMap, responseMap])

  const weeklyCommandSnapshot = useMemo(() => {
    const lineupFilledSlots = lineupRows.filter((row) => row.players.every((player) => normalizeText(player))).length
    const lineupTotalSlots = lineupRows.length
    const messageReady = !!messageBody.trim() && selectedRecipients.length > 0
    const scenarioLoaded = !!selectedScenario
    const unresolvedCount = scopedContacts.filter((contact) => {
      const availabilityStatus = availabilityMap.get(contact.id)?.status ?? 'no-response'
      const responseStatus = responseMap.get(contact.id)?.status ?? 'no-response'
      const inLineup = lineupPlayerSet.has(contact.full_name.toLowerCase())

      if (inLineup) {
        return (
          availabilityStatus !== 'available' ||
          ['declined', 'need-sub', 'running-late', 'no-response'].includes(responseStatus)
        )
      }

      return availabilityStatus === 'tentative' || availabilityStatus === 'no-response'
    }).length

    return {
      lineupFilledSlots,
      lineupTotalSlots,
      messageReady,
      scenarioLoaded,
      unresolvedCount,
      readinessLabel:
        unresolvedCount === 0 && messageReady
          ? 'Ready to execute'
          : unresolvedCount <= 2
            ? 'Close to ready'
            : 'Needs more work',
    }
  }, [lineupRows, messageBody, selectedRecipients.length, selectedScenario, scopedContacts, availabilityMap, responseMap, lineupPlayerSet])

  const captainActionQueue = useMemo(() => {
    const actions: Array<{ title: string; detail: string; tone: 'good' | 'warn' | 'info' }> = []
    const currentFollowUpCount = scopedContacts.filter((contact) => {
      const availabilityStatus = availabilityMap.get(contact.id)?.status ?? 'no-response'
      const responseStatus = responseMap.get(contact.id)?.status ?? 'no-response'
      return availabilityStatus === 'no-response' || responseStatus === 'no-response' || responseStatus === 'viewed'
    }).length

    if (!selectedScenario) {
      actions.push({
        title: 'Load a winning scenario',
        detail: 'Select a saved scenario so lineup messaging stays tied to a real captain build.',
        tone: 'info',
      })
    }

    if (!lineupRows.length) {
      actions.push({
        title: 'Import or build the weekly lineup',
        detail: 'No weekly lineup has been created yet for this event.',
        tone: 'warn',
      })
    } else if (lineupRows.some((row) => row.players.some((player) => !normalizeText(player)))) {
      actions.push({
        title: 'Fill open lineup spots',
        detail: 'At least one court still has a blank player slot.',
        tone: 'warn',
      })
    }

    if (currentFollowUpCount) {
      actions.push({
        title: 'Follow up with blockers',
        detail: `${currentFollowUpCount} player${currentFollowUpCount === 1 ? '' : 's'} still need attention before the cleanest send.`,
        tone: 'warn',
      })
    }

    if (!selectedRecipients.length) {
      actions.push({
        title: 'Pick the right audience',
        detail: 'No recipients are currently selected for the next message.',
        tone: 'info',
      })
    }

    if (selectedRecipients.length && messageBody.trim()) {
      actions.push({
        title: 'Message is ready to review',
        detail: 'You have recipients and a composed message body in place.',
        tone: 'good',
      })
    }

    return actions.slice(0, 5)
  }, [selectedScenario, lineupRows, selectedRecipients.length, messageBody, scopedContacts, availabilityMap, responseMap])

  const executionChecklist = useMemo(() => {
    const items = [
      {
        label: 'Scenario selected',
        done: !!selectedScenario,
        detail: selectedScenario ? selectedScenario.scenario_name : 'No saved scenario linked yet',
      },
      {
        label: 'Lineup imported',
        done: lineupRows.length > 0,
        detail: lineupRows.length ? `${lineupRows.length} lineup slot${lineupRows.length === 1 ? '' : 's'} loaded` : 'No weekly lineup loaded',
      },
      {
        label: 'Lineup complete',
        done: lineupRows.length > 0 && lineupRows.every((row) => row.players.every((player) => normalizeText(player))),
        detail: lineupRows.length > 0 && lineupRows.every((row) => row.players.every((player) => normalizeText(player)))
          ? 'Every slot has a named player'
          : 'At least one slot still has a blank player',
      },
      {
        label: 'Recipients selected',
        done: selectedRecipients.length > 0,
        detail: selectedRecipients.length ? `${selectedRecipients.length} contact${selectedRecipients.length === 1 ? '' : 's'} in audience` : 'No active message audience yet',
      },
      {
        label: 'Message composed',
        done: !!messageBody.trim(),
        detail: messageBody.trim() ? `${messageBody.trim().length} characters ready` : 'Composer body is still empty',
      },
    ]
    return items
  }, [selectedScenario, lineupRows, selectedRecipients.length, messageBody])

  const messageOutcomePlanner = useMemo(() => {
    const audienceCount = selectedRecipients.length
    const lineupAudience = selectedRecipients.filter((contact) =>
      lineupPlayerSet.has(contact.full_name.toLowerCase())
    ).length
    const captainAudience = selectedRecipients.filter((contact) => contact.is_captain).length
    const currentLikelyReplyCount = selectedRecipients.filter((contact) => {
      const availabilityStatus = availabilityMap.get(contact.id)?.status ?? 'no-response'
      const responseStatus = responseMap.get(contact.id)?.status ?? 'no-response'
      return availabilityStatus === 'no-response' || responseStatus === 'no-response' || responseStatus === 'viewed'
    }).length

    return {
      audienceCount,
      lineupAudience,
      captainAudience,
      likelyReplyCount: currentLikelyReplyCount,
      recommendation:
        messageKind === 'lineup'
          ? 'Best for confirmed lineup communication'
          : messageKind === 'availability'
            ? 'Best for collecting status updates'
            : messageKind === 'follow-up'
              ? 'Best for clearing blockers'
              : messageKind === 'reminder'
                ? 'Best for day-of execution'
                : 'Best for match logistics',
    }
  }, [selectedRecipients, lineupPlayerSet, availabilityMap, responseMap, messageKind])

  const messageSequencePlanner = useMemo(() => {
    const steps = []
    const currentFollowUpCount = scopedContacts.filter((contact) => {
      const availabilityStatus = availabilityMap.get(contact.id)?.status ?? 'no-response'
      const responseStatus = responseMap.get(contact.id)?.status ?? 'no-response'
      return availabilityStatus === 'no-response' || responseStatus === 'no-response' || responseStatus === 'viewed'
    }).length

    if (currentFollowUpCount > 0) {
      steps.push({
        title: 'Clear blockers first',
        detail: `${currentFollowUpCount} player${currentFollowUpCount === 1 ? '' : 's'} still need follow-up before the cleanest final send.`,
        tone: 'warn' as const,
      })
    }

    if (!selectedScenario) {
      steps.push({
        title: 'Anchor to a winning scenario',
        detail: 'Select a saved scenario so lineup messaging stays connected to the version you actually want to field.',
        tone: 'info' as const,
      })
    }

    if (lineupRows.length === 0) {
      steps.push({
        title: 'Load the weekly lineup',
        detail: 'Import a saved scenario or build the weekly lineup before you announce it.',
        tone: 'info' as const,
      })
    } else if (lineupRows.some((row) => row.players.some((player) => !normalizeText(player)))) {
      steps.push({
        title: 'Fill remaining lineup spots',
        detail: 'At least one lineup slot still has an open player field.',
        tone: 'warn' as const,
      })
    }

    if (selectedRecipients.length > 0 && messageBody.trim()) {
      steps.push({
        title: 'Send the next best message',
        detail: `Current best move: ${sendStrategy.label.toLowerCase()}.`,
        tone: 'good' as const,
      })
    } else {
      steps.push({
        title: 'Prepare the send',
        detail: 'Make sure a message body and audience are both set before you execute.',
        tone: 'info' as const,
      })
    }

    return steps.slice(0, 4)
  }, [selectedScenario, lineupRows, selectedRecipients.length, messageBody, sendStrategy.label, scopedContacts, availabilityMap, responseMap])

  const recipientRiskRadar = useMemo(() => {
    const lineupRecipients = selectedRecipients.filter((contact) =>
      lineupPlayerSet.has(contact.full_name.toLowerCase())
    )

    const atRiskLineupPlayers = lineupRecipients.filter((contact) => {
      const availabilityStatus = availabilityMap.get(contact.id)?.status ?? 'no-response'
      const responseStatus = responseMap.get(contact.id)?.status ?? 'no-response'
      return (
        availabilityStatus !== 'available' ||
        ['declined', 'need-sub', 'running-late', 'no-response'].includes(responseStatus)
      )
    })

    const passiveRecipients = selectedRecipients.filter((contact) => {
      const responseStatus = responseMap.get(contact.id)?.status ?? 'no-response'
      return responseStatus === 'viewed' || responseStatus === 'no-response'
    })

    const optedInCaptains = selectedRecipients.filter((contact) => contact.is_captain)

    return {
      lineupRecipients: lineupRecipients.length,
      atRiskLineupPlayers: atRiskLineupPlayers.length,
      passiveRecipients: passiveRecipients.length,
      optedInCaptains: optedInCaptains.length,
      label:
        atRiskLineupPlayers.length > 0
          ? 'Lineup risk present'
          : passiveRecipients.length > 0
            ? 'Reply risk present'
            : 'Audience looks clean',
    }
  }, [selectedRecipients, lineupPlayerSet, availabilityMap, responseMap])

  const deliveryReadiness = useMemo(() => {
    const hasBody = !!messageBody.trim()
    const hasAudience = selectedRecipients.length > 0
    const hasEvent = !!selectedMatch
    const hasLineupContext = lineupRows.length > 0 || !!selectedScenario
    const cleanAudience =
      recipientRiskRadar.atRiskLineupPlayers === 0 && recipientRiskRadar.passiveRecipients === 0

    return {
      hasBody,
      hasAudience,
      hasEvent,
      hasLineupContext,
      cleanAudience,
      score: [hasBody, hasAudience, hasEvent, hasLineupContext, cleanAudience].filter(Boolean).length,
      label:
        hasBody && hasAudience && hasEvent && hasLineupContext && cleanAudience
          ? 'High delivery readiness'
          : hasBody && hasAudience
            ? 'Moderate delivery readiness'
            : 'Low delivery readiness',
    }
  }, [messageBody, selectedRecipients.length, selectedMatch, lineupRows.length, selectedScenario, recipientRiskRadar.atRiskLineupPlayers, recipientRiskRadar.passiveRecipients])

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

  const blockingContacts = useMemo(() => {
    return scopedContacts.filter((contact) => {
      const availabilityStatus = availabilityMap.get(contact.id)?.status ?? 'no-response'
      const responseStatus = responseMap.get(contact.id)?.status ?? 'no-response'
      const inLineup = lineupPlayerSet.has(contact.full_name.toLowerCase())

      if (inLineup) {
        return (
          availabilityStatus !== 'available' ||
          ['declined', 'need-sub', 'running-late', 'no-response'].includes(responseStatus)
        )
      }

      return availabilityStatus === 'tentative' || availabilityStatus === 'no-response'
    })
  }, [scopedContacts, availabilityMap, responseMap, lineupPlayerSet])

  const finalizationReadiness = useMemo(() => {
    const lineupComplete = lineupRows.length > 0 && lineupRows.every((row) =>
      row.players.every((player) => normalizeText(player))
    )
    const clearAvailability = availabilitySummary.noResponseCount === 0 && availabilitySummary.tentativeCount === 0
    const responseStable =
      responseSummary.noResponseCount === 0 &&
      responseSummary.needSubCount === 0 &&
      responseSummary.runningLateCount === 0

    const ready = lineupComplete && clearAvailability && responseStable

    return {
      lineupComplete,
      clearAvailability,
      responseStable,
      ready,
      label: ready ? 'Ready to send' : 'Needs captain attention',
    }
  }, [lineupRows, availabilitySummary, responseSummary])

  const followUpTargets = useMemo(() => {
    return scopedContacts.filter((contact) => {
      const availabilityStatus = availabilityMap.get(contact.id)?.status ?? 'no-response'
      const responseStatus = responseMap.get(contact.id)?.status ?? 'no-response'
      return availabilityStatus === 'no-response' || responseStatus === 'no-response' || responseStatus === 'viewed'
    })
  }, [scopedContacts, availabilityMap, responseMap])

  const needSubContacts = useMemo(() => {
    return scopedContacts.filter((contact) => {
      const responseStatus = responseMap.get(contact.id)?.status ?? 'no-response'
      return responseStatus === 'need-sub'
    })
  }, [scopedContacts, responseMap])

  const runningLateContacts = useMemo(() => {
    return scopedContacts.filter((contact) => {
      const responseStatus = responseMap.get(contact.id)?.status ?? 'no-response'
      return responseStatus === 'running-late'
    })
  }, [scopedContacts, responseMap])

  const tentativeContacts = useMemo(() => {
    return scopedContacts.filter((contact) => {
      const availabilityStatus = availabilityMap.get(contact.id)?.status ?? 'no-response'
      return availabilityStatus === 'tentative'
    })
  }, [scopedContacts, availabilityMap])

  const noResponseContacts = useMemo(() => {
    return scopedContacts.filter((contact) => {
      const availabilityStatus = availabilityMap.get(contact.id)?.status ?? 'no-response'
      const responseStatus = responseMap.get(contact.id)?.status ?? 'no-response'
      return availabilityStatus === 'no-response' || responseStatus === 'no-response' || responseStatus === 'viewed'
    })
  }, [scopedContacts, availabilityMap, responseMap])

  const followUpEngine = useMemo(() => {
    if (needSubContacts.length > 0) {
      return {
        label: 'Need sub now',
        tone: 'warn' as const,
        audience: 'captains' as RecipientMode,
        kind: 'follow-up' as MessageKind,
        detail: `${needSubContacts.length} player${needSubContacts.length === 1 ? '' : 's'} need${needSubContacts.length === 1 ? 's' : ''} a replacement.`,
      }
    }

    if (runningLateContacts.length > 0) {
      return {
        label: 'Check arrival risk',
        tone: 'warn' as const,
        audience: 'captains' as RecipientMode,
        kind: 'follow-up' as MessageKind,
        detail: `${runningLateContacts.length} player${runningLateContacts.length === 1 ? '' : 's'} reported running late.`,
      }
    }

    if (tentativeContacts.length > 0) {
      return {
        label: 'Resolve tentative players',
        tone: 'info' as const,
        audience: 'custom' as RecipientMode,
        kind: 'follow-up' as MessageKind,
        detail: `${tentativeContacts.length} tentative availability response${tentativeContacts.length === 1 ? '' : 's'} still need clarity.`,
      }
    }

    if (noResponseContacts.length > 0) {
      return {
        label: 'Nudge non-responders',
        tone: 'info' as const,
        audience: 'non-responders' as RecipientMode,
        kind: 'follow-up' as MessageKind,
        detail: `${noResponseContacts.length} player${noResponseContacts.length === 1 ? '' : 's'} still have not replied.`,
      }
    }

    return {
      label: 'No follow-up pressure',
      tone: 'good' as const,
      audience: 'lineup-only' as RecipientMode,
      kind: 'lineup' as MessageKind,
      detail: 'No urgent follow-up issues are showing right now.',
    }
  }, [needSubContacts, runningLateContacts, tentativeContacts, noResponseContacts])

  async function saveContacts(nextContacts: ContactRow[]) {
    if (!requireCaptainAccess('Captain tier required to update message contacts.')) return
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
    if (!requireCaptainAccess('Captain tier required to manage templates.')) return
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
    if (!requireCaptainAccess('Captain tier required to update weekly availability.')) return
    setAvailability(nextRows)
    writeLocal(AVAILABILITY_STORAGE_KEY, nextRows)
  }

  function saveResponses(nextRows: WeeklyResponse[]) {
    if (!requireCaptainAccess('Captain tier required to update weekly responses.')) return
    setResponses(nextRows)
    writeLocal(RESPONSES_STORAGE_KEY, nextRows)
  }

  function saveLineups(nextRows: LineupAssignment[]) {
    if (!requireCaptainAccess('Captain tier required to update the weekly lineup.')) return
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
      season_label: seasonFilter || inferSeasonLabel(selectedMatch?.match_date ?? null) || null,
      session_label: sessionFilter || inferSessionLabel(selectedMatch?.match_date ?? null) || null,
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
          season_label: seasonFilter || inferSeasonLabel(selectedMatch?.match_date ?? null) || null,
          session_label: sessionFilter || inferSessionLabel(selectedMatch?.match_date ?? null) || null,
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

  
function buildWinningLineupMessage() {
  if (!selectedScenario) return ''

  const slots = normalizeSlots(selectedScenario.slots_json)

  const lineupText = slots.length
    ? slots
        .map((slot) => {
          const players = slot.players.join(' / ') || 'TBD'
          return `${slot.label}: ${players}`
        })
        .join('\n')
    : 'Lineup coming soon.'

  const scenarioDateText = formatDate(selectedScenario.match_date)
  const eventDateText = selectedMatch ? formatDate(selectedMatch.match_date) : scenarioDateText
  const opponentText = inferredOpponent || selectedScenario.opponent_team || 'our opponent'

  return `Lineup is set for ${eventDateText} vs ${opponentText}:\n\n${lineupText}\n\nArrive by ${eventArrivalTime || 'match time'}.\n${eventLocation ? `Location: ${eventLocation}` : ''}`
}

function applyWinningLineupToComposer() {
  const message = buildWinningLineupMessage()
  if (!message) return

  setMessageKind('lineup')
  setMessageTitle('Lineup Announcement')
  setMessageBody(message)
}

useEffect(() => {
  if (!prefillApplied) return
  if (!selectedScenario) return
  if (
  prefillFlowSource !== 'scenario_builder' &&
  prefillFlowSource !== 'captain_hub' &&
  prefillFlowSource !== 'lineup_builder'
) {
  return
} return

  if (!lineupRows.length) {
    importScenarioToLineup()
    return
  }

  setRecipientMode('lineup-only')
  setMessageKind('lineup')
  setMessageTitle('Lineup Announcement')
  applyWinningLineupToComposer()

  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('tenace_selected_scenario')
    window.localStorage.removeItem('tenace_flow_source')
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [prefillApplied, prefillFlowSource, selectedScenario, lineupRows.length])

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


  function loadAutoFollowUpMessage() {
    const names = followUpTargets.map((contact) => contact.full_name.split(' ')[0]).slice(0, 6)
    const nameText = names.length ? `${names.join(', ')} — ` : ''

    setRecipientMode('non-responders')
    setMessageKind('follow-up')
    setMessageTitle('Follow-Up Reminder')
    setMessageBody(
      `${nameText}quick follow-up for ${formatDate(selectedMatch?.match_date)}. I still need your response so I can finalize the lineup. Please reply ASAP with your status.`
    )
  }


  function loadNeedSubMessage() {
    const names = needSubContacts.map((contact) => contact.full_name.split(' ')[0]).slice(0, 6)
    const nameText = names.length ? `${names.join(', ')} — ` : ''

    setRecipientMode('captains')
    setMessageKind('follow-up')
    setMessageTitle('Sub Needed')
    setMessageBody(
      `${nameText}just checking in — we need a substitution update for ${formatDate(selectedMatch?.match_date)}. Please confirm replacement options as soon as you can so I can finalize the lineup.`
    )
  }

  function loadRunningLateMessage() {
    const names = runningLateContacts.map((contact) => contact.full_name.split(' ')[0]).slice(0, 6)
    const nameText = names.length ? `${names.join(', ')} — ` : ''

    setRecipientMode('captains')
    setMessageKind('follow-up')
    setMessageTitle('Arrival Check')
    setMessageBody(
      `${nameText}just checking in on arrival timing for ${formatDate(selectedMatch?.match_date)}. Please send the latest ETA so captain planning stays clean.`
    )
  }

  function loadTentativeMessage() {
    const names = tentativeContacts.map((contact) => contact.full_name.split(' ')[0]).slice(0, 6)
    const nameText = names.length ? `${names.join(', ')} — ` : ''

    setRecipientMode('custom')
    setSelectedRecipientIds(tentativeContacts.map((contact) => contact.id))
    setMessageKind('follow-up')
    setMessageTitle('Tentative Status Check')
    setMessageBody(
      `${nameText}just checking in — I still need a final yes or no for ${formatDate(selectedMatch?.match_date)} so I can lock the lineup. Please reply when you can.`
    )
  }

  function applyFollowUpEngine() {
    if (followUpEngine.label === 'Need sub now') {
      loadNeedSubMessage()
      return
    }

    if (followUpEngine.label === 'Check arrival risk') {
      loadRunningLateMessage()
      return
    }

    if (followUpEngine.label === 'Resolve tentative players') {
      loadTentativeMessage()
      return
    }

    if (followUpEngine.label === 'Nudge non-responders') {
      loadAutoFollowUpMessage()
      return
    }

    setRecipientMode('lineup-only')
    applyWinningLineupToComposer()
  }

  function loadRecipientMode(mode: RecipientMode, kind?: MessageKind) {
    setRecipientMode(mode)
    if (kind) setMessageKind(kind)
  }

  function applyRecommendedSendStrategy() {
    setRecipientMode(sendStrategy.bestMode)
    setMessageKind(sendStrategy.bestKind)

    if (sendStrategy.bestKind === 'follow-up') {
      loadAutoFollowUpMessage()
      return
    }

    if (sendStrategy.bestKind === 'lineup') {
      applyWinningLineupToComposer()
      return
    }

    setMessageTitle('Availability Check')
    setMessageBody(
      eventDefaultMessage('availability', {
        teamName: inferredTeamName,
        opponent: inferredOpponent,
        dateText: formatDate(selectedMatch?.match_date),
        location: eventLocation,
        arrivalTime: eventArrivalTime,
        lineupText: '',
      })
    )
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

  if (authLoading) {
    return (
      <SiteShell active="/captain">
        <section style={pageContentStyle}>
          <section style={surfaceCard}>
            <p style={mutedTextStyle}>Loading captain messaging...</p>
          </section>
        </section>
      </SiteShell>
    )
  }

  if (role === 'public') return null

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
              <Link href="/captain/lineup-builder" style={primaryButton}>Open Lineup Builder</Link>
              <Link href="/captain" style={ghostButton}>Back to Captain Console</Link>
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

        <section style={surfaceCard}>
          <div style={tableHeaderStyle}>
            <div>
              <p style={sectionKicker}>Captain tier</p>
              <h3 style={sectionTitleSmall}>{captainAccess ? 'Premium messaging unlocked' : 'Preview mode active'}</h3>
            </div>
            <span style={captainAccess ? miniPillGreen : warnPill}>
              {captainAccess ? 'Captain access' : 'Member preview'}
            </span>
          </div>
          <p style={mutedTextStyle}>
            Members can review workflow, lineup intelligence, and message planning. Captain and admin roles unlock editing,
            lineup sync, contact management, template saves, and live send execution.
          </p>
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
              <Field label="League" htmlFor="captain-messaging-league">
                <select id="captain-messaging-league" value={leagueFilter} onChange={(e) => setLeagueFilter(e.target.value)} style={inputStyle}>
                  <option value="">All</option>
                  {leagueOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Flight" htmlFor="captain-messaging-flight">
                <select id="captain-messaging-flight" value={flightFilter} onChange={(e) => setFlightFilter(e.target.value)} style={inputStyle}>
                  <option value="">All</option>
                  {flightOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Season" htmlFor="captain-messaging-season">
                <select id="captain-messaging-season" value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)} style={inputStyle}>
                  <option value="">All</option>
                  {seasonOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Session" htmlFor="captain-messaging-session">
                <select id="captain-messaging-session" value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)} style={inputStyle}>
                  <option value="">All</option>
                  {sessionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Team" htmlFor="captain-messaging-team">
                <select id="captain-messaging-team" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} style={inputStyle}>
                  <option value="">All</option>
                  {teamOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Upcoming match" htmlFor="captain-messaging-match">
                <select id="captain-messaging-match" value={eventMatchId} onChange={(e) => setEventMatchId(e.target.value)} style={inputStyle}>
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
              {error ? <section style={surfaceCard}><p role="alert" style={errorTextStyle}>{error}</p></section> : null}

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
                    <Field label="Opponent" htmlFor="captain-messaging-opponent">
                      <input id="captain-messaging-opponent" value={inferredOpponent} readOnly style={inputStyleMuted} />
                    </Field>
                    <Field label="Arrival time" htmlFor="captain-messaging-arrival">
                      <input id="captain-messaging-arrival" value={eventArrivalTime} onChange={(e) => setEventArrivalTime(e.target.value)} placeholder="7:15 PM" style={inputStyle} />
                    </Field>
                    <Field label="Location" htmlFor="captain-messaging-location">
                      <input id="captain-messaging-location" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="Club name + address" style={inputStyle} />
                    </Field>
                    <Field label="Directions / parking / gate code" htmlFor="captain-messaging-directions">
                      <textarea id="captain-messaging-directions" value={eventDirections} onChange={(e) => setEventDirections(e.target.value)} placeholder="Parking lot entry, courts, pro shop, etc." style={textareaStyle} />
                    </Field>
                  </div>

                  <Field label="Captain notes for the week" htmlFor="captain-messaging-notes">
                    <textarea id="captain-messaging-notes" value={eventNotes} onChange={(e) => setEventNotes(e.target.value)} placeholder="Rain plan, warm-up court, expected finish, balls, uniforms, snacks..." style={textareaStyle} />
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
                                  <button key={status} type="button" aria-pressed={availabilityStatus === status} onClick={() => setAvailabilityStatus(contact.id, status)} style={availabilityStatus === status ? statusButtonActive(status) : statusButtonStyle}>
                                    {status.replace('-', ' ')}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td style={tdStyle}>
                              <div style={rowControlWrapStyle}>
                                {(['confirmed', 'viewed', 'declined', 'running-late', 'need-sub', 'no-response'] as WeeklyResponse['status'][]).map((status) => (
                                  <button key={status} type="button" aria-pressed={responseStatus === status} onClick={() => setResponseStatus(contact.id, status)} style={responseStatus === status ? responseButtonActive(status) : statusButtonStyle}>
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
                      <button type="button" style={primaryButtonBlock} onClick={importScenarioToLineup} disabled={!selectedScenario || !captainAccess}>Import scenario</button>
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

                <div style={{ display: 'grid', gap: 18 }}>
                  <section style={surfaceCardStrong}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Winning lineup</p>
                        <h3 style={sectionTitleSmall}>Send your finalized scenario</h3>
                      </div>
                      <span style={miniPillGreen}>
                        {selectedScenario ? 'Scenario selected' : 'No scenario'}
                      </span>
                    </div>

                    {selectedScenario ? (
                      <>
                        <div style={{ marginBottom: 12 }}>
                          <div style={miniPillBlue}>{selectedScenario.scenario_name}</div>
                        </div>

                        <div style={{ marginBottom: 16, color: '#dfe8f8' }}>
                          This will generate a clean lineup message using your selected scenario and push it directly into the composer.
                        </div>

                        <div style={actionRowStyle}>
                          <button
                            type="button"
                            style={primaryButton}
                            onClick={applyWinningLineupToComposer}
                          >
                            Load Winning Lineup Message
                          </button>

                          <button
                            type="button"
                            style={ghostButtonSmallButton}
                            onClick={importScenarioToLineup}
                            disabled={!captainAccess}
                          >
                            Sync to lineup editor
                          </button>
                        </div>
                      </>
                    ) : (
                      <p style={mutedTextStyle}>
                        Select a scenario above to enable one-click lineup messaging.
                      </p>
                    )}
                  </section>

                  <section style={surfaceCardStrong}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Finalization intelligence</p>
                        <h3 style={sectionTitleSmall}>What is blocking lineup finalization</h3>
                      </div>
                      <span style={finalizationReadiness.ready ? miniPillGreen : warnPill}>
                        {finalizationReadiness.label}
                      </span>
                    </div>

                    <div style={intelligenceGridStyle}>
                      <div style={intelligenceCardStyle}>
                        <div style={intelligenceLabelStyle}>Lineup status</div>
                        <div style={intelligenceValueStyle}>
                          {finalizationReadiness.lineupComplete ? 'Complete' : 'Open spots'}
                        </div>
                        <div style={intelligenceTextStyle}>
                          {finalizationReadiness.lineupComplete
                            ? 'Every lineup slot currently has player names filled in.'
                            : 'One or more lineup slots still need a player before you send the final plan.'}
                        </div>
                      </div>

                      <div style={intelligenceCardStyle}>
                        <div style={intelligenceLabelStyle}>Availability clarity</div>
                        <div style={intelligenceValueStyle}>
                          {finalizationReadiness.clearAvailability ? 'Clear' : 'Still unresolved'}
                        </div>
                        <div style={intelligenceTextStyle}>
                          {finalizationReadiness.clearAvailability
                            ? 'No tentative or no-response availability statuses are blocking the week.'
                            : 'You still have tentative or missing availability responses to resolve.'}
                        </div>
                      </div>

                      <div style={intelligenceCardStyle}>
                        <div style={intelligenceLabelStyle}>Response stability</div>
                        <div style={intelligenceValueStyle}>
                          {finalizationReadiness.responseStable ? 'Stable' : 'Needs follow-up'}
                        </div>
                        <div style={intelligenceTextStyle}>
                          {finalizationReadiness.responseStable
                            ? 'Current replies are stable enough to move toward sending the final plan.'
                            : 'Late replies, no-responses, or sub requests still need captain attention.'}
                        </div>
                      </div>
                    </div>

                    <div style={pillRowStyle}>
                      <span style={miniPillSlate}>{blockingContacts.length} blocking contact{blockingContacts.length === 1 ? '' : 's'}</span>
                      <span style={miniPillBlue}>{followUpTargets.length} follow-up target{followUpTargets.length === 1 ? '' : 's'}</span>
                      <span style={finalizationReadiness.ready ? miniPillGreen : warnPill}>
                        {finalizationReadiness.ready ? 'Message can go out' : 'Refine before sending'}
                      </span>
                    </div>

                    {blockingContacts.length ? (
                      <div style={blockingListStyle}>
                        {blockingContacts.slice(0, 8).map((contact) => {
                          const availabilityStatus = availabilityMap.get(contact.id)?.status ?? 'no-response'
                          const responseStatus = responseMap.get(contact.id)?.status ?? 'no-response'
                          return (
                            <div key={contact.id} style={blockingCardStyle}>
                              <div>
                                <div style={blockingNameStyle}>{contact.full_name}</div>
                                <div style={blockingMetaStyle}>
                                  Availability: {availabilityStatus.replace('-', ' ')} • Response: {responseStatus.replace('-', ' ')}
                                </div>
                              </div>
                              <span
                                style={
                                  responseStatus === 'declined' || responseStatus === 'need-sub'
                                    ? warnPill
                                    : availabilityStatus === 'available'
                                      ? miniPillBlue
                                      : miniPillSlate
                                }
                              >
                                {lineupPlayerSet.has(contact.full_name.toLowerCase()) ? 'In lineup' : 'Watch list'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p style={mutedTextStyle}>No obvious blockers right now. Your captain workflow is clean enough to move toward communication.</p>
                    )}
                  </section>

                  <section style={surfaceCardStrong}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Follow-up engine</p>
                        <h3 style={sectionTitleSmall}>What needs captain attention first</h3>
                      </div>
                      <span
                        style={
                          followUpEngine.tone === 'good'
                            ? miniPillGreen
                            : followUpEngine.tone === 'warn'
                              ? warnPill
                              : miniPillBlue
                        }
                      >
                        {followUpEngine.label}
                      </span>
                    </div>

                    <div style={intelligenceGridStyle}>
                      <div style={intelligenceCardStyle}>
                        <div style={intelligenceLabelStyle}>Need sub</div>
                        <div style={intelligenceValueStyle}>{needSubContacts.length}</div>
                        <div style={intelligenceTextStyle}>Highest urgency because lineup replacement may be required.</div>
                      </div>

                      <div style={intelligenceCardStyle}>
                        <div style={intelligenceLabelStyle}>Running late</div>
                        <div style={intelligenceValueStyle}>{runningLateContacts.length}</div>
                        <div style={intelligenceTextStyle}>Useful for match-day arrival and captain coordination.</div>
                      </div>

                      <div style={intelligenceCardStyle}>
                        <div style={intelligenceLabelStyle}>Tentative</div>
                        <div style={intelligenceValueStyle}>{tentativeContacts.length}</div>
                        <div style={intelligenceTextStyle}>Still unclear for lineup lock confidence.</div>
                      </div>

                      <div style={intelligenceCardStyle}>
                        <div style={intelligenceLabelStyle}>No response</div>
                        <div style={intelligenceValueStyle}>{noResponseContacts.length}</div>
                        <div style={intelligenceTextStyle}>Best target group when you need to clear blockers fast.</div>
                      </div>
                    </div>

                    <div style={pillRowStyle}>
                      <span style={miniPillSlate}>{followUpEngine.detail}</span>
                    </div>

                    <div style={actionRowStyle}>
                      <button type="button" style={primaryButton} onClick={applyFollowUpEngine}>
                        Apply Best Follow-Up Action
                      </button>
                      <button type="button" style={ghostButtonSmallButton} onClick={loadAutoFollowUpMessage}>
                        Message Non-Responders
                      </button>
                      <button type="button" style={ghostButtonSmallButton} onClick={loadTentativeMessage}>
                        Message Tentative Players
                      </button>
                      <button type="button" style={ghostButtonSmallButton} onClick={loadNeedSubMessage}>
                        Escalate Need Sub
                      </button>
                    </div>
                  </section>

                  <section style={surfaceCard}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Smart follow-ups</p>
                        <h3 style={sectionTitleSmall}>Load the next best captain message</h3>
                      </div>
                      <span style={miniPillSlate}>{followUpTargets.length} target{followUpTargets.length === 1 ? '' : 's'}</span>
                    </div>

                    <div style={intelligenceGridStyle}>
                      <div style={intelligenceCardStyle}>
                        <div style={intelligenceLabelStyle}>Best next move</div>
                        <div style={intelligenceValueStyle}>
                          {followUpTargets.length ? 'Follow up now' : 'Lineup message next'}
                        </div>
                        <div style={intelligenceTextStyle}>
                          {followUpTargets.length
                            ? 'There are still people blocking final confirmation. Load a follow-up message and target non-responders.'
                            : 'The roster is responding. You are in a good place to send the winning lineup message.'}
                        </div>
                      </div>

                      <div style={intelligenceCardStyle}>
                        <div style={intelligenceLabelStyle}>Captain prompt</div>
                        <div style={intelligenceValueStyle}>
                          {finalizationReadiness.ready ? 'Send the plan' : 'Clear blockers first'}
                        </div>
                        <div style={intelligenceTextStyle}>
                          {finalizationReadiness.ready
                            ? 'The workflow is stable enough to move from planning into communication.'
                            : 'Use the follow-up tools and blocker list to remove uncertainty before messaging the full team.'}
                        </div>
                      </div>
                    </div>

                    <div style={actionRowStyle}>
                      <button type="button" style={primaryButton} onClick={loadAutoFollowUpMessage}>
                        Load Auto Follow-Up
                      </button>
                      <button type="button" style={ghostButtonSmallButton} onClick={() => setRecipientMode('non-responders')}>
                        Target Non-Responders
                      </button>
                      <button type="button" style={ghostButtonSmallButton} onClick={() => setMessageKind('lineup')}>
                        Switch to Lineup Message
                      </button>
                    </div>
                  </section>

                  <section style={surfaceCard}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Recipient intelligence</p>
                        <h3 style={sectionTitleSmall}>Who this message should really go to</h3>
                      </div>
                      <span style={miniPillSlate}>{selectedRecipients.length} currently selected</span>
                    </div>

                    <div style={recipientIntelligenceGridStyle}>
                      <div style={recipientIntelligenceCardStyle}>
                        <div style={recipientIntelligenceLabelStyle}>All opted-in</div>
                        <div style={recipientIntelligenceValueStyle}>{recipientIntelligence.totalOptedIn}</div>
                        <div style={recipientIntelligenceTextStyle}>Everyone eligible to receive texts in the current roster scope.</div>
                      </div>

                      <div style={recipientIntelligenceCardStyle}>
                        <div style={recipientIntelligenceLabelStyle}>Lineup only</div>
                        <div style={recipientIntelligenceValueStyle}>{recipientIntelligence.lineupOnly}</div>
                        <div style={recipientIntelligenceTextStyle}>Players currently placed in the weekly lineup.</div>
                      </div>

                      <div style={recipientIntelligenceCardStyle}>
                        <div style={recipientIntelligenceLabelStyle}>Captains</div>
                        <div style={recipientIntelligenceValueStyle}>{recipientIntelligence.captainsOnly}</div>
                        <div style={recipientIntelligenceTextStyle}>Captain-only audience for quick coordination or escalation.</div>
                      </div>

                      <div style={recipientIntelligenceCardStyle}>
                        <div style={recipientIntelligenceLabelStyle}>Need reply</div>
                        <div style={recipientIntelligenceValueStyle}>{recipientIntelligence.nonRespondersOnly}</div>
                        <div style={recipientIntelligenceTextStyle}>Best target group when you need to clear blockers fast.</div>
                      </div>
                    </div>

                    <div style={actionRowStyle}>
                      <button type="button" style={ghostButtonSmallButton} onClick={() => loadRecipientMode('lineup-only', 'lineup')}>
                        Target lineup only
                      </button>
                      <button type="button" style={ghostButtonSmallButton} onClick={() => loadRecipientMode('available-only', 'reminder')}>
                        Target available only
                      </button>
                      <button type="button" style={ghostButtonSmallButton} onClick={() => loadRecipientMode('captains', 'follow-up')}>
                        Target captains
                      </button>
                      <button type="button" style={primaryButton} onClick={() => loadRecipientMode('non-responders', 'follow-up')}>
                        Target blockers
                      </button>
                    </div>
                  </section>

                  <section style={surfaceCardStrong}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Captain action queue</p>
                        <h3 style={sectionTitleSmall}>The next best moves for this week</h3>
                      </div>
                      <span style={captainActionQueue.length <= 1 ? miniPillGreen : warnPill}>
                        {captainActionQueue.length} priority action{captainActionQueue.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div style={actionQueueGridStyle}>
                      {captainActionQueue.length ? captainActionQueue.map((item, index) => (
                        <div
                          key={`${item.title}-${index}`}
                          style={
                            item.tone === 'good'
                              ? actionQueueCardGoodStyle
                              : item.tone === 'warn'
                                ? actionQueueCardWarnStyle
                                : actionQueueCardInfoStyle
                          }
                        >
                          <div style={actionQueueLabelStyle}>Priority {index + 1}</div>
                          <div style={actionQueueValueStyle}>{item.title}</div>
                          <div style={actionQueueTextStyle}>{item.detail}</div>
                        </div>
                      )) : (
                        <div style={actionQueueCardGoodStyle}>
                          <div style={actionQueueLabelStyle}>Priority</div>
                          <div style={actionQueueValueStyle}>Nothing urgent</div>
                          <div style={actionQueueTextStyle}>This weekly communication flow looks clean and ready to execute.</div>
                        </div>
                      )}
                    </div>
                  </section>

                  <section style={surfaceCard}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Weekly command snapshot</p>
                        <h3 style={sectionTitleSmall}>Where this captain workflow stands right now</h3>
                      </div>
                      <span
                        style={
                          weeklyCommandSnapshot.readinessLabel === 'Ready to execute'
                            ? miniPillGreen
                            : weeklyCommandSnapshot.readinessLabel === 'Close to ready'
                              ? miniPillBlue
                              : warnPill
                        }
                      >
                        {weeklyCommandSnapshot.readinessLabel}
                      </span>
                    </div>

                    <div style={weeklyCommandGridStyle}>
                      <div style={weeklyCommandCardStyle}>
                        <div style={weeklyCommandLabelStyle}>Scenario</div>
                        <div style={weeklyCommandValueStyle}>
                          {weeklyCommandSnapshot.scenarioLoaded ? 'Loaded' : 'Not loaded'}
                        </div>
                        <div style={weeklyCommandTextStyle}>
                          {weeklyCommandSnapshot.scenarioLoaded
                            ? 'A saved scenario is connected, so lineup messaging can stay tied to a real build.'
                            : 'Load or select a scenario if you want messaging to stay anchored to the winning version.'}
                        </div>
                      </div>

                      <div style={weeklyCommandCardStyle}>
                        <div style={weeklyCommandLabelStyle}>Lineup completeness</div>
                        <div style={weeklyCommandValueStyle}>
                          {weeklyCommandSnapshot.lineupTotalSlots
                            ? `${weeklyCommandSnapshot.lineupFilledSlots}/${weeklyCommandSnapshot.lineupTotalSlots}`
                            : 'No lineup'}
                        </div>
                        <div style={weeklyCommandTextStyle}>
                          This measures how many weekly lineup slots are fully filled with player names.
                        </div>
                      </div>

                      <div style={weeklyCommandCardStyle}>
                        <div style={weeklyCommandLabelStyle}>Message readiness</div>
                        <div style={weeklyCommandValueStyle}>
                          {weeklyCommandSnapshot.messageReady ? 'Ready' : 'Not ready'}
                        </div>
                        <div style={weeklyCommandTextStyle}>
                          A message body and recipient audience are both required before you can cleanly send the next captain text.
                        </div>
                      </div>

                      <div style={weeklyCommandCardStyle}>
                        <div style={weeklyCommandLabelStyle}>Unresolved blockers</div>
                        <div style={weeklyCommandValueStyle}>{weeklyCommandSnapshot.unresolvedCount}</div>
                        <div style={weeklyCommandTextStyle}>
                          These are the contacts or situations still preventing a clean lineup finalization.
                        </div>
                      </div>
                    </div>
                  </section>

                  <section style={surfaceCardStrong}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Send strategy board</p>
                        <h3 style={sectionTitleSmall}>What message should go out next</h3>
                      </div>
                      <span style={sendStrategy.shouldFollowUp ? warnPill : miniPillGreen}>
                        {sendStrategy.label}
                      </span>
                    </div>

                    <div style={sendStrategyGridStyle}>
                      <div style={sendStrategyCardStyle}>
                        <div style={sendStrategyLabelStyle}>Best audience</div>
                        <div style={sendStrategyValueStyle}>
                          {sendStrategy.bestMode === 'non-responders'
                            ? 'Blockers / non-responders'
                            : sendStrategy.bestMode === 'lineup-only'
                              ? 'Lineup only'
                              : 'Available players'}
                        </div>
                        <div style={sendStrategyTextStyle}>
                          This is the cleanest audience for the next captain message based on current readiness and response state.
                        </div>
                      </div>

                      <div style={sendStrategyCardStyle}>
                        <div style={sendStrategyLabelStyle}>Best message</div>
                        <div style={sendStrategyValueStyle}>
                          {sendStrategy.bestKind === 'follow-up'
                            ? 'Follow-up'
                            : sendStrategy.bestKind === 'lineup'
                              ? 'Lineup announcement'
                              : 'Availability check'}
                        </div>
                        <div style={sendStrategyTextStyle}>
                          The console is reading your current week state and recommending the most useful next message type.
                        </div>
                      </div>

                      <div style={sendStrategyCardStyle}>
                        <div style={sendStrategyLabelStyle}>Send readiness</div>
                        <div style={sendStrategyValueStyle}>
                          {sendStrategy.hasRecipients ? 'Audience ready' : 'No audience'}
                        </div>
                        <div style={sendStrategyTextStyle}>
                          {sendStrategy.hasRecipients
                            ? 'You currently have recipients in scope for the recommended action.'
                            : 'Adjust team scope, recipient mode, or contact records before sending.'}
                        </div>
                      </div>
                    </div>

                    <div style={actionRowStyle}>
                      <button type="button" style={primaryButton} onClick={applyRecommendedSendStrategy}>
                        Apply Recommended Send Strategy
                      </button>
                      <button type="button" style={ghostButtonSmallButton} onClick={() => applyWinningLineupToComposer()}>
                        Load Lineup Message
                      </button>
                      <button type="button" style={ghostButtonSmallButton} onClick={loadAutoFollowUpMessage}>
                        Load Follow-Up
                      </button>
                    </div>
                  </section>

                  <section style={surfaceCard}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Execution checklist</p>
                        <h3 style={sectionTitleSmall}>What still needs to happen before you send</h3>
                      </div>
                      <span style={executionChecklist.every((item) => item.done) ? miniPillGreen : warnPill}>
                        {executionChecklist.filter((item) => item.done).length}/{executionChecklist.length} complete
                      </span>
                    </div>

                    <div style={executionChecklistGridStyle}>
                      {executionChecklist.map((item) => (
                        <div key={item.label} style={executionChecklistCardStyle}>
                          <div style={executionChecklistTopStyle}>
                            <div style={executionChecklistLabelStyle}>{item.label}</div>
                            <span style={item.done ? miniPillGreen : miniPillSlate}>
                              {item.done ? 'Done' : 'Open'}
                            </span>
                          </div>
                          <div style={executionChecklistDetailStyle}>{item.detail}</div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section style={surfaceCardStrong}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Message outcome planner</p>
                        <h3 style={sectionTitleSmall}>What this send is likely to accomplish</h3>
                      </div>
                      <span style={miniPillBlue}>{messageOutcomePlanner.recommendation}</span>
                    </div>

                    <div style={outcomePlannerGridStyle}>
                      <div style={outcomePlannerCardStyle}>
                        <div style={outcomePlannerLabelStyle}>Audience size</div>
                        <div style={outcomePlannerValueStyle}>{messageOutcomePlanner.audienceCount}</div>
                        <div style={outcomePlannerTextStyle}>
                          Total recipients currently targeted by the active message settings.
                        </div>
                      </div>

                      <div style={outcomePlannerCardStyle}>
                        <div style={outcomePlannerLabelStyle}>Lineup players reached</div>
                        <div style={outcomePlannerValueStyle}>{messageOutcomePlanner.lineupAudience}</div>
                        <div style={outcomePlannerTextStyle}>
                          Helpful for seeing whether the current send is actually reaching the players in the weekly lineup.
                        </div>
                      </div>

                      <div style={outcomePlannerCardStyle}>
                        <div style={outcomePlannerLabelStyle}>Captain reach</div>
                        <div style={outcomePlannerValueStyle}>{messageOutcomePlanner.captainAudience}</div>
                        <div style={outcomePlannerTextStyle}>
                          Useful when the message is meant for coordination rather than the full team.
                        </div>
                      </div>

                      <div style={outcomePlannerCardStyle}>
                        <div style={outcomePlannerLabelStyle}>Likely follow-up replies</div>
                        <div style={outcomePlannerValueStyle}>{messageOutcomePlanner.likelyReplyCount}</div>
                        <div style={outcomePlannerTextStyle}>
                          Estimated number of currently targeted recipients who still need to respond or be nudged.
                        </div>
                      </div>
                    </div>

                    <div style={pillRowStyle}>
                      <span style={miniPillSlate}>{messageTitle || 'Untitled message'}</span>
                      <span style={messageOutcomePlanner.audienceCount ? miniPillGreen : warnPill}>
                        {messageOutcomePlanner.audienceCount ? 'Audience in scope' : 'No audience selected'}
                      </span>
                      <span style={messageBody.trim() ? miniPillBlue : miniPillSlate}>
                        {messageBody.trim() ? `${messageBody.trim().length} chars` : 'No message body'}
                      </span>
                    </div>
                  </section>

                  <section style={surfaceCard}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Communication sequence planner</p>
                        <h3 style={sectionTitleSmall}>The smartest order of operations this week</h3>
                      </div>
                      <span style={finalizationReadiness.ready ? miniPillGreen : miniPillSlate}>
                        {finalizationReadiness.ready ? 'Execution flow ready' : 'Work the sequence'}
                      </span>
                    </div>

                    <div style={sequencePlannerGridStyle}>
                      {messageSequencePlanner.map((step, index) => (
                        <div
                          key={`${step.title}-${index}`}
                          style={
                            step.tone === 'good'
                              ? sequencePlannerCardGoodStyle
                              : step.tone === 'warn'
                                ? sequencePlannerCardWarnStyle
                                : sequencePlannerCardInfoStyle
                          }
                        >
                          <div style={sequencePlannerLabelStyle}>Step {index + 1}</div>
                          <div style={sequencePlannerValueStyle}>{step.title}</div>
                          <div style={sequencePlannerTextStyle}>{step.detail}</div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section style={surfaceCard}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Message launch snapshot</p>
                        <h3 style={sectionTitleSmall}>What is about to go out</h3>
                      </div>
                      <span style={selectedRecipients.length && messageBody.trim() ? miniPillGreen : miniPillSlate}>
                        {selectedRecipients.length && messageBody.trim() ? 'Ready for review' : 'Still drafting'}
                      </span>
                    </div>

                    <div style={launchSnapshotGridStyle}>
                      <div style={launchSnapshotCardStyle}>
                        <div style={launchSnapshotLabelStyle}>Message type</div>
                        <div style={launchSnapshotValueStyle}>{messageKind.replace('-', ' ')}</div>
                        <div style={launchSnapshotTextStyle}>
                          Current communication mode selected for this send.
                        </div>
                      </div>

                      <div style={launchSnapshotCardStyle}>
                        <div style={launchSnapshotLabelStyle}>Audience</div>
                        <div style={launchSnapshotValueStyle}>{selectedRecipients.length}</div>
                        <div style={launchSnapshotTextStyle}>
                          Recipient count in the active send audience.
                        </div>
                      </div>

                      <div style={launchSnapshotCardStyle}>
                        <div style={launchSnapshotLabelStyle}>Scenario anchor</div>
                        <div style={launchSnapshotValueStyle}>
                          {selectedScenario?.scenario_name || 'None selected'}
                        </div>
                        <div style={launchSnapshotTextStyle}>
                          Saved scenario currently tied to the weekly lineup workflow.
                        </div>
                      </div>

                      <div style={launchSnapshotCardStyle}>
                        <div style={launchSnapshotLabelStyle}>Event</div>
                        <div style={launchSnapshotValueStyle}>
                          {selectedMatch ? formatDate(selectedMatch.match_date) : 'No match'}
                        </div>
                        <div style={launchSnapshotTextStyle}>
                          {selectedMatch
                            ? `${selectedMatch.home_team || 'TBD'} vs ${selectedMatch.away_team || 'TBD'}`
                            : 'Select a match to tighten the weekly communication context.'}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section style={surfaceCardStrong}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Send confidence panel</p>
                        <h3 style={sectionTitleSmall}>How safe this send looks right now</h3>
                      </div>
                      <span
                        style={
                          finalizationReadiness.ready && selectedRecipients.length > 0 && messageBody.trim()
                            ? miniPillGreen
                            : Math.abs(selectedRecipients.length) > 0 && messageBody.trim()
                              ? miniPillBlue
                              : warnPill
                        }
                      >
                        {finalizationReadiness.ready && selectedRecipients.length > 0 && messageBody.trim()
                          ? 'High confidence'
                          : selectedRecipients.length > 0 && messageBody.trim()
                            ? 'Usable but review'
                            : 'Not ready yet'}
                      </span>
                    </div>

                    <div style={sendConfidenceGridStyle}>
                      <div style={sendConfidenceCardStyle}>
                        <div style={sendConfidenceLabelStyle}>Workflow state</div>
                        <div style={sendConfidenceValueStyle}>{sendStrategy.label}</div>
                        <div style={sendConfidenceTextStyle}>
                          This is the current recommended communication move based on lineup state and reply pressure.
                        </div>
                      </div>

                      <div style={sendConfidenceCardStyle}>
                        <div style={sendConfidenceLabelStyle}>Composer status</div>
                        <div style={sendConfidenceValueStyle}>
                          {messageBody.trim() ? 'Loaded' : 'Empty'}
                        </div>
                        <div style={sendConfidenceTextStyle}>
                          {messageBody.trim()
                            ? 'A message body is already loaded into the composer.'
                            : 'Load a lineup, follow-up, or availability message before sending.'}
                        </div>
                      </div>

                      <div style={sendConfidenceCardStyle}>
                        <div style={sendConfidenceLabelStyle}>Audience fit</div>
                        <div style={sendConfidenceValueStyle}>
                          {selectedRecipients.length ? `${selectedRecipients.length} selected` : 'No audience'}
                        </div>
                        <div style={sendConfidenceTextStyle}>
                          {selectedRecipients.length
                            ? 'There is an active recipient audience in scope for the next send.'
                            : 'Choose the right recipient mode or custom list before sending.'}
                        </div>
                      </div>

                      <div style={sendConfidenceCardStyle}>
                        <div style={sendConfidenceLabelStyle}>Final check</div>
                        <div style={sendConfidenceValueStyle}>
                          {finalizationReadiness.ready ? 'Clear to launch' : 'Review blockers'}
                        </div>
                        <div style={sendConfidenceTextStyle}>
                          {finalizationReadiness.ready
                            ? 'Lineup, availability, and responses are stable enough for a cleaner team send.'
                            : 'There are still blockers, open lineup issues, or unresolved replies worth checking first.'}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section style={surfaceCard}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Weekly send gate</p>
                        <h3 style={sectionTitleSmall}>Should you send now or hold one more step?</h3>
                      </div>
                      <span
                        style={
                          finalizationReadiness.ready && selectedRecipients.length > 0 && messageBody.trim()
                            ? miniPillGreen
                            : warnPill
                        }
                      >
                        {finalizationReadiness.ready && selectedRecipients.length > 0 && messageBody.trim()
                          ? 'Send now'
                          : 'Hold and review'}
                      </span>
                    </div>

                    <div style={sendGateGridStyle}>
                      <div style={sendGateCardStyle}>
                        <div style={sendGateLabelStyle}>Recommendation</div>
                        <div style={sendGateValueStyle}>
                          {finalizationReadiness.ready && selectedRecipients.length > 0 && messageBody.trim()
                            ? 'Launch the message'
                            : followUpTargets.length > 0
                              ? 'Follow up first'
                              : lineupRows.length === 0
                                ? 'Build lineup first'
                                : 'Review audience and message'}
                        </div>
                        <div style={sendGateTextStyle}>
                          {finalizationReadiness.ready && selectedRecipients.length > 0 && messageBody.trim()
                            ? 'The weekly workflow is stable enough that the current send should move the week forward.'
                            : 'There is still at least one missing ingredient preventing the cleanest possible captain send.'}
                        </div>
                      </div>

                      <div style={sendGateCardStyle}>
                        <div style={sendGateLabelStyle}>Primary blocker</div>
                        <div style={sendGateValueStyle}>
                          {followUpTargets.length > 0
                            ? 'Outstanding replies'
                            : lineupRows.length === 0
                              ? 'No lineup loaded'
                              : !messageBody.trim()
                                ? 'Composer empty'
                                : !selectedRecipients.length
                                  ? 'No recipients'
                                  : 'Minor review only'}
                        </div>
                        <div style={sendGateTextStyle}>
                          {followUpTargets.length > 0
                            ? `${followUpTargets.length} player${followUpTargets.length === 1 ? '' : 's'} still need a follow-up or response.`
                            : lineupRows.length === 0
                              ? 'Import or build the weekly lineup before trying to announce it.'
                              : !messageBody.trim()
                                ? 'Load the right message into the composer before sending.'
                                : !selectedRecipients.length
                                  ? 'Choose the audience that should receive this message.'
                                  : 'No major blocker stands out right now.'}
                        </div>
                      </div>

                      <div style={sendGateCardStyle}>
                        <div style={sendGateLabelStyle}>Fastest next action</div>
                        <div style={sendGateValueStyle}>
                          {followUpTargets.length > 0
                            ? 'Load auto follow-up'
                            : lineupRows.length === 0
                              ? 'Import winning scenario'
                              : !messageBody.trim()
                                ? 'Apply send strategy'
                                : !selectedRecipients.length
                                  ? 'Set recipient mode'
                                  : 'Open texts'}
                        </div>
                        <div style={sendGateTextStyle}>
                          {followUpTargets.length > 0
                            ? 'Use the smart follow-up tools to clear blockers before the final send.'
                            : lineupRows.length === 0
                              ? 'Pull the winning scenario into the weekly lineup so communication stays anchored to the actual plan.'
                              : !messageBody.trim()
                                ? 'Let the console load the next best message automatically.'
                                : !selectedRecipients.length
                                  ? 'Use recipient intelligence to target the correct group.'
                                  : 'Your send path is ready — launch from the composer when comfortable.'}
                        </div>
                      </div>
                    </div>

                    <div style={actionRowStyle}>
                      <button type="button" style={primaryButton} onClick={applyRecommendedSendStrategy}>
                        Apply Best Next Action
                      </button>
                      <button type="button" style={ghostButtonSmallButton} onClick={loadAutoFollowUpMessage}>
                        Load Follow-Up
                      </button>
                      <button type="button" style={ghostButtonSmallButton} onClick={importScenarioToLineup}>
                        Sync Scenario to Lineup
                      </button>
                    </div>
                  </section>

                  <section style={surfaceCard}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Recipient risk radar</p>
                        <h3 style={sectionTitleSmall}>Who in this audience could still create problems</h3>
                      </div>
                      <span
                        style={
                          recipientRiskRadar.atRiskLineupPlayers > 0
                            ? warnPill
                            : recipientRiskRadar.passiveRecipients > 0
                              ? miniPillBlue
                              : miniPillGreen
                        }
                      >
                        {recipientRiskRadar.label}
                      </span>
                    </div>

                    <div style={riskRadarGridStyle}>
                      <div style={riskRadarCardStyle}>
                        <div style={riskRadarLabelStyle}>Lineup audience</div>
                        <div style={riskRadarValueStyle}>{recipientRiskRadar.lineupRecipients}</div>
                        <div style={riskRadarTextStyle}>
                          Recipients who are currently in the weekly lineup.
                        </div>
                      </div>

                      <div style={riskRadarCardStyle}>
                        <div style={riskRadarLabelStyle}>At-risk lineup players</div>
                        <div style={riskRadarValueStyle}>{recipientRiskRadar.atRiskLineupPlayers}</div>
                        <div style={riskRadarTextStyle}>
                          Lineup players in this audience who still show risk through availability or response state.
                        </div>
                      </div>

                      <div style={riskRadarCardStyle}>
                        <div style={riskRadarLabelStyle}>Passive recipients</div>
                        <div style={riskRadarValueStyle}>{recipientRiskRadar.passiveRecipients}</div>
                        <div style={riskRadarTextStyle}>
                          Recipients who have viewed or not responded and may still need a nudge.
                        </div>
                      </div>

                      <div style={riskRadarCardStyle}>
                        <div style={riskRadarLabelStyle}>Captain coverage</div>
                        <div style={riskRadarValueStyle}>{recipientRiskRadar.optedInCaptains}</div>
                        <div style={riskRadarTextStyle}>
                          Captains included in the current audience for backup coordination.
                        </div>
                      </div>
                    </div>
                  </section>

                  <section style={surfaceCardStrong}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Delivery readiness</p>
                        <h3 style={sectionTitleSmall}>How prepared this send is for the real world</h3>
                      </div>
                      <span
                        style={
                          deliveryReadiness.score >= 5
                            ? miniPillGreen
                            : deliveryReadiness.score >= 3
                              ? miniPillBlue
                              : warnPill
                        }
                      >
                        {deliveryReadiness.label}
                      </span>
                    </div>

                    <div style={deliveryReadinessGridStyle}>
                      <div style={deliveryReadinessCardStyle}>
                        <div style={deliveryReadinessLabelStyle}>Message body</div>
                        <div style={deliveryReadinessValueStyle}>{deliveryReadiness.hasBody ? 'Ready' : 'Missing'}</div>
                        <div style={deliveryReadinessTextStyle}>
                          {deliveryReadiness.hasBody
                            ? 'The composer already has a message loaded.'
                            : 'Load a lineup, follow-up, reminder, or availability message first.'}
                        </div>
                      </div>

                      <div style={deliveryReadinessCardStyle}>
                        <div style={deliveryReadinessLabelStyle}>Audience</div>
                        <div style={deliveryReadinessValueStyle}>{deliveryReadiness.hasAudience ? 'Selected' : 'Missing'}</div>
                        <div style={deliveryReadinessTextStyle}>
                          {deliveryReadiness.hasAudience
                            ? `${selectedRecipients.length} recipients are currently targeted.`
                            : 'Choose a recipient mode or custom list before sending.'}
                        </div>
                      </div>

                      <div style={deliveryReadinessCardStyle}>
                        <div style={deliveryReadinessLabelStyle}>Match context</div>
                        <div style={deliveryReadinessValueStyle}>{deliveryReadiness.hasEvent ? 'Loaded' : 'Missing'}</div>
                        <div style={deliveryReadinessTextStyle}>
                          {deliveryReadiness.hasEvent
                            ? 'The send is tied to a selected weekly event.'
                            : 'Select the upcoming match so messages stay grounded in the right week.'}
                        </div>
                      </div>

                      <div style={deliveryReadinessCardStyle}>
                        <div style={deliveryReadinessLabelStyle}>Lineup context</div>
                        <div style={deliveryReadinessValueStyle}>{deliveryReadiness.hasLineupContext ? 'Anchored' : 'Light'}</div>
                        <div style={deliveryReadinessTextStyle}>
                          {deliveryReadiness.hasLineupContext
                            ? 'A lineup or scenario is connected to this workflow.'
                            : 'Load a scenario or weekly lineup to strengthen captain communication.'}
                        </div>
                      </div>

                      <div style={deliveryReadinessCardStyle}>
                        <div style={deliveryReadinessLabelStyle}>Audience cleanliness</div>
                        <div style={deliveryReadinessValueStyle}>{deliveryReadiness.cleanAudience ? 'Clean' : 'Risk present'}</div>
                        <div style={deliveryReadinessTextStyle}>
                          {deliveryReadiness.cleanAudience
                            ? 'No major audience risks are showing in the current send.'
                            : 'There are at-risk or passive recipients worth reviewing before launch.'}
                        </div>
                      </div>
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

                    <p id="captain-messaging-composer-helper" style={sectionBodyTextStyle}>
                      Start with the communication goal, confirm the audience, then review the launch snapshot before opening texts.
                    </p>

                    <div style={filtersGridStyle}>
                      <Field
                        label="Message type"
                        htmlFor="message-kind"
                        hint="Start with the communication goal, then tailor the audience and body."
                      >
                        <select id="message-kind" aria-describedby="captain-messaging-composer-helper" value={messageKind} onChange={(e) => setMessageKind(e.target.value as MessageKind)} style={inputStyle}>
                          <option value="availability">Availability check</option>
                          <option value="lineup">Lineup announcement</option>
                          <option value="directions">Directions + details</option>
                          <option value="reminder">Match reminder</option>
                          <option value="follow-up">Follow-up</option>
                        </select>
                      </Field>
                      <Field
                        label="Recipient mode"
                        htmlFor="recipient-mode"
                        hint="Choose the broadest useful audience first, then narrow it only if needed."
                      >
                        <select id="recipient-mode" aria-describedby="captain-messaging-composer-helper" value={recipientMode} onChange={(e) => setRecipientMode(e.target.value as RecipientMode)} style={inputStyle}>
                          <option value="all-opted-in">All opted-in</option>
                          <option value="captains">Captains only</option>
                          <option value="active-only">Active only</option>
                          <option value="available-only">Available only</option>
                          <option value="lineup-only">Lineup only</option>
                          <option value="non-responders">Non-responders only</option>
                          <option value="custom">Custom</option>
                        </select>
                      </Field>
                      <Field
                        label="Saved template"
                        htmlFor="saved-template"
                        hint="Loading a template will replace the current title and body."
                      >
                        <select
                          id="saved-template"
                          aria-describedby="captain-messaging-composer-helper"
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
                      <Field
                        label="Message title"
                        htmlFor="message-title"
                        hint="Use a short internal label so you can find or save this message later."
                      >
                        <input id="message-title" aria-describedby="captain-messaging-composer-helper" value={messageTitle} onChange={(e) => setMessageTitle(e.target.value)} style={inputStyle} />
                      </Field>
                    </div>

                    {recipientMode === 'custom' ? (
                      <div style={recipientChooserStyle} role="group" aria-label="Custom recipient list" aria-describedby="captain-messaging-recipient-helper">
                        <p id="captain-messaging-recipient-helper" style={fieldHintStyle}>
                          {scopedContacts.filter((c) => c.phone && c.opt_in_text).length > 0
                            ? 'Only opted-in contacts with a saved phone number are shown here.'
                            : 'No opted-in contacts with phone numbers are available in the current scope yet.'}
                        </p>
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

                    <Field
                      label="Message body"
                      htmlFor="message-body"
                      hint="Keep it skimmable: key ask first, details second, deadlines or arrival notes last."
                    >
                      <textarea id="message-body" aria-describedby="captain-messaging-composer-helper" value={messageBody} onChange={(e) => setMessageBody(e.target.value)} style={textareaStyleLarge} />
                    </Field>

                    <div style={pillRowStyle}>
                      <span style={miniPillSlate}>{selectedRecipients.map((r) => r.full_name).join(', ') || 'No recipients selected'}</span>
                    </div>

                    <div style={actionRowStyle}>
                      <a href={captainAccess ? smsHref : undefined} style={{ ...primaryButton, ...(captainAccess ? null : disabledButtonStyle) }} onClick={(event) => { if (!captainAccess) { event.preventDefault(); setError('Captain tier required to send team messages.') } }}>Open texts</a>
                      <button type="button" style={ghostButtonSmallButton} onClick={copyBody}>{copiedState === 'body' ? 'Copied body' : 'Copy body'}</button>
                      <button type="button" style={ghostButtonSmallButton} onClick={copyNumbers}>{copiedState === 'numbers' ? 'Copied numbers' : 'Copy numbers'}</button>
                      <button type="button" style={ghostButtonSmallButton} onClick={() => void handleSaveTemplate()} disabled={!captainAccess}>Save template</button>
                    </div>
                  </section>
                </div>
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
                    <Field label="Full name" htmlFor="draft-contact-name">
                      <input id="draft-contact-name" value={draftContact.full_name} onChange={(e) => setDraftContact((c) => ({ ...c, full_name: e.target.value }))} style={inputStyle} />
                    </Field>
                    <Field label="Cell phone" htmlFor="draft-contact-phone" hint="Use the number exactly as you want it texted.">
                      <input id="draft-contact-phone" value={draftContact.phone} onChange={(e) => setDraftContact((c) => ({ ...c, phone: e.target.value }))} style={inputStyle} />
                    </Field>
                    <Field label="Role" htmlFor="draft-contact-role">
                      <input id="draft-contact-role" value={draftContact.role} onChange={(e) => setDraftContact((c) => ({ ...c, role: e.target.value }))} style={inputStyle} />
                    </Field>
                    <Field label="Notes" htmlFor="draft-contact-notes" hint="Add context like doubles-only, early arrival, or sub availability.">
                      <input id="draft-contact-notes" value={draftContact.notes} onChange={(e) => setDraftContact((c) => ({ ...c, notes: e.target.value }))} style={inputStyle} />
                    </Field>
                  </div>

                  <div style={checkboxGridStyle}>
                    <label style={checkboxRowStyle}><input type="checkbox" checked={draftContact.is_captain} onChange={(e) => setDraftContact((c) => ({ ...c, is_captain: e.target.checked }))} /> Captain</label>
                    <label style={checkboxRowStyle}><input type="checkbox" checked={draftContact.is_active} onChange={(e) => setDraftContact((c) => ({ ...c, is_active: e.target.checked }))} /> Active</label>
                    <label style={checkboxRowStyle}><input type="checkbox" checked={draftContact.opt_in_text} onChange={(e) => setDraftContact((c) => ({ ...c, opt_in_text: e.target.checked }))} /> Opted in to text</label>
                  </div>

                  <div style={actionRowStyle}>
                    <button type="button" style={{ ...primaryButton, ...(!captainAccess ? disabledButtonStyle : {}) }} onClick={() => void handleSaveContact()} disabled={!captainAccess}>{editingId ? 'Update contact' : 'Save contact'}</button>
                    {editingId ? <button type="button" style={ghostButtonSmallButton} onClick={() => {
                      setEditingId(null)
                      setDraftContact({ full_name: '', phone: '', role: 'Player', is_captain: false, is_active: true, opt_in_text: true, notes: '' })
                    }}>Cancel edit</button> : null}
                  </div>

                  <Field
                    label="Bulk import (Name, Phone, Role, captain, note)"
                    htmlFor="bulk-import"
                    hint="One contact per line. Leave the captain column blank for regular players."
                  >
                    <textarea id="bulk-import" value={bulkImportText} onChange={(e) => setBulkImportText(e.target.value)} style={textareaStyle} placeholder={'Jane Smith, 314-555-1111, Player, captain, early arrival\nJohn Doe, 314-555-2222, Player, , doubles only'} />
                  </Field>
                  <button type="button" style={ghostButtonSmallButton} onClick={handleBulkImport} disabled={!captainAccess}>Import contacts</button>
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

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <CaptainFormField
      label={label}
      htmlFor={htmlFor}
      hint={hint}
      hintStyle={fieldHintStyle}
      labelStyle={labelStyle}
    >
      {children}
    </CaptainFormField>
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
const fieldHintStyle: CSSProperties = { margin: '0 0 8px', color: 'rgba(224,234,247,0.62)', fontSize: '12px', lineHeight: 1.55 }
const inputStyle: CSSProperties = { width: '100%', height: '48px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#f8fbff', padding: '0 14px', fontSize: '14px', outline: 'none' }
const inputStyleMuted: CSSProperties = { ...inputStyle, opacity: 0.78 }
const textareaStyle: CSSProperties = { width: '100%', minHeight: '100px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#f8fbff', padding: '12px 14px', fontSize: '14px', outline: 'none', resize: 'vertical' }
const textareaStyleLarge: CSSProperties = { ...textareaStyle, minHeight: 180 }

const primaryButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 46, padding: '0 16px', borderRadius: 999, textDecoration: 'none', fontWeight: 800, background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)', color: '#071622', border: '1px solid rgba(155,225,29,0.34)', boxShadow: '0 16px 32px rgba(74, 222, 128, 0.14)' }
const primaryButtonBlock: CSSProperties = { ...primaryButton, width: '100%', appearance: 'none', cursor: 'pointer' }
const ghostButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 46, padding: '0 16px', borderRadius: 999, textDecoration: 'none', fontWeight: 800, background: 'linear-gradient(180deg, rgba(58,115,212,0.18) 0%, rgba(27,62,120,0.14) 100%)', color: '#ebf1fd', border: '1px solid rgba(116,190,255,0.18)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }
const ghostButtonSmallButton: CSSProperties = { ...ghostButton, minHeight: 42, cursor: 'pointer', appearance: 'none' }
const disabledButtonStyle: CSSProperties = { opacity: 0.55, cursor: 'not-allowed' }

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

const intelligenceGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
  marginTop: 4,
}

const intelligenceCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  display: 'grid',
  gap: 8,
}

const intelligenceLabelStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const intelligenceValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '20px',
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const intelligenceTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.76)',
  lineHeight: 1.65,
  fontSize: '14px',
}

const blockingListStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  marginTop: 14,
}

const blockingCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 14,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  flexWrap: 'wrap',
}

const blockingNameStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 800,
  fontSize: 15,
}

const blockingMetaStyle: CSSProperties = {
  marginTop: 4,
  color: 'rgba(224,234,247,0.68)',
  fontSize: 13,
  lineHeight: 1.5,
}

const recipientIntelligenceGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 14,
  marginTop: 4,
}

const recipientIntelligenceCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  display: 'grid',
  gap: 8,
}

const recipientIntelligenceLabelStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const recipientIntelligenceValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '20px',
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const recipientIntelligenceTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.76)',
  lineHeight: 1.65,
  fontSize: '14px',
}

const sendStrategyGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
  marginTop: 4,
}

const sendStrategyCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  display: 'grid',
  gap: 8,
}

const sendStrategyLabelStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const sendStrategyValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '20px',
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const sendStrategyTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.76)',
  lineHeight: 1.65,
  fontSize: '14px',
}

const weeklyCommandGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
  marginTop: 4,
}

const weeklyCommandCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  display: 'grid',
  gap: 8,
}

const weeklyCommandLabelStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const weeklyCommandValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '20px',
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const weeklyCommandTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.76)',
  lineHeight: 1.65,
  fontSize: '14px',
}

const actionQueueGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
  marginTop: 4,
}

const actionQueueCardBaseStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'grid',
  gap: 8,
}

const actionQueueCardGoodStyle: CSSProperties = {
  ...actionQueueCardBaseStyle,
  background: 'rgba(155,225,29,0.08)',
}

const actionQueueCardWarnStyle: CSSProperties = {
  ...actionQueueCardBaseStyle,
  background: 'rgba(255, 93, 93, 0.08)',
}

const actionQueueCardInfoStyle: CSSProperties = {
  ...actionQueueCardBaseStyle,
  background: 'rgba(37, 91, 227, 0.12)',
}

const actionQueueLabelStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const actionQueueValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '20px',
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const actionQueueTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.76)',
  lineHeight: 1.65,
  fontSize: '14px',
}

const executionChecklistGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
  marginTop: 4,
}

const executionChecklistCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  display: 'grid',
  gap: 8,
}

const executionChecklistTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
}

const executionChecklistLabelStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 800,
  fontSize: '15px',
}

const executionChecklistDetailStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.76)',
  lineHeight: 1.6,
  fontSize: '14px',
}

const outcomePlannerGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
  marginTop: 4,
}

const outcomePlannerCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  display: 'grid',
  gap: 8,
}

const outcomePlannerLabelStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const outcomePlannerValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '20px',
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const outcomePlannerTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.76)',
  lineHeight: 1.65,
  fontSize: '14px',
}

const sequencePlannerGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
  marginTop: 4,
}

const sequencePlannerCardBaseStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'grid',
  gap: 8,
}

const sequencePlannerCardGoodStyle: CSSProperties = {
  ...sequencePlannerCardBaseStyle,
  background: 'rgba(155,225,29,0.08)',
}

const sequencePlannerCardWarnStyle: CSSProperties = {
  ...sequencePlannerCardBaseStyle,
  background: 'rgba(255, 93, 93, 0.08)',
}

const sequencePlannerCardInfoStyle: CSSProperties = {
  ...sequencePlannerCardBaseStyle,
  background: 'rgba(37, 91, 227, 0.12)',
}

const sequencePlannerLabelStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const sequencePlannerValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '20px',
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const sequencePlannerTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.76)',
  lineHeight: 1.65,
  fontSize: '14px',
}

const launchSnapshotGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
  marginTop: 4,
}

const launchSnapshotCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  display: 'grid',
  gap: 8,
}

const launchSnapshotLabelStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const launchSnapshotValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '20px',
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const launchSnapshotTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.76)',
  lineHeight: 1.65,
  fontSize: '14px',
}

const sendConfidenceGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
  marginTop: 4,
}

const sendConfidenceCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  display: 'grid',
  gap: 8,
}

const sendConfidenceLabelStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const sendConfidenceValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '20px',
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const sendConfidenceTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.76)',
  lineHeight: 1.65,
  fontSize: '14px',
}

const sendGateGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
  marginTop: 4,
}

const sendGateCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  display: 'grid',
  gap: 8,
}

const sendGateLabelStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const sendGateValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '20px',
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const sendGateTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.76)',
  lineHeight: 1.65,
  fontSize: '14px',
}

const riskRadarGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
  marginTop: 4,
}

const riskRadarCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  display: 'grid',
  gap: 8,
}

const riskRadarLabelStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const riskRadarValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '20px',
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const riskRadarTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.76)',
  lineHeight: 1.65,
  fontSize: '14px',
}

const deliveryReadinessGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
  marginTop: 4,
}

const deliveryReadinessCardStyle: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  display: 'grid',
  gap: 8,
}

const deliveryReadinessLabelStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const deliveryReadinessValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '20px',
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const deliveryReadinessTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.76)',
  lineHeight: 1.65,
  fontSize: '14px',
}
