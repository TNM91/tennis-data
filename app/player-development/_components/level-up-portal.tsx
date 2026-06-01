'use client'

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { LEVEL_UP_CARDS } from '@/lib/level-up/level-up-cards'
import { LEVEL_UP_MODULES } from '@/lib/level-up/level-up-modules'
import { getLevelUpProfileForIdentity, recommendLevelUpCards } from '@/lib/level-up/recommendations'
import type { LevelUpAssignment, LevelUpCard, LevelUpCompletion, LevelUpModule, LevelUpRecommendation } from '@/lib/level-up/level-up-types'
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

type CompletionSummary = {
  count: number
  lastRating?: number
  previousRating?: number
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

const STORED_STATE_HYDRATION_DELAY_MS = 2000

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

export default function LevelUpPortal({ identitySlug, identityTitle }: LevelUpPortalProps) {
  const profile = getLevelUpProfileForIdentity(identitySlug)
  const startListRef = useRef<HTMLElement>(null)
  const [filters, setFilters] = useState<FilterState>(emptyFilters)
  const [showAllCards, setShowAllCards] = useState(false)
  const [selectedIntent, setSelectedIntent] = useState('Recommended')
  const [favorites, toggleFavorite] = useLevelUpFavorites()
  const [completions, logCompletion] = useLevelUpCompletions()
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
  const favoriteCards = LEVEL_UP_CARDS.filter((card) => favorites.includes(card.id)).slice(0, 8)
  const completedCards = completions
    .map((completion) => LEVEL_UP_CARDS.find((card) => card.id === completion.cardId))
    .filter(Boolean)
    .slice(0, 8) as LevelUpCard[]
  const featuredModules = LEVEL_UP_MODULES.filter((module) => profile.featuredModuleIds.includes(module.id))
  const todayModule = featuredModules[0] ?? LEVEL_UP_MODULES[0]
  const todayCard = identityCards[0] ?? LEVEL_UP_CARDS[0]
  const coachChallengeCard = identityCards[1] ?? todayCard
  const coachAssignment = buildMockCoachAssignment(coachChallengeCard, todayModule)
  const quickStartCard = favoriteCards[0] ?? quickWins[0] ?? todayCard
  const recentCard = completedCards[0]
  const activeFilterCount = countActiveFilters(filters)
  const visibleAllCards = showAllCards ? filteredCards : filteredCards.slice(0, 12)
  const startCards = (activeFilterCount ? filteredCards : identityCards).slice(0, 3)
  const sessionRead = getSessionReadLabel(completionSummaryByCardId)
  const recentProofRead = getRecentProofRead(completions, recentCard)

  return (
    <section className={styles.levelUpPortalApp} aria-labelledby="level-up-portal-title">
      <LevelUpHero identityTitle={identityTitle} recommendationCopy={profile.recommendationCopy} />

      <LevelUpCoachAssignmentBanner
        assignment={coachAssignment}
        card={coachChallengeCard}
        module={todayModule}
        identitySlug={identitySlug}
        completionSummary={completionSummaryByCardId.get(coachChallengeCard.id)}
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
        identitySlug={identitySlug}
      />

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
        identitySlug={identitySlug}
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

      <LevelUpSmartRail title="Coach Assigned" cards={identityCards.slice(0, 3)} recommendationByCardId={recommendationByCardId} completionSummaryByCardId={completionSummaryByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} identitySlug={identitySlug} defaultOpen />
      <LevelUpSmartRail title="Recommended for Your Player Identity" cards={identityCards} recommendationByCardId={recommendationByCardId} completionSummaryByCardId={completionSummaryByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} identitySlug={identitySlug} />
      <LevelUpSmartRail title="Quick Wins Under 10 Minutes" cards={quickWins} recommendationByCardId={recommendationByCardId} completionSummaryByCardId={completionSummaryByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} identitySlug={identitySlug} />
      <LevelUpSmartRail title="Performance Upgrade" cards={performanceCards} recommendationByCardId={recommendationByCardId} completionSummaryByCardId={completionSummaryByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} identitySlug={identitySlug} />
      <LevelUpSmartRail title="Match-Day Tools" cards={matchDayCards} recommendationByCardId={recommendationByCardId} completionSummaryByCardId={completionSummaryByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} identitySlug={identitySlug} />
      <LevelUpSmartRail title="Favorites" cards={favoriteCards} recommendationByCardId={recommendationByCardId} completionSummaryByCardId={completionSummaryByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} emptyText="Tap Favorite on a card to pin it here." identitySlug={identitySlug} defaultOpen={favoriteCards.length > 0} />
      <LevelUpSmartRail id="recently-completed" title="Recently Completed" cards={completedCards} recommendationByCardId={recommendationByCardId} completionSummaryByCardId={completionSummaryByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} emptyText="Log a proof score to build this rail." identitySlug={identitySlug} />

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
  identitySlug,
}: {
  coachChallengeCard: LevelUpCard
  todayModule: LevelUpModule
  todayCard: LevelUpCard
  quickStartCard: LevelUpCard
  recentCard?: LevelUpCard
  recentProofRead: string
  favoriteCount: number
  completionCount: number
  identitySlug: string
}) {
  return (
    <section className={styles.levelUpTodayDashboard} aria-label="Today dashboard">
      <div className={styles.levelUpTodayDashboardHeader}>
        <span>Today</span>
        <h2>Open, choose, start.</h2>
        <p>One coach challenge, one recommended mission, one fast start, and one proof read.</p>
      </div>
      <div className={styles.levelUpTodayDashboardGrid}>
        <a href={buildCardStartHref(identitySlug, coachChallengeCard)}>
          <span>Coach challenge</span>
          <strong>{coachChallengeCard.title}</strong>
          <small>{coachChallengeCard.proof}</small>
        </a>
        <a href="#today-mission">
          <span>Recommended</span>
          <strong>{todayModule.title}</strong>
          <small>Start with {todayCard.title}.</small>
        </a>
        <a href={buildCardStartHref(identitySlug, quickStartCard)}>
          <span>{favoriteCount ? 'Favorite start' : 'Quick start'}</span>
          <strong>{quickStartCard.title}</strong>
          <small>{quickStartCard.durationMinutes} min - {quickStartCard.setting.join(', ')}</small>
        </a>
        <a href={completionCount ? '#recently-completed' : '#level-up-start-here'}>
          <span>Proof trend</span>
          <strong>{recentProofRead}</strong>
          <small>{recentCard ? `Last card: ${recentCard.title}` : 'Log one score to create your trend.'}</small>
        </a>
      </div>
    </section>
  )
}

function LevelUpCoachAssignmentBanner({
  assignment,
  card,
  module,
  identitySlug,
  completionSummary,
}: {
  assignment: LevelUpAssignment
  card: LevelUpCard
  module: LevelUpModule
  identitySlug: string
  completionSummary?: CompletionSummary
}) {
  const readyToSend = Boolean(completionSummary)
  const statusLabel = readyToSend ? 'Ready to send' : 'Assigned'
  const proofLabel = typeof completionSummary?.lastRating === 'number' ? `${completionSummary.lastRating}/5 proof` : 'Proof needed'
  const primaryActionHref = readyToSend ? '#recently-completed' : buildCardStartHref(identitySlug, card)
  const primaryActionLabel = readyToSend ? 'Review coach update' : 'Start coach challenge'
  return (
    <section className={styles.levelUpCoachAssignmentBanner} aria-label="Coach assignment" data-status={readyToSend ? 'ready' : 'assigned'}>
      <div>
        <span>Coach challenge</span>
        <h2>{card.title}</h2>
        <p>{assignment.coachNote}</p>
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
        <small>Score 0-5, add one tiny note only if it changes the next practice.</small>
      </div>
      <a className="button-primary" href={primaryActionHref}>{primaryActionLabel}</a>
    </section>
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

function LevelUpStartList({
  startListRef,
  intent,
  cards,
  recommendationByCardId,
  completionSummaryByCardId,
  favorites,
  onFavorite,
  onComplete,
  identitySlug,
}: {
  startListRef: RefObject<HTMLElement | null>
  intent: string
  cards: LevelUpCard[]
  recommendationByCardId: Map<string | undefined, LevelUpRecommendation>
  completionSummaryByCardId: Map<string, CompletionSummary>
  favorites: string[]
  onFavorite: (cardId: string) => void
  onComplete: (cardId: string, rating: number, note: string) => void
  identitySlug: string
}) {
  return (
    <section ref={startListRef} id="level-up-start-here" className={styles.levelUpStartList} aria-label="Start here">
      <div className={styles.levelUpRailHeader}>
        <span>Start here</span>
        <h2>{intent === 'Recommended' ? 'Three strong places to begin.' : `${intent}: three good matches.`}</h2>
        <p>Pick one card, run it, then log a number. You do not need to browse the whole library first.</p>
      </div>
      <div className={styles.levelUpRailGrid}>
        {cards.map((card) => (
          <LevelUpCardTile
            key={card.id}
            card={card}
            reason={recommendationByCardId.get(card.id)?.reason}
            favorite={favorites.includes(card.id)}
            completionSummary={completionSummaryByCardId.get(card.id)}
            onFavorite={onFavorite}
            onComplete={onComplete}
            startHref={buildCardStartHref(identitySlug, card)}
          />
        ))}
      </div>
    </section>
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
  onComplete: (cardId: string, rating: number, note: string) => void
  emptyText?: string
  identitySlug: string
  defaultOpen?: boolean
}) {
  const railId = id ?? (title === 'Favorites' ? 'favorites' : undefined)
  return (
    <details id={railId} className={styles.levelUpRail} aria-label={title} open={defaultOpen}>
      <summary className={styles.levelUpRailSummary}>
        <span>{title}</span>
        <strong>{title}</strong>
        <small>{cards.length ? `${cards.length} cards` : 'Empty'}</small>
      </summary>
      {cards.length ? (
        <div className={styles.levelUpRailGrid}>
          {cards.map((card) => (
            <LevelUpCardTile
              key={card.id}
              card={card}
              reason={recommendationByCardId.get(card.id)?.reason}
              favorite={favorites.includes(card.id)}
              completionSummary={completionSummaryByCardId.get(card.id)}
              onFavorite={onFavorite}
              onComplete={onComplete}
              startHref={buildCardStartHref(identitySlug, card)}
            />
          ))}
        </div>
      ) : <p>{emptyText ?? 'No cards in this rail yet.'}</p>}
    </details>
  )
}

function LevelUpCardTile({
  card,
  reason,
  favorite,
  completionSummary,
  onFavorite,
  onComplete,
  startHref,
}: {
  card: LevelUpCard
  reason?: string
  favorite: boolean
  completionSummary?: CompletionSummary
  onFavorite: (cardId: string) => void
  onComplete: (cardId: string, rating: number, note: string) => void
  startHref: string
}) {
  const cardRef = useRef<HTMLElement>(null)
  const [rating, setRating] = useState(3)
  const [note, setNote] = useState('')
  const [savedRating, setSavedRating] = useState<number | null>(null)
  const [savedProofNote, setSavedProofNote] = useState('')
  const [loggerOpen, setLoggerOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [timerRunning, setTimerRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [cleanRepCount, setCleanRepCount] = useState(0)
  const [coachUpdateCopied, setCoachUpdateCopied] = useState(false)
  const shownSavedRating = savedRating ?? completionSummary?.lastRating ?? null
  const proofGuidance = getProofRatingGuidance(rating, card)
  const notePrompt = getProofNotePrompt(rating)
  const repFeedback = getCardRepFeedback(card, rating)
  const coachableNote = getCoachableNotePrompt(card, rating)
  const commonMiss = getCardCommonMiss(card)
  const doseGuide = getCardDoseGuide(card)
  const transferGuide = getCardTransferGuide(card)
  const coachLens = getCardCoachLens(card)
  const readinessCheck = getCardReadinessCheck(card)
  const trainingOptions = getCardTrainingOptions(card)
  const nextPractice = getCardNextPractice(card, shownSavedRating)
  const sessionStandard = getCardSessionStandard(card)
  const proofAnchors = getCardProofAnchors(card)
  const targetSeconds = Math.max(60, card.durationMinutes * 60)
  const timerProgress = Math.min(100, Math.round((elapsedSeconds / targetSeconds) * 100))
  const cleanRepTarget = getCleanRepTarget(card)
  const cleanRepProgress = Math.min(100, Math.round((cleanRepCount / cleanRepTarget) * 100))
  const suggestedRating = getActivitySuggestedRating(cleanRepCount, cleanRepTarget, elapsedSeconds)
  const activityProofNote = getActivityProofNote(cleanRepCount, cleanRepTarget, elapsedSeconds)
  const savedProofAction = savedRating === null ? null : getSavedProofAction(card, savedRating)
  const activeFocusState = savedRating !== null ? 'saved' : loggerOpen ? 'scoring' : timerRunning ? 'running' : elapsedSeconds > 0 || cleanRepCount > 0 ? 'working' : 'ready'
  const activeFocusLabel = getActiveFocusLabel(activeFocusState)
  const savedCoachUpdate = savedProofAction && savedRating !== null
    ? buildCoachUpdate({
      card,
      rating: savedRating,
      note: savedProofNote || activityProofNote,
      cleanRepCount,
      cleanRepTarget,
      elapsedSeconds,
      nextAction: savedProofAction.title,
    })
    : ''

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

  function startActivity() {
    setActivityOpen(true)
    window.requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function openLogger() {
    setActivityOpen(true)
    setLoggerOpen(true)
    setRating(suggestedRating)
    window.requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function completeCard() {
    const proofNote = note.trim() || activityProofNote
    onComplete(card.id, rating, proofNote)
    setSavedRating(rating)
    setSavedProofNote(proofNote)
    setCoachUpdateCopied(false)
    setNote('')
  }

  function repeatActivity() {
    setTimerRunning(false)
    setElapsedSeconds(0)
    setCleanRepCount(0)
    setSavedRating(null)
    setSavedProofNote('')
    setCoachUpdateCopied(false)
    setLoggerOpen(false)
    setActivityOpen(true)
    window.requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function finishActivity() {
    setTimerRunning(false)
    setLoggerOpen(false)
    setActivityOpen(false)
    window.requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  async function copyCoachUpdate() {
    if (savedRating === null || !savedProofAction) return

    try {
      await window.navigator.clipboard?.writeText(savedCoachUpdate)
      setCoachUpdateCopied(true)
    } catch {
      setCoachUpdateCopied(false)
    }
  }

  return (
    <article ref={cardRef} className={`${styles.levelUpCardTile} ${activityOpen ? styles.levelUpCardTileActive : ''}`} data-activity={activityOpen ? 'true' : 'false'}>
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
      {activityOpen ? (
        <div className={styles.levelUpActivityMode} aria-label={`Active drill mode for ${card.title}`} data-focus-state={activeFocusState}>
          <div className={styles.levelUpActivityHeader}>
            <span>Active drill</span>
            <strong>Do this now. Log one honest score.</strong>
            <button type="button" onClick={() => setActivityOpen(false)}>Collapse</button>
          </div>
          <div className={styles.levelUpActivityFocusBar} aria-label={`Current work state for ${card.title}`}>
            <div>
              <span>{activeFocusLabel}</span>
              <strong>{formatTimer(elapsedSeconds)} - {cleanRepCount}/{cleanRepTarget} clean</strong>
              <small>{card.proof}</small>
            </div>
            <button type="button" onClick={openLogger}>{savedRating === null ? 'Score' : 'Review'}</button>
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
          <div className={styles.levelUpActivityTimer} data-timer-state={timerRunning ? 'running' : elapsedSeconds > 0 ? 'paused' : 'ready'}>
            <span>Timer</span>
            <strong>{formatTimer(elapsedSeconds)}</strong>
            <small>Target: {card.durationMinutes}:00. Stop early if quality drops.</small>
            <div className={styles.levelUpActivityTimerTrack} aria-hidden="true">
              <i style={{ width: `${timerProgress}%` }} />
            </div>
            <div className={styles.levelUpActivityTimerActions}>
              <button type="button" onClick={() => setTimerRunning((running) => !running)}>
                {timerRunning ? 'Pause' : elapsedSeconds > 0 ? 'Resume' : 'Start timer'}
              </button>
              <button type="button" onClick={() => {
                setTimerRunning(false)
                setElapsedSeconds(0)
              }}>
                Reset
              </button>
            </div>
          </div>
          <div className={styles.levelUpActivityRepCounter} data-rep-state={cleanRepCount >= cleanRepTarget ? 'complete' : cleanRepCount > 0 ? 'counting' : 'ready'}>
            <span>Clean reps</span>
            <strong>{cleanRepCount}/{cleanRepTarget}</strong>
            <small>Tap +1 only when the proof behavior showed up.</small>
            <div className={styles.levelUpActivityTimerTrack} aria-hidden="true">
              <i style={{ width: `${cleanRepProgress}%` }} />
            </div>
            <div className={styles.levelUpActivityRepActions}>
              <button type="button" onClick={() => setCleanRepCount((count) => Math.min(count + 1, cleanRepTarget))}>+1 clean</button>
              <button type="button" onClick={() => setCleanRepCount((count) => Math.max(count - 1, 0))}>Undo</button>
              <button type="button" onClick={() => setCleanRepCount(0)}>Reset reps</button>
            </div>
          </div>
          <div className={styles.levelUpActivityActions}>
            <button type="button" className={styles.scoreButton} onClick={openLogger}>Score now</button>
            <a className="button-secondary" href={startHref}>Open guided flow</a>
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
        </div>
      ) : null}
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
      {nextPractice ? (
        <div className={styles.levelUpNextPractice}>
          <span>Next practice</span>
          <strong>{nextPractice.title}</strong>
          <small>{nextPractice.detail}</small>
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
        <summary>Log proof</summary>
        <p>Tap the number first. Add a short note only if it changes the next rep.</p>
        <div className={styles.levelUpProofScale} aria-label={`Proof scale for ${card.title}`}>
          <span>0: not yet</span>
          <span>3: showed up sometimes</span>
          <span>5: automatic today</span>
        </div>
        <div>
          {[0, 1, 2, 3, 4, 5].map((value) => (
            <button key={value} type="button" data-active={rating === value ? 'true' : 'false'} onClick={() => setRating(value)}>{value}</button>
          ))}
        </div>
        <div className={styles.levelUpProofNextStep}>
          <span>Next rep</span>
          <strong>{proofGuidance.title}</strong>
          <small>{proofGuidance.detail}</small>
        </div>
        {cleanRepCount > 0 || elapsedSeconds > 0 ? (
          <div className={styles.levelUpActivityRecap}>
            <span>Activity recap</span>
            <strong>{cleanRepCount}/{cleanRepTarget} clean reps - {formatTimer(elapsedSeconds)}</strong>
            <small>Suggested proof: {suggestedRating}/5. Edit the score if the habit felt different.</small>
          </div>
        ) : null}
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
        <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={120} placeholder={notePrompt} aria-label={`Note for ${card.title}`} />
        <button type="button" className="button-secondary" onClick={completeCard}>{savedRating === null ? 'Save proof' : `Saved ${savedRating}/5`}</button>
        {savedProofAction && savedRating !== null ? (
          <div className={styles.completionSavedMessage}>
            <span>Proof saved</span>
            <strong>{savedRating}/5 - {savedProofAction.title}</strong>
            <small>{savedProofAction.detail}</small>
            <div className={styles.levelUpAfterScoreNext}>
              <span>Next move</span>
              <strong>{getAfterScorePrimaryAction(savedRating)}</strong>
              <small>{getAfterScoreDetail(card, savedRating)}</small>
            </div>
            <div className={styles.coachUpdatePreview}>
              <span>Coach update</span>
              <p>{savedCoachUpdate}</p>
            </div>
            <div className={styles.completionSavedActions}>
              <button type="button" onClick={copyCoachUpdate}>{coachUpdateCopied ? 'Coach update copied' : 'Copy coach update'}</button>
              <button type="button" onClick={repeatActivity}>Repeat card</button>
              <button type="button" onClick={finishActivity}>Done for now</button>
            </div>
          </div>
        ) : null}
      </details>
      <div className={styles.levelUpCardActions}>
        <button type="button" className="button-primary" onClick={startActivity}>Start</button>
        <button type="button" className={styles.scoreButton} onClick={openLogger}>Score</button>
        <LevelUpFavoriteButton active={favorite} onClick={() => onFavorite(card.id)} />
      </div>
    </article>
  )
}

function LevelUpModuleTile({
  module,
  identitySlug,
  completionSummaryByCardId,
}: {
  module: LevelUpModule
  identitySlug: string
  completionSummaryByCardId: Map<string, CompletionSummary>
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
      {nextCard ? <a className="button-primary" href={buildCardStartHref(identitySlug, nextCard)}>{moduleActionLabel}</a> : null}
    </article>
  )
}

function buildModuleProgressStages(
  module: LevelUpModule,
  moduleCards: LevelUpCard[],
  completionSummaryByCardId: Map<string, CompletionSummary>,
) {
  const stageLabels = ['Learn', 'Repeat', 'Pressure', 'Prove']
  const stageDetails = [
    'Understand the cue.',
    'Log it clean twice.',
    'Add one challenge.',
    'Show it in points.',
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

function getAfterScorePrimaryAction(rating: number) {
  if (rating <= 1) return 'Scale down and repeat one clean cue.'
  if (rating <= 3) return 'Repeat this card before adding difficulty.'
  return 'Level up one variable next.'
}

function getAfterScoreDetail(card: LevelUpCard, rating: number) {
  if (rating <= 1) return card.regression
  if (rating <= 3) return `Keep the same setup and chase this cue again: ${card.cue}`
  return card.progression
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

function buildMockCoachAssignment(card: LevelUpCard, module: LevelUpModule): LevelUpAssignment {
  return {
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
  }
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
  if (rating <= 1) {
    return {
      title: 'Shrink the drill.',
      detail: `Next time: ${card.regression} Score ${proofName} again before adding volume.`,
    }
  }

  if (rating <= 3) {
    return {
      title: 'Repeat the same standard.',
      detail: `Run the same card again and chase one cleaner cue: ${card.cue}`,
    }
  }

  return {
    title: 'Raise the challenge.',
    detail: `Next time: ${card.progression} Keep the proof honest, not just harder.`,
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

function getCardProofAnchors(card: LevelUpCard) {
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

function useLevelUpCompletions(): [LevelUpCompletion[], (cardId: string, rating: number, note: string) => void] {
  const [completions, setCompletions] = useState<LevelUpCompletion[]>([])

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setCompletions(readCompletions())
    }, STORED_STATE_HYDRATION_DELAY_MS)
    return () => window.clearTimeout(hydrationTimer)
  }, [])

  function log(cardId: string, rating: number, note: string) {
    setCompletions((current) => {
      const next = [{
        id: `${Date.now()}-${cardId}`,
        playerId: 'local-player',
        cardId,
        completedAt: new Date().toISOString(),
        proofRating: rating,
        note: note.trim(),
      }, ...current].slice(0, 40)
      window.localStorage.setItem('tiq-level-up-completions', JSON.stringify(next))
      return next
    })
  }
  return [completions, log]
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

function getActivitySuggestedRating(cleanRepCount: number, cleanRepTarget: number, elapsedSeconds: number) {
  const repRatio = cleanRepCount / cleanRepTarget
  if (repRatio >= 1) return 5
  if (repRatio >= 0.75) return 4
  if (repRatio >= 0.5) return 3
  if (cleanRepCount > 0) return 2
  if (elapsedSeconds > 0) return 1
  return 3
}

function getActivityProofNote(cleanRepCount: number, cleanRepTarget: number, elapsedSeconds: number) {
  if (cleanRepCount === 0 && elapsedSeconds === 0) return ''
  return `Activity: ${cleanRepCount}/${cleanRepTarget} clean reps in ${formatTimer(elapsedSeconds)}.`
}

function getSavedProofAction(card: LevelUpCard, rating: number) {
  if (rating <= 1) {
    return {
      title: 'Scale down next.',
      detail: `${card.regression} Keep the proof honest before adding more reps.`,
    }
  }

  if (rating <= 3) {
    return {
      title: 'Repeat this card.',
      detail: `Run the same setup again and chase one cleaner cue: ${card.cue}`,
    }
  }

  return {
    title: 'Level up one variable.',
    detail: `${card.progression} Keep the same proof score so harder still means better.`,
  }
}

function buildCoachUpdate({
  card,
  rating,
  note,
  cleanRepCount,
  cleanRepTarget,
  elapsedSeconds,
  nextAction,
}: {
  card: LevelUpCard
  rating: number
  note: string
  cleanRepCount: number
  cleanRepTarget: number
  elapsedSeconds: number
  nextAction: string
}) {
  const noteLine = note ? ` Note: ${note}` : ''
  return `${card.title}: proof ${rating}/5, ${cleanRepCount}/${cleanRepTarget} clean reps, ${formatTimer(elapsedSeconds)}. Next: ${nextAction}${noteLine}`
}

function scrollToStartList(startListRef: RefObject<HTMLElement | null>) {
  window.requestAnimationFrame(() => {
    startListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
