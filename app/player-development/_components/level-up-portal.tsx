'use client'

import { useEffect, useMemo, useRef, useState, type MouseEvent, type RefObject } from 'react'
import { useSearchParams } from 'next/navigation'
import { LEVEL_UP_CARDS } from '@/lib/level-up/level-up-cards'
import { LEVEL_UP_MODULES } from '@/lib/level-up/level-up-modules'
import { getLevelUpProfileForIdentity, recommendLevelUpCards } from '@/lib/level-up/recommendations'
import type { LevelUpAssignment, LevelUpCard, LevelUpCompletion, LevelUpModule, LevelUpRecommendation } from '@/lib/level-up/level-up-types'
import { getCoachAssignmentSummary, type CoachAssignment, type CoachStudentLink } from '@/lib/coach-storage'
import { MEMBERSHIP_TIERS } from '@/lib/product-story'
import { supabase } from '@/lib/supabase'
import styles from './player-development.module.css'

type LevelUpPortalProps = {
  identitySlug: string
  identityTitle: string
}

type FilterState = {
  category: string
  pack: string
  setting: string
  equipment: string
  duration: string
  intensity: string
  level: string
  tag: string
}

type IntentPreset = {
  label: string
  filters: FilterState
  copy: string
}

type ReadinessPreset = IntentPreset & {
  state: 'ready' | 'tight' | 'tired' | 'rushed'
  command: string
  playerCue: string
}

type CompletionSummary = {
  count: number
  lastRating?: number
  previousRating?: number
  lastNote?: string
  lastDurationMinutes?: number
  lastCompletedAt?: string
  lastAssignmentId?: string
}

type NextBestRep = {
  card: LevelUpCard
  label: string
  decision: string
  title: string
  detail: string
  proof: string
  signal: string
  firstRep: string
}

const PLAYER_TIER_NAME = MEMBERSHIP_TIERS.player_plus.name

type CoachRecommendedNext = {
  title: string
  detail: string
  recipe: Array<{ label: string; value: string }>
  actionLabel: string
  action: 'send' | 'repeat' | 'pick-next'
}

type TrainingPulse = {
  proofCount: number
  averageProofLabel: string
  strongestArea: string
  attentionArea: string
  coachRead: string
}

type LaneProgressItem = {
  laneKey: string
  label: string
  proofCount: number
  completedCardCount: number
  totalCardCount: number
  lastRating?: number
  nextCard?: LevelUpCard
  read: string
}

type WeeklyBalanceItem = {
  laneKey: string
  label: string
  proofCount: number
  share: number
  read: string
  nextCard?: LevelUpCard
}

type WeeklyBalance = {
  totalProofs: number
  headline: string
  read: string
  overIndex: WeeklyBalanceItem
  underIndex: WeeklyBalanceItem
  items: WeeklyBalanceItem[]
}

type HabitMomentum = {
  headline: string
  read: string
  weeklyProofCount: number
  streakDays: number
  strongestLane: string
  nextCard?: LevelUpCard
  nextLabel: string
}

type CoachUpdateDigest = {
  status: string
  proofLine: string
  coachAsk: string
  firstRep: string
  shareText: string
}

type TodayPlanItem = {
  label: string
  card: LevelUpCard
  proof: string
}

type CloseLoopItem = {
  label: string
  card: LevelUpCard
  cue: string
  action: string
}

type NetConfidenceLadderItem = {
  label: string
  card: LevelUpCard
  standard: string
}

type NetConfidenceFixItem = {
  problem: string
  card: LevelUpCard
  fix: string
}

type NetConfidenceReadinessItem = {
  label: string
  standard: string
  watch: string
}

type NetConfidenceTargetItem = {
  target: string
  useWhen: string
  playerJob: string
  proof: string
}

type NetConfidenceLiveBridgeItem = {
  stage: string
  setup: string
  score: string
  moveOn: string
}

type NetConfidenceFeedMenuItem = {
  feed: string
  feederJob: string
  playerJob: string
  proof: string
}

type NetConfidenceSoloRep = {
  rep: string
  setup: string
  playerJob: string
  proof: string
}

type NetConfidencePressureGame = {
  game: string
  setup: string
  winCondition: string
  proof: string
}

type NetConfidenceMissDecoderItem = {
  miss: string
  read: string
  fix: string
  card: LevelUpCard
}

type NetConfidenceToolkitTab = 'start' | 'feed' | 'solo' | 'compete' | 'fix'

type NetConfidenceTabGuide = {
  tab: NetConfidenceToolkitTab
  eyebrow: string
  title: string
  setup: string
  useWhen: string
  doThis: string
  block: string
  score: string
  moveOn: string
  say: string
  resetIf: string
  proofAnchors: {
    low: string
    mid: string
    high: string
  }
  startCardId: string
}

type SessionFocus = 'serve' | 'return' | 'movement' | 'pressure' | 'fitness' | 'match'

type SessionBuilderItem = {
  label: string
  card: LevelUpCard
  why: string
  cue: string
}

type FocusTrainingGroup = {
  label: string
  card?: LevelUpCard
  cue: string
}

type FocusTrainingStationTab = {
  key: string
  label: string
  detail: string
  title: string
  setup: string
  block: string
  score: string
  say: string
  resetIf: string
  startCardId: string
  proofAnchors: {
    low: string
    mid: string
    high: string
  }
}

type FocusTrainingStation = {
  label: string
  tabs: FocusTrainingStationTab[]
}

type FocusTrainingLane = {
  key: string
  ariaLabel: string
  eyebrow: string
  title: string
  copy: string
  module?: LevelUpModule
  cards: LevelUpCard[]
  groups: FocusTrainingGroup[]
  station?: FocusTrainingStation
  coachingCue: string
  defaultOpen?: boolean
}

type LaneChooserItem = {
  laneKey: string
  label: string
  need: string
  action: string
  cue: string
}

type StartRequest = {
  cardId: string
  signal: number
}

type CompletionLogger = (cardId: string, rating: number, note: string, elapsedSeconds?: number) => void
type ActiveDrillVariant = 'base' | 'scale-down' | 'repeat-clean' | 'add-pressure'

type CoachChallengeState = {
  status: 'idle' | 'loading' | 'linked' | 'preview' | 'error'
  message: string
}

type LevelUpCoachChallenge = {
  assignment: LevelUpAssignment
  source: CoachAssignment | null
  card: LevelUpCard
  module: LevelUpModule
  summary: ReturnType<typeof getCoachAssignmentSummary> | null
  link?: CoachStudentLink
}

type CoachAssignmentBuilderPayload = {
  card: LevelUpCard
  module: LevelUpModule
  dueDate: string
  coachNote: string
  proofRequired: string
}

type CoachAssignmentTemplate = {
  id: string
  title: string
  cardId: string
  coachNote: string
  proofRequired?: string
}

type CompletionSyncState = {
  status: 'idle' | 'loading' | 'syncing' | 'synced' | 'local' | 'error'
  message: string
}

type RemoteLevelUpSession = {
  id: string
  playerUserId: string
  coachUserId: string | null
  studentLinkId: string | null
  assignmentId: string | null
  identitySlug: string
  focusId: string
  focusTitle: string
  workType: 'court' | 'physical' | 'mental'
  context: 'alone' | 'partner' | 'singles' | 'doubles' | 'coach'
  drillTitle: string
  rating: number
  feeling: 'ready' | 'tight' | 'tired' | 'nervous'
  accessMode: 'coach_invited' | 'player_plus' | 'free_preview'
  note: string
  elapsedSeconds: number
  sharedWithCoach: boolean
  completedAt: string
  createdAt: string
  updatedAt: string
}

const emptyFilters: FilterState = {
  category: 'all',
  pack: 'all',
  setting: 'all',
  equipment: 'all',
  duration: 'all',
  intensity: 'all',
  level: 'all',
  tag: 'all',
}

const LEVEL_UP_COACH_SENT_STORAGE_KEY = 'tiq-level-up-coach-sent'
const LEVEL_UP_COACH_SENT_AT_STORAGE_KEY = 'tiq-level-up-coach-sent-at'
const LEVEL_UP_LOCAL_COACH_ASSIGNMENTS_KEY = 'tiq-level-up-local-coach-assignments'
const STORED_STATE_HYDRATION_DELAY_MS = 2000

const coachAssignmentTemplates: CoachAssignmentTemplate[] = [
  {
    id: 'serve-routine-reset',
    title: 'Serve routine reset',
    cardId: 'serve-target-call',
    coachNote: 'Run one serve block. Call the target before every toss and keep the same routine after misses.',
    proofRequired: 'Serve target clarity 0-5',
  },
  {
    id: 'return-pressure-block',
    title: 'Return pressure block',
    cardId: 'return-30-30-game',
    coachNote: 'Start at 30-30. Pick the return job before the toss and recover for ball two.',
    proofRequired: 'Return intent at 30-30 0-5',
  },
  {
    id: 'movement-recovery-habit',
    title: 'Movement recovery habit',
    cardId: 'cone-recover-shadow-swing',
    coachNote: 'Train recovery after contact. Finish the swing, recover through the gate, then watch.',
    proofRequired: 'Recovered before watching 0-5',
  },
  {
    id: 'pressure-reset-rep',
    title: 'Pressure reset rep',
    cardId: 'three-step-reset',
    coachNote: 'Use the three-step reset after misses or rushed points. Score whether the next point started clean.',
    proofRequired: 'Reset used before next point 0-5',
  },
  {
    id: 'backhand-stability-rep',
    title: 'Backhand stability rep',
    cardId: 'basket-backhand-crosscourt',
    coachNote: 'Build backhand height, depth, and recovery. Do not flatten the ball to escape discomfort.',
    proofRequired: 'Backhand height, depth, and recovery 0-5',
  },
  {
    id: 'doubles-first-move',
    title: 'Doubles first move',
    cardId: 'serve-location-call',
    coachNote: 'Call serve location and partner first move before the ball is live. Score connection, not point result.',
    proofRequired: 'Serve location and partner readiness 0-5',
  },
]

const sessionDurationOptions = [10, 20, 30, 45]

const sessionFocusOptions = [
  { value: 'serve', label: 'Serve', tags: ['serve-routine', 'serve-target', 'serve-plus-one'], copy: 'Build a serve habit you can take into points.' },
  { value: 'return', label: 'Return', tags: ['return-intent', 'return-recovery'], copy: 'Choose the return job early, make contact on purpose, and recover for ball two.' },
  { value: 'movement', label: 'Movement', tags: ['recovery-after-contact', 'light-feet', 'first-step'], copy: 'Move, recover, and get balanced before the next ball.' },
  { value: 'pressure', label: 'Pressure', tags: ['pressure-reset', 'between-points', 'decision-quality'], copy: 'Practice the reset before the score gets loud.' },
  { value: 'fitness', label: 'Fitness', tags: ['leg-durability', 'conditioning', 'posture-under-fatigue'], copy: 'Connect off-court work to tennis posture and legs.' },
  { value: 'match', label: 'Match prep', tags: ['match-day', 'return-intent', 'crosscourt-build'], copy: 'Warm up the habits you want to trust in play.' },
] satisfies { value: SessionFocus; label: string; tags: string[]; copy: string }[]

const intentPresets = [
  {
    label: '10 min quick win',
    filters: { ...emptyFilters, duration: 'under-10' },
    copy: 'Short, useful, and easy to log.',
  },
  {
    label: 'On court now',
    filters: { ...emptyFilters, setting: 'court' },
    copy: 'Use this when you are already at the court.',
  },
  {
    label: 'At home / no gear',
    filters: { ...emptyFilters, setting: 'home', equipment: 'none' },
    copy: 'No court and no setup required.',
  },
  {
    label: 'Reset pressure',
    filters: { ...emptyFilters, tag: 'pressure-reset' },
    copy: 'Between-point and late-game reset tools.',
  },
  {
    label: 'Move better',
    filters: { ...emptyFilters, tag: 'light-feet' },
    copy: 'Footwork, first-step, and recovery habits.',
  },
] satisfies IntentPreset[]

const readinessPresets = [
  {
    state: 'ready',
    label: 'Ready',
    filters: emptyFilters,
    copy: 'Use the recommended path.',
    command: 'Train the main habit.',
    playerCue: 'Run one card with full focus, then score honestly.',
  },
  {
    state: 'tight',
    label: 'Tight',
    filters: { ...emptyFilters, tag: 'mobility' },
    copy: 'Open the body before speed.',
    command: 'Choose mobility or reset.',
    playerCue: 'Move well first. Add speed only after the body feels organized.',
  },
  {
    state: 'tired',
    label: 'Tired',
    filters: { ...emptyFilters, intensity: 'low' },
    copy: 'Keep quality high and volume low.',
    command: 'Pick a low-intensity rep.',
    playerCue: 'Shorten the block. Stop before posture or balance changes.',
  },
  {
    state: 'rushed',
    label: 'Rushed',
    filters: { ...emptyFilters, duration: 'under-10' },
    copy: 'Get one useful proof fast.',
    command: 'Pick a quick win.',
    playerCue: 'Do one clean card. Do not turn five minutes into browsing.',
  },
] satisfies ReadinessPreset[]

export default function LevelUpPortal({ identitySlug, identityTitle }: LevelUpPortalProps) {
  const profile = getLevelUpProfileForIdentity(identitySlug)
  const searchParams = useSearchParams()
  const requestedStartCardId = searchParams.get('card') || searchParams.get('startCard') || ''
  const requestedStartCard = useMemo(
    () => (requestedStartCardId ? LEVEL_UP_CARDS.find((card) => card.id === requestedStartCardId) : undefined),
    [requestedStartCardId],
  )
  const startListRef = useRef<HTMLElement>(null)
  const directStartHandledRef = useRef('')
  const [filters, setFilters] = useState<FilterState>(emptyFilters)
  const [showAllCards, setShowAllCards] = useState(false)
  const [selectedIntent, setSelectedIntent] = useState(requestedStartCard ? 'Coach link' : 'Recommended')
  const [selectedReadiness, setSelectedReadiness] = useState<ReadinessPreset['state']>('ready')
  const [sessionMinutes, setSessionMinutes] = useState(20)
  const [sessionFocus, setSessionFocus] = useState<SessionFocus>('movement')
  const [activeCardTitle, setActiveCardTitle] = useState<string | null>(requestedStartCard?.title ?? null)
  const [startRequest, setStartRequest] = useState<StartRequest>({ cardId: '', signal: 0 })
  const [activeLaneCardId, setActiveLaneCardId] = useState<string | null>(requestedStartCard?.id ?? null)
  const [favorites, toggleFavorite] = useLevelUpFavorites()
  const [coachChallenges, coachChallengeState] = usePlayerCoachChallenges(identitySlug)
  const [localCoachChallenges, addLocalCoachChallenge] = useLocalCoachAssignments(identitySlug)
  const allCoachChallenges = useMemo(
    () => uniqueCoachChallenges([...localCoachChallenges, ...coachChallenges]),
    [coachChallenges, localCoachChallenges],
  )
  const assignmentByCardId = useMemo(() => buildAssignmentByCardId(allCoachChallenges), [allCoachChallenges])
  const [completions, logCompletion, completionSyncState] = useLevelUpCompletions(identitySlug, assignmentByCardId)
  const completionSummaryByCardId = useMemo(() => buildCompletionSummaryByCardId(completions), [completions])
  const recommendations = useMemo(
    () => recommendLevelUpCards({
      identitySlug,
      activeGoalTags: profile.focusTags,
      availableEquipment: filters.equipment === 'all' ? undefined : [filters.equipment],
      preferredSetting: filters.setting === 'all' ? undefined : filters.setting,
      timeAvailable: filters.duration === 'under-10' ? 10 : undefined,
      favoriteCardIds: favorites,
      limit: 18,
    }),
    [favorites, filters.duration, filters.equipment, filters.setting, identitySlug, profile.focusTags],
  )
  const recommendationByCardId = new Map(recommendations.map((recommendation) => [recommendation.cardId, recommendation]))
  const filteredCards = LEVEL_UP_CARDS.filter((card) => cardMatchesFilters(card, filters))
  const identityCards = recommendations
    .map((recommendation) => LEVEL_UP_CARDS.find((card) => card.id === recommendation.cardId))
    .filter(Boolean)
    .slice(0, 8) as LevelUpCard[]
  const quickWins = filteredCards.filter((card) => card.durationMinutes <= 10).slice(0, 8)
  const performanceCards = filteredCards.filter((card) => ['movement-engine', 'strength-stability', 'conditioning', 'mobility-stretch', 'recovery-reset'].includes(card.category)).slice(0, 8)
  const matchDayCards = filteredCards.filter((card) => card.setting.includes('match-day') || card.tags.includes('match-day')).slice(0, 8)
  const serveCards = buildServeTrainingCards()
  const returnCards = LEVEL_UP_CARDS.filter((card) => card.tags.includes('return-intent') || card.tags.includes('return-recovery')).slice(0, 8)
  const movementCards = buildCardsByIds(['cone-recover-shadow-swing', 'split-step-rhythm', 'wide-ball-neutralizer', 'drop-step-recovery', 'four-cone-tennis-star', 'lateral-decel-stick', 'crossover-recovery-lane', 'jump-rope-rhythm-builder'])
  const forehandCards = buildCardsByIds(['basket-forehand-crosscourt', 'crosscourt-consistency', 'defense-neutral-attack-rally', 'short-ball-close-split', 'cone-close-recover', 'wall-rally-rhythm'])
  const backhandCards = buildCardsByIds(['basket-backhand-crosscourt', 'crosscourt-consistency', 'wall-alternating-fh-bh', 'wall-depth-builder', 'drop-step-recovery', 'wide-ball-neutralizer'])
  const volleyCards = buildCardsByIds(['volley-ready-split', 'volley-punch-target', 'approach-volley-close', 'reaction-volley-wall', 'poach-timing-shadow', 'middle-ball-rule'])
  const singlesCards = buildCardsByIds(['crosscourt-consistency', 'defense-neutral-attack-rally', 'wide-ball-neutralizer', '30-30-pressure-game', 'three-step-reset', 'closing-game-routine'])
  const doublesCards = buildCardsByIds(['serve-location-call', 'doubles-return-first-move', 'partner-first-move-call', 'poach-timing-shadow', 'middle-ball-rule', 'switch-call-drill', 'doubles-30-30-game'])
  const favoriteCards = LEVEL_UP_CARDS.filter((card) => favorites.includes(card.id)).slice(0, 8)
  const completedCards = completions
    .map((completion) => LEVEL_UP_CARDS.find((card) => card.id === completion.cardId))
    .filter(Boolean)
    .slice(0, 8) as LevelUpCard[]
  const featuredModules = LEVEL_UP_MODULES.filter((module) => profile.featuredModuleIds.includes(module.id))
  const serveTrainingModule = LEVEL_UP_MODULES.find((module) => module.id === 'serve-pressure-routine')
  const returnTrainingModule = LEVEL_UP_MODULES.find((module) => module.id === 'return-intent')
  const todayModule = featuredModules[0] ?? LEVEL_UP_MODULES[0]
  const todayCard = identityCards[0] ?? LEVEL_UP_CARDS[0]
  const previewCoachChallengeCard = identityCards[1] ?? todayCard
  const previewCoachChallenge = buildPreviewCoachChallenge(previewCoachChallengeCard, todayModule)
  const activeCoachChallenge = allCoachChallenges.find((challenge) => challenge.assignment.status === 'assigned') ?? allCoachChallenges[0] ?? previewCoachChallenge
  const coachChallengeInbox = allCoachChallenges.length ? allCoachChallenges : [previewCoachChallenge]
  const coachInboxAssignmentByCardId = buildAssignmentByCardId(coachChallengeInbox)
  const coachChallengeCard = activeCoachChallenge.card
  const coachAssignment = activeCoachChallenge.assignment
  const coachAssignmentModule = activeCoachChallenge.module
  const coachAssignedCards = uniqueCards([
    ...allCoachChallenges.filter((challenge) => challenge.assignment.status !== 'completed').map((challenge) => challenge.card),
    ...identityCards.slice(0, 3),
  ]).slice(0, 8)
  const quickStartCard = favoriteCards[0] ?? quickWins[0] ?? todayCard
  const recentCard = completedCards[0]
  const activeFilterCount = countActiveFilters(filters)
  const visibleAllCards = showAllCards ? filteredCards : filteredCards.slice(0, 12)
  const sessionRead = getSessionReadLabel(completionSummaryByCardId)
  const recentProofRead = getRecentProofRead(completions, recentCard)
  const nextBestRep = buildNextBestRep({
    recentCard,
    recentCompletion: completions[0],
    identityCards,
    todayCard,
    completionSummaryByCardId,
  })
  const startCards = buildAdaptiveStartCards({
    activeFilterCount,
    filteredCards,
    identityCards,
    nextBestCard: nextBestRep.card,
  })
  const trainingPulse = buildTrainingPulse({ completions, identityCards })
  const coachUpdateDigest = buildCoachUpdateDigest({
    recentCard,
    recentCompletion: completions[0],
    trainingPulse,
    nextBestRep,
  })
  const todayPlan = buildTodayPlan({ startCards })
  const closeLoopItems = buildCloseLoopItems({
    identityCards,
    matchDayCards,
    nextBestCard: nextBestRep.card,
  })
  const netConfidenceLadder = identitySlug === 'net-confidence-builder-4-0'
    ? buildNetConfidenceLadder()
    : []
  const sessionPlan = buildSessionBuilderPlan({
    minutes: sessionMinutes,
    focus: sessionFocus,
    identityCards,
    filteredCards,
    quickWins,
    nextBestCard: nextBestRep.card,
  })
  const focusTrainingLanes = buildFocusTrainingLanes({
    serveTrainingModule,
    returnTrainingModule,
    serveCards,
    returnCards,
    movementCards,
    forehandCards,
    backhandCards,
    volleyCards,
    singlesCards,
    doublesCards,
    lanePriority: profile.lanePriority,
  })
  const laneProgress = useMemo(
    () => buildLaneProgress(focusTrainingLanes, completions, completionSummaryByCardId),
    [focusTrainingLanes, completions, completionSummaryByCardId],
  )
  const weeklyBalance = useMemo(
    () => buildWeeklyBalance(focusTrainingLanes, completions, completionSummaryByCardId),
    [focusTrainingLanes, completions, completionSummaryByCardId],
  )
  const habitMomentum = buildHabitMomentum(completions, weeklyBalance, laneProgress, nextBestRep.card)
  const activeLaneCard = activeLaneCardId
    ? LEVEL_UP_CARDS.find((card) => card.id === activeLaneCardId)
    : undefined
  const activeLaneCoachAssignment = activeLaneCard
    ? assignmentByCardId.get(activeLaneCard.id) ?? coachInboxAssignmentByCardId.get(activeLaneCard.id) ?? buildDirectStartAssignment(activeLaneCard, requestedStartCardId)
    : undefined

  useEffect(() => {
    if (!requestedStartCardId || directStartHandledRef.current === requestedStartCardId) return

    const requestedCard = LEVEL_UP_CARDS.find((card) => card.id === requestedStartCardId)
    if (!requestedCard) return

    let frameRan = false
    const frame = window.requestAnimationFrame(() => {
      frameRan = true
      directStartHandledRef.current = requestedStartCardId
      setStartRequest((request) => ({ cardId: requestedCard.id, signal: request.signal + 1 }))
      setActiveLaneCardId(requestedCard.id)
      setActiveCardTitle(requestedCard.title)
      setSelectedIntent('Coach link')
      scrollToActiveCard()
    })

    return () => {
      if (!frameRan) window.cancelAnimationFrame(frame)
    }
  }, [requestedStartCardId])

  function handleActivityChange(cardTitle: string | null) {
    setActiveCardTitle(cardTitle)
    if (cardTitle === null) {
      setActiveLaneCardId(null)
    }
  }

  function startCardFromPlan(cardId: string) {
    setStartRequest((request) => ({ cardId, signal: request.signal + 1 }))
    setActiveLaneCardId(cardId)
    const card = LEVEL_UP_CARDS.find((candidate) => candidate.id === cardId)
    if (card) {
      setActiveCardTitle(card.title)
    }
    scrollToActiveCard()
  }

  return (
    <section
      className={styles.levelUpPortalApp}
      aria-labelledby="level-up-portal-title"
      data-session-focus={activeCardTitle ? 'active' : 'idle'}
    >
      {activeCardTitle ? (
        <div className={styles.levelUpActiveSessionBar} aria-live="polite">
          <span>On-court mode</span>
          <strong>{activeCardTitle}</strong>
          <small>Finish the rep, score proof, then choose the next card.</small>
        </div>
      ) : null}
      <LevelUpSyncStatus state={completionSyncState} />
      <LevelUpLocalSyncProof />
      <LevelUpHero identityTitle={identityTitle} recommendationCopy={profile.recommendationCopy} />

      <LevelUpCoachAssignmentBanner
        assignment={coachAssignment}
        card={coachChallengeCard}
        module={coachAssignmentModule}
        identitySlug={identitySlug}
        completionSummary={completionSummaryByCardId.get(coachChallengeCard.id)}
        challengeState={coachChallengeState}
        onStartCard={startCardFromPlan}
      />

      <LevelUpCoachChallengeInbox
        challenges={coachChallengeInbox}
        completionSummaryByCardId={completionSummaryByCardId}
        activeCardTitle={activeCardTitle}
        cardOptions={uniqueCards([...identityCards, ...allCoachChallenges.map((challenge) => challenge.card), ...getCoachTemplateCards(), ...LEVEL_UP_CARDS]).slice(0, 42)}
        moduleOptions={uniqueModules([...featuredModules, ...allCoachChallenges.map((challenge) => challenge.module), ...LEVEL_UP_MODULES]).slice(0, 24)}
        onCreateAssignment={addLocalCoachChallenge}
        onStartCard={startCardFromPlan}
      />

      <LevelUpTodayDashboard
        coachChallengeCard={coachChallengeCard}
        todayModule={todayModule}
        todayCard={todayCard}
        quickStartCard={quickStartCard}
        recentCard={recentCard}
        recentProofRead={recentProofRead}
        favoriteCount={favorites.length}
        completionCount={completions.length}
        onStartCard={startCardFromPlan}
      />

      <LevelUpHabitMomentumPanel momentum={habitMomentum} onStartCard={startCardFromPlan} />

      <LevelUpSessionBuilder
        minutes={sessionMinutes}
        focus={sessionFocus}
        items={sessionPlan}
        activeCardTitle={activeCardTitle}
        onMinutesChange={setSessionMinutes}
        onFocusChange={setSessionFocus}
        onStartCard={startCardFromPlan}
      />

      {netConfidenceLadder.length ? (
        <LevelUpNetConfidenceLadder items={netConfidenceLadder} onStartCard={startCardFromPlan} />
      ) : null}

      <LevelUpLaneChooser lanes={focusTrainingLanes} />

      <LevelUpLaneProgressPanel laneProgress={laneProgress} onStartCard={startCardFromPlan} />

      {focusTrainingLanes.map((lane) => (
        <LevelUpFocusTrainingLane
          key={lane.key}
          laneKey={lane.key}
          ariaLabel={lane.ariaLabel}
          eyebrow={lane.eyebrow}
          title={lane.title}
          copy={lane.copy}
          module={lane.module}
          groups={lane.groups}
          station={lane.station}
          completionSummaryByCardId={completionSummaryByCardId}
          onStartCard={startCardFromPlan}
          coachingCue={lane.coachingCue}
        />
      ))}

      {activeLaneCard ? (
        <section id="level-up-active-card" className={styles.levelUpLaneActiveCard} aria-label="Active quick-start card">
          <LevelUpCardTile
            key={`${activeLaneCard.id}-${startRequest.signal}`}
            card={activeLaneCard}
            reason={recommendationByCardId.get(activeLaneCard.id)?.reason}
            favorite={favorites.includes(activeLaneCard.id)}
            completionSummary={completionSummaryByCardId.get(activeLaneCard.id)}
            coachAssignment={activeLaneCoachAssignment}
            onFavorite={toggleFavorite}
            onComplete={logCompletion}
            onActivityChange={handleActivityChange}
            nextCardCandidate={nextBestRep.card}
            onStartNextCard={startCardFromPlan}
            startHref={buildCardStartHref(identitySlug, activeLaneCard)}
            initialActivityOpen
          />
        </section>
      ) : null}

      <LevelUpTodayPlan items={todayPlan} activeCardTitle={activeCardTitle} onStartCard={startCardFromPlan} />

      <LevelUpCloseLoopPanel items={closeLoopItems} recentCard={recentCard} recentProofRead={recentProofRead} onStartCard={startCardFromPlan} />

      <LevelUpNextBestRepPanel nextBestRep={nextBestRep} onStartCard={startCardFromPlan} />

      <LevelUpTrainingPulsePanel pulse={trainingPulse} />

      <LevelUpWeeklyBalancePanel balance={weeklyBalance} onStartCard={startCardFromPlan} />

      <LevelUpCoachUpdatePanel digest={coachUpdateDigest} />

      <section id="today-mission" className={styles.levelUpTodayMission} aria-label="Today's Mission">
        <div>
          <span>Today&apos;s Mission</span>
          <h2>{todayModule.title}</h2>
          <p>{todayModule.description}</p>
          <small>Proof: {todayModule.proof}</small>
        </div>
        <LevelUpCardTile
          card={todayCard}
          reason={recommendationByCardId.get(todayCard.id)?.reason}
          favorite={favorites.includes(todayCard.id)}
          completionSummary={completionSummaryByCardId.get(todayCard.id)}
          onFavorite={toggleFavorite}
          onComplete={logCompletion}
          onActivityChange={setActiveCardTitle}
          nextCardCandidate={nextBestRep.card}
          onStartNextCard={startCardFromPlan}
          startHref={buildCardStartHref(identitySlug, todayCard)}
        />
      </section>

      <LevelUpSafetyNote />

      <LevelUpSessionDock
        intent={selectedIntent}
        activeFilterCount={activeFilterCount}
        visibleStartCount={startCards.length}
        favoriteCount={favorites.length}
        completionCount={completions.length}
        sessionRead={sessionRead}
      />

      <LevelUpReadinessPicker
        activeReadiness={selectedReadiness}
        onApply={(preset) => {
          setSelectedReadiness(preset.state)
          setSelectedIntent(preset.label)
          setFilters(preset.filters)
          setShowAllCards(false)
          scrollToStartList(startListRef)
        }}
      />

      <LevelUpIntentPresets
        activeIntent={selectedIntent}
        onApply={(preset) => {
          setSelectedIntent(preset.label)
          setFilters(preset.filters)
          setShowAllCards(false)
          scrollToStartList(startListRef)
        }}
      />

      <LevelUpStartList
        startListRef={startListRef}
        intent={selectedIntent}
        cards={startCards}
        recommendationByCardId={recommendationByCardId}
        completionSummaryByCardId={completionSummaryByCardId}
        favorites={favorites}
        onFavorite={toggleFavorite}
        onComplete={logCompletion}
        onActivityChange={setActiveCardTitle}
        onStartCard={startCardFromPlan}
        identitySlug={identitySlug}
        nextBestRep={nextBestRep}
      />

      <LevelUpFilters
        filters={filters}
        resultCount={filteredCards.length}
        activeFilterCount={activeFilterCount}
        onChange={(nextFilters) => {
          setSelectedIntent('Custom')
          setFilters(nextFilters)
          setShowAllCards(false)
          scrollToStartList(startListRef)
        }}
        onReset={() => {
          setSelectedIntent('Recommended')
          setFilters(emptyFilters)
          setShowAllCards(false)
          scrollToStartList(startListRef)
        }}
      />

      <LevelUpSmartRail title="Coach Assigned" cards={coachAssignedCards} recommendationByCardId={recommendationByCardId} completionSummaryByCardId={completionSummaryByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} onActivityChange={setActiveCardTitle} onStartNextCard={startCardFromPlan} identitySlug={identitySlug} defaultOpen />
      {focusTrainingLanes.map((lane) => (
        <LevelUpSmartRail key={`${lane.key}-rail`} title={lane.ariaLabel} cards={lane.cards} recommendationByCardId={recommendationByCardId} completionSummaryByCardId={completionSummaryByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} onActivityChange={setActiveCardTitle} onStartNextCard={startCardFromPlan} identitySlug={identitySlug} defaultOpen={lane.defaultOpen} />
      ))}
      <LevelUpSmartRail title="Recommended for Your Player Identity" cards={identityCards} recommendationByCardId={recommendationByCardId} completionSummaryByCardId={completionSummaryByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} onActivityChange={setActiveCardTitle} onStartNextCard={startCardFromPlan} identitySlug={identitySlug} />
      <LevelUpSmartRail title="Quick Wins Under 10 Minutes" cards={quickWins} recommendationByCardId={recommendationByCardId} completionSummaryByCardId={completionSummaryByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} onActivityChange={setActiveCardTitle} onStartNextCard={startCardFromPlan} identitySlug={identitySlug} />
      <LevelUpSmartRail title="Performance Upgrade" cards={performanceCards} recommendationByCardId={recommendationByCardId} completionSummaryByCardId={completionSummaryByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} onActivityChange={setActiveCardTitle} onStartNextCard={startCardFromPlan} identitySlug={identitySlug} />
      <LevelUpSmartRail title="Match-Day Tools" cards={matchDayCards} recommendationByCardId={recommendationByCardId} completionSummaryByCardId={completionSummaryByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} onActivityChange={setActiveCardTitle} onStartNextCard={startCardFromPlan} identitySlug={identitySlug} />
      <LevelUpSmartRail title="Favorites" cards={favoriteCards} recommendationByCardId={recommendationByCardId} completionSummaryByCardId={completionSummaryByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} onActivityChange={setActiveCardTitle} onStartNextCard={startCardFromPlan} emptyText="Tap Favorite on a card to pin it here." identitySlug={identitySlug} defaultOpen={favoriteCards.length > 0} />
      <LevelUpSmartRail id="recently-completed" title="Recently Completed" cards={completedCards} recommendationByCardId={recommendationByCardId} completionSummaryByCardId={completionSummaryByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} onActivityChange={setActiveCardTitle} onStartNextCard={startCardFromPlan} emptyText="Log a proof score to build this rail." identitySlug={identitySlug} />

      <section className={styles.levelUpModuleGrid} aria-label="Level Up modules">
        <div className={styles.levelUpRailHeader}>
          <span>Modules</span>
          <h2>Curated blocks coaches can assign.</h2>
        </div>
        <div className={styles.levelUpRailGrid}>
          {featuredModules.map((module) => (
            <LevelUpModuleTile
              key={module.id}
              module={module}
              identitySlug={identitySlug}
              completionSummaryByCardId={completionSummaryByCardId}
              onStartCard={startCardFromPlan}
            />
          ))}
        </div>
      </section>

      <section id="all-cards" className={styles.levelUpCardGrid} aria-label="All cards">
        <div className={styles.levelUpRailHeader}>
          <span>All Cards</span>
          <h2>{filteredCards.length} tools match your filters.</h2>
          <p>Showing {visibleAllCards.length}. Start with the top matches, then expand only if you need the full library.</p>
        </div>
        <div className={styles.levelUpRailGrid}>
          {visibleAllCards.map((card) => (
            <LevelUpCardTile
              key={card.id}
              card={card}
              reason={recommendationByCardId.get(card.id)?.reason}
              favorite={favorites.includes(card.id)}
              completionSummary={completionSummaryByCardId.get(card.id)}
              onFavorite={toggleFavorite}
              onComplete={logCompletion}
              onActivityChange={setActiveCardTitle}
              nextCardCandidate={getNextCardInList(visibleAllCards, card)}
              onStartNextCard={startCardFromPlan}
              startHref={buildCardStartHref(identitySlug, card)}
            />
          ))}
        </div>
        {filteredCards.length > visibleAllCards.length ? (
          <button type="button" className={styles.levelUpShowMoreButton} onClick={() => setShowAllCards(true)}>
            Show all {filteredCards.length} cards
          </button>
        ) : showAllCards && filteredCards.length > 12 ? (
          <button type="button" className={styles.levelUpShowMoreButton} onClick={() => setShowAllCards(false)}>
            Show fewer cards
          </button>
        ) : null}
      </section>
    </section>
  )
}

function LevelUpIntentPresets({ activeIntent, onApply }: { activeIntent: string; onApply: (preset: IntentPreset) => void }) {
  return (
    <section className={styles.levelUpIntentPresets} aria-label="Quick Level Up intents">
      <div>
        <span>Choose fast</span>
        <strong>What can you do right now?</strong>
      </div>
      <div>
        {intentPresets.map((preset) => (
          <button key={preset.label} type="button" data-active={activeIntent === preset.label ? 'true' : 'false'} onClick={() => onApply(preset)}>
            <strong>{preset.label}</strong>
            <span>{preset.copy}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function LevelUpTodayDashboard({
  coachChallengeCard,
  todayModule,
  todayCard,
  quickStartCard,
  recentCard,
  recentProofRead,
  favoriteCount,
  completionCount,
  onStartCard,
}: {
  coachChallengeCard: LevelUpCard
  todayModule: LevelUpModule
  todayCard: LevelUpCard
  quickStartCard: LevelUpCard
  recentCard?: LevelUpCard
  recentProofRead: string
  favoriteCount: number
  completionCount: number
  onStartCard: (cardId: string) => void
}) {
  return (
    <section className={styles.levelUpTodayDashboard} aria-label="Today dashboard">
      <div className={styles.levelUpTodayDashboardHeader}>
        <span>Today</span>
        <h2>Open, choose, start.</h2>
        <p>One coach challenge, one recommended mission, one fast start, and one proof read.</p>
      </div>
      <div className={styles.levelUpTodayDashboardGrid}>
        <button type="button" onClick={() => onStartCard(coachChallengeCard.id)}>
          <span>Coach challenge</span>
          <strong>{coachChallengeCard.title}</strong>
          <small>{coachChallengeCard.proof}</small>
        </button>
        <a href="#today-mission">
          <span>Recommended</span>
          <strong>{todayModule.title}</strong>
          <small>Start with {todayCard.title}.</small>
        </a>
        <button type="button" onClick={() => onStartCard(quickStartCard.id)}>
          <span>{favoriteCount ? 'Favorite start' : 'Quick start'}</span>
          <strong>{quickStartCard.title}</strong>
          <small>{quickStartCard.durationMinutes} min - {quickStartCard.setting.join(', ')}</small>
        </button>
        <a href={completionCount ? '#recently-completed' : '#level-up-start-here'}>
          <span>Proof trend</span>
          <strong>{recentProofRead}</strong>
          <small>{recentCard ? `Last card: ${recentCard.title}` : 'Log one score to create your trend.'}</small>
        </a>
      </div>
    </section>
  )
}

function LevelUpNextBestRepPanel({ nextBestRep, onStartCard }: { nextBestRep: NextBestRep; onStartCard: (cardId: string) => void }) {
  return (
    <section className={styles.levelUpNextBestRep} aria-label="Next best rep">
      <div>
        <span>Next best rep</span>
        <i>{formatAdaptiveDecisionBadge(nextBestRep.decision)}</i>
        <h2>{nextBestRep.title}</h2>
        <p>{nextBestRep.detail}</p>
        <small>{nextBestRep.signal}</small>
      </div>
      <div className={styles.levelUpNextBestRepCard}>
        <span>Suggested card</span>
        <strong>{nextBestRep.card.title}</strong>
        <small>First rep: {nextBestRep.firstRep}</small>
        <small>Proof target: {nextBestRep.proof}</small>
      </div>
      <button type="button" className="button-primary" onClick={() => onStartCard(nextBestRep.card.id)}>Start card</button>
    </section>
  )
}

function LevelUpHabitMomentumPanel({
  momentum,
  onStartCard,
}: {
  momentum: HabitMomentum
  onStartCard: (cardId: string) => void
}) {
  return (
    <section className={styles.levelUpHabitMomentum} aria-label="Habit momentum">
      <div>
        <span>Habit momentum</span>
        <h2>{momentum.headline}</h2>
        <p>{momentum.read}</p>
      </div>
      <div className={styles.levelUpHabitMomentumGrid}>
        <article>
          <span>This week</span>
          <strong>{formatProofCount(momentum.weeklyProofCount)}</strong>
          <small>Proofs logged</small>
        </article>
        <article>
          <span>Streak</span>
          <strong>{momentum.streakDays ? `${momentum.streakDays} days` : 'Start today'}</strong>
          <small>Consecutive proof days</small>
        </article>
        <article>
          <span>Signal</span>
          <strong>{momentum.strongestLane}</strong>
          <small>Most active lane</small>
        </article>
      </div>
      {momentum.nextCard ? (
        <button type="button" onClick={() => momentum.nextCard ? onStartCard(momentum.nextCard.id) : undefined}>
          {momentum.nextLabel}: {momentum.nextCard.title}
        </button>
      ) : null}
    </section>
  )
}

function LevelUpSessionBuilder({
  minutes,
  focus,
  items,
  activeCardTitle,
  onMinutesChange,
  onFocusChange,
  onStartCard,
}: {
  minutes: number
  focus: SessionFocus
  items: SessionBuilderItem[]
  activeCardTitle: string | null
  onMinutesChange: (minutes: number) => void
  onFocusChange: (focus: SessionFocus) => void
  onStartCard: (cardId: string) => void
}) {
  const focusOption = sessionFocusOptions.find((option) => option.value === focus) ?? sessionFocusOptions[0]
  const totalMinutes = items.reduce((sum, item) => sum + item.card.durationMinutes, 0)

  return (
    <section className={styles.levelUpSessionBuilder} aria-label="Build today's session">
      <div className={styles.levelUpRailHeader}>
        <span>Build Today&apos;s Session</span>
        <h2>{activeCardTitle ? 'Stay in the rep you started.' : `${minutes} minutes for ${focusOption.label.toLowerCase()}.`}</h2>
        <p>{activeCardTitle ? 'When a card is open, keep the screen focused. Score proof, then rebuild the next block.' : focusOption.copy}</p>
      </div>
      <div className={styles.levelUpSessionBuilderControls}>
        <div aria-label="Session length">
          <span>Time</span>
          {sessionDurationOptions.map((option) => (
            <button key={option} type="button" data-active={minutes === option ? 'true' : 'false'} onClick={() => onMinutesChange(option)}>
              {option} min
            </button>
          ))}
        </div>
        <div aria-label="Session focus">
          <span>Focus</span>
          {sessionFocusOptions.map((option) => (
            <button key={option.value} type="button" data-active={focus === option.value ? 'true' : 'false'} onClick={() => onFocusChange(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.levelUpSessionBuilderSummary}>
        <strong>{items.length} cards</strong>
        <span>{totalMinutes} planned minutes</span>
        <small>Start with the first card. Add the next only if the proof quality stays clean.</small>
      </div>
      <div className={styles.levelUpSessionBuilderGrid}>
        {items.map((item, index) => (
          <button
            key={`${item.label}-${item.card.id}`}
            type="button"
            className={item.card.title === activeCardTitle ? styles.levelUpTodayPlanActive : undefined}
            onClick={() => onStartCard(item.card.id)}
          >
            <span>{index + 1}</span>
            <div>
              <b>{item.label}</b>
              <strong>{item.card.title}</strong>
              <small>{item.why}</small>
              <small>Cue: {item.cue}</small>
              <small>Proof: {item.card.proof}</small>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

function LevelUpTodayPlan({ items, activeCardTitle, onStartCard }: { items: TodayPlanItem[]; activeCardTitle: string | null; onStartCard: (cardId: string) => void }) {
  return (
    <section className={styles.levelUpTodayPlan} aria-label="Today's plan">
      <div className={styles.levelUpRailHeader}>
        <span>Today&apos;s Plan</span>
        <h2>{activeCardTitle ? 'Stay with the active card.' : 'One session, three useful reps.'}</h2>
        <p>{activeCardTitle ? 'The library can wait. Finish the rep, score proof, then pick what comes next.' : 'Start with one assigned or recommended card, then add one quick rep and one match-ready habit if you have time.'}</p>
      </div>
      <div className={styles.levelUpTodayPlanGrid}>
        {items.map((item, index) => (
          <button
            type="button"
            key={`${item.label}-${item.card.id}`}
            onClick={() => onStartCard(item.card.id)}
            className={item.card.title === activeCardTitle ? styles.levelUpTodayPlanActive : undefined}
          >
            <span>{index + 1}</span>
            <div>
              <b>{item.label}</b>
              <strong>{item.card.title}</strong>
              <small>{item.proof}</small>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}

function LevelUpCloseLoopPanel({
  items,
  recentCard,
  recentProofRead,
  onStartCard,
}: {
  items: CloseLoopItem[]
  recentCard?: LevelUpCard
  recentProofRead: string
  onStartCard: (cardId: string) => void
}) {
  return (
    <section id="close-the-loop" className={styles.levelUpCloseLoop} aria-label="Close the loop">
      <div className={styles.levelUpRailHeader}>
        <span>Close the loop</span>
        <h2>Prep, prove, pick next.</h2>
        <p>Use this when practice or a match is done. Save one number, one tiny note, and one next card.</p>
      </div>
      <div className={styles.levelUpCloseLoopGrid}>
        {items.map((item) => (
          <button key={`${item.label}-${item.card.id}`} type="button" onClick={() => onStartCard(item.card.id)}>
            <span>{item.label}</span>
            <strong>{item.card.title}</strong>
            <small>{item.cue}</small>
            <b>{item.action}</b>
          </button>
        ))}
      </div>
      <div className={styles.levelUpCloseLoopReadout}>
        <span>Current read</span>
        <strong>{recentProofRead}</strong>
        <small>{recentCard ? `Last proof came from ${recentCard.title}.` : 'No proof yet. Start any card and save a 0-5 score.'}</small>
      </div>
    </section>
  )
}

function LevelUpNetConfidenceLadder({
  items,
  onStartCard,
}: {
  items: NetConfidenceLadderItem[]
  onStartCard: (cardId: string) => void
}) {
  const [activeTab, setActiveTab] = useState<NetConfidenceToolkitTab>('start')
  const fixes = buildNetConfidenceFixes(items)
  const readinessChecks = buildNetConfidenceReadinessChecks()
  const targetMap = buildNetConfidenceTargetMap()
  const liveBridge = buildNetConfidenceLiveBridge()
  const feedMenu = buildNetConfidenceFeedMenu()
  const soloReps = buildNetConfidenceSoloReps()
  const pressureGames = buildNetConfidencePressureGames()
  const missDecoder = buildNetConfidenceMissDecoder(items)
  const tabGuides = buildNetConfidenceTabGuides(items)
  const activeGuide = tabGuides.find((guide) => guide.tab === activeTab)
  const activeGuideCard = activeGuide
    ? items.find((item) => item.card.id === activeGuide.startCardId)?.card
    : undefined
  const toolkitTabs: Array<{ key: NetConfidenceToolkitTab; label: string; detail: string }> = [
    { key: 'start', label: 'Start', detail: 'Ladder + readiness' },
    { key: 'feed', label: 'Feed', detail: 'Partner setup' },
    { key: 'solo', label: 'Solo', detail: 'No-partner reps' },
    { key: 'compete', label: 'Compete', detail: 'Pressure games' },
    { key: 'fix', label: 'Fix a Miss', detail: 'Tap the miss' },
  ]

  return (
    <section className={styles.levelUpNetLadder} aria-label="Net confidence ladder">
      <div className={styles.levelUpRailHeader}>
        <span>Net confidence ladder</span>
        <h2>Close, split, punch, finish.</h2>
        <p>Use this when the player gets forward but still feels rushed. Train one step at a time before playing live points.</p>
      </div>
      <div className={styles.levelUpNetToolkitNav} aria-label="Net toolkit">
        {toolkitTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={activeTab === tab.key}
            data-active={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            <span>{tab.label}</span>
            <small>{tab.detail}</small>
          </button>
        ))}
      </div>
      <div className={styles.levelUpNetToolkitPanel} data-active-tab={activeTab}>
        {activeGuide ? (
          <div className={styles.levelUpNetTabGuide} aria-label="Net tab guide">
            <div className={styles.levelUpNetTabGuideHeader}>
              <div>
                <span>{activeGuide.eyebrow}</span>
                <strong>{activeGuide.title}</strong>
              </div>
              <button type="button" onClick={() => onStartCard(activeGuide.startCardId)}>
                Start: {activeGuideCard?.title ?? 'recommended rep'}
              </button>
            </div>
            <div className={styles.levelUpNetTabGuideDetails}>
              <p><b>Setup:</b> {activeGuide.setup}</p>
              <p><b>Use when:</b> {activeGuide.useWhen}</p>
              <p><b>Do:</b> {activeGuide.doThis}</p>
              <p><b>Block:</b> {activeGuide.block}</p>
              <p><b>Score:</b> {activeGuide.score}</p>
              <p><b>Move on:</b> {activeGuide.moveOn}</p>
              <p><b>Say:</b> {activeGuide.say}</p>
              <p><b>Reset if:</b> {activeGuide.resetIf}</p>
            </div>
            <div className={styles.levelUpNetProofAnchors} aria-label="Net proof score anchors">
              <span>Proof anchors</span>
              <p><b>1-2</b>{activeGuide.proofAnchors.low}</p>
              <p><b>3</b>{activeGuide.proofAnchors.mid}</p>
              <p><b>4-5</b>{activeGuide.proofAnchors.high}</p>
            </div>
          </div>
        ) : null}
        {activeTab === 'start' ? (
          <>
            <div className={styles.levelUpNetLadderGrid}>
              {items.map((item, index) => (
                <button key={item.card.id} type="button" onClick={() => onStartCard(item.card.id)}>
                  <span>{index + 1}</span>
                  <b>{item.label}</b>
                  <strong>{item.card.title}</strong>
                  <small>{item.standard}</small>
                </button>
              ))}
            </div>
            <div className={styles.levelUpNetReadiness} aria-label="Net readiness check">
              <span>Readiness check</span>
              <strong>Go live when 3 of 4 are clean.</strong>
              {readinessChecks.map((item) => (
                <article key={item.label}>
                  <b>{item.label}</b>
                  <small>{item.standard}</small>
                  <i>{item.watch}</i>
                </article>
              ))}
            </div>
            <div className={styles.levelUpNetTargetMap} aria-label="First-volley target map">
              <span>First-volley target map</span>
              <strong>Do not just volley. Give the first volley a job.</strong>
              {targetMap.map((item) => (
                <article key={item.target}>
                  <b>{item.target}</b>
                  <small>{item.useWhen}</small>
                  <em>{item.playerJob}</em>
                  <i>{item.proof}</i>
                </article>
              ))}
            </div>
          </>
        ) : null}
        {activeTab === 'feed' ? (
          <>
            <div className={styles.levelUpNetLiveBridge} aria-label="Net live point bridge">
              <span>Live point bridge</span>
              <strong>Earn live points in steps.</strong>
              {liveBridge.map((item) => (
                <article key={item.stage}>
                  <b>{item.stage}</b>
                  <small>{item.setup}</small>
                  <em>{item.score}</em>
                  <i>{item.moveOn}</i>
                </article>
              ))}
            </div>
            <div className={styles.levelUpNetFeedMenu} aria-label="Net feed menu">
              <span>Feed menu</span>
              <strong>Tell your partner how to feed the rep.</strong>
              {feedMenu.map((item) => (
                <article key={item.feed}>
                  <b>{item.feed}</b>
                  <small>{item.feederJob}</small>
                  <em>{item.playerJob}</em>
                  <i>{item.proof}</i>
                </article>
              ))}
            </div>
          </>
        ) : null}
        {activeTab === 'solo' ? (
          <div className={styles.levelUpNetSoloReps} aria-label="Net solo reps">
            <span>No-partner reps</span>
            <strong>Train the net habit even when you are alone.</strong>
            {soloReps.map((item) => (
              <article key={item.rep}>
                <b>{item.rep}</b>
                <small>{item.setup}</small>
                <em>{item.playerJob}</em>
                <i>{item.proof}</i>
              </article>
            ))}
          </div>
        ) : null}
        {activeTab === 'compete' ? (
          <div className={styles.levelUpNetPressureGames} aria-label="Net pressure games">
            <span>Pressure games</span>
            <strong>Compete with the habit, not just the score.</strong>
            {pressureGames.map((item) => (
              <article key={item.game}>
                <b>{item.game}</b>
                <small>{item.setup}</small>
                <em>{item.winCondition}</em>
                <i>{item.proof}</i>
              </article>
            ))}
          </div>
        ) : null}
        {activeTab === 'fix' ? (
          <>
            <div className={styles.levelUpNetMissDecoder} aria-label="Net miss decoder">
              <span>Miss decoder</span>
              <strong>Tap the miss. Train the next rep.</strong>
              {missDecoder.map((item) => (
                <button key={item.miss} type="button" onClick={() => onStartCard(item.card.id)}>
                  <b>{item.miss}</b>
                  <small>{item.read}</small>
                  <em>{item.fix}</em>
                  <i>{item.card.title}</i>
                </button>
              ))}
            </div>
            <div className={styles.levelUpNetFixGrid} aria-label="Net confidence quick fixes">
              <span>Quick fix</span>
              {fixes.map((item) => (
                <button key={item.problem} type="button" onClick={() => onStartCard(item.card.id)}>
                  <strong>{item.problem}</strong>
                  <small>{item.fix}</small>
                  <b>{item.card.title}</b>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
      <p className={styles.levelUpNetLadderCue}>
        Net confidence is not a bravery speech. It is arrive balanced, split before the pass, make compact contact, then recover for the next ball.
      </p>
    </section>
  )
}

function LevelUpTrainingPulsePanel({ pulse }: { pulse: TrainingPulse }) {
  return (
    <section className={styles.levelUpTrainingPulse} aria-label="Training pulse">
      <div>
        <span>Training pulse</span>
        <h2>Keep the work aligned.</h2>
        <p>{pulse.coachRead}</p>
      </div>
      <div className={styles.levelUpPulseGrid}>
        <article>
          <span>Proofs</span>
          <strong>{pulse.proofCount}</strong>
          <small>Logged scores</small>
        </article>
        <article>
          <span>Average</span>
          <strong>{pulse.averageProofLabel}</strong>
          <small>Recent proof quality</small>
        </article>
        <article>
          <span>Strongest</span>
          <strong>{pulse.strongestArea}</strong>
          <small>Most proven area</small>
        </article>
        <article>
          <span>Needs reps</span>
          <strong>{pulse.attentionArea}</strong>
          <small>Under-trained next</small>
        </article>
      </div>
    </section>
  )
}

function LevelUpWeeklyBalancePanel({
  balance,
  onStartCard,
}: {
  balance: WeeklyBalance
  onStartCard: (cardId: string) => void
}) {
  return (
    <section className={styles.levelUpWeeklyBalance} aria-label="Weekly training balance">
      <div>
        <span>Weekly balance</span>
        <h2>{balance.headline}</h2>
        <p>{balance.read}</p>
      </div>
      <div className={styles.levelUpWeeklyBalanceGrid}>
        <article data-emphasis="over">
          <span>Most trained</span>
          <strong>{balance.overIndex.label}</strong>
          <small>{formatProofCount(balance.overIndex.proofCount)} this week</small>
        </article>
        <article data-emphasis="under">
          <span>Needs one</span>
          <strong>{balance.underIndex.label}</strong>
          <small>{balance.underIndex.read}</small>
        </article>
        <article data-emphasis="next">
          <span>Balance card</span>
          <strong>{balance.underIndex.nextCard?.title ?? 'Log one proof'}</strong>
          <small>{balance.underIndex.nextCard?.proof ?? 'Pick a card and save a 0-5 score.'}</small>
          {balance.underIndex.nextCard ? (
            <button type="button" onClick={() => balance.underIndex.nextCard ? onStartCard(balance.underIndex.nextCard.id) : undefined}>
              Start balance rep
            </button>
          ) : null}
        </article>
      </div>
      <div className={styles.levelUpWeeklyBalanceStrip} aria-label="Weekly proof distribution">
        {balance.items.map((item) => (
          <span key={item.laneKey}>
            <b>{item.label}</b>
            {item.proofCount}
          </span>
        ))}
      </div>
    </section>
  )
}

function LevelUpCoachUpdatePanel({ digest }: { digest: CoachUpdateDigest }) {
  const [copied, setCopied] = useState(false)

  async function copyUpdate() {
    try {
      await window.navigator.clipboard?.writeText(digest.shareText)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className={styles.levelUpCoachUpdate} aria-label="Coach update">
      <div>
        <span>Coach update</span>
        <h2>{digest.status}</h2>
        <p>{digest.coachAsk}</p>
      </div>
      <div className={styles.levelUpCoachUpdatePreview}>
        <span>Shareable recap</span>
        <strong>{digest.proofLine}</strong>
        <small>First rep: {digest.firstRep}</small>
        <small>{digest.shareText}</small>
      </div>
      <button type="button" onClick={copyUpdate}>{copied ? 'Copied' : 'Copy update'}</button>
    </section>
  )
}

function LevelUpCoachAssignmentBanner({
  assignment,
  card,
  module,
  identitySlug,
  completionSummary,
  challengeState,
  onStartCard,
}: {
  assignment: LevelUpAssignment
  card: LevelUpCard
  module: LevelUpModule
  identitySlug: string
  completionSummary?: CompletionSummary
  challengeState: CoachChallengeState
  onStartCard: (cardId: string) => void
}) {
  const readyToSend = Boolean(completionSummary)
  const statusLabel = readyToSend ? 'Ready to send' : 'Assigned'
  const proofLabel = typeof completionSummary?.lastRating === 'number' ? `${completionSummary.lastRating}/5 proof` : 'Proof needed'
  const primaryActionHref = readyToSend ? '#recently-completed' : buildCardStartHref(identitySlug, card)
  const primaryActionLabel = readyToSend ? 'Review coach update' : 'Start coach challenge'
  return (
    <section className={styles.levelUpCoachAssignmentBanner} aria-label="Coach assignment" data-status={readyToSend ? 'ready' : 'assigned'}>
      <div>
        <span>{challengeState.status === 'linked' ? 'Coach challenge' : challengeState.status === 'loading' ? 'Checking coach work' : 'Coach challenge preview'}</span>
        <h2>{card.title}</h2>
        <p>{assignment.coachNote}</p>
        {challengeState.message ? <small>{challengeState.message}</small> : null}
      </div>
      <div className={styles.levelUpCoachAssignmentMeta}>
        <span>{statusLabel}</span>
        <span>{proofLabel}</span>
        <span>Due {formatAssignmentDueDate(assignment.dueAt)}</span>
        <span>{card.durationMinutes} min</span>
        <span>{module.title}</span>
      </div>
      <div className={styles.levelUpCoachAssignmentProof}>
        <span>Proof required</span>
        <strong>{assignment.proofRequired ?? card.proof}</strong>
        <small>One assigned tool. One proof score. One update back to coach.</small>
      </div>
      {readyToSend ? (
        <a className="button-primary" href={primaryActionHref}>{primaryActionLabel}</a>
      ) : (
        <button type="button" className="button-primary" onClick={() => onStartCard(card.id)}>{primaryActionLabel}</button>
      )}
    </section>
  )
}

type CoachChallengeInboxFilter = 'assigned' | 'ready' | 'completed'

function LevelUpCoachChallengeInbox({
  challenges,
  completionSummaryByCardId,
  activeCardTitle,
  cardOptions,
  moduleOptions,
  onCreateAssignment,
  onStartCard,
}: {
  challenges: LevelUpCoachChallenge[]
  completionSummaryByCardId: Map<string, CompletionSummary>
  activeCardTitle: string | null
  cardOptions: LevelUpCard[]
  moduleOptions: LevelUpModule[]
  onCreateAssignment: (payload: CoachAssignmentBuilderPayload) => void
  onStartCard: (cardId: string) => void
}) {
  const [activeFilter, setActiveFilter] = useState<CoachChallengeInboxFilter>('assigned')
  const [copyStatusByItemId, setCopyStatusByItemId] = useState<Record<string, 'copied' | 'blocked'>>({})
  const [suggestedAssignmentById, setSuggestedAssignmentById] = useState<Record<string, { title: string; cardId: string }>>({})
  const [sentAssignmentIds, setSentAssignmentIds] = useState<string[]>([])
  const [sentAtByAssignmentId, setSentAtByAssignmentId] = useState<Record<string, string>>({})
  const inboxItems = buildCoachChallengeInboxItems(challenges, completionSummaryByCardId, sentAssignmentIds, sentAtByAssignmentId)
  const assignedCount = inboxItems.filter((item) => item.status === 'assigned').length
  const readyCount = inboxItems.filter((item) => item.status === 'ready').length
  const completedCount = inboxItems.filter((item) => item.status === 'completed').length
  const visibleItems = inboxItems.filter((item) => item.status === activeFilter)
  const nextItem = inboxItems.find((item) => item.status === 'assigned') ?? inboxItems.find((item) => item.status === 'ready') ?? inboxItems[0]

  const tabs: Array<{ key: CoachChallengeInboxFilter; label: string; count: number }> = [
    { key: 'assigned', label: 'To do', count: assignedCount },
    { key: 'ready', label: 'Ready', count: readyCount },
    { key: 'completed', label: 'Done', count: completedCount },
  ]

  async function copyInboxCoachUpdate(item: ReturnType<typeof buildCoachChallengeInboxItems>[number]) {
    if (!item.coachUpdateText) return

    try {
      await window.navigator.clipboard?.writeText(item.coachUpdateText)
      setCopyStatusByItemId((current) => ({ ...current, [item.challenge.assignment.id]: 'copied' }))
    } catch {
      setCopyStatusByItemId((current) => ({ ...current, [item.challenge.assignment.id]: 'blocked' }))
    }
  }

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setSentAssignmentIds(readStringList(LEVEL_UP_COACH_SENT_STORAGE_KEY))
      setSentAtByAssignmentId(readStringRecord(LEVEL_UP_COACH_SENT_AT_STORAGE_KEY))
    }, STORED_STATE_HYDRATION_DELAY_MS)

    return () => window.clearTimeout(hydrationTimer)
  }, [])

  function markCoachChallengeSent(item: ReturnType<typeof buildCoachChallengeInboxItems>[number]) {
    const assignmentId = item.challenge.assignment.id
    const sentAt = new Date().toISOString()

    setSentAssignmentIds((current) => {
      const next = current.includes(assignmentId) ? current : [assignmentId, ...current].slice(0, 40)
      window.localStorage.setItem(LEVEL_UP_COACH_SENT_STORAGE_KEY, JSON.stringify(next))
      return next
    })
    setSentAtByAssignmentId((current) => {
      const next = { ...current, [assignmentId]: sentAt }
      window.localStorage.setItem(LEVEL_UP_COACH_SENT_AT_STORAGE_KEY, JSON.stringify(next))
      return next
    })
    setActiveFilter('completed')
  }

  function undoCoachChallengeSent(item: ReturnType<typeof buildCoachChallengeInboxItems>[number]) {
    const assignmentId = item.challenge.assignment.id

    setSentAssignmentIds((current) => {
      const next = current.filter((sentAssignmentId) => sentAssignmentId !== assignmentId)
      window.localStorage.setItem(LEVEL_UP_COACH_SENT_STORAGE_KEY, JSON.stringify(next))
      return next
    })
    setSentAtByAssignmentId((current) => {
      const next = { ...current }
      delete next[assignmentId]
      window.localStorage.setItem(LEVEL_UP_COACH_SENT_AT_STORAGE_KEY, JSON.stringify(next))
      return next
    })
    setActiveFilter('ready')
  }

  function assignSuggestedCoachNext(item: ReturnType<typeof buildCoachChallengeInboxItems>[number]) {
    const assignmentTitle = item.challenge.card.title
    onCreateAssignment(buildCoachFeedbackAssignmentPayload(item.challenge, item.coachFeedback))
    setSuggestedAssignmentById((current) => ({
      ...current,
      [item.challenge.assignment.id]: { title: assignmentTitle, cardId: item.challenge.card.id },
    }))
    setActiveFilter('assigned')
  }

  const latestSuggestedAssignment = Object.values(suggestedAssignmentById).at(-1)

  return (
    <section className={styles.levelUpCoachChallengeInbox} aria-label="Coach challenge inbox">
      <div className={styles.levelUpCoachInboxHeader}>
        <div>
          <span>Coach inbox</span>
          <h2>{nextItem ? 'Start the work your coach picked.' : 'No coach work yet.'}</h2>
          <p>{nextItem ? 'Assigned tools stay here until you save proof. Use this before browsing the full library.' : 'When a coach assigns a card, it will show here first.'}</p>
        </div>
        {nextItem ? (
          <button type="button" className="button-primary" onClick={() => onStartCard(nextItem.challenge.card.id)}>
            {nextItem.status === 'completed' ? 'Review done' : nextItem.status === 'ready' ? 'Review proof' : 'Start next'}
          </button>
        ) : null}
      </div>
      <CoachAssignmentBuilder
        cardOptions={cardOptions}
        moduleOptions={moduleOptions}
        onCreateAssignment={onCreateAssignment}
      />
      {latestSuggestedAssignment ? (
        <div className={styles.levelUpCoachSuggestedAssigned} aria-live="polite">
          <span>Suggested challenge assigned</span>
          <em>Suggested assigned</em>
          <strong>{latestSuggestedAssignment.title}</strong>
          <small>It was added to To do. Start it now, score one proof, then send the next update.</small>
          <button type="button" onClick={() => onStartCard(latestSuggestedAssignment.cardId)}>
            Start suggested challenge
          </button>
        </div>
      ) : null}
      <div className={styles.levelUpCoachInboxTabs} aria-label="Coach inbox status">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={activeFilter === tab.key}
            data-active={activeFilter === tab.key}
            onClick={() => setActiveFilter(tab.key)}
          >
            <span>{tab.label}</span>
            <strong>{tab.count}</strong>
          </button>
        ))}
      </div>
      <div className={styles.levelUpCoachInboxGrid}>
        {visibleItems.length ? visibleItems.map((item) => (
          <article key={item.challenge.assignment.id} data-status={item.status} data-active={item.challenge.card.title === activeCardTitle ? 'true' : 'false'}>
            <div>
              <span>{item.label}</span>
              <strong>{item.challenge.card.title}</strong>
              <small>{item.challenge.assignment.coachNote}</small>
            </div>
            <div className={styles.levelUpCoachInboxMeta}>
              <b>{item.dueLabel}</b>
              <b>{item.proofLabel}</b>
              <b>{item.challenge.module.title}</b>
              {item.sentAtLabel ? <b>{item.sentAtLabel}</b> : null}
            </div>
            <div className={styles.levelUpCoachChallengePlan} aria-label={`Coach challenge plan for ${item.challenge.card.title}`}>
              <span>Challenge</span>
              {item.assignmentPlan.map((planItem) => (
                <small key={planItem.label}>
                  <b>{planItem.label}</b>
                  {planItem.value}
                </small>
              ))}
            </div>
            {item.status === 'ready' && item.coachUpdateText ? (
              <div className={styles.levelUpCoachInboxReady}>
                <div className={styles.levelUpCoachFeedbackLoop} aria-label={`Coach feedback loop for ${item.challenge.card.title}`}>
                  <span>Coach feedback</span>
                  <strong>{item.coachFeedback.title}</strong>
                  <small>{item.coachFeedback.detail}</small>
                  <b>{item.coachFeedback.nextAssignment}</b>
                </div>
                <small>{item.coachUpdateText}</small>
                <div>
                  <button type="button" onClick={() => copyInboxCoachUpdate(item)}>
                    {copyStatusByItemId[item.challenge.assignment.id] === 'copied'
                      ? 'Copied'
                      : copyStatusByItemId[item.challenge.assignment.id] === 'blocked'
                        ? 'Copy blocked'
                        : 'Copy update'}
                  </button>
                  <button type="button" onClick={() => onStartCard(item.challenge.card.id)}>Open recap</button>
                  <button type="button" onClick={() => assignSuggestedCoachNext(item)}>
                    {suggestedAssignmentById[item.challenge.assignment.id] ? 'Suggested assigned' : 'Assign suggested next'}
                  </button>
                  <button type="button" onClick={() => markCoachChallengeSent(item)}>Mark sent</button>
                </div>
                {copyStatusByItemId[item.challenge.assignment.id] === 'blocked' ? (
                  <textarea
                    className={styles.levelUpCoachInboxCopyFallback}
                    value={item.coachUpdateText}
                    readOnly
                    rows={3}
                    aria-label={`Manual coach update for ${item.challenge.card.title}`}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                ) : null}
              </div>
            ) : item.status === 'completed' && item.coachUpdateText ? (
              <div className={styles.levelUpCoachInboxDone}>
                <div className={styles.levelUpCoachFeedbackLoop} aria-label={`Sent coach feedback loop for ${item.challenge.card.title}`}>
                  <span>Coach feedback</span>
                  <strong>{item.coachFeedback.title}</strong>
                  <small>{item.coachFeedback.detail}</small>
                  <b>{item.coachFeedback.nextAssignment}</b>
                </div>
                <small><b>Sent update</b>{item.coachUpdateText}</small>
                <small><b>Next step</b>{item.nextStepText}</small>
                <div>
                  <button type="button" onClick={() => copyInboxCoachUpdate(item)}>
                    {copyStatusByItemId[item.challenge.assignment.id] === 'copied'
                      ? 'Copied'
                      : copyStatusByItemId[item.challenge.assignment.id] === 'blocked'
                        ? 'Copy blocked'
                        : 'Copy update'}
                  </button>
                  <button type="button" onClick={() => onStartCard(item.challenge.card.id)}>Run again</button>
                  <button type="button" onClick={() => assignSuggestedCoachNext(item)}>
                    {suggestedAssignmentById[item.challenge.assignment.id] ? 'Suggested assigned' : 'Assign suggested next'}
                  </button>
                  <button type="button" onClick={() => undoCoachChallengeSent(item)}>Undo sent</button>
                </div>
                {copyStatusByItemId[item.challenge.assignment.id] === 'blocked' ? (
                  <textarea
                    className={styles.levelUpCoachInboxCopyFallback}
                    value={item.coachUpdateText}
                    readOnly
                    rows={3}
                    aria-label={`Manual sent coach update for ${item.challenge.card.title}`}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                ) : null}
              </div>
            ) : (
              <button type="button" onClick={() => onStartCard(item.challenge.card.id)}>
                {item.status === 'completed' ? 'Run again' : 'Start'}
              </button>
            )}
          </article>
        )) : (
          <div className={styles.levelUpCoachInboxEmpty}>
            <span>{activeFilter}</span>
            <strong>No cards here.</strong>
            <small>{getCoachInboxEmptyCopy(activeFilter)}</small>
          </div>
        )}
      </div>
    </section>
  )
}

function CoachAssignmentBuilder({
  cardOptions,
  moduleOptions,
  onCreateAssignment,
}: {
  cardOptions: LevelUpCard[]
  moduleOptions: LevelUpModule[]
  onCreateAssignment: (payload: CoachAssignmentBuilderPayload) => void
}) {
  const defaultCard = cardOptions[0] ?? LEVEL_UP_CARDS[0]
  const defaultModule = moduleOptions.find((module) => module.cardIds.includes(defaultCard.id)) ?? moduleOptions[0] ?? LEVEL_UP_MODULES[0]
  const [open, setOpen] = useState(false)
  const [selectedCardId, setSelectedCardId] = useState(defaultCard.id)
  const selectedCard = cardOptions.find((card) => card.id === selectedCardId) ?? defaultCard
  const matchingModule = moduleOptions.find((module) => module.cardIds.includes(selectedCard.id)) ?? defaultModule
  const [selectedModuleId, setSelectedModuleId] = useState(matchingModule.id)
  const selectedModule = moduleOptions.find((module) => module.id === selectedModuleId) ?? matchingModule
  const [dueDate, setDueDate] = useState(() => getDefaultAssignmentDueDate())
  const [coachNote, setCoachNote] = useState(() => buildDefaultCoachAssignmentNote(defaultCard))
  const [proofRequired, setProofRequired] = useState(defaultCard.proof)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')

  function selectCard(cardId: string) {
    const nextCard = cardOptions.find((card) => card.id === cardId) ?? defaultCard
    const nextModule = moduleOptions.find((module) => module.cardIds.includes(nextCard.id)) ?? selectedModule
    setSelectedCardId(nextCard.id)
    setSelectedModuleId(nextModule.id)
    setProofRequired(nextCard.proof)
    setCoachNote(buildDefaultCoachAssignmentNote(nextCard))
    setSelectedTemplateId('')
  }

  function applyTemplate(template: CoachAssignmentTemplate) {
    const templateCard = cardOptions.find((card) => card.id === template.cardId)
      ?? LEVEL_UP_CARDS.find((card) => card.id === template.cardId)
      ?? defaultCard
    const templateModule = moduleOptions.find((module) => module.cardIds.includes(templateCard.id)) ?? selectedModule
    setSelectedCardId(templateCard.id)
    setSelectedModuleId(templateModule.id)
    setProofRequired(template.proofRequired ?? templateCard.proof)
    setCoachNote(template.coachNote)
    setSelectedTemplateId(template.id)
  }

  function createAssignment() {
    onCreateAssignment({
      card: selectedCard,
      module: selectedModule,
      dueDate,
      coachNote: coachNote.trim() || buildDefaultCoachAssignmentNote(selectedCard),
      proofRequired: proofRequired.trim() || selectedCard.proof,
    })
    setOpen(false)
  }

  return (
    <details className={styles.coachAssignmentBuilder} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <span>Coach assignment builder</span>
        <strong>Assign one tool that supports the player’s current tennis habit.</strong>
      </summary>
      <div className={styles.coachAssignmentTemplates} aria-label="Coach assignment templates">
        <span>Coach templates</span>
        <div>
          {coachAssignmentTemplates.map((template) => (
            <button
              key={template.id}
              type="button"
              data-active={selectedTemplateId === template.id}
              aria-pressed={selectedTemplateId === template.id}
              onClick={() => applyTemplate(template)}
            >
              {template.title}
            </button>
          ))}
        </div>
        <small>Pick one habit template, then adjust the proof or note if the lesson needs it.</small>
      </div>
      <div className={styles.coachAssignmentBuilderGrid}>
        <label>
          <span>Card</span>
          <select value={selectedCard.id} onChange={(event) => selectCard(event.target.value)}>
            {cardOptions.map((card) => (
              <option key={card.id} value={card.id}>{card.title}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Module</span>
          <select value={selectedModule.id} onChange={(event) => setSelectedModuleId(event.target.value)}>
            {moduleOptions.map((module) => (
              <option key={module.id} value={module.id}>{module.title}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Due</span>
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </label>
      </div>
      <div className={styles.coachAssignmentBuilderGrid}>
        <label>
          <span>Proof required</span>
          <input value={proofRequired} onChange={(event) => setProofRequired(event.target.value)} maxLength={90} />
        </label>
        <label>
          <span>Coach note</span>
          <textarea value={coachNote} onChange={(event) => setCoachNote(event.target.value)} maxLength={180} rows={3} />
        </label>
      </div>
      <div className={styles.coachAssignmentBuilderPreview} aria-label={`Assignment preview for ${selectedCard.title}`}>
        <span>Player will see</span>
        <strong>{selectedCard.title}</strong>
        <small>{coachNote || buildDefaultCoachAssignmentNote(selectedCard)}</small>
        <b>{proofRequired || selectedCard.proof}</b>
      </div>
      <button type="button" onClick={createAssignment}>Assign challenge</button>
    </details>
  )
}

function LevelUpSessionDock({
  intent,
  activeFilterCount,
  visibleStartCount,
  favoriteCount,
  completionCount,
  sessionRead,
}: {
  intent: string
  activeFilterCount: number
  visibleStartCount: number
  favoriteCount: number
  completionCount: number
  sessionRead: string
}) {
  const filterLabel = activeFilterCount === 1 ? '1 filter' : `${activeFilterCount} filters`
  const logLabel = completionCount === 1 ? '1 proof' : `${completionCount} proofs`
  const favoriteLabel = favoriteCount === 1 ? '1 favorite' : `${favoriteCount} favorites`

  return (
    <nav className={styles.levelUpSessionDock} aria-label="Level Up session shortcuts">
      <div>
        <span>Now</span>
        <strong>{intent}</strong>
        <small>{visibleStartCount} ready cards</small>
      </div>
      <div className={styles.levelUpSessionStats} aria-label="Session status">
        <small>{filterLabel}</small>
        <small>{logLabel}</small>
        <small>{favoriteLabel}</small>
        <small>{sessionRead}</small>
      </div>
      <div className={styles.levelUpSessionActions}>
        <a href="#level-up-start-here">Start</a>
        <a href="#level-up-filters">Filters</a>
        <a href="#all-cards">Library</a>
      </div>
    </nav>
  )
}

function LevelUpReadinessPicker({
  activeReadiness,
  onApply,
}: {
  activeReadiness: ReadinessPreset['state']
  onApply: (preset: ReadinessPreset) => void
}) {
  const activePreset = readinessPresets.find((preset) => preset.state === activeReadiness) ?? readinessPresets[0]

  return (
    <section className={styles.levelUpReadinessPicker} aria-label="Choose today's readiness">
      <div>
        <span>Before you start</span>
        <strong>{activePreset.command}</strong>
        <small>{activePreset.playerCue}</small>
      </div>
      <div className={styles.levelUpReadinessChoices}>
        {readinessPresets.map((preset) => (
          <button
            key={preset.state}
            type="button"
            data-active={activeReadiness === preset.state}
            aria-pressed={activeReadiness === preset.state}
            onClick={() => onApply(preset)}
          >
            <b>{preset.label}</b>
            <span>{preset.copy}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function LevelUpStartList({
  startListRef,
  intent,
  cards,
  recommendationByCardId,
  completionSummaryByCardId,
  favorites,
  onFavorite,
  onComplete,
  onActivityChange,
  onStartCard,
  identitySlug,
  nextBestRep,
}: {
  startListRef: RefObject<HTMLElement | null>
  intent: string
  cards: LevelUpCard[]
  recommendationByCardId: Map<string | undefined, LevelUpRecommendation>
  completionSummaryByCardId: Map<string, CompletionSummary>
  favorites: string[]
  onFavorite: (cardId: string) => void
  onComplete: CompletionLogger
  onActivityChange?: (cardTitle: string | null) => void
  onStartCard: (cardId: string) => void
  identitySlug: string
  nextBestRep: NextBestRep
}) {
  const uniqueStartCards = uniqueCards(cards)

  return (
    <section ref={startListRef} id="level-up-start-here" className={styles.levelUpStartList} aria-label="Start here">
      <div className={styles.levelUpRailHeader}>
        <span>Start here</span>
        <h2>{intent === 'Recommended' ? 'Three strong places to begin.' : `${intent}: three good matches.`}</h2>
        <p>Pick one card, run it, then log a number. You do not need to browse the whole library first.</p>
      </div>
      <div className={styles.levelUpAdaptiveStartHint} aria-label="Adaptive next card">
        <span>Suggested next card</span>
        <strong>{nextBestRep.card.title}</strong>
        <i>{formatAdaptiveDecisionBadge(nextBestRep.decision)}</i>
        <b>{nextBestRep.signal}</b>
        <small>{nextBestRep.detail}</small>
      </div>
      <LevelUpProgressPath nextBestRep={nextBestRep} />
      <div className={styles.levelUpRailGrid}>
        {uniqueStartCards.map((card) => (
          <LevelUpCardTile
            key={card.id}
            card={card}
            reason={card.id === nextBestRep.card.id ? buildAdaptiveCardReason(nextBestRep) : recommendationByCardId.get(card.id)?.reason}
            favorite={favorites.includes(card.id)}
            completionSummary={completionSummaryByCardId.get(card.id)}
            onFavorite={onFavorite}
            onComplete={onComplete}
            onActivityChange={onActivityChange}
            nextCardCandidate={getNextCardInList(uniqueStartCards, card)}
            onStartNextCard={onStartCard}
            startHref={buildCardStartHref(identitySlug, card)}
          />
        ))}
      </div>
    </section>
  )
}

function LevelUpProgressPath({ nextBestRep }: { nextBestRep: NextBestRep }) {
  const stages = buildProgressPathStages(nextBestRep)

  return (
    <div className={styles.levelUpProgressPath} aria-label="Proof to next-card path">
      <span>Proof path</span>
      <div>
        {stages.map((stage) => (
          <section key={stage.label} data-current={stage.current ? 'true' : 'false'}>
            <b>{stage.label}</b>
            <strong>{stage.title}</strong>
            <small>{stage.detail}</small>
          </section>
        ))}
      </div>
    </div>
  )
}

function LevelUpHero({ identityTitle, recommendationCopy }: { identityTitle: string; recommendationCopy: string }) {
  return (
    <section className={styles.levelUpHero}>
      <div className={styles.levelUpHeroCopy}>
        <span>Level Up Portal</span>
        <h1 id="level-up-portal-title">Level Up Your Tennis Game</h1>
        <p>Coach-assigned, identity-recommended, and player-favorited tools for building the next habit.</p>
        <small>{identityTitle.replace(/^The /, '')}: {recommendationCopy}</small>
        <div className={styles.levelUpCardActions}>
          <a className="button-primary" href="#today-mission">Start today&apos;s mission</a>
          <a className="button-secondary" href="#all-cards">Browse all cards</a>
          <a className="button-secondary" href="#favorites">View favorites</a>
        </div>
      </div>
      <div className={styles.levelUpHeroPanel}>
        <strong>Use numbers first.</strong>
        <p>Add one small note only if it changes the next practice.</p>
      </div>
    </section>
  )
}

function LevelUpSmartRail({
  id,
  title,
  cards,
  recommendationByCardId,
  completionSummaryByCardId,
  favorites,
  onFavorite,
  onComplete,
  onActivityChange,
  onStartNextCard,
  emptyText,
  identitySlug,
  defaultOpen,
}: {
  id?: string
  title: string
  cards: LevelUpCard[]
  recommendationByCardId: Map<string | undefined, LevelUpRecommendation>
  completionSummaryByCardId: Map<string, CompletionSummary>
  favorites: string[]
  onFavorite: (cardId: string) => void
  onComplete: CompletionLogger
  onActivityChange?: (cardTitle: string | null) => void
  onStartNextCard?: (cardId: string) => void
  emptyText?: string
  identitySlug: string
  defaultOpen?: boolean
}) {
  const railId = id ?? (title === 'Favorites' ? 'favorites' : undefined)
  const uniqueRailCards = uniqueCards(cards)

  return (
    <details id={railId} className={styles.levelUpRail} aria-label={title} open={defaultOpen}>
      <summary className={styles.levelUpRailSummary}>
        <span>{title}</span>
        <strong>{title}</strong>
        <small>{uniqueRailCards.length ? `${uniqueRailCards.length} cards` : 'Empty'}</small>
      </summary>
      {uniqueRailCards.length ? (
        <div className={styles.levelUpRailGrid}>
          {uniqueRailCards.map((card) => (
            <LevelUpCardTile
              key={card.id}
              card={card}
              reason={recommendationByCardId.get(card.id)?.reason}
              favorite={favorites.includes(card.id)}
              completionSummary={completionSummaryByCardId.get(card.id)}
              onFavorite={onFavorite}
              onComplete={onComplete}
              onActivityChange={onActivityChange}
              nextCardCandidate={getNextCardInList(uniqueRailCards, card)}
              onStartNextCard={onStartNextCard}
              startHref={buildCardStartHref(identitySlug, card)}
            />
          ))}
        </div>
      ) : <p>{emptyText ?? 'No cards in this rail yet.'}</p>}
    </details>
  )
}

function LevelUpFocusTrainingLane({
  laneKey,
  ariaLabel,
  eyebrow,
  title,
  copy,
  module,
  groups,
  station,
  completionSummaryByCardId,
  onStartCard,
  coachingCue,
}: {
  laneKey: string
  ariaLabel: string
  eyebrow: string
  title: string
  copy: string
  module?: LevelUpModule
  groups: FocusTrainingGroup[]
  station?: FocusTrainingStation
  completionSummaryByCardId: Map<string, CompletionSummary>
  onStartCard: (cardId: string) => void
  coachingCue: string
}) {
  const [activeStationTabKey, setActiveStationTabKey] = useState(station?.tabs[0]?.key ?? '')
  const nextCard = groups.find((group) => group.card && !completionSummaryByCardId.has(group.card.id))?.card
    ?? groups.find((group) => group.card)?.card
  const activeStationTab = station?.tabs.find((tab) => tab.key === activeStationTabKey) ?? station?.tabs[0]
  const activeStationCard = activeStationTab
    ? groups.find((group) => group.card?.id === activeStationTab.startCardId)?.card
    : undefined

  return (
    <section id={`level-up-lane-${laneKey}`} className={styles.levelUpFocusTraining} aria-label={ariaLabel}>
      <div className={styles.levelUpRailHeader}>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      {station && activeStationTab ? (
        <div className={styles.levelUpLaneStation} aria-label={`${station.label} station`}>
          <div className={styles.levelUpLaneStationTabs} aria-label={`${station.label} station tabs`}>
            {station.tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                aria-pressed={activeStationTab.key === tab.key}
                data-active={activeStationTab.key === tab.key}
                onClick={() => setActiveStationTabKey(tab.key)}
              >
                <span>{tab.label}</span>
                <small>{tab.detail}</small>
              </button>
            ))}
          </div>
          <div className={styles.levelUpLaneStationCard} aria-label={`${station.label} station guide`}>
            <div className={styles.levelUpLaneStationHeader}>
              <div>
                <span>{station.label}</span>
                <strong>{activeStationTab.title}</strong>
              </div>
              <button type="button" onClick={() => onStartCard(activeStationTab.startCardId)}>
                Start: {activeStationCard?.title ?? 'recommended rep'}
              </button>
            </div>
            <div className={styles.levelUpLaneStationDetails}>
              <p><b>Setup:</b> {activeStationTab.setup}</p>
              <p><b>Block:</b> {activeStationTab.block}</p>
              <p><b>Score:</b> {activeStationTab.score}</p>
              <p><b>Say:</b> {activeStationTab.say}</p>
              <p><b>Reset if:</b> {activeStationTab.resetIf}</p>
            </div>
            <div className={styles.levelUpLaneStationProof} aria-label={`${station.label} proof anchors`}>
              <span>Proof anchors</span>
              <p><b>1-2</b>{activeStationTab.proofAnchors.low}</p>
              <p><b>3</b>{activeStationTab.proofAnchors.mid}</p>
              <p><b>4-5</b>{activeStationTab.proofAnchors.high}</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className={styles.levelUpReturnTrainingGrid}>
        {module ? (
          <article className={styles.levelUpReturnModuleCard}>
            <span>{module.durationLabel}</span>
            <h3>{module.title}</h3>
            <p>{module.successCriteria ?? module.description}</p>
            <small>Proof: {module.proof}</small>
            {nextCard ? (
              <button type="button" className="button-primary" onClick={() => onStartCard(nextCard.id)}>
                Start {eyebrow.toLowerCase()} path
              </button>
            ) : null}
          </article>
        ) : null}
        <div className={styles.levelUpReturnQuickStarts}>
          {groups.map((group) => {
            const card = group.card

            return card ? (
              <button key={group.label} type="button" onClick={() => onStartCard(card.id)}>
                <span>{group.label}</span>
                <strong>{card.title}</strong>
                <small>{group.cue}</small>
              </button>
            ) : null
          })}
        </div>
      </div>
      <p className={styles.levelUpReturnCoachingCue}>
        {coachingCue}
      </p>
    </section>
  )
}

function LevelUpLaneChooser({ lanes }: { lanes: FocusTrainingLane[] }) {
  const items = lanes
    .map((lane) => buildLaneChooserItem(lane))
    .filter(Boolean) as LaneChooserItem[]

  if (!items.length) return null

  return (
    <section className={styles.levelUpLaneChooser} aria-label="Choose what to level up next">
      <div className={styles.levelUpRailHeader}>
        <span>Choose your lane</span>
        <h2>What needs work right now?</h2>
        <p>Pick the tennis problem first. The next screen gives you the station, proof target, and first rep.</p>
      </div>
      <div className={styles.levelUpLaneChooserGrid}>
        {items.map((item) => (
          <button
            key={item.laneKey}
            type="button"
            onClick={() => scrollToLane(item.laneKey)}
          >
            <span>{item.label}</span>
            <strong>{item.need}</strong>
            <small>{item.action}</small>
            <em>{item.cue}</em>
          </button>
        ))}
      </div>
    </section>
  )
}

function scrollToLane(laneKey: string) {
  document.getElementById(`level-up-lane-${laneKey}`)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

function buildLaneChooserItem(lane: FocusTrainingLane): LaneChooserItem | null {
  const itemByLaneKey: Record<string, Omit<LaneChooserItem, 'laneKey'>> = {
    serve: {
      label: 'Serve',
      need: 'I need a cleaner point start.',
      action: 'Choose routine, target, serve +1, pressure, or fix a miss.',
      cue: 'Target before toss.',
    },
    return: {
      label: 'Return',
      need: 'I need to start return games with intent.',
      action: 'Choose serve type, partner work, pressure, or fix a return miss.',
      cue: 'Job before contact.',
    },
    movement: {
      label: 'Movement',
      need: 'I need to arrive and recover better.',
      action: 'Choose warm-up, first step, recovery, wide ball, or fatigue.',
      cue: 'Contact, recover, then look.',
    },
    forehand: {
      label: 'Forehand',
      need: 'I need my forehand to build points.',
      action: 'Find shape, margin, attack-balance, and recovery reps.',
      cue: 'Shape before speed.',
    },
    backhand: {
      label: 'Backhand',
      need: 'I need my backhand to hold up.',
      action: 'Find spacing, depth, crosscourt, and pressure tolerance work.',
      cue: 'Depth buys time.',
    },
    volley: {
      label: 'Volley',
      need: 'I need to close and finish simpler.',
      action: 'Find split, punch, target, and approach-to-volley reps.',
      cue: 'Close, split, quiet hands.',
    },
    singles: {
      label: 'Singles',
      need: 'I need a clearer rally job.',
      action: 'Find build, defend, attack, pressure, and reset patterns.',
      cue: 'Name the point job.',
    },
    doubles: {
      label: 'Doubles',
      need: 'I need better first moves with my partner.',
      action: 'Find serve calls, return calls, poach timing, and middle rules.',
      cue: 'Call, move, cover.',
    },
  }

  const item = itemByLaneKey[lane.key]
  return item ? { laneKey: lane.key, ...item } : null
}

function LevelUpLaneProgressPanel({
  laneProgress,
  onStartCard,
}: {
  laneProgress: LaneProgressItem[]
  onStartCard: (cardId: string) => void
}) {
  const nextLane = laneProgress[0]

  return (
    <section className={styles.levelUpLaneProgress} aria-label="Lane progress">
      <div className={styles.levelUpRailHeader}>
        <span>Lane progress</span>
        <h2>{nextLane ? `${nextLane.label} needs the next clean proof.` : 'Build proof across your lanes.'}</h2>
        <p>Use one honest score per block. The goal is balance across your game, not collecting cards.</p>
      </div>
      <div className={styles.levelUpLaneProgressGrid}>
        {laneProgress.map((item) => {
          const nextCard = item.nextCard

          return (
            <article key={item.laneKey} data-empty={item.proofCount === 0 ? 'true' : 'false'}>
              <div>
                <span>{item.label}</span>
                <strong>{item.lastRating === undefined ? 'No proof' : `${item.lastRating}/5`}</strong>
              </div>
              <p>{item.read}</p>
              <small>{item.completedCardCount}/{item.totalCardCount} tools logged</small>
              <div className={styles.levelUpLaneProgressActions}>
                <button type="button" onClick={() => scrollToLane(item.laneKey)}>
                  Open lane
                </button>
                {nextCard ? (
                  <button type="button" onClick={() => onStartCard(nextCard.id)}>
                    Start {nextCard.title}
                  </button>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function LevelUpCardTile({
  card,
  reason,
  favorite,
  completionSummary,
  coachAssignment,
  onFavorite,
  onComplete,
  onActivityChange,
  nextCardCandidate,
  onStartNextCard,
  startHref,
  initialActivityOpen = false,
}: {
  card: LevelUpCard
  reason?: string
  favorite: boolean
  completionSummary?: CompletionSummary
  coachAssignment?: LevelUpAssignment
  onFavorite: (cardId: string) => void
  onComplete: CompletionLogger
  onActivityChange?: (cardTitle: string | null) => void
  nextCardCandidate?: LevelUpCard
  onStartNextCard?: (cardId: string) => void
  startHref: string
  initialActivityOpen?: boolean
}) {
  const cardRef = useRef<HTMLElement>(null)
  const activityTimerRef = useRef<HTMLDivElement>(null)
  const [rating, setRating] = useState(3)
  const [note, setNote] = useState('')
  const [savedRating, setSavedRating] = useState<number | null>(null)
  const [savedProofNote, setSavedProofNote] = useState('')
  const [loggerOpen, setLoggerOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(initialActivityOpen)
  const [timerRunning, setTimerRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [cleanRepCount, setCleanRepCount] = useState(0)
  const [missedRepCount, setMissedRepCount] = useState(0)
  const [roundNumber, setRoundNumber] = useState(1)
  const [completedRoundCount, setCompletedRoundCount] = useState(0)
  const [bankedCleanRepCount, setBankedCleanRepCount] = useState(0)
  const [sessionGoal, setSessionGoal] = useState('')
  const [activeVariant, setActiveVariant] = useState<ActiveDrillVariant>('base')
  const [repeatPlan, setRepeatPlan] = useState<{ title: string; detail: string } | null>(null)
  const [roundNotice, setRoundNotice] = useState<{ title: string; detail: string } | null>(null)
  const [finishRecap, setFinishRecap] = useState<{ title: string; detail: string; proof: string } | null>(null)
  const [coachUpdateCopyStatus, setCoachUpdateCopyStatus] = useState<'idle' | 'copied' | 'blocked'>('idle')
  const shownSavedRating = savedRating ?? completionSummary?.lastRating ?? null
  const proofGuidance = getProofRatingGuidance(rating, card)
  const notePrompt = getProofNotePrompt(rating)
  const repFeedback = getCardRepFeedback(card, rating)
  const coachableNote = getCoachableNotePrompt(card, rating)
  const commonMiss = getCardCommonMiss(card)
  const missedRepPattern = getMissedRepPattern(card, commonMiss, missedRepCount)
  const doseGuide = getCardDoseGuide(card)
  const transferGuide = getCardTransferGuide(card)
  const coachLens = getCardCoachLens(card)
  const readinessCheck = getCardReadinessCheck(card)
  const trainingOptions = getCardTrainingOptions(card)
  const nextPractice = getCardNextPractice(card, shownSavedRating)
  const sessionStandard = getCardSessionStandard(card)
  const sessionGoalOptions = getSessionGoalOptions(card)
  const activeSessionGoal = sessionGoal || sessionGoalOptions[0]
  const proofAnchors = getCardProofAnchors(card)
  const activeQualityChecks = getCardQualityChecks(card).slice(0, 3)
  const activeWatchCue = activeQualityChecks[cleanRepCount % activeQualityChecks.length] ?? card.cue
  const repLadder = getCardRepLadder(card)
  const variantPlan = getAdaptiveDrillVariantPlan(card, activeVariant)
  const targetSeconds = Math.max(60, variantPlan.durationMinutes * 60)
  const timerProgress = Math.min(100, Math.round((elapsedSeconds / targetSeconds) * 100))
  const cleanRepTarget = getAdaptiveCleanRepTarget(card, activeVariant)
  const roundTarget = getAdaptiveRoundTarget(card, cleanRepTarget, activeVariant)
  const cleanRepProgress = Math.min(100, Math.round((cleanRepCount / cleanRepTarget) * 100))
  const roundComplete = cleanRepCount >= cleanRepTarget
  const roundCompletePrompt = getRoundCompletePrompt(card, cleanRepCount, cleanRepTarget)
  const roundResetCue = getRoundResetCue(card)
  const totalCleanRepCount = bankedCleanRepCount + cleanRepCount
  const suggestedRating = getActivitySuggestedRating(cleanRepCount, cleanRepTarget, elapsedSeconds, missedRepCount)
  const activeScoreDecision = getScoreDecision(card, suggestedRating)
  const hasActiveProofSignal = totalCleanRepCount > 0 || missedRepCount > 0 || elapsedSeconds > 0 || Boolean(roundNotice)
  const quickProofNotes = getQuickProofNotes({
    card,
    rating,
    commonMiss,
    completedRoundCount,
    totalCleanRepCount,
  })
  const activityProofNote = getActivityProofNote({
    cleanRepCount,
    cleanRepTarget,
    elapsedSeconds,
    completedRoundCount,
    totalCleanRepCount,
    missedRepCount,
    sessionGoal: activeSessionGoal,
  })
  const savedProofAction = savedRating === null ? null : getSavedProofAction(card, savedRating)
  const savedScoreDecision = savedRating === null ? null : getScoreDecision(card, savedRating)
  const savedCoachNextRead = savedRating === null ? null : getCoachNextAssignmentRead(card, savedRating)
  const savedCoachRecommendedNext = savedRating === null ? null : getCoachRecommendedNext(card, savedRating, Boolean(coachAssignment))
  const savedNextCardPlan = savedRating === null ? null : getPostProofNextCardPlan(card, savedRating, nextCardCandidate)
  const savedProofSnapshot = savedRating === null ? null : buildProofSnapshot({
    card,
    rating: savedRating,
    sessionGoal: activeSessionGoal,
    cleanRepCount,
    cleanRepTarget,
    completedRoundCount,
    totalCleanRepCount,
    missedRepCount,
    elapsedSeconds,
  })
  const savedSessionRecap = savedRating === null ? null : buildSavedSessionRecap({
    card,
    rating: savedRating,
    sessionGoal: activeSessionGoal,
    elapsedSeconds,
    completedRoundCount,
    totalCleanRepCount,
    missedRepCount,
  })
  const savedPrimaryPath = savedRating === null ? null : {
    title: savedCoachRecommendedNext?.title ?? getAfterScorePrimaryAction(card, savedRating),
    detail: savedSessionRecap?.next ?? getAfterScoreDetail(card, savedRating),
    actionLabel: savedCoachRecommendedNext?.actionLabel ?? getAfterScorePrimaryButton(card, savedRating),
  }
  const activeFocusState = savedRating !== null ? 'saved' : loggerOpen ? 'scoring' : timerRunning ? 'running' : elapsedSeconds > 0 || cleanRepCount > 0 || missedRepCount > 0 ? 'working' : 'ready'
  const activeFocusLabel = getActiveFocusLabel(activeFocusState)
  const finishLineSteps = [
    { label: 'Goal', value: activeSessionGoal, done: Boolean(activeSessionGoal), active: savedRating === null && totalCleanRepCount === 0 && missedRepCount === 0 },
    { label: 'Reps', value: `${totalCleanRepCount} clean${missedRepCount ? `, ${missedRepCount} missed` : ''}`, done: totalCleanRepCount > 0 || missedRepCount > 0, active: savedRating === null && (totalCleanRepCount > 0 || missedRepCount > 0) },
    { label: 'Proof', value: savedRating === null ? `${suggestedRating}/5 suggested` : `${savedRating}/5 saved`, done: savedRating !== null, active: loggerOpen },
    { label: 'Finish', value: savedRating === null ? 'Save proof first' : 'Share or pick next', done: savedRating !== null, active: savedRating !== null },
  ]
  const savedCoachUpdate = savedProofAction && savedRating !== null
    ? buildCoachUpdate({
      card,
      rating: savedRating,
      note: savedProofNote || activityProofNote,
      cleanRepCount,
      cleanRepTarget,
      completedRoundCount,
      totalCleanRepCount,
      missedRepCount,
      elapsedSeconds,
      nextAction: savedProofAction.title,
      nextFirstRep: savedNextCardPlan?.firstRep,
      sessionGoal: activeSessionGoal,
    })
    : ''
  const coachAssignedLabel = coachAssignment ? getCoachAssignmentCardLabel(coachAssignment, card) : null
  const questHref = buildCardQuestHref(startHref)

  useEffect(() => {
    if (!timerRunning) return undefined
    const timer = window.setInterval(() => {
      setElapsedSeconds((seconds) => {
        const nextSeconds = Math.min(seconds + 1, targetSeconds)
        if (nextSeconds >= targetSeconds) {
          window.clearInterval(timer)
          setTimerRunning(false)
        }
        return nextSeconds
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [targetSeconds, timerRunning])

  useEffect(() => {
    if (!initialActivityOpen) return
    window.requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [initialActivityOpen])

  function startActivity() {
    setActivityOpen(true)
    onActivityChange?.(card.title)
    setActiveVariant('base')
    setRepeatPlan(null)
    setRoundNotice(null)
    setFinishRecap(null)
    if (!sessionGoal) setSessionGoal(sessionGoalOptions[0])
    window.requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function openLogger() {
    setActivityOpen(true)
    onActivityChange?.(card.title)
    setLoggerOpen(true)
    setRating(suggestedRating)
    window.requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function completeCard() {
    const proofNote = note.trim() || activityProofNote
    onComplete(card.id, rating, proofNote, elapsedSeconds)
    setSavedRating(rating)
    setSavedProofNote(proofNote)
    setCoachUpdateCopyStatus('idle')
    setNote('')
  }

  function repeatActivity() {
    const nextRepeatPlan = savedRating === null ? null : getAfterScoreRepeatPlan(card, savedRating)
    const nextVariant = savedRating === null ? 'base' : getVariantForRating(savedRating)
    setTimerRunning(false)
    setElapsedSeconds(0)
    setCleanRepCount(0)
    setMissedRepCount(0)
    setRoundNumber(1)
    setCompletedRoundCount(0)
    setBankedCleanRepCount(0)
    setActiveVariant(nextVariant)
    setSavedRating(null)
    setSavedProofNote('')
    setRepeatPlan(nextRepeatPlan)
    setRoundNotice(null)
    setFinishRecap(null)
    setCoachUpdateCopyStatus('idle')
    setLoggerOpen(false)
    setActivityOpen(true)
    window.requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function repeatRound() {
    setBankedCleanRepCount((count) => count + cleanRepCount)
    setCompletedRoundCount((count) => count + 1)
    setCleanRepCount(0)
    setMissedRepCount(0)
    setRoundNumber((round) => round + 1)
    setRoundNotice({
      title: 'Round reset.',
      detail: `Start the next round with this cue: ${card.cue}`,
    })
    window.requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function resetDecisionRound() {
    setCleanRepCount(0)
    setMissedRepCount(0)
    setRoundNumber((round) => round + 1)
    setRoundNotice({
      title: 'Clean round started.',
      detail: `Watch one cue first: ${activeWatchCue}`,
    })
    window.requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function toggleActivityTimer(event?: MouseEvent<HTMLButtonElement>) {
    event?.preventDefault()
    event?.stopPropagation()
    setTimerRunning((running) => {
      const nextRunning = !running
      if (nextRunning) {
        window.requestAnimationFrame(() => {
          activityTimerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
      }
      return nextRunning
    })
  }

  function resetActivityTimer(event?: MouseEvent<HTMLButtonElement>) {
    event?.preventDefault()
    event?.stopPropagation()
    setTimerRunning(false)
    setElapsedSeconds(0)
  }

  function clearDecisionMiss() {
    setMissedRepCount((count) => Math.max(count - 1, 0))
    setRoundNotice({
      title: 'Miss cleared.',
      detail: missedRepPattern.cleanRepStandard,
    })
  }

  function finishActivity() {
    setTimerRunning(false)
    setLoggerOpen(false)
    setActivityOpen(false)
    onActivityChange?.(null)
    if (savedRating !== null) {
      setFinishRecap(buildFinishRecap({
        card,
        rating: savedRating,
        completedRoundCount,
        totalCleanRepCount,
        missedRepCount,
        elapsedSeconds,
        sessionGoal: activeSessionGoal,
      }))
    }
    window.requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  function finishAndPickNext() {
    setTimerRunning(false)
    setLoggerOpen(false)
    setActivityOpen(false)
    onActivityChange?.(null)
    if (savedRating !== null) {
      setFinishRecap(buildFinishRecap({
        card,
        rating: savedRating,
        completedRoundCount,
        totalCleanRepCount,
        missedRepCount,
        elapsedSeconds,
        sessionGoal: activeSessionGoal,
      }))
    }
    window.requestAnimationFrame(() => {
      document.getElementById('level-up-start-here')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function pickNextCard() {
    document.getElementById('level-up-start-here')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function startPostProofNextCard() {
    if (!savedNextCardPlan) return
    if (savedNextCardPlan.card.id === card.id) {
      repeatActivity()
      return
    }

    setTimerRunning(false)
    setLoggerOpen(false)
    setActivityOpen(false)
    setSavedRating(null)
    setSavedProofNote('')
    setRepeatPlan(null)
    setFinishRecap(null)
    setCoachUpdateCopyStatus('idle')
    onActivityChange?.(savedNextCardPlan.card.title)
    onStartNextCard?.(savedNextCardPlan.card.id)
  }

  async function copyCoachUpdate() {
    if (savedRating === null || !savedProofAction) return

    try {
      await window.navigator.clipboard?.writeText(savedCoachUpdate)
      setCoachUpdateCopyStatus('copied')
    } catch {
      setCoachUpdateCopyStatus('blocked')
    }
  }

  function runSavedPrimaryAction() {
    if (!savedCoachRecommendedNext) {
      repeatActivity()
      return
    }

    if (savedCoachRecommendedNext.action === 'send') {
      void copyCoachUpdate()
      return
    }

    if (savedCoachRecommendedNext.action === 'pick-next') {
      finishAndPickNext()
      return
    }

    repeatActivity()
  }

  return (
    <article ref={cardRef} className={`${styles.levelUpCardTile} ${activityOpen ? styles.levelUpCardTileActive : ''}`} data-activity={activityOpen ? 'true' : 'false'} data-level-up-card-id={card.id}>
      <div>
        <span>{card.pack}</span>
        <h3>{card.title}</h3>
        <p>{card.useWhen}</p>
      </div>
      <div className={styles.levelUpCardMeta}>
        <DurationPill minutes={card.durationMinutes} />
        <span>{card.intensity}</span>
        <EquipmentPill equipment={card.equipment.join(', ')} />
      </div>
      {coachAssignedLabel ? (
        <div className={styles.coachAssignedCardPill} aria-label={`Coach assignment context for ${card.title}`}>
          <span>{coachAssignedLabel.status}</span>
          <strong>{coachAssignedLabel.proof}</strong>
          <small>{coachAssignedLabel.due}</small>
        </div>
      ) : null}
      <div className={styles.levelUpDrillHabitBridge} aria-label={`Drill to habit bridge for ${card.title}`}>
        <div>
          <span>Drill to habit</span>
          <strong>{savedRating === null ? 'Start drill, save proof, then turn it into a habit.' : 'Proof saved. Habit builder is ready.'}</strong>
        </div>
        <ol>
          <li data-active={activityOpen || savedRating !== null ? 'true' : 'false'}>Start drill</li>
          <li data-active={savedRating !== null ? 'true' : 'false'}>Save proof</li>
          <li data-active={savedRating !== null ? 'true' : 'false'}>Turn into habit</li>
        </ol>
        <a href={questHref}>Turn into habit</a>
      </div>
      {activityOpen ? (
        <div className={styles.levelUpActivityMode} aria-label={`Active drill mode for ${card.title}`} data-focus-state={activeFocusState}>
          <div className={styles.levelUpActivityHeader}>
            <span>Active drill</span>
            <strong>{card.title}</strong>
            <small>{card.cue}</small>
            <button type="button" onClick={() => {
              setActivityOpen(false)
              onActivityChange?.(null)
            }}>
              Exit
            </button>
          </div>
          <div className={styles.levelUpActivityFocusBar} aria-label={`Current work state for ${card.title}`}>
            <div>
              <span>{activeFocusLabel}</span>
              <strong>Round {roundNumber}: {formatTimer(elapsedSeconds)} - {cleanRepCount}/{cleanRepTarget} clean</strong>
              <small>{variantPlan.label} - {card.proof}</small>
            </div>
            <div className={styles.levelUpActiveQuickActions} aria-label={`Quick active controls for ${card.title}`}>
              <button type="button" onClick={toggleActivityTimer}>
                {timerRunning ? 'Pause' : elapsedSeconds > 0 ? 'Resume' : 'Start'}
              </button>
              <button type="button" onClick={() => setCleanRepCount((count) => Math.min(count + 1, cleanRepTarget))}>+1</button>
              <button type="button" onClick={openLogger}>{savedRating === null ? 'Score' : 'Review'}</button>
            </div>
          </div>
          <div className={styles.levelUpFinishLine} aria-label={`Session finish line for ${card.title}`}>
            {finishLineSteps.map((step) => (
              <span key={step.label} data-done={step.done ? 'true' : 'false'} data-active={step.active ? 'true' : 'false'}>
                <b>{step.label}</b>
                {step.value}
              </span>
            ))}
          </div>
          {activeVariant !== 'base' ? (
            <div className={styles.levelUpAdaptiveVariant} aria-label={`Adaptive drill adjustment for ${card.title}`}>
              <span>{variantPlan.label}</span>
              <strong>{variantPlan.title}</strong>
              <small>{variantPlan.detail}</small>
            </div>
          ) : null}
          {repeatPlan ? (
            <div className={styles.levelUpRepeatPlan} aria-label={`Repeat plan for ${card.title}`}>
              <span>Repeat plan</span>
              <strong>{repeatPlan.title}</strong>
              <small>{repeatPlan.detail}</small>
            </div>
          ) : null}
          <div className={styles.levelUpSessionGoal} aria-label={`Session goal for ${card.title}`}>
            <span>Today&apos;s proof goal</span>
            <strong>{activeSessionGoal}</strong>
            <div>
              {sessionGoalOptions.map((goal) => (
                <button key={goal} type="button" data-active={activeSessionGoal === goal ? 'true' : 'false'} onClick={() => setSessionGoal(goal)}>
                  {goal}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.levelUpActiveWatchCue} aria-label={`Watch this rep for ${card.title}`}>
            <span>Watch this rep</span>
            <strong>{activeWatchCue}</strong>
          </div>
          <div className={styles.levelUpActivityCommand} aria-label={`Do this round for ${card.title}`}>
            <span>Do this round</span>
            <strong>{variantPlan.command}</strong>
            <small>{roundTarget.target} Score only what you can see.</small>
            <div>
              <b>Cue</b>
              <strong>{card.cue}</strong>
            </div>
            <div>
              <b>Clean rep</b>
              <strong>{roundTarget.quality}</strong>
            </div>
            <div>
              <b>Fix</b>
              <strong>{commonMiss.fix}</strong>
            </div>
          </div>
          <div className={styles.levelUpCourtCard} aria-label={`Court card for ${card.title}`}>
            <span>Court card</span>
            <div>
              <b>Set up</b>
              <strong>{getCardSetupLabel(card)}</strong>
            </div>
            <div>
              <b>Count it</b>
              <strong>{roundTarget.quality}</strong>
            </div>
            <div>
              <b>Stop when</b>
              <strong>{sessionStandard.stop}</strong>
            </div>
          </div>
          {missedRepCount > 0 ? (
            <div className={styles.levelUpMissDecoder} aria-label={`Miss decoder for ${card.title}`}>
              <span>Miss decoder</span>
              <strong>{missedRepPattern.title}</strong>
              <small>{missedRepPattern.detail}</small>
              <div>
                <b>Next clean rep</b>
                <strong>{missedRepPattern.cleanRepStandard}</strong>
              </div>
            </div>
          ) : null}
          <div className={styles.levelUpActiveQualityStrip} aria-label={`Clean rep checks for ${card.title}`}>
            <span>Clean rep checks</span>
            {activeQualityChecks.map((check) => (
              <strong key={check}>{check}</strong>
            ))}
          </div>
          <div className={styles.levelUpActivityWorkGrid}>
            <div ref={activityTimerRef} className={styles.levelUpActivityTimer} data-timer-state={timerRunning ? 'running' : elapsedSeconds > 0 ? 'paused' : 'ready'}>
              <span>Timer</span>
              <strong>{formatTimer(elapsedSeconds)}</strong>
              <small>Target: {variantPlan.durationMinutes}:00. Stop early if quality drops.</small>
              <div className={styles.levelUpActivityTimerTrack} aria-hidden="true">
                <i style={{ width: `${timerProgress}%` }} />
              </div>
              <div className={styles.levelUpActivityTimerActions}>
                <button type="button" onClick={toggleActivityTimer}>
                  {timerRunning ? 'Pause' : elapsedSeconds > 0 ? 'Resume' : 'Start timer'}
                </button>
                <button type="button" aria-label={`Reset timer for ${card.title}`} onClick={resetActivityTimer}>
                  Reset timer
                </button>
              </div>
            </div>
            <div className={styles.levelUpActivityRepCounter} data-rep-state={cleanRepCount >= cleanRepTarget ? 'complete' : cleanRepCount > 0 ? 'counting' : 'ready'}>
              <span>Clean reps</span>
              <strong>{cleanRepCount}/{cleanRepTarget}</strong>
              <small>Tap +1 only when the proof behavior showed up. Tap missed it when the habit breaks.</small>
              {completedRoundCount > 0 ? (
                <em className={styles.levelUpRoundBank}>{completedRoundCount} round banked - {totalCleanRepCount} total clean reps</em>
              ) : null}
              {missedRepCount > 0 ? (
                <div className={styles.levelUpMissedRepCue} aria-label={`Missed rep cue for ${card.title}`}>
                  <span>{missedRepCount} missed</span>
                  <strong>{missedRepPattern.title}</strong>
                  <small>{missedRepPattern.detail}</small>
                  <em>{missedRepPattern.cleanRepStandard}</em>
                </div>
              ) : null}
              <div className={styles.levelUpActivityTimerTrack} aria-hidden="true">
                <i style={{ width: `${cleanRepProgress}%` }} />
              </div>
              <div className={styles.levelUpActivityRepActions}>
                <button type="button" onClick={() => setCleanRepCount((count) => Math.min(count + 1, cleanRepTarget))}>+1 clean</button>
                <button type="button" onClick={() => setMissedRepCount((count) => count + 1)}>Missed it</button>
                <button type="button" onClick={() => setCleanRepCount((count) => Math.max(count - 1, 0))}>Undo clean</button>
                {missedRepCount > 0 ? (
                  <button type="button" onClick={() => setMissedRepCount((count) => Math.max(count - 1, 0))}>Undo miss</button>
                ) : null}
                <button type="button" onClick={() => {
                  setCleanRepCount(0)
                  setMissedRepCount(0)
                }}>
                  Reset reps
                </button>
              </div>
            </div>
          </div>
          {roundComplete && savedRating === null ? (
            <div className={styles.levelUpRoundComplete} aria-label={`Round complete for ${card.title}`}>
              <span>Round complete</span>
              <strong>{roundCompletePrompt.title}</strong>
              <small>{roundCompletePrompt.detail}</small>
              <div className={styles.levelUpRoundReset}>
                <b>Reset first</b>
                <strong>{roundResetCue}</strong>
              </div>
              <div>
                <button type="button" onClick={openLogger}>Score this round</button>
                <button type="button" onClick={repeatRound}>Repeat round</button>
              </div>
            </div>
          ) : null}
          {hasActiveProofSignal && savedRating === null ? (
            <div className={styles.levelUpActiveScoreDecision} aria-label={`Active score decision for ${card.title}`}>
              <span>Score decision</span>
              <strong>{suggestedRating}/5 suggested - {activeScoreDecision.title}</strong>
              <small>{activeScoreDecision.detail}</small>
              {roundNotice ? (
                <em>{roundNotice.title} {roundNotice.detail}</em>
              ) : null}
              <div className={styles.levelUpActiveDecisionActions}>
                <button type="button" onClick={openLogger}>Score proof</button>
                <button type="button" onClick={resetDecisionRound}>Repeat round</button>
                {missedRepCount > 0 ? (
                  <button type="button" onClick={clearDecisionMiss}>Clear miss</button>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className={styles.levelUpActivityActions}>
            <button type="button" className={styles.scoreButton} onClick={openLogger}>Score now</button>
            <a className="button-secondary" href={startHref}>Open guided flow</a>
            <a className="button-secondary" href={questHref}>Turn into habit</a>
          </div>
          <details className={styles.levelUpActivityGuide}>
            <summary>Need the drill guide?</summary>
            <div className={styles.levelUpRoundTarget} aria-label={`Round target for ${card.title}`}>
              <span>Win round {roundNumber}</span>
              <div>
                <b>Target</b>
                <strong>{roundTarget.target}</strong>
              </div>
              <div>
                <b>Quality</b>
                <strong>{roundTarget.quality}</strong>
              </div>
              <div>
                <b>If missed</b>
                <strong>{roundTarget.missResponse}</strong>
              </div>
            </div>
            <div className={styles.levelUpActivitySteps}>
              <div>
                <b>Set</b>
                <strong>{getCardSetupLabel(card)}</strong>
              </div>
              <div>
                <b>Work</b>
                <strong>{getCardDoseGuide(card).target}</strong>
              </div>
              <div>
                <b>Score</b>
                <strong>{getCardProofStandard(card)}</strong>
              </div>
            </div>
            <div className={styles.levelUpActivityCue}>
              <span>One cue</span>
              <strong>{card.cue}</strong>
              <small>{getCardAvoidCue(card)}</small>
            </div>
            <div className={styles.levelUpActivityFixNow} aria-label={`Quick correction for ${card.title}`}>
              <span>Fix now</span>
              <div>
                <b>If this shows up</b>
                <strong>{commonMiss.miss}</strong>
              </div>
              <div>
                <b>Do this next rep</b>
                <strong>{commonMiss.fix}</strong>
              </div>
            </div>
            <div className={styles.levelUpActivityStandard} aria-label={`Session standard for ${card.title}`}>
              <div>
                <span>Before</span>
                <strong>{sessionStandard.before}</strong>
              </div>
              <div>
                <span>Counts</span>
                <strong>{sessionStandard.counts}</strong>
              </div>
              <div>
                <span>Stop</span>
                <strong>{sessionStandard.stop}</strong>
              </div>
            </div>
            <div className={styles.levelUpActivityRepLadder} aria-label={`Rep ladder for ${card.title}`}>
              <span>Rep ladder</span>
              {repLadder.map((step) => (
                <div key={step.label}>
                  <b>{step.label}</b>
                  <strong>{step.action}</strong>
                </div>
              ))}
            </div>
            <div className={styles.levelUpActivityScoreGuide} aria-label={`Proof anchors for ${card.title}`}>
              <span>Score honestly</span>
              <div>
                <b>0-1</b>
                <strong>{proofAnchors.low}</strong>
              </div>
              <div>
                <b>2-3</b>
                <strong>{proofAnchors.mid}</strong>
              </div>
              <div>
                <b>4-5</b>
                <strong>{proofAnchors.high}</strong>
              </div>
            </div>
          </details>
        </div>
      ) : null}
      {!activityOpen ? (
        <>
          <p><b>Proof:</b> {card.proof}</p>
          <div className={styles.levelUpPurposeStrip} aria-label={`Training purpose for ${card.title}`}>
            <span><b>Builds</b>{getCardPurposeLabel(card)}</span>
            <span><b>Best setting</b>{getCardSettingLabel(card)}</span>
            <span><b>Coach sees</b>{getCardCoachSignal(card)}</span>
          </div>
          <div className={styles.levelUpTrainingStandards} aria-label={`Training standards for ${card.title}`}>
            <span>Train clean</span>
            <div>
              <b>Counts when</b>
              <strong>{getCardProofStandard(card)}</strong>
            </div>
            <div>
              <b>Avoid</b>
              <strong>{getCardAvoidCue(card)}</strong>
            </div>
            <div>
              <b>Coach handoff</b>
              <strong>{getCardCoachHandoff(card)}</strong>
            </div>
          </div>
          {reason ? <RecommendedReasonPill reason={reason} /> : null}
          {completionSummary ? <CompletionSummaryPill summary={completionSummary} /> : null}
          {finishRecap ? (
            <div className={styles.levelUpFinishRecap} aria-label={`Finished session recap for ${card.title}`}>
              <span>Session saved</span>
              <strong>{finishRecap.title}</strong>
              <small>{finishRecap.detail}</small>
              <em>{finishRecap.proof}</em>
              <p>{savedCoachUpdate}</p>
              {savedNextCardPlan ? (
                <div className={styles.levelUpFinishNextCard} aria-label={`Finish recap next card for ${card.title}`}>
                  <span>Suggested next</span>
                  <strong>{savedNextCardPlan.card.title}</strong>
                  <small>{savedNextCardPlan.detail}</small>
                  <div className={styles.levelUpFinishNextReason} aria-label={`Why ${savedNextCardPlan.card.title} is next`}>
                    <span>
                      <b>Why</b>
                      {savedNextCardPlan.reason}
                    </span>
                    <span>
                      <b>Proof</b>
                      {savedNextCardPlan.proofTarget}
                    </span>
                    <span>
                      <b>First rep</b>
                      {savedNextCardPlan.firstRep}
                    </span>
                  </div>
                  <button type="button" data-finish-next-card="true" onClick={startPostProofNextCard}>{savedNextCardPlan.actionLabel}</button>
                </div>
              ) : null}
              <div className={styles.levelUpFinishChoices} aria-label={`Finish choices for ${card.title}`}>
                <span>Finish choices</span>
                <button type="button" data-finish-copy="true" onClick={copyCoachUpdate}>{getCopyStatusLabel(coachUpdateCopyStatus, 'Copy update', 'Update copied')}</button>
                <button type="button" data-finish-repeat="true" onClick={repeatActivity}>Repeat later</button>
                <button type="button" data-next-card="true" onClick={pickNextCard}>Pick next</button>
              </div>
              {coachUpdateCopyStatus === 'blocked' ? (
                <textarea
                  className={styles.levelUpCopyFallback}
                  value={savedCoachUpdate}
                  readOnly
                  rows={4}
                  aria-label={`Manual coach recap for ${card.title}`}
                  onFocus={(event) => event.currentTarget.select()}
                />
              ) : null}
            </div>
          ) : null}
          {nextPractice ? (
            <div className={styles.levelUpNextPractice}>
              <span>Next practice</span>
              <strong>{nextPractice.title}</strong>
              <small>{nextPractice.detail}</small>
              <div className={styles.levelUpNextPracticeGrid} aria-label={`Next practice prescription for ${card.title}`}>
                <span>
                  <b>Dose</b>
                  {nextPractice.dose}
                </span>
                <span>
                  <b>Focus</b>
                  {nextPractice.focus}
                </span>
                <span>
                  <b>Coach ask</b>
                  {nextPractice.coachAsk}
                </span>
              </div>
            </div>
          ) : null}
          <div className={styles.levelUpDoNow}>
            <span>Do now</span>
            <strong>{card.cue}</strong>
            <small>{card.routine[0]}</small>
          </div>
          <div className={styles.levelUpRunStrip} aria-label={`How to run ${card.title}`}>
            <span><b>Set</b>{getCardSetupLabel(card)}</span>
            <span><b>Do</b>{card.durationMinutes} min controlled block</span>
            <span><b>Score</b>{card.proof.replace(' 0-5', '')}</span>
          </div>
        </>
      ) : null}
      <details className={styles.levelUpCardPlan}>
        <summary>View plan</summary>
        <div className={styles.levelUpPlanCue}>
          <span>Cue</span>
          <strong>{card.cue}</strong>
        </div>
        <div className={styles.levelUpPlanGoal}>
          <span>Why it matters</span>
          <p>{card.tennisGoal}</p>
        </div>
        <ol>
          {card.routine.slice(0, 3).map((step) => <li key={step}>{step}</li>)}
        </ol>
        <div className={styles.levelUpQualityChecks}>
          <span>Quality checks</span>
          <ul>
            {getCardQualityChecks(card).map((check) => <li key={check}>{check}</li>)}
          </ul>
        </div>
        <div className={styles.levelUpReadinessCheck}>
          <span>Before you start</span>
          <strong>{readinessCheck.check}</strong>
          <small><b>Ready means:</b> {readinessCheck.readyMeans}</small>
        </div>
        <div className={styles.levelUpTrainingOptions}>
          <span>Run it today</span>
          <div>
            <strong>Solo</strong>
            <small>{trainingOptions.solo}</small>
          </div>
          <div>
            <strong>With someone</strong>
            <small>{trainingOptions.partner}</small>
          </div>
        </div>
        <div className={styles.levelUpCommonMiss}>
          <span>Common miss</span>
          <strong>{commonMiss.miss}</strong>
          <small><b>Fast fix:</b> {commonMiss.fix}</small>
        </div>
        <div className={styles.levelUpDoseGuide}>
          <span>Enough for today</span>
          <strong>{doseGuide.target}</strong>
          <small><b>Stop when:</b> {doseGuide.stopRule}</small>
        </div>
        <div className={styles.levelUpTransferGuide}>
          <span>Use it in points</span>
          <strong>{transferGuide.moment}</strong>
          <small><b>Try next:</b> {transferGuide.action}</small>
        </div>
        <div className={styles.levelUpCoachLens}>
          <span>Coach lens</span>
          <strong>{coachLens.watch}</strong>
          <small><b>Ask:</b> {coachLens.ask}</small>
        </div>
        <div className={styles.levelUpPlanScale}>
          <p><b>Level up:</b> {card.progression}</p>
          <p><b>Scale down:</b> {card.regression}</p>
        </div>
        {card.safetyNote ? <small>{card.safetyNote}</small> : null}
      </details>
      <details className={styles.completionLogger} open={loggerOpen} onToggle={(event) => setLoggerOpen(event.currentTarget.open)}>
        <summary>
          <span>{savedRating === null ? 'Score proof' : 'Proof saved'}</span>
          <strong>{savedRating === null ? `${rating}/5 - ${proofGuidance.title}` : `${savedRating}/5 - ${savedProofAction?.title ?? 'Saved proof'}`}</strong>
        </summary>
        {savedRating === null ? (
          <>
            <p className={styles.levelUpLoggerHint}>Pick the number that matches the habit. Save first; add a note only if it changes the next rep.</p>
            <div className={styles.levelUpScorePad}>
              <div className={styles.levelUpProofScale} aria-label={`Proof scale for ${card.title}`}>
                <span>0-1: not yet</span>
                <span>2-3: showing up</span>
                <span>4-5: repeatable</span>
              </div>
              <div className={styles.levelUpLoggerAnchors} aria-label={`Score anchors for ${card.title}`}>
                <span>
                  <b>0-1</b>
                  {proofAnchors.low}
                </span>
                <span>
                  <b>2-3</b>
                  {proofAnchors.mid}
                </span>
                <span>
                  <b>4-5</b>
                  {proofAnchors.high}
                </span>
              </div>
              <div className={styles.levelUpScoreButtons} aria-label={`Proof rating buttons for ${card.title}`}>
                {[0, 1, 2, 3, 4, 5].map((value) => (
                  <button key={value} type="button" data-active={rating === value ? 'true' : 'false'} onClick={() => setRating(value)}>{value}</button>
                ))}
              </div>
              <div className={styles.levelUpProofNextStep}>
                <span>Next rep</span>
                <strong>{proofGuidance.title}</strong>
                <small>{proofGuidance.detail}</small>
              </div>
            </div>
            {cleanRepCount > 0 || missedRepCount > 0 || elapsedSeconds > 0 ? (
              <div className={styles.levelUpActivityRecap}>
                <span>Activity recap</span>
                <strong>{cleanRepCount}/{cleanRepTarget} clean reps - {missedRepCount} missed - {formatTimer(elapsedSeconds)}</strong>
                <small>Suggested proof: {suggestedRating}/5. Total clean reps: {totalCleanRepCount}. Missed reps lower the suggestion only when they show the habit needs another cleaner round.</small>
              </div>
            ) : null}
            <details className={styles.levelUpTinyNoteDrawer}>
              <summary>Add tiny note</summary>
              <div className={styles.levelUpRepFeedback}>
                <span>{repFeedback.label}</span>
                <strong>{repFeedback.title}</strong>
                <small>{repFeedback.detail}</small>
              </div>
              <div className={styles.levelUpCoachableNote}>
                <span>Worth noting</span>
                <strong>{coachableNote.title}</strong>
                <small>{coachableNote.prompt}</small>
              </div>
              <div className={styles.levelUpQuickNotes} aria-label={`Quick notes for ${card.title}`}>
                <span>Tap a note</span>
                <div>
                  {quickProofNotes.map((quickNote) => (
                    <button key={quickNote} type="button" onClick={() => setNote(quickNote)}>{quickNote}</button>
                  ))}
                </div>
              </div>
              <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={120} placeholder={notePrompt} aria-label={`Note for ${card.title}`} />
            </details>
            <div className={styles.levelUpScoreSaveBar}>
              <span>{card.proof}</span>
              <button type="button" className="button-secondary" onClick={completeCard}>Save {rating}/5 proof</button>
            </div>
          </>
        ) : null}
        {savedProofAction && savedRating !== null ? (
          <div className={styles.completionSavedMessage}>
            <span>Proof saved</span>
            <strong>{savedRating}/5 - {savedProofAction.title}</strong>
            <small>{savedProofAction.detail}</small>
            <div className={styles.levelUpSavedProofBadges} aria-label={`Saved proof summary for ${card.title}`}>
              <span>
                <b>Goal</b>
                {activeSessionGoal}
              </span>
              <span>
                <b>Proof</b>
                {savedRating}/5
              </span>
              <span>
                <b>Next</b>
                {savedPrimaryPath?.actionLabel ?? getAfterScorePrimaryButton(card, savedRating)}
              </span>
            </div>
            <div className={styles.levelUpSavedShareStatus} data-share-status={coachUpdateCopyStatus}>
              <b>Coach update</b>
              <span>{coachUpdateCopyStatus === 'copied' ? 'Copied and ready to send.' : coachUpdateCopyStatus === 'blocked' ? 'Manual copy ready below.' : 'Ready to copy when linked with coach.'}</span>
            </div>
            {savedPrimaryPath ? (
              <div className={styles.levelUpSavedPrimaryPath} aria-label={`Primary saved action for ${card.title}`}>
                <span>Do next</span>
                <strong>{savedPrimaryPath.title}</strong>
                <small>{savedPrimaryPath.detail}</small>
                <div>
                  <button type="button" data-primary="true" onClick={runSavedPrimaryAction}>{savedPrimaryPath.actionLabel}</button>
                  <button type="button" onClick={copyCoachUpdate}>{getCopyStatusLabel(coachUpdateCopyStatus, 'Copy coach update', 'Coach update copied')}</button>
                  <button type="button" data-finish="true" onClick={finishActivity}>Finish</button>
                </div>
              </div>
            ) : null}
            <details className={styles.levelUpSavedDetails}>
              <summary>Review proof details</summary>
              <div className={styles.levelUpSavedActionStrip} aria-label={`Saved proof action strip for ${card.title}`}>
                <span>
                  <b>Saved</b>
                  {savedRating}/5
                </span>
                <span>
                  <b>Next</b>
                  {getAfterScorePrimaryButton(card, savedRating)}
                </span>
                <span>
                  <b>Share</b>
                  {coachUpdateCopyStatus === 'copied' ? 'Copied' : coachUpdateCopyStatus === 'blocked' ? 'Manual copy' : 'Ready'}
                </span>
              </div>
              {savedSessionRecap ? (
                <div className={styles.levelUpSavedSessionRecap} aria-label={`Saved session recap for ${card.title}`}>
                  <span>Session recap</span>
                  <strong>{savedSessionRecap.headline}</strong>
                  <small>{savedSessionRecap.detail}</small>
                  <em>{savedSessionRecap.next}</em>
                </div>
              ) : null}
              {savedCoachRecommendedNext ? (
                <div className={styles.levelUpCoachRecommendedNext} aria-label={`Coach recommended next for ${card.title}`}>
                  <span>Coach Recommended Next</span>
                  <strong>{savedCoachRecommendedNext.title}</strong>
                  <small>{savedCoachRecommendedNext.detail}</small>
                  <div className={styles.levelUpCoachNextRecipe} aria-label={`Next rep recipe for ${card.title}`}>
                    {savedCoachRecommendedNext.recipe.map((item) => (
                      <span key={item.label}>
                        <b>{item.label}</b>
                        {item.value}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    data-recommendation-action={savedCoachRecommendedNext.action}
                    onClick={savedCoachRecommendedNext.action === 'send' ? copyCoachUpdate : savedCoachRecommendedNext.action === 'pick-next' ? finishAndPickNext : repeatActivity}
                  >
                    {savedCoachRecommendedNext.actionLabel}
                  </button>
                </div>
              ) : null}
              {savedProofSnapshot ? (
                <div className={styles.levelUpProofSnapshot} aria-label={`Proof snapshot for ${card.title}`}>
                  <span>Proof snapshot</span>
                  <div>
                    <b>Goal</b>
                    <strong>{savedProofSnapshot.goal}</strong>
                  </div>
                  <div>
                    <b>Score</b>
                    <strong>{savedProofSnapshot.score}</strong>
                  </div>
                  <div>
                    <b>Rep signal</b>
                    <strong>{savedProofSnapshot.repSignal}</strong>
                  </div>
                  <div>
                    <b>Coach ask</b>
                    <strong>{savedProofSnapshot.coachAsk}</strong>
                  </div>
                </div>
              ) : null}
              <div className={styles.levelUpAfterScoreNext}>
                <span>Next move</span>
                <strong>{getAfterScorePrimaryAction(card, savedRating)}</strong>
                <small>{getAfterScoreDetail(card, savedRating)}</small>
              </div>
              {savedNextCardPlan ? (
                <div className={styles.levelUpPostProofNextCard} aria-label={`Post-proof next card for ${card.title}`}>
                  <span>Run next</span>
                  <strong>{savedNextCardPlan.card.title}</strong>
                  <small>{savedNextCardPlan.detail}</small>
                  <button type="button" onClick={startPostProofNextCard}>
                    {savedNextCardPlan.actionLabel}
                  </button>
                </div>
              ) : null}
              {nextPractice ? (
                <div className={styles.levelUpNextPractice} aria-label={`Next practice prescription for ${card.title}`}>
                  <span>Next practice</span>
                  <strong>{nextPractice.title}</strong>
                  <small>{nextPractice.detail}</small>
                  <div className={styles.levelUpNextPracticeGrid}>
                    <span>
                      <b>Dose</b>
                      {nextPractice.dose}
                    </span>
                    <span>
                      <b>Focus</b>
                      {nextPractice.focus}
                    </span>
                    <span>
                      <b>Coach ask</b>
                      {nextPractice.coachAsk}
                    </span>
                  </div>
                </div>
              ) : null}
              {savedScoreDecision ? (
                <div className={styles.levelUpScoreDecision}>
                  <span>Next action</span>
                  <strong>{savedScoreDecision.title}</strong>
                  <small>{savedScoreDecision.detail}</small>
                </div>
              ) : null}
              {savedCoachNextRead ? (
                <div className={styles.levelUpCoachNextRead} aria-label={`Coach next assignment read for ${card.title}`}>
                  <span>Coach read</span>
                  <strong>{savedCoachNextRead.title}</strong>
                  <small>{savedCoachNextRead.detail}</small>
                  <em>{savedCoachNextRead.assignment}</em>
                  <button type="button" onClick={repeatActivity}>
                    Do this next: {savedCoachNextRead.actionLabel}
                  </button>
                </div>
              ) : null}
              <div className={styles.coachUpdatePreview}>
                <span>Coach update</span>
                <p>{savedCoachUpdate}</p>
              </div>
              <div className={styles.completionSavedActions}>
                <button type="button" data-primary="true" onClick={repeatActivity}>{getAfterScorePrimaryButton(card, savedRating)}</button>
                <button type="button" onClick={copyCoachUpdate}>{getCopyStatusLabel(coachUpdateCopyStatus, 'Copy coach update', 'Coach update copied')}</button>
                <button type="button" data-finish="true" onClick={finishActivity}>Finish session</button>
                <button type="button" data-next-card="true" onClick={finishAndPickNext}>Pick next card</button>
              </div>
            </details>
            {coachUpdateCopyStatus === 'blocked' ? (
              <textarea
                className={styles.levelUpCopyFallback}
                value={savedCoachUpdate}
                readOnly
                rows={4}
                aria-label={`Manual active coach update for ${card.title}`}
                onFocus={(event) => event.currentTarget.select()}
              />
            ) : null}
          </div>
        ) : null}
      </details>
      <div className={styles.levelUpCardActions} data-proof-saved={savedRating !== null ? 'true' : 'false'}>
        {savedRating === null ? (
          <>
            <button type="button" className="button-primary" data-level-up-start-action="true" onClick={startActivity}>Start</button>
            <button type="button" className={styles.scoreButton} onClick={openLogger}>Score</button>
            <a className="button-secondary" href={questHref}>Turn into habit</a>
            <LevelUpFavoriteButton active={favorite} onClick={() => onFavorite(card.id)} />
          </>
        ) : (
          <>
            <button type="button" className="button-primary" data-level-up-repeat-action="true" onClick={repeatActivity}>{getAfterScorePrimaryButton(card, savedRating)}</button>
            <button type="button" className={styles.scoreButton} data-level-up-pick-next-action="true" onClick={finishAndPickNext}>Pick next</button>
            <a className="button-secondary" href={questHref}>Turn into habit</a>
            <button type="button" className={styles.scoreButton} onClick={copyCoachUpdate}>{getCopyStatusLabel(coachUpdateCopyStatus, 'Copy update', 'Update copied')}</button>
            <button type="button" className={styles.scoreButton} data-level-up-finish-action="true" onClick={finishActivity}>Finish</button>
          </>
        )}
      </div>
    </article>
  )
}

function LevelUpModuleTile({
  module,
  identitySlug,
  completionSummaryByCardId,
  onStartCard,
}: {
  module: LevelUpModule
  identitySlug: string
  completionSummaryByCardId: Map<string, CompletionSummary>
  onStartCard: (cardId: string) => void
}) {
  const moduleCards = module.cardIds
    .map((cardId) => LEVEL_UP_CARDS.find((card) => card.id === cardId))
    .filter(Boolean)
    .slice(0, 4) as LevelUpCard[]
  const completedCount = moduleCards.filter((card) => completionSummaryByCardId.has(card.id)).length
  const nextCard = moduleCards.find((card) => !completionSummaryByCardId.has(card.id)) ?? moduleCards[0]
  const progressLabel = moduleCards.length ? `${completedCount}/${moduleCards.length} logged` : 'No cards yet'
  const moduleActionLabel = completedCount > 0 && completedCount < moduleCards.length ? 'Continue module' : completedCount === moduleCards.length ? 'Repeat module' : 'Start module'
  const moduleStages = buildModuleProgressStages(module, moduleCards, completionSummaryByCardId)
  const moduleReadiness = buildModulePathReadiness(module, moduleCards, completionSummaryByCardId)

  return (
    <article className={styles.levelUpModuleTile}>
      <span>{module.durationLabel}</span>
      <h3>{module.title}</h3>
      <strong>{module.subtitle}</strong>
      <p>{module.description}</p>
      {module.useWhen || module.sessionPlan?.length || module.successCriteria ? (
        <details className={styles.levelUpModuleGuide}>
          <summary>How to use this module</summary>
          {module.useWhen ? (
            <div>
              <span>Use when</span>
              <p>{module.useWhen}</p>
            </div>
          ) : null}
          {module.sessionPlan?.length ? (
            <ol>
              {module.sessionPlan.slice(0, 3).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : null}
          {module.successCriteria ? (
            <div>
              <span>Done when</span>
              <p>{module.successCriteria}</p>
            </div>
          ) : null}
        </details>
      ) : null}
      <div className={styles.levelUpModuleProgress}>
        <small>{progressLabel}</small>
        {nextCard ? <b>Next up: {nextCard.title}</b> : null}
      </div>
      <div className={styles.levelUpModulePathCoach} aria-label={`${module.title} module path coach`}>
        <span>Path coach</span>
        <strong>{moduleReadiness.title}</strong>
        <small>{moduleReadiness.detail}</small>
        <b>{moduleReadiness.proofGate}</b>
      </div>
      <div className={styles.levelUpModulePath} aria-label={`${module.title} module progression`}>
        {moduleStages.map((stage) => (
          <div key={stage.label} data-active={stage.active ? 'true' : 'false'} data-complete={stage.complete ? 'true' : 'false'}>
            <span>{stage.label}</span>
            <strong>{stage.title}</strong>
            <small>{stage.detail}</small>
          </div>
        ))}
      </div>
      {moduleCards.length ? (
        <ol className={styles.levelUpModuleCards}>
          {moduleCards.map((card) => (
            <li key={card.id} data-complete={completionSummaryByCardId.has(card.id) ? 'true' : 'false'}>
              <b>{card.title}</b>
              <small>{completionSummaryByCardId.has(card.id) ? `Logged ${completionSummaryByCardId.get(card.id)?.lastRating ?? ''}/5` : card.proof}</small>
            </li>
          ))}
        </ol>
      ) : null}
      <small>Proof: {module.proof}</small>
      {nextCard ? (
        <div className={styles.levelUpModuleActions}>
          <button type="button" className="button-primary" onClick={() => onStartCard(nextCard.id)}>{moduleActionLabel}</button>
          <a className="button-secondary" href={buildCardStartHref(identitySlug, nextCard)}>Open guide</a>
        </div>
      ) : null}
    </article>
  )
}

function buildModuleProgressStages(
  module: LevelUpModule,
  moduleCards: LevelUpCard[],
  completionSummaryByCardId: Map<string, CompletionSummary>,
) {
  const stageLabels = ['Start', 'Build', 'Pressure', 'Transfer']
  const stageDetails = [
    'Learn the cue.',
    'Repeat the behavior.',
    'Add one challenge.',
    'Use it in points.',
  ]
  const nextCardIndex = moduleCards.findIndex((card) => !completionSummaryByCardId.has(card.id))
  const safeActiveIndex = Math.min(nextCardIndex < 0 ? stageLabels.length - 1 : nextCardIndex, stageLabels.length - 1)

  return stageLabels.map((label, index) => {
    const card = moduleCards[index] ?? moduleCards[moduleCards.length - 1]
    const complete = card ? completionSummaryByCardId.has(card.id) : false
    return {
      label,
      title: card?.title ?? module.title,
      detail: index === safeActiveIndex ? 'Do this next.' : complete ? 'Proof logged.' : stageDetails[index],
      active: index === safeActiveIndex,
      complete,
    }
  })
}

function buildModulePathReadiness(
  module: LevelUpModule,
  moduleCards: LevelUpCard[],
  completionSummaryByCardId: Map<string, CompletionSummary>,
) {
  if (!moduleCards.length) {
    return {
      title: 'No path cards yet.',
      detail: 'Add cards to this module before assigning it.',
      proofGate: module.proof,
    }
  }

  const nextCard = moduleCards.find((card) => !completionSummaryByCardId.has(card.id)) ?? moduleCards[0]
  const completedCount = moduleCards.filter((card) => completionSummaryByCardId.has(card.id)).length
  const latestRating = moduleCards
    .map((card) => completionSummaryByCardId.get(card.id)?.lastRating)
    .find((rating): rating is number => typeof rating === 'number')

  if (completedCount === 0) {
    return {
      title: 'Start with one proof.',
      detail: `Run ${nextCard.title}. Do not browse the full module yet.`,
      proofGate: `Move on when ${nextCard.proof} is 3/5 or better.`,
    }
  }

  if (latestRating !== undefined && latestRating <= 2) {
    return {
      title: 'Repeat before advancing.',
      detail: `The last proof says this path needs cleaner reps before the next card.`,
      proofGate: `Repeat ${nextCard.title} until the proof reaches 3/5.`,
    }
  }

  if (completedCount < moduleCards.length) {
    return {
      title: 'Advance one card.',
      detail: `The next useful module rep is ${nextCard.title}.`,
      proofGate: `Move on when ${nextCard.proof} is 4/5 or better.`,
    }
  }

  return {
    title: 'Transfer it to play.',
    detail: module.successCriteria ?? `Use this module in a live point and keep the proof honest.`,
    proofGate: module.proof,
  }
}

function LevelUpFilters({
  filters,
  resultCount,
  activeFilterCount,
  onChange,
  onReset,
}: {
  filters: FilterState
  resultCount: number
  activeFilterCount: number
  onChange: (filters: FilterState) => void
  onReset: () => void
}) {
  const options = useMemo(() => ({
    category: unique(LEVEL_UP_CARDS.map((card) => card.category)),
    pack: unique(LEVEL_UP_CARDS.map((card) => card.pack)),
    setting: unique(LEVEL_UP_CARDS.flatMap((card) => card.setting)),
    equipment: unique(LEVEL_UP_CARDS.flatMap((card) => card.equipment)),
    intensity: unique(LEVEL_UP_CARDS.map((card) => card.intensity)),
    level: unique(LEVEL_UP_CARDS.map((card) => card.level)),
    tag: unique(LEVEL_UP_CARDS.flatMap((card) => card.tags)),
  }), [])

  return (
    <details id="level-up-filters" className={styles.levelUpFilters} aria-label="Level Up filters">
      <summary className={styles.levelUpFilterSummary}>
        <span>{activeFilterCount ? `${activeFilterCount} filters active` : 'Optional'}</span>
        <strong>Advanced filters</strong>
        <small>{resultCount} matching cards</small>
      </summary>
      <div className={styles.levelUpFilterControls}>
        <FilterSelect label="category" value={filters.category} options={options.category} onChange={(value) => onChange({ ...filters, category: value })} />
        <FilterSelect label="pack" value={filters.pack} options={options.pack} onChange={(value) => onChange({ ...filters, pack: value })} />
        <FilterSelect label="setting" value={filters.setting} options={options.setting} onChange={(value) => onChange({ ...filters, setting: value })} />
        <FilterSelect label="equipment" value={filters.equipment} options={options.equipment} onChange={(value) => onChange({ ...filters, equipment: value })} />
        <FilterSelect label="duration" value={filters.duration} options={['under-10']} onChange={(value) => onChange({ ...filters, duration: value })} />
        <FilterSelect label="intensity" value={filters.intensity} options={options.intensity} onChange={(value) => onChange({ ...filters, intensity: value })} />
        <FilterSelect label="level" value={filters.level} options={options.level} onChange={(value) => onChange({ ...filters, level: value })} />
        <FilterSelect label="tag" value={filters.tag} options={options.tag} onChange={(value) => onChange({ ...filters, tag: value })} />
        <button type="button" onClick={onReset}>Reset filters</button>
      </div>
    </details>
  )
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className={styles.levelUpFilterGroup}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">All</option>
        {options.map((option) => <option key={option} value={option}>{formatLabel(option)}</option>)}
      </select>
    </label>
  )
}

function LevelUpFavoriteButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return <button type="button" className={styles.favoriteButton} data-active={active ? 'true' : 'false'} onClick={onClick}>{active ? 'Favorited' : 'Favorite'}</button>
}

function RecommendedReasonPill({ reason }: { reason: string }) {
  return <small className={styles.reasonPill}>{reason}</small>
}

function CompletionSummaryPill({ summary }: { summary: CompletionSummary }) {
  const rating = typeof summary.lastRating === 'number' ? `${summary.lastRating}/5` : 'logged'
  const label = summary.count === 1 ? '1 log' : `${summary.count} logs`
  const trend = getProofTrendLabel(summary)
  const action = getProofTrendAction(trend)
  const prescription = getProofProgressPrescription(summary)
  return (
    <small className={styles.completionSummaryPill}>
      <span>Last proof {rating} - {trend}: {action} - {label}</span>
      <strong>{prescription}</strong>
    </small>
  )
}

function getActiveFocusLabel(state: string) {
  if (state === 'saved') return 'Proof saved'
  if (state === 'scoring') return 'Scoring'
  if (state === 'running') return 'Timer running'
  if (state === 'working') return 'Work in progress'
  return 'Ready'
}

function getAfterScorePrimaryAction(card: LevelUpCard, rating: number) {
  return getAfterScoreTennisPrescription(card, rating).title
}

function getAfterScoreDetail(card: LevelUpCard, rating: number) {
  return getAfterScoreTennisPrescription(card, rating).detail
}

function getAfterScorePrimaryButton(card: LevelUpCard, rating: number) {
  return getAfterScoreTennisPrescription(card, rating).button
}

function getCopyStatusLabel(status: 'idle' | 'copied' | 'blocked', idleLabel: string, copiedLabel: string) {
  if (status === 'copied') return copiedLabel
  if (status === 'blocked') return 'Copy unavailable'
  return idleLabel
}

function getAfterScoreRepeatPlan(card: LevelUpCard, rating: number) {
  const prescription = getAfterScoreTennisPrescription(card, rating)

  if (rating <= 1) {
    return {
      title: prescription.repeatTitle,
      detail: prescription.repeatDetail,
    }
  }

  if (rating <= 3) {
    return {
      title: prescription.repeatTitle,
      detail: prescription.repeatDetail,
    }
  }

  return {
    title: prescription.repeatTitle,
    detail: prescription.repeatDetail,
  }
}

function getAfterScoreTennisPrescription(card: LevelUpCard, rating: number) {
  const habit = getCardPurposeLabel(card).toLowerCase()

  if (rating <= 1) {
    if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) {
      return {
        title: 'Shrink the serve rep.',
        detail: 'Shadow the serve routine, call one target, and score target clarity before hitting another ball.',
        button: 'Shadow & score',
        repeatTitle: 'Serve routine first, ball second.',
        repeatDetail: 'Remove the result. Call target, breathe, shadow, then save one cleaner proof score.',
      }
    }

    if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
      return {
        title: 'Remove the ball and recover first.',
        detail: 'Walk the contact, finish, recover sequence until recovery happens before you look.',
        button: 'Walk it clean',
        repeatTitle: 'No watching reps.',
        repeatDetail: 'Slow the rep down and count only finishes where recovery beats watching.',
      }
    }

    if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
      return {
        title: 'Cut the work block in half.',
        detail: 'Reduce time or reps until posture stays playable and breathing stays controlled.',
        button: 'Half block',
        repeatTitle: 'Quality before fatigue.',
        repeatDetail: 'Run a shorter block and score posture before adding more work.',
      }
    }

    return {
      title: `Scale down ${habit}.`,
      detail: card.regression ?? 'Make the setup easier and chase one visible cue before adding more.',
      button: 'Scale down',
      repeatTitle: 'Shrink the setup before chasing more reps.',
      repeatDetail: card.regression ?? 'Make the setup easier and chase one clean cue before adding more.',
    }
  }

  if (rating <= 3) {
    if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
      return {
        title: 'Repeat the reset under one real trigger.',
        detail: 'Pick the error, double fault, or rushed point that needs the reset and run it again.',
        button: 'Repeat reset',
        repeatTitle: 'Same trigger. Cleaner reset.',
        repeatDetail: 'Repeat the card and score whether the reset happens before the next point starts.',
      }
    }

    if (card.tags.includes('defense-to-neutral') || card.tags.includes('wide-ball-reset')) {
      return {
        title: 'Repeat until the neutral ball is clear.',
        detail: 'Keep height, depth, and recovery as the score. Do not attack until neutral is repeatable.',
        button: 'Repeat neutral',
        repeatTitle: 'Defense before attack.',
        repeatDetail: 'Run one more block and score whether the wide-ball response buys time.',
      }
    }

    return {
      title: `Repeat ${habit} clean.`,
      detail: `Keep the same setup and chase this cue again: ${card.cue}`,
      button: 'Repeat clean',
      repeatTitle: 'Same card. Cleaner cue.',
      repeatDetail: `Repeat the setup and score only this cue: ${card.cue}`,
    }
  }

  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target') || card.tags.includes('serve-plus-one')) {
    return {
      title: 'Add one serve pressure layer.',
      detail: card.progression ?? 'Start the next round at 30-30 while keeping the same target and routine.',
      button: 'Add pressure',
      repeatTitle: 'Pressure one serve variable.',
      repeatDetail: 'Add score pressure, not a new motion, and keep target clarity as the proof.',
    }
  }

  if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
    return {
      title: 'Add one faster recovery window.',
      detail: card.progression ?? 'Shorten the recovery window only if balance and finish stay clean.',
      button: 'Speed window',
      repeatTitle: 'Faster, not messier.',
      repeatDetail: 'Repeat the same recovery cue with a slightly tighter window and the same proof score.',
    }
  }

  return {
    title: `Level up ${habit}.`,
    detail: card.progression ?? 'Add one challenge while the proof behavior stays visible.',
    button: 'Level up',
    repeatTitle: 'Raise one variable, not three.',
    repeatDetail: card.progression ?? 'Add one small challenge while keeping the same proof score honest.',
  }
}

function buildFinishRecap({
  card,
  rating,
  completedRoundCount,
  totalCleanRepCount,
  missedRepCount,
  elapsedSeconds,
  sessionGoal,
}: {
  card: LevelUpCard
  rating: number
  completedRoundCount: number
  totalCleanRepCount: number
  missedRepCount: number
  elapsedSeconds: number
  sessionGoal: string
}) {
  const proofName = card.proof.replace(' 0-5', '')
  const missedLine = missedRepCount > 0 ? `, ${missedRepCount} missed` : ''
  const roundLine = completedRoundCount > 0 ? ` across ${completedRoundCount + 1} rounds` : ''
  const proof = totalCleanRepCount > 0 || missedRepCount > 0 || elapsedSeconds > 0
    ? `${rating}/5 ${proofName} - ${totalCleanRepCount} clean reps${missedLine}${roundLine} in ${formatTimer(elapsedSeconds)}`
    : `${rating}/5 ${proofName}`

  if (rating <= 1) {
    return {
      title: 'Next time: shrink it.',
      detail: `Goal was ${sessionGoal}. ${card.regression ?? 'Make the setup easier and chase one clean cue before adding more.'}`,
      proof,
    }
  }

  if (rating <= 3) {
    return {
      title: 'Next time: repeat clean.',
      detail: `Goal was ${sessionGoal}. Start with the same cue: ${card.cue}`,
      proof,
    }
  }

  return {
    title: 'Next time: level up one piece.',
    detail: `Goal was ${sessionGoal}. ${card.progression ?? 'Add one small challenge while keeping the same proof score honest.'}`,
    proof,
  }
}

function buildSavedSessionRecap({
  card,
  rating,
  sessionGoal,
  elapsedSeconds,
  completedRoundCount,
  totalCleanRepCount,
  missedRepCount,
}: {
  card: LevelUpCard
  rating: number
  sessionGoal: string
  elapsedSeconds: number
  completedRoundCount: number
  totalCleanRepCount: number
  missedRepCount: number
}) {
  const proofName = card.proof.replace(' 0-5', '').toLowerCase()
  const roundLine = completedRoundCount > 0 ? ` across ${completedRoundCount + 1} rounds` : ''
  const missedLine = missedRepCount > 0 ? ` with ${missedRepCount} misses logged` : ''
  const next = getSavedSessionNextAction(card, rating)

  return {
    headline: `You trained ${sessionGoal.toLowerCase()} for ${formatTimer(elapsedSeconds)}.`,
    detail: `${totalCleanRepCount} clean reps${missedLine}${roundLine}. Proof: ${rating}/5 ${proofName}.`,
    next,
  }
}

function getSavedSessionNextAction(card: LevelUpCard, rating: number) {
  if (rating <= 1) return `Next: scale down. ${getScaleDownSetup(card)}`
  if (rating <= 3) return `Next: repeat clean. Keep ${card.cue}`
  return `Next: add one pressure layer. ${getPressureLayerSetup(card)}`
}

function getSessionGoalOptions(card: LevelUpCard) {
  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) {
    return ['Serve target clarity', 'Same routine after misses', 'Calm first ball']
  }

  if (card.tags.includes('serve-plus-one')) {
    return ['Serve plus-one clarity', 'First ball decision', 'Pattern under pressure']
  }

  if (card.tags.includes('return-intent') || card.tags.includes('return-recovery')) {
    return ['Earlier return decision', 'Recover after contact', 'Return with a job']
  }

  if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
    return ['Cleaner recovery', 'Recover before watching', 'Ready spot after contact']
  }

  if (card.tags.includes('defense-to-neutral') || card.tags.includes('wide-ball-reset')) {
    return ['Defense back to neutral', 'Higher safer shape', 'Balanced recovery']
  }

  if (card.tags.includes('attack-balance') || card.tags.includes('forward-close')) {
    return ['Attack with balance', 'Controlled close', 'Ready after the attack']
  }

  if (card.tags.includes('doubles-communication') || card.tags.includes('partner-first-move')) {
    return ['Earlier partner call', 'First move clarity', 'Doubles reset after confusion']
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
    return ['Reset before next point', 'Calmer pressure response', 'One clear intention']
  }

  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
    return ['Better posture late', 'Legs under fatigue', 'Control before speed']
  }

  if (card.tags.includes('mobility') || card.tags.includes('stretch') || card.tags.includes('recovery')) {
    return ['Move better after play', 'Controlled range', 'Ready body reset']
  }

  return ['Cleaner habit', 'Better decision quality', 'Repeatable proof']
}

function getProofTrendLabel(summary: CompletionSummary) {
  if (summary.count < 2 || typeof summary.lastRating !== 'number' || typeof summary.previousRating !== 'number') {
    return 'first look'
  }

  if (summary.lastRating > summary.previousRating) return 'improving'
  if (summary.lastRating === summary.previousRating) return 'holding'
  return 'rebuild'
}

function getProofTrendAction(trend: string) {
  if (trend === 'improving') return 'raise the challenge'
  if (trend === 'holding') return 'repeat clean'
  if (trend === 'rebuild') return 'scale down'
  return 'log again'
}

function getProofProgressPrescription(summary: CompletionSummary) {
  if (typeof summary.lastRating !== 'number') return 'Log one honest score before changing the card.'
  if (summary.lastRating <= 1) return 'Next session: shrink the setup and chase one clean cue.'
  if (summary.lastRating <= 3) return 'Next session: repeat the same card before adding difficulty.'
  if (typeof summary.previousRating === 'number' && summary.lastRating > summary.previousRating) {
    return 'Next session: raise only one variable and keep proof honest.'
  }
  if (typeof summary.previousRating === 'number' && summary.lastRating < summary.previousRating) {
    return 'Next session: scale down and rebuild the habit first.'
  }
  return 'Next session: protect the habit, then add one small challenge.'
}

function getSessionReadLabel(summaryByCardId: Map<string, CompletionSummary>) {
  const trends = [...summaryByCardId.values()].map((summary) => getProofTrendLabel(summary))
  if (!trends.length) return 'No proof yet'

  const improving = trends.filter((trend) => trend === 'improving').length
  const rebuild = trends.filter((trend) => trend === 'rebuild').length
  const holding = trends.filter((trend) => trend === 'holding').length

  if (improving > 0 && improving >= rebuild && improving >= holding) return `${improving} improving`
  if (rebuild > 0 && rebuild >= holding) return `${rebuild} rebuild`
  if (holding > 0) return `${holding} holding`
  return 'Build proof'
}

function getRecentProofRead(completions: LevelUpCompletion[], recentCard?: LevelUpCard) {
  const recentCompletion = completions[0]
  if (!recentCompletion || !recentCard) return 'No proof yet'
  if (typeof recentCompletion.proofRating !== 'number') return 'Proof logged'

  if (recentCompletion.proofRating <= 1) return `${recentCompletion.proofRating}/5 - scale down`
  if (recentCompletion.proofRating <= 3) return `${recentCompletion.proofRating}/5 - repeat clean`
  return `${recentCompletion.proofRating}/5 - level up`
}

function buildNextBestRep({
  recentCard,
  recentCompletion,
  identityCards,
  todayCard,
  completionSummaryByCardId,
}: {
  recentCard?: LevelUpCard
  recentCompletion?: LevelUpCompletion
  identityCards: LevelUpCard[]
  todayCard: LevelUpCard
  completionSummaryByCardId: Map<string, CompletionSummary>
}): NextBestRep {
  if (recentCard && typeof recentCompletion?.proofRating === 'number') {
    if (recentCompletion.proofRating <= 1) {
      return {
        card: recentCard,
        label: 'Scale down next',
        decision: 'Decision: scale down',
        title: 'Shrink the setup and get one clean rep.',
        detail: recentCard.regression ?? `Make the setup easier and protect this cue: ${recentCard.cue}`,
        proof: recentCard.proof,
        signal: `Based on your last proof: ${recentCompletion.proofRating}/5.`,
        firstRep: getPostProofFirstRep(recentCard, 'scale-down'),
      }
    }

    if (recentCompletion.proofRating <= 3) {
      return {
        card: recentCard,
        label: 'Repeat next',
        decision: 'Decision: repeat clean',
        title: 'Same card, cleaner proof.',
        detail: `Repeat this before adding difficulty. Cue to protect: ${recentCard.cue}`,
        proof: recentCard.proof,
        signal: `Based on your last proof: ${recentCompletion.proofRating}/5.`,
        firstRep: getPostProofFirstRep(recentCard, 'repeat-clean'),
      }
    }

    const unloggedCard = identityCards.find((card) => !completionSummaryByCardId.has(card.id))
    const nextCard = unloggedCard ?? recentCard
    return {
      card: nextCard,
      label: 'Level up next',
      decision: 'Decision: level up',
      title: unloggedCard ? 'Add one new connected habit.' : 'Raise one variable, not all of them.',
      detail: unloggedCard ? `You proved ${recentCard.title}. Now connect it to ${unloggedCard.title}.` : recentCard.progression ?? `Raise one variable while keeping this cue: ${recentCard.cue}`,
      proof: nextCard.proof,
      signal: `Based on your last proof: ${recentCompletion.proofRating}/5.`,
      firstRep: getPostProofFirstRep(nextCard, unloggedCard ? 'next-card' : 'add-pressure'),
    }
  }

  return {
    card: todayCard,
    label: 'Start here',
    decision: 'Decision: log proof',
    title: 'Log one honest proof score.',
    detail: 'Run the first card, score 0-5, and let the next recommendation get sharper.',
    proof: todayCard.proof,
    signal: 'No proof logged yet.',
    firstRep: getPostProofFirstRep(todayCard, 'next-card'),
  }
}

function buildAdaptiveStartCards({
  activeFilterCount,
  filteredCards,
  identityCards,
  nextBestCard,
}: {
  activeFilterCount: number
  filteredCards: LevelUpCard[]
  identityCards: LevelUpCard[]
  nextBestCard: LevelUpCard
}) {
  if (activeFilterCount) return filteredCards.slice(0, 3)

  const startCards = [nextBestCard, ...identityCards].filter((card, index, cards) => (
    cards.findIndex((candidate) => candidate.id === card.id) === index
  ))

  return startCards.slice(0, 3)
}

function buildTodayPlan({ startCards }: { startCards: LevelUpCard[] }): TodayPlanItem[] {
  const labels = ['Start first', 'Add one rep', 'Finish useful']

  return startCards.slice(0, 3).map((card, index) => ({
    label: labels[index] ?? 'Next useful rep',
    card,
    proof: card.proof,
  }))
}

function buildCloseLoopItems({
  identityCards,
  matchDayCards,
  nextBestCard,
}: {
  identityCards: LevelUpCard[]
  matchDayCards: LevelUpCard[]
  nextBestCard: LevelUpCard
}): CloseLoopItem[] {
  const beforeMatchCard = LEVEL_UP_CARDS.find((card) => card.id === 'five-minute-match-primer')
    ?? matchDayCards.find((card) => card.tags.includes('match-day'))
    ?? identityCards[0]
    ?? nextBestCard
  const afterMatchCard = LEVEL_UP_CARDS.find((card) => card.id === 'post-match-five-minute-debrief')
    ?? matchDayCards.find((card) => card.tags.includes('recovery'))
    ?? nextBestCard
  const nextPracticeCard = nextBestCard

  return [
    {
      label: 'Before play',
      card: beforeMatchCard,
      cue: 'Choose one pattern, one reset, and one proof target before the first point.',
      action: 'Start primer',
    },
    {
      label: 'After play',
      card: afterMatchCard,
      cue: 'Write one proof, one leak, and one next rep. No long journal.',
      action: 'Recap now',
    },
    {
      label: 'Next practice',
      card: nextPracticeCard,
      cue: `Use the next recommended card to train what the last proof exposed.`,
      action: 'Pick next',
    },
  ]
}

function buildNetConfidenceLadder(): NetConfidenceLadderItem[] {
  const cards = buildCardsByIds([
    'short-ball-close-split',
    'volley-ready-split',
    'volley-punch-target',
    'approach-volley-close',
    'reaction-volley-wall',
  ])
  const byId = new Map(cards.map((card) => [card.id, card]))
  const ladder = [
    {
      label: 'Earn the close',
      card: byId.get('short-ball-close-split'),
      standard: 'Approach through the short ball, close, and split before watching.',
    },
    {
      label: 'Arrive ready',
      card: byId.get('volley-ready-split'),
      standard: 'Split before the pass and keep the hands quiet.',
    },
    {
      label: 'Give the volley a job',
      card: byId.get('volley-punch-target'),
      standard: 'Call deep middle, short angle, or behind before contact.',
    },
    {
      label: 'Connect the pattern',
      card: byId.get('approach-volley-close'),
      standard: 'Approach, close, split, and make the first volley useful.',
    },
    {
      label: 'Keep hands calm',
      card: byId.get('reaction-volley-wall'),
      standard: 'Use wall touches to reset hands without a big swing.',
    },
  ]

  return ladder.filter((item): item is NetConfidenceLadderItem => Boolean(item.card))
}

function buildNetConfidenceFixes(items: NetConfidenceLadderItem[]): NetConfidenceFixItem[] {
  const byCardId = new Map(items.map((item) => [item.card.id, item.card]))
  const fallback = items[0]?.card
  const fixes = [
    {
      problem: 'I approach and stop',
      card: byCardId.get('short-ball-close-split') ?? fallback,
      fix: 'Train the close after contact before worrying about the volley result.',
    },
    {
      problem: 'I am late to split',
      card: byCardId.get('volley-ready-split') ?? fallback,
      fix: 'Remove pace and score only close plus split timing.',
    },
    {
      problem: 'My volley has no target',
      card: byCardId.get('volley-punch-target') ?? fallback,
      fix: 'Call the target first so the volley has a job.',
    },
    {
      problem: 'I swing at the volley',
      card: byCardId.get('reaction-volley-wall') ?? byCardId.get('volley-punch-target') ?? fallback,
      fix: 'Shorten the touch and reset hands in front after every ball.',
    },
  ]

  return fixes.filter((item): item is NetConfidenceFixItem => Boolean(item.card))
}

function buildNetConfidenceReadinessChecks(): NetConfidenceReadinessItem[] {
  return [
    {
      label: 'Close',
      standard: 'You move through the approach instead of stopping at contact.',
      watch: 'If you freeze, start Short-Ball Close + Split.',
    },
    {
      label: 'Split',
      standard: 'You split before the opponent pass or feed, not after it.',
      watch: 'If the split is late, start Volley Ready Split.',
    },
    {
      label: 'Target',
      standard: 'You call the first-volley target before contact.',
      watch: 'If the target is blank, start Volley Punch Target.',
    },
    {
      label: 'Hands',
      standard: 'Your hands reset in front after every touch.',
      watch: 'If the swing gets big, start Reaction Volley Wall.',
    },
  ]
}

function buildNetConfidenceTargetMap(): NetConfidenceTargetItem[] {
  return [
    {
      target: 'Deep middle',
      useWhen: 'Use when the volley is rushed or the passers are balanced.',
      playerJob: 'Compact punch, take away the clean angle, recover forward.',
      proof: 'Score: target called before contact 0-5',
    },
    {
      target: 'Short angle',
      useWhen: 'Use when the feed is soft and you arrive balanced.',
      playerJob: 'Small punch, finish low, then cover the reply lane.',
      proof: 'Score: controlled angle, not over-hit 0-5',
    },
    {
      target: 'Behind',
      useWhen: 'Use when the opponent over-recovers or opens the hips early.',
      playerJob: 'Hold shape, punch behind the move, split for the next ball.',
      proof: 'Score: read plus compact contact 0-5',
    },
  ]
}

function buildNetConfidenceLiveBridge(): NetConfidenceLiveBridgeItem[] {
  return [
    {
      stage: '1. Feed',
      setup: 'Coach or partner feeds the approach and a predictable first volley.',
      score: 'Score close, split, target call, compact contact.',
      moveOn: 'Move on after 6 of 8 reps are clean.',
    },
    {
      stage: '2. Read',
      setup: 'Feeder varies pass direction after the approach, but pace stays controlled.',
      score: 'Score whether you split before reading and choose the target early.',
      moveOn: 'Move on when the first volley has a clear job for two rounds.',
    },
    {
      stage: '3. Play',
      setup: 'Start the point with approach plus first volley, then play it out.',
      score: 'Score the first-volley decision, not whether you won the point.',
      moveOn: 'Repeat if the decision gets rushed; level up if proof stays 4+.',
    },
  ]
}

function buildNetConfidenceFeedMenu(): NetConfidenceFeedMenuItem[] {
  return [
    {
      feed: 'Predictable volley',
      feederJob: 'Feed the same first-volley height and direction for one round.',
      playerJob: 'Close, split, call target, punch compact.',
      proof: 'Use when timing is not clean yet.',
    },
    {
      feed: 'Two-lane pass',
      feederJob: 'Alternate controlled pass feeds: line or crosscourt.',
      playerJob: 'Split before the read and choose a useful first volley.',
      proof: 'Use when ready split needs pressure.',
    },
    {
      feed: 'Recover ball',
      feederJob: 'After the first volley, feed one more ball into open space.',
      playerJob: 'Recover before watching and be ready for the second touch.',
      proof: 'Use when the player wins the first touch but freezes after.',
    },
  ]
}

function buildNetConfidenceSoloReps(): NetConfidenceSoloRep[] {
  return [
    {
      rep: 'Shadow close + split',
      setup: 'Start at the service line, shadow an approach, close two steps, split, freeze.',
      playerJob: 'Say the target before the freeze: deep middle, short angle, or behind.',
      proof: 'Score: balanced split and target call 0-5',
    },
    {
      rep: 'Wall touch reset',
      setup: 'Use a wall for short volley touches from a balanced ready position.',
      playerJob: 'Touch, reset hands in front, recover one step after every ball.',
      proof: 'Score: quiet hands and reset 0-5',
    },
    {
      rep: 'Recover before look',
      setup: 'Shadow the first volley, recover forward, then turn to check the result.',
      playerJob: 'Train the sequence: contact, recover, then look.',
      proof: 'Score: recover before watching 0-5',
    },
  ]
}

function buildNetConfidencePressureGames(): NetConfidencePressureGame[] {
  return [
    {
      game: 'First Volley 7',
      setup: 'Play to 7 starting with an approach plus first volley.',
      winCondition: 'You only earn the point if the first volley had a called target.',
      proof: 'Track: target call before contact 0-5',
    },
    {
      game: 'No Watch Bonus',
      setup: 'Play approach points. After every volley, recover before watching the result.',
      winCondition: 'Earn a bonus point when close, split, volley, recover all happen.',
      proof: 'Track: recover after volley 0-5',
    },
    {
      game: 'Two-Volley Finish',
      setup: 'Start at net after a controlled approach. Opponent gets one pass attempt.',
      winCondition: 'Win by making the first volley useful and being ready for the second.',
      proof: 'Track: ready for next ball 0-5',
    },
  ]
}

function buildNetConfidenceMissDecoder(items: NetConfidenceLadderItem[]): NetConfidenceMissDecoderItem[] {
  const byCardId = new Map(items.map((item) => [item.card.id, item.card]))
  const fallback = items[0]?.card
  const misses = [
    {
      miss: 'Volley floated long',
      read: 'The swing got big or the target was late.',
      fix: 'Call target early, punch short, recover forward.',
      card: byCardId.get('volley-punch-target') ?? fallback,
    },
    {
      miss: 'Passed clean',
      read: 'The split was late or the close stopped short.',
      fix: 'Remove pace and score close plus split timing.',
      card: byCardId.get('volley-ready-split') ?? byCardId.get('short-ball-close-split') ?? fallback,
    },
    {
      miss: 'Stuck after contact',
      read: 'You watched the volley instead of preparing for the next ball.',
      fix: 'Recover after the volley before judging the result.',
      card: byCardId.get('approach-volley-close') ?? fallback,
    },
    {
      miss: 'Hands got loud',
      read: 'The volley became a swing instead of a compact touch.',
      fix: 'Reset hands in front after every touch.',
      card: byCardId.get('reaction-volley-wall') ?? byCardId.get('volley-punch-target') ?? fallback,
    },
  ]

  return misses.filter((item): item is NetConfidenceMissDecoderItem => Boolean(item.card))
}

function buildNetConfidenceTabGuides(items: NetConfidenceLadderItem[]): NetConfidenceTabGuide[] {
  const byCardId = new Map(items.map((item) => [item.card.id, item.card]))
  const fallbackCardId = items[0]?.card.id ?? 'short-ball-close-split'

  return [
    {
      tab: 'start',
      eyebrow: 'First choice',
      title: 'Build the net habit in order.',
      setup: 'Court space from baseline to service line. No feeder needed for the first round.',
      useWhen: 'You are not sure which net rep to run or confidence feels uneven.',
      doThis: 'Run the ladder from close to split to target call before playing points.',
      block: '3 rounds: close-only, split timing, then target call plus volley.',
      score: 'Close, split, target, compact contact 0-5.',
      moveOn: 'Go to Feed when 3 of 4 readiness checks are clean.',
      say: 'Close, split, target before I watch.',
      resetIf: 'You rush the volley before the split or target call.',
      proofAnchors: {
        low: 'You arrived late, split late, or skipped the target call.',
        mid: 'The sequence happened, but one piece was rushed or unclear.',
        high: 'Close, split, target, contact, and recover were clean.',
      },
      startCardId: byCardId.get('short-ball-close-split')?.id ?? fallbackCardId,
    },
    {
      tab: 'feed',
      eyebrow: 'With a partner',
      title: 'Ask for the feed that matches the miss.',
      setup: 'One feeder near the baseline or service line. Keep feeds controlled, not heroic.',
      useWhen: 'Someone can feed and you need controlled reps before live play.',
      doThis: 'Tell the feeder the exact ball, then score only the first-volley habit.',
      block: '8 predictable feeds, 8 two-lane reads, then 6 approach points.',
      score: '6 of 8 clean before adding pace or direction changes.',
      moveOn: 'Go to Compete when the target call stays early under variety.',
      say: 'Feed me one controlled ball, then make me read.',
      resetIf: 'The feeder adds pace before your first-volley habit is clean.',
      proofAnchors: {
        low: 'The feed exposed rushed feet or no target.',
        mid: 'You handled predictable feeds but lost clarity with variety.',
        high: 'You kept the same habit through predictable and varied feeds.',
      },
      startCardId: byCardId.get('approach-volley-close')?.id ?? fallbackCardId,
    },
    {
      tab: 'solo',
      eyebrow: 'Training alone',
      title: 'Get useful reps without a feeder.',
      setup: 'Wall, fence, or open court space. Use a quiet ball touch or shadow rep.',
      useWhen: 'You have a wall, open space, or five minutes before practice.',
      doThis: 'Shadow the close, freeze the split, say the target, then reset hands.',
      block: '5 shadow closes, 20 wall touches, 5 recover-before-look reps.',
      score: 'Balanced freeze and quiet hands 0-5.',
      moveOn: 'Go to Start or Feed when the body feels organized enough for balls.',
      say: 'Quiet hands, recover before I look.',
      resetIf: 'The wall touch turns into a swing or your feet stop.',
      proofAnchors: {
        low: 'Hands got big or the feet stopped after contact.',
        mid: 'The rep stayed controlled, but recovery timing was inconsistent.',
        high: 'Quiet hands, balanced feet, and recover-before-look stayed automatic.',
      },
      startCardId: byCardId.get('reaction-volley-wall')?.id ?? fallbackCardId,
    },
    {
      tab: 'compete',
      eyebrow: 'Add pressure',
      title: 'Make the net habit survive the score.',
      setup: 'One opponent or partner. Start every point from approach plus first volley.',
      useWhen: 'The mechanics are clean and you need it to hold up in points.',
      doThis: 'Play the game, but only reward points where the net habit happened.',
      block: 'Play one race to 7, then repeat the same game with a tighter proof rule.',
      score: 'Decision quality, not just point result 0-5.',
      moveOn: 'Keep competing if proof is 4+. Drop to Feed if the habit disappears.',
      say: 'I only count it if the habit shows up.',
      resetIf: 'You chase the point score and stop scoring the net habit.',
      proofAnchors: {
        low: 'Point score took over and the net habit disappeared.',
        mid: 'The habit showed up in some pressure points but leaked late.',
        high: 'The habit held while the point mattered.',
      },
      startCardId: byCardId.get('volley-punch-target')?.id ?? fallbackCardId,
    },
    {
      tab: 'fix',
      eyebrow: 'Fix the miss',
      title: 'Turn the last miss into the next rep.',
      setup: 'Use the last miss as the drill selector. Keep the next block to one correction.',
      useWhen: 'You know what broke: late split, big swing, no target, or watching.',
      doThis: 'Tap the miss, start the linked card, and keep the next block narrow.',
      block: 'Pick one miss, run 5 correction reps, then test it in 3 live points.',
      score: 'Did the fix change the next 5 reps? 0-5.',
      moveOn: 'Return to the tab where the miss showed up and retest.',
      say: 'One miss, one fix, five clean reps.',
      resetIf: 'You try to fix three things at once.',
      proofAnchors: {
        low: 'The same miss repeated and the fix was not clear.',
        mid: 'The fix helped, but only when the rep was slow or predictable.',
        high: 'The next live points showed the fix holding.',
      },
      startCardId: byCardId.get('volley-ready-split')?.id ?? fallbackCardId,
    },
  ]
}

function buildSessionBuilderPlan({
  minutes,
  focus,
  identityCards,
  filteredCards,
  quickWins,
  nextBestCard,
}: {
  minutes: number
  focus: SessionFocus
  identityCards: LevelUpCard[]
  filteredCards: LevelUpCard[]
  quickWins: LevelUpCard[]
  nextBestCard: LevelUpCard
}): SessionBuilderItem[] {
  const focusOption = sessionFocusOptions.find((option) => option.value === focus) ?? sessionFocusOptions[0]
  const pool = uniqueCards([nextBestCard, ...identityCards, ...filteredCards, ...quickWins])
  const targetCount = minutes <= 10 ? 2 : minutes <= 20 ? 3 : 4
  const maxCardMinutes = minutes <= 10 ? 10 : minutes <= 20 ? 12 : 18
  const labels = minutes <= 10
    ? ['Start clean', 'Score proof']
    : minutes <= 20
      ? ['Warm the habit', 'Train the rep', 'Score under intent']
      : ['Warm the habit', 'Train the rep', 'Add pressure', 'Score and save']

  const focusCards = pool.filter((card) => card.durationMinutes <= maxCardMinutes && tagsOverlap(card.tags, focusOption.tags))
  const warmUpCard = findSessionCard(pool, focusOption.tags, ['match-day', 'mobility', 'warm-up', 'light-feet', 'split-step'], maxCardMinutes)
  const coreCard = focusCards.find((card) => (
    card.id !== warmUpCard?.id
    && !card.tags.includes('pressure-reset')
    && !card.tags.includes('between-points')
  )) ?? focusCards[0] ?? nextBestCard
  const pressureCard = findSessionCard(pool, focusOption.tags, ['pressure-reset', 'between-points'], maxCardMinutes)
    ?? findSessionCard(pool, focusOption.tags, ['decision-quality'], maxCardMinutes)
  const quickProofCard = quickWins.find((card) => card.durationMinutes <= 10 && (tagsOverlap(card.tags, focusOption.tags) || card.id === nextBestCard.id))
  const longerFinishCard = focus === 'return'
    ? undefined
    : findSessionCard(pool, focusOption.tags, ['conditioning', 'posture-under-fatigue', 'match-day'], maxCardMinutes)

  const candidates = uniqueCards([warmUpCard, coreCard, pressureCard, quickProofCard, longerFinishCard, ...focusCards, nextBestCard])
    .filter((card) => card.durationMinutes <= maxCardMinutes)
    .slice(0, targetCount)

  return candidates.map((card, index) => ({
    label: labels[index] ?? 'Next useful rep',
    card,
    why: getSessionBuilderWhy(card, focusOption.label, labels[index] ?? 'Next useful rep'),
    cue: getSessionBuilderCue(card, labels[index] ?? 'Next useful rep'),
  }))
}

function buildServeTrainingCards() {
  const serveCardIds = [
    'serve-target-call',
    'second-serve-routine-reps',
    'serve-1-shadow',
    'serve-1-partner',
    'double-fault-reset',
    'serve-target-ladder',
    'towel-serve-flow',
    'serve-location-call',
  ]

  return serveCardIds
    .map((cardId) => LEVEL_UP_CARDS.find((card) => card.id === cardId))
    .filter(Boolean) as LevelUpCard[]
}

function buildCardsByIds(cardIds: string[]) {
  return cardIds
    .map((cardId) => LEVEL_UP_CARDS.find((card) => card.id === cardId))
    .filter(Boolean) as LevelUpCard[]
}

function buildFocusTrainingLanes({
  serveTrainingModule,
  returnTrainingModule,
  serveCards,
  returnCards,
  movementCards,
  forehandCards,
  backhandCards,
  volleyCards,
  singlesCards,
  doublesCards,
  lanePriority,
}: {
  serveTrainingModule?: LevelUpModule
  returnTrainingModule?: LevelUpModule
  serveCards: LevelUpCard[]
  returnCards: LevelUpCard[]
  movementCards: LevelUpCard[]
  forehandCards: LevelUpCard[]
  backhandCards: LevelUpCard[]
  volleyCards: LevelUpCard[]
  singlesCards: LevelUpCard[]
  doublesCards: LevelUpCard[]
  lanePriority?: string[]
}): FocusTrainingLane[] {
  const lanes = [
    {
      key: 'serve',
      ariaLabel: 'Serve Training',
      eyebrow: 'Serve Training',
      title: 'Serve with a job, not hope.',
      copy: 'Call the target, run the same routine, connect the first ball, then score the proof.',
      module: serveTrainingModule,
      cards: serveCards,
      groups: buildServeTrainingGroups(serveCards),
      station: buildServeTrainingStation(serveCards),
      coachingCue: 'Good serve work is not just baskets. It is target, routine, recovery, then the plus-one decision.',
      defaultOpen: true,
    },
    {
      key: 'return',
      ariaLabel: 'Return Training',
      eyebrow: 'Return Training',
      title: 'Start the point on purpose.',
      copy: 'Pick the return job before the toss, make contact with a plan, then recover for ball two.',
      module: returnTrainingModule,
      cards: returnCards,
      groups: buildReturnTrainingGroups(returnCards),
      station: buildReturnTrainingStation(returnCards),
      coachingCue: 'Good return work is not just making the serve back. It is job, contact, recovery, then the next decision.',
      defaultOpen: true,
    },
    {
      key: 'movement',
      ariaLabel: 'Movement Training',
      eyebrow: 'Movement Training',
      title: 'Arrive balanced, recover sooner.',
      copy: 'Train split step, first move, recovery after contact, and wide-ball reset with tennis posture.',
      cards: movementCards,
      groups: buildMovementTrainingGroups(movementCards),
      station: buildMovementTrainingStation(movementCards),
      coachingCue: 'Good movement work is not max speed. It is clean arrival, balanced contact, and recovery before watching.',
    },
    {
      key: 'forehand',
      ariaLabel: 'Forehand Training',
      eyebrow: 'Forehand Training',
      title: 'Build the forehand before you blast it.',
      copy: 'Use shape, margin, recovery, and the right attack decision so the forehand becomes a point pattern.',
      cards: forehandCards,
      groups: buildForehandTrainingGroups(forehandCards),
      station: buildForehandTrainingStation(forehandCards),
      coachingCue: 'Good forehand work has a ball shape, a recovery lane, and a decision before speed.',
    },
    {
      key: 'backhand',
      ariaLabel: 'Backhand Training',
      eyebrow: 'Backhand Training',
      title: 'Make the backhand hold up.',
      copy: 'Build crosscourt tolerance, depth, spacing, and recovery so the backhand can start or extend points.',
      cards: backhandCards,
      groups: buildBackhandTrainingGroups(backhandCards),
      station: buildBackhandTrainingStation(backhandCards),
      coachingCue: 'Good backhand work is not surviving. It is spacing, shape, depth, and recovery you can repeat.',
    },
    {
      key: 'volley',
      ariaLabel: 'Volley Training',
      eyebrow: 'Volley Training',
      title: 'Close, split, finish simple.',
      copy: 'Train ready split, compact contact, target choice, and approach-volley connection.',
      cards: volleyCards,
      groups: buildVolleyTrainingGroups(volleyCards),
      station: buildVolleyTrainingStation(volleyCards),
      coachingCue: 'Good volley work is close, split, quiet hands, target. Big swings usually mean the setup was late.',
    },
    {
      key: 'singles',
      ariaLabel: 'Singles Training',
      eyebrow: 'Singles Training',
      title: 'Win the rally job in front of you.',
      copy: 'Build crosscourt tolerance, defense-to-neutral, pressure points, and reset routines for singles.',
      cards: singlesCards,
      groups: buildSinglesTrainingGroups(singlesCards),
      station: buildSinglesTrainingStation(singlesCards),
      coachingCue: 'Good singles work connects the shot to the point job: build, defend, attack, or reset.',
    },
    {
      key: 'doubles',
      ariaLabel: 'Doubles Training',
      eyebrow: 'Doubles Training',
      title: 'Make your partner faster.',
      copy: 'Use short calls, first moves, poach timing, middle ownership, and pressure clarity.',
      cards: doublesCards,
      groups: buildDoublesTrainingGroups(doublesCards),
      station: buildDoublesTrainingStation(doublesCards),
      coachingCue: 'Good doubles work makes the first move visible. Your partner should not have to guess.',
    },
  ]

  return orderFocusTrainingLanes(lanes, lanePriority)
}

function orderFocusTrainingLanes(lanes: FocusTrainingLane[], lanePriority: string[] = []) {
  if (!lanePriority.length) return lanes

  const rank = new Map(lanePriority.map((key, index) => [key, index]))
  return [...lanes].sort((left, right) => (
    (rank.get(left.key) ?? lanePriority.length + lanes.indexOf(left))
    - (rank.get(right.key) ?? lanePriority.length + lanes.indexOf(right))
  ))
}

function buildServeTrainingGroups(serveCards: LevelUpCard[]): FocusTrainingGroup[] {
  const byId = new Map(serveCards.map((card) => [card.id, card]))

  return [
    {
      label: 'Target call',
      card: byId.get('serve-target-call') ?? byId.get('serve-target-ladder'),
      cue: 'Choose wide, body, or T before every rep.',
    },
    {
      label: 'Second serve',
      card: byId.get('second-serve-routine-reps') ?? byId.get('double-fault-reset'),
      cue: 'Score routine commitment separately from makes.',
    },
    {
      label: 'Serve +1',
      card: byId.get('serve-1-shadow') ?? byId.get('serve-1-partner'),
      cue: 'Serve target creates the first-ball job.',
    },
    {
      label: 'Pressure reset',
      card: byId.get('double-fault-reset') ?? byId.get('serve-target-call'),
      cue: 'Reset after the miss, then repeat the same target routine.',
    },
  ]
}

function buildReturnTrainingGroups(returnCards: LevelUpCard[]): FocusTrainingGroup[] {
  const byId = new Map(returnCards.map((card) => [card.id, card]))

  return [
    {
      label: 'Solo read',
      card: byId.get('return-shadow-split-read') ?? byId.get('wall-return-recovery'),
      cue: 'Call the job, split on contact, recover after the shadow return.',
    },
    {
      label: 'Partner depth',
      card: byId.get('return-depth-lane') ?? byId.get('return-plus-one-recover'),
      cue: 'Choose the lane first, then recover before judging the result.',
    },
    {
      label: 'Pressure reps',
      card: byId.get('return-30-30-game') ?? byId.get('second-serve-attack-or-build'),
      cue: 'Start at 30-30 and keep the return job clear.',
    },
    {
      label: 'Doubles start',
      card: byId.get('doubles-return-first-move'),
      cue: 'Return lane and partner first move are both called before the serve.',
    },
  ]
}

function buildMovementTrainingGroups(cards: LevelUpCard[]): FocusTrainingGroup[] {
  const byId = new Map(cards.map((card) => [card.id, card]))

  return [
    { label: 'Recover after contact', card: byId.get('cone-recover-shadow-swing'), cue: 'Finish the swing, recover, then look.' },
    { label: 'Split rhythm', card: byId.get('split-step-rhythm') ?? byId.get('jump-rope-rhythm-builder'), cue: 'Split before the next move, not after it.' },
    { label: 'Wide-ball reset', card: byId.get('wide-ball-neutralizer'), cue: 'Buy time with height, then recover to neutral.' },
    { label: 'Cone movement', card: byId.get('four-cone-tennis-star') ?? byId.get('drop-step-recovery'), cue: 'Move with tennis posture before adding speed.' },
  ]
}

function buildReturnTrainingStation(returnCards: LevelUpCard[]): FocusTrainingStation {
  const byId = new Map(returnCards.map((card) => [card.id, card]))
  const fallbackCardId = returnCards[0]?.id ?? 'return-shadow-split-read'

  return {
    label: 'Return station',
    tabs: [
      {
        key: 'start',
        label: 'Start',
        detail: 'Intent + split',
        title: 'Choose the return job before the toss.',
        setup: 'No partner needed. Use a wall, open court, or shadow split-read reps.',
        block: '3 rounds: call the job, split on toss/contact, shadow return, recover for ball two.',
        score: 'Return job chosen early and recovery after contact 0-5.',
        say: 'Job first, contact second, recover third.',
        resetIf: 'You wait to decide until the ball is already on you.',
        startCardId: byId.get('return-shadow-split-read')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'You reacted late or did not name a return job.',
          mid: 'The job was clear on some reps, but recovery lagged.',
          high: 'Intent, contact, and recovery were connected before ball two.',
        },
      },
      {
        key: 'serve-type',
        label: 'Serve Type',
        detail: 'First or second',
        title: 'Match the return shape to the serve.',
        setup: 'Partner serves controlled first and second serves, or feeds serve-like balls.',
        block: '8 first-serve survival returns, 8 second-serve attack/build returns, then 6 mixed calls.',
        score: 'Serve read and return shape matched 0-5.',
        say: 'First serve: make it playable. Second serve: choose attack, build, or neutral.',
        resetIf: 'You swing the same way at every serve.',
        startCardId: byId.get('second-serve-attack-or-build')?.id ?? byId.get('return-depth-lane')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Serve type did not change the return decision.',
          mid: 'You adjusted sometimes, but the contact plan was late.',
          high: 'Serve type, return shape, and recovery matched repeatedly.',
        },
      },
      {
        key: 'partner',
        label: 'Partner',
        detail: 'Depth + ball two',
        title: 'Return to a lane and be ready for the next ball.',
        setup: 'Partner serves or feeds. Name crosscourt deep, middle deep, or high neutral.',
        block: '3 rounds of 8 returns. Count only lane plus recovery, not pretty contact.',
        score: 'Lane and ball-two readiness 0-5.',
        say: 'Lane, recover, first move.',
        resetIf: 'You admire the return instead of getting ready.',
        startCardId: byId.get('return-depth-lane')?.id ?? byId.get('return-plus-one-recover')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'The ball came back but the next move was late.',
          mid: 'Lane showed up, but recovery was inconsistent.',
          high: 'Return lane and ball-two readiness were repeatable.',
        },
      },
      {
        key: 'pressure',
        label: 'Pressure',
        detail: '30-30 reps',
        title: 'Keep the return job clear when the point matters.',
        setup: 'Play short games starting at 30-30 or return-only mini points.',
        block: 'Play 6 pressure returns, reset, then repeat with the same job rule.',
        score: 'Return intent under pressure 0-5.',
        say: 'The score does not choose my return job.',
        resetIf: 'You abandon the plan after one miss.',
        startCardId: byId.get('return-30-30-game')?.id ?? byId.get('second-serve-attack-or-build')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'The score made the return rushed or vague.',
          mid: 'Intent appeared, but disappeared after misses.',
          high: 'The return job stayed clear through 30-30 pressure.',
        },
      },
      {
        key: 'fix',
        label: 'Fix a Miss',
        detail: 'Last miss',
        title: 'Turn the missed return into one correction.',
        setup: 'Pick one miss: late split, no lane, rushed swing, or no recovery.',
        block: 'Run 5 correction reps, then test with 3 mixed serve-like balls.',
        score: 'Did the miss change in the next block? 0-5.',
        say: 'One return miss, one fix, next ball ready.',
        resetIf: 'You try to fix swing, footwork, and target all at once.',
        startCardId: byId.get('wall-return-recovery')?.id ?? byId.get('return-shadow-split-read')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'The same miss repeated without a clearer plan.',
          mid: 'The correction worked only on predictable reps.',
          high: 'The correction held when the serve look changed.',
        },
      },
    ],
  }
}

function buildServeTrainingStation(serveCards: LevelUpCard[]): FocusTrainingStation {
  const byId = new Map(serveCards.map((card) => [card.id, card]))
  const fallbackCardId = serveCards[0]?.id ?? 'serve-target-call'

  return {
    label: 'Serve station',
    tabs: [
      {
        key: 'routine',
        label: 'Routine',
        detail: 'Same start',
        title: 'Make the serve routine repeatable before chasing pace.',
        setup: 'Basket or shadow reps. Pick one target and one breath pattern.',
        block: '3 sets of 6 serves: target call, breath, bounce tempo, serve, score clarity.',
        score: 'Routine clarity before and after misses 0-5.',
        say: 'Same breath, same target, same tempo.',
        resetIf: 'The routine changes after a miss.',
        startCardId: byId.get('serve-target-call')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Target and routine changed under frustration.',
          mid: 'Routine appeared, but only when the ball was going in.',
          high: 'Routine stayed the same across makes and misses.',
        },
      },
      {
        key: 'targets',
        label: 'Targets',
        detail: 'Wide/body/T',
        title: 'Serve to a job, not just into the box.',
        setup: 'Basket plus three target zones: wide, body, and T.',
        block: 'Call target before every serve. Run 5 reps per target, then 6 mixed calls.',
        score: 'Target called before motion and shape matched intent 0-5.',
        say: 'Target first, motion second.',
        resetIf: 'You serve before naming the target.',
        startCardId: byId.get('serve-target-ladder')?.id ?? byId.get('serve-target-call')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Target was vague or changed mid-motion.',
          mid: 'Target was clear, but shape was inconsistent.',
          high: 'Target call and serve shape matched repeatedly.',
        },
      },
      {
        key: 'plus-one',
        label: 'Serve +1',
        detail: 'First ball',
        title: 'Connect the serve target to the first-ball job.',
        setup: 'Shadow at home or use a partner. Name the serve target and plus-one lane.',
        block: '10 shadow patterns, then 8 serve-plus-one reps if you have a partner.',
        score: 'Serve target created a clear first-ball job 0-5.',
        say: 'Serve creates the next ball.',
        resetIf: 'The plus-one plan is blank after the serve.',
        startCardId: byId.get('serve-1-shadow')?.id ?? byId.get('serve-1-partner')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Serve and first ball were disconnected.',
          mid: 'The pattern connected on some targets.',
          high: 'Target and plus-one lane were connected before the serve.',
        },
      },
      {
        key: 'pressure',
        label: 'Pressure',
        detail: 'Second serve',
        title: 'Keep the routine when the miss feels expensive.',
        setup: 'Use second-serve reps or score games starting after a missed first serve.',
        block: 'Run 12 second serves. After every miss, repeat the same target routine.',
        score: 'Second-serve routine under pressure 0-5.',
        say: 'Miss, reset, same routine.',
        resetIf: 'You rush the next serve after a miss.',
        startCardId: byId.get('second-serve-routine-reps')?.id ?? byId.get('double-fault-reset')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'The miss changed tempo or target clarity.',
          mid: 'Reset worked sometimes, but tension changed the motion.',
          high: 'The next serve kept the same breath, target, and tempo.',
        },
      },
      {
        key: 'fix',
        label: 'Fix a Miss',
        detail: 'Last miss',
        title: 'Make one serve correction at a time.',
        setup: 'Pick one miss pattern: no target, rushed tempo, fear of second serve, or no plus-one.',
        block: 'Run 5 correction reps, then 5 scored reps with the same rule.',
        score: 'Did the miss pattern change? 0-5.',
        say: 'One serve miss, one correction.',
        resetIf: 'You change grip, target, tempo, and swing at the same time.',
        startCardId: byId.get('double-fault-reset')?.id ?? byId.get('serve-target-call')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'The same miss repeated with no simpler rule.',
          mid: 'The fix helped when the score was quiet.',
          high: 'The fix held when you added pressure back.',
        },
      },
    ],
  }
}

function buildMovementTrainingStation(movementCards: LevelUpCard[]): FocusTrainingStation {
  const byId = new Map(movementCards.map((card) => [card.id, card]))
  const fallbackCardId = movementCards[0]?.id ?? 'cone-recover-shadow-swing'

  return {
    label: 'Movement station',
    tabs: [
      {
        key: 'warm-up',
        label: 'Warm Up',
        detail: 'Split rhythm',
        title: 'Turn on rhythm before speed.',
        setup: 'Open court, driveway, or home space. No max effort.',
        block: '2 minutes rhythm, 10 split freezes, 6 shadow first moves each side.',
        score: 'Split timing and posture readiness 0-5.',
        say: 'Quiet split, ready body.',
        resetIf: 'You get fast before you get balanced.',
        startCardId: byId.get('split-step-rhythm')?.id ?? byId.get('jump-rope-rhythm-builder')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Split timing was late or posture got tall.',
          mid: 'Rhythm appeared, but only when the rep was slow.',
          high: 'Split timing felt ready before the first move.',
        },
      },
      {
        key: 'first-step',
        label: 'First Step',
        detail: 'Go clean',
        title: 'Make the first move clean before making it fast.',
        setup: 'Use two cones or lines. Start in tennis posture.',
        block: '3 rounds of 6 first moves: split, push, stick balance, reset.',
        score: 'First-step readiness and balance 0-5.',
        say: 'Split, push, stick.',
        resetIf: 'The first step crosses over late or the chest pops up.',
        startCardId: byId.get('four-cone-tennis-star')?.id ?? byId.get('lateral-decel-stick')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'First step was late or off balance.',
          mid: 'First move improved, but balance leaked on one side.',
          high: 'First move and stop were controlled both directions.',
        },
      },
      {
        key: 'recover',
        label: 'Recover',
        detail: 'After contact',
        title: 'Recover before watching the result.',
        setup: 'Use cones or court lines. Add a shadow swing or real ball.',
        block: '10 reps: contact, recover to ready, then look. Repeat with a target score.',
        score: 'Recovery after contact 0-5.',
        say: 'Contact, recover, then look.',
        resetIf: 'You watch the shot before moving back to ready.',
        startCardId: byId.get('cone-recover-shadow-swing')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'You watched first or never found ready again.',
          mid: 'Recovery happened with reminders.',
          high: 'Recovery happened before watching without a reminder.',
        },
      },
      {
        key: 'wide-ball',
        label: 'Wide Ball',
        detail: 'Defense to neutral',
        title: 'Use the wide ball to buy time, not panic.',
        setup: 'Use cones or a partner feed. Keep the first rounds controlled.',
        block: '3 rounds of 6: move wide, play height or depth, recover to neutral.',
        score: 'Wide-ball reset quality 0-5.',
        say: 'Buy time, recover neutral.',
        resetIf: 'You try to attack from a defensive body position.',
        startCardId: byId.get('wide-ball-neutralizer')?.id ?? byId.get('drop-step-recovery')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Wide ball created panic or rushed attack.',
          mid: 'You bought time on some balls but recovery was late.',
          high: 'Defense, height/depth, and recovery returned you to neutral.',
        },
      },
      {
        key: 'fatigue',
        label: 'Fatigue',
        detail: 'Quality late',
        title: 'Keep posture when the legs get tired.',
        setup: 'Short work blocks only. Stop if pain changes movement.',
        block: '20-30 seconds work, 20 seconds reset, 3 rounds with a tennis cue.',
        score: 'Posture and decision under fatigue 0-5.',
        say: 'Slow enough to stay useful.',
        resetIf: 'Speed changes posture, balance, or breathing.',
        startCardId: byId.get('jump-rope-rhythm-builder')?.id ?? byId.get('lateral-decel-stick')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Fatigue changed posture or movement quality quickly.',
          mid: 'Quality held for part of the block.',
          high: 'Posture, breath, and tennis decision stayed playable.',
        },
      },
    ],
  }
}

function buildForehandTrainingStation(cards: LevelUpCard[]): FocusTrainingStation {
  const byId = new Map(cards.map((card) => [card.id, card]))
  const fallbackCardId = cards[0]?.id ?? 'basket-forehand-crosscourt'

  return {
    label: 'Forehand station',
    tabs: [
      {
        key: 'shape',
        label: 'Shape',
        detail: 'Margin first',
        title: 'Build forehand shape before adding pace.',
        setup: 'Basket, partner feed, wall, or shadow reps. Pick crosscourt as the first lane.',
        block: '3 rounds of 8: shape with margin, finish balanced, recover, then call ready.',
        score: 'Forehand shape, balance, and recovery 0-5.',
        say: 'Shape first, speed second.',
        resetIf: 'You swing harder to solve a spacing or balance problem.',
        startCardId: byId.get('basket-forehand-crosscourt')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Forehand contact was rushed, flat, or off balance.',
          mid: 'Shape showed up, but recovery or spacing leaked.',
          high: 'Shape, balance, and recovery repeated without forcing pace.',
        },
      },
      {
        key: 'build',
        label: 'Build',
        detail: 'Crosscourt job',
        title: 'Earn the direction change with crosscourt control.',
        setup: 'Partner rally, wall rhythm, or target cones. Start with a big safe lane.',
        block: 'Play 3 rallies to 6 crosscourt balls before any change of direction.',
        score: 'Crosscourt build patience and quality 0-5.',
        say: 'Build before I change.',
        resetIf: 'You change direction because you are bored, not balanced.',
        startCardId: byId.get('crosscourt-consistency')?.id ?? byId.get('wall-rally-rhythm')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Direction changed early or the crosscourt ball lacked shape.',
          mid: 'You built some rallies but rushed the change.',
          high: 'Crosscourt pressure created the right ball to change.',
        },
      },
      {
        key: 'decision',
        label: 'Decision',
        detail: 'Defense/neutral/attack',
        title: 'Let the body position choose the forehand job.',
        setup: 'Partner feeds mixed balls or you shadow three body positions.',
        block: 'Call defense, neutral, or attack before 12 forehands. Score the call, not the winner.',
        score: 'Forehand decision quality 0-5.',
        say: 'My body tells me the job.',
        resetIf: 'You attack from a defensive or stretched position.',
        startCardId: byId.get('defense-neutral-attack-rally')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Shot choice ignored balance or contact height.',
          mid: 'The call was right sometimes, but late under pace.',
          high: 'Forehand job matched body position repeatedly.',
        },
      },
      {
        key: 'close',
        label: 'Close',
        detail: 'Short ball',
        title: 'Move through the short forehand and split after it.',
        setup: 'Partner feeds short balls or use a cone close pattern.',
        block: '10 reps: read short, close through contact, recover or split inside the court.',
        score: 'Short-ball close and post-contact readiness 0-5.',
        say: 'Close, hit, split.',
        resetIf: 'You stop at contact or watch the shot after moving forward.',
        startCardId: byId.get('short-ball-close-split')?.id ?? byId.get('cone-close-recover')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'You arrived late or stopped moving after contact.',
          mid: 'Close timing improved but the split was late.',
          high: 'Close, contact, and split connected as one habit.',
        },
      },
      {
        key: 'fix',
        label: 'Fix a Miss',
        detail: 'One leak',
        title: 'Turn the last forehand miss into one useful rep.',
        setup: 'Pick one leak: late spacing, no shape, rushed attack, or no recovery.',
        block: 'Run 5 correction reps, then test with 5 mixed forehands.',
        score: 'Did the forehand leak change? 0-5.',
        say: 'One miss, one forehand job.',
        resetIf: 'You try to fix swing path, target, footwork, and pace together.',
        startCardId: byId.get('wall-rally-rhythm')?.id ?? byId.get('basket-forehand-crosscourt')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'The same miss repeated without a cleaner cue.',
          mid: 'The fix worked on predictable reps only.',
          high: 'The fix held when the ball changed slightly.',
        },
      },
    ],
  }
}

function buildBackhandTrainingStation(cards: LevelUpCard[]): FocusTrainingStation {
  const byId = new Map(cards.map((card) => [card.id, card]))
  const fallbackCardId = cards[0]?.id ?? 'basket-backhand-crosscourt'

  return {
    label: 'Backhand station',
    tabs: [
      {
        key: 'shape',
        label: 'Shape',
        detail: 'Height + depth',
        title: 'Use height and depth to make the backhand playable.',
        setup: 'Basket, wall, or partner feed. Pick a safe crosscourt window.',
        block: '3 rounds of 8: shape, depth, recover. Count only balls with playable margin.',
        score: 'Backhand height, depth, and recovery 0-5.',
        say: 'Depth buys time.',
        resetIf: 'You flatten the ball because the rally feels uncomfortable.',
        startCardId: byId.get('basket-backhand-crosscourt')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Backhands were short, rushed, or off balance.',
          mid: 'Height appeared, but depth or recovery was uneven.',
          high: 'Height, depth, and recovery kept the rally stable.',
        },
      },
      {
        key: 'hold',
        label: 'Hold',
        detail: 'Crosscourt',
        title: 'Hold the crosscourt backhand until you are balanced.',
        setup: 'Partner rally or wall target. Stay crosscourt until the proof is clean.',
        block: 'Play 4 mini-rallies: 5 crosscourt backhands before any direction change.',
        score: 'Crosscourt tolerance and patience 0-5.',
        say: 'Hold the lane until I earn more.',
        resetIf: 'You escape down the line from discomfort instead of balance.',
        startCardId: byId.get('crosscourt-consistency')?.id ?? byId.get('wall-depth-builder')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'You left the crosscourt job early or lost depth.',
          mid: 'Tolerance improved but broke under pressure.',
          high: 'Crosscourt depth stayed stable until the right ball appeared.',
        },
      },
      {
        key: 'spacing',
        label: 'Spacing',
        detail: 'Wall rhythm',
        title: 'Fix spacing before judging the backhand swing.',
        setup: 'Wall or shadow reps. Mark a recovery spot and contact window.',
        block: '20 wall touches or shadow reps: spacing, contact, reset feet.',
        score: 'Backhand spacing and contact rhythm 0-5.',
        say: 'Feet solve the swing first.',
        resetIf: 'You reach, crowd, or skip the foot reset.',
        startCardId: byId.get('wall-alternating-fh-bh')?.id ?? byId.get('wall-depth-builder')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Spacing caused reaches, jams, or late contact.',
          mid: 'Spacing improved when the ball was predictable.',
          high: 'Feet adjusted early enough for clean contact rhythm.',
        },
      },
      {
        key: 'defend',
        label: 'Defend',
        detail: 'Wide reset',
        title: 'Defend with shape, then recover to neutral.',
        setup: 'Partner feeds wide or use shadow drop-step reps.',
        block: '3 rounds of 6: move wide, play high/deep, recover, call neutral.',
        score: 'Backhand defense-to-neutral quality 0-5.',
        say: 'High, deep, recover.',
        resetIf: 'You try to win from a stretched backhand.',
        startCardId: byId.get('wide-ball-neutralizer')?.id ?? byId.get('drop-step-recovery')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Wide backhands became panic shots.',
          mid: 'You bought time but recovery was late.',
          high: 'Wide backhand shape returned you to neutral.',
        },
      },
      {
        key: 'fix',
        label: 'Fix a Miss',
        detail: 'One leak',
        title: 'Choose one backhand leak and train the next rep.',
        setup: 'Pick one leak: short ball, late spacing, rushed line change, or no recovery.',
        block: '5 correction reps, then 5 mixed backhands with the same cue.',
        score: 'Did the backhand leak change? 0-5.',
        say: 'One backhand leak, one cue.',
        resetIf: 'You make the correction too technical to repeat on court.',
        startCardId: byId.get('wall-depth-builder')?.id ?? byId.get('basket-backhand-crosscourt')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'The same leak repeated without cleaner intent.',
          mid: 'The fix worked only when the feed was easy.',
          high: 'The fix stayed simple and held in mixed reps.',
        },
      },
    ],
  }
}

function buildVolleyTrainingStation(cards: LevelUpCard[]): FocusTrainingStation {
  const byId = new Map(cards.map((card) => [card.id, card]))
  const fallbackCardId = cards[0]?.id ?? 'volley-ready-split'

  return {
    label: 'Volley station',
    tabs: [
      {
        key: 'ready',
        label: 'Ready',
        detail: 'Close + split',
        title: 'Earn the volley with a ready split.',
        setup: 'Start near the service line. Use shadow reps or controlled feeds.',
        block: '3 rounds: close two steps, split, freeze, reset hands in front.',
        score: 'Close timing and ready split 0-5.',
        say: 'Close, split, ready.',
        resetIf: 'You hit before you are split and balanced.',
        startCardId: byId.get('volley-ready-split')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Split was late or body was still moving through contact.',
          mid: 'Ready split appeared on predictable reps.',
          high: 'Close and split were clean before the volley decision.',
        },
      },
      {
        key: 'target',
        label: 'Target',
        detail: 'Punch simple',
        title: 'Give the volley a target before the hands move.',
        setup: 'Partner feeds controlled balls. Choose deep middle, short angle, or behind.',
        block: '8 predictable volleys, then 8 mixed target calls before contact.',
        score: 'Volley target clarity and compact contact 0-5.',
        say: 'Target first, punch short.',
        resetIf: 'The swing gets big because the target was late.',
        startCardId: byId.get('volley-punch-target')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Volley had no target or the hands got loud.',
          mid: 'Target was clear, but contact grew under pace.',
          high: 'Target and compact punch repeated under mixed feeds.',
        },
      },
      {
        key: 'approach',
        label: 'Approach',
        detail: 'First volley',
        title: 'Connect approach, close, split, and first volley.',
        setup: 'Partner feeds approach balls or shadow the pattern without a ball.',
        block: '10 sequences: approach, close, split, call first-volley target, recover forward.',
        score: 'Approach-to-volley connection 0-5.',
        say: 'Approach creates the first volley.',
        resetIf: 'You admire the approach shot instead of closing.',
        startCardId: byId.get('approach-volley-close')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Approach and volley felt like separate actions.',
          mid: 'You closed, but split or target was late.',
          high: 'Approach, close, split, and first volley connected.',
        },
      },
      {
        key: 'hands',
        label: 'Hands',
        detail: 'Wall reset',
        title: 'Keep the hands quiet and reset after every touch.',
        setup: 'Wall, fence, or partner toss. Stay close enough for compact contact.',
        block: '20 short touches: punch, reset hands, recover one step.',
        score: 'Quiet hands and reset rhythm 0-5.',
        say: 'Touch, reset, ready.',
        resetIf: 'The volley turns into a swing or hands drop after contact.',
        startCardId: byId.get('reaction-volley-wall')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Hands got big or failed to reset.',
          mid: 'Hands stayed quiet until the feed changed.',
          high: 'Quiet hands and reset stayed automatic.',
        },
      },
      {
        key: 'fix',
        label: 'Fix a Miss',
        detail: 'Next touch',
        title: 'Let the last volley miss pick the next correction.',
        setup: 'Pick one miss: late split, no target, big swing, or no recovery.',
        block: '5 correction reps, then 5 mixed volleys with the same cue.',
        score: 'Did the volley miss change? 0-5.',
        say: 'One volley miss, five clean touches.',
        resetIf: 'You try to fix every part of the volley at once.',
        startCardId: byId.get('reaction-volley-wall')?.id ?? byId.get('volley-ready-split')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'The same volley miss repeated.',
          mid: 'The fix worked only on easy feeds.',
          high: 'The correction showed up on mixed feeds.',
        },
      },
    ],
  }
}

function buildSinglesTrainingStation(cards: LevelUpCard[]): FocusTrainingStation {
  const byId = new Map(cards.map((card) => [card.id, card]))
  const fallbackCardId = cards[0]?.id ?? 'crosscourt-consistency'

  return {
    label: 'Singles station',
    tabs: [
      {
        key: 'build',
        label: 'Build',
        detail: 'Crosscourt',
        title: 'Use crosscourt to earn the next decision.',
        setup: 'Partner rally, wall, or target cones. Pick one rally lane.',
        block: '4 rallies: build crosscourt first, then call hold, change, attack, or reset.',
        score: 'Rally job clarity and crosscourt quality 0-5.',
        say: 'Build, then choose.',
        resetIf: 'You change direction before the rally gives permission.',
        startCardId: byId.get('crosscourt-consistency')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Point job was vague or direction changed early.',
          mid: 'Build pattern appeared but decisions were late.',
          high: 'Crosscourt build created clear next decisions.',
        },
      },
      {
        key: 'dna',
        label: 'D/N/A',
        detail: 'Point job',
        title: 'Name defense, neutral, or attack before the swing.',
        setup: 'Partner feeds mixed balls or rally with a call before contact.',
        block: '12 balls: call defense, neutral, or attack, then play the matching ball.',
        score: 'Defense-neutral-attack decision quality 0-5.',
        say: 'Name the job, then swing.',
        resetIf: 'You attack because of emotion instead of court position.',
        startCardId: byId.get('defense-neutral-attack-rally')?.id ?? byId.get('wide-ball-neutralizer')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Shot choice did not match the ball or body position.',
          mid: 'Calls were useful but late under pace.',
          high: 'The job call matched the ball repeatedly.',
        },
      },
      {
        key: 'pressure',
        label: 'Pressure',
        detail: '30-30',
        title: 'Keep the point plan clear at 30-30.',
        setup: 'Play mini games starting at 30-30. Pick one first-ball plan.',
        block: 'Play 6 pressure points, reset, then repeat the same point-plan rule.',
        score: 'Point-plan clarity under pressure 0-5.',
        say: 'The score does not pick my shot.',
        resetIf: 'You abandon the plan after one miss or tight point.',
        startCardId: byId.get('30-30-pressure-game')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Pressure made the point plan disappear.',
          mid: 'Plan held for some points but changed after misses.',
          high: 'The plan stayed clear through pressure points.',
        },
      },
      {
        key: 'reset',
        label: 'Reset',
        detail: 'Between points',
        title: 'Reset before the next point chooses you.',
        setup: 'Use any practice set, tiebreak, or point game.',
        block: 'After every point: breathe, name the next job, commit before the serve or return.',
        score: 'Between-point reset used 0-5.',
        say: 'Breathe, choose, commit.',
        resetIf: 'The last point is still deciding the next one.',
        startCardId: byId.get('three-step-reset')?.id ?? byId.get('closing-game-routine')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'No reset happened after misses or wins.',
          mid: 'Reset happened with reminders.',
          high: 'Reset happened automatically before the next point.',
        },
      },
      {
        key: 'fix',
        label: 'Fix a Miss',
        detail: 'Pattern leak',
        title: 'Fix the singles pattern, not just the last shot.',
        setup: 'Pick one leak: changed too early, attacked late, defended too low, or skipped reset.',
        block: 'Run 5 correction reps, then play 3 live points with the same rule.',
        score: 'Did the pattern leak change? 0-5.',
        say: 'One pattern leak, one rule.',
        resetIf: 'You blame the stroke when the point job was unclear.',
        startCardId: byId.get('defense-neutral-attack-rally')?.id ?? byId.get('three-step-reset')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'The same pattern leak repeated.',
          mid: 'The fix worked in reps but not live points.',
          high: 'The new rule changed the next live points.',
        },
      },
    ],
  }
}

function buildDoublesTrainingStation(cards: LevelUpCard[]): FocusTrainingStation {
  const byId = new Map(cards.map((card) => [card.id, card]))
  const fallbackCardId = cards[0]?.id ?? 'serve-location-call'

  return {
    label: 'Doubles station',
    tabs: [
      {
        key: 'serve-call',
        label: 'Serve Call',
        detail: 'Location + partner',
        title: 'Connect serve location to your partner first move.',
        setup: 'Server and partner agree on wide, body, or T plus partner action.',
        block: '12 serves or shadow starts: call location, partner move, cover the next lane.',
        score: 'Serve location and partner readiness 0-5.',
        say: 'Location creates movement.',
        resetIf: 'Your partner cannot tell what your serve is trying to create.',
        startCardId: byId.get('serve-location-call')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Serve location and partner move were disconnected.',
          mid: 'Calls were clear but coverage was late.',
          high: 'Serve, partner move, and coverage connected repeatedly.',
        },
      },
      {
        key: 'first-move',
        label: 'First Move',
        detail: 'Before live',
        title: 'Say the first move before the ball is live.',
        setup: 'Both players call first move before serve or return. Keep calls short.',
        block: '10 starts: call first move, play the first two balls, then reset.',
        score: 'Partner first-move clarity 0-5.',
        say: 'Call it before we need it.',
        resetIf: 'Both players wait to see what happens before moving.',
        startCardId: byId.get('partner-first-move-call')?.id ?? byId.get('doubles-return-first-move')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'First move was unclear or late.',
          mid: 'One player knew the move, but coverage lagged.',
          high: 'Both players moved with the same first idea.',
        },
      },
      {
        key: 'poach',
        label: 'Poach',
        detail: 'Trigger',
        title: 'Poach on a trigger, not a guess.',
        setup: 'Agree on the trigger: weak return, floating crosscourt, or called serve location.',
        block: '8 shadow poaches, then 8 live starts where the trigger decides the move.',
        score: 'Poach timing and trigger discipline 0-5.',
        say: 'Trigger first, poach second.',
        resetIf: 'You poach because you are bored or stay because you are unsure.',
        startCardId: byId.get('poach-timing-shadow')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Poach timing was random or late.',
          mid: 'Trigger was clear but the first step hesitated.',
          high: 'Trigger and first step matched repeatedly.',
        },
      },
      {
        key: 'middle',
        label: 'Middle',
        detail: 'Own + switch',
        title: 'Own the middle and call the switch early.',
        setup: 'Start with middle-ball ownership rules, then add switch calls.',
        block: '10 middle balls: call mine/yours/switch early, then play the next ball.',
        score: 'Middle ownership and switch timing 0-5.',
        say: 'Early call, early cover.',
        resetIf: 'Both players hesitate or both chase the same ball.',
        startCardId: byId.get('middle-ball-rule')?.id ?? byId.get('switch-call-drill')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Middle balls caused hesitation or overlap.',
          mid: 'Calls happened, but late after movement started.',
          high: 'Middle and switch calls were early enough to organize coverage.',
        },
      },
      {
        key: 'pressure',
        label: 'Pressure',
        detail: '30-30',
        title: 'Keep doubles communication short under pressure.',
        setup: 'Play games starting at 30-30. Pick one call rule before every point.',
        block: 'Play 6 pressure points. Score the communication habit before the point result.',
        score: 'Doubles clarity at 30-30 0-5.',
        say: 'Short call, full commit.',
        resetIf: 'Pressure turns the team silent or overtalking.',
        startCardId: byId.get('doubles-30-30-game')?.id ?? byId.get('partner-first-move-call')?.id ?? fallbackCardId,
        proofAnchors: {
          low: 'Communication disappeared or got noisy under pressure.',
          mid: 'The call was made but not acted on consistently.',
          high: 'Short calls shaped first moves through pressure points.',
        },
      },
    ],
  }
}

function buildForehandTrainingGroups(cards: LevelUpCard[]): FocusTrainingGroup[] {
  const byId = new Map(cards.map((card) => [card.id, card]))

  return [
    { label: 'Crosscourt shape', card: byId.get('basket-forehand-crosscourt'), cue: 'Shape with margin, finish balanced, recover.' },
    { label: 'Rally build', card: byId.get('crosscourt-consistency'), cue: 'Build crosscourt before changing direction.' },
    { label: 'Attack decision', card: byId.get('defense-neutral-attack-rally'), cue: 'Name defense, neutral, or attack before the swing.' },
    { label: 'Close forward', card: byId.get('short-ball-close-split') ?? byId.get('cone-close-recover'), cue: 'Move through the short ball and split after.' },
  ]
}

function buildBackhandTrainingGroups(cards: LevelUpCard[]): FocusTrainingGroup[] {
  const byId = new Map(cards.map((card) => [card.id, card]))

  return [
    { label: 'Backhand shape', card: byId.get('basket-backhand-crosscourt'), cue: 'Use height and depth before going for more.' },
    { label: 'Crosscourt hold', card: byId.get('crosscourt-consistency'), cue: 'Stay in the crosscourt job until balanced.' },
    { label: 'Wall spacing', card: byId.get('wall-alternating-fh-bh') ?? byId.get('wall-depth-builder'), cue: 'Spacing first, then contact rhythm.' },
    { label: 'Defend neutral', card: byId.get('wide-ball-neutralizer') ?? byId.get('drop-step-recovery'), cue: 'Defend with shape and recover before changing.' },
  ]
}

function buildVolleyTrainingGroups(cards: LevelUpCard[]): FocusTrainingGroup[] {
  const byId = new Map(cards.map((card) => [card.id, card]))

  return [
    { label: 'Ready split', card: byId.get('volley-ready-split'), cue: 'Close, split, quiet hands.' },
    { label: 'Punch target', card: byId.get('volley-punch-target'), cue: 'Target first, punch short, recover forward.' },
    { label: 'Approach volley', card: byId.get('approach-volley-close'), cue: 'Approach, close, split, first volley.' },
    { label: 'Wall hands', card: byId.get('reaction-volley-wall'), cue: 'Short block, reset hands, stay balanced.' },
  ]
}

function buildSinglesTrainingGroups(cards: LevelUpCard[]): FocusTrainingGroup[] {
  const byId = new Map(cards.map((card) => [card.id, card]))

  return [
    { label: 'Crosscourt build', card: byId.get('crosscourt-consistency'), cue: 'Earn the change by building first.' },
    { label: 'Defense to neutral', card: byId.get('defense-neutral-attack-rally') ?? byId.get('wide-ball-neutralizer'), cue: 'Know when the job is survive, build, or attack.' },
    { label: 'Pressure game', card: byId.get('30-30-pressure-game'), cue: 'Start at 30-30 and keep the point plan clear.' },
    { label: 'Reset routine', card: byId.get('three-step-reset') ?? byId.get('closing-game-routine'), cue: 'Breathe, choose, commit before the next point.' },
  ]
}

function buildDoublesTrainingGroups(cards: LevelUpCard[]): FocusTrainingGroup[] {
  const byId = new Map(cards.map((card) => [card.id, card]))

  return [
    { label: 'Serve location', card: byId.get('serve-location-call'), cue: 'Location call creates partner movement.' },
    { label: 'First move', card: byId.get('partner-first-move-call') ?? byId.get('doubles-return-first-move'), cue: 'Say the first move before the ball is live.' },
    { label: 'Poach timing', card: byId.get('poach-timing-shadow'), cue: 'Poach on a trigger, not a guess.' },
    { label: 'Middle and switch', card: byId.get('middle-ball-rule') ?? byId.get('switch-call-drill'), cue: 'Own the middle and call the switch early.' },
  ]
}

function findSessionCard(cards: LevelUpCard[], focusTags: string[], preferredTags: string[], maxMinutes: number) {
  const focusedMatch = cards.find((card) => (
    card.durationMinutes <= maxMinutes
    && tagsOverlap(card.tags, preferredTags)
    && tagsOverlap(card.tags, focusTags)
  ))

  if (focusedMatch) return focusedMatch

  return cards.find((card) => (
    card.durationMinutes <= maxMinutes
    && (
      (preferredTags.includes('match-day') && card.tags.includes('match-day'))
      || (preferredTags.includes('mobility') && card.tags.includes('mobility'))
    )
  ))
}

function getSessionBuilderWhy(card: LevelUpCard, focusLabel: string, stepLabel: string) {
  const tennisGoal = sentenceCase(cleanSentenceFragment(card.tennisGoal))

  if (stepLabel === 'Warm the habit' || stepLabel === 'Start clean') {
    if (card.tags.includes('match-day') || card.tags.includes('light-feet')) return `Prepare the body and first step before asking for speed.`
    if (card.tags.includes('mobility')) return `Open the range you need before the tennis work starts.`
    return `Start the ${focusLabel.toLowerCase()} block with one clean habit, not volume.`
  }

  if (stepLabel === 'Train the rep') {
    if (card.setting.includes('court')) return `Train the exact tennis action: ${tennisGoal}.`
    if (card.category === 'strength-stability' || card.category === 'conditioning') return `Build the physical base behind ${cleanSentenceFragment(card.tennisGoal)}.`
    return `Make the ${focusLabel.toLowerCase()} cue repeatable before adding pressure.`
  }

  if (stepLabel === 'Add pressure' || stepLabel === 'Score under intent') {
    if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) return `Practice the reset while the score or fatigue would normally rush you.`
    if (card.tags.includes('decision-quality')) return `Make the choice earlier, then live with the result.`
    return `Add a consequence so the habit has to hold up.`
  }

  if (card.durationMinutes <= 10) return `Finish with a short proof rep you can score honestly.`
  return `Close the ${focusLabel.toLowerCase()} block with one number and one useful next step.`
}

function cleanSentenceFragment(value: string) {
  return value.trim().replace(/[.?!]+$/, '').toLowerCase()
}

function sentenceCase(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value
}

function getSessionBuilderCue(card: LevelUpCard, stepLabel: string) {
  const firstRoutineStep = card.routine[0]?.replace(/\.$/, '')

  if (stepLabel === 'Score and save' || stepLabel === 'Score proof') return `Score ${card.proof}; note only what changes the next practice.`
  if (card.tags.includes('recovery-after-contact')) return 'Recover before you watch the ball.'
  if (card.tags.includes('serve-routine')) return 'Call the target, breathe, then start the motion.'
  if (card.tags.includes('pressure-reset')) return 'Name the score, reset the breath, choose the next ball.'
  if (card.tags.includes('light-feet')) return 'Quiet feet, balanced head, ready split.'
  if (card.tags.includes('leg-durability')) return 'Stay low without letting posture collapse.'
  if (firstRoutineStep) return firstRoutineStep

  return card.cue
}

function tagsOverlap(left: string[], right: string[]) {
  return left.some((tag) => right.includes(tag))
}

function uniqueCards(cards: Array<LevelUpCard | undefined>) {
  return cards.filter((card, index, list): card is LevelUpCard => {
    if (!card) return false

    return list.findIndex((candidate) => candidate?.id === card.id) === index
  })
}

function getNextCardInList(cards: LevelUpCard[], currentCard: LevelUpCard) {
  const uniqueList = uniqueCards(cards)
  const currentIndex = uniqueList.findIndex((card) => card.id === currentCard.id)
  if (!uniqueList.length) return undefined
  if (currentIndex < 0) return uniqueList[0]
  return uniqueList[(currentIndex + 1) % uniqueList.length]
}

function getPostProofNextCardPlan(
  card: LevelUpCard,
  rating: number,
  candidate?: LevelUpCard,
) {
  if (rating <= 1) {
    return {
      card,
      detail: `Scale down this same card. Use: ${card.regression ?? getScaleDownSetup(card)}`,
      reason: 'The proof was not stable yet, so the next rep should get easier before it gets faster.',
      proofTarget: card.proof,
      firstRep: getPostProofFirstRep(card, 'scale-down'),
      actionLabel: 'Scale this card',
    }
  }

  if (rating <= 3) {
    return {
      card,
      detail: `Repeat the same card and protect this cue: ${card.cue}`,
      reason: 'The habit is showing up, but it needs one cleaner round before adding pressure.',
      proofTarget: card.proof,
      firstRep: getPostProofFirstRep(card, 'repeat-clean'),
      actionLabel: 'Repeat this card',
    }
  }

  const nextCard = candidate && candidate.id !== card.id ? candidate : card
  return {
    card: nextCard,
    detail: nextCard.id === card.id
      ? card.progression ?? `Add one pressure layer while keeping this cue: ${card.cue}`
      : `You proved ${card.title}. Connect it to ${nextCard.title}.`,
    reason: nextCard.id === card.id
      ? 'The proof is repeatable enough to add one pressure layer.'
      : 'The proof was strong enough to connect this habit to the next tennis task.',
    proofTarget: nextCard.proof,
    firstRep: getPostProofFirstRep(nextCard, nextCard.id === card.id ? 'add-pressure' : 'next-card'),
    actionLabel: nextCard.id === card.id ? 'Add pressure here' : 'Start next card',
  }
}

function getPostProofFirstRep(card: LevelUpCard, mode: 'scale-down' | 'repeat-clean' | 'add-pressure' | 'next-card') {
  const firstStep = card.routine[0]?.replace(/[.?!]+$/, '') || card.cue

  if (mode === 'scale-down') return `Slow version: ${firstStep}.`
  if (mode === 'repeat-clean') return `Same setup: ${firstStep}.`
  if (mode === 'add-pressure') return `Pressure version: ${firstStep}.`
  return `Start here: ${firstStep}.`
}

function buildAdaptiveCardReason(nextBestRep: NextBestRep) {
  return `${formatAdaptiveDecisionReason(nextBestRep.decision)} ${nextBestRep.signal}`
}

function buildProgressPathStages(nextBestRep: NextBestRep) {
  const proofStage = nextBestRep.signal === 'No proof logged yet.'
    ? {
      label: '1. Log',
      title: 'No proof yet',
      detail: 'Run one card and save a 0-5 score.',
      current: true,
    }
    : {
      label: '1. Proof',
      title: nextBestRep.signal.replace('Based on your last proof: ', 'Last proof '),
      detail: 'That score decides whether to scale, repeat, or level up.',
      current: false,
    }

  const readStage = {
    label: '2. Read',
    title: formatAdaptiveDecisionBadge(nextBestRep.decision),
    detail: formatAdaptiveDecisionReason(nextBestRep.decision),
    current: nextBestRep.signal !== 'No proof logged yet.',
  }

  const nextStage = {
    label: '3. Next',
    title: nextBestRep.card.title,
    detail: nextBestRep.detail,
    current: false,
  }

  return [proofStage, readStage, nextStage]
}

function formatAdaptiveDecisionBadge(decision: string) {
  return formatAdaptiveDecisionReason(decision).replace(/\.$/, '')
}

function formatAdaptiveDecisionReason(decision: string) {
  const action = decision.replace('Decision: ', '')
  if (action === 'log proof') return 'Log proof first.'
  if (action === 'repeat clean') return 'Repeat clean next.'
  if (action === 'scale down') return 'Scale down next.'
  if (action === 'level up') return 'Level up next.'
  return `${action.charAt(0).toUpperCase()}${action.slice(1)} next.`
}

function buildLaneProgress(
  lanes: FocusTrainingLane[],
  completions: LevelUpCompletion[],
  completionSummaryByCardId: Map<string, CompletionSummary>,
): LaneProgressItem[] {
  const completionsByCardId = new Map<string, LevelUpCompletion[]>()

  for (const completion of completions) {
    const list = completionsByCardId.get(completion.cardId) ?? []
    list.push(completion)
    completionsByCardId.set(completion.cardId, list)
  }

  return lanes
    .map((lane) => {
      const laneCards = uniqueById(lane.cards)
      const laneCompletions = laneCards.flatMap((card) => completionsByCardId.get(card.id) ?? [])
      const completedCardCount = laneCards.filter((card) => completionSummaryByCardId.has(card.id)).length
      const latestCompletion = laneCompletions
        .filter((completion) => typeof completion.proofRating === 'number')
        .sort((left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime())[0]
      const nextCard = laneCards.find((card) => !completionSummaryByCardId.has(card.id)) ?? laneCards[0]

      return {
        laneKey: lane.key,
        label: lane.eyebrow.replace(' Training', ''),
        proofCount: laneCompletions.length,
        completedCardCount,
        totalCardCount: laneCards.length,
        lastRating: latestCompletion?.proofRating,
        nextCard,
        read: buildLaneProgressRead(lane, laneCompletions.length, latestCompletion?.proofRating, nextCard),
      }
    })
    .sort((left, right) => (
      left.proofCount - right.proofCount
      || (left.lastRating ?? 6) - (right.lastRating ?? 6)
      || left.label.localeCompare(right.label)
    ))
}

function buildWeeklyBalance(
  lanes: FocusTrainingLane[],
  completions: LevelUpCompletion[],
  completionSummaryByCardId: Map<string, CompletionSummary>,
): WeeklyBalance {
  const now = Date.now()
  const weekStart = now - 7 * 24 * 60 * 60 * 1000
  const weeklyCompletions = completions.filter((completion) => {
    const completedAt = new Date(completion.completedAt).getTime()
    return Number.isFinite(completedAt) && completedAt >= weekStart
  })
  const completionsByCardId = new Map<string, LevelUpCompletion[]>()

  for (const completion of weeklyCompletions) {
    const list = completionsByCardId.get(completion.cardId) ?? []
    list.push(completion)
    completionsByCardId.set(completion.cardId, list)
  }

  const items = lanes.map((lane) => {
    const laneCards = uniqueById(lane.cards)
    const proofCount = laneCards.reduce((count, card) => count + (completionsByCardId.get(card.id)?.length ?? 0), 0)
    const nextCard = laneCards.find((card) => !completionSummaryByCardId.has(card.id)) ?? laneCards[0]

    return {
      laneKey: lane.key,
      label: lane.eyebrow.replace(' Training', ''),
      proofCount,
      share: weeklyCompletions.length ? Math.round((proofCount / weeklyCompletions.length) * 100) : 0,
      read: buildWeeklyBalanceRead(lane, proofCount, nextCard),
      nextCard,
    }
  })
  const fallbackItem = items[0] ?? {
    laneKey: 'weekly-balance',
    label: 'Training',
    proofCount: 0,
    share: 0,
    read: 'Log one proof score this week.',
    nextCard: undefined,
  }
  const sortedByProof = [...items].sort((left, right) => right.proofCount - left.proofCount || left.label.localeCompare(right.label))
  const underIndex = [...items].sort((left, right) => left.proofCount - right.proofCount || left.label.localeCompare(right.label))[0] ?? fallbackItem
  const overIndex = sortedByProof[0] ?? underIndex

  return {
    totalProofs: weeklyCompletions.length,
    headline: weeklyCompletions.length ? `${formatProofCount(weeklyCompletions.length)} in the last 7 days.` : 'No weekly proof yet.',
    read: weeklyCompletions.length
      ? `You are leaning toward ${overIndex.label}. Add ${underIndex.label} next so the week stays balanced.`
      : `Start with ${underIndex?.nextCard?.title ?? 'one card'} and log one 0-5 proof score.`,
    overIndex,
    underIndex,
    items,
  }
}

function buildWeeklyBalanceRead(lane: FocusTrainingLane, proofCount: number, nextCard?: LevelUpCard) {
  if (!proofCount) return `No ${lane.eyebrow.toLowerCase().replace(' training', '')} proof this week. Start ${nextCard?.title ?? lane.title}.`
  if (proofCount === 1) return `1 proof. Keep it alive with ${nextCard?.title ?? 'one clean rep'}.`
  return `${proofCount} proofs. Good signal; balance another lane before stacking more here.`
}

function buildHabitMomentum(
  completions: LevelUpCompletion[],
  weeklyBalance: WeeklyBalance,
  laneProgress: LaneProgressItem[],
  fallbackCard: LevelUpCard,
): HabitMomentum {
  const streakDays = getProofStreakDays(completions)
  const weeklyProofCount = weeklyBalance.totalProofs
  const strongestLane = laneProgress
    .filter((item) => item.proofCount > 0)
    .sort((left, right) => right.proofCount - left.proofCount || left.label.localeCompare(right.label))[0]?.label
    ?? 'Not proven yet'
  const nextCard = weeklyBalance.underIndex.nextCard ?? fallbackCard
  const nextLabel = weeklyProofCount ? 'Keep balance' : 'Start momentum'

  if (!completions.length) {
    return {
      headline: 'Start with one honest proof.',
      read: `Run ${nextCard.title} and save a 0-5 score. One number is enough to make tomorrow clearer.`,
      weeklyProofCount,
      streakDays,
      strongestLane,
      nextCard,
      nextLabel,
    }
  }

  if (streakDays >= 3) {
    return {
      headline: `${streakDays}-day proof streak.`,
      read: `Momentum is real. Protect the streak, but use ${weeklyBalance.underIndex.label} so the work stays balanced.`,
      weeklyProofCount,
      streakDays,
      strongestLane,
      nextCard,
      nextLabel,
    }
  }

  if (weeklyProofCount >= 3) {
    return {
      headline: `${formatProofCount(weeklyProofCount)} this week.`,
      read: `Good weekly signal. You are leaning toward ${weeklyBalance.overIndex.label}; add ${weeklyBalance.underIndex.label} next.`,
      weeklyProofCount,
      streakDays,
      strongestLane,
      nextCard,
      nextLabel,
    }
  }

  return {
    headline: streakDays ? `${streakDays}-day proof streak.` : 'Momentum needs one proof today.',
    read: `Keep it simple: run one useful card, score it, and stop after the note if the number tells the story.`,
    weeklyProofCount,
    streakDays,
    strongestLane,
    nextCard,
    nextLabel,
  }
}

function getProofStreakDays(completions: LevelUpCompletion[]) {
  const completedDayKeys = new Set(
    completions
      .map((completion) => getLocalDayKey(completion.completedAt))
      .filter((dayKey): dayKey is string => Boolean(dayKey)),
  )
  let streak = 0
  const today = new Date()

  for (let offset = 0; offset < 30; offset += 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - offset)
    if (!completedDayKeys.has(getDateDayKey(date))) break
    streak += 1
  }

  return streak
}

function getLocalDayKey(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return getDateDayKey(date)
}

function getDateDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

function formatProofCount(count: number) {
  return count === 1 ? '1 proof' : `${count} proofs`
}

function uniqueById(cards: LevelUpCard[]) {
  const seen = new Set<string>()
  return cards.filter((card) => {
    if (seen.has(card.id)) return false
    seen.add(card.id)
    return true
  })
}

function buildLaneProgressRead(
  lane: FocusTrainingLane,
  proofCount: number,
  lastRating?: number,
  nextCard?: LevelUpCard,
) {
  if (!proofCount) return `No proof logged yet. Start with ${nextCard?.title ?? lane.title} and get one honest score.`
  if (lastRating === undefined) return `You have work logged here. Add a 0-5 proof score so the next rep is clearer.`
  if (lastRating <= 2) return `Scale this lane down. Repeat one clean cue before adding pace or pressure.`
  if (lastRating === 3) return `You are building. Repeat ${nextCard?.title ?? 'the next rep'} and make the proof cleaner.`
  return `Strong signal. Add one harder variable or keep this lane sharp with ${nextCard?.title ?? 'a focused rep'}.`
}

function buildTrainingPulse({
  completions,
  identityCards,
}: {
  completions: LevelUpCompletion[]
  identityCards: LevelUpCard[]
}): TrainingPulse {
  if (!completions.length) {
    const starterArea = identityCards[0] ? getTrainingAreaLabel(identityCards[0]) : 'Identity habit'
    return {
      proofCount: 0,
      averageProofLabel: 'No score',
      strongestArea: 'Not proven yet',
      attentionArea: starterArea,
      coachRead: 'Log one proof score so your coach and your next practice have a real signal.',
    }
  }

  const ratedCompletions = completions.filter((completion) => typeof completion.proofRating === 'number')
  const averageProof = ratedCompletions.length
    ? ratedCompletions.reduce((total, completion) => total + (completion.proofRating ?? 0), 0) / ratedCompletions.length
    : 0
  const areaCounts = new Map<string, number>()

  for (const completion of completions) {
    const card = LEVEL_UP_CARDS.find((candidate) => candidate.id === completion.cardId)
    if (!card) continue
    const area = getTrainingAreaLabel(card)
    areaCounts.set(area, (areaCounts.get(area) ?? 0) + 1)
  }

  const strongestArea = [...areaCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Proof habit'
  const attentionArea = getUndertrainedArea(identityCards, areaCounts)

  return {
    proofCount: completions.length,
    averageProofLabel: ratedCompletions.length ? `${averageProof.toFixed(1)}/5` : 'Logged',
    strongestArea,
    attentionArea,
    coachRead: buildCoachPulseRead(averageProof, strongestArea, attentionArea),
  }
}

function getUndertrainedArea(identityCards: LevelUpCard[], areaCounts: Map<string, number>) {
  const identityAreas = unique(identityCards.map((card) => getTrainingAreaLabel(card)))
  if (!identityAreas.length) return 'Identity habit'
  return identityAreas
    .map((area) => ({ area, count: areaCounts.get(area) ?? 0 }))
    .sort((a, b) => a.count - b.count || a.area.localeCompare(b.area))[0]?.area ?? identityAreas[0]
}

function buildCoachPulseRead(averageProof: number, strongestArea: string, attentionArea: string) {
  if (!averageProof) return `You have proof in ${strongestArea}. Add ${attentionArea} next so the plan stays balanced.`
  if (averageProof < 2) return `Scale the work down. Keep ${strongestArea} simple and rebuild ${attentionArea} with one clean cue.`
  if (averageProof < 4) return `You are building. Protect ${strongestArea}, then add a clean ${attentionArea} rep before browsing.`
  return `Quality is trending up. Keep ${strongestArea} sharp and level up ${attentionArea} with one harder variable.`
}

function getTrainingAreaLabel(card: LevelUpCard) {
  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target') || card.tags.includes('serve-plus-one') || card.category === 'serve-return') {
    return 'Serve / return'
  }

  if (card.tags.includes('doubles-communication') || card.tags.includes('partner-first-move') || card.category === 'doubles-drill') {
    return 'Doubles'
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points') || card.category === 'mental-routine') {
    return 'Mind / routine'
  }

  if (['movement-engine', 'strength-stability', 'conditioning', 'mobility-stretch', 'recovery-reset'].includes(card.category)) {
    return 'Body'
  }

  if (card.tags.includes('match-day') || card.category === 'match-prep') {
    return 'Match day'
  }

  return 'Court habits'
}

function buildCoachUpdateDigest({
  recentCard,
  recentCompletion,
  trainingPulse,
  nextBestRep,
}: {
  recentCard?: LevelUpCard
  recentCompletion?: LevelUpCompletion
  trainingPulse: TrainingPulse
  nextBestRep: NextBestRep
}): CoachUpdateDigest {
  if (!recentCard || typeof recentCompletion?.proofRating !== 'number') {
    return {
      status: 'No proof sent yet.',
      proofLine: 'Run one card, score 0-5, then send the short update.',
      coachAsk: 'Start with the next best rep so your coach has a real signal to react to.',
      firstRep: nextBestRep.firstRep,
      shareText: `I am starting Level Up with ${nextBestRep.card.title}. First rep: ${nextBestRep.firstRep} Proof target: ${nextBestRep.proof}.`,
    }
  }

  const note = recentCompletion.note?.trim()
  const noteText = note ? ` Note: ${note}` : ''
  const nextLine = `Next: ${nextBestRep.card.title} (${nextBestRep.label}).`
  const firstRepLine = `First rep: ${nextBestRep.firstRep}`
  const shareText = `${recentCard.title}: ${recentCompletion.proofRating}/5 proof.${noteText} ${nextLine} ${firstRepLine} Pulse: ${trainingPulse.strongestArea} strongest, ${trainingPulse.attentionArea} needs reps.`

  return {
    status: recentCompletion.proofRating >= 4 ? 'Ready to send a strong update.' : 'Send the honest signal.',
    proofLine: `${recentCard.title}: ${recentCompletion.proofRating}/5 - ${recentCard.proof}`,
    coachAsk: `Ask your coach to confirm whether ${trainingPulse.attentionArea.toLowerCase()} should be the next lesson focus.`,
    firstRep: nextBestRep.firstRep,
    shareText,
  }
}

function buildCoachChallengeFromAssignment(
  source: CoachAssignment,
  links: CoachStudentLink[],
): LevelUpCoachChallenge | null {
  const card = matchAssignmentCard(source)
  if (!card) return null

  const assignmentModule = matchAssignmentModule(source, card)
  const summary = getCoachAssignmentSummary(source.assignment)
  const link = links.find((candidate) => candidate.id === source.studentLinkId)
  const dueAt = source.dueDate ? `${source.dueDate}T23:59:59.000Z` : undefined
  const coachNote = [
    summary.detail,
    summary.prompt,
    source.focus,
  ].map((item) => item.trim()).filter(Boolean)[0]
    ?? 'Coach assigned one tool that supports your current tennis habit. Run it clean, score it honestly, and send the proof back.'

  return {
    source,
    card,
    module: assignmentModule,
    summary,
    link,
    assignment: {
      id: source.id,
      playerId: link?.playerUserId ?? 'linked-player',
      coachId: link?.coachUserId,
      cardId: card.id,
      moduleId: assignmentModule.id,
      assignedAt: source.updatedAt,
      dueAt,
      coachNote,
      proofRequired: summary.expectedEvidence || card.proof,
      status: source.status === 'completed' ? 'completed' : 'assigned',
    },
  }
}

function buildPreviewCoachChallenge(card: LevelUpCard, module: LevelUpModule): LevelUpCoachChallenge {
  return {
    source: null,
    card,
    module,
    summary: null,
    assignment: {
      id: `mock-coach-${card.id}`,
      playerId: 'local-player',
      coachId: 'linked-coach',
      cardId: card.id,
      moduleId: module.id,
      assignedAt: '2026-06-01T12:00:00.000Z',
      dueAt: '2026-06-03T23:59:59.000Z',
      coachNote: 'Coach assigned one tool that supports your current tennis habit. Run it clean, score it honestly, and send the proof back.',
      proofRequired: card.proof,
      status: 'assigned',
    },
  }
}

function buildLocalCoachChallenge({
  payload,
  identitySlug,
}: {
  payload: CoachAssignmentBuilderPayload
  identitySlug: string
}): LevelUpCoachChallenge {
  return {
    source: null,
    card: payload.card,
    module: payload.module,
    summary: null,
    assignment: {
      id: `local-coach-${identitySlug}-${payload.card.id}-${Date.now()}`,
      playerId: 'local-player',
      coachId: 'local-coach',
      cardId: payload.card.id,
      moduleId: payload.module.id,
      assignedAt: new Date().toISOString(),
      dueAt: payload.dueDate ? `${payload.dueDate}T23:59:59.000Z` : undefined,
      coachNote: payload.coachNote,
      proofRequired: payload.proofRequired,
      status: 'assigned',
    },
  }
}

function buildDefaultCoachAssignmentNote(card: LevelUpCard) {
  return `Run this once and send one proof score. I want to see ${card.proof.replace(' 0-5', '').toLowerCase()} before we add more work.`
}

function getDefaultAssignmentDueDate() {
  return new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function buildAssignmentByCardId(challenges: LevelUpCoachChallenge[]) {
  const byCardId = new Map<string, LevelUpAssignment>()
  for (const challenge of challenges) {
    if (challenge.assignment.status === 'completed') continue
    if (!byCardId.has(challenge.card.id)) {
      byCardId.set(challenge.card.id, challenge.assignment)
    }
  }
  return byCardId
}

function uniqueCoachChallenges(challenges: LevelUpCoachChallenge[]) {
  const seen = new Set<string>()
  return challenges.filter((challenge) => {
    if (seen.has(challenge.assignment.id)) return false
    seen.add(challenge.assignment.id)
    return true
  })
}

function getCoachTemplateCards() {
  const templateCardIds = new Set(coachAssignmentTemplates.map((template) => template.cardId))
  return LEVEL_UP_CARDS.filter((card) => templateCardIds.has(card.id))
}

function uniqueModules(modules: Array<LevelUpModule | undefined>) {
  return modules.filter((module, index, list): module is LevelUpModule => {
    if (!module) return false

    return list.findIndex((candidate) => candidate?.id === module.id) === index
  })
}

function buildCoachChallengeInboxItems(
  challenges: LevelUpCoachChallenge[],
  completionSummaryByCardId: Map<string, CompletionSummary>,
  sentAssignmentIds: string[] = [],
  sentAtByAssignmentId: Record<string, string> = {},
) {
  return challenges.map((challenge) => {
    const latestCardSummary = completionSummaryByCardId.get(challenge.card.id)
    const completionSummary = latestCardSummary?.lastAssignmentId && latestCardSummary.lastAssignmentId !== challenge.assignment.id
      ? undefined
      : latestCardSummary?.lastCompletedAt && isAssignmentAfterCompletion(challenge.assignment.assignedAt, latestCardSummary.lastCompletedAt)
      ? undefined
      : latestCardSummary
    const sentAt = sentAtByAssignmentId[challenge.assignment.id]
    const status = getCoachChallengeInboxStatus(
      challenge.assignment,
      completionSummary,
      sentAssignmentIds.includes(challenge.assignment.id),
    )
    return {
      challenge,
      completionSummary,
      status,
      label: getCoachChallengeInboxLabel(status, completionSummary),
      dueLabel: `Due ${formatAssignmentDueDate(challenge.assignment.dueAt)}`,
      proofLabel: completionSummary?.lastRating !== undefined
        ? `Proof ${completionSummary.lastRating}/5`
        : challenge.assignment.proofRequired ?? challenge.card.proof,
      sentAtLabel: sentAt ? `Sent ${formatCoachInboxSentDate(sentAt)}` : '',
      assignmentPlan: buildCoachAssignmentPlayerPlan(challenge),
      coachUpdateText: buildCoachChallengeInboxUpdate(challenge, completionSummary),
      nextStepText: buildCoachChallengeInboxNextStep(challenge, completionSummary),
      coachFeedback: buildCoachFeedbackLoop(challenge, completionSummary),
    }
  })
}

function buildCoachAssignmentPlayerPlan(challenge: LevelUpCoachChallenge) {
  return [
    {
      label: 'Why',
      value: getCoachAssignmentWhy(challenge.card),
    },
    {
      label: 'Do',
      value: `${challenge.card.durationMinutes} min. ${challenge.card.routine[0]}`,
    },
    {
      label: 'Proof',
      value: challenge.assignment.proofRequired ?? challenge.card.proof,
    },
  ]
}

function getCoachAssignmentWhy(card: LevelUpCard) {
  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) return 'Clean up the point start before judging makes and misses.'
  if (card.tags.includes('return-intent')) return 'Make the return job clear before the server starts.'
  if (card.tags.includes('recovery-after-contact')) return 'Build the habit of recovering before watching the result.'
  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) return 'Give pressure points a repeatable reset instead of a reaction.'
  if (card.tags.includes('doubles-communication') || card.tags.includes('partner-first-move')) return 'Make the first move obvious to your partner.'
  if (card.tags.includes('forward-close') || card.tags.includes('volley')) return 'Close and split with balance before trying to finish faster.'
  if (card.tags.includes('conditioning') || card.tags.includes('leg-durability')) return 'Connect body work to posture and decisions late in the session.'
  return 'Support the player identity with one clear tennis habit.'
}

function buildCoachFeedbackLoop(
  challenge: LevelUpCoachChallenge,
  completionSummary?: CompletionSummary,
) {
  if (completionSummary?.lastRating === undefined) {
    return {
      title: 'Waiting on proof.',
      detail: 'The coach needs one 0-5 score before changing the assignment.',
      nextAssignment: `Next coach move: wait for ${challenge.assignment.proofRequired ?? challenge.card.proof}.`,
    }
  }

  const rating = completionSummary.lastRating
  if (rating <= 1) {
    return {
      title: 'Coach reply: scale down.',
      detail: `The proof is not stable yet. Reduce speed, volume, or decision load on ${challenge.card.title}.`,
      nextAssignment: `Assign: ${challenge.card.title} with an easier setup.`,
    }
  }

  if (rating <= 3) {
    return {
      title: 'Coach reply: repeat cleaner.',
      detail: `The habit is showing up. Keep the same tool and make the standard clearer before adding difficulty.`,
      nextAssignment: `Assign: repeat ${challenge.card.title} with the same proof.`,
    }
  }

  return {
    title: 'Coach reply: level up.',
    detail: `The proof is strong enough to test one harder variable without changing the whole drill.`,
    nextAssignment: `Assign: ${challenge.card.progression ?? `add one pressure layer to ${challenge.card.title}`}`,
  }
}

function buildCoachFeedbackAssignmentPayload(
  challenge: LevelUpCoachChallenge,
  feedback: ReturnType<typeof buildCoachFeedbackLoop>,
): CoachAssignmentBuilderPayload {
  return {
    card: challenge.card,
    module: challenge.module,
    dueDate: getDefaultAssignmentDueDate(),
    coachNote: feedback.nextAssignment,
    proofRequired: challenge.assignment.proofRequired ?? challenge.card.proof,
  }
}

function getCoachChallengeInboxStatus(
  assignment: LevelUpAssignment,
  completionSummary?: CompletionSummary,
  locallySent = false,
): CoachChallengeInboxFilter {
  if (assignment.status === 'completed' || locallySent) return 'completed'
  if (completionSummary?.lastRating !== undefined) return 'ready'
  return 'assigned'
}

function isAssignmentAfterCompletion(assignedAt: string, completedAt: string) {
  const assignedTime = new Date(assignedAt).getTime()
  const completedTime = new Date(completedAt).getTime()
  if (Number.isNaN(assignedTime) || Number.isNaN(completedTime)) return false
  return assignedTime > completedTime
}

function getCoachChallengeInboxLabel(status: CoachChallengeInboxFilter, completionSummary?: CompletionSummary) {
  if (status === 'completed') return 'Sent to coach'
  if (status === 'ready') return completionSummary?.lastRating !== undefined ? `Ready: ${completionSummary.lastRating}/5 proof` : 'Ready to send'
  return 'Coach assigned'
}

function getCoachInboxEmptyCopy(filter: CoachChallengeInboxFilter) {
  if (filter === 'ready') return 'Save proof on an assigned card and it will move here.'
  if (filter === 'completed') return 'Mark a coach update sent and it will collect here for review.'
  return 'You are caught up on assigned coach work.'
}

function formatCoachInboxSentDate(sentAt: string) {
  const sentDate = new Date(sentAt)
  if (Number.isNaN(sentDate.getTime())) return 'today'

  const today = new Date()
  if (sentDate.toDateString() === today.toDateString()) return 'today'

  return sentDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function buildCoachChallengeInboxUpdate(
  challenge: LevelUpCoachChallenge,
  completionSummary?: CompletionSummary,
) {
  if (completionSummary?.lastRating === undefined) return ''

  const noteLine = completionSummary.lastNote ? ` Note: ${completionSummary.lastNote}` : ''
  const durationLine = completionSummary.lastDurationMinutes ? `, ${completionSummary.lastDurationMinutes} min` : ''
  const proof = challenge.assignment.proofRequired ?? challenge.card.proof
  return `${challenge.card.title}: proof ${completionSummary.lastRating}/5${durationLine}. ${proof}.${noteLine}`
}

function buildCoachChallengeInboxNextStep(
  challenge: LevelUpCoachChallenge,
  completionSummary?: CompletionSummary,
) {
  if (completionSummary?.lastRating === undefined) {
    return `Run ${challenge.card.title}, then send one proof number.`
  }

  if (completionSummary.lastRating >= 4) {
    return `Repeat ${challenge.card.title} once more, then ask coach whether to add pressure.`
  }

  if (completionSummary.lastRating >= 2) {
    return `Run ${challenge.card.title} again at the same speed and clean up the proof before adding difficulty.`
  }

  return `Scale ${challenge.card.title} down and make the cue show up before chasing score.`
}

function buildDirectStartAssignment(card: LevelUpCard, requestedStartCardId: string): LevelUpAssignment | undefined {
  if (requestedStartCardId !== card.id) return undefined

  return {
    id: `direct-coach-link-${card.id}`,
    playerId: 'direct-link-player',
    cardId: card.id,
    assignedAt: new Date().toISOString(),
    coachNote: 'Opened from a coach link. Run the card, score the proof, and share the recap if this is assigned work.',
    proofRequired: card.proof,
    status: 'assigned',
  }
}

function getCoachAssignmentCardLabel(assignment: LevelUpAssignment, card: LevelUpCard) {
  const directLink = assignment.id.startsWith('direct-coach-link-')
  return {
    status: directLink ? 'Coach link' : 'Coach assigned',
    proof: assignment.proofRequired ?? card.proof,
    due: directLink ? 'Share proof when this is assigned work.' : `Due ${formatAssignmentDueDate(assignment.dueAt)}`,
  }
}

function matchAssignmentCard(assignment: CoachAssignment) {
  const directCardId = stringFromRecord(assignment.assignment, 'cardId')
  if (directCardId) {
    const directCard = LEVEL_UP_CARDS.find((card) => card.id === directCardId)
    if (directCard) return directCard
  }

  const starterId = stringFromRecord(assignment.assignment, 'starterId')
  const templateId = stringFromRecord(assignment.assignment, 'templateId')
  const shortcutCard = getAssignmentShortcutCard(starterId || templateId || assignment.title)
  if (shortcutCard) return shortcutCard

  const assignmentText = buildAssignmentSearchText(assignment)
  const targetedCard = getAssignmentShortcutCard(assignmentText)
  if (targetedCard) return targetedCard

  return LEVEL_UP_CARDS
    .map((card) => ({ card, score: scoreAssignmentCard(card, assignmentText) }))
    .sort((a, b) => b.score - a.score)[0]?.card ?? LEVEL_UP_CARDS[0]
}

function matchAssignmentModule(assignment: CoachAssignment, card: LevelUpCard) {
  const directModuleId = stringFromRecord(assignment.assignment, 'moduleId')
  if (directModuleId) {
    const directModule = LEVEL_UP_MODULES.find((module) => module.id === directModuleId)
    if (directModule) return directModule
  }

  const assignmentText = buildAssignmentSearchText(assignment)
  return LEVEL_UP_MODULES.find((module) => module.cardIds.includes(card.id))
    ?? LEVEL_UP_MODULES
      .map((module) => ({ module, score: scoreTextMatch(`${module.title} ${module.subtitle} ${module.description} ${module.tags.join(' ')}`, assignmentText) }))
      .sort((a, b) => b.score - a.score)[0]?.module
    ?? LEVEL_UP_MODULES[0]
}

function getAssignmentShortcutCard(text: string) {
  const normalized = text.toLowerCase()
  const shortcutByNeed: Array<[string[], string]> = [
    [['serve target', 'target ladder', 'serve routine'], 'serve-target-ladder'],
    [['split recover', 'split, recover', 'active feet', 'recovery before watching'], 'split-recover-loop'],
    [['movement', 'first step', 'split step', 'split-step'], 'split-step-rhythm'],
    [['attack decision', 'build attack', 'shot selection', 'forced attack'], 'defense-neutral-attack-rally'],
    [['doubles first', 'partner first', 'middle ownership', 'doubles iq'], 'serve-location-call'],
    [['return', 'return intent', 'return depth'], 'return-shadow-split-read'],
    [['wide ball', 'defense to neutral'], 'wide-ball-neutralizer'],
    [['volley', 'net'], 'volley-ready-split'],
    [['backhand'], 'basket-backhand-crosscourt'],
    [['forehand'], 'basket-forehand-crosscourt'],
  ]
  const match = shortcutByNeed.find(([needles]) => needles.some((needle) => normalized.includes(needle)))
  return match ? LEVEL_UP_CARDS.find((card) => card.id === match[1]) : undefined
}

function buildAssignmentSearchText(assignment: CoachAssignment) {
  const summary = getCoachAssignmentSummary(assignment.assignment)
  return [
    assignment.title,
    assignment.focus,
    summary.detail,
    summary.prompt,
    summary.expectedEvidence,
    ...summary.tracker,
  ].join(' ').toLowerCase()
}

function scoreAssignmentCard(card: LevelUpCard, assignmentText: string) {
  return scoreTextMatch(`${card.id} ${card.title} ${card.pack} ${card.tennisGoal} ${card.cue} ${card.tags.join(' ')}`, assignmentText)
}

function scoreTextMatch(candidateText: string, assignmentText: string) {
  const tokens = unique(assignmentText.split(/[^a-z0-9+]+/).filter((token) => token.length > 2))
  const candidate = candidateText.toLowerCase()
  return tokens.reduce((score, token) => score + (candidate.includes(token) ? 1 : 0), 0)
}

function stringFromRecord(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return typeof value === 'string' ? value.trim() : ''
}

function formatAssignmentDueDate(dueAt?: string) {
  if (!dueAt) return 'this week'
  const date = new Date(dueAt)
  if (Number.isNaN(date.getTime())) return 'this week'
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getUTCMonth()]
  return `${month} ${date.getUTCDate()}`
}

function getProofRatingGuidance(rating: number, card: LevelUpCard) {
  if (rating <= 1) {
    return {
      title: 'Scale it down.',
      detail: card.regression,
    }
  }

  if (rating <= 3) {
    return {
      title: 'Repeat before moving on.',
      detail: `Run one more clean block with this cue: ${card.cue}`,
    }
  }

  return {
    title: 'Progress the challenge.',
    detail: card.progression,
  }
}

function getProofNotePrompt(rating: number) {
  if (rating <= 1) return 'What got in the way?'
  if (rating <= 3) return 'What cue should you repeat?'
  return 'What made it work?'
}

function getQuickProofNotes({
  card,
  rating,
  commonMiss,
  completedRoundCount,
  totalCleanRepCount,
}: {
  card: LevelUpCard
  rating: number
  commonMiss: { miss: string; fix: string }
  completedRoundCount: number
  totalCleanRepCount: number
}) {
  const proofLabel = card.proof.replace(' 0-5', '')
  const repsNote = totalCleanRepCount > 0
    ? `${totalCleanRepCount} clean reps${completedRoundCount > 0 ? ` across ${completedRoundCount + 1} rounds` : ''}.`
    : `Cue to watch: ${card.cue}`

  if (rating <= 1) {
    return [
      truncateProofNote(`Blocker: ${commonMiss.miss}`),
      truncateProofNote(`Scale down: ${card.regression}`),
      truncateProofNote(`Coach eyes on ${proofLabel.toLowerCase()}.`),
    ]
  }

  if (rating <= 3) {
    return [
      truncateProofNote(`Repeat cue: ${card.cue}`),
      truncateProofNote(repsNote),
      truncateProofNote(`Fast fix: ${commonMiss.fix}`),
    ]
  }

  return [
    truncateProofNote(`Worked: ${card.cue}`),
    truncateProofNote(repsNote),
    truncateProofNote(`Progress: ${card.progression}`),
  ]
}

function truncateProofNote(note: string) {
  return note.length > 116 ? `${note.slice(0, 113).trim()}...` : note
}

function getCoachableNotePrompt(card: LevelUpCard, rating: number) {
  const focus = getCardNoteFocus(card)

  if (rating <= 1) {
    return {
      title: 'Name the blocker.',
      prompt: focus.low,
    }
  }

  if (rating <= 3) {
    return {
      title: 'Name the repeat cue.',
      prompt: focus.mid,
    }
  }

  return {
    title: 'Name what transferred.',
    prompt: focus.high,
  }
}

function getCardNoteFocus(card: LevelUpCard) {
  if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
    return {
      low: 'Write where recovery disappeared: finish, first step, or ready spot.',
      mid: 'Write the cue that made recovery show up before watching.',
      high: 'Write what made the recovery automatic today.',
    }
  }

  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) {
    return {
      low: 'Write what changed first: target, breath, tempo, or pressure.',
      mid: 'Write the routine word or target you should repeat next time.',
      high: 'Write which target and routine felt most repeatable.',
    }
  }

  if (card.tags.includes('serve-plus-one')) {
    return {
      low: 'Write whether the serve target or first-ball plan was unclear.',
      mid: 'Write the pattern that almost connected.',
      high: 'Write the serve plus-one pattern you would use in a point.',
    }
  }

  if (card.tags.includes('return-intent')) {
    return {
      low: 'Write whether the decision was late or the feet were late.',
      mid: 'Write the return job that should be repeated.',
      high: 'Write which intent held up best under pace.',
    }
  }

  if (card.tags.includes('doubles-communication') || card.tags.includes('partner-first-move')) {
    return {
      low: 'Write which call was late or unclear.',
      mid: 'Write the one call your partner responded to best.',
      high: 'Write the call and first move you want to keep.',
    }
  }

  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
    return {
      low: 'Write when quality changed: posture, breath, legs, or decision.',
      mid: 'Write the cue that kept tennis posture playable.',
      high: 'Write how long quality held before it faded.',
    }
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
    return {
      low: 'Write the trigger that pulled you into the last point.',
      mid: 'Write the short reset cue that got you back.',
      high: 'Write the moment you reset before the next point started.',
    }
  }

  return {
    low: 'Write the one thing that blocked the tennis habit.',
    mid: 'Write the cue you should repeat next session.',
    high: 'Write what worked and where it showed up.',
  }
}

function getCardRepFeedback(card: LevelUpCard, rating: number) {
  const focus = getCardFeedbackFocus(card)

  if (rating <= 1) {
    return {
      label: 'Fix first',
      title: focus.lowTitle,
      detail: focus.lowDetail,
    }
  }

  if (rating <= 3) {
    return {
      label: 'Repeat cue',
      title: focus.midTitle,
      detail: focus.midDetail,
    }
  }

  return {
    label: 'Protect it',
    title: focus.highTitle,
    detail: focus.highDetail,
  }
}

function getCardFeedbackFocus(card: LevelUpCard) {
  if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
    return {
      lowTitle: 'Slow the finish and recover first.',
      lowDetail: 'Remove the result-watching. Count only reps where your feet return to ready before your eyes judge the ball.',
      midTitle: 'Make the recovery target obvious.',
      midDetail: 'Use the same cone, line, or ready spot every rep so the habit has one place to land.',
      highTitle: 'Keep recovery honest under speed.',
      highDetail: 'Add pace only if the ready position still happens before the imaginary next ball.',
    }
  }

  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) {
    return {
      lowTitle: 'Separate target from outcome.',
      lowDetail: 'Call one target, run one routine, then score clarity before caring about make or miss.',
      midTitle: 'Repeat the same pre-serve rhythm.',
      midDetail: 'Use the same breath and tempo for the next five reps, especially after a miss.',
      highTitle: 'Add pressure without changing tempo.',
      highDetail: 'Start at 30-30 or use a smaller target while keeping the same routine.',
    }
  }

  if (card.tags.includes('serve-plus-one')) {
    return {
      lowTitle: 'Name the plus-one before serving.',
      lowDetail: 'The rep does not count if the serve and first ball feel like two separate drills.',
      midTitle: 'Match serve target to first-ball shape.',
      midDetail: 'Repeat the pattern until the first move after serve is automatic.',
      highTitle: 'Make the return less predictable.',
      highDetail: 'Keep the same plan, but let the return vary slightly so the pattern transfers.',
    }
  }

  if (card.tags.includes('return-intent')) {
    return {
      lowTitle: 'Decide before the toss.',
      lowDetail: 'Pick block, drive, or height early. Late decisions turn return reps into guessing.',
      midTitle: 'Recover after contact.',
      midDetail: 'Keep the intent, then get back to ready before judging the return.',
      highTitle: 'Add score pressure to the same job.',
      highDetail: 'Start points at 30-30 and protect the chosen return job.',
    }
  }

  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
    return {
      lowTitle: 'Quality beats the clock.',
      lowDetail: 'Shorten the work block until posture, breathing, and control stay clean.',
      midTitle: 'Hold one tennis decision while tired.',
      midDetail: 'Pair the body work with one cue such as recover, target, or neutral ball.',
      highTitle: 'Extend time only if posture holds.',
      highDetail: 'Add one round, not max effort. The goal is tennis quality under fatigue.',
    }
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
    return {
      lowTitle: 'Stop replaying the last point.',
      lowDetail: 'Turn away, breathe, and name the next intention before stepping back in.',
      midTitle: 'Use fewer words.',
      midDetail: 'Make the reset a short cue you can actually use between points.',
      highTitle: 'Use it after a good point too.',
      highDetail: 'The reset is stronger when it works after winners, misses, and messy points.',
    }
  }

  return {
    lowTitle: 'Shrink the rep until the cue appears.',
    lowDetail: 'Make the setup easier and count only the reps that match the proof.',
    midTitle: 'Repeat the cue before adding volume.',
    midDetail: 'One cleaner rep is more useful than ten rushed reps.',
    highTitle: 'Raise one variable at a time.',
    highDetail: 'Add pace, time, or pressure, but not all three at once.',
  }
}

function getCardNextPractice(card: LevelUpCard, rating: number | null) {
  if (rating === null) return null

  const proofName = card.proof.replace(' 0-5', '').toLowerCase()
  const doseGuide = getCardDoseGuide(card)
  const coachLens = getCardCoachLens(card)

  if (rating <= 1) {
    return {
      title: 'Shrink the drill.',
      detail: `Next time: ${card.regression} Score ${proofName} again before adding volume.`,
      dose: '1 short block. Stop after 3 clean reps.',
      focus: `Make this cue appear once: ${card.cue}`,
      coachAsk: `Ask for the easiest setup that still proves ${proofName}.`,
    }
  }

  if (rating <= 3) {
    return {
      title: 'Repeat the same standard.',
      detail: `Run the same card again and chase one cleaner cue: ${card.cue}`,
      dose: doseGuide.target,
      focus: `Repeat the same proof. Do not add speed yet.`,
      coachAsk: coachLens.ask,
    }
  }

  return {
    title: 'Raise the challenge.',
    detail: `Next time: ${card.progression} Keep the proof honest, not just harder.`,
    dose: 'Add 1 round or 1 target score.',
    focus: `Keep ${proofName} at 4/5 or better.`,
    coachAsk: `Ask whether to add pressure, pace, or decision speed next.`,
  }
}

function getCardSessionStandard(card: LevelUpCard) {
  const doseGuide = getCardDoseGuide(card)

  if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
    return {
      before: 'Pick the recovery spot and say recover before the first rep.',
      counts: 'The rep counts only if your feet return before you watch.',
      stop: 'Stop when the finish gets rushed or the ready spot gets vague.',
    }
  }

  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) {
    return {
      before: 'Choose one target family and one breath rhythm.',
      counts: 'The rep counts when the target call happens before the motion.',
      stop: 'Stop when makes and misses replace routine clarity.',
    }
  }

  if (card.tags.includes('serve-plus-one')) {
    return {
      before: 'Name the serve location and the plus-one shape together.',
      counts: 'The rep counts when the first ball matches the serve plan.',
      stop: 'Stop when the plus-one becomes a random second drill.',
    }
  }

  if (card.tags.includes('return-intent')) {
    return {
      before: 'Choose the return job before the server starts.',
      counts: 'The rep counts when intent and recovery both show up.',
      stop: 'Stop when you are guessing instead of choosing early.',
    }
  }

  if (card.tags.includes('defense-to-neutral') || card.tags.includes('wide-ball-reset')) {
    return {
      before: 'Decide that neutral is a win for this block.',
      counts: 'The rep counts when height, depth, and recovery buy time.',
      stop: 'Stop when defense turns into rushed hero-ball attempts.',
    }
  }

  if (card.tags.includes('attack-balance') || card.tags.includes('forward-close')) {
    return {
      before: 'Choose the balance cue before closing or attacking.',
      counts: 'The rep counts when you attack and still recover ready.',
      stop: 'Stop when speed beats balance.',
    }
  }

  if (card.tags.includes('doubles-communication') || card.tags.includes('partner-first-move')) {
    return {
      before: 'Agree on the call and the first move before the point.',
      counts: 'The rep counts when the partner can act without guessing.',
      stop: 'Stop when calls get late, long, or ignored.',
    }
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
    return {
      before: 'Pick one reset word before pressure appears.',
      counts: 'The rep counts when the next point starts with a clear intention.',
      stop: 'Stop when the reset becomes a speech.',
    }
  }

  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
    return {
      before: 'Check posture and breathing before starting the clock.',
      counts: 'The rep counts when tennis posture survives the work.',
      stop: doseGuide.stopRule,
    }
  }

  if (card.tags.includes('mobility') || card.tags.includes('stretch') || card.tags.includes('recovery')) {
    return {
      before: 'Take one readiness score before the reset.',
      counts: 'The rep counts when movement feels calmer and controlled.',
      stop: doseGuide.stopRule,
    }
  }

  return {
    before: 'Name the one tennis habit you want to see.',
    counts: 'The rep counts when the proof behavior is obvious.',
    stop: doseGuide.stopRule,
  }
}

function getCardRoundTarget(card: LevelUpCard, cleanRepTarget: number) {
  const cleanTarget = Math.max(2, Math.ceil(cleanRepTarget / 2))

  if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
    return {
      target: `${cleanTarget} recoveries before watching.`,
      quality: 'Finish, recover, then read the result.',
      missResponse: 'Slow the finish and shrink the recovery distance.',
    }
  }

  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) {
    return {
      target: `${cleanTarget} serves with target called first.`,
      quality: 'Same breath and tempo after makes and misses.',
      missResponse: 'Pause, call the target again, then serve.',
    }
  }

  if (card.tags.includes('serve-plus-one')) {
    return {
      target: `${cleanTarget} serve plus-one patterns that match.`,
      quality: 'Serve location creates the first-ball job.',
      missResponse: 'Name both shots before the next rep.',
    }
  }

  if (card.tags.includes('return-intent')) {
    return {
      target: `${cleanTarget} returns with intent chosen early.`,
      quality: 'Return job and recovery both show up.',
      missResponse: 'Choose one simpler return job before the toss.',
    }
  }

  if (card.tags.includes('defense-to-neutral') || card.tags.includes('wide-ball-reset')) {
    return {
      target: `${cleanTarget} balls that buy time back to neutral.`,
      quality: 'Height, depth, and recovery beat panic.',
      missResponse: 'Aim bigger and accept neutral as the win.',
    }
  }

  if (card.tags.includes('attack-balance') || card.tags.includes('forward-close')) {
    return {
      target: `${cleanTarget} attacks that finish balanced.`,
      quality: 'Speed never beats posture or recovery.',
      missResponse: 'Take one smaller first step and finish tall.',
    }
  }

  if (card.tags.includes('doubles-communication') || card.tags.includes('partner-first-move')) {
    return {
      target: `${cleanTarget} points where the call creates movement.`,
      quality: 'Short call, early move, partner can act.',
      missResponse: 'Make the next call earlier and shorter.',
    }
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
    return {
      target: `${cleanTarget} resets before the next point starts.`,
      quality: 'Breath, word, and intention are clear.',
      missResponse: 'Use fewer words and start the next point.',
    }
  }

  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
    return {
      target: `${cleanTarget} clean efforts with posture intact.`,
      quality: 'Quiet shoulders, steady breathing, playable legs.',
      missResponse: 'Cut the pace before posture changes.',
    }
  }

  if (card.tags.includes('mobility') || card.tags.includes('stretch') || card.tags.includes('recovery')) {
    return {
      target: `${cleanTarget} controlled positions without forcing range.`,
      quality: 'Movement gets calmer, not more aggressive.',
      missResponse: 'Back off range and breathe through control.',
    }
  }

  return {
    target: `${cleanTarget} reps where the cue is obvious.`,
    quality: 'The proof behavior shows up without guessing.',
    missResponse: 'Make the setup easier and repeat one cue.',
  }
}

function getVariantForRating(rating: number): ActiveDrillVariant {
  if (rating <= 1) return 'scale-down'
  if (rating <= 3) return 'repeat-clean'
  return 'add-pressure'
}

function getAdaptiveDrillVariantPlan(card: LevelUpCard, variant: ActiveDrillVariant) {
  const baseCommand = card.routine[1] ?? card.cue

  if (variant === 'scale-down') {
    return {
      label: 'Scale down',
      title: 'Shrink the rep before chasing more work.',
      detail: card.regression || 'Reduce speed, volume, or decision load until the proof behavior is visible again.',
      command: `Easier rep: ${card.cue}`,
      durationMinutes: Math.max(1, Math.ceil(card.durationMinutes / 2)),
    }
  }

  if (variant === 'repeat-clean') {
    return {
      label: 'Repeat clean',
      title: 'Same card. Cleaner proof.',
      detail: `Keep the setup the same and make this cue obvious: ${card.cue}`,
      command: baseCommand,
      durationMinutes: card.durationMinutes,
    }
  }

  if (variant === 'add-pressure') {
    return {
      label: 'Add pressure',
      title: 'Raise one variable, not three.',
      detail: card.progression || 'Add score, time, target, or recovery pressure while keeping the same tennis habit.',
      command: `Pressure rep: ${baseCommand}`,
      durationMinutes: card.durationMinutes,
    }
  }

  return {
    label: 'Base round',
    title: 'Run the card as written.',
    detail: 'Use the core setup first. Score the proof before changing the challenge.',
    command: baseCommand,
    durationMinutes: card.durationMinutes,
  }
}

function getAdaptiveCleanRepTarget(card: LevelUpCard, variant: ActiveDrillVariant) {
  const baseTarget = getCleanRepTarget(card)
  if (variant === 'scale-down') return Math.max(3, Math.ceil(baseTarget / 2))
  if (variant === 'add-pressure') return baseTarget + 2
  return baseTarget
}

function getAdaptiveRoundTarget(card: LevelUpCard, cleanRepTarget: number, variant: ActiveDrillVariant) {
  const baseTarget = getCardRoundTarget(card, cleanRepTarget)

  if (variant === 'scale-down') {
    return {
      target: `Easy version: ${baseTarget.target}`,
      quality: `Slow and obvious: ${baseTarget.quality}`,
      missResponse: `Make it smaller again. ${baseTarget.missResponse}`,
    }
  }

  if (variant === 'repeat-clean') {
    return {
      target: `Repeat the same target: ${baseTarget.target}`,
      quality: `No extra difficulty. ${baseTarget.quality}`,
      missResponse: `Return to the cue before the next rep. ${baseTarget.missResponse}`,
    }
  }

  if (variant === 'add-pressure') {
    return {
      target: `Pressure version: ${baseTarget.target}`,
      quality: `Keep the same proof under score, time, or target pressure. ${baseTarget.quality}`,
      missResponse: `Remove the pressure layer for one rep. ${baseTarget.missResponse}`,
    }
  }

  return baseTarget
}

function getRoundCompletePrompt(card: LevelUpCard, cleanRepCount: number, cleanRepTarget: number) {
  const proofName = card.proof.replace(' 0-5', '').toLowerCase()
  const countLine = `${cleanRepCount}/${cleanRepTarget} clean reps`

  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
    return {
      title: `${countLine}. Score posture before adding work.`,
      detail: `If ${proofName} stayed playable, save the score. If posture changed, repeat slower.`,
    }
  }

  if (card.tags.includes('mobility') || card.tags.includes('stretch') || card.tags.includes('recovery')) {
    return {
      title: `${countLine}. Recheck readiness now.`,
      detail: `Save the score if movement feels calmer. Repeat gently if control still feels rushed.`,
    }
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
    return {
      title: `${countLine}. Test it under one more point.`,
      detail: `Score now if the reset beat the replay. Repeat if the last point still followed you.`,
    }
  }

  return {
    title: `${countLine}. Decide before doing more.`,
    detail: `Score now if ${proofName} was clear. Repeat the round if the habit needed reminders.`,
  }
}

function getRoundResetCue(card: LevelUpCard) {
  if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
    return 'Walk back to ready, say recover first, then decide score or repeat.'
  }

  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target') || card.tags.includes('serve-plus-one')) {
    return 'Step off, breathe once, call the next target before touching the ball.'
  }

  if (card.tags.includes('return-intent')) {
    return 'Look across the net, choose the return job, then restart.'
  }

  if (card.tags.includes('defense-to-neutral') || card.tags.includes('wide-ball-reset')) {
    return 'Reset posture and remind yourself neutral is enough.'
  }

  if (card.tags.includes('attack-balance') || card.tags.includes('forward-close')) {
    return 'Check balance before speed. The next attack must finish ready.'
  }

  if (card.tags.includes('doubles-communication') || card.tags.includes('partner-first-move')) {
    return 'Make one short partner call before the next round.'
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
    return 'Use the reset word, breathe out, then start the next point plan.'
  }

  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
    return 'Stand tall, slow the breath, and only repeat if posture is still clean.'
  }

  if (card.tags.includes('mobility') || card.tags.includes('stretch') || card.tags.includes('recovery')) {
    return 'Recheck range without forcing it. Control decides the next round.'
  }

  return 'Take one breath, name the cue, then score or repeat.'
}

function getCardRepLadder(card: LevelUpCard) {
  if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
    return [
      { label: 'Find it', action: 'Shadow one contact and recover before you look.' },
      { label: 'Repeat it', action: 'Stack three clean recoveries from the same finish.' },
      { label: 'Pressure it', action: 'Add a target or score call while recovery stays first.' },
    ]
  }

  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) {
    return [
      { label: 'Find it', action: 'Call target, breathe, and serve at half pace.' },
      { label: 'Repeat it', action: 'Keep the same routine for five balls, makes or misses.' },
      { label: 'Pressure it', action: 'Play 30-30 or second-serve score with the same target call.' },
    ]
  }

  if (card.tags.includes('serve-plus-one')) {
    return [
      { label: 'Find it', action: 'Name serve location and first-ball shape before starting.' },
      { label: 'Repeat it', action: 'Run the same pattern until the plus-one job is obvious.' },
      { label: 'Pressure it', action: 'Add a point start where only planned plus-ones count.' },
    ]
  }

  if (card.tags.includes('return-intent')) {
    return [
      { label: 'Find it', action: 'Choose block, drive, or height before the toss.' },
      { label: 'Repeat it', action: 'Score only returns where intent was early.' },
      { label: 'Pressure it', action: 'Start points with one return job and recover after contact.' },
    ]
  }

  if (card.tags.includes('defense-to-neutral') || card.tags.includes('wide-ball-reset')) {
    return [
      { label: 'Find it', action: 'Accept neutral as the win before the rep starts.' },
      { label: 'Repeat it', action: 'Send height and depth, then recover balanced.' },
      { label: 'Pressure it', action: 'Add a live ball after the reset and defend the next shot.' },
    ]
  }

  if (card.tags.includes('attack-balance') || card.tags.includes('forward-close')) {
    return [
      { label: 'Find it', action: 'Move forward only as fast as balance allows.' },
      { label: 'Repeat it', action: 'Finish the attack and hold ready posture.' },
      { label: 'Pressure it', action: 'Add a pass or recovery ball after the close.' },
    ]
  }

  if (card.tags.includes('doubles-communication') || card.tags.includes('partner-first-move')) {
    return [
      { label: 'Find it', action: 'Say the call early enough for your partner to move.' },
      { label: 'Repeat it', action: 'Run three points where call and first move match.' },
      { label: 'Pressure it', action: 'Play 30-30 and keep the call short under score.' },
    ]
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
    return [
      { label: 'Find it', action: 'Use the reset word before the next point starts.' },
      { label: 'Repeat it', action: 'Pair breath, target, and first intention for three points.' },
      { label: 'Pressure it', action: 'Use it after a miss, winner, and long rally.' },
    ]
  }

  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
    return [
      { label: 'Find it', action: 'Start controlled enough that posture stays quiet.' },
      { label: 'Repeat it', action: 'Hold quality through the middle of the block.' },
      { label: 'Pressure it', action: 'Add one tennis decision only if posture stays clean.' },
    ]
  }

  if (card.tags.includes('mobility') || card.tags.includes('stretch') || card.tags.includes('recovery')) {
    return [
      { label: 'Find it', action: 'Move slowly enough to notice the first tight spot.' },
      { label: 'Repeat it', action: 'Breathe through the reset without forcing range.' },
      { label: 'Pressure it', action: 'Recheck readiness and pick the next light habit.' },
    ]
  }

  return [
    { label: 'Find it', action: 'Make the cue obvious on one clean rep.' },
    { label: 'Repeat it', action: 'Stack the same habit without changing the drill.' },
    { label: 'Pressure it', action: 'Add one challenge while the proof stays visible.' },
  ]
}

function getCardProofAnchors(card: LevelUpCard) {
  if (card.proofAnchors) return card.proofAnchors

  if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
    return {
      low: 'You watched first or missed the ready spot.',
      mid: 'Recovery showed up, but needed reminders.',
      high: 'Recovery happened before watching without a reminder.',
    }
  }

  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) {
    return {
      low: 'Targets got vague or routine changed after misses.',
      mid: 'The routine showed up for some reps.',
      high: 'Target, breath, and tempo stayed clear under pressure.',
    }
  }

  if (card.tags.includes('serve-plus-one')) {
    return {
      low: 'Serve and first ball were disconnected.',
      mid: 'The pattern connected sometimes.',
      high: 'Serve target created a clear first-ball job.',
    }
  }

  if (card.tags.includes('return-intent')) {
    return {
      low: 'You reacted late or guessed.',
      mid: 'Intent appeared, but recovery was uneven.',
      high: 'Intent was early and recovery followed contact.',
    }
  }

  if (card.tags.includes('defense-to-neutral') || card.tags.includes('wide-ball-reset')) {
    return {
      low: 'The wide ball created panic or rushed attack.',
      mid: 'You bought time on some balls.',
      high: 'You defended, recovered, and earned neutral repeatedly.',
    }
  }

  if (card.tags.includes('attack-balance') || card.tags.includes('forward-close')) {
    return {
      low: 'Attack speed beat balance.',
      mid: 'Balance held on some reps.',
      high: 'Attack, finish, and recovery stayed connected.',
    }
  }

  if (card.tags.includes('doubles-communication') || card.tags.includes('partner-first-move')) {
    return {
      low: 'Partner had to guess.',
      mid: 'Calls were clear sometimes.',
      high: 'Call and first move were early and connected.',
    }
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
    return {
      low: 'The last point carried into the next one.',
      mid: 'Reset worked sometimes.',
      high: 'Reset happened before the next point started.',
    }
  }

  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
    return {
      low: 'Quality changed before the block ended.',
      mid: 'Posture held for part of the work.',
      high: 'Posture, breath, and decision stayed playable.',
    }
  }

  if (card.tags.includes('mobility') || card.tags.includes('stretch') || card.tags.includes('recovery')) {
    return {
      low: 'You forced range or rushed.',
      mid: 'Movement calmed down in spots.',
      high: 'You finished controlled and more ready.',
    }
  }

  return {
    low: 'The habit did not show up yet.',
    mid: 'The habit appeared with reminders.',
    high: 'The habit was repeatable today.',
  }
}

function getCardProofStandard(card: LevelUpCard) {
  if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
    return 'You move back to ready before judging the shot.'
  }

  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) {
    return 'You call the target and keep the same routine under score pressure.'
  }

  if (card.tags.includes('serve-plus-one')) {
    return 'The serve target and first-ball plan match.'
  }

  if (card.tags.includes('return-intent')) {
    return 'You choose the return job before the toss and recover after contact.'
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
    return 'You reset before the next point starts, not after the next mistake.'
  }

  if (card.tags.includes('defense-to-neutral') || card.tags.includes('wide-ball-reset')) {
    return 'The defensive ball buys time and your recovery stays balanced.'
  }

  if (card.tags.includes('attack-balance') || card.tags.includes('forward-close')) {
    return 'You attack from balance and finish ready for the next ball.'
  }

  if (card.tags.includes('doubles-communication') || card.tags.includes('partner-first-move')) {
    return 'Your partner can hear the plan and see the first move.'
  }

  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
    return 'Movement quality stays controlled as the work gets harder.'
  }

  if (card.tags.includes('mobility') || card.tags.includes('stretch') || card.tags.includes('recovery')) {
    return 'You finish calmer, controlled, and ready for the next session.'
  }

  return 'You can repeat the cue without needing a coach reminder.'
}

function getCardPurposeLabel(card: LevelUpCard) {
  if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
    return 'Recovery before watching'
  }

  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) {
    return 'Serve routine clarity'
  }

  if (card.tags.includes('serve-plus-one')) {
    return 'Serve plus-one pattern'
  }

  if (card.tags.includes('return-intent')) {
    return 'Return intent'
  }

  if (card.tags.includes('defense-to-neutral') || card.tags.includes('wide-ball-reset')) {
    return 'Defense back to neutral'
  }

  if (card.tags.includes('attack-balance') || card.tags.includes('forward-close')) {
    return 'Attack with balance'
  }

  if (card.tags.includes('doubles-communication') || card.tags.includes('partner-first-move')) {
    return 'Doubles first move'
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
    return 'Between-point reset'
  }

  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
    return 'Posture under fatigue'
  }

  if (card.tags.includes('wall-work')) {
    return 'Wall reps that transfer'
  }

  if (card.tags.includes('mobility') || card.tags.includes('stretch') || card.tags.includes('recovery')) {
    return 'Recovery readiness'
  }

  if (card.category === 'strength-stability') {
    return 'Tennis posture strength'
  }

  return card.tags[0]?.replaceAll('-', ' ') ?? 'Tennis habit'
}

function getCardSettingLabel(card: LevelUpCard) {
  if (card.setting.includes('court')) return 'Court'
  if (card.setting.includes('wall')) return 'Wall'
  if (card.setting.includes('home')) return 'Home'
  if (card.setting.includes('gym')) return 'Gym'
  if (card.setting.includes('match-day')) return 'Match day'
  return formatLabel(card.setting[0] ?? 'anywhere')
}

function getCardCoachSignal(card: LevelUpCard) {
  if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
    return 'Recovery showed up'
  }

  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) {
    return 'Target stayed clear'
  }

  if (card.tags.includes('serve-plus-one')) {
    return 'First ball had a plan'
  }

  if (card.tags.includes('return-intent')) {
    return 'Return job was chosen'
  }

  if (card.tags.includes('doubles-communication') || card.tags.includes('partner-first-move')) {
    return 'Partner heard the plan'
  }

  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
    return 'Quality held late'
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
    return 'Reset beat the replay'
  }

  return 'Proof score plus one cue'
}

function getCardQualityChecks(card: LevelUpCard) {
  if (card.qualityChecks?.length) return card.qualityChecks

  if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
    return [
      'Finish balanced before you look for the result.',
      'Recover through the target spot, not around it.',
      'Start the next rep from a real ready position.',
    ]
  }

  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) {
    return [
      'Call the target before the motion starts.',
      'Keep the same breath and tempo after a miss.',
      'Score routine clarity separately from serve makes.',
    ]
  }

  if (card.tags.includes('serve-plus-one')) {
    return [
      'Name the serve target and expected plus-one before starting.',
      'Recover into the first-ball position after the serve.',
      'Count the rep only when the first ball matches the plan.',
    ]
  }

  if (card.tags.includes('return-intent')) {
    return [
      'Choose the return job before the server tosses.',
      'Use active feet without jumping early.',
      'Recover after contact before judging the return.',
    ]
  }

  if (card.tags.includes('defense-to-neutral') || card.tags.includes('wide-ball-reset')) {
    return [
      'Use height or shape to buy time.',
      'Recover before changing direction again.',
      'Do not turn stretched defense into a low-percentage attack.',
    ]
  }

  if (card.tags.includes('attack-balance') || card.tags.includes('forward-close')) {
    return [
      'Attack only from a balanced contact.',
      'Close with control instead of rushing the last steps.',
      'Finish ready for the next ball, not admiring the shot.',
    ]
  }

  if (card.tags.includes('doubles-communication') || card.tags.includes('partner-first-move')) {
    return [
      'Make the call early enough for your partner to move.',
      'Use one clear word or phrase, not a long explanation.',
      'Reset together after confusion before the next point.',
    ]
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
    return [
      'Turn away from the last point before planning the next one.',
      'Use one breath and one short cue.',
      'Step back in only when the next intention is clear.',
    ]
  }

  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
    return [
      'Keep posture cleaner than the clock.',
      'Stop the block when movement quality changes.',
      'Connect the tired body to one tennis decision.',
    ]
  }

  if (card.tags.includes('mobility') || card.tags.includes('stretch') || card.tags.includes('recovery')) {
    return [
      'Move slowly enough to stay relaxed.',
      'Do not force range or chase discomfort.',
      'Finish with a simple readiness score.',
    ]
  }

  return [
    'Start with the cue, not the clock.',
    'Count only reps that match the tennis habit.',
    'Log one proof score before adding more work.',
  ]
}

function getCardReadinessCheck(card: LevelUpCard) {
  if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
    return {
      check: 'Pick the exact ready spot before the first rep.',
      readyMeans: 'you know where your feet should finish after contact.',
    }
  }

  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) {
    return {
      check: 'Choose one serve target and one breath rhythm.',
      readyMeans: 'the target is named before the motion starts.',
    }
  }

  if (card.tags.includes('serve-plus-one')) {
    return {
      check: 'Name the serve target and the first-ball shape together.',
      readyMeans: 'the plus-one is planned before the serve begins.',
    }
  }

  if (card.tags.includes('return-intent')) {
    return {
      check: 'Choose the return job before the server begins.',
      readyMeans: 'your feet support a decision you already made.',
    }
  }

  if (card.tags.includes('defense-to-neutral') || card.tags.includes('wide-ball-reset')) {
    return {
      check: 'Decide that neutral is a win before starting.',
      readyMeans: 'height, shape, and recovery matter more than a highlight ball.',
    }
  }

  if (card.tags.includes('attack-balance') || card.tags.includes('forward-close')) {
    return {
      check: 'Pick the balance cue before you attack.',
      readyMeans: 'you can finish forward and still be ready for the next ball.',
    }
  }

  if (card.tags.includes('doubles-communication') || card.tags.includes('partner-first-move')) {
    return {
      check: 'Agree on the first call before the point or rep starts.',
      readyMeans: 'both partners know the word and the move it triggers.',
    }
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
    return {
      check: 'Choose the reset cue before pressure shows up.',
      readyMeans: 'one breath and one short intention are enough.',
    }
  }

  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
    return {
      check: 'Notice posture and breathing before the timer starts.',
      readyMeans: 'you can move with control before adding fatigue.',
    }
  }

  if (card.tags.includes('mobility') || card.tags.includes('stretch') || card.tags.includes('recovery')) {
    return {
      check: 'Score readiness before the reset begins.',
      readyMeans: 'the goal is calmer movement, not more intensity.',
    }
  }

  return {
    check: 'Name the one tennis habit you want to see.',
    readyMeans: 'the first rep has a cue, a proof score, and a reason.',
  }
}

function getCardTrainingOptions(card: LevelUpCard) {
  if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
    return {
      solo: 'Shadow the contact, recover to the ready spot, then score whether you moved before watching.',
      partner: 'Have a partner call recover after contact or feed one ball while you finish through the recovery spot.',
    }
  }

  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) {
    return {
      solo: 'Serve or shadow in small batches, calling the target before every rep.',
      partner: 'Ask a partner to track whether your target call and routine stay the same after misses.',
    }
  }

  if (card.tags.includes('serve-plus-one')) {
    return {
      solo: 'Shadow serve plus-one patterns with one target and one first-ball shape.',
      partner: 'Serve to a partner return and play only the plus-one ball before resetting.',
    }
  }

  if (card.tags.includes('return-intent')) {
    return {
      solo: 'Use shadow returns or wall starts and call block, drive, height, or depth before moving.',
      partner: 'Have a server or feeder vary pace while you call the return job early.',
    }
  }

  if (card.tags.includes('defense-to-neutral') || card.tags.includes('wide-ball-reset')) {
    return {
      solo: 'Shadow wide-ball recovery from outside the singles line with height and reset as the goal.',
      partner: 'Ask for wide feeds and count only reps that buy time and recover to neutral.',
    }
  }

  if (card.tags.includes('attack-balance') || card.tags.includes('forward-close')) {
    return {
      solo: 'Shadow short-ball attacks and freeze the finish in a balanced ready position.',
      partner: 'Use cooperative short feeds and play one extra ball after the attack to prove recovery.',
    }
  }

  if (card.tags.includes('doubles-communication') || card.tags.includes('partner-first-move')) {
    return {
      solo: 'Walk the first move and say the call out loud before each shadow rep.',
      partner: 'Run short point starts where the call must happen before the first move.',
    }
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
    return {
      solo: 'Rehearse the reset after imaginary misses, winners, and tight scores.',
      partner: 'Play short games where each point must start with the reset cue.',
    }
  }

  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
    return {
      solo: 'Use timed rounds and score posture before adding another round.',
      partner: 'Have a partner call the tennis decision after the tired block so the body work transfers.',
    }
  }

  if (card.tags.includes('mobility') || card.tags.includes('stretch') || card.tags.includes('recovery')) {
    return {
      solo: 'Run the reset quietly and compare readiness before and after.',
      partner: 'Use it after hitting and share only the readiness score and one movement note.',
    }
  }

  return {
    solo: 'Run the smallest version of the card and score the proof before adding volume.',
    partner: 'Ask a partner to watch for the proof behavior, not just the drill result.',
  }
}

function getCardCommonMiss(card: LevelUpCard) {
  if (card.commonMiss) return card.commonMiss

  if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
    return {
      miss: 'You hit, watch, and arrive late to the next ready spot.',
      fix: 'Say recover out loud and make the ready spot the finish line for every rep.',
    }
  }

  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) {
    return {
      miss: 'The serve rep starts before the target and routine are clear.',
      fix: 'Pause long enough to call the target, then keep the same breath after misses and makes.',
    }
  }

  if (card.tags.includes('serve-plus-one')) {
    return {
      miss: 'The serve and first ball become two disconnected actions.',
      fix: 'Name both shots before starting: serve target first, plus-one shape second.',
    }
  }

  if (card.tags.includes('return-intent')) {
    return {
      miss: 'You react to the serve without choosing the return job first.',
      fix: 'Pick block, drive, or height before the toss and judge the rep by intent, not outcome.',
    }
  }

  if (card.tags.includes('defense-to-neutral') || card.tags.includes('wide-ball-reset')) {
    return {
      miss: 'A stretched ball turns into a rushed winner attempt.',
      fix: 'Use height, shape, and recovery to earn neutral before changing direction.',
    }
  }

  if (card.tags.includes('attack-balance') || card.tags.includes('forward-close')) {
    return {
      miss: 'You attack faster than your balance can support.',
      fix: 'Make the first close step controlled and finish ready for the next ball.',
    }
  }

  if (card.tags.includes('doubles-communication') || card.tags.includes('partner-first-move')) {
    return {
      miss: 'The call comes after your partner already had to guess.',
      fix: 'Use one early call before the point or first move, then reset together after confusion.',
    }
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
    return {
      miss: 'The last point keeps playing in your head as the next point starts.',
      fix: 'Turn away, exhale, and name one next intention before stepping back in.',
    }
  }

  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
    return {
      miss: 'The clock keeps running after tennis posture breaks.',
      fix: 'Shorten the interval and protect posture before adding time, speed, or another round.',
    }
  }

  if (card.tags.includes('mobility') || card.tags.includes('stretch') || card.tags.includes('recovery')) {
    return {
      miss: 'The reset turns into forced stretching or extra work.',
      fix: 'Move slowly, breathe, and stop at controlled range without chasing discomfort.',
    }
  }

  return {
    miss: 'The rep gets completed, but the tennis habit is not obvious.',
    fix: 'Restart with one cue and count only reps that match the proof.',
  }
}

function getMissedRepPattern(card: LevelUpCard, commonMiss: { miss: string; fix: string }, missedRepCount: number) {
  const missCountLabel = missedRepCount === 1 ? '1 miss logged' : `${missedRepCount} misses logged`
  const base = {
    title: `${missCountLabel}: fix the habit before adding reps.`,
    detail: `${commonMiss.miss} ${commonMiss.fix}`,
    cleanRepStandard: 'Next clean rep: one obvious cue, one balanced finish.',
  }

  if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
    return {
      title: `${missCountLabel}: you may be watching before recovering.`,
      detail: commonMiss.fix,
      cleanRepStandard: 'Next clean rep: finish, recover to ready, then look.',
    }
  }

  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target') || card.tags.includes('serve-plus-one')) {
    return {
      title: `${missCountLabel}: restart the serve plan.`,
      detail: commonMiss.fix,
      cleanRepStandard: 'Next clean rep: target called before toss, same breath after contact.',
    }
  }

  if (card.tags.includes('return-intent') || card.tags.includes('return-recovery')) {
    return {
      title: `${missCountLabel}: choose before the toss.`,
      detail: commonMiss.fix,
      cleanRepStandard: 'Next clean rep: return job named early and recovery started after contact.',
    }
  }

  if (card.tags.includes('defense-to-neutral') || card.tags.includes('wide-ball-reset')) {
    return {
      title: `${missCountLabel}: neutral is the win here.`,
      detail: commonMiss.fix,
      cleanRepStandard: 'Next clean rep: height or shape buys time, then recover balanced.',
    }
  }

  if (card.tags.includes('attack-balance') || card.tags.includes('forward-close')) {
    return {
      title: `${missCountLabel}: slow the close before speeding up.`,
      detail: commonMiss.fix,
      cleanRepStandard: 'Next clean rep: close under control and finish ready for the next ball.',
    }
  }

  if (card.tags.includes('doubles-communication') || card.tags.includes('partner-first-move')) {
    return {
      title: `${missCountLabel}: make the call earlier.`,
      detail: commonMiss.fix,
      cleanRepStandard: 'Next clean rep: one clear call before your partner has to guess.',
    }
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
    return {
      title: `${missCountLabel}: reset before the next point starts.`,
      detail: commonMiss.fix,
      cleanRepStandard: 'Next clean rep: exhale, name the next intention, then step in.',
    }
  }

  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
    return {
      title: `${missCountLabel}: protect tennis posture.`,
      detail: commonMiss.fix,
      cleanRepStandard: 'Next clean rep: posture stays playable before more time or speed.',
    }
  }

  if (card.tags.includes('mobility') || card.tags.includes('stretch') || card.tags.includes('recovery')) {
    return {
      title: `${missCountLabel}: control beats range.`,
      detail: commonMiss.fix,
      cleanRepStandard: 'Next clean rep: slow controlled range with no forced position.',
    }
  }

  return base
}

function getCardDoseGuide(card: LevelUpCard) {
  if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
    return {
      target: '2-3 short rounds where recovery happens before watching.',
      stopRule: 'your ready spot disappears or you start rushing the finish.',
    }
  }

  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) {
    return {
      target: '12-18 serves or shadows with one target and the same routine.',
      stopRule: 'you are counting makes but no longer scoring routine clarity.',
    }
  }

  if (card.tags.includes('serve-plus-one')) {
    return {
      target: '8-12 planned serve plus-one patterns with a reset between reps.',
      stopRule: 'the first ball is no longer connected to the serve target.',
    }
  }

  if (card.tags.includes('return-intent')) {
    return {
      target: '3 rounds of 6 return starts with the job called early.',
      stopRule: 'you start reacting late instead of choosing the return job.',
    }
  }

  if (card.tags.includes('defense-to-neutral') || card.tags.includes('wide-ball-reset')) {
    return {
      target: '10-16 wide-ball reps where height, shape, and recovery stay clean.',
      stopRule: 'neutral resets turn into panic attacks or balance breaks.',
    }
  }

  if (card.tags.includes('attack-balance') || card.tags.includes('forward-close')) {
    return {
      target: '8-12 attack reps where balance and recovery count more than winners.',
      stopRule: 'you rush the close or finish stuck after contact.',
    }
  }

  if (card.tags.includes('doubles-communication') || card.tags.includes('partner-first-move')) {
    return {
      target: 'One short game or 10 reps where the call happens before the first move.',
      stopRule: 'the call gets late, long, or ignored by either partner.',
    }
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
    return {
      target: 'Use the reset for 5-8 points, including after a miss and after a good point.',
      stopRule: 'the routine becomes a speech instead of one breath and one cue.',
    }
  }

  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
    return {
      target: '2-4 controlled rounds where tennis posture still looks playable.',
      stopRule: 'pain changes movement, posture breaks, or breathing takes over the drill.',
    }
  }

  if (card.tags.includes('mobility') || card.tags.includes('stretch') || card.tags.includes('recovery')) {
    return {
      target: '5-8 quiet minutes with a before-and-after readiness score.',
      stopRule: 'you force range, chase discomfort, or turn the reset into conditioning.',
    }
  }

  return {
    target: `${card.durationMinutes} minutes or 2 clean rounds with one proof score.`,
    stopRule: 'the cue is gone and you are only finishing reps.',
  }
}

function getCardTransferGuide(card: LevelUpCard) {
  if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
    return {
      moment: 'After any ball you like, miss, or feel proud of.',
      action: 'finish the swing, recover to ready, then let yourself watch the result.',
    }
  }

  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) {
    return {
      moment: 'Before first serves, second serves, and pressure serves.',
      action: 'call the target quietly and run the same breath before caring about the score.',
    }
  }

  if (card.tags.includes('serve-plus-one')) {
    return {
      moment: 'When your serve earns a predictable first ball.',
      action: 'start the point with a serve target and one plus-one shape already chosen.',
    }
  }

  if (card.tags.includes('return-intent')) {
    return {
      moment: 'Before the server starts the toss.',
      action: 'choose block, drive, height, or depth early enough that your feet can support it.',
    }
  }

  if (card.tags.includes('defense-to-neutral') || card.tags.includes('wide-ball-reset')) {
    return {
      moment: 'When you are stretched, late, or outside the singles line.',
      action: 'use height and recovery to earn neutral before trying to change direction.',
    }
  }

  if (card.tags.includes('attack-balance') || card.tags.includes('forward-close')) {
    return {
      moment: 'When a shorter ball invites you forward.',
      action: 'attack from balance and finish ready instead of treating the first attack as the last shot.',
    }
  }

  if (card.tags.includes('doubles-communication') || card.tags.includes('partner-first-move')) {
    return {
      moment: 'Before serve, return, middle balls, and switches.',
      action: 'make one early call your partner can act on without a discussion.',
    }
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
    return {
      moment: 'After misses, winners, long points, and tight-score points.',
      action: 'turn away, breathe once, name the next intention, and step back in.',
    }
  }

  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
    return {
      moment: 'Late in games, long rallies, or after a hard movement sequence.',
      action: 'notice whether posture and decision quality stay playable when legs get loud.',
    }
  }

  if (card.tags.includes('mobility') || card.tags.includes('stretch') || card.tags.includes('recovery')) {
    return {
      moment: 'After practice, after matches, or before the next training day.',
      action: 'use the readiness score to choose whether tomorrow should be build, repeat, or recover.',
    }
  }

  return {
    moment: 'In the first live point where this habit naturally appears.',
    action: 'look for the cue once, score it honestly, and bring that proof to the next practice.',
  }
}

function getCardCoachLens(card: LevelUpCard) {
  if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
    return {
      watch: 'Does the player recover before reacting to the shot result?',
      ask: 'Which ball made you want to watch instead of recover?',
    }
  }

  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) {
    return {
      watch: 'Does the routine stay the same after misses and pressure scores?',
      ask: 'Which target stayed clear when the score felt loud?',
    }
  }

  if (card.tags.includes('serve-plus-one')) {
    return {
      watch: 'Does the player recover into a first-ball plan after the serve?',
      ask: 'Which serve target gave you the cleanest plus-one look?',
    }
  }

  if (card.tags.includes('return-intent')) {
    return {
      watch: 'Does the return job get chosen before the ball is already on the player?',
      ask: 'Which return job felt clear earliest?',
    }
  }

  if (card.tags.includes('defense-to-neutral') || card.tags.includes('wide-ball-reset')) {
    return {
      watch: 'Does the player buy time from defense instead of forcing offense?',
      ask: 'When did height or shape help you get back to neutral?',
    }
  }

  if (card.tags.includes('attack-balance') || card.tags.includes('forward-close')) {
    return {
      watch: 'Does the attack start from balance and finish ready for the next ball?',
      ask: 'Which attack felt controlled enough to repeat under pressure?',
    }
  }

  if (card.tags.includes('doubles-communication') || card.tags.includes('partner-first-move')) {
    return {
      watch: 'Does the call happen early enough for the partner to act?',
      ask: 'Which call made your partner move sooner?',
    }
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
    return {
      watch: 'Does the reset happen before the next point starts?',
      ask: 'What trigger needed the reset most today?',
    }
  }

  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
    return {
      watch: 'Does tennis posture and decision quality survive the tired block?',
      ask: 'When did the body start changing the decision?',
    }
  }

  if (card.tags.includes('mobility') || card.tags.includes('stretch') || card.tags.includes('recovery')) {
    return {
      watch: 'Does the reset improve readiness without becoming extra intensity?',
      ask: 'What felt more playable after the reset?',
    }
  }

  return {
    watch: 'Does the proof score match a visible tennis habit?',
    ask: 'What would make this habit easier to repeat next practice?',
  }
}

function getCardAvoidCue(card: LevelUpCard) {
  if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
    return 'Do not hit and watch. Recover first, then read.'
  }

  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) {
    return 'Do not rush into the motion without naming the target.'
  }

  if (card.tags.includes('serve-plus-one')) {
    return 'Do not treat the serve and next ball as separate reps.'
  }

  if (card.tags.includes('return-intent')) {
    return 'Do not wait to decide until the ball is already on you.'
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
    return 'Do not rehearse the last miss while the next point starts.'
  }

  if (card.tags.includes('defense-to-neutral') || card.tags.includes('wide-ball-reset')) {
    return 'Do not turn every stretched ball into a low-percentage attack.'
  }

  if (card.tags.includes('attack-balance') || card.tags.includes('forward-close')) {
    return 'Do not attack faster than your balance can support.'
  }

  if (card.tags.includes('doubles-communication') || card.tags.includes('partner-first-move')) {
    return 'Do not make your partner guess the first move.'
  }

  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
    return 'Do not chase max effort after posture breaks.'
  }

  if (card.tags.includes('mobility') || card.tags.includes('stretch') || card.tags.includes('recovery')) {
    return 'Do not force range or turn the reset into a workout.'
  }

  return 'Do not add volume until the cue is clear.'
}

function getCardCoachHandoff(card: LevelUpCard) {
  if (card.tags.includes('recovery-after-contact') || card.tags.includes('recover-before-watching')) {
    return 'Tell your coach when recovery happened before watching and when it disappeared.'
  }

  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) {
    return 'Bring your clearest target, your proof score, and the pressure score where routine changed.'
  }

  if (card.tags.includes('serve-plus-one')) {
    return 'Share which serve target created the cleanest first ball.'
  }

  if (card.tags.includes('return-intent')) {
    return 'Bring the return job that felt clearest and the one that felt rushed.'
  }

  if (card.tags.includes('pressure-reset') || card.tags.includes('between-points')) {
    return 'Share the trigger that needed the reset and whether the next point started cleaner.'
  }

  if (card.tags.includes('defense-to-neutral') || card.tags.includes('wide-ball-reset')) {
    return 'Tell your coach whether the reset ball bought time or turned into panic.'
  }

  if (card.tags.includes('attack-balance') || card.tags.includes('forward-close')) {
    return 'Share whether your best attacks came from balance or from rushing.'
  }

  if (card.tags.includes('doubles-communication') || card.tags.includes('partner-first-move')) {
    return 'Bring the partner call that helped the first move happen sooner.'
  }

  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) {
    return 'Share when posture changed and whether decision quality stayed clear.'
  }

  if (card.tags.includes('mobility') || card.tags.includes('stretch') || card.tags.includes('recovery')) {
    return 'Tell your coach what felt better after the reset and what still felt limited.'
  }

  return 'Bring one proof score, one cue that helped, and one question for the next lesson.'
}

function getCardSetupLabel(card: LevelUpCard) {
  const usefulEquipment = card.equipment.filter((item) => item !== 'none')

  if (!usefulEquipment.length) return 'No gear needed'
  if (usefulEquipment.includes('partner')) return 'Partner and one clear rule'
  if (usefulEquipment.includes('cones')) return 'Cones or court markers'
  if (usefulEquipment.includes('wall')) return 'Wall space and target'
  if (usefulEquipment.includes('jump-rope')) return 'Rope and quiet landings'
  if (usefulEquipment.includes('resistance-band')) return 'Band and control'
  if (usefulEquipment.includes('basket')) return 'Basket and target'

  return `${formatLabel(usefulEquipment[0])} ready`
}

function EquipmentPill({ equipment }: { equipment: string }) {
  return <span className={styles.equipmentPill}>{formatLabel(equipment)}</span>
}

function DurationPill({ minutes }: { minutes: number }) {
  return <span className={styles.durationPill}>{minutes} min</span>
}

function LevelUpSafetyNote() {
  return (
    <aside className={styles.levelUpSafetyNote}>
      Move well before adding speed. Stop if pain changes your movement. Choose control before intensity. Jump rope should be light and quiet, not max effort. Cone drills should stay controlled before they get fast. Shadow swings should finish balanced. Wall sits should challenge the legs without changing posture or causing pain. For young players, strength work should be technique-first and supervised. The goal is better tennis habits, not max lifting.
    </aside>
  )
}

function LevelUpSyncStatus({ state }: { state: CompletionSyncState }) {
  if (!state.message) return null

  return (
    <aside className={styles.levelUpSyncStatus} data-sync-status={state.status} aria-live="polite">
      <span>{state.status === 'synced' ? 'History synced' : state.status === 'syncing' ? 'Saving proof' : 'Proof saved'}</span>
      <strong>{state.message}</strong>
    </aside>
  )
}

function LevelUpLocalSyncProof() {
  return (
    <aside className={styles.levelUpLocalSyncProof} aria-label="Level Up local sync proof">
      <div>
        <span>Level Up local sync proof</span>
        <strong>Know what follows you.</strong>
      </div>
      <div>
        <p>Saved first: rating, tiny note, timer, focus, and proof history stay in this browser immediately.</p>
        <p>Syncs when connected: {PLAYER_TIER_NAME} history or coach-invited proof can reach Level Up sessions after sign-in.</p>
        <p>Local-only in v1: favorites and copied coach-update sent markers stay on this device for now.</p>
      </div>
    </aside>
  )
}

function usePlayerCoachChallenges(identitySlug: string): [LevelUpCoachChallenge[], CoachChallengeState] {
  const [challenges, setChallenges] = useState<LevelUpCoachChallenge[]>([])
  const [state, setState] = useState<CoachChallengeState>({ status: 'idle', message: '' })

  useEffect(() => {
    let active = true

    void (async () => {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setState({ status: 'preview', message: 'Sign in from a coach invite to see assigned cards here.' })
        return
      }

      try {
        setState({ status: 'loading', message: 'Checking for coach-assigned work...' })
        const response = await fetch('/api/player/coach-assignments', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = (await response.json()) as {
          ok?: boolean
          coachLinks?: CoachStudentLink[]
          assignments?: CoachAssignment[]
          message?: string
        }
        if (!response.ok || !json.ok) {
          throw new Error(json.message || 'Coach assignments are not available right now.')
        }
        if (!active) return

        const links = json.coachLinks ?? []
        const linkedChallenges = (json.assignments ?? [])
          .filter((assignment) => assignment.status === 'assigned' || assignment.status === 'completed')
          .map((assignment) => buildCoachChallengeFromAssignment(assignment, links))
          .filter((challenge): challenge is LevelUpCoachChallenge => Boolean(challenge))
          .filter((challenge) => {
            const linkIdentity = challenge.link?.identitySlug
            return !linkIdentity || linkIdentity === identitySlug || challenge.card.identitySlugs?.includes(identitySlug)
          })

        setChallenges(linkedChallenges)
        setState({
          status: linkedChallenges.length ? 'linked' : 'preview',
          message: linkedChallenges.length
            ? `${linkedChallenges.length} coach challenge${linkedChallenges.length === 1 ? '' : 's'} ready.`
            : 'No coach challenge assigned yet. Use the preview mission or ask your coach to assign one.',
        })
      } catch (error) {
        if (active) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Coach assignments are not available right now.',
          })
        }
      }
    })()

    return () => {
      active = false
    }
  }, [identitySlug])

  return [challenges, state]
}

function useLevelUpFavorites(): [string[], (cardId: string) => void] {
  const [favorites, setFavorites] = useState<string[]>([])

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setFavorites(readStringList('tiq-level-up-favorites'))
    }, STORED_STATE_HYDRATION_DELAY_MS)
    return () => window.clearTimeout(hydrationTimer)
  }, [])

  function toggle(cardId: string) {
    setFavorites((current) => {
      const next = current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId]
      window.localStorage.setItem('tiq-level-up-favorites', JSON.stringify(next))
      return next
    })
  }
  return [favorites, toggle]
}

function useLocalCoachAssignments(identitySlug: string): [LevelUpCoachChallenge[], (payload: CoachAssignmentBuilderPayload) => void] {
  const storageKey = `${LEVEL_UP_LOCAL_COACH_ASSIGNMENTS_KEY}:${identitySlug}`
  const [challenges, setChallenges] = useState<LevelUpCoachChallenge[]>([])

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setChallenges(readLocalCoachChallenges(storageKey))
    }, STORED_STATE_HYDRATION_DELAY_MS)

    return () => window.clearTimeout(hydrationTimer)
  }, [storageKey])

  function addAssignment(payload: CoachAssignmentBuilderPayload) {
    const challenge = buildLocalCoachChallenge({ payload, identitySlug })
    setChallenges((current) => {
      const next = uniqueCoachChallenges([challenge, ...current]).slice(0, 20)
      window.localStorage.setItem(storageKey, JSON.stringify(next.map(serializeLocalCoachChallenge)))
      return next
    })
  }

  return [challenges, addAssignment]
}

function serializeLocalCoachChallenge(challenge: LevelUpCoachChallenge) {
  return {
    assignment: challenge.assignment,
    cardId: challenge.card.id,
    moduleId: challenge.module.id,
  }
}

function readLocalCoachChallenges(key: string): LevelUpCoachChallenge[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]')
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((item): LevelUpCoachChallenge | null => {
        const card = LEVEL_UP_CARDS.find((candidate) => candidate.id === item?.cardId)
        const assignedModule = LEVEL_UP_MODULES.find((candidate) => candidate.id === item?.moduleId)
        if (!card || !assignedModule || !item?.assignment) return null

        return {
          source: null,
          summary: null,
          card,
          module: assignedModule,
          assignment: item.assignment as LevelUpAssignment,
        }
      })
      .filter((challenge): challenge is LevelUpCoachChallenge => Boolean(challenge))
  } catch {
    return []
  }
}

function useLevelUpCompletions(
  identitySlug: string,
  assignmentByCardId: Map<string, LevelUpAssignment>,
): [LevelUpCompletion[], CompletionLogger, CompletionSyncState] {
  const [completions, setCompletions] = useState<LevelUpCompletion[]>([])
  const [syncState, setSyncState] = useState<CompletionSyncState>({ status: 'idle', message: '' })

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setCompletions(readCompletions())
    }, STORED_STATE_HYDRATION_DELAY_MS)
    return () => window.clearTimeout(hydrationTimer)
  }, [])

  useEffect(() => {
    let active = true

    void (async () => {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) return

      try {
        setSyncState({ status: 'loading', message: 'Checking your Level Up history...' })
        const response = await fetch('/api/player/level-up-sessions', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = (await response.json()) as { ok?: boolean; sessions?: RemoteLevelUpSession[] }
        if (!response.ok || !json.ok || !active) return

        const remoteCompletions = (json.sessions ?? [])
          .filter((session) => session.identitySlug === identitySlug)
          .map(remoteSessionToCompletion)
          .filter(Boolean) as LevelUpCompletion[]
        const merged = mergeCompletions(remoteCompletions, readCompletions()).slice(0, 40)
        setCompletions(merged)
        window.localStorage.setItem('tiq-level-up-completions', JSON.stringify(merged))
        setSyncState({
          status: 'synced',
          message: remoteCompletions.length ? 'Your saved proof history is available on this device.' : '',
        })
      } catch {
        if (active) {
          setSyncState({ status: 'local', message: 'Saved proof will stay on this device until sync is available.' })
        }
      }
    })()

    return () => {
      active = false
    }
  }, [identitySlug])

  function log(cardId: string, rating: number, note: string, elapsedSeconds = 0) {
    const card = LEVEL_UP_CARDS.find((candidate) => candidate.id === cardId)
    const now = new Date().toISOString()
    const nextCompletion: LevelUpCompletion = {
      id: `${Date.now()}-${cardId}`,
      playerId: 'local-player',
      cardId,
      completedAt: now,
      proofRating: rating,
      note: note.trim(),
      durationMinutes: card ? Math.max(1, Math.round(elapsedSeconds / 60)) || card.durationMinutes : undefined,
      assignmentId: assignmentByCardId.get(cardId)?.id,
    }

    setCompletions((current) => {
      const next = [nextCompletion, ...current.filter((completion) => completion.id !== nextCompletion.id)].slice(0, 40)
      window.localStorage.setItem('tiq-level-up-completions', JSON.stringify(next))
      return next
    })

    if (!card) {
      setSyncState({ status: 'local', message: 'Saved locally. This card can sync after it is in the Level Up library.' })
      return
    }

    setSyncState({ status: 'syncing', message: 'Saved on this device. Syncing proof now...' })
    void syncPortalCompletion({ card, completion: nextCompletion, identitySlug, elapsedSeconds, setSyncState })
  }
  return [completions, log, syncState]
}

async function syncPortalCompletion({
  card,
  completion,
  identitySlug,
  elapsedSeconds,
  setSyncState,
}: {
  card: LevelUpCard
  completion: LevelUpCompletion
  identitySlug: string
  elapsedSeconds: number
  setSyncState: (state: CompletionSyncState) => void
}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    setSyncState({ status: 'local', message: `Saved locally. Sign in from a coach invite or ${PLAYER_TIER_NAME} to sync proof history.` })
    return
  }

  const coachResult = await postPortalCompletion({
    token,
    card,
    completion,
    identitySlug,
    elapsedSeconds,
    accessMode: 'coach_invited',
    sharedWithCoach: true,
  })
  if (coachResult.ok) {
    setSyncState({ status: 'synced', message: 'Synced. Your linked coach can use this for the next lesson.' })
    return
  }

  const playerPlusResult = await postPortalCompletion({
    token,
    card,
    completion,
    identitySlug,
    elapsedSeconds,
    accessMode: 'player_plus',
    sharedWithCoach: false,
  })
  if (playerPlusResult.ok) {
    setSyncState({ status: 'synced', message: 'Synced to your Level Up history.' })
    return
  }

  setSyncState({
    status: 'local',
    message: playerPlusResult.message || coachResult.message || `Saved locally. Coach invite or ${PLAYER_TIER_NAME} turns on cloud history.`,
  })
}

async function postPortalCompletion({
  token,
  card,
  completion,
  identitySlug,
  elapsedSeconds,
  accessMode,
  sharedWithCoach,
}: {
  token: string
  card: LevelUpCard
  completion: LevelUpCompletion
  identitySlug: string
  elapsedSeconds: number
  accessMode: 'coach_invited' | 'player_plus'
  sharedWithCoach: boolean
}) {
  try {
    const workType = getCardWorkType(card)
    const response = await fetch('/api/player/level-up-sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          id: completion.id,
          focusId: card.id,
          focusTitle: getTrainingAreaLabel(card),
          workType,
          context: getCardContext(card, workType),
          drillTitle: card.title,
          rating: completion.proofRating,
          feeling: 'ready',
          accessMode,
          note: completion.note ?? '',
          elapsedSeconds,
          sharedWithCoach,
          completedAt: completion.completedAt,
          identitySlug,
          assignmentId: completion.assignmentId,
        },
      }),
    })
    const json = (await response.json()) as { ok?: boolean; message?: string }
    return { ok: response.ok && json.ok, message: json.message }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Cloud sync is not available right now.' }
  }
}

function remoteSessionToCompletion(session: RemoteLevelUpSession): LevelUpCompletion | null {
  const card = LEVEL_UP_CARDS.find((candidate) => candidate.id === session.focusId)
    ?? LEVEL_UP_CARDS.find((candidate) => candidate.title === session.drillTitle)
  if (!card) return null

  return {
    id: session.id,
    playerId: session.playerUserId,
    cardId: card.id,
    completedAt: session.completedAt,
    proofRating: session.rating,
    note: session.note,
    durationMinutes: Math.max(1, Math.round(session.elapsedSeconds / 60)) || card.durationMinutes,
    assignmentId: session.assignmentId ?? undefined,
  }
}

function mergeCompletions(remoteCompletions: LevelUpCompletion[], localCompletions: LevelUpCompletion[]) {
  const byId = new Map<string, LevelUpCompletion>()
  for (const completion of [...localCompletions, ...remoteCompletions]) {
    byId.set(completion.id, completion)
  }

  return [...byId.values()].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
}

function readStringList(key: string) {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function readStringRecord(key: string): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    return Object.fromEntries(
      Object.entries(parsed).filter(([entryKey, entryValue]) => typeof entryKey === 'string' && typeof entryValue === 'string'),
    ) as Record<string, string>
  } catch {
    return {}
  }
}

function readCompletions(): LevelUpCompletion[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem('tiq-level-up-completions') || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function buildCompletionSummaryByCardId(completions: LevelUpCompletion[]) {
  const summaryByCardId = new Map<string, CompletionSummary>()
  for (const completion of completions) {
    const current = summaryByCardId.get(completion.cardId)
    if (!current) {
      summaryByCardId.set(completion.cardId, {
        count: 1,
        lastRating: completion.proofRating,
        lastNote: completion.note,
        lastDurationMinutes: completion.durationMinutes,
        lastCompletedAt: completion.completedAt,
        lastAssignmentId: completion.assignmentId,
      })
    } else {
      if (current.count === 1) current.previousRating = completion.proofRating
      current.count += 1
    }
  }
  return summaryByCardId
}

function cardMatchesFilters(card: LevelUpCard, filters: FilterState) {
  if (filters.category !== 'all' && card.category !== filters.category) return false
  if (filters.pack !== 'all' && card.pack !== filters.pack) return false
  if (filters.setting !== 'all' && !card.setting.includes(filters.setting as never)) return false
  if (filters.equipment !== 'all' && !card.equipment.includes(filters.equipment as never)) return false
  if (filters.duration === 'under-10' && card.durationMinutes > 10) return false
  if (filters.intensity !== 'all' && card.intensity !== filters.intensity) return false
  if (filters.level !== 'all' && card.level !== filters.level) return false
  if (filters.tag !== 'all' && !card.tags.includes(filters.tag)) return false
  return true
}

function countActiveFilters(filters: FilterState) {
  return Object.values(filters).filter((value) => value !== 'all').length
}

function formatTimer(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function getCleanRepTarget(card: LevelUpCard) {
  if (card.durationMinutes <= 5) return 5
  if (card.durationMinutes <= 10) return 8
  if (card.durationMinutes <= 15) return 10
  return 12
}

function getActivitySuggestedRating(cleanRepCount: number, cleanRepTarget: number, elapsedSeconds: number, missedRepCount = 0) {
  const repRatio = cleanRepCount / cleanRepTarget
  if (missedRepCount > cleanRepCount && cleanRepCount > 0) return 2
  if (missedRepCount > 0 && repRatio < 0.75) return Math.max(1, cleanRepCount > 0 ? 2 : 1)
  if (repRatio >= 1) return missedRepCount > 0 ? 4 : 5
  if (repRatio >= 0.75) return missedRepCount > 0 ? 3 : 4
  if (repRatio >= 0.5) return missedRepCount > 0 ? 2 : 3
  if (cleanRepCount > 0) return 2
  if (elapsedSeconds > 0 || missedRepCount > 0) return 1
  return 3
}

function getActivityProofNote({
  completedRoundCount,
  elapsedSeconds,
  totalCleanRepCount,
  missedRepCount,
  sessionGoal,
}: {
  cleanRepCount: number
  cleanRepTarget: number
  elapsedSeconds: number
  completedRoundCount: number
  totalCleanRepCount: number
  missedRepCount: number
  sessionGoal: string
}) {
  if (totalCleanRepCount === 0 && missedRepCount === 0 && elapsedSeconds === 0) return ''
  const roundLine = completedRoundCount > 0 ? ` across ${completedRoundCount + 1} rounds` : ''
  const missedLine = missedRepCount > 0 ? `, ${missedRepCount} missed reps` : ''
  return `Goal: ${sessionGoal}. Activity: ${totalCleanRepCount} total clean reps${roundLine}${missedLine} in ${formatTimer(elapsedSeconds)}.`
}

function getSavedProofAction(card: LevelUpCard, rating: number) {
  const prescription = getAfterScoreTennisPrescription(card, rating)

  if (rating <= 1) {
    return {
      title: prescription.title,
      detail: prescription.detail,
    }
  }

  if (rating <= 3) {
    return {
      title: prescription.title,
      detail: prescription.detail,
    }
  }

  return {
    title: prescription.title,
    detail: prescription.detail,
  }
}

function getScoreDecision(card: LevelUpCard, rating: number) {
  const proofName = card.proof.replace(' 0-5', '').toLowerCase()
  const prescription = getAfterScoreTennisPrescription(card, rating)

  if (rating <= 1) {
    return {
      title: prescription.repeatTitle,
      detail: `${prescription.repeatDetail} Proof to watch: ${proofName}.`,
    }
  }

  if (rating <= 3) {
    return {
      title: prescription.repeatTitle,
      detail: `${prescription.repeatDetail} Do not add difficulty until ${proofName} is cleaner.`,
    }
  }

  return {
    title: prescription.repeatTitle,
    detail: `${prescription.repeatDetail} Keep ${proofName} as the score that matters.`,
  }
}

function getCoachNextAssignmentRead(card: LevelUpCard, rating: number) {
  const proofName = card.proof.replace(' 0-5', '').toLowerCase()

  if (rating <= 1) {
    return {
      title: 'Likely coach move: scale this down.',
      detail: `Your ${proofName} score says the habit is not stable yet. The useful next assignment should reduce speed, volume, or decision load.`,
      assignment: `Next assignment idea: scale down ${card.title}.`,
      actionLabel: 'scale down',
    }
  }

  if (rating <= 3) {
    return {
      title: 'Likely coach move: repeat cleaner.',
      detail: `Your ${proofName} score says the habit is showing up, but not automatic. The next assignment should keep the same card and make the standard clearer.`,
      assignment: `Next assignment idea: repeat clean ${card.title}.`,
      actionLabel: 'repeat clean',
    }
  }

  return {
    title: 'Likely coach move: add pressure.',
    detail: `Your ${proofName} score says the habit is repeatable enough to test. The next assignment should add one pressure layer without changing everything.`,
    assignment: `Next assignment idea: add pressure to ${card.title}.`,
    actionLabel: 'add pressure',
  }
}

function getCoachRecommendedNext(card: LevelUpCard, rating: number, hasCoachAssignment: boolean): CoachRecommendedNext {
  const proofName = card.proof.replace(' 0-5', '').toLowerCase()
  const recipe = getCoachRecommendedNextRecipe(card, rating, hasCoachAssignment)

  if (hasCoachAssignment) {
    return {
      title: 'Send proof to coach.',
      detail: `You finished assigned work. Send the ${rating}/5 ${proofName} proof before starting another card.`,
      recipe,
      actionLabel: 'Copy coach update',
      action: 'send',
    }
  }

  if (rating <= 1) {
    return {
      title: 'Scale it down now.',
      detail: `The ${proofName} score is not stable yet. Shrink the rep and make the cue show up before chasing speed.`,
      recipe,
      actionLabel: 'Scale down rep',
      action: 'repeat',
    }
  }

  if (rating <= 3) {
    return {
      title: 'Repeat clean once.',
      detail: `The ${proofName} habit is showing up. Run one cleaner round at the same difficulty before moving on.`,
      recipe,
      actionLabel: 'Repeat clean',
      action: 'repeat',
    }
  }

  return {
    title: 'Level up one piece.',
    detail: `The ${proofName} habit is repeatable enough to test. Add one pressure layer, not a whole new drill.`,
    recipe,
    actionLabel: 'Add pressure',
    action: 'repeat',
  }
}

function getCoachRecommendedNextRecipe(card: LevelUpCard, rating: number, hasCoachAssignment: boolean) {
  const proofName = card.proof.replace(' 0-5', '')

  if (hasCoachAssignment) {
    return [
      { label: 'Send', value: `${rating}/5 ${proofName}` },
      { label: 'Ask', value: getProofSnapshotCoachAsk(card, rating) },
      { label: 'Then', value: rating >= 4 ? 'Repeat only if coach wants pressure added.' : 'Repeat clean before adding new work.' },
    ]
  }

  if (rating <= 1) {
    return [
      { label: 'Setup', value: getScaleDownSetup(card) },
      { label: 'Score', value: `Only count ${proofName.toLowerCase()} that shows without rushing.` },
      { label: 'Stop', value: 'Stop after one cleaner proof score.' },
    ]
  }

  if (rating <= 3) {
    return [
      { label: 'Setup', value: 'Same card, same target, one cleaner round.' },
      { label: 'Score', value: `Beat ${rating}/5 on ${proofName.toLowerCase()}.` },
      { label: 'Stop', value: 'Stop when the cue repeats twice without reminders.' },
    ]
  }

  return [
    { label: 'Setup', value: getPressureLayerSetup(card) },
    { label: 'Score', value: `Keep ${proofName.toLowerCase()} at 4/5 or better.` },
    { label: 'Stop', value: 'Stop if speed breaks the habit.' },
  ]
}

function getScaleDownSetup(card: LevelUpCard) {
  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) return 'Shadow first. Call one target before any ball.'
  if (card.tags.includes('return-intent')) return 'No full point yet. Call the return job before the feed.'
  if (card.tags.includes('recovery-after-contact')) return 'Walk the finish, recover, look sequence.'
  if (card.tags.includes('conditioning') || card.tags.includes('posture-under-fatigue')) return 'Cut the block in half and keep posture clean.'
  if (card.tags.includes('volley') || card.tags.includes('forward-close')) return 'Short feed, freeze the split before contact.'
  return card.regression ?? 'Make the rep slower and easier before adding volume.'
}

function getPressureLayerSetup(card: LevelUpCard) {
  if (card.tags.includes('serve-routine') || card.tags.includes('serve-target')) return 'Start at 30-30 and keep the same target call.'
  if (card.tags.includes('return-intent')) return 'Start at 30-30 with one return job.'
  if (card.tags.includes('recovery-after-contact')) return 'Add a live ball only if recovery beats watching.'
  if (card.tags.includes('doubles-communication')) return 'Add score pressure and say the call early.'
  if (card.tags.includes('volley') || card.tags.includes('forward-close')) return 'Add one pass attempt after the first volley.'
  return card.progression ?? 'Add one pressure layer while keeping the same cue.'
}

function buildProofSnapshot({
  card,
  rating,
  sessionGoal,
  cleanRepCount,
  cleanRepTarget,
  completedRoundCount,
  elapsedSeconds,
  totalCleanRepCount,
  missedRepCount,
}: {
  card: LevelUpCard
  rating: number
  sessionGoal: string
  cleanRepCount: number
  cleanRepTarget: number
  completedRoundCount: number
  elapsedSeconds: number
  totalCleanRepCount: number
  missedRepCount: number
}) {
  const proofName = card.proof.replace(' 0-5', '')
  const roundLine = completedRoundCount > 0 ? `${completedRoundCount + 1} rounds, ` : ''
  const currentRoundLine = completedRoundCount > 0 ? ` (${cleanRepCount}/${cleanRepTarget} current round)` : ''
  const missedLine = missedRepCount > 0 ? `, ${missedRepCount} missed` : ''
  const repSignal = totalCleanRepCount > 0 || missedRepCount > 0 || elapsedSeconds > 0
    ? `${roundLine}${totalCleanRepCount} total clean reps${missedLine}${currentRoundLine} in ${formatTimer(elapsedSeconds)}`
    : 'Score saved without timed reps'

  return {
    score: `${rating}/5 ${proofName}`,
    goal: sessionGoal,
    repSignal,
    coachAsk: getProofSnapshotCoachAsk(card, rating),
  }
}

function getProofSnapshotCoachAsk(card: LevelUpCard, rating: number) {
  const focus = getCardPurposeLabel(card).toLowerCase()

  if (rating <= 1) {
    return `Help me scale ${focus} down.`
  }

  if (rating <= 3) {
    return `Watch whether ${focus} repeats without reminders.`
  }

  return `Confirm when I should add pressure to ${focus}.`
}

function buildCoachUpdate({
  card,
  rating,
  note,
  cleanRepCount,
  cleanRepTarget,
  completedRoundCount,
  elapsedSeconds,
  nextAction,
  nextFirstRep,
  totalCleanRepCount,
  missedRepCount,
  sessionGoal,
}: {
  card: LevelUpCard
  rating: number
  note: string
  cleanRepCount: number
  cleanRepTarget: number
  completedRoundCount: number
  elapsedSeconds: number
  nextAction: string
  nextFirstRep?: string
  totalCleanRepCount: number
  missedRepCount: number
  sessionGoal: string
}) {
  const noteLine = note ? ` Note: ${note}` : ''
  const nextRepLine = nextFirstRep ? ` Coach next rep: ${nextFirstRep}` : ''
  const roundLine = completedRoundCount > 0 ? `, ${completedRoundCount + 1} rounds` : ''
  const currentRoundLine = completedRoundCount > 0 ? ` (${cleanRepCount}/${cleanRepTarget} current round)` : ''
  const missedLine = missedRepCount > 0 ? `, ${missedRepCount} missed` : ''
  return `${card.title}: goal ${sessionGoal}; proof ${rating}/5, ${totalCleanRepCount} total clean reps${missedLine}${roundLine}${currentRoundLine}, ${formatTimer(elapsedSeconds)}. Next: ${nextAction}.${nextRepLine}${noteLine}`
}

function scrollToStartList(startListRef: RefObject<HTMLElement | null>) {
  window.requestAnimationFrame(() => {
    startListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function scrollToActiveCard() {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      document.getElementById('level-up-active-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  })
}

function buildCardStartHref(identitySlug: string, card: LevelUpCard) {
  const workType = getCardWorkType(card)
  const context = getCardContext(card, workType)
  const focus = getCardFocus(identitySlug, card)
  const params = new URLSearchParams({
    focus,
    workType,
    context,
    card: card.id,
  })

  return `/level-up/${identitySlug}?${params.toString()}#level-up-flow`
}

function buildCardQuestHref(startHref: string) {
  const [pathWithQuery] = startHref.split('#')
  const [path, query = ''] = pathWithQuery.split('?')
  const params = new URLSearchParams(query)
  const cardId = params.get('card')
  if (!cardId) return '/level-up#quest-builder'

  params.delete('card')
  params.set('questCard', cardId)

  return `${path}?${params.toString()}#quest-builder`
}

function getCardWorkType(card: LevelUpCard) {
  if (card.category === 'mental-routine') return 'mental'
  if (['strength-stability', 'conditioning', 'mobility-stretch', 'recovery-reset'].includes(card.category)) return 'physical'
  return 'court'
}

function getCardContext(card: LevelUpCard, workType: string) {
  if (workType !== 'court') return 'alone'
  if (card.category === 'doubles-drill' || card.tags.includes('doubles') || card.tags.includes('doubles-communication')) return 'doubles'
  if (card.category === 'partner-drill' || card.equipment.includes('partner')) return 'partner'
  return 'alone'
}

function getCardFocus(identitySlug: string, card: LevelUpCard) {
  const text = `${card.title} ${card.category} ${card.tags.join(' ')}`.toLowerCase()
  let focus = 'movement'

  if (text.includes('doubles') || text.includes('partner-first')) focus = 'doubles'
  else if (text.includes('serve')) focus = 'serve'
  else if (text.includes('return')) focus = 'return'
  else if (text.includes('conditioning') || text.includes('strength') || text.includes('mobility') || text.includes('recovery-reset')) focus = 'conditioning'
  else if (text.includes('forehand') || text.includes('backhand') || text.includes('strokes') || text.includes('crosscourt') || text.includes('attack')) focus = 'strokes'

  if (identitySlug === 'relentless-competitor-4-0' && focus === 'return') return 'strokes'
  if (identitySlug === 'smart-attacker-4-0-to-4-5') {
    if (focus === 'serve') return 'serve-plus-one'
    if (focus === 'return') return 'return-pressure'
    if (focus === 'doubles') return 'net-close'
    if (focus === 'conditioning') return 'transition-defense'
    if (focus === 'strokes') return 'patterns'
  }

  return focus
}

function unique(items: string[]) {
  return [...new Set(items)].sort()
}

function formatLabel(value: string) {
  return value.replaceAll('-', ' ')
}
