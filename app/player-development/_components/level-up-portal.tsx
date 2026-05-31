'use client'

import { useMemo, useRef, useState, type RefObject } from 'react'
import { LEVEL_UP_CARDS } from '@/lib/level-up/level-up-cards'
import { LEVEL_UP_MODULES } from '@/lib/level-up/level-up-modules'
import { getLevelUpProfileForIdentity, recommendLevelUpCards } from '@/lib/level-up/recommendations'
import type { LevelUpCard, LevelUpCompletion, LevelUpModule, LevelUpRecommendation } from '@/lib/level-up/level-up-types'
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
  const activeFilterCount = countActiveFilters(filters)
  const visibleAllCards = showAllCards ? filteredCards : filteredCards.slice(0, 12)
  const startCards = (activeFilterCount ? filteredCards : identityCards).slice(0, 3)
  const sessionRead = getSessionReadLabel(completionSummaryByCardId)

  return (
    <section className={styles.levelUpPortalApp} aria-labelledby="level-up-portal-title">
      <LevelUpHero identityTitle={identityTitle} recommendationCopy={profile.recommendationCopy} />

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
      <LevelUpSmartRail title="Recently Completed" cards={completedCards} recommendationByCardId={recommendationByCardId} completionSummaryByCardId={completionSummaryByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} emptyText="Log a proof score to build this rail." identitySlug={identitySlug} />

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
  const id = title === 'Favorites' ? 'favorites' : undefined
  return (
    <details id={id} className={styles.levelUpRail} aria-label={title} open={defaultOpen}>
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
  const [loggerOpen, setLoggerOpen] = useState(false)
  const shownSavedRating = savedRating ?? completionSummary?.lastRating ?? null
  const proofGuidance = getProofRatingGuidance(rating, card)
  const notePrompt = getProofNotePrompt(rating)

  function openLogger() {
    setLoggerOpen(true)
    window.requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  function completeCard() {
    onComplete(card.id, rating, note)
    setSavedRating(rating)
    setNote('')
  }

  return (
    <article ref={cardRef} className={styles.levelUpCardTile}>
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
      <p><b>Proof:</b> {card.proof}</p>
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
        <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={120} placeholder={notePrompt} aria-label={`Note for ${card.title}`} />
        <button type="button" className="button-secondary" onClick={completeCard}>{shownSavedRating === null ? 'Save proof' : `Saved ${shownSavedRating}/5`}</button>
        {shownSavedRating !== null ? <small className={styles.completionSavedMessage}>Saved. Next: {proofGuidance.title}</small> : null}
      </details>
      <div className={styles.levelUpCardActions}>
        <a className="button-primary" href={startHref}>Start</a>
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
  return <small className={styles.completionSummaryPill}>Last proof {rating} - {trend}: {action} - {label}</small>
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
  const [favorites, setFavorites] = useState<string[]>(() => readStringList('tiq-level-up-favorites'))
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
  const [completions, setCompletions] = useState<LevelUpCompletion[]>(() => readCompletions())
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
