'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { CSSProperties, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SiteShell from '@/app/components/site-shell'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { useAuth } from '@/app/components/auth-provider'
import { buildProductAccessState } from '@/lib/access-model'
import { getPlanUnlockHref } from '@/lib/plan-intent'
import {
  buildCaptainScopedHref,
  readCaptainResumeState,
  writeCaptainResumeState,
} from '@/lib/captain-memory'
import {
  addCaptainTeamScope,
  buildCaptainTeamScopeKey as buildTeamOptionKey,
  captainTeamOptionMatchesScopes,
  chooseCaptainTeamOption,
  getCaptainTeamScopeSource,
  getCaptainTeamScopeSourceLabel,
  type CaptainTeamScope,
} from '@/lib/captain-team-scope'
import { CAPTAIN_STORY, DATA_ASSIST_STORY } from '@/lib/product-story'
import { trackProductUsageEvent } from '@/lib/product-usage-client'
import {
  buildCaptainWeekNotesScopeKey,
  readCaptainWeekNotes,
  upsertCaptainWeekNotes,
} from '@/lib/captain-week-notes'
import {
  buildCaptainWeekStatusKey,
  getCaptainWeekStatusMeta,
  readCaptainWeekStatus,
  upsertCaptainWeekStatus,
  type CaptainWeekStatus,
} from '@/lib/captain-week-status'
import { loadUserProfileLink, type UserProfileLink } from '@/lib/user-profile'
import { supabase } from '@/lib/supabase'
import { isMember } from '@/lib/roles'
import {
  formatDate,
  formatRating,
  formatMonthDay as formatDateShort,
  formatDateTime as formatDateTimeShort,
  safeKey,
  safeText,
  normalizeTeamName,
  average,
  winPct as getWinPct,
  formatPercent,
  readLocalItem as readLocalObject,
  readLocalArray,
} from '@/lib/captain-formatters'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'

const dataAssistCaptainHref = '/data-assist?intent=upload-source&context=Team%20Hub'
const CAPTAIN_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('relentless-competitor-4-0')
const CAPTAIN_PLAYER_IDENTITY_READ = getPlayerDevelopmentIdentityActionRead(CAPTAIN_PLAYER_IDENTITY)
const CAPTAIN_LEVEL_UP_HREF = `/level-up/${CAPTAIN_PLAYER_IDENTITY.slug}#level-up-flow`
const CAPTAIN_PLAYER_DEVELOPMENT_HREF = `/player-development/${CAPTAIN_PLAYER_IDENTITY.slug}`
const captainPlayerIdStarterRead = [
  { label: 'Train first', value: CAPTAIN_PLAYER_IDENTITY_READ.trainingPriority },
  { label: 'Proof target', value: CAPTAIN_PLAYER_IDENTITY_READ.proofTarget },
  { label: 'Match test', value: CAPTAIN_PLAYER_IDENTITY_READ.matchTrigger },
] as const

type TeamMatch = {
  id: string
  league_name: string | null
  flight: string | null
  home_team: string | null
  away_team: string | null
  match_date: string
  match_type: 'singles' | 'doubles'
  score: string | null
  winner_side: 'A' | 'B'
}

type PlayerRelation =
  | {
      id: string
      name: string
      overall_rating: number | null
      overall_dynamic_rating: number | null
      overall_usta_dynamic_rating: number | null
      singles_dynamic_rating: number | null
      singles_usta_dynamic_rating: number | null
      doubles_dynamic_rating: number | null
      doubles_usta_dynamic_rating: number | null
    }
  | {
      id: string
      name: string
      overall_rating: number | null
      overall_dynamic_rating: number | null
      overall_usta_dynamic_rating: number | null
      singles_dynamic_rating: number | null
      singles_usta_dynamic_rating: number | null
      doubles_dynamic_rating: number | null
      doubles_usta_dynamic_rating: number | null
    }[]
  | null

type MatchPlayer = {
  match_id: string
  side: 'A' | 'B'
  seat: number | null
  player_id: string
  players: PlayerRelation
}

type TeamRosterMember = {
  player_id: string
  player_name: string | null
  team_name: string | null
  league_name: string | null
  flight: string | null
  players: PlayerRelation
}

type TeamOption = {
  team: string
  league: string
  flight: string
  matches: number
}

type TeamOptionMatchRow = {
  home_team: string | null
  away_team: string | null
  league_name: string | null
  flight: string | null
  match_date: string
  line_number?: string | null
}

type CaptainProfileLinkRow = UserProfileLink

type CaptainRosterScopeRow = {
  team_name: string | null
  league_name: string | null
  flight: string | null
}

type CaptainTiqTeamEntryScopeRow = {
  team_name: string | null
  source_league_name: string | null
  source_flight: string | null
  entry_status: string | null
}

type CaptainWorkspaceState = {
  lineupReady: boolean
  scenarioReady: boolean
  messagingReady: boolean
  briefReady: boolean
  currentEventKey: string
  lineupCount: number
  scenarioCount: number
  responseAlertCount: number
  pendingResponseCount: number
  latestResponseUpdateLabel: string
  lastUpdatedLabel: string
}

type CaptainResumeStage =
  | 'lineup'
  | 'projection'
  | 'scenario'
  | 'messaging'
  | 'analytics'
  | 'availability'
  | 'team'
  | 'brief'
  | 'season-dashboard'
  | 'tiq-team-matches'

type CaptainCommandStep = {
  label: string
  title: string
  detail: string
  href: string
  stage: CaptainResumeStage
  icon: TiqFeatureIconName
  stateLabel: string
  tone: 'good' | 'warn' | 'info'
  cta: string
  premium?: boolean
}

type CaptainSaveSignal = {
  label: string
  state: string
  detail: string
  tone: 'good' | 'warn' | 'info'
}

type CaptainPlayerReadinessItem = {
  label: string
  state: string
  detail: string
  tone: 'good' | 'warn' | 'info'
}

type CaptainNudgeDraft = {
  label: string
  state: string
  detail: string
  body: string
  href: string
  stage: CaptainResumeStage
  tone: 'good' | 'warn' | 'info'
  cta: string
}

type CaptainWeekTimelineItem = {
  label: string
  title: string
  state: string
  detail: string
  href: string
  stage: CaptainResumeStage
  tone: 'good' | 'warn' | 'info'
  cta: string
}

type CaptainMatchDayCommandAction = {
  label: string
  state: string
  detail: string
  href: string
  stage: CaptainResumeStage
  tone: 'good' | 'warn' | 'info'
}

type CaptainEmergencyAction = {
  label: string
  state: string
  detail: string
  href: string
  stage: CaptainResumeStage
  tone: 'good' | 'warn' | 'info'
  cta: string
}

type CaptainMorningBriefItem = {
  label: string
  value: string
  detail: string
  tone: 'good' | 'warn' | 'info'
}

type CaptainHandoffSheetItem = {
  label: string
  state: string
  detail: string
  tone: 'good' | 'warn' | 'info'
}

type CaptainSendQueueItem = {
  id: string
  label: string
  state: string
  detail: string
  body: string
  href: string
  stage: CaptainResumeStage
  tone: 'good' | 'warn' | 'info'
}

type CaptainPreSendCheck = {
  label: string
  state: string
  detail: string
  href: string
  stage: CaptainResumeStage
  tone: 'good' | 'warn' | 'info'
}

type CaptainPostSendTrackerItem = {
  id: string
  label: string
  state: string
  detail: string
  tone: 'good' | 'warn' | 'info'
}

type CaptainChangeAckTarget = {
  id: string
  name: string
  court: string
  state: string
  detail: string
  status: 'pending' | 'acknowledged'
  tone: 'good' | 'warn' | 'info'
}

type CaptainArrivalRiskStatus = 'eta-needed' | 'on-time' | 'running-late' | 'backup-ready'

type CaptainArrivalRiskTarget = {
  id: string
  name: string
  court: string
  role: string
  status: CaptainArrivalRiskStatus
  state: string
  detail: string
  tone: 'good' | 'warn' | 'info'
}

type CaptainCourtHandoffStatus = 'prep' | 'warmup' | 'ready'

type CaptainCourtHandoffItem = {
  id: string
  courtKey: string
  courtLabel: string
  players: string
  status: CaptainCourtHandoffStatus
  state: string
  phase: string
  detail: string
  timerLabel: string
  ackLabel: string
  arrivalLabel: string
  tone: 'good' | 'warn' | 'info'
}

type CaptainNotificationQueueStatus = 'queued' | 'sent' | 'hold'

type CaptainNotificationQueueItem = {
  id: string
  label: string
  audience: string
  state: string
  detail: string
  timing: string
  source: string
  body: string
  queueStatus: CaptainNotificationQueueStatus
  tone: 'good' | 'warn' | 'info'
}

type CaptainPlayerBriefStatus = 'review' | 'briefed'

type CaptainPlayerBriefItem = {
  id: string
  courtKey: string
  courtLabel: string
  players: string
  status: CaptainPlayerBriefStatus
  state: string
  detail: string
  firstJob: string
  betweenSets: string
  ifTrouble: string
  body: string
  tone: 'good' | 'warn' | 'info'
}

type CaptainReplyReminderTarget = {
  id: string
  name: string
  status: string
  detail: string
  tone: 'good' | 'warn' | 'info'
}

type CaptainReplyReminderTemplate = {
  id: string
  label: string
  state: string
  detail: string
  body: string
  tone: 'good' | 'warn' | 'info'
}

type CaptainCourtConfidenceItem = {
  label: string
  players: string
  state: string
  detail: string
  tone: 'good' | 'warn' | 'info'
}

type CaptainBenchReadinessItem = {
  id: string
  name: string
  fit: string
  signal: string
  detail: string
  priority: string
  tone: 'good' | 'warn' | 'info'
}

type CaptainCourtSwapItem = {
  id: string
  courtLabel: string
  outPlayer: string
  inPlayer: string
  keep: string
  state: string
  detail: string
  tone: 'good' | 'warn' | 'info'
}

type CaptainDecisionPath = {
  label: string
  question: string
  answer: string
  href: string
  stage: CaptainResumeStage
  cta: string
  icon: TiqFeatureIconName
  tone: 'good' | 'warn' | 'info'
  requiresScope?: boolean
}

const CAPTAIN_LOCAL_SYNC_PROOF_CHECKS = [
  'Browser-saved: selected team week, lineups, event notes, response status, and week status.',
  'Linked context: roster, schedule, and team history from profile links or reviewed Data Assist imports.',
  'Not account sync yet: browser-saved week work should not be treated as cross-device proof.',
] as const

const CAPTAIN_DECISION_HANDOFF_PROOF_STEPS = [
  {
    label: 'Availability',
    detail: 'Start with who is in, out, maybe, or still needs a follow-up.',
  },
  {
    label: 'Lineup option',
    detail: 'Save at least one playable court plan before messaging the team.',
  },
  {
    label: 'Scenario check',
    detail: 'Compare one projection or alternative when the lineup call is not obvious.',
  },
  {
    label: 'Team send',
    detail: 'Open the weekly brief, team brief, or message prep after the decision is ready.',
  },
] as const

type CaptainLevelUpChallenge = {
  id: string
  title: string
  focus: string
  detail: string
  proof: string
  cardIds: string[]
}

const CAPTAIN_LEVEL_UP_CHALLENGES: CaptainLevelUpChallenge[] = [
  {
    id: 'rhythm-builder',
    title: 'Rhythm Builder',
    focus: 'Ready feet, wall rhythm, and pre-play readiness',
    detail: 'Use this as a low-friction team habit for players who need a clean starting rhythm before practice or match warm-up.',
    proof: 'Track aggregate completion only. Individual proof and notes stay private unless players choose to share.',
    cardIds: ['split-step-rhythm', 'wall-rally-rhythm', 'dynamic-tennis-warm-up'],
  },
  {
    id: 'consistency-builder',
    title: 'Consistency Builder',
    focus: 'Crosscourt tolerance, wide-ball neutralizing, and post-play recovery',
    detail: 'Use this when the lineup week needs cleaner rally habits and fewer preventable misses.',
    proof: 'Track aggregate completion only. Individual misses, notes, and proof scores stay private by default.',
    cardIds: ['crosscourt-consistency', 'wide-ball-neutralizer', 'post-play-mobility-reset'],
  },
  {
    id: 'point-start-routine',
    title: 'Point-Start Routine',
    focus: 'Serve target, return job, and 30-30 reset clarity',
    detail: 'Use this when the team week depends on better first-two-shot decisions under pressure.',
    proof: 'Aggregate completion only; players control whether any personal proof detail is shared.',
    cardIds: ['serve-target-call', 'return-depth-lane', '30-30-pressure-game'],
  },
  {
    id: 'match-day-routine',
    title: 'Match-Day Routine',
    focus: 'Warm-up, return intent, and post-match debrief',
    detail: 'Run this as a team habit before the next lineup week. Completion can be tracked as an aggregate team signal.',
    proof: 'Aggregate completion only. Private player proof and notes stay with each player.',
    cardIds: ['five-minute-match-primer', 'return-30-30-game', 'post-match-five-minute-debrief'],
  },
  {
    id: 'doubles-readiness',
    title: 'Doubles Readiness',
    focus: 'Partner first move, poach timing, and 30-30 doubles clarity',
    detail: 'Use this when the team week depends on clearer doubles jobs and partner communication.',
    proof: 'Track who completed the challenge; keep individual notes private unless players share them.',
    cardIds: ['partner-first-move-call', 'poach-timing-shadow', 'doubles-30-30-game'],
  },
]

const CAPTAIN_EMPTY_STATE_ACTIONS = [
  'Set your Player ID so Team Hub can find your profile team.',
  'Upload a reviewed team summary or schedule through Data Assist when roster or match history is missing.',
  'Refresh Captain after the upload review connects teams, schedules, and scorecards.',
] as const

const WEEKLY_LINEUPS_STORAGE_KEY = 'tenaceiq_weekly_lineups'
const WEEKLY_EVENT_DETAILS_STORAGE_KEY = 'tenaceiq_weekly_event_details'
const WEEKLY_RESPONSES_STORAGE_KEY = 'tenaceiq_weekly_responses'
const CAPTAIN_MESSAGE_CONTACTS_STORAGE_KEY = 'tenaceiq_captain_message_contacts'
const CAPTAIN_DECISION_LOG_STORAGE_KEY = 'tenaceiq_captain_decision_log'
const CAPTAIN_SCORE_CAPTURE_STORAGE_KEY = 'tenaceiq_captain_score_capture'
const CAPTAIN_CHANGE_ACK_STORAGE_KEY = 'tenaceiq_captain_change_acknowledgments'
const CAPTAIN_ARRIVAL_RISK_STORAGE_KEY = 'tenaceiq_captain_arrival_risk'
const CAPTAIN_COURT_HANDOFF_STORAGE_KEY = 'tenaceiq_captain_court_handoff'
const CAPTAIN_NOTIFICATION_QUEUE_STORAGE_KEY = 'tenaceiq_captain_notification_queue'
const CAPTAIN_PLAYER_BRIEF_STORAGE_KEY = 'tenaceiq_captain_player_brief_cards'
const CAPTAIN_REPLY_OPEN_STATUSES = new Set(['', 'viewed', 'no-response', 'running-late', 'need-sub'])

type CaptainLineupAssignment = {
  id?: string
  event_key?: string
  court_label?: string
  slot_type?: string
  players?: string[]
}

type CaptainEventDetail = {
  key?: string
  location?: string
  arrivalTime?: string
  notes?: string
}

type CaptainWeeklyResponse = {
  id?: string
  event_key?: string
  contact_id?: string
  status?: string
  note?: string
  updated_at?: string
}

type CaptainMessageContact = {
  id?: string
  full_name?: string
  phone?: string
  is_active?: boolean
  opt_in_text?: boolean
}

type CaptainDecisionLogEntry = {
  id?: string
  event_key?: string
  label?: string
  detail?: string
  action?: string
  tone?: 'good' | 'warn' | 'info'
  created_at?: string
}

type CaptainScoreCaptureStatus = 'pending' | 'score-captured' | 'issue' | 'complete'

type CaptainScoreCaptureEntry = {
  id?: string
  event_key?: string
  court_key?: string
  court_label?: string
  players?: string
  status?: CaptainScoreCaptureStatus
  updated_at?: string
}

type CaptainChangeAckEntry = {
  id?: string
  event_key?: string
  target_key?: string
  name?: string
  status?: 'pending' | 'acknowledged'
  updated_at?: string
}

type CaptainArrivalRiskEntry = {
  id?: string
  event_key?: string
  target_key?: string
  name?: string
  status?: CaptainArrivalRiskStatus
  updated_at?: string
}

type CaptainCourtHandoffEntry = {
  id?: string
  event_key?: string
  court_key?: string
  court_label?: string
  status?: CaptainCourtHandoffStatus
  updated_at?: string
}

type CaptainNotificationQueueEntry = {
  id?: string
  event_key?: string
  item_key?: string
  label?: string
  status?: CaptainNotificationQueueStatus
  updated_at?: string
}

type CaptainPlayerBriefEntry = {
  id?: string
  event_key?: string
  court_key?: string
  court_label?: string
  status?: CaptainPlayerBriefStatus
  updated_at?: string
}

type RatingStatus = 'Bump Up Pace' | 'Trending Up' | 'Holding' | 'At Risk' | 'Drop Watch'

type TeamPlayerSummary = {
  id: string
  name: string
  appearances: number
  wins: number
  losses: number
  singlesDynamic: number | null
  doublesDynamic: number | null
  overallBase: number | null
  overallUstaDynamic: number | null
  ratingStatus: RatingStatus | null
}

type PairingSummary = {
  key: string
  names: string[]
  appearances: number
  wins: number
  losses: number
  avgDoublesRating: number | null
}

type CaptainSubBoardFlag = {
  key: string
  label: string
  state: string
  detail: string
  tone: 'good' | 'warn' | 'info'
}

type CaptainSubCandidate = {
  id: string
  name: string
  fit: string
  signal: string
  detail: string
  tone: 'good' | 'warn' | 'info'
}

type CaptainCloseoutCheck = {
  label: string
  state: string
  detail: string
  tone: 'good' | 'warn' | 'info'
}

type CaptainSeasonLaunchItem = {
  label: string
  state: string
  detail: string
  href: string
  stage: CaptainResumeStage
  cta: string
  tone: 'good' | 'warn' | 'info'
}

type CaptainOpponentScoutItem = {
  label: string
  state: string
  detail: string
  tone: 'good' | 'warn' | 'info'
}

function normalizePlayerRelation(player: PlayerRelation) {
  if (!player) return null
  return Array.isArray(player) ? player[0] ?? null : player
}

export default function CaptainHubPage() {
  return (
    <SiteShell active="/captain">
      <CaptainHubContent />
    </SiteShell>
  )
}

function CaptainLockedSurface({
  secondaryLabel,
  secondaryHref,
}: {
  secondaryLabel: string
  secondaryHref: string
}) {
  const { isMobile, isSmallMobile } = useViewportBreakpoints()
  const lockedHeroCard: CSSProperties = {
    ...heroCard,
    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : heroCard.gridTemplateColumns,
    gap: isMobile ? 16 : heroCard.gap,
    alignItems: 'start',
    padding: 0,
    border: 0,
    background: 'transparent',
    boxShadow: 'none',
    overflow: 'visible',
  }
  const lockedPreviewPanel: CSSProperties = {
    ...heroLeft,
    ...lockedPreviewPanelStyle,
    padding: isSmallMobile ? 14 : isMobile ? 16 : lockedPreviewPanelStyle.padding,
  }
  const lockedPreviewGrid: CSSProperties = {
    ...captainPreviewGridStyle,
    gridTemplateColumns: isMobile
      ? 'repeat(2, minmax(0, 1fr))'
      : captainPreviewGridStyle.gridTemplateColumns,
    gap: isMobile ? 8 : captainPreviewGridStyle.gap,
  }
  const lockedPreviewStep: CSSProperties = {
    ...captainPreviewStepStyle,
    gridTemplateColumns: isMobile
      ? 'minmax(0, 24px) minmax(0, 1fr)'
      : captainPreviewStepStyle.gridTemplateColumns,
    gap: isMobile ? 8 : captainPreviewStepStyle.gap,
    padding: isMobile ? 8 : captainPreviewStepStyle.padding,
    borderRadius: isMobile ? 12 : captainPreviewStepStyle.borderRadius,
  }
  const lockedPreviewStepNumber: CSSProperties = {
    ...captainPreviewStepNumberStyle,
    width: isMobile ? 24 : captainPreviewStepNumberStyle.width,
    height: isMobile ? 24 : captainPreviewStepNumberStyle.height,
  }
  const lockedPreviewStepCopy: CSSProperties = {
    ...captainPreviewStepCopyStyle,
    gap: isMobile ? 3 : captainPreviewStepCopyStyle.gap,
    fontSize: isMobile ? 11 : captainPreviewStepCopyStyle.fontSize,
    lineHeight: isMobile ? 1.25 : captainPreviewStepCopyStyle.lineHeight,
  }
  const captainUnlockHref = getPlanUnlockHref('captain')

  return (
    <div style={pageWrap}>
      <section style={lockedHeroCard} aria-label="Team Hub preview">
        <span aria-hidden="true" style={watermarkStyle} />
        <div style={lockedPreviewPanel}>
          <div>
            <div style={sectionKicker}>Captain tools</div>
            <h1 style={scopeTitleStyle}>Run match week with less chaos.</h1>
          </div>
          {!isMobile ? (
            <p style={captainPreviewTextStyle}>
              Start with who can play, build the lineup, check the pairings, and send the match-week plan.
            </p>
          ) : null}
          {isMobile ? (
            <div style={captainPreviewMobileActionRowStyle} aria-label="Captain mobile unlock actions">
              <Link href={captainUnlockHref} style={captainPreviewMobilePrimaryActionStyle}>
                {CAPTAIN_STORY.upgradeCta}
              </Link>
              <Link href={secondaryHref} style={captainPreviewMobileSecondaryActionStyle}>
                {secondaryLabel}
              </Link>
            </div>
          ) : null}
          <div style={lockedPreviewGrid}>
            {CAPTAIN_STORY.workflow.map(([step, title, body]) => (
              <div key={step} style={lockedPreviewStep}>
                <span style={lockedPreviewStepNumber}>{step}</span>
                <span style={lockedPreviewStepCopy}>
                  <strong>{title}</strong>
                  {!isMobile ? <span>{body}</span> : null}
                </span>
              </div>
            ))}
          </div>
        </div>
        <UpgradePrompt
          planId="captain"
          headline={CAPTAIN_STORY.upgradeHeadline}
          body={CAPTAIN_STORY.upgradeBody}
          result={CAPTAIN_STORY.upgradeResult}
          ctaLabel={CAPTAIN_STORY.upgradeCta}
          secondaryLabel={secondaryLabel}
          secondaryHref={secondaryHref}
          compact
          summaryOnly={isMobile}
        />
      </section>
    </div>
  )
}

function CaptainHubContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()

  const { userId, role, entitlements, authResolved } = useAuth()
  const [captainTeamScopes, setCaptainTeamScopes] = useState<CaptainTeamScope[]>([])
  const [teamScopeResolved, setTeamScopeResolved] = useState(false)

  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([])
  const [selectedCompetitionLayer, setSelectedCompetitionLayer] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedLeague, setSelectedLeague] = useState('')
  const [selectedFlight, setSelectedFlight] = useState('')

  const [matches, setMatches] = useState<TeamMatch[]>([])
  const [participants, setParticipants] = useState<MatchPlayer[]>([])
  const [rosterMembers, setRosterMembers] = useState<TeamRosterMember[]>([])

  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [error, setError] = useState('')
  const [nextMatch, setNextMatch] = useState<{
    date: string
    time: string | null
    facility: string | null
    opponent: string
    home: boolean
  } | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  const [scenarioCount, setScenarioCount] = useState(0)
  const [workspaceState, setWorkspaceState] = useState<CaptainWorkspaceState>({
    lineupReady: false,
    scenarioReady: false,
    messagingReady: false,
    briefReady: false,
    currentEventKey: '',
    lineupCount: 0,
    scenarioCount: 0,
    responseAlertCount: 0,
    pendingResponseCount: 0,
    latestResponseUpdateLabel: 'Not updated yet',
    lastUpdatedLabel: 'Not updated yet',
  })
  const [rosterSortMode, setRosterSortMode] = useState<'appearances' | 'signal'>('appearances')
  const [weeklyPrepNotes, setWeeklyPrepNotes] = useState('')
  const [opponentScoutNotes, setOpponentScoutNotes] = useState('')
  const [notesUpdatedLabel, setNotesUpdatedLabel] = useState('Weekly notes not saved yet')
  const [loadedNotesScopeKey, setLoadedNotesScopeKey] = useState('')
  const [weekStatus, setWeekStatus] = useState<CaptainWeekStatus>('draft-lineup')
  const [copiedCaptainNudgeLabel, setCopiedCaptainNudgeLabel] = useState('')
  const [copiedCaptainLineupSummary, setCopiedCaptainLineupSummary] = useState(false)
  const [copiedCaptainReplyReminderId, setCopiedCaptainReplyReminderId] = useState('')
  const [copiedCaptainSendQueueId, setCopiedCaptainSendQueueId] = useState('')
  const [copiedCaptainHandoffSheet, setCopiedCaptainHandoffSheet] = useState(false)
  const [copiedCaptainPostMatchRecap, setCopiedCaptainPostMatchRecap] = useState(false)
  const [copiedCaptainEmergencyMode, setCopiedCaptainEmergencyMode] = useState(false)
  const [copiedCaptainChangeAckChase, setCopiedCaptainChangeAckChase] = useState(false)
  const [copiedCaptainArrivalRiskMessage, setCopiedCaptainArrivalRiskMessage] = useState(false)
  const [copiedCaptainCourtHandoff, setCopiedCaptainCourtHandoff] = useState(false)
  const [copiedCaptainNotificationQueueId, setCopiedCaptainNotificationQueueId] = useState('')
  const [copiedCaptainPlayerBriefId, setCopiedCaptainPlayerBriefId] = useState('')
  const [captainDecisionLogVersion, setCaptainDecisionLogVersion] = useState(0)
  const [captainScoreCaptureVersion, setCaptainScoreCaptureVersion] = useState(0)
  const [captainChangeAckVersion, setCaptainChangeAckVersion] = useState(0)
  const [captainArrivalRiskVersion, setCaptainArrivalRiskVersion] = useState(0)
  const [captainCourtHandoffVersion, setCaptainCourtHandoffVersion] = useState(0)
  const [captainNotificationQueueVersion, setCaptainNotificationQueueVersion] = useState(0)
  const [captainPlayerBriefVersion, setCaptainPlayerBriefVersion] = useState(0)

  const loadCaptainTeamScopes = useCallback(async (nextUserId: string | null | undefined) => {
    if (!nextUserId) {
      setCaptainTeamScopes([])
      setTeamScopeResolved(true)
      return
    }

    setTeamScopeResolved(false)

    try {
      const { data: profileData } = await loadUserProfileLink(nextUserId)

      const profile = (profileData || null) as CaptainProfileLinkRow | null
      const scopes = new Map<string, CaptainTeamScope>()

      addCaptainTeamScope(scopes, {
        team: profile?.linked_team_name,
        league: profile?.linked_league_name,
        flight: profile?.linked_flight,
        source: 'profile',
      })

      const [rosterResult, tiqEntryResult] = await Promise.all([
        profile?.linked_player_id
          ? supabase
              .from('team_roster_members')
              .select('team_name, league_name, flight')
              .eq('player_id', profile.linked_player_id)
              .limit(200)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('tiq_team_league_entries')
          .select('team_name, source_league_name, source_flight, entry_status')
          .eq('created_by_user_id', nextUserId)
          .eq('entry_status', 'active')
          .limit(200),
      ])

      for (const row of (rosterResult.data || []) as CaptainRosterScopeRow[]) {
        addCaptainTeamScope(scopes, {
          team: row.team_name,
          league: row.league_name,
          flight: row.flight,
          source: 'roster',
        })
      }

      for (const row of (tiqEntryResult.data || []) as CaptainTiqTeamEntryScopeRow[]) {
        addCaptainTeamScope(scopes, {
          team: row.team_name,
          league: row.source_league_name,
          flight: row.source_flight,
          source: 'tiq',
        })
      }

      setCaptainTeamScopes([...scopes.values()])
    } catch {
      setCaptainTeamScopes([])
    } finally {
      setTeamScopeResolved(true)
    }
  }, [])

  const loadTeamOptions = useCallback(async () => {
    if (isMember(role) && role !== 'admin' && !teamScopeResolved) {
      setLoadingOptions(true)
      return
    }

    setLoadingOptions(true)
    setError('')

    try {
      const { data, error: matchesError } = await supabase
        .from('matches')
        .select('home_team, away_team, league_name, flight, match_date, line_number')
        .is('line_number', null)
        .order('match_date', { ascending: false })
        .limit(600)

      if (matchesError) throw new Error(matchesError.message)

      const map = new Map<string, TeamOption>()

      for (const row of (data || []) as TeamOptionMatchRow[]) {
        const league = safeText(row.league_name, 'Unknown League')
        const flight = safeText(row.flight, 'Unknown Flight')

        for (const side of [safeText(row.home_team), safeText(row.away_team)]) {
          if (side === 'Unknown') continue

          const key = `${side}__${league}__${flight}`

          if (!map.has(key)) {
            map.set(key, {
              team: side,
              league,
              flight,
              matches: 0,
            })
          }

          map.get(key)!.matches += 1
        }
      }

      const allOptions = [...map.values()]
      const next =
        isMember(role) && role !== 'admin'
          ? allOptions.filter((option) => captainTeamOptionMatchesScopes(option, captainTeamScopes))
          : allOptions

      next.sort((a, b) => {
        const chosen = chooseCaptainTeamOption({ options: [a, b], scopes: captainTeamScopes })
        if (chosen === a) return -1
        if (chosen === b) return 1
        if (b.matches !== a.matches) return b.matches - a.matches
        return a.team.localeCompare(b.team)
      })

      setTeamOptions(next)

      if (next.length > 0) {
        const current = chooseCaptainTeamOption({
          options: next,
          current: {
            team: selectedTeam,
            league: selectedLeague,
            flight: selectedFlight,
          },
          scopes: captainTeamScopes,
        }) || next[0]

        setSelectedTeam(current.team)
        setSelectedLeague(current.league)
        setSelectedFlight(current.flight)
      } else {
        setSelectedTeam('')
        setSelectedLeague('')
        setSelectedFlight('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams')
    } finally {
      setLoadingOptions(false)
    }
  }, [captainTeamScopes, role, selectedFlight, selectedLeague, selectedTeam, teamScopeResolved])

  const loadSelectedTeam = useCallback(async () => {
    setLoadingTeam(true)
    setError('')

    try {
      let query = supabase
        .from('matches')
        .select(`
          id,
          league_name,
          flight,
          home_team,
          away_team,
          match_date,
          match_type,
          score,
          winner_side,
          line_number
        `)
        .is('line_number', null)
        .or(`home_team.eq.${selectedTeam},away_team.eq.${selectedTeam}`)
        .order('match_date', { ascending: false })
        .limit(400)

      if (selectedLeague) query = query.eq('league_name', selectedLeague)
      if (selectedFlight) query = query.eq('flight', selectedFlight)

      const { data: matchData, error: matchError } = await query
      if (matchError) throw new Error(matchError.message)

      const typedMatches = (matchData || []) as TeamMatch[]
      setMatches(typedMatches)

      const matchIds = typedMatches.map((match) => match.id)

      let scenarioQuery = supabase
        .from('lineup_scenarios')
        .select('id, scenario_name, match_date')
        .order('match_date', { ascending: false })
        .order('scenario_name', { ascending: true })

      if (selectedTeam) scenarioQuery = scenarioQuery.eq('team_name', selectedTeam)
      if (selectedLeague) scenarioQuery = scenarioQuery.eq('league_name', selectedLeague)
      if (selectedFlight) scenarioQuery = scenarioQuery.eq('flight', selectedFlight)

      const [
        participantResult,
        rosterMemberResult,
        { data: scenarioData, error: scenarioError },
      ] = await Promise.all([
        matchIds.length
          ? supabase
              .from('match_players')
              .select(`
                match_id,
                side,
                seat,
                player_id,
                players (
                  id,
                  name,
                  overall_rating,
                  overall_dynamic_rating,
                  overall_usta_dynamic_rating,
                  singles_dynamic_rating,
                  singles_usta_dynamic_rating,
                  doubles_dynamic_rating,
                  doubles_usta_dynamic_rating
                )
              `)
              .in('match_id', matchIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('team_roster_members')
          .select(`
            player_id,
            player_name,
            team_name,
            league_name,
            flight,
            players (
              id,
              name,
              overall_rating,
              overall_dynamic_rating,
              overall_usta_dynamic_rating,
              singles_dynamic_rating,
              singles_usta_dynamic_rating,
              doubles_dynamic_rating,
              doubles_usta_dynamic_rating
            )
          `)
          .eq('normalized_team_name', normalizeTeamName(selectedTeam))
          .limit(500),
        scenarioQuery,
      ])

      if (participantResult.error) throw new Error(participantResult.error.message)
      if (scenarioError) throw new Error(scenarioError.message)

      setParticipants((participantResult.data || []) as MatchPlayer[])
      setRosterMembers(rosterMemberResult.error ? [] : ((rosterMemberResult.data || []) as TeamRosterMember[]))

      const typedScenarios = (scenarioData || []) as Array<{ id: string; scenario_name: string; match_date: string | null }>
      setScenarioCount(typedScenarios.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Team Hub')
    } finally {
      setLoadingTeam(false)
    }
  }, [selectedFlight, selectedLeague, selectedTeam])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const resumeState = readCaptainResumeState()
    setSelectedCompetitionLayer(params.get('layer') || resumeState?.competitionLayer || '')
    setSelectedTeam(params.get('team') || resumeState?.team || '')
    setSelectedLeague(params.get('league') || resumeState?.league || '')
    setSelectedFlight(params.get('flight') || resumeState?.flight || '')
  }, [])

  useEffect(() => {
    if (!authResolved || role === 'public' || isMember(role)) {
      return
    }

    router.replace('/login?plan=captain&next=%2Fcaptain')
  }, [authResolved, role, router])

  useEffect(() => {
    if (!authResolved) return
    void loadCaptainTeamScopes(userId)
  }, [authResolved, loadCaptainTeamScopes, userId])

  useEffect(() => {
    if (!authResolved || role === 'public') return
    void loadTeamOptions()
  }, [authResolved, loadTeamOptions, refreshTick, role])

  useEffect(() => {
    if (!authResolved || role === 'public') return
    if (!selectedTeam) return
    void loadSelectedTeam()
  }, [authResolved, loadSelectedTeam, refreshTick, role, selectedTeam])

  useEffect(() => {
    if (!authResolved || role === 'public') return
    if (!selectedTeam) { setNextMatch(null); return }
    let active = true
    const today = new Date().toISOString().split('T')[0]
    void (async () => {
      const safeTeam = selectedTeam.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      let q = supabase
        .from('matches')
        .select('id, match_date, match_time, facility, home_team, away_team')
        .or(`home_team.eq."${safeTeam}",away_team.eq."${safeTeam}"`)
        .gte('match_date', today)
        .is('line_number', null)
        .order('match_date', { ascending: true })
        .limit(1)
      if (selectedLeague) q = q.eq('league_name', selectedLeague)
      if (selectedFlight) q = q.eq('flight', selectedFlight)
      const { data } = await q
      if (!active) return
      if (!data?.length) {
        setNextMatch(null)
        return
      }
      const m = data[0] as {
        match_date: string
        match_time: string | null
        facility: string | null
        home_team: string | null
        away_team: string | null
      }
      const isHome = (m.home_team || '') === selectedTeam
      const opponent = isHome ? (m.away_team || 'TBD') : (m.home_team || 'TBD')
      setNextMatch({ date: m.match_date, time: m.match_time, facility: m.facility, opponent, home: isHome })
    })()
    return () => { active = false }
  }, [authResolved, role, selectedTeam, selectedLeague, selectedFlight])

  const filteredTeamOptions = useMemo(() => {
    return teamOptions.filter((option) => option.team && option.league && option.flight)
  }, [teamOptions])
  const selectedTeamOption = useMemo(
    () =>
      filteredTeamOptions.find(
        (option) =>
          option.team === selectedTeam &&
          option.league === selectedLeague &&
          option.flight === selectedFlight,
      ) || null,
    [filteredTeamOptions, selectedFlight, selectedLeague, selectedTeam],
  )
  const selectedFromCaptainScope = useMemo(
    () => Boolean(selectedTeamOption && captainTeamScopes.some((scope) => captainTeamOptionMatchesScopes(selectedTeamOption, [scope]))),
    [captainTeamScopes, selectedTeamOption],
  )
  const selectedCaptainScopeSource = useMemo(
    () => getCaptainTeamScopeSource(selectedTeamOption, captainTeamScopes),
    [captainTeamScopes, selectedTeamOption],
  )
  const selectedCaptainScopeSourceLabel = getCaptainTeamScopeSourceLabel(selectedCaptainScopeSource)
  const selectedTeamOptionKey = buildTeamOptionKey({
    team: selectedTeam,
    league: selectedLeague,
    flight: selectedFlight,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const currentMatch = matches[0] ?? null
    const currentEventKey = safeKey(
      selectedTeam,
      selectedLeague,
      selectedFlight,
      currentMatch?.match_date || null,
    )

    const lineupRows = readLocalArray<{ event_key?: string }>(WEEKLY_LINEUPS_STORAGE_KEY)
    const eventDetails = readLocalArray<{ key?: string; location?: string; arrivalTime?: string; notes?: string }>(
      WEEKLY_EVENT_DETAILS_STORAGE_KEY,
    )
    const responseRows = readLocalArray<{
      event_key?: string
      status?: string
      updated_at?: string
    }>(WEEKLY_RESPONSES_STORAGE_KEY)
    const selectedScenario = readLocalObject<{ id?: string; scenario_name?: string }>('tenace_selected_scenario')
    const resumeState = readCaptainResumeState()

    const lineupCount = lineupRows.filter((row) => (row.event_key || '') === currentEventKey).length
    const eventDetail = eventDetails.find((row) => (row.key || '') === currentEventKey) || null
    const eventResponses = responseRows.filter((row) => (row.event_key || '') === currentEventKey)
    const responseAlertCount = eventResponses.filter((row) =>
      ['running-late', 'need-sub'].includes((row.status || '').trim().toLowerCase()),
    ).length
    const pendingResponseCount = eventResponses.filter((row) => {
      const status = (row.status || '').trim().toLowerCase()
      return !status || status === 'no-response' || status === 'viewed'
    }).length
    const latestResponseUpdate =
      eventResponses
        .map((row) => row.updated_at || null)
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null

    const lineupReady = lineupCount > 0
    const scenarioReady = !!selectedScenario?.id || scenarioCount > 0
    const messagingReady = !!(eventDetail && (eventDetail.location || eventDetail.arrivalTime || eventDetail.notes) && lineupReady)
    const briefReady = Boolean(lineupReady || eventDetail || eventResponses.length)

    setWorkspaceState({
      lineupReady,
      scenarioReady,
      messagingReady,
      briefReady,
      currentEventKey,
      lineupCount,
      scenarioCount,
      responseAlertCount,
      pendingResponseCount,
      latestResponseUpdateLabel: formatDateTimeShort(latestResponseUpdate),
      lastUpdatedLabel: formatDateTimeShort(resumeState?.lastVisitedAt || null),
    })
  }, [matches, selectedTeam, selectedLeague, selectedFlight, scenarioCount])

  useEffect(() => {
    if (!selectedTeam && !selectedLeague && !selectedFlight) return

    writeCaptainResumeState({
      competitionLayer: selectedCompetitionLayer || undefined,
      team: selectedTeam,
      league: selectedLeague,
      flight: selectedFlight,
    })
  }, [selectedCompetitionLayer, selectedFlight, selectedLeague, selectedTeam])

  const teamSideByMatchId = useMemo(() => {
    const map = new Map<string, 'A' | 'B'>()

    for (const match of matches) {
      if (safeText(match.home_team) === selectedTeam) map.set(match.id, 'A')
      if (safeText(match.away_team) === selectedTeam) map.set(match.id, 'B')
    }

    return map
  }, [matches, selectedTeam])

  const roster = useMemo<TeamPlayerSummary[]>(() => {
    const map = new Map<string, TeamPlayerSummary>()
    const matchById = new Map(matches.map((m) => [m.id, m]))

    for (const row of participants) {
      const side = teamSideByMatchId.get(row.match_id)
      if (!side || row.side !== side) continue

      const player = normalizePlayerRelation(row.players)
      if (!player) continue

      const match = matchById.get(row.match_id)
      if (!match) continue

      if (!map.has(player.id)) {
        const overallBase = player.overall_rating ?? null
        const overallUstaDynamic = player.overall_usta_dynamic_rating ?? null
        const ratingStatus =
          overallBase !== null && overallUstaDynamic !== null
            ? getCaptainRatingStatus(overallBase, overallUstaDynamic)
            : null
        map.set(player.id, {
          id: player.id,
          name: player.name,
          appearances: 0,
          wins: 0,
          losses: 0,
          singlesDynamic: player.singles_dynamic_rating,
          doublesDynamic: player.doubles_dynamic_rating,
          overallBase,
          overallUstaDynamic,
          ratingStatus,
        })
      }

      const item = map.get(player.id)!
      item.appearances += 1
      if (match.winner_side === side) item.wins += 1
      else item.losses += 1
    }

    for (const row of rosterMembers) {
      if (selectedLeague && safeText(row.league_name, '') && safeText(row.league_name) !== selectedLeague) continue
      if (selectedFlight && safeText(row.flight, '') && safeText(row.flight) !== selectedFlight) continue
      const player = normalizePlayerRelation(row.players)
      const id = player?.id || row.player_id
      const name = player?.name || safeText(row.player_name)
      if (!id || !name || map.has(id)) continue
      const overallBase = player?.overall_rating ?? null
      const overallUstaDynamic = player?.overall_usta_dynamic_rating ?? null
      const ratingStatus =
        overallBase !== null && overallUstaDynamic !== null
          ? getCaptainRatingStatus(overallBase, overallUstaDynamic)
          : null
      map.set(id, {
        id,
        name,
        appearances: 0,
        wins: 0,
        losses: 0,
        singlesDynamic: player?.singles_dynamic_rating ?? null,
        doublesDynamic: player?.doubles_dynamic_rating ?? null,
        overallBase,
        overallUstaDynamic,
        ratingStatus,
      })
    }

    return [...map.values()].sort((a, b) => {
      if (b.appearances !== a.appearances) return b.appearances - a.appearances
      return a.name.localeCompare(b.name)
    })
  }, [participants, matches, rosterMembers, selectedFlight, selectedLeague, teamSideByMatchId])

  const pairings = useMemo<PairingSummary[]>(() => {
    const map = new Map<string, PairingSummary>()

    const participantsByMatchId = new Map<string, typeof participants>()
    for (const row of participants) {
      const existing = participantsByMatchId.get(row.match_id) ?? []
      existing.push(row)
      participantsByMatchId.set(row.match_id, existing)
    }

    for (const match of matches) {
      if (match.match_type !== 'doubles') continue

      const side = teamSideByMatchId.get(match.id)
      if (!side) continue

      const teamPlayers = (participantsByMatchId.get(match.id) ?? [])
        .filter((row) => row.side === side)
        .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))
        .map((row) => normalizePlayerRelation(row.players))
        .filter(Boolean) as NonNullable<ReturnType<typeof normalizePlayerRelation>>[]

      if (teamPlayers.length < 2) continue

      const pair = teamPlayers.slice(0, 2).sort((a, b) => a.name.localeCompare(b.name))
      const key = `${pair[0].id}__${pair[1].id}`

      if (!map.has(key)) {
        map.set(key, {
          key,
          names: [pair[0].name, pair[1].name],
          appearances: 0,
          wins: 0,
          losses: 0,
          avgDoublesRating: average(
            pair
              .map((player) => player.doubles_dynamic_rating)
              .filter((value): value is number => typeof value === 'number'),
          ),
        })
      }

      const item = map.get(key)!
      item.appearances += 1
      if (match.winner_side === side) item.wins += 1
      else item.losses += 1
    }

    return [...map.values()].sort((a, b) => {
      const pctDiff = getWinPct(b.wins, b.losses) - getWinPct(a.wins, a.losses)
      if (Math.abs(pctDiff) > 0.0001) return pctDiff
      if (b.appearances !== a.appearances) return b.appearances - a.appearances
      return a.names.join(' / ').localeCompare(b.names.join(' / '))
    })
  }, [matches, participants, teamSideByMatchId])

  const recommendedSingles = useMemo(() => {
    return [...roster]
      .sort(
        (a, b) =>
          ((b.singlesDynamic || 0) + b.appearances * 0.04) -
          ((a.singlesDynamic || 0) + a.appearances * 0.04),
      )
      .slice(0, 4)
  }, [roster])

  const statusOrder: Record<RatingStatus, number> = {
    'Bump Up Pace': 0,
    'Trending Up': 1,
    'Holding': 2,
    'At Risk': 3,
    'Drop Watch': 4,
  }

  const sortedRoster = useMemo(() => {
    const base = roster.slice(0, 8)
    if (rosterSortMode === 'appearances') return base
    return [...roster]
      .sort((a, b) => {
        const aOrder = a.ratingStatus != null ? statusOrder[a.ratingStatus] : 5
        const bOrder = b.ratingStatus != null ? statusOrder[b.ratingStatus] : 5
        if (aOrder !== bOrder) return aOrder - bOrder
        return b.appearances - a.appearances
      })
      .slice(0, 8)
  }, [roster, rosterSortMode])  // eslint-disable-line react-hooks/exhaustive-deps

  const rosterSignalSummary = useMemo(() => {
    const counts: Record<RatingStatus, number> = { 'Bump Up Pace': 0, 'Trending Up': 0, Holding: 0, 'At Risk': 0, 'Drop Watch': 0 }
    let withStatus = 0
    for (const p of roster) {
      if (p.ratingStatus) { counts[p.ratingStatus]++; withStatus++ }
    }
    const trendingUp = counts['Bump Up Pace'] + counts['Trending Up']
    const atRisk = counts['At Risk'] + counts['Drop Watch']
    const topSingles = roster
      .filter((p) => p.overallUstaDynamic != null)
      .sort((a, b) => (b.overallUstaDynamic ?? 0) - (a.overallUstaDynamic ?? 0))[0] ?? null
    return { counts, withStatus, trendingUp, atRisk, topSingles }
  }, [roster])

  const quickStats = useMemo(() => {
    let wins = 0
    let losses = 0
    let doubles = 0
    let singles = 0

    for (const match of matches) {
      const side = teamSideByMatchId.get(match.id)
      if (!side) continue

      if (match.winner_side === side) wins += 1
      else losses += 1

      if (match.match_type === 'doubles') doubles += 1
      else singles += 1
    }

    return {
      matches: matches.length,
      wins,
      losses,
      singles,
      doubles,
      latest: matches[0]?.match_date || null,
      roster: roster.length,
      topPairWinPct: pairings[0] ? formatPercent(getWinPct(pairings[0].wins, pairings[0].losses)) : '-',
      singlesCore: recommendedSingles.length,
    }
  }, [matches, teamSideByMatchId, roster.length, pairings, recommendedSingles.length])

  const currentTeamHref = selectedTeam
    ? `/team/${encodeURIComponent(selectedTeam)}?${new URLSearchParams({
        ...(selectedCompetitionLayer ? { layer: selectedCompetitionLayer } : {}),
        league: selectedLeague,
        flight: selectedFlight,
      }).toString()}`
    : '/explore/teams'

  const lineupBuilderHref = buildCaptainScopedHref('/captain/lineup-builder', {
    competitionLayer: selectedCompetitionLayer,
    team: selectedTeam,
    league: selectedLeague,
    flight: selectedFlight,
  })

  const lineupProjectionHref = buildCaptainScopedHref('/captain/lineup-projection', {
    competitionLayer: selectedCompetitionLayer,
    team: selectedTeam,
    league: selectedLeague,
    flight: selectedFlight,
  })

  const availabilityHref = buildCaptainScopedHref('/captain/availability', {
    competitionLayer: selectedCompetitionLayer,
    team: selectedTeam,
    league: selectedLeague,
    flight: selectedFlight,
  })

  const practiceHref = buildCaptainScopedHref('/captain/practice', {
    competitionLayer: selectedCompetitionLayer,
    team: selectedTeam,
    league: selectedLeague,
    flight: selectedFlight,
  })

  const scenarioHref = buildCaptainScopedHref('/captain/scenario-builder', {
    competitionLayer: selectedCompetitionLayer,
    team: selectedTeam,
    league: selectedLeague,
    flight: selectedFlight,
  })

  const messagingHref = buildCaptainScopedHref('/captain/messaging', {
    competitionLayer: selectedCompetitionLayer,
    team: selectedTeam,
    league: selectedLeague,
    flight: selectedFlight,
  })

  const analyticsHref = buildCaptainScopedHref('/captain/analytics', {
    competitionLayer: selectedCompetitionLayer,
    team: selectedTeam,
    league: selectedLeague,
    flight: selectedFlight,
  })

  const captainResume = readCaptainResumeState()
  const weeklyBriefHref = buildCaptainScopedHref('/captain/weekly-brief', {
    competitionLayer: selectedCompetitionLayer || captainResume?.competitionLayer,
    team: selectedTeam,
    league: selectedLeague,
    flight: selectedFlight,
    date: captainResume?.eventDate,
    opponent: captainResume?.opponentTeam,
  })
  const teamBriefHref = buildCaptainScopedHref('/captain/team-brief', {
    competitionLayer: selectedCompetitionLayer || captainResume?.competitionLayer,
    team: selectedTeam,
    league: selectedLeague,
    flight: selectedFlight,
    date: captainResume?.eventDate,
    opponent: captainResume?.opponentTeam,
  })
  const levelUpTeamChallenge = useMemo(
    () => buildCaptainLevelUpChallenge(searchParams.get('levelUpChallenge') || '', searchParams.get('card') || ''),
    [searchParams],
  )
  const levelUpPracticeHref = levelUpTeamChallenge ? appendLevelUpChallengeHref(practiceHref, levelUpTeamChallenge.id) : practiceHref
  const levelUpAvailabilityHref = levelUpTeamChallenge ? appendLevelUpChallengeHref(availabilityHref, levelUpTeamChallenge.id) : availabilityHref
  const levelUpWeeklyBriefHref = levelUpTeamChallenge ? appendLevelUpChallengeHref(weeklyBriefHref, levelUpTeamChallenge.id) : weeklyBriefHref
  const seasonDashboardHref = '/league-coordinator'
  const tiqTeamMatchesHref = '/league-coordinator/results'
  const captainNotesScope = useMemo(
    () => ({
      team: selectedTeam || captainResume?.team,
      league: selectedLeague || captainResume?.league,
      flight: selectedFlight || captainResume?.flight,
      eventDate: captainResume?.eventDate,
      opponentTeam: captainResume?.opponentTeam,
    }),
    [captainResume?.eventDate, captainResume?.flight, captainResume?.league, captainResume?.opponentTeam, captainResume?.team, selectedFlight, selectedLeague, selectedTeam]
  )
  const captainNotesScopeKey = useMemo(() => buildCaptainWeekNotesScopeKey(captainNotesScope), [captainNotesScope])
  const captainWeekStatusScope = useMemo(
    () => ({
      team: selectedTeam || captainResume?.team,
      league: selectedLeague || captainResume?.league,
      flight: selectedFlight || captainResume?.flight,
      eventDate: captainResume?.eventDate || matches[0]?.match_date || '',
      opponentTeam: captainResume?.opponentTeam || '',
    }),
    [
      captainResume?.eventDate,
      captainResume?.flight,
      captainResume?.league,
      captainResume?.opponentTeam,
      captainResume?.team,
      matches,
      selectedFlight,
      selectedLeague,
      selectedTeam,
    ],
  )
  const captainWeekStatusKey = useMemo(
    () => buildCaptainWeekStatusKey(captainWeekStatusScope),
    [captainWeekStatusScope],
  )
  const weekStatusMeta = useMemo(() => getCaptainWeekStatusMeta(weekStatus), [weekStatus])

  useEffect(() => {
    const savedNotes = readCaptainWeekNotes(captainNotesScope)
    setWeeklyPrepNotes(savedNotes?.weeklyNotes || '')
    setOpponentScoutNotes(savedNotes?.opponentNotes || '')
    setNotesUpdatedLabel(savedNotes?.updatedAt ? formatDateTimeShort(savedNotes.updatedAt) : 'Weekly notes not saved yet')
    setLoadedNotesScopeKey(captainNotesScopeKey)
  }, [captainNotesScope, captainNotesScopeKey])

  useEffect(() => {
    if (loadedNotesScopeKey !== captainNotesScopeKey) return
    if (!captainNotesScope.team && !captainNotesScope.league && !captainNotesScope.eventDate) return

    const saved = upsertCaptainWeekNotes(captainNotesScope, {
      weeklyNotes: weeklyPrepNotes,
      opponentNotes: opponentScoutNotes,
    })

    if (saved?.updatedAt) {
      setNotesUpdatedLabel(formatDateTimeShort(saved.updatedAt))
    }
  }, [captainNotesScope, captainNotesScopeKey, loadedNotesScopeKey, opponentScoutNotes, weeklyPrepNotes])

  useEffect(() => {
    const saved = readCaptainWeekStatus(captainWeekStatusScope)
    setWeekStatus(saved?.status || 'draft-lineup')
  }, [captainWeekStatusKey, captainWeekStatusScope])

  const productAccess = buildProductAccessState(role, entitlements)
  const premiumEnabled = productAccess.canUseCaptainWorkflow
  const leagueToolsEnabled = productAccess.canUseLeagueTools
  const captainUnlockHref = getPlanUnlockHref('captain', '/captain')
  const captainWorkflowHref = (href: string) => premiumEnabled ? href : captainUnlockHref
  const hasTeamScope = Boolean(selectedTeam && selectedLeague && selectedFlight)
  const captainScopeRestricted = isMember(role) && role !== 'admin'
  const scopeStatusText = loadingOptions
    ? 'Loading your team options and recent match context.'
    : captainScopeRestricted && teamScopeResolved && !captainTeamScopes.length
      ? 'Set your player profile or refresh team data to load your captain scope.'
    : !filteredTeamOptions.length
      ? 'No active team history matches your linked player, team, TIQ captain entries, or reviewed Data Assist uploads yet.'
    : selectedFromCaptainScope
        ? `${selectedTeam} - ${selectedLeague} - ${selectedFlight}`
      : hasTeamScope
        ? `${selectedTeam} - ${selectedLeague} - ${selectedFlight}`
        : 'Choose a team, league, and flight to start planning.'

  const dynamicHeroCard: CSSProperties = {
    ...heroCard,
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: isMobile ? 16 : 18,
    padding: isSmallMobile ? 18 : isMobile ? 20 : 22,
  }

  const dynamicHeroControlRow: CSSProperties = {
    ...heroControlRow,
    display: isMobile ? 'grid' : heroControlRow.display,
    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : undefined,
    flexDirection: isSmallMobile ? 'column' : 'row',
    alignItems: isMobile ? 'stretch' : 'center',
  }

  const dynamicNextActionShell: CSSProperties = {
    ...nextActionShell,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : nextActionShell.gridTemplateColumns,
    padding: isSmallMobile ? 18 : isMobile ? 20 : nextActionShell.padding,
  }

  const dynamicStatusStrip: CSSProperties = {
    ...statusStrip,
    gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : statusStrip.gridTemplateColumns,
    gap: isMobile ? 8 : statusStrip.gap,
  }

  const dynamicCommandCenterGrid: CSSProperties = {
    ...commandCenterGrid,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : commandCenterGrid.gridTemplateColumns,
  }

  const dynamicCommandCenterCard: CSSProperties = {
    ...commandCenterCard,
    gap: isMobile ? 12 : commandCenterCard.gap,
    minHeight: isMobile ? 0 : commandCenterCard.minHeight,
    padding: isMobile ? 14 : commandCenterCard.padding,
    borderRadius: isMobile ? 18 : commandCenterCard.borderRadius,
  }

  const dynamicMatchDaySheetShell: CSSProperties = {
    ...matchDaySheetShell,
    gap: isMobile ? 12 : matchDaySheetShell.gap,
    padding: isSmallMobile ? 16 : isMobile ? 18 : matchDaySheetShell.padding,
    borderRadius: isMobile ? 20 : matchDaySheetShell.borderRadius,
  }

  const dynamicMatchDaySheetGrid: CSSProperties = {
    ...matchDaySheetGrid,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : matchDaySheetGrid.gridTemplateColumns,
  }

  const dynamicMatchDaySubBoardGrid: CSSProperties = {
    ...matchDaySubBoardGrid,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : matchDaySubBoardGrid.gridTemplateColumns,
  }

  const dynamicSeasonLaunchShell: CSSProperties = {
    ...seasonLaunchShell,
    gap: isMobile ? 12 : seasonLaunchShell.gap,
    padding: isSmallMobile ? 16 : isMobile ? 18 : seasonLaunchShell.padding,
    borderRadius: isMobile ? 20 : seasonLaunchShell.borderRadius,
  }

  const dynamicSeasonLaunchGrid: CSSProperties = {
    ...seasonLaunchGrid,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : seasonLaunchGrid.gridTemplateColumns,
  }

  const dynamicOpponentScoutShell: CSSProperties = {
    ...opponentScoutShell,
    gap: isMobile ? 12 : opponentScoutShell.gap,
    padding: isSmallMobile ? 16 : isMobile ? 18 : opponentScoutShell.padding,
    borderRadius: isMobile ? 20 : opponentScoutShell.borderRadius,
  }

  const dynamicOpponentScoutGrid: CSSProperties = {
    ...opponentScoutGrid,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : opponentScoutGrid.gridTemplateColumns,
  }

  const dynamicPlayerReadinessPulseShell: CSSProperties = {
    ...playerReadinessPulseShell,
    gap: isMobile ? 12 : playerReadinessPulseShell.gap,
    padding: isSmallMobile ? 16 : isMobile ? 18 : playerReadinessPulseShell.padding,
    borderRadius: isMobile ? 20 : playerReadinessPulseShell.borderRadius,
  }

  const dynamicPlayerReadinessPulseGrid: CSSProperties = {
    ...playerReadinessPulseGrid,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : playerReadinessPulseGrid.gridTemplateColumns,
  }

  const dynamicCaptainNudgeComposerShell: CSSProperties = {
    ...captainNudgeComposerShell,
    gap: isMobile ? 12 : captainNudgeComposerShell.gap,
    padding: isSmallMobile ? 16 : isMobile ? 18 : captainNudgeComposerShell.padding,
    borderRadius: isMobile ? 20 : captainNudgeComposerShell.borderRadius,
  }

  const dynamicCaptainNudgeComposerGrid: CSSProperties = {
    ...captainNudgeComposerGrid,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : captainNudgeComposerGrid.gridTemplateColumns,
  }

  const dynamicCaptainWeekTimelineShell: CSSProperties = {
    ...captainWeekTimelineShell,
    gap: isMobile ? 12 : captainWeekTimelineShell.gap,
    padding: isSmallMobile ? 16 : isMobile ? 18 : captainWeekTimelineShell.padding,
    borderRadius: isMobile ? 20 : captainWeekTimelineShell.borderRadius,
  }

  const dynamicCaptainWeekTimelineGrid: CSSProperties = {
    ...captainWeekTimelineGrid,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : captainWeekTimelineGrid.gridTemplateColumns,
  }

  const dynamicCaptainMatchDayCommandStrip: CSSProperties = {
    ...captainMatchDayCommandStrip,
    position: isMobile ? 'sticky' : 'relative',
    top: isMobile ? 8 : 'auto',
    zIndex: isMobile ? 12 : 1,
    gap: isMobile ? 10 : captainMatchDayCommandStrip.gap,
    padding: isSmallMobile ? 12 : isMobile ? 14 : captainMatchDayCommandStrip.padding,
    borderRadius: isMobile ? 18 : captainMatchDayCommandStrip.borderRadius,
  }

  const dynamicCaptainMatchDayCommandGrid: CSSProperties = {
    ...captainMatchDayCommandGrid,
    gridTemplateColumns: isMobile ? 'repeat(3, minmax(0, 1fr))' : captainMatchDayCommandGrid.gridTemplateColumns,
    gap: isMobile ? 7 : captainMatchDayCommandGrid.gap,
  }

  const dynamicCaptainEmergencyModeShell: CSSProperties = {
    ...captainEmergencyModeShell,
    position: isMobile ? 'sticky' : 'relative',
    top: isMobile ? 104 : 'auto',
    zIndex: isMobile ? 11 : 1,
    gap: isMobile ? 10 : captainEmergencyModeShell.gap,
    padding: isSmallMobile ? 12 : isMobile ? 14 : captainEmergencyModeShell.padding,
    borderRadius: isMobile ? 18 : captainEmergencyModeShell.borderRadius,
  }

  const dynamicCaptainEmergencyModeGrid: CSSProperties = {
    ...captainEmergencyModeGrid,
    gridTemplateColumns: isSmallMobile ? 'repeat(2, minmax(0, 1fr))' : captainEmergencyModeGrid.gridTemplateColumns,
    gap: isMobile ? 7 : captainEmergencyModeGrid.gap,
  }
  const dynamicCaptainChangeAckShell: CSSProperties = {
    ...captainChangeAckShell,
    gap: isMobile ? 12 : captainChangeAckShell.gap,
    padding: isSmallMobile ? 14 : isMobile ? 16 : captainChangeAckShell.padding,
    borderRadius: isMobile ? 20 : captainChangeAckShell.borderRadius,
  }

  const dynamicCaptainChangeAckGrid: CSSProperties = {
    ...captainChangeAckGrid,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : captainChangeAckGrid.gridTemplateColumns,
  }

  const dynamicCaptainChangeAckList: CSSProperties = {
    ...captainChangeAckList,
    gridTemplateColumns: isSmallMobile ? 'repeat(2, minmax(0, 1fr))' : captainChangeAckList.gridTemplateColumns,
    gap: isMobile ? 8 : captainChangeAckList.gap,
  }

  const dynamicCaptainArrivalRiskShell: CSSProperties = {
    ...captainArrivalRiskShell,
    gap: isMobile ? 12 : captainArrivalRiskShell.gap,
    padding: isSmallMobile ? 14 : isMobile ? 16 : captainArrivalRiskShell.padding,
    borderRadius: isMobile ? 20 : captainArrivalRiskShell.borderRadius,
  }

  const dynamicCaptainArrivalRiskGrid: CSSProperties = {
    ...captainArrivalRiskGrid,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : captainArrivalRiskGrid.gridTemplateColumns,
  }

  const dynamicCaptainArrivalRiskList: CSSProperties = {
    ...captainArrivalRiskList,
    gridTemplateColumns: isSmallMobile ? 'repeat(2, minmax(0, 1fr))' : captainArrivalRiskList.gridTemplateColumns,
    gap: isMobile ? 8 : captainArrivalRiskList.gap,
  }

  const dynamicCaptainCourtHandoffShell: CSSProperties = {
    ...captainCourtHandoffShell,
    gap: isMobile ? 12 : captainCourtHandoffShell.gap,
    padding: isSmallMobile ? 14 : isMobile ? 16 : captainCourtHandoffShell.padding,
    borderRadius: isMobile ? 20 : captainCourtHandoffShell.borderRadius,
  }

  const dynamicCaptainCourtHandoffGrid: CSSProperties = {
    ...captainCourtHandoffGrid,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : captainCourtHandoffGrid.gridTemplateColumns,
  }

  const dynamicCaptainCourtHandoffList: CSSProperties = {
    ...captainCourtHandoffList,
    gridTemplateColumns: isSmallMobile ? 'repeat(2, minmax(0, 1fr))' : captainCourtHandoffList.gridTemplateColumns,
    gap: isMobile ? 8 : captainCourtHandoffList.gap,
  }

  const dynamicCaptainNotificationQueueShell: CSSProperties = {
    ...captainNotificationQueueShell,
    gap: isMobile ? 12 : captainNotificationQueueShell.gap,
    padding: isSmallMobile ? 14 : isMobile ? 16 : captainNotificationQueueShell.padding,
    borderRadius: isMobile ? 20 : captainNotificationQueueShell.borderRadius,
  }

  const dynamicCaptainNotificationQueueGrid: CSSProperties = {
    ...captainNotificationQueueGrid,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : captainNotificationQueueGrid.gridTemplateColumns,
  }

  const dynamicCaptainNotificationQueueList: CSSProperties = {
    ...captainNotificationQueueList,
    gridTemplateColumns: isSmallMobile ? 'repeat(2, minmax(0, 1fr))' : captainNotificationQueueList.gridTemplateColumns,
    gap: isMobile ? 8 : captainNotificationQueueList.gap,
  }

  const dynamicCaptainPlayerBriefShell: CSSProperties = {
    ...captainPlayerBriefShell,
    gap: isMobile ? 12 : captainPlayerBriefShell.gap,
    padding: isSmallMobile ? 14 : isMobile ? 16 : captainPlayerBriefShell.padding,
    borderRadius: isMobile ? 20 : captainPlayerBriefShell.borderRadius,
  }

  const dynamicCaptainPlayerBriefGrid: CSSProperties = {
    ...captainPlayerBriefGrid,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : captainPlayerBriefGrid.gridTemplateColumns,
  }

  const dynamicCaptainPlayerBriefList: CSSProperties = {
    ...captainPlayerBriefList,
    gridTemplateColumns: isSmallMobile ? 'repeat(2, minmax(0, 1fr))' : captainPlayerBriefList.gridTemplateColumns,
    gap: isMobile ? 8 : captainPlayerBriefList.gap,
  }

  const dynamicCaptainMorningBriefShell: CSSProperties = {
    ...captainMorningBriefShell,
    gap: isMobile ? 12 : captainMorningBriefShell.gap,
    padding: isSmallMobile ? 16 : isMobile ? 18 : captainMorningBriefShell.padding,
    borderRadius: isMobile ? 20 : captainMorningBriefShell.borderRadius,
  }

  const dynamicCaptainMorningBriefGrid: CSSProperties = {
    ...captainMorningBriefGrid,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : captainMorningBriefGrid.gridTemplateColumns,
  }

  const dynamicCaptainSendQueueShell: CSSProperties = {
    ...captainSendQueueShell,
    gap: isMobile ? 12 : captainSendQueueShell.gap,
    padding: isSmallMobile ? 16 : isMobile ? 18 : captainSendQueueShell.padding,
    borderRadius: isMobile ? 20 : captainSendQueueShell.borderRadius,
  }

  const dynamicCaptainSendQueueGrid: CSSProperties = {
    ...captainSendQueueGrid,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : captainSendQueueGrid.gridTemplateColumns,
  }

  const dynamicCaptainDecisionLogShell: CSSProperties = {
    ...captainDecisionLogShell,
    gap: isMobile ? 12 : captainDecisionLogShell.gap,
    padding: isSmallMobile ? 16 : isMobile ? 18 : captainDecisionLogShell.padding,
    borderRadius: isMobile ? 20 : captainDecisionLogShell.borderRadius,
  }

  const dynamicCaptainDecisionLogGrid: CSSProperties = {
    ...captainDecisionLogGrid,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : captainDecisionLogGrid.gridTemplateColumns,
  }

  const dynamicCaptainHandoffSheetShell: CSSProperties = {
    ...captainHandoffSheetShell,
    gap: isMobile ? 12 : captainHandoffSheetShell.gap,
    padding: isSmallMobile ? 16 : isMobile ? 18 : captainHandoffSheetShell.padding,
    borderRadius: isMobile ? 20 : captainHandoffSheetShell.borderRadius,
  }

  const dynamicCaptainHandoffSheetGrid: CSSProperties = {
    ...captainHandoffSheetGrid,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : captainHandoffSheetGrid.gridTemplateColumns,
  }

  const dynamicCaptainPreSendReviewShell: CSSProperties = {
    ...captainPreSendReviewShell,
    gap: isMobile ? 12 : captainPreSendReviewShell.gap,
    padding: isSmallMobile ? 16 : isMobile ? 18 : captainPreSendReviewShell.padding,
    borderRadius: isMobile ? 20 : captainPreSendReviewShell.borderRadius,
  }

  const dynamicCaptainPreSendReviewGrid: CSSProperties = {
    ...captainPreSendReviewGrid,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : captainPreSendReviewGrid.gridTemplateColumns,
  }

  const dynamicCaptainPostSendTrackerShell: CSSProperties = {
    ...captainPostSendTrackerShell,
    gap: isMobile ? 12 : captainPostSendTrackerShell.gap,
    padding: isSmallMobile ? 16 : isMobile ? 18 : captainPostSendTrackerShell.padding,
    borderRadius: isMobile ? 20 : captainPostSendTrackerShell.borderRadius,
  }

  const dynamicCaptainPostSendTrackerGrid: CSSProperties = {
    ...captainPostSendTrackerGrid,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : captainPostSendTrackerGrid.gridTemplateColumns,
  }

  const dynamicCaptainCourtConfidenceShell: CSSProperties = {
    ...captainCourtConfidenceShell,
    gap: isMobile ? 12 : captainCourtConfidenceShell.gap,
    padding: isSmallMobile ? 16 : isMobile ? 18 : captainCourtConfidenceShell.padding,
    borderRadius: isMobile ? 20 : captainCourtConfidenceShell.borderRadius,
  }

  const dynamicCaptainCourtConfidenceGrid: CSSProperties = {
    ...captainCourtConfidenceGrid,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : captainCourtConfidenceGrid.gridTemplateColumns,
  }

  const dynamicCaptainBenchReadinessShell: CSSProperties = {
    ...captainBenchReadinessShell,
    gap: isMobile ? 12 : captainBenchReadinessShell.gap,
    padding: isSmallMobile ? 16 : isMobile ? 18 : captainBenchReadinessShell.padding,
    borderRadius: isMobile ? 20 : captainBenchReadinessShell.borderRadius,
  }

  const dynamicCaptainBenchReadinessGrid: CSSProperties = {
    ...captainBenchReadinessGrid,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : captainBenchReadinessGrid.gridTemplateColumns,
  }

  const dynamicCaptainCourtSwapShell: CSSProperties = {
    ...captainCourtSwapShell,
    gap: isMobile ? 12 : captainCourtSwapShell.gap,
    padding: isSmallMobile ? 16 : isMobile ? 18 : captainCourtSwapShell.padding,
    borderRadius: isMobile ? 20 : captainCourtSwapShell.borderRadius,
  }

  const dynamicCaptainCourtSwapGrid: CSSProperties = {
    ...captainCourtSwapGrid,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : captainCourtSwapGrid.gridTemplateColumns,
  }

  const dynamicPostMatchCloseoutShell: CSSProperties = {
    ...postMatchCloseoutShell,
    gap: isMobile ? 12 : postMatchCloseoutShell.gap,
    padding: isSmallMobile ? 16 : isMobile ? 18 : postMatchCloseoutShell.padding,
    borderRadius: isMobile ? 20 : postMatchCloseoutShell.borderRadius,
  }

  const dynamicPostMatchCloseoutGrid: CSSProperties = {
    ...postMatchCloseoutGrid,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : postMatchCloseoutGrid.gridTemplateColumns,
  }

  const dynamicCaptainScoreCaptureShell: CSSProperties = {
    ...captainScoreCaptureShell,
    gap: isMobile ? 12 : captainScoreCaptureShell.gap,
    padding: isSmallMobile ? 16 : isMobile ? 18 : captainScoreCaptureShell.padding,
    borderRadius: isMobile ? 20 : captainScoreCaptureShell.borderRadius,
  }

  const dynamicCaptainScoreCaptureGrid: CSSProperties = {
    ...captainScoreCaptureGrid,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : captainScoreCaptureGrid.gridTemplateColumns,
  }

  const dynamicCaptainPostMatchRecapShell: CSSProperties = {
    ...captainPostMatchRecapShell,
    gap: isMobile ? 12 : captainPostMatchRecapShell.gap,
    padding: isSmallMobile ? 16 : isMobile ? 18 : captainPostMatchRecapShell.padding,
    borderRadius: isMobile ? 20 : captainPostMatchRecapShell.borderRadius,
  }

  const dynamicCaptainPostMatchRecapGrid: CSSProperties = {
    ...captainPostMatchRecapGrid,
    gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : captainPostMatchRecapGrid.gridTemplateColumns,
  }

  const dynamicCaptainDecisionPathShell: CSSProperties = {
    ...captainDecisionPathShellStyle,
    gap: isMobile ? 10 : captainDecisionPathShellStyle.gap,
    padding: isSmallMobile ? 14 : isMobile ? 16 : captainDecisionPathShellStyle.padding,
    borderRadius: isMobile ? 18 : captainDecisionPathShellStyle.borderRadius,
  }

  const dynamicCaptainDecisionPathGrid: CSSProperties = {
    ...captainDecisionPathGridStyle,
    gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : captainDecisionPathGridStyle.gridTemplateColumns,
    gap: isMobile ? 8 : captainDecisionPathGridStyle.gap,
  }

  const dynamicCaptainDecisionPathCard: CSSProperties = {
    ...captainDecisionPathCardStyle,
    gap: isMobile ? 8 : captainDecisionPathCardStyle.gap,
    minHeight: isMobile ? 0 : captainDecisionPathCardStyle.minHeight,
    padding: isMobile ? 10 : captainDecisionPathCardStyle.padding,
    borderRadius: isMobile ? 14 : captainDecisionPathCardStyle.borderRadius,
  }

  const dynamicCaptainSaveStatusShell: CSSProperties = {
    ...captainSaveStatusShell,
    gap: isMobile ? 10 : captainSaveStatusShell.gap,
    padding: isSmallMobile ? 14 : isMobile ? 16 : captainSaveStatusShell.padding,
    borderRadius: isMobile ? 18 : captainSaveStatusShell.borderRadius,
  }

  const dynamicCommandCenterShell: CSSProperties = {
    ...commandCenterShell,
    gap: isMobile ? 12 : commandCenterShell.gap,
    padding: isSmallMobile ? 16 : isMobile ? 18 : commandCenterShell.padding,
    borderRadius: isMobile ? 20 : commandCenterShell.borderRadius,
  }

  const dynamicNextActionButtonRow: CSSProperties = {
    ...nextActionButtonRow,
    display: isSmallMobile ? 'grid' : nextActionButtonRow.display,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : undefined,
  }

  const dynamicGlanceActionRow: CSSProperties = {
    ...glanceActionRow,
    display: isSmallMobile ? 'grid' : glanceActionRow.display,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : undefined,
  }

  const dynamicWeekStatusButtonRow: CSSProperties = {
    ...weekStatusButtonRow,
    display: isSmallMobile ? 'grid' : weekStatusButtonRow.display,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : undefined,
  }

  const dynamicInsightGrid: CSSProperties = {
    ...insightGrid,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : insightGrid.gridTemplateColumns,
  }

  const dynamicSelectStyle: CSSProperties = {
    ...selectStyle,
    minWidth: 0,
    width: '100%',
    flex: '1 1 min(100%, 320px)',
  }

  const nextAction = useMemo(() => {
    if (!selectedTeam) {
      return {
        title: 'Choose your team scope',
        detail: 'Pick the team, league, and flight you are planning for this week.',
        href: '/captain',
        cta: 'Select Team',
        tone: 'info' as const,
      }
    }

    if (!matches.length) {
      return {
        title: 'Open your team page',
        detail: 'This team needs more match context before lineup actions can help.',
        href: currentTeamHref,
        cta: 'Open Team Page',
        tone: 'warn' as const,
      }
    }

    if (!workspaceState.lineupReady) {
      return {
        title: 'Build the weekly lineup',
        detail: 'No lineup is saved yet. Start with who can play, then build your best option.',
        href: lineupBuilderHref,
        cta: 'Open Lineup Builder',
        tone: 'info' as const,
      }
    }

    if (!workspaceState.messagingReady) {
      return {
        title: 'Send the weekly plan',
        detail: 'Your lineup is ready. Send the plan and follow up with players who still need details.',
        href: messagingHref,
        cta: 'Open Messaging',
        tone: 'good' as const,
      }
    }

    return {
      title: 'Review the weekly brief',
      detail: 'Your week has enough context. Check the brief before match day.',
      href: weeklyBriefHref,
      cta: 'Open weekly brief',
      tone: 'good' as const,
    }
  }, [selectedTeam, matches.length, workspaceState, currentTeamHref, lineupBuilderHref, messagingHref, weeklyBriefHref])

  const captainCommandSteps = useMemo<CaptainCommandStep[]>(() => {
    const pendingCount = workspaceState.pendingResponseCount
    const lineupCount = workspaceState.lineupCount

    return [
      {
        label: 'Who can play',
        title: pendingCount > 0 ? 'Close the reply gap' : 'Availability is clean',
        detail:
          pendingCount > 0
            ? `${pendingCount} player${pendingCount === 1 ? '' : 's'} still need a clear In, Out, or Maybe before you lock courts.`
            : 'No saved response blockers are holding up the lineup.',
        href: availabilityHref,
        stage: 'availability',
        icon: 'reliabilityIndex',
        stateLabel: pendingCount > 0 ? `${pendingCount} waiting` : 'Clear',
        tone: pendingCount > 0 ? 'warn' : 'good',
        cta: pendingCount > 0 ? 'Follow up' : 'Review',
      },
      {
        label: 'Build lineup',
        title: workspaceState.lineupReady ? 'Lineup is drafted' : 'Pick the best courts',
        detail: workspaceState.lineupReady
          ? `${lineupCount} lineup slot${lineupCount === 1 ? '' : 's'} saved for the week.`
          : 'Turn availability, player fit, and pairing reads into a playable weekly lineup.',
        href: lineupBuilderHref,
        stage: 'lineup',
        icon: 'lineupBuilder',
        stateLabel: workspaceState.lineupReady ? 'Built' : 'Draft',
        tone: workspaceState.lineupReady ? 'good' : 'info',
        cta: workspaceState.lineupReady ? 'Edit' : 'Build',
        premium: true,
      },
      {
        label: 'Send plan',
        title: workspaceState.messagingReady ? 'Team note is ready' : 'Prep the send',
        detail: workspaceState.messagingReady
          ? 'Lineup and event context are ready for a clean player update.'
          : 'Use the saved lineup to send the right update and chase only the replies that matter.',
        href: messagingHref,
        stage: 'messaging',
        icon: 'messagingCenter',
        stateLabel: workspaceState.messagingReady ? 'Ready' : 'Needs setup',
        tone: workspaceState.messagingReady ? 'good' : 'warn',
        cta: 'Message',
        premium: true,
      },
      {
        label: 'Plan practice',
        title: 'Coordinate the next hit',
        detail: 'Schedule practice, invite the roster, and collect In, Out, or Maybe responses in Messages.',
        href: practiceHref,
        stage: 'messaging',
        icon: 'schedule',
        stateLabel: 'Optional',
        tone: 'info',
        cta: 'Schedule',
        premium: true,
      },
    ]
  }, [
    availabilityHref,
    lineupBuilderHref,
    messagingHref,
    practiceHref,
    workspaceState.lineupCount,
    workspaceState.lineupReady,
    workspaceState.messagingReady,
    workspaceState.pendingResponseCount,
  ])

  const weeklyOpsStatus = useMemo(() => {
    if (!selectedTeam) {
      return {
        tone: 'info' as const,
        title: 'Weekly ops will appear after you choose a team scope.',
        detail:
          'Load the right team, league, and flight to surface weekly brief readiness, response risk, and follow-up actions.',
      }
    }

    if (workspaceState.responseAlertCount > 0) {
      return {
        tone: 'warn' as const,
        title: `${workspaceState.responseAlertCount} active match-week alert${workspaceState.responseAlertCount === 1 ? '' : 's'} need attention.`,
        detail:
          'Open the team brief or messaging flow to address late arrivals or substitution risk before match day.',
      }
    }

    if (workspaceState.pendingResponseCount > 0) {
      return {
        tone: 'info' as const,
        title: `${workspaceState.pendingResponseCount} player${workspaceState.pendingResponseCount === 1 ? '' : 's'} still need a clean response.`,
        detail:
          'Availability follow-up is the fastest way to tighten this week before you send the final team note.',
      }
    }

    if (workspaceState.briefReady) {
      return {
        tone: 'good' as const,
        title: 'Weekly brief is ready to review and share.',
        detail:
          'Your week has enough saved context to open the captain and team briefs.',
      }
    }

    return {
      tone: 'info' as const,
      title: "Start saving the week's operating context.",
      detail:
        'Add lineup, event, or response details to unlock a stronger brief and week-at-a-glance operations view.',
    }
  }, [selectedTeam, workspaceState.briefReady, workspaceState.pendingResponseCount, workspaceState.responseAlertCount])

  const weekAtGlance = useMemo(() => {
    const currentMatch = matches[0] ?? null
    const eventDate = captainResume?.eventDate || currentMatch?.match_date || null
    const opponent =
      captainResume?.opponentTeam ||
      (currentMatch
        ? safeText(currentMatch.home_team) === selectedTeam
          ? safeText(currentMatch.away_team, 'Opponent not set')
          : safeText(currentMatch.home_team, 'Opponent not set')
        : 'Opponent not set')

    return {
      eventDateLabel: formatDate(eventDate),
      opponentLabel: opponent || 'Opponent not set',
      scopeLabel: hasTeamScope ? `${selectedLeague} - ${selectedFlight}` : 'Choose team scope',
      lineupLabel: workspaceState.lineupReady ? `${workspaceState.lineupCount} slots ready` : 'Lineup not saved',
      messagingLabel: workspaceState.messagingReady ? 'Ready to send' : 'Needs event details',
      briefLabel: workspaceState.briefReady ? 'Briefing ready' : 'Brief building',
    }
  }, [
    captainResume?.eventDate,
    captainResume?.opponentTeam,
    hasTeamScope,
    matches,
    selectedFlight,
    selectedLeague,
    selectedTeam,
    workspaceState.briefReady,
    workspaceState.lineupCount,
    workspaceState.lineupReady,
    workspaceState.messagingReady,
  ])

  const matchDayLineupRows = useMemo(() => {
    if (!workspaceState.currentEventKey) return []

    return readLocalArray<CaptainLineupAssignment>(WEEKLY_LINEUPS_STORAGE_KEY)
      .filter((row) => safeText(row.event_key) === workspaceState.currentEventKey)
      .sort((a, b) => safeText(a.court_label).localeCompare(safeText(b.court_label)))
  }, [workspaceState.currentEventKey])

  const matchDayEventDetail = useMemo(() => {
    if (!workspaceState.currentEventKey) return null

    return readLocalArray<CaptainEventDetail>(WEEKLY_EVENT_DETAILS_STORAGE_KEY)
      .find((row) => safeText(row.key) === workspaceState.currentEventKey) ?? null
  }, [workspaceState.currentEventKey])

  const matchDayResponseRows = useMemo(() => {
    if (!workspaceState.currentEventKey) return []

    return readLocalArray<CaptainWeeklyResponse>(WEEKLY_RESPONSES_STORAGE_KEY)
      .filter((row) => safeText(row.event_key) === workspaceState.currentEventKey)
  }, [workspaceState.currentEventKey])

  const captainMessageContactRows = useMemo(() => (
    readLocalArray<CaptainMessageContact>(CAPTAIN_MESSAGE_CONTACTS_STORAGE_KEY)
      .filter((contact) => safeText(contact.full_name) && contact.is_active !== false)
  ), [])

  const matchDayConfirmedCount = matchDayResponseRows.filter((row) => safeText(row.status).toLowerCase() === 'confirmed').length
  const matchDayNotConfirmedCount = matchDayResponseRows.filter((row) => {
    const status = safeText(row.status).toLowerCase()
    return !status || ['viewed', 'no-response', 'running-late', 'need-sub'].includes(status)
  }).length
  const matchDaySubRiskCount = matchDayResponseRows.filter((row) =>
    ['running-late', 'need-sub'].includes(safeText(row.status).toLowerCase()),
  ).length
  const matchDayLineupPreview = matchDayLineupRows.slice(0, isMobile ? 3 : 4)
  const matchDayLocationLabel = safeText(matchDayEventDetail?.location || nextMatch?.facility, 'Add location')
  const matchDayArrivalLabel = safeText(matchDayEventDetail?.arrivalTime || nextMatch?.time, 'Add arrival')

  const matchDayChecklist = [
    {
      label: 'Lineup',
      state: workspaceState.lineupReady ? `${workspaceState.lineupCount} courts` : 'Draft needed',
      detail: workspaceState.lineupReady ? 'Court plan is ready to carry into warm-up.' : 'Save the court plan before players arrive.',
      tone: workspaceState.lineupReady ? 'good' : 'warn',
    },
    {
      label: 'Confirmations',
      state: matchDayNotConfirmedCount > 0 ? `${matchDayNotConfirmedCount} open` : matchDayResponseRows.length ? 'Clear' : 'Not collected',
      detail: matchDayNotConfirmedCount > 0 ? 'Follow up before locking the sheet.' : matchDayResponseRows.length ? `${matchDayConfirmedCount} confirmed.` : 'Collect replies from the roster.',
      tone: matchDayNotConfirmedCount > 0 ? 'warn' : matchDayResponseRows.length ? 'good' : 'info',
    },
    {
      label: 'Sub risk',
      state: matchDaySubRiskCount > 0 ? `${matchDaySubRiskCount} flagged` : 'None saved',
      detail: matchDaySubRiskCount > 0 ? 'Keep a backup player close.' : 'No late or need-sub flags saved for this event.',
      tone: matchDaySubRiskCount > 0 ? 'warn' : 'good',
    },
    {
      label: 'Logistics',
      state: workspaceState.messagingReady ? 'Ready to send' : 'Needs detail',
      detail: matchDayEventDetail?.notes || `${matchDayArrivalLabel} - ${matchDayLocationLabel}`,
      tone: workspaceState.messagingReady ? 'good' : 'info',
    },
  ] as const

  const matchDayLineupPlayerKeys = useMemo(() => (
    matchDayLineupRows
      .flatMap((row) => row.players ?? [])
      .map((name) => safeKey(name))
      .filter(Boolean)
  ), [matchDayLineupRows])

  const matchDaySubBoardFlags = useMemo<CaptainSubBoardFlag[]>(() => {
    if (!matchDayLineupRows.length) {
      return [
        {
          key: 'lineup-needed',
          label: 'No saved courts',
          state: 'Build lineup',
          detail: 'Save courts first, then backup calls can attach to the match sheet.',
          tone: 'warn',
        },
      ]
    }

    if (matchDaySubRiskCount > 0) {
      return matchDayLineupRows.slice(0, isMobile ? 2 : 3).map((row, index) => ({
        key: row.id || `sub-risk-${index}`,
        label: safeText(row.court_label, `Court ${index + 1}`),
        state: index < matchDaySubRiskCount ? 'Backup needed' : 'Watch',
        detail: index < matchDaySubRiskCount
          ? 'Late or need-sub reply is saved for this match.'
          : 'Keep this court close while replacements settle.',
        tone: index < matchDaySubRiskCount ? 'warn' : 'info',
      }))
    }

    if (matchDayNotConfirmedCount > 0) {
      return matchDayLineupRows.slice(0, isMobile ? 2 : 3).map((row, index) => ({
        key: row.id || `open-reply-${index}`,
        label: safeText(row.court_label, `Court ${index + 1}`),
        state: index === 0 ? `${matchDayNotConfirmedCount} open` : 'Confirm',
        detail: 'Confirm every player before you tell the bench they can stand down.',
        tone: 'info',
      }))
    }

    return [
      {
        key: 'courts-clear',
        label: 'All courts',
        state: 'Clear',
        detail: 'No late, need-sub, or open reply flags are saved for this event.',
        tone: 'good',
      },
    ]
  }, [isMobile, matchDayLineupRows, matchDayNotConfirmedCount, matchDaySubRiskCount])

  const matchDaySubCandidates = useMemo<CaptainSubCandidate[]>(() => {
    const lineupPlayerKeys = new Set(matchDayLineupPlayerKeys)

    return roster
      .filter((player) => !lineupPlayerKeys.has(safeKey(player.name)))
      .sort((a, b) => {
        const aRating = Math.max(a.singlesDynamic ?? 0, a.doublesDynamic ?? 0, a.overallUstaDynamic ?? 0)
        const bRating = Math.max(b.singlesDynamic ?? 0, b.doublesDynamic ?? 0, b.overallUstaDynamic ?? 0)
        if (Math.abs(bRating - aRating) > 0.0001) return bRating - aRating
        return b.appearances - a.appearances
      })
      .slice(0, isMobile ? 3 : 4)
      .map((player) => {
        const doublesRating = player.doublesDynamic ?? player.overallUstaDynamic ?? player.overallBase
        const singlesRating = player.singlesDynamic ?? player.overallUstaDynamic ?? player.overallBase
        const leansDoubles = (doublesRating ?? 0) >= (singlesRating ?? 0)
        const bestRating = Math.max(singlesRating ?? 0, doublesRating ?? 0)
        const isRatingRisk = player.ratingStatus === 'At Risk' || player.ratingStatus === 'Drop Watch'
        const isStrongSignal = player.ratingStatus === 'Bump Up Pace' || player.ratingStatus === 'Trending Up'

        return {
          id: player.id,
          name: player.name,
          fit: leansDoubles ? 'Doubles cover' : 'Singles cover',
          signal: player.ratingStatus || formatRating(bestRating || null),
          detail: `${player.appearances} match${player.appearances === 1 ? '' : 'es'} tracked - ${player.wins}-${player.losses} record`,
          tone: isRatingRisk ? 'warn' : isStrongSignal ? 'good' : 'info',
        }
      })
  }, [isMobile, matchDayLineupPlayerKeys, roster])

  const playerReadinessConfirmedLabel = matchDayResponseRows.length
    ? `${matchDayConfirmedCount}/${matchDayResponseRows.length}`
    : 'Not collected'
  const playerReadinessRiskCount = matchDaySubRiskCount + rosterSignalSummary.atRisk
  const playerReadinessChallengeReady = Boolean(levelUpTeamChallenge)
  const playerReadinessPulseChecks = useMemo<CaptainPlayerReadinessItem[]>(() => [
    {
      label: 'Confirmed',
      state: playerReadinessConfirmedLabel,
      detail: matchDayResponseRows.length
        ? `${matchDayConfirmedCount} confirmed for this event.`
        : 'Collect player replies before the week gets noisy.',
      tone: matchDayResponseRows.length
        ? matchDayNotConfirmedCount > 0 ? 'warn' : 'good'
        : 'info',
    },
    {
      label: 'Follow-ups',
      state: matchDayNotConfirmedCount > 0 ? `${matchDayNotConfirmedCount} open` : 'Clear',
      detail: matchDayNotConfirmedCount > 0
        ? 'Nudge players before lineup and sub decisions tighten.'
        : 'No open replies are saved for this event.',
      tone: matchDayNotConfirmedCount > 0 ? 'warn' : 'good',
    },
    {
      label: 'Risk',
      state: playerReadinessRiskCount > 0 ? `${playerReadinessRiskCount} watch` : 'Stable',
      detail: matchDaySubRiskCount > 0
        ? 'Late or need-sub replies are already on the sheet.'
        : rosterSignalSummary.atRisk > 0
          ? 'Rating-watch players need a careful court call.'
          : 'No saved sub or rating watch flags are active.',
      tone: playerReadinessRiskCount > 0 ? 'warn' : 'good',
    },
    {
      label: 'Practice',
      state: playerReadinessChallengeReady ? 'Challenge ready' : 'Plan work',
      detail: playerReadinessChallengeReady
        ? 'Send the team challenge into practice before match day.'
        : 'Use practice prep for pair communication and pressure points.',
      tone: playerReadinessChallengeReady ? 'good' : 'info',
    },
  ], [
    matchDayConfirmedCount,
    matchDayNotConfirmedCount,
    matchDayResponseRows.length,
    matchDaySubRiskCount,
    playerReadinessChallengeReady,
    playerReadinessConfirmedLabel,
    playerReadinessRiskCount,
    rosterSignalSummary.atRisk,
  ])
  const playerReadinessReadyCount = playerReadinessPulseChecks.filter((item) => item.tone === 'good').length

  const captainNudgeOpenReplyCount = Math.max(matchDayNotConfirmedCount, workspaceState.pendingResponseCount)
  const captainNudgeMatchLabel = `${weekAtGlance.eventDateLabel} vs ${weekAtGlance.opponentLabel}`
  const captainNudgeArrivalLabel = safeText(matchDayArrivalLabel, 'arrival time')
  const captainNudgeLocationLabel = safeText(matchDayLocationLabel, 'the courts')
  const captainNudgeDrafts = useMemo<CaptainNudgeDraft[]>(() => [
    {
      label: 'Confirm availability',
      state: captainNudgeOpenReplyCount > 0 ? `${captainNudgeOpenReplyCount} waiting` : 'Ready anytime',
      detail: captainNudgeOpenReplyCount > 0
        ? 'Use this when replies are still open.'
        : 'Keep this ready for late schedule changes.',
      body: `Team, please confirm availability for ${captainNudgeMatchLabel}. If anything changed, reply today so I can lock courts and backup coverage.`,
      href: levelUpAvailabilityHref,
      stage: 'availability',
      tone: captainNudgeOpenReplyCount > 0 ? 'warn' : 'info',
      cta: 'Open availability',
    },
    {
      label: 'Running late',
      state: matchDaySubRiskCount > 0 ? `${matchDaySubRiskCount} flagged` : 'Standby',
      detail: 'Send when arrival timing starts to affect warm-up or court order.',
      body: `If you are running late for ${captainNudgeMatchLabel}, reply with your ETA now. Meet at ${captainNudgeLocationLabel}; target arrival is ${captainNudgeArrivalLabel}.`,
      href: messagingHref,
      stage: 'messaging',
      tone: matchDaySubRiskCount > 0 ? 'warn' : 'info',
      cta: 'Open messaging',
    },
    {
      label: 'Need sub',
      state: playerReadinessRiskCount > 0 ? `${playerReadinessRiskCount} watch` : 'Backup ready',
      detail: playerReadinessRiskCount > 0
        ? 'Use this before the court plan gets brittle.'
        : 'Keep a clean backup ask ready for match day.',
      body: `Quick sub check for ${captainNudgeMatchLabel}: I may need backup coverage. Reply if you can be ready on short notice and what window works for you.`,
      href: messagingHref,
      stage: 'messaging',
      tone: playerReadinessRiskCount > 0 ? 'warn' : 'good',
      cta: 'Open messaging',
    },
    {
      label: 'Final lineup posted',
      state: workspaceState.lineupReady ? `${workspaceState.lineupCount} courts` : 'Lineup first',
      detail: workspaceState.lineupReady
        ? 'Send after courts are saved.'
        : 'Build courts first, then send the final note.',
      body: `Lineup is posted for ${captainNudgeMatchLabel}. Please check your court, arrive by ${captainNudgeArrivalLabel}, and reply if anything looks off.`,
      href: workspaceState.lineupReady ? messagingHref : lineupBuilderHref,
      stage: workspaceState.lineupReady ? 'messaging' : 'lineup',
      tone: workspaceState.lineupReady ? 'good' : 'info',
      cta: workspaceState.lineupReady ? 'Open messaging' : 'Build lineup',
    },
  ], [
    captainNudgeArrivalLabel,
    captainNudgeLocationLabel,
    captainNudgeMatchLabel,
    captainNudgeOpenReplyCount,
    levelUpAvailabilityHref,
    lineupBuilderHref,
    matchDaySubRiskCount,
    messagingHref,
    playerReadinessRiskCount,
    workspaceState.lineupCount,
    workspaceState.lineupReady,
  ])
  const captainNudgePrimaryDraft = captainNudgeDrafts.find((item) => item.tone === 'warn') ?? captainNudgeDrafts[0]
  const captainNudgeReadyCount = captainNudgeDrafts.filter((item) => item.tone === 'good' || item.tone === 'warn').length

  const postMatchCloseoutRows = matchDayLineupRows.slice(0, isMobile ? 2 : 3)
  const captainScoreCaptureSaved = useMemo(() => {
    if (!workspaceState.currentEventKey) return new Map<string, CaptainScoreCaptureEntry>()
    if (captainScoreCaptureVersion < 0) return new Map<string, CaptainScoreCaptureEntry>()

    return new Map(
      readLocalArray<CaptainScoreCaptureEntry>(CAPTAIN_SCORE_CAPTURE_STORAGE_KEY)
        .filter((entry) => safeText(entry.event_key) === workspaceState.currentEventKey)
        .map((entry) => [safeText(entry.court_key), entry] as const)
        .filter(([courtKey]) => Boolean(courtKey)),
    )
  }, [captainScoreCaptureVersion, workspaceState.currentEventKey])
  const captainScoreCaptureRows = useMemo(() => (
    matchDayLineupRows.map((row, index) => {
      const courtLabel = safeText(row.court_label, `Court ${index + 1}`)
      const courtKey = safeText(row.id, safeKey(`${courtLabel}-${index}`))
      const playerLabel = row.players?.filter(Boolean).join(' / ') || 'Players not set'
      const saved = captainScoreCaptureSaved.get(courtKey)
      const status = saved?.status || 'pending'
      const statusLabel = status === 'complete'
        ? 'Complete'
        : status === 'score-captured'
          ? 'Score captured'
          : status === 'issue'
            ? 'Issue noted'
            : 'Needs score'

      return {
        row,
        index,
        courtKey,
        courtLabel,
        playerLabel,
        status,
        statusLabel,
        updatedLabel: formatDateTimeShort(saved?.updated_at || ''),
        tone: status === 'issue' ? 'warn' as const : status === 'pending' ? 'info' as const : 'good' as const,
      }
    })
  ), [captainScoreCaptureSaved, matchDayLineupRows])
  const captainScoreCaptureCompleteCount = captainScoreCaptureRows.filter((row) => row.status === 'complete').length
  const captainScoreCaptureIssueCount = captainScoreCaptureRows.filter((row) => row.status === 'issue').length
  const captainScoreCapturePendingCount = captainScoreCaptureRows.filter((row) => row.status === 'pending').length
  const captainScoreCaptureLoggedCount = captainScoreCaptureRows.filter((row) => row.status === 'score-captured' || row.status === 'complete').length
  const captainScoreCapturePrimaryRow = captainScoreCaptureRows.find((row) => row.status === 'issue')
    ?? captainScoreCaptureRows.find((row) => row.status === 'pending')
    ?? captainScoreCaptureRows[0]
  const captainScoreCaptureStatusLabel = captainScoreCaptureRows.length
    ? captainScoreCaptureIssueCount > 0
      ? `${captainScoreCaptureIssueCount} issue`
      : captainScoreCapturePendingCount > 0
        ? `${captainScoreCapturePendingCount} open`
        : captainScoreCaptureCompleteCount === captainScoreCaptureRows.length
          ? 'Complete'
          : 'Captured'
    : 'Needs courts'
  const postMatchUploadedState = selectedFromCaptainScope ? 'Refresh data' : 'Upload needed'
  const postMatchClosed = weekStatus === 'finalized'
  const captainWeekTimelineItems = useMemo<CaptainWeekTimelineItem[]>(() => [
    {
      label: 'Today',
      title: captainNudgeOpenReplyCount > 0 ? 'Tighten replies' : 'Keep replies clean',
      state: captainNudgeOpenReplyCount > 0 ? `${captainNudgeOpenReplyCount} waiting` : 'Clear',
      detail: captainNudgeOpenReplyCount > 0
        ? 'Send the availability nudge before lineup choices harden.'
        : 'Availability is quiet enough to focus on courts.',
      href: levelUpAvailabilityHref,
      stage: 'availability',
      tone: captainNudgeOpenReplyCount > 0 ? 'warn' : 'good',
      cta: 'Check availability',
    },
    {
      label: 'Tomorrow',
      title: workspaceState.lineupReady ? 'Review court order' : 'Build court order',
      state: workspaceState.lineupReady ? `${workspaceState.lineupCount} courts` : 'Draft needed',
      detail: workspaceState.lineupReady
        ? 'Confirm the court plan still fits the latest replies.'
        : 'Save courts before the final team note goes out.',
      href: lineupBuilderHref,
      stage: 'lineup',
      tone: workspaceState.lineupReady ? 'good' : 'info',
      cta: workspaceState.lineupReady ? 'Review lineup' : 'Build lineup',
    },
    {
      label: 'Match day',
      title: matchDaySubRiskCount > 0 ? 'Protect the lineup' : 'Carry the sheet',
      state: matchDaySubRiskCount > 0 ? `${matchDaySubRiskCount} flag${matchDaySubRiskCount === 1 ? '' : 's'}` : matchDayResponseRows.length ? 'Ready' : 'Confirm',
      detail: `${captainNudgeArrivalLabel} at ${captainNudgeLocationLabel}. ${matchDaySubRiskCount > 0 ? 'Keep backup coverage close.' : 'Send the final note before players arrive.'}`,
      href: messagingHref,
      stage: 'messaging',
      tone: matchDaySubRiskCount > 0 ? 'warn' : matchDayResponseRows.length ? 'good' : 'info',
      cta: 'Send final note',
    },
    {
      label: 'After play',
      title: postMatchClosed ? 'Week closed' : 'Close the loop',
      state: postMatchClosed ? 'Closed' : postMatchCloseoutRows.length ? `${postMatchCloseoutRows.length} courts` : 'Scorecard',
      detail: postMatchClosed
        ? 'The match week is finalized here.'
        : 'Capture the scorecard, recap the match, and mark the week closed.',
      href: dataAssistCaptainHref,
      stage: 'team',
      tone: postMatchClosed ? 'good' : 'info',
      cta: postMatchClosed ? 'Review data' : 'Upload scorecard',
    },
  ], [
    captainNudgeArrivalLabel,
    captainNudgeLocationLabel,
    captainNudgeOpenReplyCount,
    levelUpAvailabilityHref,
    lineupBuilderHref,
    matchDayResponseRows.length,
    matchDaySubRiskCount,
    messagingHref,
    postMatchClosed,
    postMatchCloseoutRows.length,
    workspaceState.lineupCount,
    workspaceState.lineupReady,
  ])
  const captainWeekTimelineNextItem = captainWeekTimelineItems.find((item) => item.tone === 'warn') ?? captainWeekTimelineItems.find((item) => item.tone === 'info') ?? captainWeekTimelineItems[0]
  const captainWeekTimelineReadyCount = captainWeekTimelineItems.filter((item) => item.tone === 'good').length

  const rosterByNameKey = useMemo(() => {
    const map = new Map<string, TeamPlayerSummary>()
    for (const player of roster) {
      map.set(safeKey(player.name), player)
    }
    return map
  }, [roster])
  const captainCourtConfidenceItems = useMemo<CaptainCourtConfidenceItem[]>(() => {
    if (!matchDayLineupRows.length) {
      return [
        {
          label: 'No saved courts',
          players: 'Lineup not saved',
          state: 'Build lineup',
          detail: 'Save courts first, then confidence checks can attach to each court.',
          tone: 'warn',
        },
      ]
    }

    return matchDayLineupRows.slice(0, isMobile ? 3 : 4).map((row, index) => {
      const courtLabel = safeText(row.court_label, `Court ${index + 1}`)
      const players = (row.players ?? []).filter((name) => safeText(name))
      const playerLabel = players.length ? players.join(' / ') : 'Players not set'
      const expectedPlayers = safeText(row.slot_type).toLowerCase().includes('single') ? 1 : 2
      const hasMissingPlayers = players.length < expectedPlayers
      const hasSubRisk = index < matchDaySubRiskCount
      const ratingWatchPlayers = players
        .map((name) => rosterByNameKey.get(safeKey(name)))
        .filter((player): player is TeamPlayerSummary => Boolean(player))
        .filter((player) => player.ratingStatus === 'At Risk' || player.ratingStatus === 'Drop Watch')

      if (hasMissingPlayers) {
        return {
          label: courtLabel,
          players: playerLabel,
          state: 'Needs players',
          detail: 'Add the missing player name before this court is ready to send.',
          tone: 'warn',
        }
      }

      if (hasSubRisk) {
        return {
          label: courtLabel,
          players: playerLabel,
          state: 'Backup needed',
          detail: 'A late or need-sub reply is tied to this match window.',
          tone: 'warn',
        }
      }

      if (ratingWatchPlayers.length) {
        return {
          label: courtLabel,
          players: playerLabel,
          state: 'Rating watch',
          detail: `${ratingWatchPlayers.map((player) => player.name).join(' / ')} need a careful court call.`,
          tone: 'info',
        }
      }

      return {
        label: courtLabel,
        players: playerLabel,
        state: 'Solid',
        detail: 'Players are named with no saved sub or rating watch flags.',
        tone: 'good',
      }
    })
  }, [isMobile, matchDayLineupRows, matchDaySubRiskCount, rosterByNameKey])
  const captainCourtSolidCount = captainCourtConfidenceItems.filter((item) => item.tone === 'good').length
  const captainCourtWatchCount = captainCourtConfidenceItems.filter((item) => item.tone === 'info').length
  const captainCourtBackupCount = captainCourtConfidenceItems.filter((item) => item.tone === 'warn').length
  const captainCourtConfidencePercent = matchDayLineupRows.length
    ? Math.round((captainCourtSolidCount / captainCourtConfidenceItems.length) * 100)
    : 0

  const captainBenchReadinessItems = useMemo<CaptainBenchReadinessItem[]>(() => {
    if (!matchDaySubCandidates.length) {
      return [
        {
          id: 'bench-empty',
          name: roster.length ? 'Bench covered' : 'Roster needed',
          fit: roster.length ? 'No off-court players in this view' : 'Add roster context',
          signal: roster.length ? 'Check lineup' : 'No roster',
          detail: roster.length
            ? 'Every visible roster player is already on the saved courts. Review the lineup before calling backups.'
            : 'Load a team roster before bench readiness can rank backup calls.',
          priority: roster.length ? 'Review' : 'Start',
          tone: 'info',
        },
      ]
    }

    return matchDaySubCandidates.map((candidate, index) => ({
      id: candidate.id || `${candidate.name}-${index}`,
      name: candidate.name,
      fit: candidate.fit,
      signal: candidate.signal,
      detail: candidate.detail,
      priority: index === 0
        ? 'First call'
        : candidate.tone === 'warn'
          ? 'Use carefully'
          : candidate.tone === 'good'
            ? 'Strong cover'
            : 'Bench option',
      tone: candidate.tone,
    }))
  }, [matchDaySubCandidates, roster.length])
  const captainBenchReadyCount = captainBenchReadinessItems.filter((item) => item.tone === 'good' || item.priority === 'First call').length
  const captainBenchWatchCount = captainBenchReadinessItems.filter((item) => item.tone === 'warn').length
  const captainBenchPrimaryItem = captainBenchReadinessItems.find((item) => item.priority === 'First call') ?? captainBenchReadinessItems[0]

  const captainCourtSwapItems = useMemo<CaptainCourtSwapItem[]>(() => {
    if (!matchDayLineupRows.length) {
      return [
        {
          id: 'swap-lineup-needed',
          courtLabel: 'No saved court',
          outPlayer: 'Lineup needed',
          inPlayer: 'Pick court first',
          keep: 'No changes yet',
          state: 'Build lineup',
          detail: 'Save a court plan before swap options can stay tied to court order.',
          tone: 'warn',
        },
      ]
    }

    const benchPool = captainBenchReadinessItems.filter((item) => item.id !== 'bench-empty')
    const rankedRows = matchDayLineupRows
      .map((row, index) => {
        const courtLabel = safeText(row.court_label, `Court ${index + 1}`)
        const confidence = captainCourtConfidenceItems.find((item) => item.label === courtLabel)
        const score = confidence?.tone === 'warn' ? 0 : confidence?.tone === 'info' ? 1 : 2
        return { row, index, courtLabel, confidence, score }
      })
      .sort((a, b) => a.score - b.score || a.index - b.index)
      .slice(0, isMobile ? 2 : 3)

    return rankedRows.map(({ row, index, courtLabel, confidence }, swapIndex) => {
      const players = (row.players ?? []).map((name) => safeText(name)).filter(Boolean)
      const expectedPlayers = safeText(row.slot_type).toLowerCase().includes('single') ? 1 : 2
      const hasOpenSlot = players.length < expectedPlayers
      const bench = benchPool[swapIndex] ?? null
      const outPlayer = hasOpenSlot ? 'Open slot' : safeText(players[players.length - 1], 'Player to confirm')
      const keepPlayers = hasOpenSlot
        ? players.join(' / ')
        : players.filter((name) => name !== outPlayer).join(' / ')
      const keep = safeText(keepPlayers, hasOpenSlot ? 'Court shell' : 'Court order')
      const inPlayer = bench?.name ?? 'Bench call needed'
      const state = confidence?.tone === 'warn'
        ? 'Needs cover'
        : confidence?.tone === 'info'
          ? 'Watch move'
          : 'Stable option'

      return {
        id: row.id || `${courtLabel}-${index}`,
        courtLabel,
        outPlayer,
        inPlayer,
        keep,
        state,
        detail: bench
          ? hasOpenSlot
            ? `Fill ${courtLabel} with ${bench.name} and keep ${keep} untouched.`
            : `Swap ${bench.name} for ${outPlayer}; keep ${keep} unchanged.`
          : 'Mark the unavailable player, then add an off-court roster option before moving this court.',
        tone: confidence?.tone === 'warn' ? 'warn' : confidence?.tone === 'info' ? 'info' : 'good',
      }
    })
  }, [captainBenchReadinessItems, captainCourtConfidenceItems, isMobile, matchDayLineupRows])
  const captainCourtSwapNeedsCount = captainCourtSwapItems.filter((item) => item.tone === 'warn').length
  const captainCourtSwapStableCount = captainCourtSwapItems.filter((item) => item.tone === 'good').length
  const captainCourtSwapPrimaryItem = captainCourtSwapItems[0]

  const captainMatchDayCommandActions = useMemo<CaptainMatchDayCommandAction[]>(() => [
    {
      label: 'Chase replies',
      state: matchDayNotConfirmedCount > 0 ? `${matchDayNotConfirmedCount} open` : matchDayResponseRows.length ? 'Clear' : 'Collect',
      detail: matchDayNotConfirmedCount > 0
        ? 'Nudge the players still missing a clear answer.'
        : matchDayResponseRows.length
          ? 'Replies are clear for the saved event.'
          : 'Start availability before courts lock.',
      href: levelUpAvailabilityHref,
      stage: 'availability',
      tone: matchDayNotConfirmedCount > 0 ? 'warn' : matchDayResponseRows.length ? 'good' : 'info',
    },
    {
      label: 'Message lineup',
      state: workspaceState.messagingReady ? 'Ready' : workspaceState.lineupReady ? 'Add details' : 'Draft',
      detail: workspaceState.messagingReady
        ? 'Send the lineup and arrival note.'
        : workspaceState.lineupReady
          ? 'Add arrival or location before sending.'
          : 'Build courts before the team note.',
      href: messagingHref,
      stage: 'messaging',
      tone: workspaceState.messagingReady ? 'good' : workspaceState.lineupReady ? 'info' : 'warn',
    },
    {
      label: 'Adjust courts',
      state: captainCourtSwapNeedsCount > 0 ? `${captainCourtSwapNeedsCount} move` : matchDaySubRiskCount > 0 ? 'Sub risk' : workspaceState.lineupReady ? 'Stable' : 'Build',
      detail: captainCourtSwapNeedsCount > 0
        ? 'Use the least disruptive swap before texting.'
        : matchDaySubRiskCount > 0
          ? 'Check backup coverage before warm-up.'
          : workspaceState.lineupReady
            ? 'Court order is stable for now.'
            : 'Save lineup courts first.',
      href: lineupBuilderHref,
      stage: 'lineup',
      tone: captainCourtSwapNeedsCount > 0 || matchDaySubRiskCount > 0 ? 'warn' : workspaceState.lineupReady ? 'good' : 'info',
    },
  ], [
    captainCourtSwapNeedsCount,
    levelUpAvailabilityHref,
    lineupBuilderHref,
    matchDayNotConfirmedCount,
    matchDayResponseRows.length,
    matchDaySubRiskCount,
    messagingHref,
    workspaceState.lineupReady,
    workspaceState.messagingReady,
  ])
  const captainMatchDayPrimaryCommand = captainMatchDayCommandActions.find((item) => item.tone === 'warn') ?? captainMatchDayCommandActions[0]
  const captainEmergencyAlertCount = matchDaySubRiskCount + matchDayNotConfirmedCount + captainCourtSwapNeedsCount
  const captainEmergencyModeActions = useMemo<CaptainEmergencyAction[]>(() => [
    {
      label: 'Chase reply',
      state: matchDayNotConfirmedCount > 0 ? `${matchDayNotConfirmedCount} open` : 'Clear',
      detail: matchDayNotConfirmedCount > 0
        ? 'Get the missing In, Out, or ETA before moving courts.'
        : 'No open reply chase is blocking the lineup.',
      href: levelUpAvailabilityHref,
      stage: 'availability',
      tone: matchDayNotConfirmedCount > 0 ? 'warn' : 'good',
      cta: 'Chase',
    },
    {
      label: 'Call backup',
      state: captainCourtSwapNeedsCount > 0
        ? 'Cover now'
        : captainBenchReadyCount > 0
          ? 'Bench ready'
          : 'Review',
      detail: captainCourtSwapNeedsCount > 0
        ? `${captainCourtSwapPrimaryItem.inPlayer} for ${captainCourtSwapPrimaryItem.courtLabel}.`
        : captainBenchReadyCount > 0
          ? `${captainBenchPrimaryItem.name} is the first backup read.`
          : 'Pick the first backup before changing the lineup.',
      href: lineupBuilderHref,
      stage: 'lineup',
      tone: captainCourtSwapNeedsCount > 0 ? 'warn' : captainBenchReadyCount > 0 ? 'good' : 'info',
      cta: 'Backup',
    },
    {
      label: 'Move court',
      state: captainCourtSwapNeedsCount > 0
        ? `${captainCourtSwapNeedsCount} move`
        : workspaceState.lineupReady
          ? 'Stable'
          : 'Build',
      detail: captainCourtSwapNeedsCount > 0
        ? captainCourtSwapPrimaryItem.detail
        : workspaceState.lineupReady
          ? 'Court order is stable after current replies.'
          : 'Build courts before emergency changes can land cleanly.',
      href: lineupBuilderHref,
      stage: 'lineup',
      tone: captainCourtSwapNeedsCount > 0 ? 'warn' : workspaceState.lineupReady ? 'good' : 'info',
      cta: 'Lineup',
    },
    {
      label: 'Send change',
      state: captainEmergencyAlertCount > 0 ? 'Urgent' : workspaceState.messagingReady ? 'Ready' : 'Prep',
      detail: captainEmergencyAlertCount > 0
        ? 'Copy the emergency note, then send the lineup change.'
        : workspaceState.messagingReady
          ? 'Messages are ready if anything changes.'
          : 'Add event details before sending player updates.',
      href: messagingHref,
      stage: 'messaging',
      tone: captainEmergencyAlertCount > 0 ? 'warn' : workspaceState.messagingReady ? 'good' : 'info',
      cta: 'Message',
    },
  ], [
    captainBenchPrimaryItem.name,
    captainBenchReadyCount,
    captainCourtSwapNeedsCount,
    captainCourtSwapPrimaryItem.courtLabel,
    captainCourtSwapPrimaryItem.detail,
    captainCourtSwapPrimaryItem.inPlayer,
    captainEmergencyAlertCount,
    levelUpAvailabilityHref,
    lineupBuilderHref,
    matchDayNotConfirmedCount,
    messagingHref,
    workspaceState.lineupReady,
    workspaceState.messagingReady,
  ])
  const captainEmergencyPrimaryAction = captainEmergencyModeActions.find((item) => item.tone === 'warn') ?? captainEmergencyModeActions[0]
  const captainEmergencyModeStatus = captainEmergencyAlertCount > 0
    ? `${captainEmergencyAlertCount} alert`
    : workspaceState.lineupReady
      ? 'Standby'
      : 'Build first'
  const captainEmergencyModeMessage = useMemo(() => [
    `Late change: ${weekAtGlance.eventDateLabel} vs ${weekAtGlance.opponentLabel}`,
    matchDayNotConfirmedCount > 0 ? `Reply gap: ${matchDayNotConfirmedCount} open.` : 'Reply gap: clear.',
    captainCourtSwapNeedsCount > 0
      ? `Backup: ${captainCourtSwapPrimaryItem.inPlayer} for ${captainCourtSwapPrimaryItem.courtLabel}.`
      : captainBenchReadyCount > 0
        ? `Backup: ${captainBenchPrimaryItem.name} is ready.`
        : 'Backup: still reviewing cover.',
    captainCourtSwapNeedsCount > 0 ? `Lineup move: ${captainCourtSwapPrimaryItem.detail}` : 'Lineup move: no urgent court move saved.',
    `Arrival: ${matchDayArrivalLabel} at ${matchDayLocationLabel}`,
  ].join('\n'), [
    captainBenchPrimaryItem.name,
    captainBenchReadyCount,
    captainCourtSwapNeedsCount,
    captainCourtSwapPrimaryItem.courtLabel,
    captainCourtSwapPrimaryItem.detail,
    captainCourtSwapPrimaryItem.inPlayer,
    matchDayArrivalLabel,
    matchDayLocationLabel,
    matchDayNotConfirmedCount,
    weekAtGlance.eventDateLabel,
    weekAtGlance.opponentLabel,
  ])
  const captainChangeAckEntryMap = useMemo(() => {
    if (!workspaceState.currentEventKey) return new Map<string, CaptainChangeAckEntry>()
    if (captainChangeAckVersion < 0) return new Map<string, CaptainChangeAckEntry>()

    return new Map(
      readLocalArray<CaptainChangeAckEntry>(CAPTAIN_CHANGE_ACK_STORAGE_KEY)
        .filter((entry) => safeText(entry.event_key) === workspaceState.currentEventKey)
        .map((entry) => [safeText(entry.target_key), entry] as const)
        .filter(([targetKey]) => Boolean(targetKey)),
    )
  }, [captainChangeAckVersion, workspaceState.currentEventKey])

  const captainChangeAckTargets = useMemo<CaptainChangeAckTarget[]>(() => {
    const targetMap = new Map<string, { name: string; court: string }>()
    matchDayLineupRows.forEach((row, index) => {
      const court = safeText(row.court_label, `Court ${index + 1}`)
      ;(row.players ?? []).forEach((playerName) => {
        const name = safeText(playerName)
        const key = safeKey(name)
        if (!name || targetMap.has(key)) return
        targetMap.set(key, { name, court })
      })
    })

    if (!targetMap.size) {
      captainMessageContactRows.forEach((contact) => {
        if (contact.is_active === false) return
        const name = safeText(contact.full_name)
        const key = safeKey(name)
        if (!name || targetMap.has(key)) return
        targetMap.set(key, { name, court: safeText(contact.phone) ? 'Text contact' : 'Roster contact' })
      })
    }

    if (!targetMap.size) {
      roster.forEach((player) => {
        const name = safeText(player.name)
        const key = safeKey(name)
        if (!name || targetMap.has(key)) return
        targetMap.set(key, { name, court: 'Roster' })
      })
    }

    return Array.from(targetMap.entries()).slice(0, isMobile ? 6 : 8).map(([targetKey, target]) => {
      const ackEntry = captainChangeAckEntryMap.get(targetKey)
      const acknowledged = ackEntry?.status === 'acknowledged'
      const updatedLabel = formatDateTimeShort(ackEntry?.updated_at || '')
      return {
        id: targetKey,
        name: target.name,
        court: target.court,
        status: acknowledged ? 'acknowledged' : 'pending',
        state: acknowledged ? 'Acked' : 'Waiting',
        detail: acknowledged
          ? `Confirmed${updatedLabel ? ` ${updatedLabel}` : ''}.`
          : captainEmergencyAlertCount > 0
            ? 'Needs the updated court or backup note.'
            : 'Needs a quick thumbs-up on the latest plan.',
        tone: acknowledged ? 'good' : captainEmergencyAlertCount > 0 ? 'warn' : 'info',
      }
    })
  }, [
    captainChangeAckEntryMap,
    captainEmergencyAlertCount,
    captainMessageContactRows,
    isMobile,
    matchDayLineupRows,
    roster,
  ])
  const captainChangeAckPendingCount = captainChangeAckTargets.filter((target) => target.status === 'pending').length
  const captainChangeAckConfirmedCount = captainChangeAckTargets.length - captainChangeAckPendingCount
  const captainChangeAckPrimaryTarget = captainChangeAckTargets.find((target) => target.status === 'pending') ?? captainChangeAckTargets[0]
  const captainChangeAckStatus = captainChangeAckTargets.length
    ? captainChangeAckPendingCount > 0
      ? `${captainChangeAckPendingCount} waiting`
      : 'All acked'
    : 'No targets'
  const captainChangeAckChaseMessage = useMemo(() => {
    const pendingNames = captainChangeAckTargets
      .filter((target) => target.status === 'pending')
      .map((target) => target.name)
    const targetNames = pendingNames.length
      ? pendingNames.slice(0, isMobile ? 4 : 6).join(', ')
      : 'everyone'
    const changeLine = captainCourtSwapNeedsCount > 0
      ? `${captainCourtSwapPrimaryItem.courtLabel}: ${captainCourtSwapPrimaryItem.outPlayer} -> ${captainCourtSwapPrimaryItem.inPlayer}.`
      : captainEmergencyAlertCount > 0
        ? 'Please confirm you saw the latest court and arrival update.'
        : 'Please confirm you saw the latest lineup note.'

    return [
      `Quick confirmation for ${weekAtGlance.eventDateLabel} vs ${weekAtGlance.opponentLabel}:`,
      changeLine,
      `Need ack from: ${targetNames}.`,
      `Arrival: ${matchDayArrivalLabel} at ${matchDayLocationLabel}`,
    ].join('\n')
  }, [
    captainChangeAckTargets,
    captainCourtSwapNeedsCount,
    captainCourtSwapPrimaryItem.courtLabel,
    captainCourtSwapPrimaryItem.inPlayer,
    captainCourtSwapPrimaryItem.outPlayer,
    captainEmergencyAlertCount,
    isMobile,
    matchDayArrivalLabel,
    matchDayLocationLabel,
    weekAtGlance.eventDateLabel,
    weekAtGlance.opponentLabel,
  ])

  const captainArrivalRiskEntryMap = useMemo(() => {
    if (!workspaceState.currentEventKey) return new Map<string, CaptainArrivalRiskEntry>()
    if (captainArrivalRiskVersion < 0) return new Map<string, CaptainArrivalRiskEntry>()

    return new Map(
      readLocalArray<CaptainArrivalRiskEntry>(CAPTAIN_ARRIVAL_RISK_STORAGE_KEY)
        .filter((entry) => safeText(entry.event_key) === workspaceState.currentEventKey)
        .map((entry) => [safeText(entry.target_key), entry] as const)
        .filter(([targetKey]) => Boolean(targetKey)),
    )
  }, [captainArrivalRiskVersion, workspaceState.currentEventKey])

  const captainArrivalRiskTargets = useMemo<CaptainArrivalRiskTarget[]>(() => {
    const contactNameById = new Map(
      captainMessageContactRows
        .map((contact) => [safeText(contact.id), safeText(contact.full_name)] as const)
        .filter(([id, name]) => Boolean(id && name)),
    )
    const responseStatusByName = new Map<string, string>()
    matchDayResponseRows.forEach((row) => {
      const contactName = contactNameById.get(safeText(row.contact_id))
      const nameKey = safeKey(contactName || '')
      if (!nameKey) return
      responseStatusByName.set(nameKey, safeText(row.status).toLowerCase())
    })

    const targetMap = new Map<string, { name: string; court: string; role: string }>()
    matchDayLineupRows.forEach((row, index) => {
      const court = safeText(row.court_label, `Court ${index + 1}`)
      ;(row.players ?? []).forEach((playerName) => {
        const name = safeText(playerName)
        const key = safeKey(name)
        if (!name || targetMap.has(key)) return
        targetMap.set(key, { name, court, role: 'Lineup' })
      })
    })

    const backupName = captainCourtSwapNeedsCount > 0
      ? safeText(captainCourtSwapPrimaryItem.inPlayer)
      : captainBenchReadyCount > 0
        ? safeText(captainBenchPrimaryItem.name)
        : ''
    if (backupName) {
      const backupKey = safeKey(backupName)
      if (!targetMap.has(backupKey)) {
        targetMap.set(backupKey, {
          name: backupName,
          court: captainCourtSwapNeedsCount > 0 ? captainCourtSwapPrimaryItem.courtLabel : 'Backup',
          role: 'Backup',
        })
      }
    }

    if (!targetMap.size) {
      captainMessageContactRows.forEach((contact) => {
        const name = safeText(contact.full_name)
        const key = safeKey(name)
        if (!name || targetMap.has(key)) return
        targetMap.set(key, { name, court: safeText(contact.phone) ? 'Text contact' : 'Roster contact', role: 'Contact' })
      })
    }

    if (!targetMap.size) {
      roster.forEach((player) => {
        const name = safeText(player.name)
        const key = safeKey(name)
        if (!name || targetMap.has(key)) return
        targetMap.set(key, { name, court: 'Roster', role: 'Roster' })
      })
    }

    return Array.from(targetMap.entries()).slice(0, isMobile ? 6 : 8).map(([targetKey, target]) => {
      const savedStatus = captainArrivalRiskEntryMap.get(targetKey)?.status
      const responseStatus = responseStatusByName.get(targetKey)
      const inferredStatus: CaptainArrivalRiskStatus =
        responseStatus === 'confirmed'
          ? 'on-time'
          : responseStatus === 'running-late'
            ? 'running-late'
            : responseStatus === 'need-sub'
              ? 'backup-ready'
              : target.role === 'Backup'
                ? 'backup-ready'
                : 'eta-needed'
      const status = savedStatus || inferredStatus
      const updatedLabel = formatDateTimeShort(captainArrivalRiskEntryMap.get(targetKey)?.updated_at || '')
      const state = status === 'on-time'
        ? 'On time'
        : status === 'running-late'
          ? 'Late'
          : status === 'backup-ready'
            ? 'Backup ready'
            : 'Need ETA'
      const detail = status === 'on-time'
        ? `Arrival covered${updatedLabel ? ` ${updatedLabel}` : ''}.`
        : status === 'running-late'
          ? `Ask for ETA before ${target.court} warms up.`
          : status === 'backup-ready'
            ? 'Keep close until the court is stable.'
            : `Confirm arrival by ${matchDayArrivalLabel}.`

      return {
        id: targetKey,
        name: target.name,
        court: target.court,
        role: target.role,
        status,
        state,
        detail,
        tone: status === 'on-time' || status === 'backup-ready' ? 'good' : status === 'running-late' ? 'warn' : 'info',
      }
    })
  }, [
    captainArrivalRiskEntryMap,
    captainBenchPrimaryItem.name,
    captainBenchReadyCount,
    captainCourtSwapNeedsCount,
    captainCourtSwapPrimaryItem.courtLabel,
    captainCourtSwapPrimaryItem.inPlayer,
    captainMessageContactRows,
    isMobile,
    matchDayArrivalLabel,
    matchDayLineupRows,
    matchDayResponseRows,
    roster,
  ])
  const captainArrivalRiskWatchCount = captainArrivalRiskTargets.filter((target) => target.status === 'eta-needed' || target.status === 'running-late').length
  const captainArrivalRiskLateCount = captainArrivalRiskTargets.filter((target) => target.status === 'running-late').length
  const captainArrivalRiskOnTimeCount = captainArrivalRiskTargets.filter((target) => target.status === 'on-time').length
  const captainArrivalRiskBackupCount = captainArrivalRiskTargets.filter((target) => target.status === 'backup-ready').length
  const captainArrivalRiskPrimaryTarget = captainArrivalRiskTargets.find((target) => target.status === 'running-late')
    ?? captainArrivalRiskTargets.find((target) => target.status === 'eta-needed')
    ?? captainArrivalRiskTargets.find((target) => target.status === 'backup-ready')
    ?? captainArrivalRiskTargets[0]
  const captainArrivalRiskStatus = captainArrivalRiskTargets.length
    ? captainArrivalRiskWatchCount > 0
      ? `${captainArrivalRiskWatchCount} watch`
      : 'Arrival clear'
    : 'No targets'
  const captainArrivalRiskMessage = useMemo(() => {
    const watchNames = captainArrivalRiskTargets
      .filter((target) => target.status === 'eta-needed' || target.status === 'running-late')
      .map((target) => target.name)
    const targetNames = watchNames.length
      ? watchNames.slice(0, isMobile ? 4 : 6).join(', ')
      : 'everyone'
    const backupLine = captainArrivalRiskBackupCount > 0
      ? `Backup ready: ${captainArrivalRiskTargets.filter((target) => target.status === 'backup-ready').map((target) => target.name).slice(0, 3).join(', ')}.`
      : captainBenchReadyCount > 0
        ? `Backup: ${captainBenchPrimaryItem.name} can stay close.`
        : 'Backup: still reviewing cover.'

    return [
      `ETA check for ${weekAtGlance.eventDateLabel} vs ${weekAtGlance.opponentLabel}:`,
      `Target arrival: ${matchDayArrivalLabel} at ${matchDayLocationLabel}.`,
      `Need ETA from: ${targetNames}.`,
      backupLine,
    ].join('\n')
  }, [
    captainArrivalRiskBackupCount,
    captainArrivalRiskTargets,
    captainBenchPrimaryItem.name,
    captainBenchReadyCount,
    isMobile,
    matchDayArrivalLabel,
    matchDayLocationLabel,
    weekAtGlance.eventDateLabel,
    weekAtGlance.opponentLabel,
  ])
  const captainCourtHandoffEntryMap = useMemo(() => {
    if (!workspaceState.currentEventKey) return new Map<string, CaptainCourtHandoffEntry>()
    if (captainCourtHandoffVersion < 0) return new Map<string, CaptainCourtHandoffEntry>()

    return new Map(
      readLocalArray<CaptainCourtHandoffEntry>(CAPTAIN_COURT_HANDOFF_STORAGE_KEY)
        .filter((entry) => safeText(entry.event_key) === workspaceState.currentEventKey)
        .map((entry) => [safeText(entry.court_key), entry] as const)
        .filter(([courtKey]) => Boolean(courtKey)),
    )
  }, [captainCourtHandoffVersion, workspaceState.currentEventKey])

  const captainCourtHandoffItems = useMemo<CaptainCourtHandoffItem[]>(() => {
    const ackByName = new Map(captainChangeAckTargets.map((target) => [target.id, target.status] as const))
    const arrivalByName = new Map(captainArrivalRiskTargets.map((target) => [target.id, target.status] as const))
    const sourceRows = matchDayLineupRows.length
      ? matchDayLineupRows
      : [{
          id: 'court-handoff-empty',
          court_label: 'Court plan',
          players: captainArrivalRiskTargets.slice(0, isMobile ? 2 : 4).map((target) => target.name),
        }]

    return sourceRows.slice(0, isMobile ? 4 : 6).map((row, index) => {
      const courtLabel = safeText(row.court_label, `Court ${index + 1}`)
      const courtKey = safeText(row.id, safeKey(`${courtLabel}-${index}`))
      const playerNames = (row.players ?? []).map((name) => safeText(name)).filter(Boolean)
      const playerKeys = playerNames.map((name) => safeKey(name))
      const pendingAckCount = playerKeys.filter((key) => ackByName.get(key) === 'pending').length
      const lateCount = playerKeys.filter((key) => arrivalByName.get(key) === 'running-late').length
      const etaCount = playerKeys.filter((key) => arrivalByName.get(key) === 'eta-needed').length
      const savedStatus = captainCourtHandoffEntryMap.get(courtKey)?.status
      const blocked = pendingAckCount > 0 || lateCount > 0 || etaCount > 0 || !playerNames.length
      const status: CaptainCourtHandoffStatus = savedStatus || (blocked ? 'prep' : 'warmup')
      const state = status === 'ready' ? 'Ready' : status === 'warmup' ? 'Warm-up' : blocked ? 'Hold' : 'Prep'
      const timerLabel = status === 'ready'
        ? 'Handoff'
        : status === 'warmup'
          ? 'T-5'
          : lateCount > 0
            ? 'T-10'
            : 'T-15'
      const detail = !playerNames.length
        ? 'Save the court plan before starting handoff.'
        : lateCount > 0
          ? `${lateCount} player${lateCount === 1 ? '' : 's'} still marked late.`
          : etaCount > 0
            ? `${etaCount} ETA check${etaCount === 1 ? '' : 's'} still open.`
            : pendingAckCount > 0
              ? `${pendingAckCount} confirmation${pendingAckCount === 1 ? '' : 's'} still waiting.`
              : status === 'ready'
                ? 'Court is ready to hand to the players.'
                : 'Confirm balls, court order, and warm-up start.'

      return {
        id: courtKey,
        courtKey,
        courtLabel,
        players: playerNames.join(' / ') || 'Players not set',
        status,
        state,
        phase: status === 'ready' ? 'Handoff' : status === 'warmup' ? 'Warm-up' : 'Prep',
        detail,
        timerLabel,
        ackLabel: pendingAckCount > 0 ? `${pendingAckCount} ack` : 'Ack clear',
        arrivalLabel: lateCount > 0 ? `${lateCount} late` : etaCount > 0 ? `${etaCount} ETA` : 'Arrival clear',
        tone: status === 'ready' ? 'good' : blocked ? 'warn' : 'info',
      }
    })
  }, [
    captainArrivalRiskTargets,
    captainChangeAckTargets,
    captainCourtHandoffEntryMap,
    isMobile,
    matchDayLineupRows,
  ])
  const captainCourtHandoffReadyCount = captainCourtHandoffItems.filter((item) => item.status === 'ready').length
  const captainCourtHandoffWatchCount = captainCourtHandoffItems.filter((item) => item.tone === 'warn').length
  const captainCourtHandoffPrimaryItem = captainCourtHandoffItems.find((item) => item.tone === 'warn')
    ?? captainCourtHandoffItems.find((item) => item.status !== 'ready')
    ?? captainCourtHandoffItems[0]
  const captainCourtHandoffStatus = captainCourtHandoffItems.length
    ? captainCourtHandoffWatchCount > 0
      ? `${captainCourtHandoffWatchCount} hold`
      : `${captainCourtHandoffReadyCount}/${captainCourtHandoffItems.length} ready`
    : 'No courts'
  const captainCourtHandoffMessage = useMemo(() => [
    `Court handoff for ${weekAtGlance.eventDateLabel} vs ${weekAtGlance.opponentLabel}`,
    `Arrival: ${matchDayArrivalLabel} at ${matchDayLocationLabel}`,
    ...captainCourtHandoffItems.slice(0, isMobile ? 4 : 6).map((item) => (
      `${item.courtLabel}: ${item.state} - ${item.players} (${item.ackLabel}, ${item.arrivalLabel})`
    )),
  ].join('\n'), [
    captainCourtHandoffItems,
    isMobile,
    matchDayArrivalLabel,
    matchDayLocationLabel,
    weekAtGlance.eventDateLabel,
    weekAtGlance.opponentLabel,
  ])
  const captainNotificationQueueEntryMap = useMemo(() => {
    if (!workspaceState.currentEventKey) return new Map<string, CaptainNotificationQueueEntry>()
    if (captainNotificationQueueVersion < 0) return new Map<string, CaptainNotificationQueueEntry>()

    return new Map(
      readLocalArray<CaptainNotificationQueueEntry>(CAPTAIN_NOTIFICATION_QUEUE_STORAGE_KEY)
        .filter((entry) => safeText(entry.event_key) === workspaceState.currentEventKey)
        .map((entry) => [safeText(entry.item_key), entry] as const)
        .filter(([itemKey]) => Boolean(itemKey)),
    )
  }, [captainNotificationQueueVersion, workspaceState.currentEventKey])

  const captainNotificationQueueItems = useMemo<CaptainNotificationQueueItem[]>(() => {
    const pendingAckNames = captainChangeAckTargets
      .filter((target) => target.status === 'pending')
      .map((target) => target.name)
    const arrivalWatchNames = captainArrivalRiskTargets
      .filter((target) => target.status === 'eta-needed' || target.status === 'running-late')
      .map((target) => target.name)
    const readyCourtItems = captainCourtHandoffItems.filter((item) => item.status === 'ready')
    const warmupItem = captainCourtHandoffPrimaryItem
    const backupName = captainCourtSwapNeedsCount > 0
      ? captainCourtSwapPrimaryItem.inPlayer
      : captainBenchReadyCount > 0
        ? captainBenchPrimaryItem.name
        : ''
    const backupBody = backupName
      ? `${backupName}, can you stay close for ${weekAtGlance.eventDateLabel} vs ${weekAtGlance.opponentLabel}? ${captainCourtSwapNeedsCount > 0 ? `${captainCourtSwapPrimaryItem.courtLabel} may need cover.` : 'You are my first backup call if anything changes.'} I will confirm before warm-up.`
      : `Team backup check for ${weekAtGlance.eventDateLabel} vs ${weekAtGlance.opponentLabel}: I am reviewing bench coverage and will text if a court opens.`
    const readyCourtBody = readyCourtItems.length
      ? [
          `Courts ready for ${weekAtGlance.eventDateLabel} vs ${weekAtGlance.opponentLabel}:`,
          ...readyCourtItems.slice(0, isMobile ? 4 : 6).map((item) => `${item.courtLabel}: ${item.players}`),
          `Arrival: ${matchDayArrivalLabel} at ${matchDayLocationLabel}`,
        ].join('\n')
      : captainCourtHandoffMessage
    const warmupBody = warmupItem
      ? [
          `${warmupItem.courtLabel}: ${warmupItem.state} for ${weekAtGlance.eventDateLabel} vs ${weekAtGlance.opponentLabel}.`,
          `Players: ${warmupItem.players}.`,
          warmupItem.tone === 'warn'
            ? `Hold for ${warmupItem.detail.toLowerCase()}`
            : `Start ${warmupItem.phase.toLowerCase()} and be ready for handoff.`,
        ].join('\n')
      : captainCourtHandoffMessage

    const drafts: Omit<CaptainNotificationQueueItem, 'queueStatus'>[] = [
      {
        id: 'ack-chase',
        label: 'Ack chase',
        audience: pendingAckNames.length ? pendingAckNames.slice(0, isMobile ? 3 : 5).join(', ') : 'Confirmed players',
        state: captainChangeAckPendingCount > 0 ? `${captainChangeAckPendingCount} waiting` : 'Ack clear',
        detail: captainChangeAckPendingCount > 0
          ? 'Send this before the updated court plan gets missed.'
          : 'No open change confirmations need a chase.',
        timing: captainChangeAckPendingCount > 0 ? 'Send now' : 'Standby',
        source: 'Change confirmations',
        body: captainChangeAckPendingCount > 0 ? captainChangeAckChaseMessage : '',
        tone: captainChangeAckPendingCount > 0 ? 'warn' : 'good',
      },
      {
        id: 'eta-chase',
        label: 'ETA chase',
        audience: arrivalWatchNames.length ? arrivalWatchNames.slice(0, isMobile ? 3 : 5).join(', ') : 'Arrivals clear',
        state: captainArrivalRiskWatchCount > 0 ? `${captainArrivalRiskWatchCount} watch` : 'Arrival clear',
        detail: captainArrivalRiskWatchCount > 0
          ? 'Ask for ETA before the first warm-up window closes.'
          : 'No saved ETA chase is blocking courts.',
        timing: captainArrivalRiskWatchCount > 0 ? 'Send now' : 'Standby',
        source: 'Arrival tracker',
        body: captainArrivalRiskWatchCount > 0 ? captainArrivalRiskMessage : '',
        tone: captainArrivalRiskWatchCount > 0 ? 'warn' : 'good',
      },
      {
        id: 'backup-standby',
        label: 'Backup standby',
        audience: backupName || 'Bench',
        state: captainCourtSwapNeedsCount > 0 ? 'Cover needed' : captainBenchReadyCount > 0 ? 'Ready' : 'Review',
        detail: captainCourtSwapNeedsCount > 0
          ? `${captainCourtSwapPrimaryItem.courtLabel} needs a fast cover text.`
          : captainBenchReadyCount > 0
            ? 'Keep the first backup close until courts settle.'
            : 'Use this if you want the bench on alert.',
        timing: captainCourtSwapNeedsCount > 0 ? 'Send now' : 'Next',
        source: 'Backup coverage',
        body: backupBody,
        tone: captainCourtSwapNeedsCount > 0 ? 'warn' : captainBenchReadyCount > 0 ? 'good' : 'info',
      },
      {
        id: 'warmup-court',
        label: 'Warm-up court',
        audience: warmupItem?.players ?? 'Court group',
        state: warmupItem?.state ?? 'Prep',
        detail: warmupItem?.detail ?? 'Build a court plan before sending a warm-up note.',
        timing: warmupItem?.tone === 'warn' ? 'Hold' : warmupItem?.status === 'ready' ? 'Send now' : 'Next',
        source: 'Court handoff',
        body: warmupBody,
        tone: warmupItem?.tone ?? 'info',
      },
      {
        id: 'ready-courts',
        label: 'Ready courts',
        audience: readyCourtItems.length ? `${readyCourtItems.length} court${readyCourtItems.length === 1 ? '' : 's'}` : 'No ready courts',
        state: readyCourtItems.length ? `${readyCourtItems.length} ready` : 'Not ready',
        detail: readyCourtItems.length
          ? 'Send the clean handoff once courts are stable.'
          : 'Mark courts ready before sending a ready-court note.',
        timing: readyCourtItems.length ? 'Send now' : 'Hold',
        source: 'Court handoff',
        body: readyCourtItems.length ? readyCourtBody : '',
        tone: readyCourtItems.length ? 'good' : 'info',
      },
    ]

    return drafts.map((draft) => {
      const savedStatus = captainNotificationQueueEntryMap.get(draft.id)?.status
      const queueStatus: CaptainNotificationQueueStatus = savedStatus || (draft.tone === 'warn' || draft.timing === 'Hold' ? 'hold' : 'queued')
      return {
        ...draft,
        queueStatus,
      }
    }).sort((a, b) => {
      const rank = (item: CaptainNotificationQueueItem) => (
        item.queueStatus === 'hold' && item.tone === 'warn' ? 0 :
        item.queueStatus === 'queued' ? 1 :
        item.queueStatus === 'hold' ? 2 :
        3
      )
      return rank(a) - rank(b)
    })
  }, [
    captainArrivalRiskMessage,
    captainArrivalRiskTargets,
    captainArrivalRiskWatchCount,
    captainBenchPrimaryItem.name,
    captainBenchReadyCount,
    captainChangeAckChaseMessage,
    captainChangeAckPendingCount,
    captainChangeAckTargets,
    captainCourtHandoffItems,
    captainCourtHandoffMessage,
    captainCourtHandoffPrimaryItem,
    captainCourtSwapNeedsCount,
    captainCourtSwapPrimaryItem.courtLabel,
    captainCourtSwapPrimaryItem.inPlayer,
    captainNotificationQueueEntryMap,
    isMobile,
    matchDayArrivalLabel,
    matchDayLocationLabel,
    weekAtGlance.eventDateLabel,
    weekAtGlance.opponentLabel,
  ])
  const captainNotificationQueueSentCount = captainNotificationQueueItems.filter((item) => item.queueStatus === 'sent').length
  const captainNotificationQueueHoldCount = captainNotificationQueueItems.filter((item) => item.queueStatus === 'hold' && item.tone === 'warn').length
  const captainNotificationQueueReadyCount = captainNotificationQueueItems.filter((item) => item.queueStatus === 'queued' && item.body).length
  const captainNotificationQueuePrimaryItem = captainNotificationQueueItems.find((item) => item.queueStatus === 'hold' && item.tone === 'warn')
    ?? captainNotificationQueueItems.find((item) => item.queueStatus === 'queued' && item.body)
    ?? captainNotificationQueueItems[0]
  const captainNotificationQueueStatus = captainNotificationQueueHoldCount > 0
    ? `${captainNotificationQueueHoldCount} hold`
    : captainNotificationQueueReadyCount > 0
      ? `${captainNotificationQueueReadyCount} queued`
      : `${captainNotificationQueueSentCount} sent`
  const captainPlayerBriefEntryMap = useMemo(() => {
    if (!workspaceState.currentEventKey) return new Map<string, CaptainPlayerBriefEntry>()
    if (captainPlayerBriefVersion < 0) return new Map<string, CaptainPlayerBriefEntry>()

    return new Map(
      readLocalArray<CaptainPlayerBriefEntry>(CAPTAIN_PLAYER_BRIEF_STORAGE_KEY)
        .filter((entry) => safeText(entry.event_key) === workspaceState.currentEventKey)
        .map((entry) => [safeText(entry.court_key), entry] as const)
        .filter(([courtKey]) => Boolean(courtKey)),
    )
  }, [captainPlayerBriefVersion, workspaceState.currentEventKey])

  const captainPlayerBriefItems = useMemo<CaptainPlayerBriefItem[]>(() => {
    const sourceRows = matchDayLineupRows.length
      ? matchDayLineupRows
      : [{
          id: 'player-brief-empty',
          court_label: 'Court brief',
          slot_type: 'doubles',
          players: [],
        }]

    return sourceRows.slice(0, isMobile ? 4 : 6).map((row, index) => {
      const courtLabel = safeText(row.court_label, `Court ${index + 1}`)
      const courtKey = safeText(row.id, safeKey(`${courtLabel}-${index}`))
      const slotType = safeText(row.slot_type).toLowerCase()
      const playerNames = (row.players ?? []).map((name) => safeText(name)).filter(Boolean)
      const players = playerNames.join(' / ') || 'Players not set'
      const confidence = captainCourtConfidenceItems.find((item) => item.label === courtLabel)
      const handoff = captainCourtHandoffItems.find((item) => item.courtLabel === courtLabel)
      const pendingAck = handoff?.ackLabel && handoff.ackLabel !== 'Ack clear'
      const arrivalOpen = handoff?.arrivalLabel && handoff.arrivalLabel !== 'Arrival clear'
      const needsReview = !playerNames.length || confidence?.tone === 'warn' || handoff?.tone === 'warn'
      const savedStatus = captainPlayerBriefEntryMap.get(courtKey)?.status
      const status: CaptainPlayerBriefStatus = needsReview ? 'review' : savedStatus || 'review'
      const isSingles = slotType.includes('single') || playerNames.length === 1
      const firstJob = isSingles
        ? 'Serve targets, return depth, and first-ball margin.'
        : 'Return lanes, first poach call, and middle-ball owner.'
      const betweenSets = confidence?.tone === 'info'
        ? 'Name one safer pattern before the next set starts.'
        : 'Pick one adjustment and keep the next two games simple.'
      const ifTrouble = pendingAck || arrivalOpen
        ? 'Hold the brief until the court group is fully confirmed.'
        : needsReview
          ? 'Keep roles simple and call backup coverage early.'
          : 'Reset to high-percentage patterns before changing the lineup.'
      const detail = !playerNames.length
        ? 'Save the court players before briefing this court.'
        : pendingAck
          ? `${handoff?.ackLabel} still open before the court talk.`
          : arrivalOpen
            ? `${handoff?.arrivalLabel} still open before warm-up.`
            : confidence?.detail || 'Give this court one clear job before warm-up.'
      const state = status === 'briefed'
        ? 'Briefed'
        : needsReview
          ? 'Review'
          : 'Ready brief'
      const body = [
        `${courtLabel} brief for ${weekAtGlance.eventDateLabel} vs ${weekAtGlance.opponentLabel}`,
        `Players: ${players}`,
        `First job: ${firstJob}`,
        `Between sets: ${betweenSets}`,
        `If trouble: ${ifTrouble}`,
      ].join('\n')

      return {
        id: courtKey,
        courtKey,
        courtLabel,
        players,
        status,
        state,
        detail,
        firstJob,
        betweenSets,
        ifTrouble,
        body,
        tone: status === 'briefed' ? 'good' : needsReview ? 'warn' : 'info',
      }
    })
  }, [
    captainCourtConfidenceItems,
    captainCourtHandoffItems,
    captainPlayerBriefEntryMap,
    isMobile,
    matchDayLineupRows,
    weekAtGlance.eventDateLabel,
    weekAtGlance.opponentLabel,
  ])
  const captainPlayerBriefedCount = captainPlayerBriefItems.filter((item) => item.status === 'briefed').length
  const captainPlayerBriefReviewCount = captainPlayerBriefItems.filter((item) => item.status !== 'briefed' && item.tone === 'warn').length
  const captainPlayerBriefReadyCount = captainPlayerBriefItems.filter((item) => item.status !== 'briefed' && item.tone !== 'warn').length
  const captainPlayerBriefPrimaryItem = captainPlayerBriefItems.find((item) => item.status !== 'briefed' && item.tone === 'warn')
    ?? captainPlayerBriefItems.find((item) => item.status !== 'briefed')
    ?? captainPlayerBriefItems[0]
  const captainPlayerBriefStatus = captainPlayerBriefReviewCount > 0
    ? `${captainPlayerBriefReviewCount} review`
    : captainPlayerBriefReadyCount > 0
      ? `${captainPlayerBriefReadyCount} ready`
      : `${captainPlayerBriefedCount} briefed`
  const captainMorningBriefItems = useMemo<CaptainMorningBriefItem[]>(() => [
    {
      label: 'Court plan',
      value: workspaceState.lineupReady ? `${workspaceState.lineupCount} courts` : 'Build lineup',
      detail: workspaceState.lineupReady
        ? safeText(matchDayLineupPreview[0]?.court_label, 'Court order saved')
        : 'Save courts before the team starts texting back.',
      tone: workspaceState.lineupReady ? 'good' : 'warn',
    },
    {
      label: 'Replies',
      value: matchDayResponseRows.length ? `${matchDayConfirmedCount}/${matchDayResponseRows.length}` : 'Not collected',
      detail: matchDayNotConfirmedCount > 0
        ? `${matchDayNotConfirmedCount} still need a clear answer.`
        : matchDayResponseRows.length
          ? 'No saved reply chase is open.'
          : 'Start the first availability ask.',
      tone: matchDayNotConfirmedCount > 0 ? 'warn' : matchDayResponseRows.length ? 'good' : 'info',
    },
    {
      label: 'Backup call',
      value: captainCourtSwapNeedsCount > 0
        ? captainCourtSwapPrimaryItem.inPlayer
        : captainBenchReadyCount > 0
          ? captainBenchPrimaryItem.name
          : 'Review bench',
      detail: captainCourtSwapNeedsCount > 0
        ? `${captainCourtSwapPrimaryItem.courtLabel} needs cover.`
        : captainBenchReadyCount > 0
          ? captainBenchPrimaryItem.fit
          : 'Pick the first sub option before warm-up.',
      tone: captainCourtSwapNeedsCount > 0 ? 'warn' : captainBenchReadyCount > 0 ? 'good' : 'info',
    },
    {
      label: 'Arrival',
      value: matchDayArrivalLabel,
      detail: matchDayLocationLabel,
      tone: workspaceState.messagingReady ? 'good' : 'info',
    },
  ], [
    captainBenchPrimaryItem.fit,
    captainBenchPrimaryItem.name,
    captainBenchReadyCount,
    captainCourtSwapNeedsCount,
    captainCourtSwapPrimaryItem.courtLabel,
    captainCourtSwapPrimaryItem.inPlayer,
    matchDayArrivalLabel,
    matchDayConfirmedCount,
    matchDayLineupPreview,
    matchDayLocationLabel,
    matchDayNotConfirmedCount,
    matchDayResponseRows.length,
    workspaceState.lineupCount,
    workspaceState.lineupReady,
    workspaceState.messagingReady,
  ])
  const captainMorningBriefPrimaryAction = captainMatchDayPrimaryCommand
  const captainMorningBriefLineup = matchDayLineupPreview.length ? matchDayLineupPreview : matchDayLineupRows.slice(0, 2)
  const captainMorningBriefMeta = [
    weekAtGlance.eventDateLabel,
    weekAtGlance.opponentLabel,
    matchDayArrivalLabel,
  ].filter((value) => value && !['Match date TBD', 'Opponent not set', 'Add arrival'].includes(value))
    .join(' - ')
  const captainMorningBriefStatus = captainMorningBriefItems.some((item) => item.tone === 'warn')
    ? 'Needs action'
    : captainMorningBriefItems.some((item) => item.tone === 'info')
      ? 'Review'
      : 'Ready'

  const captainPreSendChecks = useMemo<CaptainPreSendCheck[]>(() => [
    {
      label: 'Lineup completeness',
      state: workspaceState.lineupReady ? `${workspaceState.lineupCount} courts` : 'Draft needed',
      detail: workspaceState.lineupReady
        ? 'Saved courts are ready to carry into the team note.'
        : 'Build the lineup before sending players a plan.',
      href: lineupBuilderHref,
      stage: 'lineup',
      tone: workspaceState.lineupReady ? 'good' : 'warn',
    },
    {
      label: 'Arrival details',
      state: workspaceState.messagingReady ? 'Ready' : 'Missing detail',
      detail: workspaceState.messagingReady
        ? `${matchDayArrivalLabel} at ${matchDayLocationLabel}`
        : 'Add arrival time, location, or notes before the message goes out.',
      href: messagingHref,
      stage: 'messaging',
      tone: workspaceState.messagingReady ? 'good' : 'warn',
    },
    {
      label: 'Reply gaps',
      state: matchDayNotConfirmedCount > 0 ? `${matchDayNotConfirmedCount} open` : matchDayResponseRows.length ? 'Clear' : 'Not collected',
      detail: matchDayNotConfirmedCount > 0
        ? 'Chase open replies before locking the note.'
        : matchDayResponseRows.length
          ? 'No saved reply gaps are blocking send.'
          : 'Collect player availability before match-day texts tighten.',
      href: levelUpAvailabilityHref,
      stage: 'availability',
      tone: matchDayNotConfirmedCount > 0 ? 'warn' : matchDayResponseRows.length ? 'good' : 'info',
    },
    {
      label: 'Backup coverage',
      state: captainCourtSwapNeedsCount > 0
        ? `${captainCourtSwapNeedsCount} move`
        : captainBenchReadyCount > 0
          ? `${captainBenchReadyCount} ready`
          : 'Review',
      detail: captainCourtSwapNeedsCount > 0
        ? 'Handle the exposed court before sending the lineup.'
        : captainBenchReadyCount > 0
          ? `${captainBenchPrimaryItem.name} is your first bench call.`
          : 'Review bench depth before players arrive.',
      href: lineupBuilderHref,
      stage: 'lineup',
      tone: captainCourtSwapNeedsCount > 0 ? 'warn' : captainBenchReadyCount > 0 ? 'good' : 'info',
    },
  ], [
    captainBenchPrimaryItem.name,
    captainBenchReadyCount,
    captainCourtSwapNeedsCount,
    levelUpAvailabilityHref,
    lineupBuilderHref,
    matchDayArrivalLabel,
    matchDayLocationLabel,
    matchDayNotConfirmedCount,
    matchDayResponseRows.length,
    messagingHref,
    workspaceState.lineupCount,
    workspaceState.lineupReady,
    workspaceState.messagingReady,
  ])
  const captainPreSendIssueCount = captainPreSendChecks.filter((item) => item.tone === 'warn').length
  const captainPreSendReadyCount = captainPreSendChecks.filter((item) => item.tone === 'good').length
  const captainPreSendPrimaryCheck = captainPreSendChecks.find((item) => item.tone === 'warn') ?? captainPreSendChecks[0]

  const captainQuickCopyLineupRows = useMemo(() => {
    if (!matchDayLineupRows.length) return ['No saved courts yet']

    return matchDayLineupRows.map((row, index) => {
      const courtLabel = safeText(row.court_label, `Court ${index + 1}`)
      const playerLabel = row.players?.filter(Boolean).join(' / ') || 'Players not set'
      const slotLabel = safeText(row.slot_type)

      return `${courtLabel}: ${playerLabel}${slotLabel ? ` (${slotLabel})` : ''}`
    })
  }, [matchDayLineupRows])

  const captainQuickCopySummary = useMemo(() => {
    const replyLine = matchDayNotConfirmedCount > 0
      ? `Replies: ${matchDayNotConfirmedCount} still need a clear answer`
      : matchDayResponseRows.length
        ? 'Replies: clear from saved responses'
        : 'Replies: not collected yet'
    const backupLine = captainBenchReadyCount > 0
      ? `Backup: ${captainBenchPrimaryItem.name} - ${captainBenchPrimaryItem.fit}`
      : 'Backup: review bench coverage'
    const notesLine = safeText(matchDayEventDetail?.notes)

    return [
      `Team update: ${weekAtGlance.eventDateLabel} vs ${weekAtGlance.opponentLabel}`,
      `Arrival: ${matchDayArrivalLabel} at ${matchDayLocationLabel}`,
      'Lineup:',
      ...captainQuickCopyLineupRows,
      replyLine,
      backupLine,
      notesLine ? `Notes: ${notesLine}` : '',
    ].filter(Boolean).join('\n')
  }, [
    captainBenchPrimaryItem.fit,
    captainBenchPrimaryItem.name,
    captainBenchReadyCount,
    captainQuickCopyLineupRows,
    matchDayArrivalLabel,
    matchDayEventDetail?.notes,
    matchDayLocationLabel,
    matchDayNotConfirmedCount,
    matchDayResponseRows.length,
    weekAtGlance.eventDateLabel,
    weekAtGlance.opponentLabel,
  ])
  const captainQuickCopyPreviewLines = captainQuickCopySummary.split('\n').slice(0, isMobile ? 5 : 7)

  const captainPostSendTrackerItems = useMemo<CaptainPostSendTrackerItem[]>(() => {
    if (!matchDayResponseRows.length) {
      return [
        {
          id: 'post-send-no-replies',
          label: 'No replies saved',
          state: 'Start chase',
          detail: 'Send the lineup note, then collect replies so changes appear here.',
          tone: 'info',
        },
      ]
    }

    return matchDayResponseRows
      .slice()
      .sort((a, b) => safeText(b.updated_at).localeCompare(safeText(a.updated_at)))
      .slice(0, isMobile ? 3 : 4)
      .map((row, index) => {
        const status = safeText(row.status).toLowerCase()
        const statusLabel =
          status === 'confirmed'
            ? 'Confirmed'
            : status === 'running-late'
              ? 'Running late'
              : status === 'need-sub'
                ? 'Needs sub'
                : status === 'viewed'
                  ? 'Viewed'
                  : status === 'no-response'
                    ? 'No response'
                    : 'Open'
        const note = safeText(row.note)
        const updatedLabel = formatDateTimeShort(row.updated_at || '')
        const isRisk = status === 'running-late' || status === 'need-sub'
        const isConfirmed = status === 'confirmed'

        return {
          id: `${status || 'open'}-${row.updated_at || index}`,
          label: statusLabel,
          state: updatedLabel || `Reply ${index + 1}`,
          detail: note || (isRisk ? 'Review court coverage before warm-up.' : isConfirmed ? 'No chase needed for this saved reply.' : 'Follow up for a clean In, Out, or Maybe.'),
          tone: isRisk ? 'warn' : isConfirmed ? 'good' : 'info',
        }
      })
  }, [isMobile, matchDayResponseRows])
  const captainPostSendSent = weekStatus === 'ready-to-send' || weekStatus === 'finalized'
  const captainPostSendChangeCount = matchDaySubRiskCount + matchDayNotConfirmedCount
  const captainPostSendPrimaryItem = captainPostSendTrackerItems.find((item) => item.tone === 'warn') ?? captainPostSendTrackerItems[0]
  const captainPostSendImpactLabel = captainCourtSwapNeedsCount > 0
    ? captainCourtSwapPrimaryItem.courtLabel
    : matchDaySubRiskCount > 0
      ? 'Backup coverage'
      : matchDayNotConfirmedCount > 0
        ? 'Reply chase'
        : workspaceState.lineupReady
          ? 'Lineup stable'
          : 'Lineup needed'
  const captainPostSendNextAction = captainPostSendChangeCount > 0
    ? 'Chase changes'
    : captainPostSendSent
      ? 'Monitor replies'
      : 'Mark sent'
  const captainReplyReminderTargets = useMemo<CaptainReplyReminderTarget[]>(() => {
    const responseByContactId = new Map(
      matchDayResponseRows
        .map((row) => [safeText(row.contact_id), row] as const)
        .filter(([contactId]) => Boolean(contactId)),
    )
    const contactTargets = captainMessageContactRows.flatMap((contact) => {
      const contactId = safeText(contact.id)
      const response = contactId ? responseByContactId.get(contactId) : undefined
      const status = safeText(response?.status).toLowerCase()

      if (response && !CAPTAIN_REPLY_OPEN_STATUSES.has(status)) return []
      if (!response && matchDayResponseRows.length) return []

      const name = safeText(contact.full_name)
      if (!name) return []

      const phone = safeText(contact.phone)
      const isRisk = status === 'running-late' || status === 'need-sub'
      return [{
        id: contactId || safeKey(name),
        name,
        status: status === 'running-late' ? 'Running late' : status === 'need-sub' ? 'Needs sub' : status === 'viewed' ? 'Viewed' : 'No response',
        detail: safeText(response?.note) || (phone ? 'Text-ready contact' : 'Name saved only'),
        tone: isRisk ? 'warn' as const : 'info' as const,
      }]
    })

    if (contactTargets.length) return contactTargets.slice(0, isMobile ? 4 : 6)

    const fallbackNames = Array.from(new Set(
      (matchDayLineupRows.length
        ? matchDayLineupRows.flatMap((row) => row.players ?? [])
        : roster.map((player) => player.name))
        .map((name) => safeText(name))
        .filter(Boolean),
    ))
    const fallbackLimit = matchDayNotConfirmedCount > 0 ? matchDayNotConfirmedCount : matchDayResponseRows.length ? 0 : Math.min(fallbackNames.length, isMobile ? 4 : 6)

    return fallbackNames.slice(0, fallbackLimit).map((name) => ({
      id: safeKey(name),
      name,
      status: matchDayResponseRows.length ? 'Open reply' : 'Needs ask',
      detail: matchDayResponseRows.length ? 'Saved reply gap' : 'Start reply chase',
      tone: 'info' as const,
    }))
  }, [
    captainMessageContactRows,
    isMobile,
    matchDayLineupRows,
    matchDayNotConfirmedCount,
    matchDayResponseRows,
    roster,
  ])
  const captainReplyReminderNames = captainReplyReminderTargets.map((target) => target.name)
  const captainReplyReminderRiskTarget = captainReplyReminderTargets.find((target) => target.tone === 'warn')
  const captainReplyReminderNameList = captainReplyReminderNames.slice(0, isMobile ? 4 : 6).join(', ')
  const captainReplyReminderTemplates = useMemo<CaptainReplyReminderTemplate[]>(() => {
    if (!captainReplyReminderTargets.length) {
      return [
        {
          id: 'reply-reminder-clear',
          label: 'No reminder needed',
          state: 'Clear',
          detail: 'No open reply targets are saved for this event.',
          body: '',
          tone: 'good',
        },
      ]
    }

    const targetCount = captainReplyReminderTargets.length
    const firstTarget = captainReplyReminderTargets[0]
    const firstName = safeText(firstTarget.name.split(' ')[0], firstTarget.name)
    const dateLabel = weekAtGlance.eventDateLabel
    const opponentLabel = weekAtGlance.opponentLabel
    const groupNames = captainReplyReminderNameList || `${targetCount} players`
    const primaryBody = captainReplyReminderRiskTarget
      ? `${safeText(captainReplyReminderRiskTarget.name.split(' ')[0], captainReplyReminderRiskTarget.name)}, I saw your ${captainReplyReminderRiskTarget.status.toLowerCase()} note for ${dateLabel}. Can you confirm if you can still play, need a sub, or just need arrival help?`
      : `${firstName}, quick follow-up for ${dateLabel} vs ${opponentLabel}. I still need your lineup reply so I can keep courts and backup calls clean. Please reply In, Out, or Maybe when you can.`
    const groupBody = `Quick follow-up for ${dateLabel} vs ${opponentLabel}. I still need replies from ${groupNames} so I can keep courts and backup calls clean. Please reply In, Out, or Maybe when you can.`

    return [
      {
        id: 'reply-reminder-primary',
        label: captainReplyReminderRiskTarget ? 'Risk follow-up' : 'Player follow-up',
        state: captainReplyReminderRiskTarget?.status || firstTarget.status,
        detail: captainReplyReminderRiskTarget ? captainReplyReminderRiskTarget.name : firstTarget.name,
        body: primaryBody,
        tone: captainReplyReminderRiskTarget ? 'warn' : 'info',
      },
      {
        id: 'reply-reminder-group',
        label: 'Group chase',
        state: `${targetCount} target${targetCount === 1 ? '' : 's'}`,
        detail: groupNames,
        body: groupBody,
        tone: targetCount > 1 ? 'warn' : 'info',
      },
    ]
  }, [
    captainReplyReminderNameList,
    captainReplyReminderRiskTarget,
    captainReplyReminderTargets,
    weekAtGlance.eventDateLabel,
    weekAtGlance.opponentLabel,
  ])
  const captainReplyReminderPrimaryTemplate = captainReplyReminderTemplates[0]
  const captainReplyReminderGroupTemplate = captainReplyReminderTemplates[1] ?? captainReplyReminderTemplates[0]
  const captainBackupSendBody = captainCourtSwapNeedsCount > 0
    ? `${captainCourtSwapPrimaryItem.inPlayer}, can you stay ready for ${weekAtGlance.eventDateLabel} vs ${weekAtGlance.opponentLabel}? ${captainCourtSwapPrimaryItem.courtLabel} may need cover. I will confirm before warm-up.`
    : captainBenchReadyCount > 0
      ? `${captainBenchPrimaryItem.name}, can you stay close for ${weekAtGlance.eventDateLabel} vs ${weekAtGlance.opponentLabel}? You are my first backup call if anything changes.`
      : `Team backup check for ${weekAtGlance.eventDateLabel} vs ${weekAtGlance.opponentLabel}: I am reviewing bench coverage and will text if a court opens.`
  const captainArrivalSendBody = `Match detail for ${weekAtGlance.eventDateLabel} vs ${weekAtGlance.opponentLabel}: arrive by ${matchDayArrivalLabel} at ${matchDayLocationLabel}. Reply if anything changes with your status.`
  const captainSendQueueItems = useMemo<CaptainSendQueueItem[]>(() => [
    {
      id: 'lineup-note',
      label: 'Lineup note',
      state: workspaceState.lineupReady ? 'Ready' : 'Build first',
      detail: workspaceState.lineupReady ? `${captainQuickCopyLineupRows.length} lineup line${captainQuickCopyLineupRows.length === 1 ? '' : 's'} ready.` : 'Save courts before sending a lineup note.',
      body: captainQuickCopySummary,
      href: messagingHref,
      stage: 'messaging',
      tone: workspaceState.lineupReady ? 'good' : 'warn',
    },
    {
      id: 'reply-reminder',
      label: 'Reply reminder',
      state: captainReplyReminderTargets.length ? `${captainReplyReminderTargets.length} target${captainReplyReminderTargets.length === 1 ? '' : 's'}` : 'Clear',
      detail: captainReplyReminderPrimaryTemplate.detail,
      body: captainReplyReminderPrimaryTemplate.body,
      href: messagingHref,
      stage: 'messaging',
      tone: captainReplyReminderTargets.length ? 'warn' : 'good',
    },
    {
      id: 'backup-text',
      label: 'Backup text',
      state: captainCourtSwapNeedsCount > 0 ? 'Cover needed' : captainBenchReadyCount > 0 ? 'Bench ready' : 'Optional',
      detail: captainCourtSwapNeedsCount > 0
        ? `${captainCourtSwapPrimaryItem.courtLabel} has the first coverage risk.`
        : captainBenchReadyCount > 0
          ? `${captainBenchPrimaryItem.name} is the first backup call.`
          : 'No urgent backup text is blocking the lineup.',
      body: captainBackupSendBody,
      href: lineupBuilderHref,
      stage: 'lineup',
      tone: captainCourtSwapNeedsCount > 0 ? 'warn' : captainBenchReadyCount > 0 ? 'good' : 'info',
    },
    {
      id: 'arrival-note',
      label: 'Arrival note',
      state: workspaceState.messagingReady ? 'Ready' : 'Add detail',
      detail: `${matchDayArrivalLabel} at ${matchDayLocationLabel}`,
      body: captainArrivalSendBody,
      href: messagingHref,
      stage: 'messaging',
      tone: workspaceState.messagingReady ? 'good' : 'info',
    },
  ], [
    captainArrivalSendBody,
    captainBackupSendBody,
    captainBenchPrimaryItem.name,
    captainBenchReadyCount,
    captainCourtSwapNeedsCount,
    captainCourtSwapPrimaryItem.courtLabel,
    captainQuickCopyLineupRows.length,
    captainQuickCopySummary,
    captainReplyReminderPrimaryTemplate.body,
    captainReplyReminderPrimaryTemplate.detail,
    captainReplyReminderTargets.length,
    lineupBuilderHref,
    matchDayArrivalLabel,
    matchDayLocationLabel,
    messagingHref,
    workspaceState.lineupReady,
    workspaceState.messagingReady,
  ])
  const captainSendQueueReadyCount = captainSendQueueItems.filter((item) => item.tone === 'good').length
  const captainSendQueueActionCount = captainSendQueueItems.filter((item) => item.tone === 'warn').length
  const captainSendQueuePrimaryItem = captainSendQueueItems.find((item) => item.tone === 'warn') ?? captainSendQueueItems[0]
  const captainDecisionLogEntries = useMemo<CaptainDecisionLogEntry[]>(() => {
    if (!workspaceState.currentEventKey) return []
    if (captainDecisionLogVersion < 0) return []

    return readLocalArray<CaptainDecisionLogEntry>(CAPTAIN_DECISION_LOG_STORAGE_KEY)
      .filter((entry) => safeText(entry.event_key) === workspaceState.currentEventKey)
      .sort((a, b) => safeText(b.created_at).localeCompare(safeText(a.created_at)))
      .slice(0, isMobile ? 4 : 6)
  }, [captainDecisionLogVersion, isMobile, workspaceState.currentEventKey])
  const captainDecisionLogPrimaryEntry = captainDecisionLogEntries[0] ?? {
    id: 'decision-log-empty',
    label: 'No decisions logged',
    detail: 'Copy a note, mark sent, chase replies, or log a lineup call to start the trail.',
    action: 'Start log',
    tone: 'info' as const,
    created_at: '',
  }
  const captainDecisionLogStatus = captainDecisionLogEntries.length
    ? `${captainDecisionLogEntries.length} saved`
    : 'Start log'
  const captainHandoffSheetItems = useMemo<CaptainHandoffSheetItem[]>(() => [
    {
      label: 'First action',
      state: captainMorningBriefPrimaryAction.state,
      detail: captainMorningBriefPrimaryAction.detail,
      tone: captainMorningBriefPrimaryAction.tone,
    },
    {
      label: 'Court plan',
      state: workspaceState.lineupReady ? `${workspaceState.lineupCount} courts` : 'Build lineup',
      detail: workspaceState.lineupReady
        ? safeText(captainQuickCopyLineupRows[0], 'Saved courts are ready.')
        : 'Save courts before players arrive.',
      tone: workspaceState.lineupReady ? 'good' : 'warn',
    },
    {
      label: 'Reply gaps',
      state: matchDayNotConfirmedCount > 0 ? `${matchDayNotConfirmedCount} open` : matchDayResponseRows.length ? 'Clear' : 'Collect',
      detail: matchDayNotConfirmedCount > 0
        ? 'Chase open replies before warm-up.'
        : matchDayResponseRows.length
          ? `${matchDayConfirmedCount} confirmed for this event.`
          : 'Collect In, Out, or Maybe from the roster.',
      tone: matchDayNotConfirmedCount > 0 ? 'warn' : matchDayResponseRows.length ? 'good' : 'info',
    },
    {
      label: 'Backup call',
      state: captainCourtSwapNeedsCount > 0
        ? 'Cover needed'
        : captainBenchReadyCount > 0
          ? 'Bench ready'
          : 'Review',
      detail: captainCourtSwapNeedsCount > 0
        ? `${captainCourtSwapPrimaryItem.courtLabel}: ${captainCourtSwapPrimaryItem.inPlayer}`
        : captainBenchReadyCount > 0
          ? `${captainBenchPrimaryItem.name} is the first backup call.`
          : 'Pick one backup before warm-up starts.',
      tone: captainCourtSwapNeedsCount > 0 ? 'warn' : captainBenchReadyCount > 0 ? 'good' : 'info',
    },
    {
      label: 'Decision trail',
      state: captainDecisionLogEntries.length ? `${captainDecisionLogEntries.length} saved` : 'None yet',
      detail: safeText(captainDecisionLogPrimaryEntry.detail, 'Log the last captain call before handoff.'),
      tone: captainDecisionLogEntries.length ? 'good' : 'info',
    },
  ], [
    captainBenchPrimaryItem.name,
    captainBenchReadyCount,
    captainCourtSwapNeedsCount,
    captainCourtSwapPrimaryItem.courtLabel,
    captainCourtSwapPrimaryItem.inPlayer,
    captainDecisionLogEntries.length,
    captainDecisionLogPrimaryEntry.detail,
    captainMorningBriefPrimaryAction.detail,
    captainMorningBriefPrimaryAction.state,
    captainMorningBriefPrimaryAction.tone,
    captainQuickCopyLineupRows,
    matchDayConfirmedCount,
    matchDayNotConfirmedCount,
    matchDayResponseRows.length,
    workspaceState.lineupCount,
    workspaceState.lineupReady,
  ])
  const captainHandoffReadyCount = captainHandoffSheetItems.filter((item) => item.tone === 'good').length
  const captainHandoffIssueCount = captainHandoffSheetItems.filter((item) => item.tone === 'warn').length
  const captainHandoffPrimaryItem = captainHandoffSheetItems.find((item) => item.tone === 'warn') ?? captainHandoffSheetItems[0]
  const captainHandoffSheetSummary = useMemo(() => {
    const recentCalls = captainDecisionLogEntries.slice(0, 3).map((entry) => (
      `${safeText(entry.label, 'Captain call')}: ${safeText(entry.action, 'Saved')}`
    ))

    return [
      `Captain handoff: ${weekAtGlance.eventDateLabel} vs ${weekAtGlance.opponentLabel}`,
      `Arrival: ${matchDayArrivalLabel} at ${matchDayLocationLabel}`,
      `First action: ${captainMorningBriefPrimaryAction.label} - ${captainMorningBriefPrimaryAction.state}`,
      'Lineup:',
      ...captainQuickCopyLineupRows,
      matchDayNotConfirmedCount > 0 ? `Replies: ${matchDayNotConfirmedCount} open` : matchDayResponseRows.length ? 'Replies: clear' : 'Replies: not collected',
      captainCourtSwapNeedsCount > 0
        ? `Backup: ${captainCourtSwapPrimaryItem.inPlayer} for ${captainCourtSwapPrimaryItem.courtLabel}`
        : captainBenchReadyCount > 0
          ? `Backup: ${captainBenchPrimaryItem.name}`
          : 'Backup: review bench',
      recentCalls.length ? 'Recent calls:' : '',
      ...recentCalls,
    ].filter(Boolean).join('\n')
  }, [
    captainBenchPrimaryItem.name,
    captainBenchReadyCount,
    captainCourtSwapNeedsCount,
    captainCourtSwapPrimaryItem.courtLabel,
    captainCourtSwapPrimaryItem.inPlayer,
    captainDecisionLogEntries,
    captainMorningBriefPrimaryAction.label,
    captainMorningBriefPrimaryAction.state,
    captainQuickCopyLineupRows,
    matchDayArrivalLabel,
    matchDayLocationLabel,
    matchDayNotConfirmedCount,
    matchDayResponseRows.length,
    weekAtGlance.eventDateLabel,
    weekAtGlance.opponentLabel,
  ])
  const captainHandoffPreviewLines = captainHandoffSheetSummary.split('\n').slice(0, isMobile ? 7 : 10)

  const postMatchCloseoutChecks = useMemo<CaptainCloseoutCheck[]>(() => [
    {
      label: 'Scores',
      state: workspaceState.lineupReady ? `${workspaceState.lineupCount} courts` : 'Lineup needed',
      detail: workspaceState.lineupReady
        ? 'Use the saved courts as your scorecard checklist.'
        : 'Save courts first so the scorecard has a match map.',
      tone: workspaceState.lineupReady ? 'good' : 'warn',
    },
    {
      label: 'Scorecard',
      state: postMatchUploadedState,
      detail: selectedFromCaptainScope
        ? 'Upload the scorecard when the reviewed result should update Team Hub.'
        : 'Send the scorecard through Data Assist after the match.',
      tone: selectedFromCaptainScope ? 'info' : 'warn',
    },
    {
      label: 'Recap',
      state: workspaceState.messagingReady ? 'Ready' : 'Prep note',
      detail: workspaceState.messagingReady
        ? 'Arrival and lineup context can turn into a short team recap.'
        : 'Add event details before sending the final team note.',
      tone: workspaceState.messagingReady ? 'good' : 'info',
    },
    {
      label: 'Week status',
      state: postMatchClosed ? 'Closed' : 'Open',
      detail: postMatchClosed
        ? 'This week is marked finalized in Captain.'
        : 'Mark it closed after the result and scorecard are handled.',
      tone: postMatchClosed ? 'good' : 'info',
    },
  ], [
    postMatchClosed,
    postMatchUploadedState,
    selectedFromCaptainScope,
    workspaceState.lineupCount,
    workspaceState.lineupReady,
    workspaceState.messagingReady,
  ])
  const captainPostMatchRecapIssueRows = captainScoreCaptureRows.filter((row) => row.status === 'issue').slice(0, isMobile ? 2 : 3)
  const captainPostMatchRecapCompleteRows = captainScoreCaptureRows.filter((row) => row.status === 'complete' || row.status === 'score-captured')
  const captainPostMatchRecapRecentDecisions = captainDecisionLogEntries.slice(0, isMobile ? 2 : 3)
  const captainPostMatchRecapPrimaryState = captainScoreCaptureRows.length
    ? captainScoreCaptureIssueCount > 0
      ? `${captainScoreCaptureIssueCount} issue`
      : captainScoreCapturePendingCount > 0
        ? `${captainScoreCapturePendingCount} open`
        : 'Ready recap'
    : 'Needs scores'
  const captainPostMatchRecapTone = captainScoreCaptureIssueCount > 0
    ? 'warn'
    : captainScoreCaptureRows.length && captainScoreCapturePendingCount === 0
      ? 'good'
      : 'info'
  const captainPostMatchRecapSummary = useMemo(() => {
    const capturedLine = captainScoreCaptureRows.length
      ? `Scores: ${captainScoreCaptureLoggedCount}/${captainScoreCaptureRows.length} courts captured`
      : 'Scores: courts not saved yet'
    const issueLine = captainScoreCaptureIssueCount > 0
      ? `Issues: ${captainPostMatchRecapIssueRows.map((row) => row.courtLabel).join(', ')}`
      : 'Issues: none noted in Captain'
    const decisionLines = captainPostMatchRecapRecentDecisions.map((entry) => (
      `Captain call: ${safeText(entry.label, 'Decision')} - ${safeText(entry.action, 'Saved')}`
    ))

    return [
      `Team recap: ${weekAtGlance.eventDateLabel} vs ${weekAtGlance.opponentLabel}`,
      capturedLine,
      issueLine,
      captainScoreCapturePendingCount > 0 ? `Open: ${captainScoreCapturePendingCount} court${captainScoreCapturePendingCount === 1 ? '' : 's'} still need score capture.` : 'Open: score capture is clear.',
      captainPostMatchRecapCompleteRows.length ? `Captured courts: ${captainPostMatchRecapCompleteRows.slice(0, isMobile ? 3 : 5).map((row) => row.courtLabel).join(', ')}` : '',
      decisionLines.length ? 'Recent captain trail:' : '',
      ...decisionLines,
      postMatchClosed ? 'Week status: closed.' : 'Next: upload the scorecard and mark the week closed.',
    ].filter(Boolean).join('\n')
  }, [
    captainPostMatchRecapCompleteRows,
    captainPostMatchRecapIssueRows,
    captainPostMatchRecapRecentDecisions,
    captainScoreCaptureIssueCount,
    captainScoreCaptureLoggedCount,
    captainScoreCapturePendingCount,
    captainScoreCaptureRows.length,
    isMobile,
    postMatchClosed,
    weekAtGlance.eventDateLabel,
    weekAtGlance.opponentLabel,
  ])
  const captainPostMatchRecapPreviewLines = captainPostMatchRecapSummary.split('\n').slice(0, isMobile ? 6 : 8)

  const captainSaveSignals = useMemo<CaptainSaveSignal[]>(() => [
    {
      label: 'Team scope',
      state: hasTeamScope ? 'Remembered locally' : 'Not set',
      detail: hasTeamScope
        ? 'This browser remembers the selected team week so the hub can resume the same captain lane.'
        : 'Choose a team before lineup, notes, and message prep can attach to a week.',
      tone: hasTeamScope ? 'good' : 'info',
    },
    {
      label: 'Week work',
      state: workspaceState.briefReady ? 'Saved here' : 'Not saved yet',
      detail: workspaceState.briefReady
        ? 'Lineups, event notes, response status, and week status are saved in this browser.'
        : 'Lineup and message prep will appear here after this browser saves weekly context.',
      tone: workspaceState.briefReady ? 'warn' : 'info',
    },
    {
      label: 'Team history',
      state: selectedFromCaptainScope ? 'Linked context' : 'Needs data',
      detail: selectedFromCaptainScope
        ? `Roster and schedule scope comes from ${selectedCaptainScopeSourceLabel}. Data Assist can refresh it after review.`
        : 'Use a linked player profile, roster history, or reviewed Data Assist upload for team context.',
      tone: selectedFromCaptainScope ? 'good' : 'warn',
    },
  ], [hasTeamScope, selectedCaptainScopeSourceLabel, selectedFromCaptainScope, workspaceState.briefReady])

  const captainDecisionHandoffProof = useMemo(() => CAPTAIN_DECISION_HANDOFF_PROOF_STEPS.map((step) => {
    if (step.label === 'Availability') {
      return {
        ...step,
        state: workspaceState.pendingResponseCount > 0 ? `${workspaceState.pendingResponseCount} waiting` : 'Clear',
        tone: workspaceState.pendingResponseCount > 0 ? 'warn' : 'good',
      }
    }

    if (step.label === 'Lineup option') {
      return {
        ...step,
        state: workspaceState.lineupReady ? `${workspaceState.lineupCount} saved` : 'Draft needed',
        tone: workspaceState.lineupReady ? 'good' : 'info',
      }
    }

    if (step.label === 'Scenario check') {
      return {
        ...step,
        state: workspaceState.scenarioReady || matches.length > 0 ? 'Available' : 'Needs match context',
        tone: workspaceState.scenarioReady || matches.length > 0 ? 'good' : 'info',
      }
    }

    return {
      ...step,
      state: workspaceState.messagingReady || workspaceState.briefReady ? 'Ready' : 'Needs lineup or event details',
      tone: workspaceState.messagingReady || workspaceState.briefReady ? 'good' : 'warn',
    }
  }), [
    matches.length,
    workspaceState.briefReady,
    workspaceState.lineupCount,
    workspaceState.lineupReady,
    workspaceState.messagingReady,
    workspaceState.pendingResponseCount,
    workspaceState.scenarioReady,
  ])

  const captainReadinessChecks = useMemo(() => [
    {
      label: 'Team scope',
      complete: hasTeamScope,
      href: '#captain-team-scope',
      stage: 'team' as CaptainResumeStage,
      cta: 'Choose team',
    },
    {
      label: 'Availability',
      complete: workspaceState.pendingResponseCount === 0,
      href: availabilityHref,
      stage: 'availability' as CaptainResumeStage,
      cta: 'Review availability',
    },
    {
      label: 'Projection',
      complete: matches.length > 0,
      href: lineupProjectionHref,
      stage: 'projection' as CaptainResumeStage,
      cta: 'Open projection',
    },
    {
      label: 'Lineup',
      complete: workspaceState.lineupReady,
      href: lineupBuilderHref,
      stage: 'lineup' as CaptainResumeStage,
      cta: 'Build lineup',
    },
    {
      label: 'Message',
      complete: workspaceState.messagingReady,
      href: messagingHref,
      stage: 'messaging' as CaptainResumeStage,
      cta: 'Prep message',
    },
  ], [
    availabilityHref,
    hasTeamScope,
    lineupBuilderHref,
    lineupProjectionHref,
    matches.length,
    messagingHref,
    workspaceState.lineupReady,
    workspaceState.messagingReady,
    workspaceState.pendingResponseCount,
  ])
  const captainReadinessCompleteCount = captainReadinessChecks.filter((item) => item.complete).length
  const captainReadinessScore = Math.round((captainReadinessCompleteCount / captainReadinessChecks.length) * 100)
  const captainReadinessNext = captainReadinessChecks.find((item) => !item.complete) || captainReadinessChecks[captainReadinessChecks.length - 1]

  const captainPrimaryAction = captainReadinessScore < 100 ? {
    title: captainReadinessNext.label === 'Team scope' ? 'Choose the team week' : nextAction.title,
    detail: captainReadinessNext.label === 'Team scope'
      ? 'Pick the team, league, and flight first so Captain can scope lineup, availability, and messaging.'
      : nextAction.detail,
    href: captainReadinessNext.href,
    stage: captainReadinessNext.stage,
    cta: captainReadinessNext.cta,
    tone: captainReadinessNext.label === 'Team scope' ? 'info' as const : nextAction.tone,
  } : {
    ...nextAction,
    stage: 'brief' as CaptainResumeStage,
  }

  const captainSeasonLaunchItems = useMemo<CaptainSeasonLaunchItem[]>(() => [
    {
      label: 'Roster',
      state: roster.length > 0 ? `${roster.length} players` : 'Needs roster',
      detail: roster.length > 0
        ? `${rosterSignalSummary.withStatus} rating read${rosterSignalSummary.withStatus === 1 ? '' : 's'} ready for lineup calls.`
        : 'Refresh roster source files before the first availability ask.',
      href: roster.length > 0 ? currentTeamHref : dataAssistCaptainHref,
      stage: roster.length > 0 ? 'team' : 'team',
      cta: roster.length > 0 ? 'Review roster' : 'Refresh roster',
      tone: roster.length > 0 ? 'good' : 'warn',
    },
    {
      label: 'Schedule',
      state: matches.length > 0 ? `${matches.length} matches` : 'Needs schedule',
      detail: matches.length > 0
        ? `Next up: ${weekAtGlance.eventDateLabel} vs ${weekAtGlance.opponentLabel}.`
        : 'Upload or connect the schedule so week one has an opponent and date.',
      href: matches.length > 0 ? weeklyBriefHref : dataAssistCaptainHref,
      stage: matches.length > 0 ? 'brief' : 'team',
      cta: matches.length > 0 ? 'Open brief' : 'Add schedule',
      tone: matches.length > 0 ? 'good' : 'warn',
    },
    {
      label: 'Rating watch',
      state: rosterSignalSummary.atRisk > 0 ? `${rosterSignalSummary.atRisk} watch` : rosterSignalSummary.trendingUp > 0 ? `${rosterSignalSummary.trendingUp} rising` : 'Set baseline',
      detail: rosterSignalSummary.withStatus > 0
        ? 'Use rating direction before you lock early-season court order.'
        : 'Refresh player ratings so early lineups are not built on memory.',
      href: analyticsHref,
      stage: 'analytics',
      cta: 'Open analytics',
      tone: rosterSignalSummary.atRisk > 0 ? 'warn' : rosterSignalSummary.withStatus > 0 ? 'good' : 'info',
    },
    {
      label: 'Week one',
      state: workspaceState.lineupReady ? 'Lineup started' : workspaceState.pendingResponseCount > 0 ? `${workspaceState.pendingResponseCount} waiting` : 'Start rhythm',
      detail: workspaceState.lineupReady
        ? 'You already have saved courts to refine for the opener.'
        : 'Start the availability habit before lineup week gets noisy.',
      href: workspaceState.lineupReady ? lineupBuilderHref : availabilityHref,
      stage: workspaceState.lineupReady ? 'lineup' : 'availability',
      cta: workspaceState.lineupReady ? 'Review lineup' : 'Ask availability',
      tone: workspaceState.lineupReady ? 'good' : workspaceState.pendingResponseCount > 0 ? 'warn' : 'info',
    },
  ], [
    analyticsHref,
    availabilityHref,
    currentTeamHref,
    lineupBuilderHref,
    matches.length,
    roster.length,
    rosterSignalSummary.atRisk,
    rosterSignalSummary.trendingUp,
    rosterSignalSummary.withStatus,
    weekAtGlance.eventDateLabel,
    weekAtGlance.opponentLabel,
    weeklyBriefHref,
    workspaceState.lineupReady,
    workspaceState.pendingResponseCount,
  ])
  const captainSeasonLaunchReadyCount = captainSeasonLaunchItems.filter((item) => item.tone === 'good').length

  const opponentScoutNoteReady = opponentScoutNotes.trim().length > 0
  const opponentScoutHomeAwayLabel = nextMatch ? (nextMatch.home ? 'Home' : 'Away') : 'Venue TBD'
  const opponentScoutChecks = useMemo<CaptainOpponentScoutItem[]>(() => [
    {
      label: 'Opponent',
      state: weekAtGlance.opponentLabel === 'Opponent not set' ? 'Needs opponent' : weekAtGlance.opponentLabel,
      detail: weekAtGlance.opponentLabel === 'Opponent not set'
        ? 'Add schedule context before making the matchup call.'
        : `Scout ${weekAtGlance.opponentLabel} before you lock court order.`,
      tone: weekAtGlance.opponentLabel === 'Opponent not set' ? 'warn' : 'good',
    },
    {
      label: 'Venue',
      state: opponentScoutHomeAwayLabel,
      detail: nextMatch?.facility
        ? `${nextMatch.facility}${nextMatch.time ? ` - ${nextMatch.time}` : ''}`
        : 'Add site and time so the team note has the match-day details.',
      tone: nextMatch?.facility || nextMatch?.time ? 'good' : 'info',
    },
    {
      label: 'Notes',
      state: opponentScoutNoteReady ? 'Saved' : 'Add notes',
      detail: opponentScoutNoteReady
        ? 'Opponent notes are ready for the weekly brief.'
        : 'Capture tendencies, likely pairings, and matchup traps before lineup work.',
      tone: opponentScoutNoteReady ? 'good' : 'info',
    },
    {
      label: 'Pairing read',
      state: pairings.length > 0 ? `${pairings.length} pairs` : 'Needs evidence',
      detail: pairings.length > 0
        ? `Best saved pair win rate: ${quickStats.topPairWinPct}.`
        : 'Upload scorecards or review match history before choosing doubles pairs.',
      tone: pairings.length > 0 ? 'good' : 'warn',
    },
  ], [
    nextMatch?.facility,
    nextMatch?.time,
    opponentScoutHomeAwayLabel,
    opponentScoutNoteReady,
    pairings.length,
    quickStats.topPairWinPct,
    weekAtGlance.opponentLabel,
  ])
  const opponentScoutReadyCount = opponentScoutChecks.filter((item) => item.tone === 'good').length

  const captainCommandSnapshots = [
    {
      label: 'Match',
      value: weekAtGlance.eventDateLabel,
      detail: weekAtGlance.opponentLabel,
    },
    {
      label: 'Scope',
      value: selectedTeam || 'Choose team',
      detail: weekAtGlance.scopeLabel,
    },
    {
      label: 'Readiness',
      value: `${captainReadinessScore}%`,
      detail: `${captainReadinessCompleteCount} of ${captainReadinessChecks.length} checks ready`,
    },
    {
      label: 'Next',
      value: captainPrimaryAction.cta,
      detail: captainPrimaryAction.title,
    },
  ]

  const captainDecisionPath = useMemo<CaptainDecisionPath[]>(() => [
    {
      label: 'Availability',
      question: 'Who is available?',
      answer: workspaceState.pendingResponseCount > 0
        ? `${workspaceState.pendingResponseCount} player${workspaceState.pendingResponseCount === 1 ? '' : 's'} still need a clean answer.`
        : 'Review who is in, out, maybe, or still needs a follow-up.',
      href: availabilityHref,
      stage: 'availability',
      cta: 'Check Availability',
      icon: 'schedule',
      tone: workspaceState.pendingResponseCount > 0 ? 'warn' : 'good',
      requiresScope: true,
    },
    {
      label: 'Lineup',
      question: 'What lineup gives us the best chance?',
      answer: workspaceState.lineupReady
        ? `${workspaceState.lineupCount} court${workspaceState.lineupCount === 1 ? '' : 's'} already saved for the week.`
        : 'Build the lineup from availability, player fit, and opponent context.',
      href: lineupBuilderHref,
      stage: 'lineup',
      cta: 'Build Lineup',
      icon: 'lineupBuilder',
      tone: workspaceState.lineupReady ? 'good' : 'info',
      requiresScope: true,
    },
    {
      label: 'Pairings',
      question: 'Who should play together?',
      answer: matches.length > 0
        ? 'Use projection and scenario reads before you lock doubles pairings.'
        : 'Add match context so pairings have more than guesswork behind them.',
      href: lineupProjectionHref,
      stage: 'projection',
      cta: 'Check Pairings',
      icon: 'scenarioBuilder',
      tone: matches.length > 0 ? 'good' : 'info',
      requiresScope: true,
    },
    {
      label: 'Message',
      question: 'What should I communicate?',
      answer: workspaceState.messagingReady
        ? 'Your team note has enough event and lineup context to send.'
        : 'Turn the saved lineup into a simple team update and follow-up list.',
      href: messagingHref,
      stage: 'messaging',
      cta: 'Message Team',
      icon: 'messagingCenter',
      tone: workspaceState.messagingReady ? 'good' : 'warn',
      requiresScope: true,
    },
    {
      label: 'Scorecard',
      question: 'What needs to be cleaned up?',
      answer: 'Upload scorecards, schedules, or roster source files when team context is missing or stale.',
      href: dataAssistCaptainHref,
      stage: 'team',
      cta: 'Track Scorecard',
      icon: 'reports',
      tone: 'info',
    },
  ], [
    availabilityHref,
    lineupBuilderHref,
    lineupProjectionHref,
    matches.length,
    messagingHref,
    workspaceState.lineupCount,
    workspaceState.lineupReady,
    workspaceState.messagingReady,
    workspaceState.pendingResponseCount,
  ])

  function handleCaptainAction(href: string, stage: CaptainResumeStage) {
    if (href.startsWith('#')) {
      document.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    handleCaptainNav(href, stage)
  }

  function rememberCaptainResume(stage: CaptainResumeStage) {
    writeCaptainResumeState({
      competitionLayer: selectedCompetitionLayer || undefined,
      team: selectedTeam,
      league: selectedLeague,
      flight: selectedFlight,
      lastTool:
        stage === 'lineup'
          ? 'lineup-builder'
          : stage === 'projection'
            ? 'lineup-projection'
          : stage === 'scenario'
            ? 'scenario-builder'
            : stage === 'messaging'
              ? 'messaging'
              : stage === 'analytics'
                ? 'analytics'
                : stage === 'availability'
                  ? 'availability'
                  : stage === 'brief'
                    ? 'weekly-brief'
                    : stage === 'season-dashboard'
                      ? 'season-dashboard'
                      : stage === 'tiq-team-matches'
                        ? 'tiq-team-matches'
                        : 'hub',
      lastToolLabel:
        stage === 'lineup'
          ? 'Lineup Builder'
          : stage === 'projection'
            ? 'Lineup Projection'
          : stage === 'scenario'
            ? 'Scenario Builder'
            : stage === 'messaging'
              ? 'Messaging'
              : stage === 'analytics'
                ? 'Captain IQ'
                : stage === 'availability'
                  ? 'Availability'
                  : stage === 'brief'
                    ? 'Weekly Brief'
                    : stage === 'season-dashboard'
                      ? 'League Office'
                      : stage === 'tiq-team-matches'
                        ? 'Team Match Results'
                        : 'Captain',
    })
  }

  function handleCaptainNav(
    href: string,
    stage: CaptainResumeStage,
  ) {
    const leagueCoordinatorStage = stage === 'season-dashboard' || stage === 'tiq-team-matches'
    if (!premiumEnabled && !leagueCoordinatorStage) {
      router.push(captainUnlockHref)
      return
    }

    rememberCaptainResume(stage)
    router.push(href)
  }

  function appendCaptainDecisionLog(entry: Omit<CaptainDecisionLogEntry, 'id' | 'event_key' | 'created_at'>) {
    if (typeof window === 'undefined' || !workspaceState.currentEventKey) return

    const now = new Date().toISOString()
    const rows = readLocalArray<CaptainDecisionLogEntry>(CAPTAIN_DECISION_LOG_STORAGE_KEY)
    const nextEntry: CaptainDecisionLogEntry = {
      ...entry,
      id: `captain-decision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      event_key: workspaceState.currentEventKey,
      created_at: now,
    }
    const nextRows = [
      nextEntry,
      ...rows.filter((row) => safeText(row.id) !== safeText(nextEntry.id)),
    ].slice(0, 80)

    window.localStorage.setItem(CAPTAIN_DECISION_LOG_STORAGE_KEY, JSON.stringify(nextRows))
    setCaptainDecisionLogVersion((value) => value + 1)
  }

  function handleLogCaptainDecision(kind: 'lineup' | 'reply' | 'backup') {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    if (kind === 'lineup') {
      appendCaptainDecisionLog({
        label: 'Lineup call',
        detail: workspaceState.lineupReady
          ? `${workspaceState.lineupCount} courts saved for ${weekAtGlance.eventDateLabel}.`
          : 'Lineup still needs a saved court plan.',
        action: workspaceState.lineupReady ? 'Courts reviewed' : 'Build lineup',
        tone: workspaceState.lineupReady ? 'good' : 'warn',
      })
      return
    }

    if (kind === 'reply') {
      appendCaptainDecisionLog({
        label: 'Reply chase',
        detail: matchDayNotConfirmedCount > 0
          ? `${matchDayNotConfirmedCount} open replies still need attention.`
          : 'No open reply chase is saved right now.',
        action: matchDayNotConfirmedCount > 0 ? 'Chase replies' : 'Replies clear',
        tone: matchDayNotConfirmedCount > 0 ? 'warn' : 'good',
      })
      return
    }

    appendCaptainDecisionLog({
      label: 'Backup call',
      detail: captainCourtSwapNeedsCount > 0
        ? `${captainCourtSwapPrimaryItem.inPlayer} is the cover option for ${captainCourtSwapPrimaryItem.courtLabel}.`
        : captainBenchReadyCount > 0
          ? `${captainBenchPrimaryItem.name} is the first bench read.`
          : 'Backup coverage still needs review.',
      action: captainCourtSwapNeedsCount > 0 ? 'Cover needed' : captainBenchReadyCount > 0 ? 'Bench ready' : 'Review bench',
      tone: captainCourtSwapNeedsCount > 0 ? 'warn' : captainBenchReadyCount > 0 ? 'good' : 'info',
    })
  }

  function handleCaptainScoreCapture(row: CaptainLineupAssignment, index: number, status: CaptainScoreCaptureStatus) {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    if (typeof window === 'undefined' || !workspaceState.currentEventKey) return

    const courtLabel = safeText(row.court_label, `Court ${index + 1}`)
    const courtKey = safeText(row.id, safeKey(`${courtLabel}-${index}`))
    const playerLabel = row.players?.filter(Boolean).join(' / ') || 'Players not set'
    const now = new Date().toISOString()
    const statusLabel = status === 'complete'
      ? 'Complete'
      : status === 'score-captured'
        ? 'Score captured'
        : status === 'issue'
          ? 'Issue noted'
          : 'Needs score'
    const rows = readLocalArray<CaptainScoreCaptureEntry>(CAPTAIN_SCORE_CAPTURE_STORAGE_KEY)
    const nextEntry: CaptainScoreCaptureEntry = {
      id: `captain-score-${workspaceState.currentEventKey}-${courtKey}`,
      event_key: workspaceState.currentEventKey,
      court_key: courtKey,
      court_label: courtLabel,
      players: playerLabel,
      status,
      updated_at: now,
    }
    const nextRows = [
      nextEntry,
      ...rows.filter((entry) => !(
        safeText(entry.event_key) === workspaceState.currentEventKey &&
        safeText(entry.court_key) === courtKey
      )),
    ].slice(0, 120)

    window.localStorage.setItem(CAPTAIN_SCORE_CAPTURE_STORAGE_KEY, JSON.stringify(nextRows))
    setCaptainScoreCaptureVersion((value) => value + 1)
    appendCaptainDecisionLog({
      label: 'Score capture updated',
      detail: `${courtLabel}: ${statusLabel.toLowerCase()} for ${playerLabel}.`,
      action: statusLabel,
      tone: status === 'issue' ? 'warn' : status === 'pending' ? 'info' : 'good',
    })
  }

  async function handleCopyCaptainNudge(draft: CaptainNudgeDraft) {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard) return

    try {
      await navigator.clipboard.writeText(draft.body)
      setCopiedCaptainNudgeLabel(draft.label)
    } catch {
      setCopiedCaptainNudgeLabel('')
    }
  }

  async function handleCopyCaptainLineupSummary() {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard) return

    try {
      await navigator.clipboard.writeText(captainQuickCopySummary)
      setCopiedCaptainLineupSummary(true)
      appendCaptainDecisionLog({
        label: 'Lineup note copied',
        detail: `${captainQuickCopyLineupRows.length} lineup line${captainQuickCopyLineupRows.length === 1 ? '' : 's'} copied for the team note.`,
        action: 'Copy lineup',
        tone: workspaceState.lineupReady ? 'good' : 'warn',
      })
    } catch {
      setCopiedCaptainLineupSummary(false)
    }
  }

  async function handleCopyCaptainReplyReminder(template: CaptainReplyReminderTemplate) {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    if (!template.body || typeof navigator === 'undefined' || !navigator.clipboard) return

    try {
      await navigator.clipboard.writeText(template.body)
      setCopiedCaptainReplyReminderId(template.id)
      appendCaptainDecisionLog({
        label: 'Reply reminder copied',
        detail: template.detail,
        action: template.label,
        tone: template.tone,
      })
    } catch {
      setCopiedCaptainReplyReminderId('')
    }
  }

  async function handleCopyCaptainSendQueueItem(item: CaptainSendQueueItem) {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    if (!item.body || typeof navigator === 'undefined' || !navigator.clipboard) return

    try {
      await navigator.clipboard.writeText(item.body)
      setCopiedCaptainSendQueueId(item.id)
      appendCaptainDecisionLog({
        label: `${item.label} copied`,
        detail: item.detail,
        action: item.state,
        tone: item.tone,
      })
    } catch {
      setCopiedCaptainSendQueueId('')
    }
  }

  async function handleCopyCaptainHandoffSheet() {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard) return

    try {
      await navigator.clipboard.writeText(captainHandoffSheetSummary)
      setCopiedCaptainHandoffSheet(true)
      appendCaptainDecisionLog({
        label: 'Handoff sheet copied',
        detail: captainHandoffIssueCount > 0
          ? `${captainHandoffIssueCount} handoff item${captainHandoffIssueCount === 1 ? '' : 's'} still need attention.`
          : 'Match-day handoff copied with no warning items.',
        action: 'Copy handoff',
        tone: captainHandoffIssueCount > 0 ? 'warn' : 'good',
      })
    } catch {
      setCopiedCaptainHandoffSheet(false)
    }
  }

  async function handleCopyCaptainPostMatchRecap() {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard) return

    try {
      await navigator.clipboard.writeText(captainPostMatchRecapSummary)
      setCopiedCaptainPostMatchRecap(true)
      appendCaptainDecisionLog({
        label: 'Post-match recap copied',
        detail: captainScoreCaptureIssueCount > 0
          ? `${captainScoreCaptureIssueCount} score capture issue${captainScoreCaptureIssueCount === 1 ? '' : 's'} included in the recap.`
          : 'Team recap copied from the score capture checklist.',
        action: 'Copy recap',
        tone: captainScoreCaptureIssueCount > 0 ? 'warn' : 'good',
      })
    } catch {
      setCopiedCaptainPostMatchRecap(false)
    }
  }

  async function handleCopyCaptainEmergencyMode() {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard) return

    try {
      await navigator.clipboard.writeText(captainEmergencyModeMessage)
      setCopiedCaptainEmergencyMode(true)
      appendCaptainDecisionLog({
        label: 'Emergency note copied',
        detail: captainEmergencyAlertCount > 0
          ? `${captainEmergencyAlertCount} late-change alert${captainEmergencyAlertCount === 1 ? '' : 's'} included.`
          : 'Emergency standby note copied.',
        action: 'Copy emergency',
        tone: captainEmergencyAlertCount > 0 ? 'warn' : 'good',
      })
    } catch {
      setCopiedCaptainEmergencyMode(false)
    }
  }

  function writeCaptainChangeAckEntries(targets: CaptainChangeAckTarget[], status: 'pending' | 'acknowledged') {
    if (typeof window === 'undefined' || !workspaceState.currentEventKey || !targets.length) return

    const now = new Date().toISOString()
    const targetIds = new Set(targets.map((target) => target.id))
    const rows = readLocalArray<CaptainChangeAckEntry>(CAPTAIN_CHANGE_ACK_STORAGE_KEY)
    const nextEntries: CaptainChangeAckEntry[] = targets.map((target) => ({
      id: `captain-change-ack-${workspaceState.currentEventKey}-${target.id}`,
      event_key: workspaceState.currentEventKey,
      target_key: target.id,
      name: target.name,
      status,
      updated_at: now,
    }))
    const nextRows = [
      ...nextEntries,
      ...rows.filter((entry) => !(
        safeText(entry.event_key) === workspaceState.currentEventKey &&
        targetIds.has(safeText(entry.target_key))
      )),
    ].slice(0, 160)

    window.localStorage.setItem(CAPTAIN_CHANGE_ACK_STORAGE_KEY, JSON.stringify(nextRows))
    setCaptainChangeAckVersion((value) => value + 1)
  }

  function handleCaptainChangeAck(target: CaptainChangeAckTarget) {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    const nextStatus = target.status === 'acknowledged' ? 'pending' : 'acknowledged'
    writeCaptainChangeAckEntries([target], nextStatus)
    appendCaptainDecisionLog({
      label: 'Change confirmation',
      detail: `${target.name} marked ${nextStatus === 'acknowledged' ? 'acknowledged' : 'waiting'} for ${target.court}.`,
      action: nextStatus === 'acknowledged' ? 'Acked' : 'Waiting',
      tone: nextStatus === 'acknowledged' ? 'good' : 'info',
    })
  }

  function handleMarkAllCaptainChangeAck() {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    const pendingTargets = captainChangeAckTargets.filter((target) => target.status === 'pending')
    if (!pendingTargets.length) return

    writeCaptainChangeAckEntries(pendingTargets, 'acknowledged')
    appendCaptainDecisionLog({
      label: 'Change confirmations closed',
      detail: `${pendingTargets.length} pending confirmation${pendingTargets.length === 1 ? '' : 's'} marked acknowledged.`,
      action: 'All acked',
      tone: 'good',
    })
  }

  async function handleCopyCaptainChangeAckChase() {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    if (!captainChangeAckTargets.length || typeof navigator === 'undefined' || !navigator.clipboard) return

    try {
      await navigator.clipboard.writeText(captainChangeAckChaseMessage)
      setCopiedCaptainChangeAckChase(true)
      appendCaptainDecisionLog({
        label: 'Ack chase copied',
        detail: captainChangeAckPendingCount > 0
          ? `${captainChangeAckPendingCount} player${captainChangeAckPendingCount === 1 ? '' : 's'} still need to acknowledge the late change.`
          : 'Confirmation chase copied after all visible players acknowledged.',
        action: 'Copy ack chase',
        tone: captainChangeAckPendingCount > 0 ? 'warn' : 'good',
      })
    } catch {
      setCopiedCaptainChangeAckChase(false)
    }
  }

  function writeCaptainArrivalRiskEntries(targets: CaptainArrivalRiskTarget[], status: CaptainArrivalRiskStatus) {
    if (typeof window === 'undefined' || !workspaceState.currentEventKey || !targets.length) return

    const now = new Date().toISOString()
    const targetIds = new Set(targets.map((target) => target.id))
    const rows = readLocalArray<CaptainArrivalRiskEntry>(CAPTAIN_ARRIVAL_RISK_STORAGE_KEY)
    const nextEntries: CaptainArrivalRiskEntry[] = targets.map((target) => ({
      id: `captain-arrival-risk-${workspaceState.currentEventKey}-${target.id}`,
      event_key: workspaceState.currentEventKey,
      target_key: target.id,
      name: target.name,
      status,
      updated_at: now,
    }))
    const nextRows = [
      ...nextEntries,
      ...rows.filter((entry) => !(
        safeText(entry.event_key) === workspaceState.currentEventKey &&
        targetIds.has(safeText(entry.target_key))
      )),
    ].slice(0, 180)

    window.localStorage.setItem(CAPTAIN_ARRIVAL_RISK_STORAGE_KEY, JSON.stringify(nextRows))
    setCaptainArrivalRiskVersion((value) => value + 1)
  }

  function handleCaptainArrivalRiskStatus(target: CaptainArrivalRiskTarget, status: CaptainArrivalRiskStatus) {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    writeCaptainArrivalRiskEntries([target], status)
    appendCaptainDecisionLog({
      label: 'Arrival status updated',
      detail: `${target.name} marked ${status === 'on-time' ? 'on time' : status === 'running-late' ? 'running late' : status === 'backup-ready' ? 'backup ready' : 'ETA needed'} for ${target.court}.`,
      action: status === 'on-time' ? 'On time' : status === 'running-late' ? 'Late' : status === 'backup-ready' ? 'Backup ready' : 'ETA needed',
      tone: status === 'running-late' ? 'warn' : status === 'eta-needed' ? 'info' : 'good',
    })
  }

  function handleMarkAllCaptainArrivalOnTime() {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    const openTargets = captainArrivalRiskTargets.filter((target) => target.status !== 'on-time' && target.status !== 'backup-ready')
    if (!openTargets.length) return

    writeCaptainArrivalRiskEntries(openTargets, 'on-time')
    appendCaptainDecisionLog({
      label: 'Arrival watch cleared',
      detail: `${openTargets.length} arrival watch target${openTargets.length === 1 ? '' : 's'} marked on time.`,
      action: 'Arrival clear',
      tone: 'good',
    })
  }

  async function handleCopyCaptainArrivalRiskMessage() {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    if (!captainArrivalRiskTargets.length || typeof navigator === 'undefined' || !navigator.clipboard) return

    try {
      await navigator.clipboard.writeText(captainArrivalRiskMessage)
      setCopiedCaptainArrivalRiskMessage(true)
      appendCaptainDecisionLog({
        label: 'ETA chase copied',
        detail: captainArrivalRiskWatchCount > 0
          ? `${captainArrivalRiskWatchCount} arrival watch target${captainArrivalRiskWatchCount === 1 ? '' : 's'} included.`
          : 'Arrival status message copied with no open watch targets.',
        action: 'Copy ETA',
        tone: captainArrivalRiskWatchCount > 0 ? 'warn' : 'good',
      })
    } catch {
      setCopiedCaptainArrivalRiskMessage(false)
    }
  }

  function writeCaptainCourtHandoffEntry(item: CaptainCourtHandoffItem, status: CaptainCourtHandoffStatus) {
    if (typeof window === 'undefined' || !workspaceState.currentEventKey) return

    const now = new Date().toISOString()
    const rows = readLocalArray<CaptainCourtHandoffEntry>(CAPTAIN_COURT_HANDOFF_STORAGE_KEY)
    const nextEntry: CaptainCourtHandoffEntry = {
      id: `captain-court-handoff-${workspaceState.currentEventKey}-${item.courtKey}`,
      event_key: workspaceState.currentEventKey,
      court_key: item.courtKey,
      court_label: item.courtLabel,
      status,
      updated_at: now,
    }
    const nextRows = [
      nextEntry,
      ...rows.filter((entry) => !(
        safeText(entry.event_key) === workspaceState.currentEventKey &&
        safeText(entry.court_key) === item.courtKey
      )),
    ].slice(0, 180)

    window.localStorage.setItem(CAPTAIN_COURT_HANDOFF_STORAGE_KEY, JSON.stringify(nextRows))
    setCaptainCourtHandoffVersion((value) => value + 1)
  }

  function handleCaptainCourtHandoffStatus(item: CaptainCourtHandoffItem, status: CaptainCourtHandoffStatus) {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    writeCaptainCourtHandoffEntry(item, status)
    appendCaptainDecisionLog({
      label: 'Court handoff updated',
      detail: `${item.courtLabel} marked ${status === 'ready' ? 'ready for handoff' : status === 'warmup' ? 'in warm-up' : 'in prep'} for ${item.players}.`,
      action: status === 'ready' ? 'Ready' : status === 'warmup' ? 'Warm-up' : 'Prep',
      tone: status === 'ready' ? 'good' : status === 'prep' && item.tone === 'warn' ? 'warn' : 'info',
    })
  }

  function handleMarkCaptainCourtHandoffReady() {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    const openItems = captainCourtHandoffItems.filter((item) => item.status !== 'ready' && item.tone !== 'warn')
    if (!openItems.length) return

    openItems.forEach((item) => writeCaptainCourtHandoffEntry(item, 'ready'))
    appendCaptainDecisionLog({
      label: 'Court handoff ready',
      detail: `${openItems.length} court${openItems.length === 1 ? '' : 's'} marked ready for handoff.`,
      action: 'Ready courts',
      tone: 'good',
    })
  }

  async function handleCopyCaptainCourtHandoff() {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    if (!captainCourtHandoffItems.length || typeof navigator === 'undefined' || !navigator.clipboard) return

    try {
      await navigator.clipboard.writeText(captainCourtHandoffMessage)
      setCopiedCaptainCourtHandoff(true)
      appendCaptainDecisionLog({
        label: 'Court handoff copied',
        detail: captainCourtHandoffWatchCount > 0
          ? `${captainCourtHandoffWatchCount} court handoff hold${captainCourtHandoffWatchCount === 1 ? '' : 's'} included.`
          : 'Court handoff copied with no hold items.',
        action: 'Copy handoff',
        tone: captainCourtHandoffWatchCount > 0 ? 'warn' : 'good',
      })
    } catch {
      setCopiedCaptainCourtHandoff(false)
    }
  }

  function writeCaptainNotificationQueueEntry(item: CaptainNotificationQueueItem, status: CaptainNotificationQueueStatus) {
    if (typeof window === 'undefined' || !workspaceState.currentEventKey) return

    const now = new Date().toISOString()
    const rows = readLocalArray<CaptainNotificationQueueEntry>(CAPTAIN_NOTIFICATION_QUEUE_STORAGE_KEY)
    const nextEntry: CaptainNotificationQueueEntry = {
      id: `captain-notification-${workspaceState.currentEventKey}-${item.id}`,
      event_key: workspaceState.currentEventKey,
      item_key: item.id,
      label: item.label,
      status,
      updated_at: now,
    }
    const nextRows = [
      nextEntry,
      ...rows.filter((entry) => !(
        safeText(entry.event_key) === workspaceState.currentEventKey &&
        safeText(entry.item_key) === item.id
      )),
    ].slice(0, 180)

    window.localStorage.setItem(CAPTAIN_NOTIFICATION_QUEUE_STORAGE_KEY, JSON.stringify(nextRows))
    setCaptainNotificationQueueVersion((value) => value + 1)
  }

  function handleCaptainNotificationQueueStatus(item: CaptainNotificationQueueItem, status: CaptainNotificationQueueStatus) {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    writeCaptainNotificationQueueEntry(item, status)
    appendCaptainDecisionLog({
      label: 'Notification queue updated',
      detail: `${item.label} marked ${status} for ${item.audience}.`,
      action: status === 'sent' ? 'Sent' : status === 'hold' ? 'Hold' : 'Queued',
      tone: status === 'sent' ? 'good' : status === 'hold' && item.tone === 'warn' ? 'warn' : 'info',
    })
  }

  function handleMarkCaptainNotificationQueueSent() {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    const readyItems = captainNotificationQueueItems.filter((item) => item.queueStatus === 'queued' && item.body)
    if (!readyItems.length) return

    readyItems.forEach((item) => writeCaptainNotificationQueueEntry(item, 'sent'))
    appendCaptainDecisionLog({
      label: 'Notification queue sent',
      detail: `${readyItems.length} queued notification${readyItems.length === 1 ? '' : 's'} marked sent.`,
      action: 'Sent queue',
      tone: 'good',
    })
  }

  async function handleCopyCaptainNotificationQueueItem(item: CaptainNotificationQueueItem) {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    if (!item.body || typeof navigator === 'undefined' || !navigator.clipboard) return

    try {
      await navigator.clipboard.writeText(item.body)
      setCopiedCaptainNotificationQueueId(item.id)
      writeCaptainNotificationQueueEntry(item, 'queued')
      appendCaptainDecisionLog({
        label: 'Notification copied',
        detail: `${item.label} copied for ${item.audience}.`,
        action: item.timing,
        tone: item.tone,
      })
    } catch {
      setCopiedCaptainNotificationQueueId('')
    }
  }

  function writeCaptainPlayerBriefEntry(item: CaptainPlayerBriefItem, status: CaptainPlayerBriefStatus) {
    if (typeof window === 'undefined' || !workspaceState.currentEventKey) return

    const now = new Date().toISOString()
    const rows = readLocalArray<CaptainPlayerBriefEntry>(CAPTAIN_PLAYER_BRIEF_STORAGE_KEY)
    const nextEntry: CaptainPlayerBriefEntry = {
      id: `captain-player-brief-${workspaceState.currentEventKey}-${item.courtKey}`,
      event_key: workspaceState.currentEventKey,
      court_key: item.courtKey,
      court_label: item.courtLabel,
      status,
      updated_at: now,
    }
    const nextRows = [
      nextEntry,
      ...rows.filter((entry) => !(
        safeText(entry.event_key) === workspaceState.currentEventKey &&
        safeText(entry.court_key) === item.courtKey
      )),
    ].slice(0, 180)

    window.localStorage.setItem(CAPTAIN_PLAYER_BRIEF_STORAGE_KEY, JSON.stringify(nextRows))
    setCaptainPlayerBriefVersion((value) => value + 1)
  }

  function handleCaptainPlayerBriefStatus(item: CaptainPlayerBriefItem, status: CaptainPlayerBriefStatus) {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    writeCaptainPlayerBriefEntry(item, status)
    appendCaptainDecisionLog({
      label: 'Court brief updated',
      detail: `${item.courtLabel} marked ${status === 'briefed' ? 'briefed' : 'for review'} for ${item.players}.`,
      action: status === 'briefed' ? 'Briefed' : 'Review',
      tone: status === 'briefed' ? 'good' : item.tone === 'warn' ? 'warn' : 'info',
    })
  }

  function handleMarkCaptainPlayerBriefed() {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    const readyItems = captainPlayerBriefItems.filter((item) => item.status !== 'briefed' && item.tone !== 'warn')
    if (!readyItems.length) return

    readyItems.forEach((item) => writeCaptainPlayerBriefEntry(item, 'briefed'))
    appendCaptainDecisionLog({
      label: 'Court briefs completed',
      detail: `${readyItems.length} ready court brief${readyItems.length === 1 ? '' : 's'} marked briefed.`,
      action: 'Briefed courts',
      tone: 'good',
    })
  }

  async function handleCopyCaptainPlayerBrief(item: CaptainPlayerBriefItem) {
    if (!premiumEnabled) {
      router.push(captainUnlockHref)
      return
    }

    if (!item.body || typeof navigator === 'undefined' || !navigator.clipboard) return

    try {
      await navigator.clipboard.writeText(item.body)
      setCopiedCaptainPlayerBriefId(item.id)
      appendCaptainDecisionLog({
        label: 'Court brief copied',
        detail: `${item.courtLabel} player brief copied for ${item.players}.`,
        action: 'Copy brief',
        tone: item.tone,
      })
    } catch {
      setCopiedCaptainPlayerBriefId('')
    }
  }

  function handleWeekStatusUpdate(nextStatus: CaptainWeekStatus) {
    setWeekStatus(nextStatus)
    upsertCaptainWeekStatus(captainWeekStatusScope, nextStatus)
    appendCaptainDecisionLog({
      label: 'Week status changed',
      detail: nextStatus === 'ready-to-send'
        ? 'Lineup note marked ready or sent.'
        : nextStatus === 'finalized'
          ? 'Match week marked finalized.'
          : 'Match week moved back to draft.',
      action: nextStatus === 'draft-lineup' ? 'Draft lineup' : nextStatus === 'ready-to-send' ? 'Ready to send' : 'Finalized',
      tone: nextStatus === 'draft-lineup' ? 'info' : 'good',
    })
  }

  if (!authResolved) {
    return (
      <section style={loadingWrap}>
        <div style={loadingStateCardStyle}>
          <TiqFeatureIcon name="captainDashboard" size="md" variant="surface" />
          <div>
            <h1 style={loadingStateTitleStyle}>Preparing Team Hub</h1>
            <div style={loadingStateTextStyle}>Checking your role, team profile, and match-week context.</div>
          </div>
        </div>
      </section>
    )
  }

  if (role === 'public') {
    return <CaptainLockedSurface secondaryLabel="Compare plans" secondaryHref="/pricing" />
  }

  if (!premiumEnabled) {
    return <CaptainLockedSurface secondaryLabel="Back to My Lab" secondaryHref="/mylab" />
  }

  const captainMatchDayCommandStripSurface = (
    <section style={dynamicCaptainMatchDayCommandStrip} aria-label="Captain match day command strip">
      <div style={captainMatchDayCommandHeader}>
        <div>
          <div style={sectionKicker}>Match-day command strip</div>
          <h2 style={captainMatchDayCommandTitle}>{isMobile ? 'Live actions' : 'Live match-day actions'}</h2>
        </div>
        <span style={captainMatchDayPrimaryCommand.tone === 'warn' ? warnBadge : captainMatchDayPrimaryCommand.tone === 'good' ? badgeGreen : badgeBlue}>
          {captainMatchDayPrimaryCommand.label}
        </span>
      </div>

      <div style={dynamicCaptainMatchDayCommandGrid}>
        {captainMatchDayCommandActions.map((action) => {
          const locked = !hasTeamScope || !premiumEnabled

          return (
            <button
              key={action.label}
              type="button"
              disabled={locked}
              style={{
                ...captainMatchDayCommandAction,
                ...(action.tone === 'good'
                  ? captainMatchDayCommandActionGood
                  : action.tone === 'warn'
                    ? captainMatchDayCommandActionWarn
                    : captainMatchDayCommandActionInfo),
                ...(locked ? disabledButtonSecondary : null),
              }}
              onClick={() => {
                if (locked) return
                handleCaptainNav(action.href, action.stage)
              }}
            >
              <span style={captainMatchDayCommandLabel}>{action.label}</span>
              <strong style={captainMatchDayCommandState}>{action.state}</strong>
              {!isMobile ? <span style={captainMatchDayCommandDetail}>{action.detail}</span> : null}
            </button>
          )
        })}
      </div>
    </section>
  )

  const captainEmergencyMode = (
    <section style={dynamicCaptainEmergencyModeShell} aria-label="Captain late-change emergency mode">
      <div style={captainEmergencyModeHeader}>
        <div>
          <div style={sectionKicker}>Late-change mode</div>
          <h2 style={captainEmergencyModeTitle}>{isMobile ? 'Fix late change.' : 'Fix a late lineup change fast.'}</h2>
        </div>
        <span style={captainEmergencyAlertCount > 0 ? warnBadge : workspaceState.lineupReady ? badgeGreen : badgeBlue}>
          {captainEmergencyModeStatus}
        </span>
      </div>
      <div style={captainEmergencyModeSub}>
        Put reply chase, backup call, lineup move, and change message in one thumb-ready lane when match day gets messy.
      </div>

      <div style={captainEmergencyModeHero}>
        <div>
          <div style={commandCenterLabel}>Emergency focus</div>
          <div style={captainEmergencyModeFocus}>{captainEmergencyPrimaryAction.label}</div>
          <p style={captainEmergencyModeDetail}>{captainEmergencyPrimaryAction.detail}</p>
        </div>
        <span style={captainEmergencyPrimaryAction.tone === 'warn' ? warnBadge : captainEmergencyPrimaryAction.tone === 'good' ? badgeGreen : badgeBlue}>
          {captainEmergencyPrimaryAction.state}
        </span>
      </div>

      <div style={captainEmergencyModeActionRow}>
        <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled} onClick={() => void handleCopyCaptainEmergencyMode()}>
          {copiedCaptainEmergencyMode ? 'Copied emergency' : 'Copy emergency note'}
        </PrimarySmallBtn>
        <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(captainEmergencyPrimaryAction.href, captainEmergencyPrimaryAction.stage)}>
          {captainEmergencyPrimaryAction.cta}
        </SecondarySmallBtn>
        <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleLogCaptainDecision('backup')}>
          Log backup call
        </SecondarySmallBtn>
      </div>

      <div style={dynamicCaptainEmergencyModeGrid}>
        {captainEmergencyModeActions.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={!hasTeamScope || !premiumEnabled}
            style={{
              ...captainEmergencyModeAction,
              ...(action.tone === 'warn'
                ? captainEmergencyModeActionWarn
                : action.tone === 'good'
                  ? captainEmergencyModeActionGood
                  : captainEmergencyModeActionInfo),
              ...(!hasTeamScope || !premiumEnabled ? disabledButtonSecondary : null),
            }}
            onClick={() => handleCaptainNav(action.href, action.stage)}
          >
            <span style={captainEmergencyModeActionLabel}>{action.label}</span>
            <strong style={captainEmergencyModeActionState}>{action.state}</strong>
            {!isSmallMobile ? <span style={captainEmergencyModeActionDetail}>{action.detail}</span> : null}
          </button>
        ))}
      </div>
    </section>
  )

  const captainChangeAckTracker = (
    <section style={dynamicCaptainChangeAckShell} aria-label="Captain change acknowledgment tracker">
      <div style={captainChangeAckHeader}>
        <div>
          <div style={sectionKicker}>Change confirmations</div>
          <h2 style={captainChangeAckTitle}>{isMobile ? 'Who confirmed?' : 'See who confirmed the late change.'}</h2>
        </div>
        <span style={captainChangeAckPendingCount > 0 ? warnBadge : captainChangeAckTargets.length ? badgeGreen : badgeBlue}>
          {captainChangeAckStatus}
        </span>
      </div>
      <div style={captainChangeAckSub}>
        Tap each player as they reply so the captain knows who has seen the latest court, backup, or arrival change.
      </div>

      <div style={captainChangeAckSummaryGrid}>
        <div style={captainChangeAckSummaryCard}>
          <span style={commandCenterSnapshotLabel}>Acked</span>
          <strong style={commandCenterSnapshotValue}>{captainChangeAckConfirmedCount}</strong>
          <span style={commandCenterSnapshotDetail}>{captainChangeAckTargets.length ? `${captainChangeAckTargets.length} visible target${captainChangeAckTargets.length === 1 ? '' : 's'}` : 'No target list yet'}</span>
        </div>
        <div style={captainChangeAckSummaryCard}>
          <span style={commandCenterSnapshotLabel}>Waiting</span>
          <strong style={commandCenterSnapshotValue}>{captainChangeAckPendingCount}</strong>
          <span style={commandCenterSnapshotDetail}>{captainChangeAckPendingCount > 0 ? 'Send one more chase' : 'No visible gap'}</span>
        </div>
        <div style={captainChangeAckSummaryCard}>
          <span style={commandCenterSnapshotLabel}>Change</span>
          <strong style={commandCenterSnapshotValue}>{captainCourtSwapNeedsCount > 0 ? captainCourtSwapPrimaryItem.courtLabel : captainEmergencyAlertCount > 0 ? 'Late note' : 'Lineup note'}</strong>
          <span style={commandCenterSnapshotDetail}>{captainCourtSwapNeedsCount > 0 ? captainCourtSwapPrimaryItem.inPlayer : weekAtGlance.eventDateLabel}</span>
        </div>
      </div>

      <div style={dynamicCaptainChangeAckGrid}>
        <div style={captainChangeAckMain}>
          <div style={captainChangeAckTop}>
            <div>
              <div style={commandCenterLabel}>Next confirmation</div>
              <div style={captainChangeAckFocus}>{captainChangeAckPrimaryTarget?.name ?? 'No player targets'}</div>
            </div>
            <span style={captainChangeAckPrimaryTarget?.tone === 'good' ? badgeGreen : captainChangeAckPrimaryTarget?.tone === 'warn' ? warnBadge : badgeBlue}>
              {captainChangeAckPrimaryTarget?.state ?? 'Ready'}
            </span>
          </div>
          <p style={captainChangeAckDetail}>{captainChangeAckPrimaryTarget?.detail ?? 'Save a lineup or contact list before tracking confirmations.'}</p>
          <div style={captainChangeAckActionRow}>
            <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled || !captainChangeAckPendingCount} onClick={handleMarkAllCaptainChangeAck}>
              {captainChangeAckPendingCount ? 'Mark all acked' : 'All acked'}
            </PrimarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled || !captainChangeAckTargets.length} onClick={() => void handleCopyCaptainChangeAckChase()}>
              {copiedCaptainChangeAckChase ? 'Copied chase' : 'Copy ack chase'}
            </SecondarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(messagingHref, 'messaging')}>
              Open Messages
            </SecondarySmallBtn>
          </div>
        </div>

        <div style={captainChangeAckPanel}>
          <div style={commandCenterLabel}>Player acknowledgments</div>
          <div style={dynamicCaptainChangeAckList}>
            {captainChangeAckTargets.length ? captainChangeAckTargets.map((target) => (
              <button
                key={target.id}
                type="button"
                disabled={!hasTeamScope || !premiumEnabled}
                style={{
                  ...captainChangeAckCard,
                  ...(target.status === 'acknowledged' ? captainChangeAckCardGood : target.tone === 'warn' ? captainChangeAckCardWarn : captainChangeAckCardInfo),
                  ...(!hasTeamScope || !premiumEnabled ? disabledButtonSecondary : null),
                }}
                onClick={() => handleCaptainChangeAck(target)}
              >
                <span style={captainChangeAckCardTop}>
                  <strong>{target.name}</strong>
                  <span style={target.status === 'acknowledged' ? badgeGreen : target.tone === 'warn' ? warnBadge : badgeBlue}>
                    {target.state}
                  </span>
                </span>
                <span style={captainChangeAckCourt}>{target.court}</span>
                {!isSmallMobile ? <span style={captainChangeAckCardDetail}>{target.detail}</span> : null}
              </button>
            )) : (
              <article style={captainChangeAckCard}>
                <span style={captainChangeAckCardTop}>
                  <strong>No targets yet</strong>
                  <span style={badgeBlue}>Setup</span>
                </span>
                <span style={captainChangeAckCardDetail}>Build a lineup or add captain message contacts to track who saw the change.</span>
              </article>
            )}
          </div>
        </div>
      </div>
    </section>
  )

  const captainArrivalRiskTracker = (
    <section style={dynamicCaptainArrivalRiskShell} aria-label="Captain arrival risk tracker">
      <div style={captainArrivalRiskHeader}>
        <div>
          <div style={sectionKicker}>Arrival tracker</div>
          <h2 style={captainArrivalRiskTitle}>{isMobile ? 'Who is late?' : 'Track ETA and backup arrivals.'}</h2>
        </div>
        <span style={captainArrivalRiskLateCount > 0 ? warnBadge : captainArrivalRiskWatchCount > 0 ? badgeBlue : captainArrivalRiskTargets.length ? badgeGreen : badgeBlue}>
          {captainArrivalRiskStatus}
        </span>
      </div>
      <div style={captainArrivalRiskSub}>
        Keep late players, ETA gaps, and backup arrival coverage in one quick lane before warm-up starts.
      </div>

      <div style={captainArrivalRiskSummaryGrid}>
        <div style={captainArrivalRiskSummaryCard}>
          <span style={commandCenterSnapshotLabel}>On time</span>
          <strong style={commandCenterSnapshotValue}>{captainArrivalRiskOnTimeCount}</strong>
          <span style={commandCenterSnapshotDetail}>{matchDayArrivalLabel}</span>
        </div>
        <div style={captainArrivalRiskSummaryCard}>
          <span style={commandCenterSnapshotLabel}>Watch</span>
          <strong style={commandCenterSnapshotValue}>{captainArrivalRiskWatchCount}</strong>
          <span style={commandCenterSnapshotDetail}>{captainArrivalRiskLateCount > 0 ? `${captainArrivalRiskLateCount} late` : 'Need ETA'}</span>
        </div>
        <div style={captainArrivalRiskSummaryCard}>
          <span style={commandCenterSnapshotLabel}>Backup</span>
          <strong style={commandCenterSnapshotValue}>{captainArrivalRiskBackupCount}</strong>
          <span style={commandCenterSnapshotDetail}>{captainBenchReadyCount > 0 ? captainBenchPrimaryItem.name : 'Review bench'}</span>
        </div>
      </div>

      <div style={dynamicCaptainArrivalRiskGrid}>
        <div style={captainArrivalRiskMain}>
          <div style={captainArrivalRiskTop}>
            <div>
              <div style={commandCenterLabel}>Next arrival text</div>
              <div style={captainArrivalRiskFocus}>{captainArrivalRiskPrimaryTarget?.name ?? 'No arrival targets'}</div>
            </div>
            <span style={captainArrivalRiskPrimaryTarget?.tone === 'warn' ? warnBadge : captainArrivalRiskPrimaryTarget?.tone === 'good' ? badgeGreen : badgeBlue}>
              {captainArrivalRiskPrimaryTarget?.state ?? 'Ready'}
            </span>
          </div>
          <p style={captainArrivalRiskDetail}>{captainArrivalRiskPrimaryTarget?.detail ?? 'Save a lineup, contacts, or roster before tracking arrival status.'}</p>
          <div style={captainArrivalRiskMetaGrid}>
            <div style={captainArrivalRiskMetaCard}>
              <span style={commandCenterSnapshotLabel}>Arrival</span>
              <strong style={commandCenterSnapshotValue}>{matchDayArrivalLabel}</strong>
              <span style={commandCenterSnapshotDetail}>{matchDayLocationLabel}</span>
            </div>
            <div style={captainArrivalRiskMetaCard}>
              <span style={commandCenterSnapshotLabel}>Court risk</span>
              <strong style={commandCenterSnapshotValue}>{captainCourtSwapNeedsCount > 0 ? captainCourtSwapPrimaryItem.courtLabel : 'Stable'}</strong>
              <span style={commandCenterSnapshotDetail}>{captainCourtSwapNeedsCount > 0 ? captainCourtSwapPrimaryItem.inPlayer : 'No urgent move'}</span>
            </div>
          </div>
          <div style={captainArrivalRiskActionRow}>
            <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled || !captainArrivalRiskWatchCount} onClick={handleMarkAllCaptainArrivalOnTime}>
              {captainArrivalRiskWatchCount ? 'Mark watch on time' : 'Arrival clear'}
            </PrimarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled || !captainArrivalRiskTargets.length} onClick={() => void handleCopyCaptainArrivalRiskMessage()}>
              {copiedCaptainArrivalRiskMessage ? 'Copied ETA' : 'Copy ETA chase'}
            </SecondarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(messagingHref, 'messaging')}>
              Open Messages
            </SecondarySmallBtn>
          </div>
        </div>

        <div style={captainArrivalRiskPanel}>
          <div style={commandCenterLabel}>Arrival board</div>
          <div style={dynamicCaptainArrivalRiskList}>
            {captainArrivalRiskTargets.length ? captainArrivalRiskTargets.map((target) => (
              <article
                key={target.id}
                style={{
                  ...captainArrivalRiskCard,
                  ...(target.status === 'running-late' ? captainArrivalRiskCardWarn : target.status === 'eta-needed' ? captainArrivalRiskCardInfo : captainArrivalRiskCardGood),
                }}
              >
                <div style={captainArrivalRiskCardTop}>
                  <strong>{target.name}</strong>
                  <span style={target.tone === 'warn' ? warnBadge : target.tone === 'good' ? badgeGreen : badgeBlue}>
                    {target.state}
                  </span>
                </div>
                <span style={captainArrivalRiskCourt}>{target.court} - {target.role}</span>
                {!isSmallMobile ? <span style={captainArrivalRiskCardDetail}>{target.detail}</span> : null}
                <div style={captainArrivalRiskStatusGrid}>
                  {(['on-time', 'running-late', 'backup-ready'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={!hasTeamScope || !premiumEnabled}
                      style={{
                        ...captainArrivalRiskStatusButton,
                        ...(target.status === status ? captainArrivalRiskStatusButtonActive : null),
                        ...(!hasTeamScope || !premiumEnabled ? disabledButtonSecondary : null),
                      }}
                      onClick={() => handleCaptainArrivalRiskStatus(target, status)}
                    >
                      {status === 'on-time' ? 'On time' : status === 'running-late' ? 'Late' : 'Backup'}
                    </button>
                  ))}
                </div>
              </article>
            )) : (
              <article style={captainArrivalRiskCard}>
                <div style={captainArrivalRiskCardTop}>
                  <strong>No arrival targets yet</strong>
                  <span style={badgeBlue}>Setup</span>
                </div>
                <span style={captainArrivalRiskCardDetail}>Build a lineup or add captain contacts to track late players and backup arrivals.</span>
              </article>
            )}
          </div>
        </div>
      </div>
    </section>
  )

  const captainCourtHandoffTimer = (
    <section style={dynamicCaptainCourtHandoffShell} aria-label="Captain court handoff timer">
      <div style={captainCourtHandoffHeader}>
        <div>
          <div style={sectionKicker}>Court handoff</div>
          <h2 style={captainCourtHandoffTitle}>{isMobile ? 'Start courts.' : 'Run the court handoff timer.'}</h2>
        </div>
        <span style={captainCourtHandoffWatchCount > 0 ? warnBadge : captainCourtHandoffReadyCount === captainCourtHandoffItems.length && captainCourtHandoffItems.length ? badgeGreen : badgeBlue}>
          {captainCourtHandoffStatus}
        </span>
      </div>
      <div style={captainCourtHandoffSub}>
        Turn confirmations, arrival status, and backup coverage into a quick court-by-court warm-up handoff.
      </div>

      <div style={captainCourtHandoffSummaryGrid}>
        <div style={captainCourtHandoffSummaryCard}>
          <span style={commandCenterSnapshotLabel}>Ready</span>
          <strong style={commandCenterSnapshotValue}>{captainCourtHandoffReadyCount}/{captainCourtHandoffItems.length || workspaceState.lineupCount}</strong>
          <span style={commandCenterSnapshotDetail}>Court handoff</span>
        </div>
        <div style={captainCourtHandoffSummaryCard}>
          <span style={commandCenterSnapshotLabel}>Hold</span>
          <strong style={commandCenterSnapshotValue}>{captainCourtHandoffWatchCount}</strong>
          <span style={commandCenterSnapshotDetail}>{captainCourtHandoffWatchCount ? 'Check first' : 'No blocks'}</span>
        </div>
        <div style={captainCourtHandoffSummaryCard}>
          <span style={commandCenterSnapshotLabel}>Next</span>
          <strong style={commandCenterSnapshotValue}>{captainCourtHandoffPrimaryItem?.timerLabel ?? 'T-15'}</strong>
          <span style={commandCenterSnapshotDetail}>{captainCourtHandoffPrimaryItem?.courtLabel ?? 'Build lineup'}</span>
        </div>
      </div>

      <div style={dynamicCaptainCourtHandoffGrid}>
        <div style={captainCourtHandoffMain}>
          <div style={captainCourtHandoffTop}>
            <div>
              <div style={commandCenterLabel}>Next court</div>
              <div style={captainCourtHandoffFocus}>{captainCourtHandoffPrimaryItem?.courtLabel ?? 'No court plan'}</div>
            </div>
            <span style={captainCourtHandoffPrimaryItem?.tone === 'warn' ? warnBadge : captainCourtHandoffPrimaryItem?.tone === 'good' ? badgeGreen : badgeBlue}>
              {captainCourtHandoffPrimaryItem?.state ?? 'Prep'}
            </span>
          </div>
          <p style={captainCourtHandoffDetail}>{captainCourtHandoffPrimaryItem?.detail ?? 'Save courts before starting the handoff timer.'}</p>
          <div style={captainCourtHandoffMetaGrid}>
            <div style={captainCourtHandoffMetaCard}>
              <span style={commandCenterSnapshotLabel}>Timer</span>
              <strong style={commandCenterSnapshotValue}>{captainCourtHandoffPrimaryItem?.timerLabel ?? 'T-15'}</strong>
              <span style={commandCenterSnapshotDetail}>{captainCourtHandoffPrimaryItem?.phase ?? 'Prep'}</span>
            </div>
            <div style={captainCourtHandoffMetaCard}>
              <span style={commandCenterSnapshotLabel}>Signals</span>
              <strong style={commandCenterSnapshotValue}>{captainCourtHandoffPrimaryItem?.ackLabel ?? 'Ack'}</strong>
              <span style={commandCenterSnapshotDetail}>{captainCourtHandoffPrimaryItem?.arrivalLabel ?? 'Arrival'}</span>
            </div>
          </div>
          <div style={captainCourtHandoffActionRow}>
            <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled || !captainCourtHandoffItems.some((item) => item.status !== 'ready' && item.tone !== 'warn')} onClick={handleMarkCaptainCourtHandoffReady}>
              Mark clear courts ready
            </PrimarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled || !captainCourtHandoffItems.length} onClick={() => void handleCopyCaptainCourtHandoff()}>
              {copiedCaptainCourtHandoff ? 'Copied handoff' : 'Copy court handoff'}
            </SecondarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(lineupBuilderHref, 'lineup')}>
              Review courts
            </SecondarySmallBtn>
          </div>
        </div>

        <div style={captainCourtHandoffPanel}>
          <div style={commandCenterLabel}>Court timer board</div>
          <div style={dynamicCaptainCourtHandoffList}>
            {captainCourtHandoffItems.length ? captainCourtHandoffItems.map((item) => (
              <article
                key={item.id}
                style={{
                  ...captainCourtHandoffCard,
                  ...(item.tone === 'warn' ? captainCourtHandoffCardWarn : item.tone === 'good' ? captainCourtHandoffCardGood : captainCourtHandoffCardInfo),
                }}
              >
                <div style={captainCourtHandoffCardTop}>
                  <strong>{item.courtLabel}</strong>
                  <span style={item.tone === 'warn' ? warnBadge : item.tone === 'good' ? badgeGreen : badgeBlue}>
                    {item.timerLabel}
                  </span>
                </div>
                <span style={captainCourtHandoffPlayers}>{item.players}</span>
                {!isSmallMobile ? <span style={captainCourtHandoffCardDetail}>{item.detail}</span> : null}
                <div style={captainCourtHandoffSignalRow}>
                  <span>{item.ackLabel}</span>
                  <span>{item.arrivalLabel}</span>
                </div>
                <div style={captainCourtHandoffButtonGrid}>
                  {(['prep', 'warmup', 'ready'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={!hasTeamScope || !premiumEnabled}
                      style={{
                        ...captainCourtHandoffButton,
                        ...(item.status === status ? captainCourtHandoffButtonActive : null),
                        ...(!hasTeamScope || !premiumEnabled ? disabledButtonSecondary : null),
                      }}
                      onClick={() => handleCaptainCourtHandoffStatus(item, status)}
                    >
                      {status === 'prep' ? 'Prep' : status === 'warmup' ? 'Warm-up' : 'Ready'}
                    </button>
                  ))}
                </div>
              </article>
            )) : (
              <article style={captainCourtHandoffCard}>
                <div style={captainCourtHandoffCardTop}>
                  <strong>No court handoff yet</strong>
                  <span style={badgeBlue}>Setup</span>
                </div>
                <span style={captainCourtHandoffCardDetail}>Build a lineup before starting the court-by-court warm-up handoff.</span>
              </article>
            )}
          </div>
        </div>
      </div>
    </section>
  )

  const captainNotificationQueue = (
    <section style={dynamicCaptainNotificationQueueShell} aria-label="Captain match-day notification queue">
      <div style={captainNotificationQueueHeader}>
        <div>
          <div style={sectionKicker}>Notification queue</div>
          <h2 style={captainNotificationQueueTitle}>{isMobile ? 'Text next.' : 'Send the next match-day text.'}</h2>
        </div>
        <span style={captainNotificationQueueHoldCount > 0 ? warnBadge : captainNotificationQueueReadyCount > 0 ? badgeBlue : badgeGreen}>
          {captainNotificationQueueStatus}
        </span>
      </div>
      <div style={captainNotificationQueueSub}>
        Pick the next text for late players, backups, confirmed courts, and warm-up groups without rebuilding the message.
      </div>

      <div style={captainNotificationQueueSummaryGrid}>
        <div style={captainNotificationQueueSummaryCard}>
          <span style={commandCenterSnapshotLabel}>Queued</span>
          <strong style={commandCenterSnapshotValue}>{captainNotificationQueueReadyCount}</strong>
          <span style={commandCenterSnapshotDetail}>Ready to copy</span>
        </div>
        <div style={captainNotificationQueueSummaryCard}>
          <span style={commandCenterSnapshotLabel}>Hold</span>
          <strong style={commandCenterSnapshotValue}>{captainNotificationQueueHoldCount}</strong>
          <span style={commandCenterSnapshotDetail}>{captainNotificationQueueHoldCount ? 'Check first' : 'No blocks'}</span>
        </div>
        <div style={captainNotificationQueueSummaryCard}>
          <span style={commandCenterSnapshotLabel}>Sent</span>
          <strong style={commandCenterSnapshotValue}>{captainNotificationQueueSentCount}</strong>
          <span style={commandCenterSnapshotDetail}>Saved here</span>
        </div>
      </div>

      <div style={dynamicCaptainNotificationQueueGrid}>
        <div style={captainNotificationQueueMain}>
          <div style={captainNotificationQueueTop}>
            <div>
              <div style={commandCenterLabel}>Top text</div>
              <div style={captainNotificationQueueFocus}>{captainNotificationQueuePrimaryItem?.label ?? 'No text ready'}</div>
            </div>
            <span style={captainNotificationQueuePrimaryItem?.tone === 'warn' ? warnBadge : captainNotificationQueuePrimaryItem?.tone === 'good' ? badgeGreen : badgeBlue}>
              {captainNotificationQueuePrimaryItem?.timing ?? 'Standby'}
            </span>
          </div>
          <p style={captainNotificationQueueDetail}>{captainNotificationQueuePrimaryItem?.detail ?? 'Build a lineup, arrival plan, or handoff before sending match-day texts.'}</p>
          <div style={captainNotificationQueueMetaGrid}>
            <div style={captainNotificationQueueMetaCard}>
              <span style={commandCenterSnapshotLabel}>Audience</span>
              <strong style={commandCenterSnapshotValue}>{captainNotificationQueuePrimaryItem?.audience ?? 'Team'}</strong>
              <span style={commandCenterSnapshotDetail}>{captainNotificationQueuePrimaryItem?.source ?? 'Captain'}</span>
            </div>
            <div style={captainNotificationQueueMetaCard}>
              <span style={commandCenterSnapshotLabel}>Status</span>
              <strong style={commandCenterSnapshotValue}>{captainNotificationQueuePrimaryItem?.queueStatus === 'sent' ? 'Sent' : captainNotificationQueuePrimaryItem?.queueStatus === 'hold' ? 'Hold' : 'Queued'}</strong>
              <span style={commandCenterSnapshotDetail}>{captainNotificationQueuePrimaryItem?.state ?? 'Ready'}</span>
            </div>
          </div>
          <div style={captainNotificationQueuePreview}>
            {captainNotificationQueuePrimaryItem?.body || 'No message needed for this step right now.'}
          </div>
          <div style={captainNotificationQueueActionRow}>
            <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled || !captainNotificationQueuePrimaryItem?.body} onClick={() => captainNotificationQueuePrimaryItem ? void handleCopyCaptainNotificationQueueItem(captainNotificationQueuePrimaryItem) : undefined}>
              {copiedCaptainNotificationQueueId === captainNotificationQueuePrimaryItem?.id ? 'Copied text' : 'Copy top text'}
            </PrimarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled || !captainNotificationQueueReadyCount} onClick={handleMarkCaptainNotificationQueueSent}>
              Mark queued sent
            </SecondarySmallBtn>
          </div>
        </div>

        <div style={captainNotificationQueuePanel}>
          <div style={commandCenterLabel}>Match-day texts</div>
          <div style={dynamicCaptainNotificationQueueList}>
            {captainNotificationQueueItems.map((item) => (
              <article
                key={item.id}
                style={{
                  ...captainNotificationQueueCard,
                  ...(item.tone === 'warn' ? captainNotificationQueueCardWarn : item.tone === 'good' ? captainNotificationQueueCardGood : captainNotificationQueueCardInfo),
                }}
              >
                <div style={captainNotificationQueueCardTop}>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.audience}</span>
                  </div>
                  <span style={item.queueStatus === 'sent' ? badgeGreen : item.queueStatus === 'hold' ? warnBadge : badgeBlue}>
                    {item.queueStatus === 'sent' ? 'Sent' : item.queueStatus === 'hold' ? 'Hold' : 'Queued'}
                  </span>
                </div>
                <span style={captainNotificationQueueCardDetail}>{item.detail}</span>
                {!isSmallMobile ? (
                  <div style={captainNotificationQueueCardPreview}>
                    {item.body || 'No text needed now.'}
                  </div>
                ) : null}
                <div style={captainNotificationQueueSignalRow}>
                  <span>{item.timing}</span>
                  <span>{item.source}</span>
                </div>
                <div style={captainNotificationQueueButtonGrid}>
                  {(['queued', 'sent', 'hold'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={!hasTeamScope || !premiumEnabled}
                      style={{
                        ...captainNotificationQueueButton,
                        ...(item.queueStatus === status ? captainNotificationQueueButtonActive : null),
                        ...(!hasTeamScope || !premiumEnabled ? disabledButtonSecondary : null),
                      }}
                      onClick={() => handleCaptainNotificationQueueStatus(item, status)}
                    >
                      {status === 'queued' ? 'Queue' : status === 'sent' ? 'Sent' : 'Hold'}
                    </button>
                  ))}
                </div>
                <PrimarySmallBtn fullWidth disabled={!hasTeamScope || !premiumEnabled || !item.body} onClick={() => void handleCopyCaptainNotificationQueueItem(item)}>
                  {copiedCaptainNotificationQueueId === item.id ? 'Copied text' : 'Copy text'}
                </PrimarySmallBtn>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )

  const captainPlayerBriefCards = (
    <section style={dynamicCaptainPlayerBriefShell} aria-label="Captain player brief cards">
      <div style={captainPlayerBriefHeader}>
        <div>
          <div style={sectionKicker}>Player brief cards</div>
          <h2 style={captainPlayerBriefTitle}>{isMobile ? 'Brief courts.' : 'Give every court the same clear brief.'}</h2>
        </div>
        <span style={captainPlayerBriefReviewCount > 0 ? warnBadge : captainPlayerBriefReadyCount > 0 ? badgeBlue : badgeGreen}>
          {captainPlayerBriefStatus}
        </span>
      </div>
      <div style={captainPlayerBriefSub}>
        Turn lineup confidence, arrival status, and handoff state into one simple court talk before players start.
      </div>

      <div style={captainPlayerBriefSummaryGrid}>
        <div style={captainPlayerBriefSummaryCard}>
          <span style={commandCenterSnapshotLabel}>Briefed</span>
          <strong style={commandCenterSnapshotValue}>{captainPlayerBriefedCount}</strong>
          <span style={commandCenterSnapshotDetail}>Done here</span>
        </div>
        <div style={captainPlayerBriefSummaryCard}>
          <span style={commandCenterSnapshotLabel}>Review</span>
          <strong style={commandCenterSnapshotValue}>{captainPlayerBriefReviewCount}</strong>
          <span style={commandCenterSnapshotDetail}>{captainPlayerBriefReviewCount ? 'Check first' : 'No blocks'}</span>
        </div>
        <div style={captainPlayerBriefSummaryCard}>
          <span style={commandCenterSnapshotLabel}>Ready</span>
          <strong style={commandCenterSnapshotValue}>{captainPlayerBriefReadyCount}</strong>
          <span style={commandCenterSnapshotDetail}>Can brief</span>
        </div>
      </div>

      <div style={dynamicCaptainPlayerBriefGrid}>
        <div style={captainPlayerBriefMain}>
          <div style={captainPlayerBriefTop}>
            <div>
              <div style={commandCenterLabel}>Next court talk</div>
              <div style={captainPlayerBriefFocus}>{captainPlayerBriefPrimaryItem?.courtLabel ?? 'No court brief'}</div>
            </div>
            <span style={captainPlayerBriefPrimaryItem?.tone === 'warn' ? warnBadge : captainPlayerBriefPrimaryItem?.tone === 'good' ? badgeGreen : badgeBlue}>
              {captainPlayerBriefPrimaryItem?.state ?? 'Review'}
            </span>
          </div>
          <p style={captainPlayerBriefDetail}>{captainPlayerBriefPrimaryItem?.detail ?? 'Save a lineup before briefing courts.'}</p>
          <div style={captainPlayerBriefMetaGrid}>
            <div style={captainPlayerBriefMetaCard}>
              <span style={commandCenterSnapshotLabel}>Players</span>
              <strong style={commandCenterSnapshotValue}>{captainPlayerBriefPrimaryItem?.players ?? 'Not set'}</strong>
              <span style={commandCenterSnapshotDetail}>Court group</span>
            </div>
            <div style={captainPlayerBriefMetaCard}>
              <span style={commandCenterSnapshotLabel}>First job</span>
              <strong style={commandCenterSnapshotValue}>{captainPlayerBriefPrimaryItem?.firstJob ?? 'Set roles'}</strong>
              <span style={commandCenterSnapshotDetail}>Say this first</span>
            </div>
          </div>
          <div style={captainPlayerBriefPreview}>
            {captainPlayerBriefPrimaryItem?.body || 'No court brief ready yet.'}
          </div>
          <div style={captainPlayerBriefActionRow}>
            <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled || !captainPlayerBriefPrimaryItem?.body} onClick={() => captainPlayerBriefPrimaryItem ? void handleCopyCaptainPlayerBrief(captainPlayerBriefPrimaryItem) : undefined}>
              {copiedCaptainPlayerBriefId === captainPlayerBriefPrimaryItem?.id ? 'Copied brief' : 'Copy court brief'}
            </PrimarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled || !captainPlayerBriefReadyCount} onClick={handleMarkCaptainPlayerBriefed}>
              Mark ready briefed
            </SecondarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(lineupBuilderHref, 'lineup')}>
              Review lineup
            </SecondarySmallBtn>
          </div>
        </div>

        <div style={captainPlayerBriefPanel}>
          <div style={commandCenterLabel}>Court brief cards</div>
          <div style={dynamicCaptainPlayerBriefList}>
            {captainPlayerBriefItems.map((item) => (
              <article
                key={item.id}
                style={{
                  ...captainPlayerBriefCard,
                  ...(item.tone === 'warn' ? captainPlayerBriefCardWarn : item.tone === 'good' ? captainPlayerBriefCardGood : captainPlayerBriefCardInfo),
                }}
              >
                <div style={captainPlayerBriefCardTop}>
                  <div>
                    <strong>{item.courtLabel}</strong>
                    <span>{item.players}</span>
                  </div>
                  <span style={item.tone === 'warn' ? warnBadge : item.tone === 'good' ? badgeGreen : badgeBlue}>
                    {item.state}
                  </span>
                </div>
                <span style={captainPlayerBriefCardDetail}>{item.detail}</span>
                {!isSmallMobile ? (
                  <div style={captainPlayerBriefPromptGrid}>
                    <div style={captainPlayerBriefPromptGridItem}>
                      <span>First</span>
                      <strong>{item.firstJob}</strong>
                    </div>
                    <div style={captainPlayerBriefPromptGridItem}>
                      <span>If trouble</span>
                      <strong>{item.ifTrouble}</strong>
                    </div>
                  </div>
                ) : null}
                <div style={captainPlayerBriefButtonGrid}>
                  {(['review', 'briefed'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={!hasTeamScope || !premiumEnabled}
                      style={{
                        ...captainPlayerBriefButton,
                        ...(item.status === status ? captainPlayerBriefButtonActive : null),
                        ...(!hasTeamScope || !premiumEnabled ? disabledButtonSecondary : null),
                      }}
                      onClick={() => handleCaptainPlayerBriefStatus(item, status)}
                    >
                      {status === 'briefed' ? 'Briefed' : 'Review'}
                    </button>
                  ))}
                </div>
                <PrimarySmallBtn fullWidth disabled={!hasTeamScope || !premiumEnabled || !item.body} onClick={() => void handleCopyCaptainPlayerBrief(item)}>
                  {copiedCaptainPlayerBriefId === item.id ? 'Copied brief' : 'Copy brief'}
                </PrimarySmallBtn>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )

  const captainMorningBrief = (
    <section style={dynamicCaptainMorningBriefShell} aria-label="Captain morning brief">
      <div style={commandCenterHeader}>
        <div>
          <div style={sectionKicker}>Morning brief</div>
          <h2 style={sectionTitle}>{isMobile ? 'Start here.' : "Start the match day from one glance."}</h2>
        </div>
        <span style={captainMorningBriefStatus === 'Needs action' ? warnBadge : captainMorningBriefStatus === 'Ready' ? badgeGreen : badgeBlue}>
          {captainMorningBriefStatus}
        </span>
      </div>
      <div style={sectionSub}>
        Check the court plan, open replies, backup call, arrival detail, and first action before the day gets loud.
      </div>

      <div style={dynamicCaptainMorningBriefGrid}>
        <div style={captainMorningBriefHero}>
          <div style={captainMorningBriefHeroTop}>
            <div>
              <div style={commandCenterLabel}>First action</div>
              <div style={captainMorningBriefTitle}>{captainMorningBriefPrimaryAction.label}</div>
            </div>
            <span style={captainMorningBriefPrimaryAction.tone === 'good' ? badgeGreen : captainMorningBriefPrimaryAction.tone === 'warn' ? warnBadge : badgeBlue}>
              {captainMorningBriefPrimaryAction.state}
            </span>
          </div>
          <p style={captainMorningBriefDetail}>{captainMorningBriefPrimaryAction.detail}</p>
          <div style={captainMorningBriefMetaRow}>
            <span>{captainMorningBriefMeta || weekAtGlance.scopeLabel}</span>
          </div>
          <div style={captainMorningBriefActionRow}>
            <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(captainMorningBriefPrimaryAction.href, captainMorningBriefPrimaryAction.stage)}>
              {captainMorningBriefPrimaryAction.label}
            </PrimarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(messagingHref, 'messaging')}>
              Open Messages
            </SecondarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(lineupBuilderHref, 'lineup')}>
              Review courts
            </SecondarySmallBtn>
          </div>
        </div>

        <div style={captainMorningBriefPanel}>
          <div style={captainMorningBriefSummaryGrid}>
            {captainMorningBriefItems.map((item) => (
              <article key={item.label} style={captainMorningBriefSummaryCard}>
                <div style={captainMorningBriefSummaryTop}>
                  <span>{item.label}</span>
                  <span style={item.tone === 'good' ? badgeGreen : item.tone === 'warn' ? warnBadge : badgeBlue}>
                    {item.tone === 'good' ? 'Set' : item.tone === 'warn' ? 'Act' : 'Check'}
                  </span>
                </div>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </article>
            ))}
          </div>

          <div style={captainMorningBriefLineupPanel}>
            <div style={captainMorningBriefSummaryTop}>
              <span>Today&apos;s courts</span>
              <span style={workspaceState.lineupReady ? badgeGreen : badgeBlue}>
                {workspaceState.lineupReady ? `${captainMorningBriefLineup.length} shown` : 'Draft'}
              </span>
            </div>
            <div style={captainMorningBriefLineupList}>
              {captainMorningBriefLineup.length ? captainMorningBriefLineup.map((row, index) => (
                <div key={row.id || `${row.court_label}-${index}`} style={captainMorningBriefLineupRow}>
                  <strong>{safeText(row.court_label, `Court ${index + 1}`)}</strong>
                  <span>{row.players?.filter(Boolean).join(' / ') || 'Players not set'}</span>
                </div>
              )) : (
                <div style={captainMorningBriefLineupRow}>
                  <strong>No courts saved</strong>
                  <span>Build the lineup before sending the morning note.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )

  const captainSendQueue = (
    <section style={dynamicCaptainSendQueueShell} aria-label="Captain send queue">
      <div style={commandCenterHeader}>
        <div>
          <div style={sectionKicker}>Send queue</div>
          <h2 style={sectionTitle}>{isMobile ? 'Send in order.' : 'Send each captain note without rebuilding it.'}</h2>
        </div>
        <span style={captainSendQueueActionCount > 0 ? warnBadge : captainSendQueueReadyCount >= 3 ? badgeGreen : badgeBlue}>
          {captainSendQueueActionCount > 0 ? `${captainSendQueueActionCount} action` : `${captainSendQueueReadyCount}/${captainSendQueueItems.length} ready`}
        </span>
      </div>
      <div style={sectionSub}>
        Work down the lineup note, reply reminder, backup text, and arrival note from one phone-friendly checklist.
      </div>

      <div style={captainSendQueueHero}>
        <div>
          <div style={commandCenterLabel}>Next send</div>
          <div style={captainSendQueueTitle}>{captainSendQueuePrimaryItem.label}</div>
          <p style={captainSendQueueDetail}>{captainSendQueuePrimaryItem.detail}</p>
        </div>
        <span style={captainSendQueuePrimaryItem.tone === 'good' ? badgeGreen : captainSendQueuePrimaryItem.tone === 'warn' ? warnBadge : badgeBlue}>
          {captainSendQueuePrimaryItem.state}
        </span>
      </div>

      <div style={dynamicCaptainSendQueueGrid}>
        {captainSendQueueItems.map((item, index) => (
          <article key={item.id} style={captainSendQueueCard}>
            <div style={captainSendQueueCardTop}>
              <div>
                <span style={captainSendQueueStep}>Step {index + 1}</span>
                <strong>{item.label}</strong>
              </div>
              <span style={item.tone === 'good' ? badgeGreen : item.tone === 'warn' ? warnBadge : badgeBlue}>
                {item.state}
              </span>
            </div>
            <span style={captainSendQueueCardDetail}>{item.detail}</span>
            <div style={captainSendQueuePreview}>
              {item.body || 'No message needed for this step right now.'}
            </div>
            <div style={captainSendQueueActionRow}>
              <PrimarySmallBtn fullWidth={isSmallMobile} disabled={!hasTeamScope || !premiumEnabled || !item.body} onClick={() => void handleCopyCaptainSendQueueItem(item)}>
                {copiedCaptainSendQueueId === item.id ? 'Copied note' : 'Copy note'}
              </PrimarySmallBtn>
              <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(item.href, item.stage)}>
                Open tool
              </SecondarySmallBtn>
            </div>
          </article>
        ))}
      </div>
    </section>
  )

  const captainDecisionLog = (
    <section style={dynamicCaptainDecisionLogShell} aria-label="Captain decision log">
      <div style={commandCenterHeader}>
        <div>
          <div style={sectionKicker}>Decision log</div>
          <h2 style={sectionTitle}>{isMobile ? 'Track the calls.' : 'Keep the captain trail clear.'}</h2>
        </div>
        <span style={captainDecisionLogEntries.length ? badgeGreen : badgeBlue}>
          {captainDecisionLogStatus}
        </span>
      </div>
      <div style={sectionSub}>
        Save lineup calls, sent notes, reply chases, and backup decisions so match-day context stays easy to retrace.
      </div>

      <div style={dynamicCaptainDecisionLogGrid}>
        <div style={captainDecisionLogHero}>
          <div style={captainDecisionLogHeroTop}>
            <div>
              <div style={commandCenterLabel}>Latest call</div>
              <div style={captainDecisionLogTitle}>{safeText(captainDecisionLogPrimaryEntry.label, 'Decision log')}</div>
            </div>
            <span style={captainDecisionLogPrimaryEntry.tone === 'good' ? badgeGreen : captainDecisionLogPrimaryEntry.tone === 'warn' ? warnBadge : badgeBlue}>
              {safeText(captainDecisionLogPrimaryEntry.action, 'Open')}
            </span>
          </div>
          <p style={captainDecisionLogDetail}>{safeText(captainDecisionLogPrimaryEntry.detail, 'No saved captain decisions for this event yet.')}</p>
          <div style={captainDecisionLogActionRow}>
            <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleLogCaptainDecision('lineup')}>
              Log lineup call
            </PrimarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleLogCaptainDecision('reply')}>
              Log reply chase
            </SecondarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleLogCaptainDecision('backup')}>
              Log backup call
            </SecondarySmallBtn>
          </div>
        </div>

        <div style={captainDecisionLogPanel}>
          <div style={captainDecisionLogList}>
            {captainDecisionLogEntries.length ? captainDecisionLogEntries.map((entry) => (
              <article key={entry.id || `${entry.label}-${entry.created_at}`} style={captainDecisionLogEntryCard}>
                <div style={captainDecisionLogEntryTop}>
                  <strong>{safeText(entry.label, 'Captain call')}</strong>
                  <span style={entry.tone === 'good' ? badgeGreen : entry.tone === 'warn' ? warnBadge : badgeBlue}>
                    {formatDateTimeShort(entry.created_at || '') || 'Saved'}
                  </span>
                </div>
                <span>{safeText(entry.detail, 'Decision saved for this match week.')}</span>
                <small>{safeText(entry.action, 'Captain action')}</small>
              </article>
            )) : (
              <article style={captainDecisionLogEntryCard}>
                <div style={captainDecisionLogEntryTop}>
                  <strong>No saved calls yet</strong>
                  <span style={badgeBlue}>Ready</span>
                </div>
                <span>Use quick-log buttons or copy send queue notes to build the trail.</span>
                <small>{weekAtGlance.eventDateLabel}</small>
              </article>
            )}
          </div>
        </div>
      </div>
    </section>
  )

  const captainHandoffSheet = (
    <section style={dynamicCaptainHandoffSheetShell} aria-label="Captain handoff sheet">
      <div style={commandCenterHeader}>
        <div>
          <div style={sectionKicker}>Handoff sheet</div>
          <h2 style={sectionTitle}>{isMobile ? 'Carry this.' : 'Carry one match-day handoff.'}</h2>
        </div>
        <span style={captainHandoffIssueCount > 0 ? warnBadge : captainHandoffReadyCount >= 4 ? badgeGreen : badgeBlue}>
          {captainHandoffIssueCount > 0 ? `${captainHandoffIssueCount} fix` : `${captainHandoffReadyCount}/${captainHandoffSheetItems.length} ready`}
        </span>
      </div>
      <div style={sectionSub}>
        Copy the at-court version of your lineup, reply gaps, backup call, and latest captain decisions before players arrive.
      </div>

      <div style={dynamicCaptainHandoffSheetGrid}>
        <div style={captainHandoffSheetHero}>
          <div style={captainHandoffSheetHeroTop}>
            <div>
              <div style={commandCenterLabel}>Handoff focus</div>
              <div style={captainHandoffSheetTitle}>{captainHandoffPrimaryItem.label}</div>
            </div>
            <span style={captainHandoffPrimaryItem.tone === 'good' ? badgeGreen : captainHandoffPrimaryItem.tone === 'warn' ? warnBadge : badgeBlue}>
              {captainHandoffPrimaryItem.state}
            </span>
          </div>
          <p style={captainHandoffSheetDetail}>{captainHandoffPrimaryItem.detail}</p>
          <div style={captainHandoffSheetPreview}>
            {captainHandoffPreviewLines.map((line, index) => (
              <span key={`${line}-${index}`}>{line}</span>
            ))}
          </div>
          <div style={captainHandoffSheetActionRow}>
            <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled} onClick={() => void handleCopyCaptainHandoffSheet()}>
              {copiedCaptainHandoffSheet ? 'Copied handoff' : 'Copy handoff'}
            </PrimarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(lineupBuilderHref, 'lineup')}>
              Open lineup
            </SecondarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(levelUpAvailabilityHref, 'availability')}>
              Chase replies
            </SecondarySmallBtn>
          </div>
        </div>

        <div style={captainHandoffSheetPanel}>
          <div style={captainHandoffSheetCheckGrid}>
            {captainHandoffSheetItems.map((item) => (
              <article key={item.label} style={captainHandoffSheetCheckCard}>
                <div style={captainHandoffSheetCheckTop}>
                  <strong>{item.label}</strong>
                  <span style={item.tone === 'good' ? badgeGreen : item.tone === 'warn' ? warnBadge : badgeBlue}>
                    {item.state}
                  </span>
                </div>
                <span>{item.detail}</span>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )

  const captainPreSendReview = (
    <section style={dynamicCaptainPreSendReviewShell} aria-label="Captain pre-send review">
      <div style={commandCenterHeader}>
        <div>
          <div style={sectionKicker}>Pre-send review</div>
          <h2 style={sectionTitle}>{isMobile ? 'Send with confidence.' : 'Send the lineup after one final check.'}</h2>
        </div>
        <span style={captainPreSendIssueCount > 0 ? warnBadge : captainPreSendReadyCount >= 3 ? badgeGreen : badgeBlue}>
          {captainPreSendIssueCount > 0 ? `${captainPreSendIssueCount} fix` : `${captainPreSendReadyCount}/${captainPreSendChecks.length} ready`}
        </span>
      </div>
      <div style={sectionSub}>
        Confirm courts, arrival details, reply gaps, and backup coverage before the team note goes out.
      </div>

      <div style={captainPreSendHero}>
        <div>
          <div style={commandCenterLabel}>Top send check</div>
          <div style={captainPreSendTitle}>{captainPreSendPrimaryCheck.label}</div>
          <p style={captainPreSendDetail}>{captainPreSendPrimaryCheck.detail}</p>
        </div>
        <span style={captainPreSendPrimaryCheck.tone === 'good' ? badgeGreen : captainPreSendPrimaryCheck.tone === 'warn' ? warnBadge : badgeBlue}>
          {captainPreSendPrimaryCheck.state}
        </span>
      </div>

      <div style={captainQuickCopySummaryCard} aria-label="Captain quick-copy lineup summary">
        <div style={captainQuickCopySummaryHeader}>
          <div>
            <div style={commandCenterLabel}>Quick-copy lineup summary</div>
            <div style={captainQuickCopySummaryTitle}>Copy the team note.</div>
          </div>
          <span style={copiedCaptainLineupSummary ? badgeGreen : badgeBlue}>
            {copiedCaptainLineupSummary ? 'Copied' : `${captainQuickCopyLineupRows.length} line${captainQuickCopyLineupRows.length === 1 ? '' : 's'}`}
          </span>
        </div>
        <div style={captainQuickCopySummaryPreview}>
          {captainQuickCopyPreviewLines.map((line, index) => (
            <span key={`${line}-${index}`}>{line}</span>
          ))}
        </div>
        <div style={captainQuickCopySummaryActionRow}>
          <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled} onClick={() => void handleCopyCaptainLineupSummary()}>
            {copiedCaptainLineupSummary ? 'Copied summary' : 'Copy lineup summary'}
          </PrimarySmallBtn>
          <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(messagingHref, 'messaging')}>
            Open Messages
          </SecondarySmallBtn>
        </div>
      </div>

      <div style={dynamicCaptainPreSendReviewGrid}>
        {captainPreSendChecks.map((item) => (
          <article key={item.label} style={captainPreSendCheckCard}>
            <div style={captainPreSendCheckTop}>
              <strong>{item.label}</strong>
              <span style={item.tone === 'good' ? badgeGreen : item.tone === 'warn' ? warnBadge : badgeBlue}>
                {item.state}
              </span>
            </div>
            <span>{item.detail}</span>
          </article>
        ))}
      </div>

      <div style={captainPreSendActionRow}>
        <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled || captainPreSendIssueCount > 0} onClick={() => handleCaptainNav(messagingHref, 'messaging')}>
          Send lineup note
        </PrimarySmallBtn>
        <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(captainPreSendPrimaryCheck.href, captainPreSendPrimaryCheck.stage)}>
          Fix top check
        </SecondarySmallBtn>
        <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(lineupBuilderHref, 'lineup')}>
          Review courts
        </SecondarySmallBtn>
      </div>
    </section>
  )

  const captainPostSendTracker = (
    <section style={dynamicCaptainPostSendTrackerShell} aria-label="Captain post-send tracker">
      <div style={commandCenterHeader}>
        <div>
          <div style={sectionKicker}>Post-send tracker</div>
          <h2 style={sectionTitle}>{isMobile ? 'Track the chase.' : 'Track what changed after the lineup note.'}</h2>
        </div>
        <span style={captainPostSendChangeCount > 0 ? warnBadge : captainPostSendSent ? badgeGreen : badgeBlue}>
          {captainPostSendChangeCount > 0 ? `${captainPostSendChangeCount} chase` : captainPostSendSent ? 'Sent' : copiedCaptainLineupSummary ? 'Copied' : 'Not sent'}
        </span>
      </div>
      <div style={sectionSub}>
        Watch saved reply changes, court impact, and the next follow-up after the lineup note leaves your phone.
      </div>

      <div style={captainPostSendSummaryGrid}>
        <div style={captainPostSendSummaryCard}>
          <span style={commandCenterSnapshotLabel}>Note</span>
          <strong style={commandCenterSnapshotValue}>{captainPostSendSent ? 'Sent' : copiedCaptainLineupSummary ? 'Copied summary' : 'Ready to send'}</strong>
          <span style={commandCenterSnapshotDetail}>{weekStatusMeta.label}</span>
        </div>
        <div style={captainPostSendSummaryCard}>
          <span style={commandCenterSnapshotLabel}>Replies</span>
          <strong style={commandCenterSnapshotValue}>{matchDayResponseRows.length ? `${matchDayConfirmedCount}/${matchDayResponseRows.length}` : 'None'}</strong>
          <span style={commandCenterSnapshotDetail}>{workspaceState.latestResponseUpdateLabel}</span>
        </div>
        <div style={captainPostSendSummaryCard}>
          <span style={commandCenterSnapshotLabel}>Impact</span>
          <strong style={commandCenterSnapshotValue}>{captainPostSendImpactLabel}</strong>
          <span style={commandCenterSnapshotDetail}>{captainPostSendNextAction}</span>
        </div>
      </div>

      <div style={dynamicCaptainPostSendTrackerGrid}>
        <div style={captainPostSendMain}>
          <div style={captainPostSendTop}>
            <div>
              <div style={commandCenterLabel}>Next chase</div>
              <div style={captainPostSendTitle}>{captainPostSendPrimaryItem.label}</div>
            </div>
            <span style={captainPostSendPrimaryItem.tone === 'good' ? badgeGreen : captainPostSendPrimaryItem.tone === 'warn' ? warnBadge : badgeBlue}>
              {captainPostSendPrimaryItem.state}
            </span>
          </div>
          <p style={captainPostSendDetail}>{captainPostSendPrimaryItem.detail}</p>
          <div style={captainPostSendActionRow}>
            <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled || captainPostSendSent} onClick={() => handleWeekStatusUpdate('ready-to-send')}>
              {captainPostSendSent ? 'Marked sent' : 'Mark note sent'}
            </PrimarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(levelUpAvailabilityHref, 'availability')}>
              Chase replies
            </SecondarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(lineupBuilderHref, 'lineup')}>
              Review impact
            </SecondarySmallBtn>
          </div>
        </div>

        <div style={captainPostSendChangePanel}>
          <div style={commandCenterLabel}>Saved reply changes</div>
          <div style={captainPostSendChangeList}>
            {captainPostSendTrackerItems.map((item) => (
              <article key={item.id} style={captainPostSendChangeCard}>
                <div style={captainPostSendChangeTop}>
                  <strong>{item.label}</strong>
                  <span style={item.tone === 'good' ? badgeGreen : item.tone === 'warn' ? warnBadge : badgeBlue}>
                    {item.state}
                  </span>
                </div>
                <span>{item.detail}</span>
              </article>
            ))}
          </div>
        </div>

        <div style={captainReplyReminderPanel} aria-label="Captain reply reminder templates">
          <div style={captainReplyReminderHeader}>
            <div>
              <div style={commandCenterLabel}>Reply reminder</div>
              <div style={captainReplyReminderTitle}>Copy the next follow-up.</div>
            </div>
            <span style={captainReplyReminderTargets.length ? warnBadge : badgeGreen}>
              {captainReplyReminderTargets.length ? `${captainReplyReminderTargets.length} target${captainReplyReminderTargets.length === 1 ? '' : 's'}` : 'Clear'}
            </span>
          </div>
          <div style={captainReplyReminderTargetList}>
            {captainReplyReminderTargets.length ? captainReplyReminderTargets.map((target) => (
              <span key={target.id} style={target.tone === 'warn' ? captainReplyReminderTargetWarn : captainReplyReminderTarget}>
                {target.name} - {target.status}
              </span>
            )) : (
              <span style={captainReplyReminderTarget}>No open reply chase saved.</span>
            )}
          </div>
          <div style={captainReplyReminderPreview}>
            {captainReplyReminderPrimaryTemplate.body || captainReplyReminderPrimaryTemplate.detail}
          </div>
          <div style={captainReplyReminderActionRow}>
            <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled || !captainReplyReminderPrimaryTemplate.body} onClick={() => void handleCopyCaptainReplyReminder(captainReplyReminderPrimaryTemplate)}>
              {copiedCaptainReplyReminderId === captainReplyReminderPrimaryTemplate.id ? 'Copied reminder' : 'Copy reminder'}
            </PrimarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled || !captainReplyReminderGroupTemplate.body} onClick={() => void handleCopyCaptainReplyReminder(captainReplyReminderGroupTemplate)}>
              {copiedCaptainReplyReminderId === captainReplyReminderGroupTemplate.id ? 'Copied group' : 'Copy group chase'}
            </SecondarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(messagingHref, 'messaging')}>
              Open Messages
            </SecondarySmallBtn>
          </div>
        </div>
      </div>
    </section>
  )

  const captainCommandCenter = (
    <section style={dynamicCommandCenterShell} aria-label="Captain week command center">
      <div style={commandCenterHeader}>
        <div>
          <div style={sectionKicker}>Captain week command center</div>
          <h2 style={sectionTitle}>{isMobile ? "Make this week's call." : "Make this week's call from one lane."}</h2>
        </div>
        <span style={captainReadinessScore >= 80 ? badgeGreen : captainReadinessScore >= 40 ? badgeBlue : warnBadge}>
          {captainReadinessScore}% ready
        </span>
      </div>
      <div style={sectionSub}>
        Start with who can play, choose the lineup, check the pairings, and send the team plan without leaving the match-week lane.
      </div>

      <div style={commandCenterSnapshotGrid} aria-label="Captain week snapshot">
        {captainCommandSnapshots.map((item) => (
          <div key={item.label} style={commandCenterSnapshotCard}>
            <span style={commandCenterSnapshotLabel}>{item.label}</span>
            <strong style={commandCenterSnapshotValue}>{item.value}</strong>
            <span style={commandCenterSnapshotDetail}>{item.detail}</span>
          </div>
        ))}
      </div>

      <div
        style={commandCenterReadinessShell}
        role="progressbar"
        aria-label="Captain week readiness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={captainReadinessScore}
      >
        <div style={commandCenterReadinessTop}>
          <span>Ready for match day</span>
          <strong>{captainReadinessCompleteCount}/{captainReadinessChecks.length}</strong>
        </div>
        <div style={commandCenterReadinessTrack}>
          <span style={{ ...commandCenterReadinessFill, width: `${captainReadinessScore}%` }} />
        </div>
      </div>

      <div style={dynamicCommandCenterGrid}>
        {captainCommandSteps.map((step) => {
          const locked = !hasTeamScope || (step.premium && !premiumEnabled)
          const toneBadge = step.tone === 'good' ? badgeGreen : step.tone === 'warn' ? warnBadge : badgeBlue

          return (
            <article
              key={step.label}
              style={{
                ...dynamicCommandCenterCard,
                ...(step.tone === 'good'
                  ? commandCenterCardGood
                  : step.tone === 'warn'
                    ? commandCenterCardWarn
                    : commandCenterCardInfo),
                ...(locked ? commandCenterCardLocked : null),
              }}
            >
              <div style={commandCenterTopRow}>
                <div style={commandCenterLabelCluster}>
                  <TiqFeatureIcon name={step.icon} size="sm" variant="ghost" />
                  <span style={commandCenterLabel}>{step.label}</span>
                </div>
                <span style={locked ? badgeSlate : toneBadge}>
                  {!hasTeamScope ? 'Choose team' : step.premium && !premiumEnabled ? 'Captain tier' : step.stateLabel}
                </span>
              </div>

              <div>
                <div style={commandCenterTitle}>{step.title}</div>
                <div style={commandCenterText}>
                  {locked && step.premium && !premiumEnabled ? CAPTAIN_STORY.lockedMessage : step.detail}
                </div>
              </div>

              <div style={commandCenterActionRow}>
                <PrimarySmallBtn
                  fullWidth={isMobile}
                  disabled={locked}
                  onClick={() => {
                    if (locked) return
                    handleCaptainNav(step.href, step.stage)
                  }}
                >
                  {step.cta}
                </PrimarySmallBtn>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )

  const captainCourtConfidenceMeter = (
    <section style={dynamicCaptainCourtConfidenceShell} aria-label="Captain court confidence meter">
      <div style={commandCenterHeader}>
        <div>
          <div style={sectionKicker}>Court confidence meter</div>
          <h2 style={sectionTitle}>{isMobile ? 'Trust the courts.' : 'Trust the courts before you send the lineup.'}</h2>
        </div>
        <span style={captainCourtBackupCount > 0 ? warnBadge : captainCourtWatchCount > 0 ? badgeBlue : badgeGreen}>
          {matchDayLineupRows.length ? `${captainCourtConfidencePercent}% solid` : 'Build lineup'}
        </span>
      </div>
      <div style={sectionSub}>
        Spot solid courts, backup needs, and rating-watch calls before the final team note goes out.
      </div>

      <div style={captainCourtConfidenceSummary}>
        <div
          style={captainCourtConfidenceTrack}
          role="progressbar"
          aria-label="Captain court confidence"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={captainCourtConfidencePercent}
        >
          <span style={{ ...captainCourtConfidenceFill, width: `${captainCourtConfidencePercent}%` }} />
        </div>
        <div style={captainCourtConfidenceStats}>
          <div style={captainCourtConfidenceStatCard}>
            <span style={commandCenterSnapshotLabel}>Solid</span>
            <strong style={commandCenterSnapshotValue}>{captainCourtSolidCount}</strong>
          </div>
          <div style={captainCourtConfidenceStatCard}>
            <span style={commandCenterSnapshotLabel}>Watch</span>
            <strong style={commandCenterSnapshotValue}>{captainCourtWatchCount}</strong>
          </div>
          <div style={captainCourtConfidenceStatCard}>
            <span style={commandCenterSnapshotLabel}>Backup</span>
            <strong style={commandCenterSnapshotValue}>{captainCourtBackupCount}</strong>
          </div>
        </div>
      </div>

      <div style={dynamicCaptainCourtConfidenceGrid}>
        {captainCourtConfidenceItems.map((item) => (
          <article key={item.label} style={captainCourtConfidenceCard}>
            <div style={captainCourtConfidenceTop}>
              <strong>{item.label}</strong>
              <span style={item.tone === 'good' ? badgeGreen : item.tone === 'warn' ? warnBadge : badgeBlue}>
                {item.state}
              </span>
            </div>
            <div style={captainCourtConfidenceBody}>
              <span style={captainCourtConfidencePlayers}>{item.players}</span>
              <span>{item.detail}</span>
            </div>
          </article>
        ))}
      </div>

      <div style={captainCourtConfidenceActionRow}>
        <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(lineupBuilderHref, 'lineup')}>
          Review lineup
        </PrimarySmallBtn>
        <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(lineupProjectionHref, 'projection')}>
          Check pairings
        </SecondarySmallBtn>
        <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(messagingHref, 'messaging')}>
          Send final note
        </SecondarySmallBtn>
      </div>
    </section>
  )

  const captainBenchReadinessRail = (
    <section style={dynamicCaptainBenchReadinessShell} aria-label="Captain bench readiness rail">
      <div style={commandCenterHeader}>
        <div>
          <div style={sectionKicker}>Bench readiness rail</div>
          <h2 style={sectionTitle}>{isMobile ? 'Know the next call.' : 'Know the next backup call before a court moves.'}</h2>
        </div>
        <span style={captainBenchWatchCount > 0 ? warnBadge : captainBenchReadyCount > 0 ? badgeGreen : badgeBlue}>
          {captainBenchWatchCount > 0 ? `${captainBenchWatchCount} watch` : `${captainBenchReadinessItems.length} ready`}
        </span>
      </div>
      <div style={sectionSub}>
        Rank backup options by singles or doubles fit, rating signal, and recent match history before the warm-up scramble.
      </div>

      <div style={dynamicCaptainBenchReadinessGrid}>
        <div style={captainBenchReadinessLead}>
          <div style={captainBenchReadinessTop}>
            <div>
              <div style={commandCenterLabel}>Best bench read</div>
              <div style={captainBenchReadinessName}>{captainBenchPrimaryItem.name}</div>
            </div>
            <span style={captainBenchPrimaryItem.tone === 'good' ? badgeGreen : captainBenchPrimaryItem.tone === 'warn' ? warnBadge : badgeBlue}>
              {captainBenchPrimaryItem.priority}
            </span>
          </div>
          <div style={captainBenchReadinessSignalGrid}>
            <div style={captainBenchReadinessSignalCard}>
              <span style={commandCenterSnapshotLabel}>Fit</span>
              <strong style={commandCenterSnapshotValue}>{captainBenchPrimaryItem.fit}</strong>
            </div>
            <div style={captainBenchReadinessSignalCard}>
              <span style={commandCenterSnapshotLabel}>Signal</span>
              <strong style={commandCenterSnapshotValue}>{captainBenchPrimaryItem.signal}</strong>
            </div>
          </div>
          <p style={captainBenchReadinessDetail}>{captainBenchPrimaryItem.detail}</p>
        </div>

        <div style={captainBenchReadinessListPanel}>
          <div style={commandCenterLabel}>Backup calls</div>
          <div style={captainBenchReadinessList}>
            {captainBenchReadinessItems.map((item) => (
              <article key={item.id} style={captainBenchReadinessCard}>
                <div style={captainBenchReadinessCardTop}>
                  <strong>{item.name}</strong>
                  <span style={item.tone === 'good' ? badgeGreen : item.tone === 'warn' ? warnBadge : badgeBlue}>
                    {item.signal}
                  </span>
                </div>
                <div style={captainBenchReadinessMeta}>
                  <span>{item.fit}</span>
                  <span>{item.priority}</span>
                </div>
                <span>{item.detail}</span>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div style={captainBenchReadinessActionRow}>
        <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(messagingHref, 'messaging')}>
          Message bench
        </PrimarySmallBtn>
        <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(levelUpAvailabilityHref, 'availability')}>
          Check availability
        </SecondarySmallBtn>
        <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(lineupBuilderHref, 'lineup')}>
          Review lineup
        </SecondarySmallBtn>
      </div>
    </section>
  )

  const captainCourtSwapAssistant = (
    <section style={dynamicCaptainCourtSwapShell} aria-label="Captain court swap assistant">
      <div style={commandCenterHeader}>
        <div>
          <div style={sectionKicker}>Court swap assistant</div>
          <h2 style={sectionTitle}>{isMobile ? 'Swap without guessing.' : 'Swap a player without rebuilding every court.'}</h2>
        </div>
        <span style={captainCourtSwapNeedsCount > 0 ? warnBadge : workspaceState.lineupReady ? badgeGreen : badgeBlue}>
          {captainCourtSwapNeedsCount > 0 ? `${captainCourtSwapNeedsCount} move` : workspaceState.lineupReady ? 'Plan stable' : 'Build lineup'}
        </span>
      </div>
      <div style={sectionSub}>
        See the court to protect, the bench call to make, and what should stay untouched before you text changes.
      </div>

      <div style={dynamicCaptainCourtSwapGrid}>
        <div style={captainCourtSwapLead}>
          <div style={captainCourtSwapTop}>
            <div>
              <div style={commandCenterLabel}>Least disruption move</div>
              <div style={captainCourtSwapCourt}>{captainCourtSwapPrimaryItem.courtLabel}</div>
            </div>
            <span style={captainCourtSwapPrimaryItem.tone === 'good' ? badgeGreen : captainCourtSwapPrimaryItem.tone === 'warn' ? warnBadge : badgeBlue}>
              {captainCourtSwapPrimaryItem.state}
            </span>
          </div>
          <div style={captainCourtSwapSignalGrid}>
            <div style={captainCourtSwapSignalCard}>
              <span style={commandCenterSnapshotLabel}>Replace</span>
              <strong style={commandCenterSnapshotValue}>{captainCourtSwapPrimaryItem.outPlayer}</strong>
            </div>
            <div style={captainCourtSwapSignalCard}>
              <span style={commandCenterSnapshotLabel}>Use</span>
              <strong style={commandCenterSnapshotValue}>{captainCourtSwapPrimaryItem.inPlayer}</strong>
            </div>
            <div style={captainCourtSwapSignalCard}>
              <span style={commandCenterSnapshotLabel}>Keep</span>
              <strong style={commandCenterSnapshotValue}>{captainCourtSwapPrimaryItem.keep}</strong>
            </div>
          </div>
          <p style={captainCourtSwapDetail}>{captainCourtSwapPrimaryItem.detail}</p>
        </div>

        <div style={captainCourtSwapListPanel}>
          <div style={captainCourtSwapListHeader}>
            <div style={commandCenterLabel}>Swap options</div>
            <span style={captainCourtSwapStableCount > 0 ? badgeGreen : badgeBlue}>
              {captainCourtSwapStableCount > 0 ? `${captainCourtSwapStableCount} stable` : 'Review'}
            </span>
          </div>
          <div style={captainCourtSwapList}>
            {captainCourtSwapItems.map((item) => (
              <article key={item.id} style={captainCourtSwapCard}>
                <div style={captainCourtSwapCardTop}>
                  <strong>{item.courtLabel}</strong>
                  <span style={item.tone === 'good' ? badgeGreen : item.tone === 'warn' ? warnBadge : badgeBlue}>
                    {item.state}
                  </span>
                </div>
                <div style={captainCourtSwapMeta}>
                  <span>{item.outPlayer}</span>
                  <span>{item.inPlayer}</span>
                </div>
                <span>{item.detail}</span>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div style={captainCourtSwapActionRow}>
        <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(messagingHref, 'messaging')}>
          Message change
        </PrimarySmallBtn>
        <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(lineupBuilderHref, 'lineup')}>
          Adjust lineup
        </SecondarySmallBtn>
        <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(levelUpAvailabilityHref, 'availability')}>
          Check replies
        </SecondarySmallBtn>
      </div>
    </section>
  )

  const captainMatchDaySheet = (
    <section style={dynamicMatchDaySheetShell} aria-label="Captain match day sheet">
      <div style={commandCenterHeader}>
        <div>
          <div style={sectionKicker}>Match day sheet</div>
          <h2 style={sectionTitle}>{isMobile ? 'Carry the court plan.' : 'Carry the court plan into match day.'}</h2>
        </div>
        <span style={matchDaySubRiskCount > 0 ? warnBadge : workspaceState.lineupReady ? badgeGreen : badgeBlue}>
          {matchDaySubRiskCount > 0 ? 'Sub risk' : workspaceState.lineupReady ? 'Lineup ready' : 'Build sheet'}
        </span>
      </div>
      <div style={sectionSub}>
        See today&apos;s courts, confirmation gaps, arrival details, and the scorecard handoff before players arrive.
      </div>

      <div style={matchDayLogisticsGrid} aria-label="Match day logistics">
        <div style={matchDayLogisticsCard}>
          <span style={commandCenterSnapshotLabel}>Match</span>
          <strong style={commandCenterSnapshotValue}>{weekAtGlance.eventDateLabel}</strong>
          <span style={commandCenterSnapshotDetail}>Opponent: {weekAtGlance.opponentLabel}</span>
        </div>
        <div style={matchDayLogisticsCard}>
          <span style={commandCenterSnapshotLabel}>Arrival</span>
          <strong style={commandCenterSnapshotValue}>{matchDayArrivalLabel}</strong>
          <span style={commandCenterSnapshotDetail}>{matchDayLocationLabel}</span>
        </div>
      </div>

      <div style={dynamicMatchDaySheetGrid}>
        <div style={matchDaySheetMain}>
          <div style={matchDaySheetTop}>
            <div>
              <div style={commandCenterLabel}>Today&apos;s lineup</div>
              <div style={matchDaySheetTitle}>{workspaceState.lineupReady ? `${workspaceState.lineupCount} saved court${workspaceState.lineupCount === 1 ? '' : 's'}` : 'No court plan saved yet'}</div>
            </div>
            <span style={workspaceState.lineupReady ? badgeGreen : warnBadge}>
              {workspaceState.lineupReady ? 'Ready' : 'Draft'}
            </span>
          </div>

          {matchDayLineupPreview.length ? (
            <div style={matchDayLineupStack} aria-label="Match day court cards">
              {matchDayLineupPreview.map((row, index) => {
                const courtLabel = safeText(row.court_label, `Court ${index + 1}`)
                const playerLabel = row.players?.filter(Boolean).join(' / ') || 'Players not set'

                return (
                  <article key={row.id || `${courtLabel}-${index}`} style={matchDayCourtCard}>
                    <div style={matchDayCourtTop}>
                      <span style={matchDayCourtLabel}>{courtLabel}</span>
                      <span style={badgeSlate}>{safeText(row.slot_type, 'court')}</span>
                    </div>
                    <strong style={matchDayCourtPlayers}>{playerLabel}</strong>
                  </article>
                )
              })}
              {matchDayLineupRows.length > matchDayLineupPreview.length ? (
                <div style={matchDayMoreLineups}>
                  +{matchDayLineupRows.length - matchDayLineupPreview.length} more saved court{matchDayLineupRows.length - matchDayLineupPreview.length === 1 ? '' : 's'} in Lineup Builder.
                </div>
              ) : null}
            </div>
          ) : (
            <div style={emptyLine}>
              Build the lineup first so match day opens with court assignments instead of memory work.
            </div>
          )}
        </div>

        <div style={matchDayChecklistPanel}>
          <div style={commandCenterLabel}>At-court checks</div>
          <div style={matchDayChecklistGrid}>
            {matchDayChecklist.map((item) => (
              <div key={item.label} style={matchDayChecklistItem}>
                <div style={matchDayChecklistTop}>
                  <strong>{item.label}</strong>
                  <span style={item.tone === 'good' ? badgeGreen : item.tone === 'warn' ? warnBadge : badgeBlue}>
                    {item.state}
                  </span>
                </div>
                <span>{item.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={matchDaySubBoardShell} aria-label="Captain sub board">
        <div style={matchDaySubBoardHeader}>
          <div>
            <div style={commandCenterLabel}>Sub board</div>
            <div style={matchDaySheetTitle}>{isMobile ? 'Cover late changes.' : 'Cover late changes before warm-up.'}</div>
          </div>
          <span style={matchDaySubRiskCount > 0 ? warnBadge : matchDayNotConfirmedCount > 0 ? badgeBlue : badgeGreen}>
            {matchDaySubRiskCount > 0 ? `${matchDaySubRiskCount} flag${matchDaySubRiskCount === 1 ? '' : 's'}` : matchDayNotConfirmedCount > 0 ? 'Check replies' : 'Keep plan'}
          </span>
        </div>
        <div style={sectionSub}>
          Keep a short list of backup calls, court flags, and lineup handoffs ready for the five minutes before warm-up.
        </div>

        <div style={dynamicMatchDaySubBoardGrid}>
          <div style={matchDaySubPanel}>
            <div style={commandCenterLabel}>Court watch</div>
            <div style={matchDaySubList}>
              {matchDaySubBoardFlags.map((flag) => (
                <article key={flag.key} style={matchDaySubCard}>
                  <div style={matchDayChecklistTop}>
                    <strong>{flag.label}</strong>
                    <span style={flag.tone === 'good' ? badgeGreen : flag.tone === 'warn' ? warnBadge : badgeBlue}>
                      {flag.state}
                    </span>
                  </div>
                  <span>{flag.detail}</span>
                </article>
              ))}
            </div>
          </div>

          <div style={matchDaySubPanel}>
            <div style={commandCenterLabel}>Backup reads</div>
            {matchDaySubCandidates.length ? (
              <div style={matchDaySubList}>
                {matchDaySubCandidates.map((candidate) => (
                  <article key={candidate.id} style={matchDaySubCandidateCard}>
                    <div style={matchDaySubCandidateTop}>
                      <strong style={matchDaySubCandidateName}>{candidate.name}</strong>
                      <span style={candidate.tone === 'good' ? badgeGreen : candidate.tone === 'warn' ? warnBadge : badgeBlue}>
                        {candidate.signal}
                      </span>
                    </div>
                    <div style={matchDaySubCandidateFit}>{candidate.fit}</div>
                    <span>{candidate.detail}</span>
                  </article>
                ))}
              </div>
            ) : (
              <div style={emptyLine}>
                Add roster depth so backup calls show before match day gets tight.
              </div>
            )}
          </div>
        </div>

        <div style={matchDaySubActionRow}>
          <SecondarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(availabilityHref, 'availability')}>
            Find backup
          </SecondarySmallBtn>
          <SecondarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(lineupBuilderHref, 'lineup')}>
            Move in lineup
          </SecondarySmallBtn>
          <SecondarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(messagingHref, 'messaging')}>
            Send sub update
          </SecondarySmallBtn>
        </div>
      </div>

      <div style={matchDayActionRow}>
        <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(messagingHref, 'messaging')}>
          Send final note
        </PrimarySmallBtn>
        <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(availabilityHref, 'availability')}>
          Follow up gaps
        </SecondarySmallBtn>
        <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(lineupBuilderHref, 'lineup')}>
          Edit lineup
        </SecondarySmallBtn>
        <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(dataAssistCaptainHref, 'team')}>
          Upload scorecard
        </SecondarySmallBtn>
      </div>
    </section>
  )

  const captainScoreCaptureChecklist = (
    <section style={dynamicCaptainScoreCaptureShell} aria-label="Captain score capture checklist">
      <div style={commandCenterHeader}>
        <div>
          <div style={sectionKicker}>Score capture</div>
          <h2 style={sectionTitle}>{isMobile ? 'Tap each court.' : 'Capture each court before the details fade.'}</h2>
        </div>
        <span style={captainScoreCaptureIssueCount > 0 ? warnBadge : captainScoreCapturePendingCount > 0 ? badgeBlue : captainScoreCaptureRows.length ? badgeGreen : warnBadge}>
          {captainScoreCaptureStatusLabel}
        </span>
      </div>
      <div style={sectionSub}>
        Mark scores, issues, and completed courts from the saved lineup so the scorecard trail stays clean after play.
      </div>

      <div style={captainScoreCaptureSummaryGrid} aria-label="Score capture summary">
        <div style={captainScoreCaptureSummaryCard}>
          <span style={commandCenterSnapshotLabel}>Logged</span>
          <strong style={commandCenterSnapshotValue}>{captainScoreCaptureLoggedCount}/{captainScoreCaptureRows.length || workspaceState.lineupCount}</strong>
          <span style={commandCenterSnapshotDetail}>Score captured or complete</span>
        </div>
        <div style={captainScoreCaptureSummaryCard}>
          <span style={commandCenterSnapshotLabel}>Open</span>
          <strong style={commandCenterSnapshotValue}>{captainScoreCapturePendingCount}</strong>
          <span style={commandCenterSnapshotDetail}>Still needs a tap</span>
        </div>
        <div style={captainScoreCaptureSummaryCard}>
          <span style={commandCenterSnapshotLabel}>Issues</span>
          <strong style={commandCenterSnapshotValue}>{captainScoreCaptureIssueCount}</strong>
          <span style={commandCenterSnapshotDetail}>Needs captain note</span>
        </div>
      </div>

      <div style={dynamicCaptainScoreCaptureGrid}>
        <div style={captainScoreCaptureHero}>
          <div style={captainScoreCaptureHeroTop}>
            <div>
              <div style={commandCenterLabel}>Next court</div>
              <div style={captainScoreCaptureTitle}>{captainScoreCapturePrimaryRow?.courtLabel || 'No courts saved'}</div>
            </div>
            <span style={captainScoreCapturePrimaryRow?.tone === 'warn' ? warnBadge : captainScoreCapturePrimaryRow?.tone === 'good' ? badgeGreen : badgeBlue}>
              {captainScoreCapturePrimaryRow?.statusLabel || 'Build lineup'}
            </span>
          </div>
          <p style={captainScoreCaptureDetail}>
            {captainScoreCapturePrimaryRow
              ? captainScoreCapturePrimaryRow.playerLabel
              : 'Save lineup courts first, then score capture becomes a court-by-court checklist.'}
          </p>
          <div style={captainScoreCaptureActionRow}>
            <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled || !captainScoreCapturePrimaryRow} onClick={() => captainScoreCapturePrimaryRow ? handleCaptainScoreCapture(captainScoreCapturePrimaryRow.row, captainScoreCapturePrimaryRow.index, 'score-captured') : undefined}>
              Mark score
            </PrimarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled || !captainScoreCapturePrimaryRow} onClick={() => captainScoreCapturePrimaryRow ? handleCaptainScoreCapture(captainScoreCapturePrimaryRow.row, captainScoreCapturePrimaryRow.index, 'issue') : undefined}>
              Note issue
            </SecondarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled || !captainScoreCapturePrimaryRow} onClick={() => captainScoreCapturePrimaryRow ? handleCaptainScoreCapture(captainScoreCapturePrimaryRow.row, captainScoreCapturePrimaryRow.index, 'complete') : undefined}>
              Mark complete
            </SecondarySmallBtn>
          </div>
        </div>

        <div style={captainScoreCapturePanel}>
          <div style={captainScoreCaptureList}>
            {captainScoreCaptureRows.length ? captainScoreCaptureRows.map((item) => (
              <article key={item.courtKey} style={captainScoreCaptureCard}>
                <div style={captainScoreCaptureCardTop}>
                  <div>
                    <span style={matchDayCourtLabel}>{item.courtLabel}</span>
                    <strong style={captainScoreCapturePlayers}>{item.playerLabel}</strong>
                  </div>
                  <span style={item.tone === 'warn' ? warnBadge : item.tone === 'good' ? badgeGreen : badgeBlue}>
                    {item.statusLabel}
                  </span>
                </div>
                <div style={captainScoreCaptureButtonGrid}>
                  <button type="button" disabled={!hasTeamScope || !premiumEnabled} style={item.status === 'score-captured' ? captainScoreCaptureChoiceActive : captainScoreCaptureChoice} onClick={() => handleCaptainScoreCapture(item.row, item.index, 'score-captured')}>
                    Score
                  </button>
                  <button type="button" disabled={!hasTeamScope || !premiumEnabled} style={item.status === 'issue' ? captainScoreCaptureChoiceWarn : captainScoreCaptureChoice} onClick={() => handleCaptainScoreCapture(item.row, item.index, 'issue')}>
                    Issue
                  </button>
                  <button type="button" disabled={!hasTeamScope || !premiumEnabled} style={item.status === 'complete' ? captainScoreCaptureChoiceActive : captainScoreCaptureChoice} onClick={() => handleCaptainScoreCapture(item.row, item.index, 'complete')}>
                    Done
                  </button>
                </div>
                <small>{item.updatedLabel || 'Not tapped yet'}</small>
              </article>
            )) : (
              <article style={captainScoreCaptureCard}>
                <div style={captainScoreCaptureCardTop}>
                  <strong>No courts saved yet</strong>
                  <span style={warnBadge}>Draft</span>
                </div>
                <span>Build the lineup first so score capture starts with named courts.</span>
              </article>
            )}
          </div>
        </div>
      </div>
    </section>
  )

  const captainPostMatchRecapBuilder = (
    <section style={dynamicCaptainPostMatchRecapShell} aria-label="Captain post-match recap builder">
      <div style={commandCenterHeader}>
        <div>
          <div style={sectionKicker}>Recap builder</div>
          <h2 style={sectionTitle}>{isMobile ? 'Send the recap.' : 'Turn closeout into a clean team recap.'}</h2>
        </div>
        <span style={captainPostMatchRecapTone === 'warn' ? warnBadge : captainPostMatchRecapTone === 'good' ? badgeGreen : badgeBlue}>
          {captainPostMatchRecapPrimaryState}
        </span>
      </div>
      <div style={sectionSub}>
        Build a short post-match note from score capture, issue taps, and the captain decision trail before the ride home.
      </div>

      <div style={dynamicCaptainPostMatchRecapGrid}>
        <div style={captainPostMatchRecapHero}>
          <div style={captainPostMatchRecapHeroTop}>
            <div>
              <div style={commandCenterLabel}>Team recap</div>
              <div style={captainPostMatchRecapTitle}>{captainScoreCaptureRows.length ? 'Ready to copy' : 'Capture scores first'}</div>
            </div>
            <span style={copiedCaptainPostMatchRecap ? badgeGreen : captainPostMatchRecapTone === 'warn' ? warnBadge : badgeBlue}>
              {copiedCaptainPostMatchRecap ? 'Copied' : captainPostMatchRecapPrimaryState}
            </span>
          </div>
          <div style={captainPostMatchRecapPreview}>
            {captainPostMatchRecapPreviewLines.map((line, index) => (
              <span key={`${line}-${index}`}>{line}</span>
            ))}
          </div>
          <div style={captainPostMatchRecapActionRow}>
            <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled || !captainScoreCaptureRows.length} onClick={() => void handleCopyCaptainPostMatchRecap()}>
              {copiedCaptainPostMatchRecap ? 'Copied recap' : 'Copy recap'}
            </PrimarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(messagingHref, 'messaging')}>
              Open Messages
            </SecondarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(dataAssistCaptainHref, 'team')}>
              Upload scorecard
            </SecondarySmallBtn>
          </div>
        </div>

        <div style={captainPostMatchRecapPanel}>
          <div style={captainPostMatchRecapStatGrid}>
            <div style={captainPostMatchRecapStatCard}>
              <span style={commandCenterSnapshotLabel}>Captured</span>
              <strong style={commandCenterSnapshotValue}>{captainScoreCaptureLoggedCount}/{captainScoreCaptureRows.length || workspaceState.lineupCount}</strong>
              <span style={commandCenterSnapshotDetail}>Court scores ready</span>
            </div>
            <div style={captainPostMatchRecapStatCard}>
              <span style={commandCenterSnapshotLabel}>Issues</span>
              <strong style={commandCenterSnapshotValue}>{captainScoreCaptureIssueCount}</strong>
              <span style={commandCenterSnapshotDetail}>Called out in recap</span>
            </div>
          </div>
          <div style={captainPostMatchRecapList}>
            {captainPostMatchRecapIssueRows.length ? captainPostMatchRecapIssueRows.map((row) => (
              <article key={row.courtKey} style={captainPostMatchRecapCard}>
                <div style={captainPostMatchRecapCardTop}>
                  <strong>{row.courtLabel}</strong>
                  <span style={warnBadge}>Issue</span>
                </div>
                <span>{row.playerLabel}</span>
              </article>
            )) : (
              <article style={captainPostMatchRecapCard}>
                <div style={captainPostMatchRecapCardTop}>
                  <strong>No issue taps</strong>
                  <span style={badgeGreen}>Clear</span>
                </div>
                <span>Score capture has no issue rows saved for this match.</span>
              </article>
            )}
            {captainPostMatchRecapRecentDecisions.length ? captainPostMatchRecapRecentDecisions.map((entry) => (
              <article key={entry.id || `${entry.label}-${entry.created_at}`} style={captainPostMatchRecapCard}>
                <div style={captainPostMatchRecapCardTop}>
                  <strong>{safeText(entry.label, 'Captain call')}</strong>
                  <span style={entry.tone === 'warn' ? warnBadge : entry.tone === 'good' ? badgeGreen : badgeBlue}>
                    {safeText(entry.action, 'Saved')}
                  </span>
                </div>
                <span>{safeText(entry.detail, 'Decision saved for this week.')}</span>
              </article>
            )) : null}
          </div>
        </div>
      </div>
    </section>
  )

  const captainSeasonLaunchChecklist = (
    <section style={dynamicSeasonLaunchShell} aria-label="Captain season launch checklist">
      <div style={commandCenterHeader}>
        <div>
          <div style={sectionKicker}>Season launch checklist</div>
          <h2 style={sectionTitle}>{isMobile ? 'Start the season clean.' : 'Start the season with the team ready.'}</h2>
        </div>
        <span style={captainSeasonLaunchReadyCount >= 3 ? badgeGreen : captainSeasonLaunchReadyCount >= 2 ? badgeBlue : warnBadge}>
          {captainSeasonLaunchReadyCount}/{captainSeasonLaunchItems.length} ready
        </span>
      </div>
      <div style={sectionSub}>
        Check roster depth, schedule context, rating watch, and week-one rhythm before the first lineup decision lands.
      </div>

      <div style={seasonLaunchSnapshotGrid} aria-label="Season launch snapshot">
        <div style={seasonLaunchSnapshotCard}>
          <span style={commandCenterSnapshotLabel}>Roster</span>
          <strong style={commandCenterSnapshotValue}>{roster.length ? `${roster.length} players` : 'Needs import'}</strong>
          <span style={commandCenterSnapshotDetail}>{rosterSignalSummary.atRisk > 0 ? `${rosterSignalSummary.atRisk} rating watches` : rosterSignalSummary.trendingUp > 0 ? `${rosterSignalSummary.trendingUp} trending up` : 'Baseline before week one'}</span>
        </div>
        <div style={seasonLaunchSnapshotCard}>
          <span style={commandCenterSnapshotLabel}>Schedule</span>
          <strong style={commandCenterSnapshotValue}>{matches.length ? `${matches.length} matches` : 'Needs schedule'}</strong>
          <span style={commandCenterSnapshotDetail}>{weekAtGlance.eventDateLabel}</span>
        </div>
        <div style={seasonLaunchSnapshotCard}>
          <span style={commandCenterSnapshotLabel}>Week one</span>
          <strong style={commandCenterSnapshotValue}>{workspaceState.lineupReady ? 'Lineup started' : 'Open'}</strong>
          <span style={commandCenterSnapshotDetail}>{workspaceState.pendingResponseCount > 0 ? `${workspaceState.pendingResponseCount} replies waiting` : 'Availability rhythm ready'}</span>
        </div>
      </div>

      <div style={dynamicSeasonLaunchGrid}>
        {captainSeasonLaunchItems.map((item) => {
          const locked = !hasTeamScope || !premiumEnabled
          const toneBadge = item.tone === 'good' ? badgeGreen : item.tone === 'warn' ? warnBadge : badgeBlue

          return (
            <article key={item.label} style={seasonLaunchCard}>
              <div style={seasonLaunchCardTop}>
                <span style={commandCenterLabel}>{item.label}</span>
                <span style={locked ? badgeSlate : toneBadge}>
                  {!hasTeamScope ? 'Choose team' : item.state}
                </span>
              </div>
              <div style={seasonLaunchCardDetail}>
                {locked ? 'Choose the team, league, and flight so season prep opens with the right roster and schedule.' : item.detail}
              </div>
              <div style={seasonLaunchActionRow}>
                <SecondarySmallBtn
                  fullWidth={isMobile}
                  disabled={locked}
                  onClick={() => {
                    if (locked) return
                    handleCaptainNav(item.href, item.stage)
                  }}
                >
                  {item.cta}
                </SecondarySmallBtn>
              </div>
            </article>
          )
        })}
      </div>

      <div style={seasonLaunchActionRow}>
        <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(availabilityHref, 'availability')}>
          Start availability
        </PrimarySmallBtn>
        <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(dataAssistCaptainHref, 'team')}>
          Refresh team data
        </SecondarySmallBtn>
        <SecondarySmallBtn disabled={!hasTeamScope || !leagueToolsEnabled} onClick={() => handleCaptainNav(seasonDashboardHref, 'season-dashboard')}>
          Season tools
        </SecondarySmallBtn>
      </div>
    </section>
  )

  const captainOpponentScoutPocket = (
    <section style={dynamicOpponentScoutShell} aria-label="Captain opponent scout pocket">
      <div style={commandCenterHeader}>
        <div>
          <div style={sectionKicker}>Opponent scout pocket</div>
          <h2 style={sectionTitle}>{isMobile ? 'Know the other side.' : 'Know the other side before you set courts.'}</h2>
        </div>
        <span style={opponentScoutReadyCount >= 3 ? badgeGreen : opponentScoutReadyCount >= 2 ? badgeBlue : warnBadge}>
          {opponentScoutReadyCount}/{opponentScoutChecks.length} ready
        </span>
      </div>
      <div style={sectionSub}>
        Keep opponent, venue, scout notes, and pairing evidence close before the lineup decision gets rushed.
      </div>

      <div style={dynamicOpponentScoutGrid}>
        <div style={opponentScoutMain}>
          <div style={opponentScoutHeroTop}>
            <div>
              <div style={commandCenterLabel}>Next opponent</div>
              <div style={opponentScoutTitle}>{weekAtGlance.opponentLabel}</div>
            </div>
            <span style={nextMatch?.home ? badgeGreen : nextMatch ? badgeBlue : warnBadge}>
              {opponentScoutHomeAwayLabel}
            </span>
          </div>
          <div style={opponentScoutMetaGrid}>
            <div style={opponentScoutMetaCard}>
              <span style={commandCenterSnapshotLabel}>Date</span>
              <strong style={commandCenterSnapshotValue}>{weekAtGlance.eventDateLabel}</strong>
            </div>
            <div style={opponentScoutMetaCard}>
              <span style={commandCenterSnapshotLabel}>Site</span>
              <strong style={commandCenterSnapshotValue}>{nextMatch?.facility || matchDayLocationLabel}</strong>
            </div>
          </div>
          <div style={opponentScoutNoteCard}>
            <span style={commandCenterLabel}>Scout note</span>
            <span>{opponentScoutNoteReady ? opponentScoutNotes.trim().slice(0, 180) : 'Add patterns to exploit, likely pairings, pressure points, or court tendencies before you build the lineup.'}</span>
          </div>
        </div>

        <div style={opponentScoutChecklist}>
          <div style={commandCenterLabel}>Scout checks</div>
          <div style={opponentScoutList}>
            {opponentScoutChecks.map((item) => (
              <div key={item.label} style={opponentScoutItem}>
                <div style={opponentScoutItemTop}>
                  <strong>{item.label}</strong>
                  <span style={item.tone === 'good' ? badgeGreen : item.tone === 'warn' ? warnBadge : badgeBlue}>
                    {item.state}
                  </span>
                </div>
                <span>{item.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={opponentScoutActionRow}>
        <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(teamBriefHref, 'brief')}>
          Open scout brief
        </PrimarySmallBtn>
        <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(lineupProjectionHref, 'projection')}>
          Check pairings
        </SecondarySmallBtn>
        <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(analyticsHref, 'analytics')}>
          Review patterns
        </SecondarySmallBtn>
      </div>
    </section>
  )

  const captainPlayerReadinessPulse = (
    <section style={dynamicPlayerReadinessPulseShell} aria-label="Captain player readiness pulse">
      <div style={commandCenterHeader}>
        <div>
          <div style={sectionKicker}>Player readiness pulse</div>
          <h2 style={sectionTitle}>{isMobile ? 'Know who is ready.' : 'Know who is ready before you lock courts.'}</h2>
        </div>
        <span style={playerReadinessRiskCount > 0 ? warnBadge : playerReadinessReadyCount >= 2 ? badgeGreen : badgeBlue}>
          {playerReadinessRiskCount > 0 ? `${playerReadinessRiskCount} watch` : `${playerReadinessReadyCount}/${playerReadinessPulseChecks.length} clear`}
        </span>
      </div>
      <div style={sectionSub}>
        See confirmations, follow-ups, sub risk, and practice needs in one quick read before match day.
      </div>

      <div style={dynamicPlayerReadinessPulseGrid}>
        <div style={playerReadinessMain}>
          <div style={playerReadinessScoreTop}>
            <div>
              <div style={commandCenterLabel}>Team pulse</div>
              <div style={playerReadinessScoreValue}>{playerReadinessConfirmedLabel}</div>
            </div>
            <span style={matchDayNotConfirmedCount > 0 || matchDaySubRiskCount > 0 ? warnBadge : matchDayResponseRows.length ? badgeGreen : badgeBlue}>
              {matchDayResponseRows.length ? 'Replies saved' : 'Ask team'}
            </span>
          </div>

          <div style={playerReadinessMetricGrid}>
            <div style={playerReadinessMetricCard}>
              <span style={commandCenterSnapshotLabel}>Confirmed</span>
              <strong style={commandCenterSnapshotValue}>{matchDayConfirmedCount}</strong>
            </div>
            <div style={playerReadinessMetricCard}>
              <span style={commandCenterSnapshotLabel}>Open replies</span>
              <strong style={commandCenterSnapshotValue}>{matchDayNotConfirmedCount}</strong>
            </div>
            <div style={playerReadinessMetricCard}>
              <span style={commandCenterSnapshotLabel}>Rating watch</span>
              <strong style={commandCenterSnapshotValue}>{rosterSignalSummary.atRisk}</strong>
            </div>
          </div>
        </div>

        <div style={playerReadinessChecklist}>
          <div style={commandCenterLabel}>Readiness checks</div>
          <div style={playerReadinessList}>
            {playerReadinessPulseChecks.map((item) => (
              <div key={item.label} style={playerReadinessItem}>
                <div style={playerReadinessItemTop}>
                  <strong>{item.label}</strong>
                  <span style={item.tone === 'good' ? badgeGreen : item.tone === 'warn' ? warnBadge : badgeBlue}>
                    {item.state}
                  </span>
                </div>
                <span>{item.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={playerReadinessActionRow}>
        <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(levelUpAvailabilityHref, 'availability')}>
          Check availability
        </PrimarySmallBtn>
        <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(lineupBuilderHref, 'lineup')}>
          Build lineup
        </SecondarySmallBtn>
        <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(messagingHref, 'messaging')}>
          Send nudge
        </SecondarySmallBtn>
      </div>
    </section>
  )

  const captainNudgeComposer = (
    <section style={dynamicCaptainNudgeComposerShell} aria-label="Captain nudge composer">
      <div style={commandCenterHeader}>
        <div>
          <div style={sectionKicker}>Nudge composer</div>
          <h2 style={sectionTitle}>{isMobile ? 'Send the right nudge.' : 'Send the right nudge before replies drift.'}</h2>
        </div>
        <span style={captainNudgePrimaryDraft.tone === 'warn' ? warnBadge : captainNudgeReadyCount > 1 ? badgeGreen : badgeBlue}>
          {captainNudgePrimaryDraft.label}
        </span>
      </div>
      <div style={sectionSub}>
        Pick the message that matches the week, copy the draft, then open Messaging with the same team context.
      </div>

      <div style={dynamicCaptainNudgeComposerGrid}>
        <div style={captainNudgeFeaturedDraft}>
          <div style={captainNudgeFeaturedTop}>
            <div>
              <div style={commandCenterLabel}>Best next send</div>
              <div style={captainNudgeFeaturedTitle}>{captainNudgePrimaryDraft.label}</div>
            </div>
            <span style={captainNudgePrimaryDraft.tone === 'warn' ? warnBadge : captainNudgePrimaryDraft.tone === 'good' ? badgeGreen : badgeBlue}>
              {captainNudgePrimaryDraft.state}
            </span>
          </div>
          <p style={captainNudgeDraftBody}>{captainNudgePrimaryDraft.body}</p>
          <div style={captainNudgeActionRow}>
            <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled} onClick={() => void handleCopyCaptainNudge(captainNudgePrimaryDraft)}>
              {copiedCaptainNudgeLabel === captainNudgePrimaryDraft.label ? 'Copied' : 'Copy draft'}
            </PrimarySmallBtn>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(captainNudgePrimaryDraft.href, captainNudgePrimaryDraft.stage)}>
              {captainNudgePrimaryDraft.cta}
            </SecondarySmallBtn>
          </div>
        </div>

        <div style={captainNudgeDraftList}>
          <div style={commandCenterLabel}>Ready-to-send drafts</div>
          <div style={captainNudgeDraftGrid}>
            {captainNudgeDrafts.map((draft) => (
              <article key={draft.label} style={captainNudgeDraftCard}>
                <div style={captainNudgeDraftTop}>
                  <strong>{draft.label}</strong>
                  <span style={draft.tone === 'good' ? badgeGreen : draft.tone === 'warn' ? warnBadge : badgeBlue}>
                    {draft.state}
                  </span>
                </div>
                <span>{draft.detail}</span>
                <p style={captainNudgeDraftBody}>{draft.body}</p>
                <div style={captainNudgeMiniActionRow}>
                  <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => void handleCopyCaptainNudge(draft)}>
                    {copiedCaptainNudgeLabel === draft.label ? 'Copied' : 'Copy'}
                  </SecondarySmallBtn>
                  <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(draft.href, draft.stage)}>
                    {draft.cta}
                  </SecondarySmallBtn>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )

  const captainWeekTimeline = (
    <section style={dynamicCaptainWeekTimelineShell} aria-label="Captain week timeline">
      <div style={commandCenterHeader}>
        <div>
          <div style={sectionKicker}>Week timeline</div>
          <h2 style={sectionTitle}>{isMobile ? 'Keep the week moving.' : 'Keep the week moving from first nudge to closeout.'}</h2>
        </div>
        <span style={captainWeekTimelineNextItem.tone === 'warn' ? warnBadge : captainWeekTimelineReadyCount >= 3 ? badgeGreen : badgeBlue}>
          {captainWeekTimelineNextItem.label}
        </span>
      </div>
      <div style={sectionSub}>
        See what needs action now, what can wait, and where to jump next without re-reading the whole captain board.
      </div>

      <div style={dynamicCaptainWeekTimelineGrid}>
        {captainWeekTimelineItems.map((item, index) => (
          <article key={item.label} style={captainWeekTimelineCard}>
            <div style={captainWeekTimelineTop}>
              <div style={captainWeekTimelineMarker}>
                <span style={captainWeekTimelineDot}>{index + 1}</span>
                <span style={commandCenterLabel}>{item.label}</span>
              </div>
              <span style={item.tone === 'good' ? badgeGreen : item.tone === 'warn' ? warnBadge : badgeBlue}>
                {item.state}
              </span>
            </div>
            <div style={captainWeekTimelineBody}>
              <strong style={captainWeekTimelineTitle}>{item.title}</strong>
              <span>{item.detail}</span>
            </div>
            <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(item.href, item.stage)}>
              {item.cta}
            </SecondarySmallBtn>
          </article>
        ))}
      </div>
    </section>
  )

  const captainPostMatchCloseout = (
    <section style={dynamicPostMatchCloseoutShell} aria-label="Captain post-match closeout">
      <div style={commandCenterHeader}>
        <div>
          <div style={sectionKicker}>Post-match closeout</div>
          <h2 style={sectionTitle}>{isMobile ? 'Close the match.' : 'Close the match while it is fresh.'}</h2>
        </div>
        <span style={postMatchClosed ? badgeGreen : workspaceState.lineupReady ? badgeBlue : warnBadge}>
          {postMatchClosed ? 'Closed' : workspaceState.lineupReady ? 'Ready after play' : 'Needs courts'}
        </span>
      </div>
      <div style={sectionSub}>
        Capture the result, upload the scorecard, send the recap, and mark the week closed before details fade.
      </div>

      <div style={dynamicPostMatchCloseoutGrid}>
        <div style={postMatchCloseoutMain}>
          <div style={matchDaySheetTop}>
            <div>
              <div style={commandCenterLabel}>Scorecard trail</div>
              <div style={matchDaySheetTitle}>{postMatchCloseoutRows.length ? 'Court results to capture' : 'No courts saved yet'}</div>
            </div>
            <span style={postMatchCloseoutRows.length ? badgeGreen : warnBadge}>
              {postMatchCloseoutRows.length ? `${postMatchCloseoutRows.length} shown` : 'Draft'}
            </span>
          </div>

          {postMatchCloseoutRows.length ? (
            <div style={postMatchCourtList} aria-label="Post-match scorecard courts">
              {postMatchCloseoutRows.map((row, index) => {
                const courtLabel = safeText(row.court_label, `Court ${index + 1}`)
                const playerLabel = row.players?.filter(Boolean).join(' / ') || 'Players not set'

                return (
                  <article key={row.id || `${courtLabel}-closeout-${index}`} style={postMatchCourtCard}>
                    <div style={matchDayCourtTop}>
                      <span style={matchDayCourtLabel}>{courtLabel}</span>
                      <span style={badgeSlate}>Add score</span>
                    </div>
                    <strong style={matchDayCourtPlayers}>{playerLabel}</strong>
                  </article>
                )
              })}
              {matchDayLineupRows.length > postMatchCloseoutRows.length ? (
                <div style={matchDayMoreLineups}>
                  +{matchDayLineupRows.length - postMatchCloseoutRows.length} more court{matchDayLineupRows.length - postMatchCloseoutRows.length === 1 ? '' : 's'} ready in Lineup Builder.
                </div>
              ) : null}
            </div>
          ) : (
            <div style={emptyLine}>
              Build the lineup before match day so closeout starts with the courts already named.
            </div>
          )}
        </div>

        <div style={postMatchCloseoutChecklist}>
          <div style={commandCenterLabel}>Closeout checks</div>
          <div style={postMatchCloseoutList}>
            {postMatchCloseoutChecks.map((item) => (
              <div key={item.label} style={postMatchCloseoutItem}>
                <div style={postMatchCloseoutTop}>
                  <strong>{item.label}</strong>
                  <span style={item.tone === 'good' ? badgeGreen : item.tone === 'warn' ? warnBadge : badgeBlue}>
                    {item.state}
                  </span>
                </div>
                <span>{item.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={postMatchActionRow}>
        <PrimarySmallBtn fullWidth={isMobile} disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(dataAssistCaptainHref, 'team')}>
          Upload scorecard
        </PrimarySmallBtn>
        <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(messagingHref, 'messaging')}>
          Send recap
        </SecondarySmallBtn>
        <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(teamBriefHref, 'brief')}>
          Review team brief
        </SecondarySmallBtn>
        <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled || postMatchClosed} onClick={() => handleWeekStatusUpdate('finalized')}>
          Mark closed
        </SecondarySmallBtn>
      </div>
    </section>
  )

  return (
    <div style={pageWrap}>
        <section style={dynamicHeroCard} aria-label="Captain team scope">
          <span aria-hidden="true" style={watermarkStyle} />
          <div style={heroLeft}>
            <div style={scopeHeaderStyle}>
              <div>
                <div style={sectionKicker}>Team scope</div>
                <h1 style={scopeTitleStyle}>Choose the week.</h1>
              </div>
              <span style={hasTeamScope ? badgeGreen : badgeBlue}>
                {hasTeamScope ? 'Ready' : 'Choose team'}
              </span>
            </div>

            <div id="captain-team-scope" style={dynamicHeroControlRow}>
              <select
                aria-label="Captain team scope"
                value={selectedTeamOptionKey}
                disabled={loadingOptions || !filteredTeamOptions.length}
                onChange={(e) => {
                  const option = filteredTeamOptions.find((item) => buildTeamOptionKey(item) === e.target.value)
                  if (option) {
                    setSelectedTeam(option.team)
                    setSelectedLeague(option.league)
                    setSelectedFlight(option.flight)
                    void trackProductUsageEvent({
                      eventName: 'captain_team_scope_selected',
                      surface: 'captain',
                      planId: 'captain',
                      metadata: {
                        team: option.team,
                        league: option.league,
                        flight: option.flight,
                      },
                    })
                  }
                }}
                style={dynamicSelectStyle}
              >
                {loadingOptions && !filteredTeamOptions.length ? (
                  <option value="">Loading teams...</option>
                ) : !filteredTeamOptions.length ? (
                  <option value="">No linked active teams</option>
                ) : (
                  filteredTeamOptions.map((option) => (
                    <option
                      key={`${option.team}__${option.league}__${option.flight}`}
                      value={buildTeamOptionKey(option)}
                    >
                      {option.team} - {option.league} - {option.flight}
                    </option>
                  ))
                )}
              </select>

              <SecondarySmallBtn onClick={() => setRefreshTick((current) => current + 1)}>
                {loadingOptions || loadingTeam ? 'Refreshing...' : 'Refresh data'}
              </SecondarySmallBtn>

              <button
                type="button"
                style={{
                  ...primaryButtonButton,
                  ...(!premiumEnabled || !hasTeamScope ? disabledButton : {}),
                }}
                onClick={() => {
                  if (!premiumEnabled || !hasTeamScope) return
                  handleCaptainNav(lineupBuilderHref, 'lineup')
                }}
                disabled={!premiumEnabled || !hasTeamScope}
              >
                {!premiumEnabled ? 'Unlock Captain' : hasTeamScope ? 'Build lineup' : 'Choose team'}
              </button>
            </div>

            <div
              style={{
                ...scopeBanner,
                ...(!filteredTeamOptions.length && !loadingOptions ? scopeBannerWarn : {}),
              }}
            >
              {scopeStatusText}
            </div>

            {!loadingOptions && !filteredTeamOptions.length ? (
              <div style={captainDataAssistCueStyle}>
                <div style={captainPlayerIdStarterCopyStyle}>
                  <strong>Need a team to manage here?</strong>
                  <span>Connect a profile team or upload reviewed roster and schedule data so Captain can answer availability, lineup, pairing, and message questions.</span>
                  <ul style={captainEmptyActionListStyle}>
                    {CAPTAIN_EMPTY_STATE_ACTIONS.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                  <div style={captainPlayerIdStarterStyle} aria-label="Captain Player ID starter">
                    <div style={captainPlayerIdStarterHeaderStyle}>
                      <span style={captainPlayerIdStarterEyebrowStyle}>Team Hub Player ID starter</span>
                      <strong style={captainPlayerIdStarterTitleStyle}>{CAPTAIN_PLAYER_IDENTITY_READ.label}</strong>
                      <span>{CAPTAIN_PLAYER_IDENTITY_READ.levelUpNudge}</span>
                    </div>
                    <div style={captainPlayerIdStarterGridStyle} aria-label="Captain Player ID starter read">
                      {captainPlayerIdStarterRead.map((item) => (
                        <article key={item.label} style={captainPlayerIdStarterCardStyle}>
                          <span style={captainPlayerIdStarterLabelStyle}>{item.label}</span>
                          <strong style={captainPlayerIdStarterValueStyle}>{item.value}</strong>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={captainEmptyActionRowStyle}>
                  <Link href="/mylab#player-workshop" style={captainDataAssistLinkStyle}>
                    Set profile
                  </Link>
                  <Link href={CAPTAIN_LEVEL_UP_HREF} style={captainDataAssistLinkStyle}>
                    Start Level Up
                  </Link>
                  <Link href={CAPTAIN_PLAYER_DEVELOPMENT_HREF} style={captainDataAssistLinkStyle}>
                    Read Player ID
                  </Link>
                  <Link href={dataAssistCaptainHref} style={captainDataAssistLinkStyle}>
                    {DATA_ASSIST_STORY.cta}
                  </Link>
                </div>
              </div>
            ) : selectedFromCaptainScope ? (
              <div style={captainDataAssistCueStyle}>
                <div>
                  <strong>Team scope is set.</strong>
                  <span>
                    Captain started from {selectedCaptainScopeSourceLabel}; roster, schedule, and scorecard uploads can keep Team Hub current.
                  </span>
                </div>
                <Link href={dataAssistCaptainHref} style={captainDataAssistLinkStyle}>
                  Refresh with Data Assist
                </Link>
              </div>
            ) : null}

          </div>
        </section>

        {captainMatchDayCommandStripSurface}

        {captainEmergencyMode}

        {captainChangeAckTracker}

        {captainArrivalRiskTracker}

        {captainCourtHandoffTimer}

        {captainNotificationQueue}

        {captainPlayerBriefCards}

        {captainMorningBrief}

        {captainSendQueue}

        {captainDecisionLog}

        {captainHandoffSheet}

        {captainPreSendReview}

        {captainPostSendTracker}

        {captainCommandCenter}

        {captainSeasonLaunchChecklist}

        {captainOpponentScoutPocket}

        {captainPlayerReadinessPulse}

        {captainNudgeComposer}

        {captainWeekTimeline}

        {captainCourtConfidenceMeter}

        {captainBenchReadinessRail}

        {captainCourtSwapAssistant}

        {captainMatchDaySheet}

        {captainScoreCaptureChecklist}

        {captainPostMatchRecapBuilder}

        {captainPostMatchCloseout}

        <section style={dynamicCaptainDecisionPathShell} aria-label="Captain decision path">
          <div style={captainDecisionPathHeaderStyle}>
            <div>
              <div style={sectionKicker}>Captain decision path</div>
              <h2 style={captainDecisionPathTitleStyle}>{isMobile ? 'Answer match week.' : 'Answer match week from your phone.'}</h2>
            </div>
            <span style={hasTeamScope ? badgeGreen : badgeBlue}>
              {hasTeamScope ? 'Team selected' : 'Choose team first'}
            </span>
          </div>
          {!isMobile ? (
            <p style={captainDecisionPathIntroStyle}>
              Start with availability, turn it into a lineup, check pairings, message the team, and clean up the scorecard trail.
            </p>
          ) : null}
          <div style={dynamicCaptainDecisionPathGrid}>
            {captainDecisionPath.map((item) => {
              const needsScope = item.requiresScope && !hasTeamScope
              const targetHref = needsScope ? '#captain-team-scope' : item.href
              const targetStage = needsScope ? 'team' : item.stage

              return (
                <article key={item.label} style={dynamicCaptainDecisionPathCard}>
                  <div style={captainDecisionPathTopStyle}>
                    <div style={captainDecisionPathLabelClusterStyle}>
                      <TiqFeatureIcon name={item.icon} size="sm" variant="ghost" />
                      <span style={captainDecisionPathLabelStyle}>{item.label}</span>
                    </div>
                    <span style={needsScope ? badgeSlate : item.tone === 'good' ? badgeGreen : item.tone === 'warn' ? warnBadge : badgeBlue}>
                      {needsScope ? 'Needs team' : item.tone === 'good' ? 'Ready' : item.tone === 'warn' ? 'Check' : 'Open'}
                    </span>
                  </div>
                  <div>
                    <h3 style={captainDecisionPathQuestionStyle}>{item.question}</h3>
                    {!isMobile ? (
                      <p style={captainDecisionPathAnswerStyle}>{needsScope ? 'Choose the team, league, and flight first so this action opens with the right week.' : item.answer}</p>
                    ) : null}
                  </div>
                  <PrimarySmallBtn fullWidth onClick={() => handleCaptainAction(targetHref, targetStage)}>
                    {needsScope ? (isMobile ? 'Team' : 'Choose Team') : isMobile ? item.label : item.cta}
                  </PrimarySmallBtn>
                </article>
              )
            })}
          </div>
        </section>

        {levelUpTeamChallenge ? (
          <section style={captainLevelUpChallengeStyle} aria-label="Level Up team challenge mode">
            <div style={captainLevelUpChallengeHeaderStyle}>
              <div>
                <div style={sectionKicker}>Level Up team challenge</div>
                <h2 style={sectionTitle}>Launch {levelUpTeamChallenge.title} for the lineup.</h2>
                <div style={sectionSub}>{levelUpTeamChallenge.detail}</div>
              </div>
              <span style={badgeGreen}>Team challenge mode</span>
            </div>
            <div style={captainLevelUpChallengeGridStyle}>
              <article style={captainLevelUpChallengeCardStyle}>
                <span style={captainLaneTopline}>Focus</span>
                <strong>{levelUpTeamChallenge.focus}</strong>
              </article>
              <article style={captainLevelUpChallengeCardStyle}>
                <span style={captainLaneTopline}>Privacy</span>
                <strong>{levelUpTeamChallenge.proof}</strong>
              </article>
              <article style={captainLevelUpChallengeCardStyle}>
                <span style={captainLaneTopline}>Cards</span>
                <strong>{levelUpTeamChallenge.cardIds.length} linked Level Up cards</strong>
              </article>
              <article style={captainLevelUpChallengeCardStyle}>
                <span style={captainLaneTopline}>Aggregate progress</span>
                <strong>{getCaptainLevelUpAggregateCompletionLabel(levelUpTeamChallenge)}</strong>
                <small>Team challenge mode shows completion count only. Private player proof, scores, and notes stay private.</small>
              </article>
            </div>
            <div style={dynamicGlanceActionRow}>
              <PrimaryLink href={captainWorkflowHref(levelUpPracticeHref)}>Plan practice</PrimaryLink>
              <SecondarySmallLink href={captainWorkflowHref(levelUpAvailabilityHref)}>Check availability</SecondarySmallLink>
              <SecondarySmallLink href={captainWorkflowHref(levelUpWeeklyBriefHref)}>Add to weekly brief</SecondarySmallLink>
            </div>
          </section>
        ) : null}

        {error ? (
          <section style={errorCard}>
            <div>{error}</div>
            <div style={{ marginTop: 14 }}>
              <SecondarySmallBtn onClick={() => setRefreshTick((current) => current + 1)}>
                Retry captain hub load
              </SecondarySmallBtn>
            </div>
          </section>
        ) : null}

        <section style={dynamicStatusStrip}>
          <StatusStripCard
            label="Availability"
            icon="schedule"
            value={workspaceState.pendingResponseCount > 0 ? `${workspaceState.pendingResponseCount} waiting` : 'Clear'}
            detail={
              workspaceState.pendingResponseCount > 0
                ? 'Follow up before locking the lineup'
                : 'No response blockers saved for this week'
            }
            tone={workspaceState.pendingResponseCount > 0 ? 'warn' : 'good'}
          />
          <StatusStripCard
            label="Lineup"
            icon="lineupBuilder"
            value={workspaceState.lineupReady ? 'Built' : 'Not built'}
            detail={workspaceState.lineupReady ? `${workspaceState.lineupCount} lineup slot${workspaceState.lineupCount === 1 ? '' : 's'} loaded` : 'No weekly lineup stored yet'}
            tone={workspaceState.lineupReady ? 'good' : 'info'}
          />
          <StatusStripCard
            label="Message"
            icon="messagingCenter"
            value={workspaceState.messagingReady ? 'Ready' : 'Not ready'}
            detail={workspaceState.messagingReady ? 'Weekly communication details are in place.' : 'Messaging prep still needs lineup or event details.'}
            tone={workspaceState.messagingReady ? 'good' : 'warn'}
          />
          <StatusStripCard
            label="Brief"
            icon="reports"
            value={workspaceState.briefReady ? 'Ready' : 'Building'}
            detail={workspaceState.briefReady ? 'Open the captain or team brief' : 'Add lineup, event, or response context'}
            tone={workspaceState.briefReady ? 'good' : 'info'}
          />
        </section>

        <details style={dynamicCaptainSaveStatusShell} aria-label="Captain save status">
          <summary style={captainSaveStatusSummaryStyle}>
            <div>
              <div style={sectionKicker}>Save status</div>
              <h2 style={captainSaveStatusTitle}>{isMobile ? 'What saves here?' : 'Know what carries forward.'}</h2>
            </div>
            <span style={badgeSlate}>Local honesty</span>
          </summary>

          <div style={captainSaveStatusGrid}>
            {captainSaveSignals.map((signal) => (
              <div key={signal.label} style={captainSaveStatusCard}>
                <div style={captainSaveStatusTop}>
                  <span style={captainSaveStatusLabel}>{signal.label}</span>
                  <span style={signal.tone === 'good' ? badgeGreen : signal.tone === 'warn' ? warnBadge : badgeBlue}>
                    {signal.state}
                  </span>
                </div>
                <p style={captainSaveStatusText}>{signal.detail}</p>
              </div>
            ))}
          </div>

          <div style={captainLocalSyncProofStyle} aria-label="Captain saved data check">
            <div>
              <span style={captainSaveStatusLabel}>Saved data check</span>
              <h3 style={captainLocalSyncProofTitleStyle}>Separate browser proof from linked team history.</h3>
            </div>
            <div style={captainLocalSyncProofGridStyle}>
              {CAPTAIN_LOCAL_SYNC_PROOF_CHECKS.map((check) => (
                <div key={check} style={captainLocalSyncProofItemStyle}>
                  <span style={captainLocalSyncProofDotStyle} aria-hidden="true" />
                  <span>{check}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={captainDecisionHandoffProofStyle} aria-label="Captain decision path check">
            <div>
              <span style={captainSaveStatusLabel}>Decision path check</span>
              <h3 style={captainLocalSyncProofTitleStyle}>Move from availability to lineup to team send.</h3>
            </div>
            <div style={captainDecisionHandoffProofGridStyle}>
              {captainDecisionHandoffProof.map((step) => (
                <div key={step.label} style={captainDecisionHandoffProofItemStyle}>
                  <div style={captainDecisionHandoffProofTopStyle}>
                    <strong>{step.label}</strong>
                    <span style={step.tone === 'good' ? badgeGreen : step.tone === 'warn' ? warnBadge : badgeBlue}>
                      {step.state}
                    </span>
                  </div>
                  <span>{step.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </details>

        <section style={dynamicNextActionShell}>
          <div style={nextActionIntro}>
            <TiqFeatureIcon name="matchPrep" size="md" variant="surface" />
            <div style={sectionKicker}>Next best action</div>
            <h2 style={sectionTitle}>Do this next.</h2>
            <div style={sectionSub}>
              TenAceIQ uses the saved week to point you at the next captain move.
            </div>
          </div>

          <div style={nextActionCard}>
            <div style={nextActionHeader}>
              <span style={captainPrimaryAction.tone === 'good' ? badgeGreen : captainPrimaryAction.tone === 'warn' ? warnBadge : badgeBlue}>
                {captainPrimaryAction.tone === 'good' ? 'Ready to move' : captainPrimaryAction.tone === 'warn' ? 'Needs attention' : 'Recommended'}
              </span>
              <span style={badgeSlate}>Resume</span>
            </div>

            <div style={nextActionTitle}>{captainPrimaryAction.title}</div>
            <div style={nextActionText}>{captainPrimaryAction.detail}</div>

            <div style={dynamicNextActionButtonRow}>
              <PrimaryBtn
                disabled={!premiumEnabled || (!hasTeamScope && !captainPrimaryAction.href.startsWith('#'))}
                onClick={() => handleCaptainAction(
                  captainPrimaryAction.href,
                  captainPrimaryAction.href === lineupBuilderHref
                    ? 'lineup'
                    : captainPrimaryAction.href === scenarioHref
                      ? 'scenario'
                      : captainPrimaryAction.href === messagingHref
                        ? 'messaging'
                        : captainPrimaryAction.href === weeklyBriefHref
                          ? 'brief'
                          : captainPrimaryAction.href === analyticsHref
                            ? 'analytics'
                            : captainPrimaryAction.stage,
                )}
              >
                {captainPrimaryAction.cta}
              </PrimaryBtn>
              <SecondarySmallBtn
                disabled={!premiumEnabled || !hasTeamScope}
                onClick={() => {
                  if (!premiumEnabled || !hasTeamScope) return
                  handleCaptainNav(messagingHref, 'messaging')
                }}
              >
                Open messaging
              </SecondarySmallBtn>
            </div>
          </div>
        </section>

        <details style={sectionCard}>
          <summary style={optionalSummaryStyle}>
            <span>
              <span style={sectionKicker}>Optional notes</span>
              <span style={optionalSummaryTitle}>Prep notes and scouting</span>
            </span>
            <span style={badgeSlate}>{notesUpdatedLabel}</span>
          </summary>

          <div style={notesScopeBanner}>
            {captainNotesScope.team
              ? `Saving notes for ${captainNotesScope.team}${captainNotesScope.league ? ` - ${captainNotesScope.league}` : ''}${captainNotesScope.flight ? ` - ${captainNotesScope.flight}` : ''}${captainNotesScope.eventDate ? ` - ${formatDateShort(captainNotesScope.eventDate)}` : ''}${captainNotesScope.opponentTeam ? ` - vs ${captainNotesScope.opponentTeam}` : ''}`
              : 'Pick a team scope above to start a saved weekly notes thread.'}
          </div>

          <div style={notesGrid}>
            <label style={notesField}>
              <span style={notesLabel}>Weekly prep notes</span>
              <span style={notesHint}>Travel, arrival plan, court prep, roster reminders, subs, weather, or anything your team needs this week.</span>
              <textarea
                value={weeklyPrepNotes}
                onChange={(e) => setWeeklyPrepNotes(e.target.value)}
                placeholder="Arrival time, balls, warm-up courts, weather plan, subs on standby..."
                style={notesTextarea}
                rows={5}
              />
            </label>

            <label style={notesField}>
              <span style={notesLabel}>Opponent scouting notes</span>
              <span style={notesHint}>Patterns to exploit, likely pairings, court tendencies, pressure points, or lineup traps to avoid.</span>
              <textarea
                value={opponentScoutNotes}
                onChange={(e) => setOpponentScoutNotes(e.target.value)}
                placeholder="Likely stack on D1, protect S1, target slower second serve pair, expect late lineup changes..."
                style={notesTextarea}
                rows={5}
              />
            </label>
          </div>
        </details>

        {!premiumEnabled ? (
          <UpgradePrompt
            planId="captain"
            headline={CAPTAIN_STORY.upgradeHeadline}
            body={CAPTAIN_STORY.upgradeBody}
            result={CAPTAIN_STORY.upgradeResult}
            ctaLabel={CAPTAIN_STORY.upgradeCta}
            compact
          />
        ) : null}

        <details
          style={{
            ...dynamicNextActionShell,
            borderColor:
              weeklyOpsStatus.tone === 'warn'
                ? 'rgba(251, 191, 36, 0.45)'
                : weeklyOpsStatus.tone === 'good'
                  ? 'rgba(163, 230, 53, 0.35)'
                  : 'rgba(96, 165, 250, 0.28)',
            boxShadow:
              weeklyOpsStatus.tone === 'warn'
                ? '0 18px 45px rgba(120, 53, 15, 0.26)'
                : weeklyOpsStatus.tone === 'good'
                  ? '0 18px 45px rgba(39, 84, 24, 0.22)'
                  : dynamicNextActionShell.boxShadow,
          }}
        >
          <summary style={weeklyDetailsSummaryStyle}>
            <span>
              <span style={sectionKicker}>Weekly readout</span>
              <span style={optionalSummaryTitle}>{weeklyOpsStatus.title}</span>
            </span>
            <span style={weeklyOpsStatus.tone === 'warn' ? warnBadge : weeklyOpsStatus.tone === 'good' ? badgeGreen : badgeBlue}>
              {weeklyOpsStatus.tone === 'warn' ? 'Needs attention' : weeklyOpsStatus.tone === 'good' ? 'Ready' : 'Open'}
            </span>
          </summary>

          <div style={nextActionIntro}>
            <div style={sectionKicker}>Weekly risk watch</div>
            <h2 style={sectionTitle}>{weeklyOpsStatus.title}</h2>
            <div style={sectionSub}>{weeklyOpsStatus.detail}</div>
          </div>

          <div style={nextActionGrid}>
            <div style={nextActionCard}>
              <div style={nextActionLabel}>Captain brief</div>
              <div style={nextActionTitle}>
                {workspaceState.briefReady ? 'Weekly brief is ready' : 'Still gathering week context'}
              </div>
              <div style={nextActionText}>
                Open the weekly brief for lineup, notes, opponent context, and final captain actions.
              </div>
            </div>

            <div style={nextActionCardAccent}>
              <div style={nextActionLabel}>Team brief</div>
              <div style={nextActionTitle}>
                {workspaceState.responseAlertCount > 0 ? 'Risk-aware team note available' : 'Player-facing brief ready'}
              </div>
              <div style={nextActionText}>
                Use the team brief for a cleaner shareable summary with logistics, lineup, and live risk callouts.
              </div>
            </div>

            <div style={dynamicNextActionButtonRow}>
              <PrimaryLink href={captainWorkflowHref(weeklyBriefHref)}>Open weekly brief</PrimaryLink>
              <SecondarySmallLink href={captainWorkflowHref(teamBriefHref)}>Open team brief</SecondarySmallLink>
              <SecondarySmallLink
                href={captainWorkflowHref(workspaceState.pendingResponseCount > 0 ? availabilityHref : messagingHref)}
              >
                {workspaceState.pendingResponseCount > 0 ? 'Follow up responses' : 'Open messaging'}
              </SecondarySmallLink>
            </div>
          </div>
        </details>

        <details style={sectionCard}>
          <summary style={optionalSummaryStyle}>
            <span>
              <span style={sectionKicker}>At a glance</span>
              <span style={optionalSummaryTitle}>Current match week</span>
            </span>
            <span style={badgeSlate}>{weekAtGlance.eventDateLabel}</span>
          </summary>

          <div style={sectionHead}>
            <div>
              <div style={sectionKicker}>This week at a glance</div>
              <h2 style={sectionTitle}>One compact read on the current match week</h2>
              <div style={sectionSub}>
                See the opponent, scope, readiness, and fastest captain actions without leaving the hub.
              </div>
            </div>
          </div>

          <div style={glanceGrid}>
            <div style={glanceCardAccent}>
              <div style={glanceLabel}>Match week</div>
              <div style={glanceValue}>{weekAtGlance.eventDateLabel}</div>
              <div style={glanceHint}>Opponent: {weekAtGlance.opponentLabel}</div>
            </div>

            <div style={glanceCard}>
              <div style={glanceLabel}>Active scope</div>
              <div style={glanceValue}>{selectedTeam || 'Team not selected'}</div>
              <div style={glanceHint}>{weekAtGlance.scopeLabel}</div>
            </div>

            <div style={glanceCard}>
              <div style={glanceLabel}>Lineup</div>
              <div style={glanceValue}>{weekAtGlance.lineupLabel}</div>
              <div style={glanceHint}>Last captain visit: {workspaceState.lastUpdatedLabel}</div>
            </div>

            <div style={glanceCard}>
              <div style={glanceLabel}>Comms + brief</div>
              <div style={glanceValue}>{weekAtGlance.messagingLabel}</div>
              <div style={glanceHint}>{weekAtGlance.briefLabel}</div>
            </div>
          </div>

          <div style={dynamicGlanceActionRow}>
            <PrimaryLink href={captainWorkflowHref(weeklyBriefHref)}>Open weekly brief</PrimaryLink>
            <SecondarySmallLink href={captainWorkflowHref(teamBriefHref)}>Open team brief</SecondarySmallLink>
            <SecondarySmallLink href={captainWorkflowHref(lineupBuilderHref)}>Edit lineup</SecondarySmallLink>
            <SecondarySmallLink href={captainWorkflowHref(messagingHref)}>Send update</SecondarySmallLink>
          </div>

          <div style={weekStatusShell}>
            <div>
              <div style={glanceLabel}>This week</div>
              <div style={weekStatusValue}>{weekStatusMeta.label}</div>
              <div style={glanceHint}>{weekStatusMeta.detail}</div>
            </div>

            <div style={dynamicWeekStatusButtonRow}>
              {(['draft-lineup', 'ready-to-send', 'finalized'] as CaptainWeekStatus[]).map((status) => {
                const isActive = weekStatus === status
                const label = status === 'draft-lineup' ? 'Draft lineup' : status === 'ready-to-send' ? 'Ready to send' : 'Finalized'
                return isActive ? (
                  <PrimaryBtn key={status} onClick={() => handleWeekStatusUpdate(status)}>
                    {label}
                  </PrimaryBtn>
                ) : (
                  <SecondarySmallBtn key={status} onClick={() => handleWeekStatusUpdate(status)}>
                    {label}
                  </SecondarySmallBtn>
                )
              })}
            </div>
          </div>
        </details>

        <details style={sectionCard}>
          <summary style={optionalSummaryStyle}>
            <span>
              <span style={sectionKicker}>Team Hub actions</span>
              <span style={optionalSummaryTitle}>Availability, lineups, messages, season work</span>
            </span>
            <span style={badgeSlate}>Show paths</span>
          </summary>

          <div style={sectionHead}>
            <div>
              <div style={sectionKicker}>In-tool actions</div>
              <h2 style={sectionTitle}>Keep the team week moving.</h2>
              <div style={sectionSub}>
                Use these when you are already in the team flow and need the next captain action fast.
              </div>
            </div>
          </div>

          <div style={captainLaneGrid}>
            <div style={captainLaneCardAccent}>
              <div style={captainLaneTopline}>Start the week</div>
              <div style={captainLaneTitle}>Confirm who can play.</div>
              <div style={captainLaneText}>
                Start with In, Out, Maybe, and follow-up gaps, then open the brief when the week needs one clean read.
              </div>
              <div style={captainLaneActions}>
                <PrimarySmallBtn disabled={!premiumEnabled || !hasTeamScope} onClick={() => handleCaptainNav(availabilityHref, 'availability')}>
                  Availability
                </PrimarySmallBtn>
                <SecondarySmallBtn disabled={!premiumEnabled || !hasTeamScope} onClick={() => handleCaptainNav(weeklyBriefHref, 'brief')}>
                  Weekly Brief
                </SecondarySmallBtn>
                <SecondarySmallBtn disabled={!premiumEnabled || !hasTeamScope} onClick={() => handleCaptainNav(teamBriefHref, 'brief')}>
                  Team Brief
                </SecondarySmallBtn>
              </div>
            </div>

            <div style={captainLaneCard}>
              <div style={captainLaneTopline}>Build the lineup</div>
              <div style={captainLaneTitle}>Pick the best version before you send it.</div>
              <div style={captainLaneText}>
                Build the courts, compare alternatives, and use Captain IQ when a pairing or matchup call is not obvious.
              </div>
              <div style={captainLaneActions}>
                <PrimarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(lineupBuilderHref, 'lineup')}>
                  Lineup Builder
                </PrimarySmallBtn>
                <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(scenarioHref, 'scenario')}>
                  Scenarios
                </SecondarySmallBtn>
                <SecondarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(analyticsHref, 'analytics')}>
                  Captain IQ
                </SecondarySmallBtn>
              </div>
            </div>

            <div style={captainLaneCard}>
              <div style={captainLaneTopline}>Communicate</div>
              <div style={captainLaneTitle}>Send the plan and keep context handy.</div>
              <div style={captainLaneText}>
                Move from final lineup to clear player updates, reminders, and the team page.
              </div>
              <div style={captainLaneActions}>
                <PrimarySmallBtn disabled={!hasTeamScope || !premiumEnabled} onClick={() => handleCaptainNav(messagingHref, 'messaging')}>
                  Messaging
                </PrimarySmallBtn>
                <SecondarySmallBtn disabled={!premiumEnabled || !hasTeamScope} onClick={() => handleCaptainNav(currentTeamHref, 'team')}>
                  Team Page
                </SecondarySmallBtn>
              </div>
            </div>

            <div style={captainLaneCard}>
              <div style={captainLaneTopline}>Run the league</div>
              <div style={captainLaneTitle}>Coordinate seasons and results.</div>
              <div style={captainLaneText}>
                Create league structure, manage TIQ seasons, and record team match results without another spreadsheet loop.
              </div>
              <div style={captainLaneActions}>
                <PrimarySmallBtn disabled={!leagueToolsEnabled} onClick={() => handleCaptainNav(seasonDashboardHref, 'season-dashboard')}>
                  League Office
                </PrimarySmallBtn>
                <SecondarySmallBtn disabled={!leagueToolsEnabled} onClick={() => handleCaptainNav(tiqTeamMatchesHref, 'tiq-team-matches')}>
                  Match Results
                </SecondarySmallBtn>
              </div>
            </div>
          </div>
        </details>

        <section style={sectionCard}>
          <div style={sectionHead}>
            <div>
              <div style={sectionKicker}>Lineup intelligence preview</div>
              <h2 style={sectionTitle}>Best signals for {selectedTeam || 'your team'}</h2>
              <div style={sectionSub}>
                See who is available, which pairings have evidence, and what lineup question needs a decision first.
              </div>
            </div>
          </div>

          {!hasTeamScope ? (
            <div style={stateCard}>
              Choose a team scope above to unlock lineup intelligence, pairings, and roster signals. If your team is missing, refresh rosters through Data Assist.
            </div>
          ) : loadingTeam ? (
            <div style={loadingStateCardStyle}>
              <TiqFeatureIcon name="matchPrep" size="md" variant="surface" />
              <div>
                <div style={loadingStateTitleStyle}>Loading captain insights</div>
                <div style={loadingStateTextStyle}>Checking match history, roster usage, and pairing patterns.</div>
              </div>
            </div>
          ) : (
            <div style={dynamicInsightGrid}>
              <div style={insightCard}>
                <div style={insightLabel}>Top singles core</div>
                <div style={insightSub}>
                  Highest singles-ready players using singles dynamic rating plus actual team usage.
                </div>

                <div style={stackList}>
                  {recommendedSingles.length === 0 ? (
                    <div style={emptyLine}>No singles history yet. Upload reviewed scorecards through Data Assist to refresh this read.</div>
                  ) : (
                    recommendedSingles.map((player, index) => (
                      <div key={player.id} style={listCard}>
                        <div>
                          <div style={listTitle}>
                            #{index + 1} {player.name}
                          </div>
                          <div style={listMeta}>
                            {player.appearances} appearances - {player.wins}-{player.losses} when used
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 6 }}>
                          <div style={pillStrong}>{formatRating(player.singlesDynamic)}</div>
                          {player.ratingStatus ? (
                            <span style={{ ...captainStatusPill, ...getCaptainStatusStyle(player.ratingStatus) }}>
                              {player.ratingStatus}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={insightCard}>
                <div style={insightLabel}>Best doubles pairs</div>
                <div style={insightSub}>
                  Pairs ranked by win rate first, then sample size and average doubles dynamic
                  rating.
                </div>

                <div style={stackList}>
                  {pairings.length === 0 ? (
                    <div style={emptyLine}>No doubles pair history yet. Data Assist scorecard uploads can fill this in after review.</div>
                  ) : (
                    pairings.slice(0, 3).map((pair, index) => (
                      <div key={pair.key} style={listCard}>
                        <div>
                          <div style={listTitle}>
                            #{index + 1} {pair.names.join(' / ')}
                          </div>
                          <div style={listMeta}>
                            {pair.wins}-{pair.losses} together - {pair.appearances} doubles lines
                          </div>
                        </div>

                        <div style={pairMetricWrap}>
                          <div style={pillStrong}>{formatRating(pair.avgDoublesRating)}</div>
                          <div style={pillHelper}>{formatPercent(getWinPct(pair.wins, pair.losses))}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {nextMatch ? (
          <section style={{ ...sectionCard, borderColor: 'color-mix(in srgb, var(--brand-blue-2) 24%, var(--shell-panel-border) 76%)', background: 'color-mix(in srgb, var(--brand-blue-2) 7%, var(--shell-panel-bg-strong) 93%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const }}>
              <div>
                <div style={{ ...sectionKicker, color: '#93c5fd' }}>Next scheduled match</div>
                <h2 style={{ ...sectionTitle, margin: '4px 0 0' }}>
                  vs {nextMatch.opponent}
                </h2>
                <div style={{ color: 'var(--shell-copy-muted)', fontSize: 14, fontWeight: 600, marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
                  <span>{formatDate(nextMatch.date)}</span>
                  {nextMatch.time ? <span>{nextMatch.time}</span> : null}
                  {nextMatch.facility ? <span>{nextMatch.facility}</span> : null}
                  <span style={{ padding: '2px 9px', borderRadius: 999, background: nextMatch.home ? 'color-mix(in srgb, var(--brand-green) 12%, var(--shell-chip-bg) 88%)' : 'color-mix(in srgb, var(--brand-blue-2) 12%, var(--shell-chip-bg) 88%)', border: `1px solid ${nextMatch.home ? 'color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)' : 'color-mix(in srgb, var(--brand-blue-2) 24%, var(--shell-panel-border) 76%)'}`, color: nextMatch.home ? 'var(--brand-lime)' : 'var(--foreground-strong)', fontSize: 12, fontWeight: 800 }}>{nextMatch.home ? 'Home' : 'Away'}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                <Link href={buildCaptainScopedHref('/captain/lineup-builder', { competitionLayer: selectedCompetitionLayer, team: selectedTeam, league: selectedLeague, flight: selectedFlight, date: nextMatch.date, opponent: nextMatch.opponent })} style={{ display: 'inline-flex', alignItems: 'center', padding: '9px 18px', borderRadius: 999, background: 'color-mix(in srgb, var(--brand-green) 18%, var(--shell-chip-bg) 82%)', border: '1px solid color-mix(in srgb, var(--brand-green) 34%, var(--shell-panel-border) 66%)', color: 'var(--foreground-strong)', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>Build lineup</Link>
              </div>
            </div>
          </section>
        ) : null}

        <section style={sectionCard}>
          <div style={sectionHead}>
            <div>
              <div style={sectionKicker}>Team snapshot</div>
              <h2 style={sectionTitle}>Roster and match mix</h2>
              <div style={sectionSub}>
                Fast context for how this team has been used across singles and doubles.
              </div>
            </div>
            {roster.length > 0 ? (
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setRosterSortMode('appearances')}
                  style={{
                    padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    background: rosterSortMode === 'appearances' ? 'var(--shell-chip-bg)' : 'transparent',
                    border: `1px solid ${rosterSortMode === 'appearances' ? 'var(--shell-panel-border)' : 'color-mix(in srgb, var(--foreground-strong) 8%, transparent)'}`,
                    color: rosterSortMode === 'appearances' ? 'var(--foreground)' : 'var(--shell-copy-muted)',
                  }}
                >
                  By usage
                </button>
                <button
                  type="button"
                  onClick={() => setRosterSortMode('signal')}
                  style={{
                    padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    background: rosterSortMode === 'signal' ? 'color-mix(in srgb, var(--brand-green) 12%, var(--shell-chip-bg) 88%)' : 'transparent',
                    border: `1px solid ${rosterSortMode === 'signal' ? 'color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)' : 'color-mix(in srgb, var(--foreground-strong) 8%, transparent)'}`,
                    color: rosterSortMode === 'signal' ? '#d9f84a' : 'var(--shell-copy-muted)',
                  }}
                >
                  By signal
                </button>
              </div>
            ) : null}
          </div>

          <div style={summaryGrid}>
            <MiniStat label="Roster size" value={String(quickStats.roster)} />
            <MiniStat label="Total matches" value={String(quickStats.matches)} />
            <MiniStat label="Singles lines" value={String(quickStats.singles)} />
            <MiniStat label="Doubles lines" value={String(quickStats.doubles)} />
          </div>

          {rosterSignalSummary.withStatus > 0 ? (
            <div style={rosterSignalBar}>
              <div style={rosterSignalLabel}>Roster signal</div>
              <div style={rosterSignalPills}>
                {rosterSignalSummary.trendingUp > 0 ? (
                  <span style={signalPillGreen}>{rosterSignalSummary.trendingUp} trending up</span>
                ) : null}
                {rosterSignalSummary.counts.Holding > 0 ? (
                  <span style={signalPillNeutral}>{rosterSignalSummary.counts.Holding} holding</span>
                ) : null}
                {rosterSignalSummary.atRisk > 0 ? (
                  <span style={signalPillRed}>{rosterSignalSummary.atRisk} at risk</span>
                ) : null}
              </div>
            </div>
          ) : null}

          <div style={rosterTableWrap}>
            {!hasTeamScope ? (
              <div style={emptyLine}>
                <strong>Choose or connect a team scope.</strong>
                <span>Captain shows roster usage and match mix after My Lab sets your profile team or Data Assist review connects roster history.</span>
                <div style={captainEmptyActionRowStyle}>
                  <Link href="/profile" style={inlineEmptyLinkStyle}>Set profile</Link>
                  <Link href={dataAssistCaptainHref} style={inlineEmptyLinkStyle}>Upload team data</Link>
                </div>
              </div>
            ) : roster.length === 0 ? (
              <div style={emptyLine}>
                <strong>No roster players are available yet.</strong>
                <span>Refresh rosters through Data Assist, then review the imported names before using lineup actions.</span>
                <div style={captainEmptyActionRowStyle}>
                  <Link href={dataAssistCaptainHref} style={inlineEmptyLinkStyle}>Open Data Assist</Link>
                  <button type="button" onClick={() => setRefreshTick((current) => current + 1)} style={inlineEmptyButtonStyle}>
                    Refresh Captain
                  </button>
                </div>
              </div>
            ) : (
              <div style={rosterList}>
                {sortedRoster.map((player) => (
                  <div key={player.id} style={rosterRow}>
                    <div>
                      <div style={rosterName}>{player.name}</div>
                      <div style={rosterMeta}>
                        {player.appearances} appearances - {player.wins}-{player.losses} record
                      </div>
                    </div>

                    <div style={rosterRatingRow}>
                      <span style={subtlePill}>S {formatRating(player.singlesDynamic)}</span>
                      <span style={subtlePill}>D {formatRating(player.doublesDynamic)}</span>
                      {player.ratingStatus ? (
                        <span style={{ ...captainStatusPill, ...getCaptainStatusStyle(player.ratingStatus) }}>
                          {player.ratingStatus}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
  )
}

function StatusStripCard({
  label,
  icon,
  value,
  detail,
  tone,
}: {
  label: string
  icon: TiqFeatureIconName
  value: string
  detail: string
  tone: 'good' | 'warn' | 'info' | 'neutral'
}) {
  const toneStyle =
    tone === 'good' ? badgeGreen : tone === 'warn' ? warnBadge : tone === 'info' ? badgeBlue : badgeSlate

  return (
    <div style={statusCard}>
      <div style={statusTopRow}>
        <div style={statusLabelClusterStyle}>
          <TiqFeatureIcon name={icon} size="sm" variant="ghost" />
          <div style={metricLabel}>{label}</div>
        </div>
        <span style={toneStyle}>{value}</span>
      </div>
      <div style={statusDetail}>{detail}</div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={miniStatCard}>
      <div style={miniStatLabel}>{label}</div>
      <div style={miniStatValue}>{value}</div>
    </div>
  )
}

function PrimaryLink({ href, children, fullWidth = false }: { href: string; children: ReactNode; fullWidth?: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...primaryButton,
        width: fullWidth ? '100%' : undefined,
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 22px 44px rgba(74,222,128,0.28)' : primaryButton.boxShadow,
        transition: 'transform 150ms ease, box-shadow 150ms ease',
      }}
    >
      {children}
    </Link>
  )
}

function SecondarySmallLink({ href, children, fullWidth = false }: { href: string; children: ReactNode; fullWidth?: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...secondaryButtonSmall,
        width: fullWidth ? '100%' : undefined,
        borderColor: hovered ? 'rgba(116,190,255,0.34)' : 'rgba(116,190,255,0.18)',
        background: hovered ? 'var(--surface-soft-strong)' : 'var(--shell-chip-bg)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'all 150ms ease',
      }}
    >
      {children}
    </Link>
  )
}

function PrimarySmallBtn({
  onClick,
  disabled,
  children,
  fullWidth = false,
}: {
  onClick: () => void
  disabled?: boolean
  children: ReactNode
  fullWidth?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        ...primaryButtonSmallButton,
        width: fullWidth ? '100%' : undefined,
        transform: hovered && !disabled ? 'translateY(-2px)' : 'none',
        boxShadow: hovered && !disabled ? '0 20px 38px rgba(74,222,128,0.28)' : primaryButton.boxShadow,
        transition: 'transform 150ms ease, box-shadow 150ms ease',
        ...(disabled ? disabledButton : {}),
      }}
    >
      {children}
    </button>
  )
}

function SecondarySmallBtn({
  onClick,
  disabled,
  children,
  fullWidth = false,
}: {
  onClick: () => void
  disabled?: boolean
  children: ReactNode
  fullWidth?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        ...secondaryButtonSmallButton,
        width: fullWidth ? '100%' : undefined,
        borderColor: hovered && !disabled ? 'rgba(116,190,255,0.34)' : 'rgba(116,190,255,0.18)',
        background: hovered && !disabled ? 'var(--surface-soft-strong)' : 'var(--shell-chip-bg)',
        transform: hovered && !disabled ? 'translateY(-1px)' : 'none',
        transition: 'all 150ms ease',
        ...(disabled ? disabledButtonSecondary : {}),
      }}
    >
      {children}
    </button>
  )
}

function PrimaryBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        ...primaryButtonButton,
        transform: hovered && !disabled ? 'translateY(-2px)' : 'none',
        boxShadow: hovered && !disabled ? '0 22px 44px rgba(74,222,128,0.28)' : primaryButton.boxShadow,
        transition: 'transform 150ms ease, box-shadow 150ms ease',
        ...(disabled ? disabledButton : {}),
      }}
    >
      {children}
    </button>
  )
}

function buildCaptainLevelUpChallenge(challengeId: string, requestedCardId: string): CaptainLevelUpChallenge | null {
  const challenge = CAPTAIN_LEVEL_UP_CHALLENGES.find((item) => item.id === challengeId)
  if (!challenge) return null

  if (!requestedCardId || challenge.cardIds.includes(requestedCardId)) return challenge

  return {
    ...challenge,
    cardIds: [requestedCardId, ...challenge.cardIds.filter((cardId) => cardId !== requestedCardId)],
  }
}

function appendLevelUpChallengeHref(href: string, challengeId: string) {
  const [path, hash = ''] = href.split('#')
  const separator = path.includes('?') ? '&' : '?'
  const nextPath = `${path}${separator}levelUpChallenge=${encodeURIComponent(challengeId)}`
  return hash ? `${nextPath}#${hash}` : nextPath
}

function getCaptainLevelUpAggregateCompletionLabel(challenge: CaptainLevelUpChallenge) {
  if (challenge.id === 'match-day-routine') return '8 of 12 players completed match-day routine'
  return `0 of 12 players completed ${challenge.title.toLowerCase()}`
}

const pageWrap: CSSProperties = {
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 48px)))',
  margin: '0 auto',
  display: 'grid',
  gap: 18,
  padding: '18px 0 72px',
  minWidth: 0,
  overflowX: 'clip',
  boxSizing: 'border-box',
}

const loadingWrap: CSSProperties = {
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 48px)))',
  margin: '0 auto',
  display: 'grid',
  gap: 20,
  padding: '32px 0 72px',
  minWidth: 0,
}

const loadingStateCardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  flexWrap: 'wrap',
  padding: 18,
  borderRadius: 22,
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(8,13,28,0.66)',
  boxShadow: '0 18px 45px rgba(2,8,23,0.30)',
  color: 'var(--foreground)',
}

const loadingStateTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 18,
  fontWeight: 950,
  lineHeight: 1.2,
}

const loadingStateTextStyle: CSSProperties = {
  marginTop: 4,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
}

const heroCard: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.2fr) minmax(min(100%, 320px), 0.8fr)',
  gap: 22,
  padding: 24,
  borderRadius: 28,
  border: '1px solid rgba(116,190,255,0.15)',
  background: 'var(--portal-surface-bg)',
  boxShadow: '0 24px 70px rgba(2,8,23,0.42), inset 0 1px 0 rgba(255,255,255,0.05)',
  minWidth: 0,
  overflow: 'hidden',
}

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: 0,
  bottom: 'clamp(-112px, -10vw, -52px)',
  width: 'min(280px, 58vw)',
  aspectRatio: '1045 / 490',
  background: 'url("/tiq/logo/tiq-mark-light.png") center / contain no-repeat',
  opacity: 0.14,
  pointerEvents: 'none',
}

const heroLeft: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: 16,
  alignContent: 'start',
  minWidth: 0,
}

const lockedPreviewPanelStyle: CSSProperties = {
  padding: 24,
  borderRadius: 28,
  border: '1px solid rgba(116,190,255,0.15)',
  background: 'var(--portal-surface-bg)',
  boxShadow: '0 24px 70px rgba(2,8,23,0.32), inset 0 1px 0 rgba(255,255,255,0.05)',
  overflow: 'hidden',
}

const scopeHeaderStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minWidth: 0,
}

const scopeTitleStyle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.4rem, 2.4vw, 2rem)',
  lineHeight: 1.08,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainPreviewTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 15,
  lineHeight: 1.7,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const captainPreviewMobileActionRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainPreviewMobilePrimaryActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 38,
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'color-mix(in srgb, var(--brand-green) 24%, var(--shell-chip-bg) 76%)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 900,
  textAlign: 'center',
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const captainPreviewMobileSecondaryActionStyle: CSSProperties = {
  ...captainPreviewMobilePrimaryActionStyle,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(255,255,255,0.05)',
  color: '#e7eefb',
}

const captainPreviewGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainPreviewStepStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 34px) minmax(0, 1fr)',
  gap: 10,
  alignItems: 'start',
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.055)',
  overflowWrap: 'anywhere',
}

const captainPreviewStepNumberStyle: CSSProperties = {
  display: 'inline-grid',
  placeItems: 'center',
  width: 28,
  height: 28,
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--brand-green) 20%, var(--shell-chip-bg) 80%)',
  border: '1px solid rgba(155,225,29,0.22)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 950,
}

const captainPreviewStepCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  color: 'var(--foreground)',
  fontSize: 13,
  lineHeight: 1.45,
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const captainLevelUpChallengeStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
  padding: 18,
  borderRadius: 24,
  border: '1px solid rgba(155,225,29,0.22)',
  background:
    'linear-gradient(135deg, rgba(155,225,29,0.1), rgba(116,190,255,0.06)), var(--shell-panel-bg-strong)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.16)',
}

const captainLevelUpChallengeHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  gap: 12,
  minWidth: 0,
}

const captainLevelUpChallengeGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainLevelUpChallengeCardStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(5,11,22,0.28)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.4,
  overflowWrap: 'anywhere',
}

const captainDecisionPathShellStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
  padding: 18,
  borderRadius: 20,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(8,13,28,0.64)',
  boxShadow: '0 18px 45px rgba(2,8,23,0.28)',
}

const captainDecisionPathHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainDecisionPathTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.18rem, 2vw, 1.45rem)',
  lineHeight: 1.15,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainDecisionPathIntroStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.6,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const captainDecisionPathGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainDecisionPathCardStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'space-between',
  gap: 12,
  minWidth: 0,
  minHeight: 220,
  padding: 14,
  borderRadius: 16,
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const captainDecisionPathTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainDecisionPathLabelClusterStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
}

const captainDecisionPathLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const captainDecisionPathQuestionStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 16,
  lineHeight: 1.18,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainDecisionPathAnswerStyle: CSSProperties = {
  margin: '7px 0 0',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const heroControlRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  alignItems: 'center',
  minWidth: 0,
}

const selectStyle: CSSProperties = {
  minWidth: 0,
  width: '100%',
  flex: '1 1 min(100%, 320px)',
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  padding: '13px 14px',
  outline: 'none',
  fontSize: 14,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
  overflowWrap: 'anywhere',
}

const primaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '13px 16px',
  borderRadius: 16,
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: 14,
  color: 'var(--foreground-strong)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.26), rgba(34,211,238,0.13))',
  border: '1px solid rgba(155,225,29,0.34)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)',
  maxWidth: '100%',
  whiteSpace: 'normal',
  textAlign: 'center',
}

const primaryButtonSmall: CSSProperties = {
  ...primaryButton,
  padding: '11px 14px',
  fontSize: 13,
}

const secondaryButtonSmall: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '11px 14px',
  borderRadius: 14,
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: 13,
  color: 'var(--foreground-strong)',
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(255,255,255,0.045)',
  maxWidth: '100%',
  whiteSpace: 'normal',
  textAlign: 'center',
}

const primaryButtonButton: CSSProperties = {
  ...primaryButton,
  border: 'none',
  cursor: 'pointer',
}

const primaryButtonSmallButton: CSSProperties = {
  ...primaryButtonSmall,
  border: 'none',
  cursor: 'pointer',
}

const secondaryButtonSmallButton: CSSProperties = {
  ...secondaryButtonSmall,
  border: '1px solid rgba(125,211,252,0.16)',
  cursor: 'pointer',
}

const disabledButton: CSSProperties = {
  opacity: 0.55,
  cursor: 'not-allowed',
  boxShadow: 'none',
}

const disabledButtonSecondary: CSSProperties = {
  opacity: 0.55,
  cursor: 'not-allowed',
}

const badgeBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 12px',
  borderRadius: 999,
  fontWeight: 800,
  fontSize: 12,
  letterSpacing: '0.03em',
}

const badgeBlue: CSSProperties = {
  ...badgeBase,
  color: 'var(--foreground-strong)',
  border: '1px solid rgba(125,211,252,0.18)',
  background: 'rgba(125,211,252,0.08)',
}

const badgeGreen: CSSProperties = {
  ...badgeBase,
  color: 'var(--foreground-strong)',
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(155,225,29,0.11)',
}

const badgeSlate: CSSProperties = {
  ...badgeBase,
  color: 'var(--foreground)',
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(255,255,255,0.045)',
}

const errorCard: CSSProperties = {
  padding: 16,
  borderRadius: 20,
  border: '1px solid color-mix(in srgb, #ef4444 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, #ef4444 10%, var(--shell-chip-bg) 90%)',
  color: 'var(--foreground-strong)',
  fontWeight: 700,
  lineHeight: 1.55,
}

const statusStrip: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 14,
}

const statusCard: CSSProperties = {
  padding: 16,
  borderRadius: 20,
  border: '1px solid rgba(125,211,252,0.12)',
  background: 'rgba(255,255,255,0.045)',
  display: 'grid',
  gap: 10,
}

const statusTopRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
}

const statusLabelClusterStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
}

const statusDetail: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.6,
}

const captainSaveStatusShell: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 18,
  borderRadius: 24,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 18%, var(--shell-panel-border) 82%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 6%, var(--shell-panel-bg-strong) 94%)',
}

const captainSaveStatusHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  flexWrap: 'wrap',
}

const captainSaveStatusSummaryStyle: CSSProperties = {
  ...captainSaveStatusHeader,
  cursor: 'pointer',
  listStyle: 'none',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const captainSaveStatusTitle: CSSProperties = {
  margin: '3px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 20,
  fontWeight: 900,
  lineHeight: 1.15,
  letterSpacing: 0,
}

const captainSaveStatusGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 12,
}

const captainSaveStatusCard: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(255,255,255,0.04)',
}

const captainSaveStatusTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
}

const captainSaveStatusLabel: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const captainSaveStatusText: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.6,
}

const captainLocalSyncProofStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(155,225,29,0.07)',
}

const captainLocalSyncProofTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 16,
  fontWeight: 900,
  lineHeight: 1.2,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainLocalSyncProofGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainLocalSyncProofItemStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 12px) minmax(0, 1fr)',
  gap: 8,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainLocalSyncProofDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  marginTop: 6,
  borderRadius: '50%',
  background: 'var(--brand-green)',
  boxShadow: '0 0 0 4px rgba(155,225,29,0.10)',
}

const captainDecisionHandoffProofStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(116,190,255,0.06)',
}

const captainDecisionHandoffProofGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainDecisionHandoffProofItemStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 8,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(5,11,22,0.28)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainDecisionHandoffProofTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainMatchDayCommandStrip: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  padding: 16,
  borderRadius: 22,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(8,13,28,0.88)',
  boxShadow: '0 16px 40px rgba(2,8,23,0.28)',
  backdropFilter: 'blur(16px)',
}

const captainMatchDayCommandHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainMatchDayCommandTitle: CSSProperties = {
  margin: '3px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 18,
  lineHeight: 1.12,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainMatchDayCommandGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const captainMatchDayCommandAction: CSSProperties = {
  display: 'grid',
  alignContent: 'center',
  gap: 4,
  minWidth: 0,
  minHeight: 74,
  padding: 10,
  borderRadius: 14,
  color: 'var(--foreground-strong)',
  textAlign: 'left',
  whiteSpace: 'normal',
  cursor: 'pointer',
  overflowWrap: 'anywhere',
}

const captainMatchDayCommandActionGood: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.26)',
  background: 'rgba(155,225,29,0.09)',
}

const captainMatchDayCommandActionWarn: CSSProperties = {
  border: '1px solid rgba(251,191,36,0.28)',
  background: 'rgba(251,191,36,0.10)',
}

const captainMatchDayCommandActionInfo: CSSProperties = {
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(125,211,252,0.07)',
}

const captainMatchDayCommandLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  lineHeight: 1.2,
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const captainMatchDayCommandState: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 14,
  lineHeight: 1.12,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainMatchDayCommandDetail: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 760,
  overflowWrap: 'anywhere',
}

const captainEmergencyModeShell: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  padding: 16,
  borderRadius: 22,
  border: '1px solid rgba(251,191,36,0.22)',
  background: 'rgba(20,16,29,0.90)',
  boxShadow: '0 16px 40px rgba(2,8,23,0.30)',
  backdropFilter: 'blur(16px)',
}

const captainEmergencyModeHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainEmergencyModeTitle: CSSProperties = {
  margin: '3px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 18,
  lineHeight: 1.12,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainEmergencyModeSub: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainEmergencyModeHero: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(251,191,36,0.18)',
  background: 'rgba(251,191,36,0.08)',
  overflowWrap: 'anywhere',
}

const captainEmergencyModeFocus: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 20,
  lineHeight: 1.1,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainEmergencyModeDetail: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainEmergencyModeActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const captainEmergencyModeGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 165px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const captainEmergencyModeAction: CSSProperties = {
  display: 'grid',
  alignContent: 'center',
  gap: 4,
  minWidth: 0,
  minHeight: 78,
  padding: 10,
  borderRadius: 14,
  color: 'var(--foreground-strong)',
  textAlign: 'left',
  whiteSpace: 'normal',
  cursor: 'pointer',
  overflowWrap: 'anywhere',
}

const captainEmergencyModeActionWarn: CSSProperties = {
  border: '1px solid rgba(251,191,36,0.30)',
  background: 'rgba(251,191,36,0.12)',
}

const captainEmergencyModeActionGood: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.24)',
  background: 'rgba(155,225,29,0.09)',
}

const captainEmergencyModeActionInfo: CSSProperties = {
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(125,211,252,0.07)',
}

const captainEmergencyModeActionLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  lineHeight: 1.2,
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const captainEmergencyModeActionState: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 14,
  lineHeight: 1.12,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainEmergencyModeActionDetail: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 760,
  overflowWrap: 'anywhere',
}

const captainChangeAckShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  minWidth: 0,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'linear-gradient(135deg, rgba(125,211,252,0.08), rgba(8,13,28,0.78) 44%, rgba(18,28,46,0.86))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.25)',
}

const captainChangeAckHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainChangeAckTitle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 24,
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainChangeAckSub: CSSProperties = {
  maxWidth: 780,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainChangeAckSummaryGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainChangeAckSummaryCard: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const captainChangeAckGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.88fr) minmax(min(100%, 350px), 1.12fr)',
  gap: 14,
  minWidth: 0,
}

const captainChangeAckMain: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(5,11,22,0.30)',
  overflowWrap: 'anywhere',
}

const captainChangeAckTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainChangeAckFocus: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 21,
  lineHeight: 1.12,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainChangeAckDetail: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainChangeAckActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const captainChangeAckPanel: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(125,211,252,0.055)',
  overflowWrap: 'anywhere',
}

const captainChangeAckList: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 205px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const captainChangeAckCard: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 8,
  minWidth: 0,
  minHeight: 92,
  width: '100%',
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.26)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 800,
  textAlign: 'left',
  cursor: 'pointer',
  overflowWrap: 'anywhere',
}

const captainChangeAckCardGood: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'rgba(155,225,29,0.08)',
}

const captainChangeAckCardWarn: CSSProperties = {
  border: '1px solid rgba(251,191,36,0.24)',
  background: 'rgba(251,191,36,0.10)',
}

const captainChangeAckCardInfo: CSSProperties = {
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(125,211,252,0.07)',
}

const captainChangeAckCardTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
  color: 'var(--foreground-strong)',
  overflowWrap: 'anywhere',
}

const captainChangeAckCourt: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 12,
  lineHeight: 1.25,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const captainChangeAckCardDetail: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  lineHeight: 1.35,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const captainArrivalRiskShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  minWidth: 0,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(251,191,36,0.17)',
  background: 'linear-gradient(135deg, rgba(251,191,36,0.075), rgba(8,13,28,0.78) 44%, rgba(24,30,45,0.86))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.25)',
}

const captainArrivalRiskHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainArrivalRiskTitle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 24,
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainArrivalRiskSub: CSSProperties = {
  maxWidth: 780,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainArrivalRiskSummaryGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainArrivalRiskSummaryCard: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const captainArrivalRiskGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.88fr) minmax(min(100%, 360px), 1.12fr)',
  gap: 14,
  minWidth: 0,
}

const captainArrivalRiskMain: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(251,191,36,0.16)',
  background: 'rgba(5,11,22,0.30)',
  overflowWrap: 'anywhere',
}

const captainArrivalRiskTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainArrivalRiskFocus: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 21,
  lineHeight: 1.12,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainArrivalRiskDetail: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainArrivalRiskMetaGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 145px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const captainArrivalRiskMetaCard: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const captainArrivalRiskActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const captainArrivalRiskPanel: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(251,191,36,0.14)',
  background: 'rgba(251,191,36,0.055)',
  overflowWrap: 'anywhere',
}

const captainArrivalRiskList: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 215px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const captainArrivalRiskCard: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 8,
  minWidth: 0,
  minHeight: 132,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.26)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainArrivalRiskCardGood: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'rgba(155,225,29,0.08)',
}

const captainArrivalRiskCardWarn: CSSProperties = {
  border: '1px solid rgba(251,191,36,0.24)',
  background: 'rgba(251,191,36,0.11)',
}

const captainArrivalRiskCardInfo: CSSProperties = {
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(125,211,252,0.06)',
}

const captainArrivalRiskCardTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
  color: 'var(--foreground-strong)',
  overflowWrap: 'anywhere',
}

const captainArrivalRiskCourt: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 12,
  lineHeight: 1.25,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const captainArrivalRiskCardDetail: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  lineHeight: 1.35,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const captainArrivalRiskStatusGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 6,
  minWidth: 0,
}

const captainArrivalRiskStatusButton: CSSProperties = {
  minWidth: 0,
  minHeight: 34,
  padding: '7px 6px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.28)',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  lineHeight: 1.1,
  fontWeight: 900,
  cursor: 'pointer',
  overflowWrap: 'anywhere',
}

const captainArrivalRiskStatusButtonActive: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.26)',
  background: 'rgba(155,225,29,0.12)',
  color: 'var(--foreground-strong)',
}

const captainCourtHandoffShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  minWidth: 0,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.075), rgba(8,13,28,0.78) 42%, rgba(16,29,46,0.86))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.25)',
}

const captainCourtHandoffHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainCourtHandoffTitle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 24,
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainCourtHandoffSub: CSSProperties = {
  maxWidth: 780,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainCourtHandoffSummaryGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainCourtHandoffSummaryCard: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const captainCourtHandoffGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.88fr) minmax(min(100%, 380px), 1.12fr)',
  gap: 14,
  minWidth: 0,
}

const captainCourtHandoffMain: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'rgba(5,11,22,0.30)',
  overflowWrap: 'anywhere',
}

const captainCourtHandoffTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainCourtHandoffFocus: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 21,
  lineHeight: 1.12,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainCourtHandoffDetail: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainCourtHandoffMetaGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 145px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const captainCourtHandoffMetaCard: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const captainCourtHandoffActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const captainCourtHandoffPanel: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.14)',
  background: 'rgba(155,225,29,0.055)',
  overflowWrap: 'anywhere',
}

const captainCourtHandoffList: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 225px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const captainCourtHandoffCard: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 8,
  minWidth: 0,
  minHeight: 148,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.26)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainCourtHandoffCardGood: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'rgba(155,225,29,0.08)',
}

const captainCourtHandoffCardWarn: CSSProperties = {
  border: '1px solid rgba(251,191,36,0.24)',
  background: 'rgba(251,191,36,0.10)',
}

const captainCourtHandoffCardInfo: CSSProperties = {
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(125,211,252,0.06)',
}

const captainCourtHandoffCardTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
  color: 'var(--foreground-strong)',
  overflowWrap: 'anywhere',
}

const captainCourtHandoffPlayers: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 12,
  lineHeight: 1.3,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const captainCourtHandoffCardDetail: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  lineHeight: 1.35,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const captainCourtHandoffSignalRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const captainCourtHandoffButtonGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 6,
  minWidth: 0,
}

const captainCourtHandoffButton: CSSProperties = {
  minWidth: 0,
  minHeight: 34,
  padding: '7px 6px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.28)',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  lineHeight: 1.1,
  fontWeight: 900,
  cursor: 'pointer',
  overflowWrap: 'anywhere',
}

const captainCourtHandoffButtonActive: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.26)',
  background: 'rgba(155,225,29,0.12)',
  color: 'var(--foreground-strong)',
}

const captainNotificationQueueShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  minWidth: 0,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(125,211,252,0.17)',
  background: 'linear-gradient(135deg, rgba(125,211,252,0.08), rgba(8,13,28,0.78) 42%, rgba(21,28,44,0.88))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.24)',
}

const captainNotificationQueueHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainNotificationQueueTitle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 24,
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainNotificationQueueSub: CSSProperties = {
  maxWidth: 780,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainNotificationQueueSummaryGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainNotificationQueueSummaryCard: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const captainNotificationQueueGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.9fr) minmax(min(100%, 390px), 1.1fr)',
  gap: 14,
  minWidth: 0,
}

const captainNotificationQueueMain: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(5,11,22,0.30)',
  overflowWrap: 'anywhere',
}

const captainNotificationQueueTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainNotificationQueueFocus: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.1,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainNotificationQueueDetail: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainNotificationQueueMetaGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 145px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const captainNotificationQueueMetaCard: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const captainNotificationQueuePreview: CSSProperties = {
  minWidth: 0,
  minHeight: 100,
  maxHeight: 210,
  overflow: 'auto',
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.09)',
  background: 'rgba(2,6,23,0.30)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 760,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
}

const captainNotificationQueueActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const captainNotificationQueuePanel: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(125,211,252,0.055)',
  overflowWrap: 'anywhere',
}

const captainNotificationQueueList: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 225px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const captainNotificationQueueCard: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 8,
  minWidth: 0,
  minHeight: 190,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.26)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainNotificationQueueCardGood: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.21)',
  background: 'rgba(155,225,29,0.075)',
}

const captainNotificationQueueCardWarn: CSSProperties = {
  border: '1px solid rgba(251,191,36,0.24)',
  background: 'rgba(251,191,36,0.10)',
}

const captainNotificationQueueCardInfo: CSSProperties = {
  border: '1px solid rgba(125,211,252,0.17)',
  background: 'rgba(125,211,252,0.065)',
}

const captainNotificationQueueCardTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
  color: 'var(--foreground-strong)',
  overflowWrap: 'anywhere',
}

const captainNotificationQueueCardDetail: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  lineHeight: 1.35,
  fontWeight: 760,
  overflowWrap: 'anywhere',
}

const captainNotificationQueueCardPreview: CSSProperties = {
  minWidth: 0,
  minHeight: 74,
  maxHeight: 120,
  overflow: 'auto',
  padding: 9,
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(2,6,23,0.24)',
  color: 'var(--foreground-strong)',
  fontSize: 11,
  lineHeight: 1.45,
  fontWeight: 740,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
}

const captainNotificationQueueSignalRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const captainNotificationQueueButtonGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 6,
  minWidth: 0,
}

const captainNotificationQueueButton: CSSProperties = {
  minWidth: 0,
  minHeight: 34,
  padding: '7px 6px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.28)',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  lineHeight: 1.1,
  fontWeight: 900,
  cursor: 'pointer',
  overflowWrap: 'anywhere',
}

const captainNotificationQueueButtonActive: CSSProperties = {
  border: '1px solid rgba(125,211,252,0.28)',
  background: 'rgba(125,211,252,0.12)',
  color: 'var(--foreground-strong)',
}

const captainPlayerBriefShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  minWidth: 0,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.075), rgba(8,13,28,0.78) 42%, rgba(20,32,54,0.86))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.24)',
}

const captainPlayerBriefHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainPlayerBriefTitle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 24,
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainPlayerBriefSub: CSSProperties = {
  maxWidth: 780,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainPlayerBriefSummaryGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainPlayerBriefSummaryCard: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const captainPlayerBriefGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.88fr) minmax(min(100%, 390px), 1.12fr)',
  gap: 14,
  minWidth: 0,
}

const captainPlayerBriefMain: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'rgba(5,11,22,0.30)',
  overflowWrap: 'anywhere',
}

const captainPlayerBriefTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainPlayerBriefFocus: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.1,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainPlayerBriefDetail: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainPlayerBriefMetaGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 145px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const captainPlayerBriefMetaCard: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const captainPlayerBriefPreview: CSSProperties = {
  minWidth: 0,
  minHeight: 112,
  maxHeight: 220,
  overflow: 'auto',
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.09)',
  background: 'rgba(2,6,23,0.30)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 760,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
}

const captainPlayerBriefActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const captainPlayerBriefPanel: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.14)',
  background: 'rgba(155,225,29,0.055)',
  overflowWrap: 'anywhere',
}

const captainPlayerBriefList: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 225px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const captainPlayerBriefCard: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 8,
  minWidth: 0,
  minHeight: 180,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.26)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainPlayerBriefCardGood: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'rgba(155,225,29,0.08)',
}

const captainPlayerBriefCardWarn: CSSProperties = {
  border: '1px solid rgba(251,191,36,0.24)',
  background: 'rgba(251,191,36,0.10)',
}

const captainPlayerBriefCardInfo: CSSProperties = {
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(125,211,252,0.06)',
}

const captainPlayerBriefCardTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
  color: 'var(--foreground-strong)',
  overflowWrap: 'anywhere',
}

const captainPlayerBriefCardDetail: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  lineHeight: 1.35,
  fontWeight: 760,
  overflowWrap: 'anywhere',
}

const captainPlayerBriefPromptGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 7,
  minWidth: 0,
}

const captainPlayerBriefPromptGridItem: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  padding: 8,
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(2,6,23,0.24)',
  overflowWrap: 'anywhere',
}

const captainPlayerBriefButtonGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 6,
  minWidth: 0,
}

const captainPlayerBriefButton: CSSProperties = {
  minWidth: 0,
  minHeight: 34,
  padding: '7px 6px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.28)',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  lineHeight: 1.1,
  fontWeight: 900,
  cursor: 'pointer',
  overflowWrap: 'anywhere',
}

const captainPlayerBriefButtonActive: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.26)',
  background: 'rgba(155,225,29,0.12)',
  color: 'var(--foreground-strong)',
}

const captainMorningBriefShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  minWidth: 0,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.08), rgba(8,13,28,0.78) 42%, rgba(14,23,39,0.86))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.24)',
}

const captainMorningBriefGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.88fr) minmax(min(100%, 380px), 1.12fr)',
  gap: 14,
  minWidth: 0,
}

const captainMorningBriefHero: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(5,11,22,0.30)',
  overflowWrap: 'anywhere',
}

const captainMorningBriefHeroTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainMorningBriefTitle: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 23,
  lineHeight: 1.08,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainMorningBriefDetail: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainMorningBriefMetaRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
  color: 'var(--foreground-strong)',
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const captainMorningBriefActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const captainMorningBriefPanel: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  alignContent: 'start',
}

const captainMorningBriefSummaryGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 165px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const captainMorningBriefSummaryCard: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const captainMorningBriefSummaryTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  lineHeight: 1.2,
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const captainMorningBriefLineupPanel: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(2,6,23,0.25)',
  overflowWrap: 'anywhere',
}

const captainMorningBriefLineupList: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const captainMorningBriefLineupRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.34fr) minmax(0, 0.66fr)',
  gap: 8,
  minWidth: 0,
  padding: 10,
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.035)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainSendQueueShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  minWidth: 0,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'linear-gradient(135deg, rgba(125,211,252,0.08), rgba(8,13,28,0.78) 43%, rgba(16,24,39,0.86))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.24)',
}

const captainSendQueueHero: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.30)',
  overflowWrap: 'anywhere',
}

const captainSendQueueTitle: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.1,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainSendQueueDetail: CSSProperties = {
  margin: '7px 0 0',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainSendQueueGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))',
  gap: 12,
  minWidth: 0,
}

const captainSendQueueCard: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
  padding: 13,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const captainSendQueueCardTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 9,
  flexWrap: 'wrap',
  minWidth: 0,
  color: 'var(--foreground-strong)',
}

const captainSendQueueStep: CSSProperties = {
  display: 'block',
  marginBottom: 4,
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  lineHeight: 1.2,
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const captainSendQueueCardDetail: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainSendQueuePreview: CSSProperties = {
  minWidth: 0,
  minHeight: 86,
  padding: 10,
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(2,6,23,0.26)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 760,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
}

const captainSendQueueActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 9,
  minWidth: 0,
}

const captainDecisionLogShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  minWidth: 0,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(8,13,28,0.80) 44%, rgba(21,28,44,0.88))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.24)',
}

const captainDecisionLogGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.82fr) minmax(min(100%, 360px), 1.18fr)',
  gap: 14,
  minWidth: 0,
}

const captainDecisionLogHero: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.30)',
  overflowWrap: 'anywhere',
}

const captainDecisionLogHeroTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainDecisionLogTitle: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.1,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainDecisionLogDetail: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainDecisionLogActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const captainDecisionLogPanel: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
}

const captainDecisionLogList: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainDecisionLogEntryCard: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 8,
  minWidth: 0,
  padding: 12,
  borderRadius: 15,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainDecisionLogEntryTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
  color: 'var(--foreground-strong)',
}

const captainHandoffSheetShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  minWidth: 0,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.075), rgba(8,13,28,0.80) 43%, rgba(17,28,44,0.88))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.24)',
}

const captainHandoffSheetGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.92fr) minmax(min(100%, 340px), 1.08fr)',
  gap: 14,
  minWidth: 0,
}

const captainHandoffSheetHero: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'rgba(5,11,22,0.31)',
  overflowWrap: 'anywhere',
}

const captainHandoffSheetHeroTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainHandoffSheetTitle: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.1,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainHandoffSheetDetail: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainHandoffSheetPreview: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(2,6,23,0.28)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 780,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
}

const captainHandoffSheetActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const captainHandoffSheetPanel: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
}

const captainHandoffSheetCheckGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 185px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainHandoffSheetCheckCard: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 8,
  minWidth: 0,
  padding: 12,
  borderRadius: 15,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainHandoffSheetCheckTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
  color: 'var(--foreground-strong)',
}

const captainPreSendReviewShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  minWidth: 0,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'linear-gradient(135deg, rgba(125,211,252,0.08), rgba(8,13,28,0.76) 44%, rgba(12,22,38,0.84))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.25)',
}

const captainPreSendHero: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.30)',
  overflowWrap: 'anywhere',
}

const captainPreSendTitle: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 21,
  lineHeight: 1.12,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainPreSendDetail: CSSProperties = {
  margin: '7px 0 0',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainQuickCopySummaryCard: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'rgba(155,225,29,0.065)',
  overflowWrap: 'anywhere',
}

const captainQuickCopySummaryHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainQuickCopySummaryTitle: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 18,
  lineHeight: 1.12,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainQuickCopySummaryPreview: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.32)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 800,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
}

const captainQuickCopySummaryActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const captainPreSendReviewGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainPreSendCheckCard: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 8,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainPreSendCheckTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
  color: 'var(--foreground-strong)',
}

const captainPreSendActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const captainPostSendTrackerShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  minWidth: 0,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(251,191,36,0.18)',
  background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(8,13,28,0.76) 44%, rgba(22,28,44,0.84))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.25)',
}

const captainPostSendSummaryGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainPostSendSummaryCard: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const captainPostSendTrackerGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.9fr) minmax(min(100%, 330px), 1.1fr)',
  gap: 14,
  minWidth: 0,
}

const captainPostSendMain: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(251,191,36,0.16)',
  background: 'rgba(5,11,22,0.30)',
  overflowWrap: 'anywhere',
}

const captainPostSendTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainPostSendTitle: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 21,
  lineHeight: 1.12,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainPostSendDetail: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainPostSendActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const captainPostSendChangePanel: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(251,191,36,0.14)',
  background: 'rgba(251,191,36,0.055)',
  overflowWrap: 'anywhere',
}

const captainPostSendChangeList: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 205px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const captainPostSendChangeCard: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 8,
  minWidth: 0,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.26)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainPostSendChangeTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
  color: 'var(--foreground-strong)',
}

const captainReplyReminderPanel: CSSProperties = {
  display: 'grid',
  gap: 12,
  gridColumn: '1 / -1',
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(96,165,250,0.18)',
  background: 'rgba(15,23,42,0.42)',
  overflowWrap: 'anywhere',
}

const captainReplyReminderHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainReplyReminderTitle: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 18,
  lineHeight: 1.18,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainReplyReminderTargetList: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const captainReplyReminderTarget: CSSProperties = {
  display: 'inline-flex',
  maxWidth: '100%',
  minWidth: 0,
  padding: '7px 9px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.055)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.25,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const captainReplyReminderTargetWarn: CSSProperties = {
  ...captainReplyReminderTarget,
  border: '1px solid rgba(251,191,36,0.26)',
  background: 'rgba(251,191,36,0.12)',
  color: 'var(--foreground-strong)',
}

const captainReplyReminderPreview: CSSProperties = {
  minWidth: 0,
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(2,6,23,0.30)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 800,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
}

const captainReplyReminderActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const commandCenterShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'rgba(8,13,28,0.64)',
  boxShadow: '0 18px 45px rgba(2,8,23,0.30)',
}

const commandCenterHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 14,
  flexWrap: 'wrap',
}

const commandCenterSnapshotGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const commandCenterSnapshotCard: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(125,211,252,0.13)',
  background: 'rgba(255,255,255,0.04)',
  overflowWrap: 'anywhere',
}

const commandCenterSnapshotLabel: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const commandCenterSnapshotValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 18,
  lineHeight: 1.12,
  fontWeight: 950,
}

const commandCenterSnapshotDetail: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 750,
}

const commandCenterReadinessShell: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(163,230,53,0.18)',
  background: 'rgba(163,230,53,0.07)',
}

const commandCenterReadinessTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 900,
}

const commandCenterReadinessTrack: CSSProperties = {
  position: 'relative',
  height: 8,
  overflow: 'hidden',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.1)',
}

const commandCenterReadinessFill: CSSProperties = {
  display: 'block',
  height: '100%',
  minWidth: 8,
  borderRadius: 999,
  background: 'linear-gradient(90deg, var(--brand-blue-2), var(--brand-lime))',
}

const commandCenterGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 14,
  minWidth: 0,
}

const commandCenterCard: CSSProperties = {
  display: 'grid',
  alignContent: 'space-between',
  gap: 14,
  minWidth: 0,
  minHeight: 230,
  padding: 16,
  borderRadius: 20,
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const commandCenterCardGood: CSSProperties = {
  border: '1px solid rgba(74,222,128,0.18)',
}

const commandCenterCardWarn: CSSProperties = {
  border: '1px solid rgba(248,113,113,0.2)',
}

const commandCenterCardInfo: CSSProperties = {
  border: '1px solid rgba(147,197,253,0.18)',
}

const commandCenterCardLocked: CSSProperties = {
  opacity: 0.82,
}

const commandCenterTopRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
}

const commandCenterLabelCluster: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
}

const commandCenterLabel: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const commandCenterTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 19,
  fontWeight: 900,
  lineHeight: 1.12,
  letterSpacing: 0,
}

const commandCenterText: CSSProperties = {
  marginTop: 8,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.65,
}

const commandCenterActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const seasonLaunchShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'linear-gradient(135deg, rgba(125,211,252,0.08), rgba(8,13,28,0.74) 42%, rgba(18,29,47,0.82))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.24)',
  minWidth: 0,
}

const seasonLaunchSnapshotGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const seasonLaunchSnapshotCard: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(255,255,255,0.04)',
  overflowWrap: 'anywhere',
}

const seasonLaunchGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: 12,
  minWidth: 0,
}

const seasonLaunchCard: CSSProperties = {
  display: 'grid',
  alignContent: 'space-between',
  gap: 12,
  minWidth: 0,
  minHeight: 178,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.28)',
  overflowWrap: 'anywhere',
}

const seasonLaunchCardTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
}

const seasonLaunchCardDetail: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const seasonLaunchActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const opponentScoutShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(116,190,255,0.15)',
  background: 'linear-gradient(135deg, rgba(116,190,255,0.08), rgba(8,13,28,0.76) 44%, rgba(23,32,51,0.84))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.25)',
  minWidth: 0,
}

const opponentScoutGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(min(100%, 310px), 0.88fr)',
  gap: 14,
  minWidth: 0,
}

const opponentScoutMain: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(5,11,22,0.30)',
  overflowWrap: 'anywhere',
}

const opponentScoutHeroTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const opponentScoutTitle: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.1,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const opponentScoutMetaGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const opponentScoutMetaCard: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const opponentScoutNoteCard: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
  padding: 12,
  borderRadius: 15,
  border: '1px solid rgba(155,225,29,0.14)',
  background: 'rgba(155,225,29,0.055)',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const opponentScoutChecklist: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(125,211,252,0.06)',
  overflowWrap: 'anywhere',
}

const opponentScoutList: CSSProperties = {
  display: 'grid',
  gap: 9,
  minWidth: 0,
}

const opponentScoutItem: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.26)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const opponentScoutItemTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
  color: 'var(--foreground-strong)',
}

const opponentScoutActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const playerReadinessPulseShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(34,211,238,0.16)',
  background: 'linear-gradient(135deg, rgba(34,211,238,0.08), rgba(8,13,28,0.76) 44%, rgba(18,29,50,0.84))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.25)',
  minWidth: 0,
}

const playerReadinessPulseGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(min(100%, 300px), 0.86fr)',
  gap: 14,
  minWidth: 0,
}

const playerReadinessMain: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(5,11,22,0.30)',
  overflowWrap: 'anywhere',
}

const playerReadinessScoreTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const playerReadinessScoreValue: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 30,
  lineHeight: 1,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const playerReadinessMetricGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const playerReadinessMetricCard: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const playerReadinessChecklist: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(125,211,252,0.06)',
  overflowWrap: 'anywhere',
}

const playerReadinessList: CSSProperties = {
  display: 'grid',
  gap: 9,
  minWidth: 0,
}

const playerReadinessItem: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.26)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const playerReadinessItemTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
  color: 'var(--foreground-strong)',
}

const playerReadinessActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const captainNudgeComposerShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.08), rgba(8,13,28,0.76) 42%, rgba(26,36,55,0.84))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.25)',
  minWidth: 0,
}

const captainNudgeComposerGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.82fr) minmax(min(100%, 340px), 1fr)',
  gap: 14,
  minWidth: 0,
}

const captainNudgeFeaturedDraft: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'rgba(5,11,22,0.30)',
  overflowWrap: 'anywhere',
}

const captainNudgeFeaturedTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainNudgeFeaturedTitle: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.1,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainNudgeDraftBody: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainNudgeDraftList: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(125,211,252,0.055)',
  overflowWrap: 'anywhere',
}

const captainNudgeDraftGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const captainNudgeDraftCard: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 8,
  minWidth: 0,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.26)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainNudgeDraftTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
  color: 'var(--foreground-strong)',
}

const captainNudgeActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const captainNudgeMiniActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
}

const captainWeekTimelineShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(135deg, rgba(116,190,255,0.08), rgba(8,13,28,0.76) 44%, rgba(20,32,54,0.84))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.25)',
  minWidth: 0,
}

const captainWeekTimelineGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainWeekTimelineCard: CSSProperties = {
  display: 'grid',
  alignContent: 'space-between',
  gap: 12,
  minWidth: 0,
  minHeight: 210,
  padding: 13,
  borderRadius: 16,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(5,11,22,0.28)',
  overflowWrap: 'anywhere',
}

const captainWeekTimelineTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainWeekTimelineMarker: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
}

const captainWeekTimelineDot: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  flex: '0 0 28px',
  borderRadius: 999,
  color: 'var(--foreground-strong)',
  border: '1px solid rgba(155,225,29,0.24)',
  background: 'rgba(155,225,29,0.10)',
  fontSize: 12,
  fontWeight: 950,
}

const captainWeekTimelineBody: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainWeekTimelineTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 15,
  lineHeight: 1.2,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainCourtConfidenceShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.085), rgba(8,13,28,0.76) 42%, rgba(18,32,52,0.84))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.25)',
  minWidth: 0,
}

const captainCourtConfidenceSummary: CSSProperties = {
  display: 'grid',
  gap: 11,
  minWidth: 0,
}

const captainCourtConfidenceTrack: CSSProperties = {
  position: 'relative',
  height: 12,
  minWidth: 0,
  overflow: 'hidden',
  borderRadius: 999,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(5,11,22,0.34)',
}

const captainCourtConfidenceFill: CSSProperties = {
  position: 'absolute',
  inset: '0 auto 0 0',
  borderRadius: 999,
  background: 'linear-gradient(90deg, rgba(155,225,29,0.82), rgba(34,211,238,0.58))',
}

const captainCourtConfidenceStats: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 9,
  minWidth: 0,
}

const captainCourtConfidenceStatCard: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const captainCourtConfidenceGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainCourtConfidenceCard: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
  padding: 12,
  borderRadius: 15,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(5,11,22,0.28)',
  overflowWrap: 'anywhere',
}

const captainCourtConfidenceTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
  color: 'var(--foreground-strong)',
}

const captainCourtConfidenceBody: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainCourtConfidencePlayers: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const captainCourtConfidenceActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const captainBenchReadinessShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(34,211,238,0.16)',
  background: 'linear-gradient(135deg, rgba(34,211,238,0.075), rgba(8,13,28,0.76) 44%, rgba(20,32,54,0.84))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.25)',
  minWidth: 0,
}

const captainBenchReadinessGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.8fr) minmax(min(100%, 340px), 1fr)',
  gap: 14,
  minWidth: 0,
}

const captainBenchReadinessLead: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(5,11,22,0.30)',
  overflowWrap: 'anywhere',
}

const captainBenchReadinessTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainBenchReadinessName: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.1,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainBenchReadinessSignalGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 135px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const captainBenchReadinessSignalCard: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const captainBenchReadinessDetail: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainBenchReadinessListPanel: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(125,211,252,0.055)',
  overflowWrap: 'anywhere',
}

const captainBenchReadinessList: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const captainBenchReadinessCard: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 8,
  minWidth: 0,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.26)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainBenchReadinessCardTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
  color: 'var(--foreground-strong)',
}

const captainBenchReadinessMeta: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: 0,
}

const captainBenchReadinessActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const captainCourtSwapShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(251,191,36,0.18)',
  background: 'linear-gradient(135deg, rgba(251,191,36,0.09), rgba(8,13,28,0.76) 44%, rgba(22,28,44,0.84))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.25)',
  minWidth: 0,
}

const captainCourtSwapGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.9fr) minmax(min(100%, 320px), 1.1fr)',
  gap: 14,
  minWidth: 0,
}

const captainCourtSwapLead: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(251,191,36,0.16)',
  background: 'rgba(5,11,22,0.30)',
  overflowWrap: 'anywhere',
}

const captainCourtSwapTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainCourtSwapCourt: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.1,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainCourtSwapSignalGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 118px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const captainCourtSwapSignalCard: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const captainCourtSwapDetail: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainCourtSwapListPanel: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(251,191,36,0.14)',
  background: 'rgba(251,191,36,0.055)',
  overflowWrap: 'anywhere',
}

const captainCourtSwapListHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainCourtSwapList: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 205px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const captainCourtSwapCard: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 8,
  minWidth: 0,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.26)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainCourtSwapCardTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
  color: 'var(--foreground-strong)',
}

const captainCourtSwapMeta: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
  color: 'var(--brand-blue-2)',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: 0,
}

const captainCourtSwapActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const matchDaySheetShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(163,230,53,0.16)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.09), rgba(8,13,28,0.76) 42%, rgba(14,25,48,0.82))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.26)',
  minWidth: 0,
}

const matchDayLogisticsGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const matchDayLogisticsCard: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'rgba(255,255,255,0.04)',
  overflowWrap: 'anywhere',
}

const matchDaySheetGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.18fr) minmax(min(100%, 300px), 0.82fr)',
  gap: 14,
  minWidth: 0,
}

const matchDaySheetMain: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(5,11,22,0.30)',
  overflowWrap: 'anywhere',
}

const matchDaySheetTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const matchDaySheetTitle: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 20,
  lineHeight: 1.12,
  fontWeight: 950,
  letterSpacing: 0,
}

const matchDayLineupStack: CSSProperties = {
  display: 'grid',
  gap: 9,
  minWidth: 0,
}

const matchDayCourtCard: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
  padding: 12,
  borderRadius: 15,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const matchDayCourtTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
}

const matchDayCourtLabel: CSSProperties = {
  color: 'var(--brand-lime)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
}

const matchDayCourtPlayers: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 15,
  lineHeight: 1.25,
  fontWeight: 900,
}

const matchDayMoreLineups: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const matchDayChecklistPanel: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.14)',
  background: 'rgba(155,225,29,0.06)',
  overflowWrap: 'anywhere',
}

const matchDayChecklistGrid: CSSProperties = {
  display: 'grid',
  gap: 9,
  minWidth: 0,
}

const matchDayChecklistItem: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.26)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const matchDayChecklistTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
  color: 'var(--foreground-strong)',
}

const matchDayActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const matchDaySubBoardShell: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(5,11,22,0.28)',
  overflowWrap: 'anywhere',
}

const matchDaySubBoardHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const matchDaySubBoardGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.9fr) minmax(min(100%, 300px), 1.1fr)',
  gap: 12,
  minWidth: 0,
}

const matchDaySubPanel: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 9,
  minWidth: 0,
}

const matchDaySubList: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const matchDaySubCard: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const matchDaySubCandidateCard: CSSProperties = {
  ...matchDaySubCard,
  borderColor: 'rgba(155,225,29,0.14)',
  background: 'rgba(155,225,29,0.055)',
}

const matchDaySubCandidateTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
}

const matchDaySubCandidateName: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 14,
  lineHeight: 1.25,
  fontWeight: 950,
}

const matchDaySubCandidateFit: CSSProperties = {
  color: 'var(--brand-lime)',
  fontSize: 12,
  lineHeight: 1.25,
  fontWeight: 950,
  textTransform: 'uppercase',
}

const matchDaySubActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const postMatchCloseoutShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(74,222,128,0.14)',
  background: 'linear-gradient(135deg, rgba(74,222,128,0.08), rgba(8,13,28,0.74) 44%, rgba(20,31,50,0.82))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.24)',
  minWidth: 0,
}

const postMatchCloseoutGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(min(100%, 300px), 0.86fr)',
  gap: 14,
  minWidth: 0,
}

const postMatchCloseoutMain: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.14)',
  background: 'rgba(5,11,22,0.30)',
  overflowWrap: 'anywhere',
}

const postMatchCourtList: CSSProperties = {
  display: 'grid',
  gap: 9,
  minWidth: 0,
}

const postMatchCourtCard: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
  padding: 12,
  borderRadius: 15,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const postMatchCloseoutChecklist: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(125,211,252,0.06)',
  overflowWrap: 'anywhere',
}

const postMatchCloseoutList: CSSProperties = {
  display: 'grid',
  gap: 9,
  minWidth: 0,
}

const postMatchCloseoutItem: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.26)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const postMatchCloseoutTop: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
  color: 'var(--foreground-strong)',
}

const postMatchActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const captainScoreCaptureShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  minWidth: 0,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(74,222,128,0.16)',
  background: 'linear-gradient(135deg, rgba(74,222,128,0.075), rgba(8,13,28,0.78) 43%, rgba(16,30,46,0.86))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.24)',
}

const captainScoreCaptureSummaryGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 145px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainScoreCaptureSummaryCard: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 12,
  borderRadius: 15,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const captainScoreCaptureGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.78fr) minmax(min(100%, 380px), 1.22fr)',
  gap: 14,
  minWidth: 0,
}

const captainScoreCaptureHero: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(74,222,128,0.16)',
  background: 'rgba(5,11,22,0.31)',
  overflowWrap: 'anywhere',
}

const captainScoreCaptureHeroTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainScoreCaptureTitle: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.1,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainScoreCaptureDetail: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainScoreCaptureActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const captainScoreCapturePanel: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
}

const captainScoreCaptureList: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainScoreCaptureCard: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
  padding: 12,
  borderRadius: 15,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainScoreCaptureCardTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
  color: 'var(--foreground-strong)',
}

const captainScoreCapturePlayers: CSSProperties = {
  display: 'block',
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.32,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const captainScoreCaptureButtonGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 7,
  minWidth: 0,
}

const captainScoreCaptureChoice: CSSProperties = {
  minWidth: 0,
  minHeight: 42,
  padding: '9px 7px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.28)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.1,
  fontWeight: 900,
  letterSpacing: 0,
  cursor: 'pointer',
  overflowWrap: 'anywhere',
}

const captainScoreCaptureChoiceActive: CSSProperties = {
  ...captainScoreCaptureChoice,
  border: '1px solid rgba(74,222,128,0.28)',
  background: 'rgba(74,222,128,0.14)',
  color: 'var(--foreground-strong)',
}

const captainScoreCaptureChoiceWarn: CSSProperties = {
  ...captainScoreCaptureChoice,
  border: '1px solid rgba(251,191,36,0.28)',
  background: 'rgba(251,191,36,0.13)',
  color: 'var(--foreground-strong)',
}

const captainPostMatchRecapShell: CSSProperties = {
  display: 'grid',
  gap: 16,
  minWidth: 0,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'linear-gradient(135deg, rgba(125,211,252,0.075), rgba(8,13,28,0.78) 43%, rgba(17,28,48,0.86))',
  boxShadow: '0 18px 45px rgba(2,8,23,0.24)',
}

const captainPostMatchRecapGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(min(100%, 340px), 0.9fr)',
  gap: 14,
  minWidth: 0,
}

const captainPostMatchRecapHero: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(5,11,22,0.31)',
  overflowWrap: 'anywhere',
}

const captainPostMatchRecapHeroTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  minWidth: 0,
}

const captainPostMatchRecapTitle: CSSProperties = {
  marginTop: 4,
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.1,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const captainPostMatchRecapPreview: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(2,6,23,0.28)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  lineHeight: 1.48,
  fontWeight: 780,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
}

const captainPostMatchRecapActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const captainPostMatchRecapPanel: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
  minWidth: 0,
}

const captainPostMatchRecapStatGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 145px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainPostMatchRecapStatCard: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 12,
  borderRadius: 15,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  overflowWrap: 'anywhere',
}

const captainPostMatchRecapList: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const captainPostMatchRecapCard: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 8,
  minWidth: 0,
  padding: 12,
  borderRadius: 15,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const captainPostMatchRecapCardTop: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
  flexWrap: 'wrap',
  minWidth: 0,
  color: 'var(--foreground-strong)',
}

const nextActionShell: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.9fr) minmax(min(100%, 320px), 1.1fr)',
  gap: 18,
  padding: 22,
  borderRadius: 28,
  border: '1px solid rgba(74,222,128,0.14)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.16)',
}

const nextActionIntro: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 10,
}

const nextActionGrid: CSSProperties = {
  display: 'grid',
  gap: 16,
}

const nextActionCard: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 18,
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
}

const nextActionCardAccent: CSSProperties = {
  ...nextActionCard,
  border: '1px solid rgba(163,230,53,0.2)',
  background: 'var(--shell-chip-bg-strong)',
}

const nextActionLabel: CSSProperties = {
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
}

const nextActionHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
}

const nextActionTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1.08,
  letterSpacing: 0,
}

const nextActionText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.7,
}

const nextActionButtonRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
}

const warnBadge: CSSProperties = {
  ...badgeBase,
  color: '#fecaca',
  border: '1px solid rgba(248,113,113,0.22)',
  background: 'rgba(60,16,24,0.76)',
}

const stateCard: CSSProperties = {
  padding: 18,
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  color: 'var(--foreground)',
  fontWeight: 700,
}

const scopeBanner: CSSProperties = {
  marginTop: '12px',
  borderRadius: '18px',
  padding: '12px 14px',
  background: 'var(--surface-soft)',
  border: '1px solid var(--card-border-soft)',
  color: 'var(--foreground)',
  fontWeight: 700,
  fontSize: '14px',
  lineHeight: 1.55,
  maxWidth: '940px',
}

const scopeBannerWarn: CSSProperties = {
  background: 'color-mix(in srgb, #f59e0b 12%, var(--shell-chip-bg) 88%)',
  border: '1px solid color-mix(in srgb, #f59e0b 22%, var(--shell-panel-border) 78%)',
  color: 'var(--foreground-strong)',
}

const captainDataAssistCueStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
  maxWidth: 940,
  padding: '12px 14px',
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 22%, var(--shell-panel-border) 78%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 8%, var(--shell-chip-bg) 92%)',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.55,
}

const captainDataAssistLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 36,
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-lime) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-lime) 10%, var(--shell-chip-bg) 90%)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 950,
  maxWidth: '100%',
  whiteSpace: 'normal',
  textAlign: 'center',
}

const captainPlayerIdStarterCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
  flex: '1 1 420px',
  overflowWrap: 'anywhere',
}

const captainPlayerIdStarterStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  marginTop: 4,
  padding: 11,
  borderRadius: 14,
  border: '1px solid color-mix(in srgb, var(--brand-lime) 18%, var(--shell-panel-border) 82%)',
  background: 'color-mix(in srgb, var(--brand-lime) 7%, var(--shell-chip-bg) 93%)',
  overflowWrap: 'anywhere',
}

const captainPlayerIdStarterHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
}

const captainPlayerIdStarterEyebrowStyle: CSSProperties = {
  color: 'var(--brand-lime)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const captainPlayerIdStarterTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 14,
  lineHeight: 1.2,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const captainPlayerIdStarterGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 158px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const captainPlayerIdStarterCardStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  padding: 10,
  borderRadius: 12,
  border: '1px solid color-mix(in srgb, var(--brand-blue-2) 14%, var(--shell-panel-border) 86%)',
  background: 'color-mix(in srgb, var(--brand-blue-2) 6%, var(--shell-panel-bg) 94%)',
  overflowWrap: 'anywhere',
}

const captainPlayerIdStarterLabelStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const captainPlayerIdStarterValueStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const captainEmptyActionListStyle: CSSProperties = {
  margin: '8px 0 0',
  paddingLeft: 18,
}

const captainEmptyActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
  maxWidth: '100%',
}

const glanceGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
  gap: 16,
}

const glanceCard: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 18,
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
}

const glanceCardAccent: CSSProperties = {
  ...glanceCard,
  border: '1px solid rgba(163,230,53,0.22)',
  background: 'var(--shell-chip-bg-strong)',
}

const glanceLabel: CSSProperties = {
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
}

const glanceValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1.15,
  letterSpacing: 0,
}

const glanceHint: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.6,
}

const glanceActionRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  marginTop: 18,
}

const weekStatusShell: CSSProperties = {
  marginTop: 18,
  display: 'grid',
  gap: 14,
  padding: 18,
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
}

const weekStatusValue: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 24,
  fontWeight: 900,
  lineHeight: 1.1,
  letterSpacing: 0,
  marginTop: 6,
}

const weekStatusButtonRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
}

const metricLabel: CSSProperties = {
  fontSize: 12,
  color: 'var(--foreground)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 800,
}

const sectionCard: CSSProperties = {
  display: 'grid',
  gap: 18,
  padding: 22,
  borderRadius: 28,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: '0 18px 48px rgba(2,10,24,0.16)',
}

const sectionHead: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'start',
  gap: 16,
  flexWrap: 'wrap',
}

const optionalSummaryStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  cursor: 'pointer',
  listStyle: 'none',
}

const weeklyDetailsSummaryStyle: CSSProperties = {
  ...optionalSummaryStyle,
  marginBottom: 0,
}

const optionalSummaryTitle: CSSProperties = {
  display: 'block',
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.1,
  fontWeight: 900,
  marginTop: 6,
}

const sectionKicker: CSSProperties = {
  fontSize: 12,
  color: 'var(--shell-copy-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 800,
}

const sectionTitle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 28,
  lineHeight: 1.06,
  letterSpacing: 0,
}

const sectionSub: CSSProperties = {
  marginTop: 8,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.7,
}

const notesScopeBanner: CSSProperties = {
  borderRadius: 18,
  padding: '12px 14px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  color: 'var(--foreground)',
  fontWeight: 700,
  fontSize: 14,
  lineHeight: 1.6,
}

const notesGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
  gap: 16,
}

const notesField: CSSProperties = {
  display: 'grid',
  gap: 8,
}

const notesLabel: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 14,
  fontWeight: 800,
}

const notesHint: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.65,
}

const notesTextarea: CSSProperties = {
  width: '100%',
  minHeight: 148,
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  padding: '14px 16px',
  outline: 'none',
  resize: 'vertical',
  lineHeight: 1.65,
}

const captainLaneGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
  gap: 16,
}

const captainLaneCard: CSSProperties = {
  display: 'grid',
  alignContent: 'space-between',
  gap: 14,
  minHeight: 250,
  padding: 18,
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: '0 12px 32px rgba(2,10,24,0.10)',
}

const captainLaneCardAccent: CSSProperties = {
  ...captainLaneCard,
  border: '1px solid rgba(74,222,128,0.2)',
  background: 'var(--shell-chip-bg-strong)',
  boxShadow: '0 16px 38px rgba(74,222,128,0.08)',
}

const captainLaneTopline: CSSProperties = {
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
}

const captainLaneTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1.1,
  letterSpacing: 0,
}

const captainLaneText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.65,
}

const captainLaneActions: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  alignSelf: 'end',
}

const insightGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
  gap: 18,
}

const insightCard: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 18,
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
}

const insightLabel: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 18,
  fontWeight: 800,
}

const insightSub: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.65,
}

const stackList: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const listCard: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'center',
  padding: 14,
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const listTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 800,
  fontSize: 15,
}

const listMeta: CSSProperties = {
  marginTop: 4,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
}

const pillStrong: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 0,
  maxWidth: '100%',
  padding: '8px 12px',
  borderRadius: 999,
  fontWeight: 900,
  fontSize: 13,
  color: 'var(--foreground-strong)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
}

const pillHelper: CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  textAlign: 'center',
  color: 'var(--shell-copy-muted)',
  fontWeight: 700,
}

const pairMetricWrap: CSSProperties = {
  display: 'grid',
  justifyItems: 'end',
}

const emptyLine: CSSProperties = {
  display: 'grid',
  gap: 9,
  padding: 16,
  borderRadius: 16,
  color: 'var(--shell-copy-muted)',
  border: '1px dashed rgba(116,190,255,0.18)',
  background: 'var(--shell-chip-bg)',
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
}

const inlineEmptyLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 34,
  padding: '0 11px',
  borderRadius: 999,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 900,
  maxWidth: '100%',
  whiteSpace: 'normal',
  textAlign: 'center',
}

const inlineEmptyButtonStyle: CSSProperties = {
  ...inlineEmptyLinkStyle,
  cursor: 'pointer',
}

const summaryGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
  gap: 14,
}

const miniStatCard: CSSProperties = {
  padding: 16,
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const miniStatLabel: CSSProperties = {
  fontSize: 12,
  color: 'var(--shell-copy-muted)',
  textTransform: 'uppercase',
  letterSpacing: 0,
  fontWeight: 800,
}

const miniStatValue: CSSProperties = {
  marginTop: 8,
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: 22,
  letterSpacing: 0,
}

const rosterTableWrap: CSSProperties = {
  display: 'grid',
}

const rosterList: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const rosterRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 14,
  alignItems: 'center',
  flexWrap: 'wrap',
  padding: 14,
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const rosterName: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontWeight: 800,
  fontSize: 15,
}

const rosterMeta: CSSProperties = {
  marginTop: 4,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
}

const rosterRatingRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
}

const subtlePill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 10px',
  borderRadius: 999,
  border: '1px solid var(--shell-panel-border)',
  color: 'var(--foreground)',
  background: 'var(--shell-chip-bg)',
  fontWeight: 700,
  fontSize: 12,
}

const captainStatusPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '5px 10px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.03em',
  whiteSpace: 'normal' as const,
}

function getCaptainRatingStatus(base: number, dynamic: number): RatingStatus {
  const diff = dynamic - base
  if (diff >= 0.15) return 'Bump Up Pace'
  if (diff >= 0.07) return 'Trending Up'
  if (diff > -0.07) return 'Holding'
  if (diff > -0.15) return 'At Risk'
  return 'Drop Watch'
}

function getCaptainStatusStyle(status: RatingStatus): CSSProperties {
  switch (status) {
    case 'Bump Up Pace': return { background: 'color-mix(in srgb, var(--brand-green) 14%, var(--shell-chip-bg) 86%)', color: 'var(--brand-lime)', border: '1px solid color-mix(in srgb, var(--brand-green) 26%, var(--shell-panel-border) 74%)' }
    case 'Trending Up':  return { background: 'color-mix(in srgb, #34d399 12%, var(--shell-chip-bg) 88%)', color: '#a7f3d0', border: '1px solid color-mix(in srgb, #34d399 24%, var(--shell-panel-border) 76%)' }
    case 'Holding':      return { background: 'color-mix(in srgb, var(--brand-blue-2) 11%, var(--shell-chip-bg) 89%)', color: 'var(--foreground-strong)', border: '1px solid color-mix(in srgb, var(--brand-blue-2) 22%, var(--shell-panel-border) 78%)' }
    case 'At Risk':      return { background: 'color-mix(in srgb, #fb923c 12%, var(--shell-chip-bg) 88%)', color: '#fed7aa', border: '1px solid color-mix(in srgb, #fb923c 24%, var(--shell-panel-border) 76%)' }
    case 'Drop Watch':   return { background: 'color-mix(in srgb, #ef4444 12%, var(--shell-chip-bg) 88%)', color: '#fecaca', border: '1px solid color-mix(in srgb, #ef4444 24%, var(--shell-panel-border) 76%)' }
  }
}

const rosterSignalBar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 14px',
  borderRadius: 14,
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  marginBottom: 12,
  flexWrap: 'wrap' as const,
}

const rosterSignalLabel: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.07em',
  flexShrink: 0,
}

const rosterSignalPills: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap' as const,
}

const signalPillBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
}

const signalPillGreen: CSSProperties = { ...signalPillBase, background: 'color-mix(in srgb, var(--brand-green) 12%, var(--shell-chip-bg) 88%)', color: 'var(--brand-lime)', border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)' }
const signalPillNeutral: CSSProperties = { ...signalPillBase, background: 'color-mix(in srgb, var(--brand-blue-2) 10%, var(--shell-chip-bg) 90%)', color: 'var(--foreground-strong)', border: '1px solid color-mix(in srgb, var(--brand-blue-2) 20%, var(--shell-panel-border) 80%)' }
const signalPillRed: CSSProperties = { ...signalPillBase, background: 'color-mix(in srgb, #ef4444 12%, var(--shell-chip-bg) 88%)', color: '#fca5a5', border: '1px solid color-mix(in srgb, #ef4444 22%, var(--shell-panel-border) 78%)' }
