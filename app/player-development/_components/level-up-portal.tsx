'use client'

import { useMemo, useState } from 'react'
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
  const [filters, setFilters] = useState<FilterState>(emptyFilters)
  const [showAllCards, setShowAllCards] = useState(false)
  const [selectedIntent, setSelectedIntent] = useState('Recommended')
  const [favorites, toggleFavorite] = useLevelUpFavorites()
  const [completions, logCompletion] = useLevelUpCompletions()
  const completedCardIds = completions.map((completion) => completion.cardId)
  const recommendations = useMemo(
    () => recommendLevelUpCards({
      identitySlug,
      activeGoalTags: profile.focusTags,
      availableEquipment: filters.equipment === 'all' ? undefined : [filters.equipment],
      preferredSetting: filters.setting === 'all' ? undefined : filters.setting,
      timeAvailable: filters.duration === 'under-10' ? 10 : undefined,
      completedCardIds,
      favoriteCardIds: favorites,
      limit: 18,
    }),
    [completedCardIds, favorites, filters.duration, filters.equipment, filters.setting, identitySlug, profile.focusTags],
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
  const startHref = `/level-up/${identitySlug}#level-up-flow`
  const activeFilterCount = countActiveFilters(filters)
  const visibleAllCards = showAllCards ? filteredCards : filteredCards.slice(0, 12)
  const startCards = (activeFilterCount ? filteredCards : identityCards).slice(0, 3)

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
          onFavorite={toggleFavorite}
          onComplete={logCompletion}
          startHref={startHref}
        />
      </section>

      <LevelUpSafetyNote />

      <LevelUpIntentPresets
        activeIntent={selectedIntent}
        onApply={(preset) => {
          setSelectedIntent(preset.label)
          setFilters(preset.filters)
          setShowAllCards(false)
        }}
      />

      <LevelUpStartList
        intent={selectedIntent}
        cards={startCards}
        recommendationByCardId={recommendationByCardId}
        favorites={favorites}
        onFavorite={toggleFavorite}
        onComplete={logCompletion}
        startHref={startHref}
      />

      <LevelUpFilters
        filters={filters}
        resultCount={filteredCards.length}
        activeFilterCount={activeFilterCount}
        onChange={(nextFilters) => {
          setSelectedIntent('Custom')
          setFilters(nextFilters)
          setShowAllCards(false)
        }}
        onReset={() => {
          setSelectedIntent('Recommended')
          setFilters(emptyFilters)
          setShowAllCards(false)
        }}
      />

      <LevelUpSmartRail title="Coach Assigned" cards={identityCards.slice(0, 3)} recommendationByCardId={recommendationByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} startHref={startHref} defaultOpen />
      <LevelUpSmartRail title="Recommended for Your Player Identity" cards={identityCards} recommendationByCardId={recommendationByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} startHref={startHref} />
      <LevelUpSmartRail title="Quick Wins Under 10 Minutes" cards={quickWins} recommendationByCardId={recommendationByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} startHref={startHref} />
      <LevelUpSmartRail title="Performance Upgrade" cards={performanceCards} recommendationByCardId={recommendationByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} startHref={startHref} />
      <LevelUpSmartRail title="Match-Day Tools" cards={matchDayCards} recommendationByCardId={recommendationByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} startHref={startHref} />
      <LevelUpSmartRail title="Favorites" cards={favoriteCards} recommendationByCardId={recommendationByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} emptyText="Tap Favorite on a card to pin it here." startHref={startHref} defaultOpen={favoriteCards.length > 0} />
      <LevelUpSmartRail title="Recently Completed" cards={completedCards} recommendationByCardId={recommendationByCardId} favorites={favorites} onFavorite={toggleFavorite} onComplete={logCompletion} emptyText="Log a proof score to build this rail." startHref={startHref} />

      <section className={styles.levelUpModuleGrid} aria-label="Level Up modules">
        <div className={styles.levelUpRailHeader}>
          <span>Modules</span>
          <h2>Curated blocks coaches can assign.</h2>
        </div>
        <div className={styles.levelUpRailGrid}>
          {featuredModules.map((module) => <LevelUpModuleTile key={module.id} module={module} />)}
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
              onFavorite={toggleFavorite}
              onComplete={logCompletion}
              startHref={startHref}
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

function LevelUpStartList({
  intent,
  cards,
  recommendationByCardId,
  favorites,
  onFavorite,
  onComplete,
  startHref,
}: {
  intent: string
  cards: LevelUpCard[]
  recommendationByCardId: Map<string | undefined, LevelUpRecommendation>
  favorites: string[]
  onFavorite: (cardId: string) => void
  onComplete: (cardId: string, rating: number, note: string) => void
  startHref: string
}) {
  return (
    <section className={styles.levelUpStartList} aria-label="Start here">
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
            onFavorite={onFavorite}
            onComplete={onComplete}
            startHref={startHref}
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
  favorites,
  onFavorite,
  onComplete,
  emptyText,
  startHref,
  defaultOpen,
}: {
  title: string
  cards: LevelUpCard[]
  recommendationByCardId: Map<string | undefined, LevelUpRecommendation>
  favorites: string[]
  onFavorite: (cardId: string) => void
  onComplete: (cardId: string, rating: number, note: string) => void
  emptyText?: string
  startHref: string
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
              onFavorite={onFavorite}
              onComplete={onComplete}
              startHref={startHref}
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
  onFavorite,
  onComplete,
  startHref,
}: {
  card: LevelUpCard
  reason?: string
  favorite: boolean
  onFavorite: (cardId: string) => void
  onComplete: (cardId: string, rating: number, note: string) => void
  startHref: string
}) {
  const [rating, setRating] = useState(3)
  const [note, setNote] = useState('')
  return (
    <article className={styles.levelUpCardTile}>
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
      {reason ? <RecommendedReasonPill reason={reason} /> : null}
      <details className={styles.completionLogger}>
        <summary>Log proof</summary>
        <div>
          {[0, 1, 2, 3, 4, 5].map((value) => (
            <button key={value} type="button" data-active={rating === value ? 'true' : 'false'} onClick={() => setRating(value)}>{value}</button>
          ))}
        </div>
        <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={120} placeholder="Tiny note if needed." aria-label={`Note for ${card.title}`} />
        <button type="button" className="button-secondary" onClick={() => onComplete(card.id, rating, note)}>Complete</button>
      </details>
      <div className={styles.levelUpCardActions}>
        <a className="button-primary" href={startHref}>Start</a>
        <LevelUpFavoriteButton active={favorite} onClick={() => onFavorite(card.id)} />
      </div>
    </article>
  )
}

function LevelUpModuleTile({ module }: { module: LevelUpModule }) {
  return (
    <article className={styles.levelUpModuleTile}>
      <span>{module.durationLabel}</span>
      <h3>{module.title}</h3>
      <p>{module.description}</p>
      <small>Proof: {module.proof}</small>
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
    <details className={styles.levelUpFilters} aria-label="Level Up filters">
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

function unique(items: string[]) {
  return [...new Set(items)].sort()
}

function formatLabel(value: string) {
  return value.replaceAll('-', ' ')
}
