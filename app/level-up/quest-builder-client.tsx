'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import type {
  LevelUpCustomQuestCompletion,
  LevelUpCustomQuest,
  LevelUpHabitCategory,
  LevelUpQuestCadence,
} from '@/lib/level-up/level-up-types'
import { formatHabitCategory } from '@/lib/level-up/quest-builder'
import { supabase } from '@/lib/supabase'
import styles from '@/app/player-development/_components/player-development.module.css'

export type QuestBuilderCardOption = {
  id: string
  title: string
  pack: string
  proof: string
}

export type QuestBuilderTemplateOption = {
  id: string
  title: string
  category: LevelUpHabitCategory
  cadence: LevelUpQuestCadence
  xp: number
  description: string
  proof: string
  starterHabit: string
  primaryCardId: string
  primaryCardTitle: string
}

type QuestBuilderDraft = {
  title: string
  category: LevelUpHabitCategory
  cadence: LevelUpQuestCadence
  xp: number
  linkedCardId: string
  proof: string
  starterHabit: string
}

type CustomQuestRow = {
  id: string
  user_id: string
  title: string
  category: LevelUpHabitCategory
  cadence: LevelUpQuestCadence
  xp: number
  linked_card_id: string | null
  proof: string
  starter_habit: string
  active: boolean
  created_at: string
  updated_at: string
}

type CustomQuestCompletionRow = {
  id: string
  user_id: string
  custom_quest_id: string
  level_up_session_id: string | null
  identity_slug: string
  card_id: string | null
  completed_on: string
  completed_at: string
  xp: number
  proof_rating: number | null
  note: string
  created_at: string
  updated_at: string
}

const QUEST_SELECT = 'id,user_id,title,category,cadence,xp,linked_card_id,proof,starter_habit,active,created_at,updated_at'
const COMPLETION_SELECT = 'id,user_id,custom_quest_id,level_up_session_id,identity_slug,card_id,completed_on,completed_at,xp,proof_rating,note,created_at,updated_at'

const CATEGORY_OPTIONS: LevelUpHabitCategory[] = [
  'tennis-skill',
  'fitness',
  'nutrition-hydration',
  'mindset',
  'recovery',
  'match-prep',
]

const CADENCE_OPTIONS: Array<{ id: LevelUpQuestCadence; label: string }> = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'practice-day', label: 'Practice day' },
  { id: 'match-day', label: 'Match day' },
]

export default function QuestBuilderClient({
  identitySlug,
  cardOptions,
  templates,
}: {
  identitySlug: string
  cardOptions: QuestBuilderCardOption[]
  templates: QuestBuilderTemplateOption[]
}) {
  const { authResolved, userId } = useAuth()
  const firstTemplate = templates[0]
  const fallbackCardId = firstTemplate?.primaryCardId ?? cardOptions[0]?.id ?? ''
  const [draft, setDraft] = useState<QuestBuilderDraft>(() => buildDraftFromTemplate(firstTemplate, fallbackCardId))
  const [customQuests, setCustomQuests] = useState<LevelUpCustomQuest[]>([])
  const [completions, setCompletions] = useState<LevelUpCustomQuestCompletion[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [archivingId, setArchivingId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selectedCard = useMemo(
    () => cardOptions.find((card) => card.id === draft.linkedCardId) ?? cardOptions[0],
    [cardOptions, draft.linkedCardId],
  )
  const todayKey = useMemo(() => formatDateKey(new Date()), [])
  const weekStartKey = useMemo(() => getWeekStartKey(new Date()), [])
  const progressSummary = useMemo(() => buildCustomQuestProgress(completions, todayKey, weekStartKey), [completions, todayKey, weekStartKey])
  const todayStack = useMemo(
    () => buildTodayQuestStack(customQuests, completions, todayKey, weekStartKey, identitySlug),
    [completions, customQuests, identitySlug, todayKey, weekStartKey],
  )

  const loadCustomQuests = useCallback(async () => {
    if (!userId) {
      setCustomQuests([])
      setCompletions([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    const [{ data, error: loadError }, { data: completionData, error: completionError }] = await Promise.all([
      supabase
      .from('level_up_custom_quests')
      .select(QUEST_SELECT)
      .eq('user_id', userId)
      .eq('active', true)
      .order('updated_at', { ascending: false })
        .limit(12),
      supabase
        .from('level_up_custom_quest_completions')
        .select(COMPLETION_SELECT)
        .eq('user_id', userId)
        .gte('completed_on', getDateOffsetKey(todayKey, -90))
        .order('completed_on', { ascending: false })
        .limit(200),
    ])

    if (loadError || completionError) {
      setError('Saved quests could not load.')
      setCustomQuests([])
      setCompletions([])
    } else {
      setCustomQuests(((data ?? []) as CustomQuestRow[]).map(mapCustomQuestRow))
      setCompletions(((completionData ?? []) as CustomQuestCompletionRow[]).map(mapCustomQuestCompletionRow))
    }

    setLoading(false)
  }, [todayKey, userId])

  useEffect(() => {
    if (!authResolved) return

    const loadTimer = globalThis.setTimeout(() => {
      void loadCustomQuests()
    }, 0)

    return () => {
      globalThis.clearTimeout(loadTimer)
    }
  }, [authResolved, loadCustomQuests])

  function applyTemplate(template: QuestBuilderTemplateOption) {
    setDraft(buildDraftFromTemplate(template, template.primaryCardId))
    setMessage(`${template.title} loaded.`)
    setError('')
  }

  async function saveQuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!userId) {
      setError('Sign in to save custom quests.')
      return
    }

    const title = draft.title.trim()
    if (!title) {
      setError('Add a quest title.')
      return
    }

    setSaving(true)
    setMessage('')
    setError('')

    const payload = {
      user_id: userId,
      title: title.slice(0, 90),
      category: draft.category,
      cadence: draft.cadence,
      xp: Math.min(100, Math.max(1, Math.round(draft.xp || 10))),
      linked_card_id: draft.linkedCardId || null,
      proof: draft.proof.trim().slice(0, 180),
      starter_habit: draft.starterHabit.trim().slice(0, 220),
      active: true,
      updated_at: new Date().toISOString(),
    }

    const { data, error: saveError } = await supabase
      .from('level_up_custom_quests')
      .insert(payload)
      .select(QUEST_SELECT)
      .single()

    if (saveError) {
      setError('Quest could not be saved.')
    } else if (data) {
      setCustomQuests((current) => [mapCustomQuestRow(data as CustomQuestRow), ...current].slice(0, 12))
      setMessage('Quest saved to your private Level Up plan.')
    }

    setSaving(false)
  }

  async function archiveQuest(id: string) {
    if (!userId) return

    setArchivingId(id)
    setError('')
    setMessage('')

    const { error: archiveError } = await supabase
      .from('level_up_custom_quests')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)

    if (archiveError) {
      setError('Quest could not be archived.')
    } else {
      setCustomQuests((current) => current.filter((quest) => quest.id !== id))
      setMessage('Quest archived.')
    }

    setArchivingId('')
  }

  return (
    <div className={styles.levelUpQuestSavePanel} aria-labelledby="custom-quest-title">
      <div className={styles.levelUpQuestTemplatePicker}>
        <span>Templates</span>
        <strong id="custom-quest-title">Create your own quest</strong>
        <p>Start from a tennis-ready template, then save the habit privately to your account.</p>
        <div>
          {templates.map((template) => (
            <button key={template.id} type="button" onClick={() => applyTemplate(template)}>
              <strong>{template.title}</strong>
              <small>{template.primaryCardTitle}</small>
            </button>
          ))}
        </div>
      </div>

      <form className={styles.levelUpQuestForm} onSubmit={saveQuest}>
        <label className={styles.levelUpQuestField}>
          <span>Quest name</span>
          <input
            value={draft.title}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            maxLength={90}
            placeholder="Serve routine before every practice serve"
          />
        </label>

        <label className={styles.levelUpQuestField}>
          <span>Category</span>
          <select
            value={draft.category}
            onChange={(event) => setDraft((current) => ({
              ...current,
              category: event.target.value as LevelUpHabitCategory,
            }))}
          >
            {CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>{formatHabitCategory(category)}</option>
            ))}
          </select>
        </label>

        <label className={styles.levelUpQuestField}>
          <span>Cadence</span>
          <select
            value={draft.cadence}
            onChange={(event) => setDraft((current) => ({
              ...current,
              cadence: event.target.value as LevelUpQuestCadence,
            }))}
          >
            {CADENCE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className={styles.levelUpQuestField}>
          <span>XP</span>
          <input
            type="number"
            min={1}
            max={100}
            value={draft.xp}
            onChange={(event) => setDraft((current) => ({
              ...current,
              xp: Number.parseInt(event.target.value, 10) || 10,
            }))}
          />
        </label>

        <label className={`${styles.levelUpQuestField} ${styles.levelUpQuestFieldFull}`}>
          <span>Linked drill card</span>
          <select
            value={draft.linkedCardId}
            onChange={(event) => setDraft((current) => ({ ...current, linkedCardId: event.target.value }))}
          >
            {cardOptions.map((card) => (
              <option key={card.id} value={card.id}>{card.pack}: {card.title}</option>
            ))}
          </select>
        </label>

        <label className={`${styles.levelUpQuestField} ${styles.levelUpQuestFieldFull}`}>
          <span>Proof</span>
          <input
            value={draft.proof}
            onChange={(event) => setDraft((current) => ({ ...current, proof: event.target.value }))}
            maxLength={180}
            placeholder={selectedCard?.proof ?? 'Name the proof you will score.'}
          />
        </label>

        <label className={`${styles.levelUpQuestField} ${styles.levelUpQuestFieldFull}`}>
          <span>Starter habit</span>
          <textarea
            value={draft.starterHabit}
            onChange={(event) => setDraft((current) => ({ ...current, starterHabit: event.target.value }))}
            maxLength={220}
            placeholder="Make the first rep small enough to complete today."
          />
        </label>

        <div className={styles.levelUpQuestFormActions}>
          {authResolved && userId ? (
            <button className="button-primary" type="submit" disabled={saving}>
              {saving ? 'Saving quest' : 'Save custom quest'}
            </button>
          ) : (
            <Link className="button-primary" href="/login">Sign in to save</Link>
          )}
          {selectedCard ? (
            <Link className="button-secondary" href={`/level-up/${identitySlug}?card=${selectedCard.id}#level-up-flow`}>
              Open linked drill
            </Link>
          ) : null}
        </div>

        {!authResolved ? <p className={styles.levelUpQuestNotice}>Checking your account.</p> : null}
        {authResolved && !userId ? <p className={styles.levelUpQuestNotice}>Saved quests unlock after sign-in.</p> : null}
        {message ? <p className={styles.levelUpQuestNotice}>{message}</p> : null}
        {error ? <p className={styles.levelUpQuestError}>{error}</p> : null}
      </form>

      <div className={styles.levelUpQuestSaved}>
        <div>
          <span>Saved quests</span>
          <strong>Private to your account</strong>
          <p>These rows use Supabase RLS ownership rules, so another user cannot read or change them.</p>
        </div>

        <div className={styles.levelUpQuestProgressStrip} aria-label="Custom quest progress">
          <article>
            <span>Total XP</span>
            <strong>{progressSummary.totalXp}</strong>
          </article>
          <article>
            <span>This week</span>
            <strong>{progressSummary.weeklyXp}</strong>
          </article>
          <article>
            <span>Streak</span>
            <strong>{progressSummary.streakDays}</strong>
          </article>
        </div>

        <div className={styles.levelUpQuestTodayStack} aria-labelledby="today-quest-stack-title">
          <div className={styles.levelUpQuestTodayHeader}>
            <div>
              <span>Today&apos;s stack</span>
              <strong id="today-quest-stack-title">Best next quests</strong>
              <p>Built from your saved quests, completion history, and current player identity.</p>
            </div>
            <div className={styles.levelUpQuestTodayMeter}>
              <strong>{todayStack.completedCount}/{Math.max(1, todayStack.items.length)}</strong>
              <span>{todayStack.availableXp} XP open</span>
            </div>
          </div>

          <div className={styles.levelUpQuestTodayGrid}>
            {!authResolved ? <p className={styles.levelUpQuestNotice}>Checking your account.</p> : null}
            {authResolved && !userId ? <p className={styles.levelUpQuestNotice}>Sign in to load today&apos;s quest stack.</p> : null}
            {authResolved && userId && !loading && todayStack.items.length === 0 ? (
              <p className={styles.levelUpQuestNotice}>Save a custom quest to build today&apos;s stack.</p>
            ) : null}
            {todayStack.items.map((item) => {
              const linkedCard = cardOptions.find((card) => card.id === item.quest.linkedCardId)

              return (
                <article key={item.quest.id} data-completed-today={item.completedToday ? 'true' : 'false'}>
                  <div>
                    <span>{item.reason}</span>
                    <strong>{item.quest.title}</strong>
                    <p>{item.quest.starterHabit}</p>
                  </div>
                  <small>{item.completedToday ? 'Done today' : `${item.quest.xp} XP available`}</small>
                  {linkedCard ? (
                    <Link className="button-primary" href={`/level-up/${identitySlug}?card=${linkedCard.id}&quest=${item.quest.id}#level-up-flow`}>
                      {item.completedToday ? 'Repeat drill' : 'Start quest'}
                    </Link>
                  ) : null}
                </article>
              )
            })}
          </div>
        </div>

        <div className={styles.levelUpQuestSavedGrid}>
          {loading ? <p className={styles.levelUpQuestNotice}>Loading saved quests.</p> : null}
          {!loading && customQuests.length === 0 ? (
            <p className={styles.levelUpQuestNotice}>No saved custom quests yet.</p>
          ) : null}
          {customQuests.map((quest) => {
            const linkedCard = cardOptions.find((card) => card.id === quest.linkedCardId)
            const questCompletions = completions.filter((completion) => completion.customQuestId === quest.id)
            const completedToday = questCompletions.some((completion) => completion.completedOn === todayKey)
            const questXp = questCompletions.reduce((total, completion) => total + completion.xp, 0)

            return (
              <article key={quest.id} data-completed-today={completedToday ? 'true' : 'false'}>
                <div>
                  <span>{formatHabitCategory(quest.category)}</span>
                  <strong>{quest.title}</strong>
                  <p>{quest.starterHabit}</p>
                </div>
                <dl>
                  <div>
                    <dt>Cadence</dt>
                    <dd>{quest.cadence.replaceAll('-', ' ')}</dd>
                  </div>
                  <div>
                    <dt>XP</dt>
                    <dd>{quest.xp}</dd>
                  </div>
                  <div>
                    <dt>Earned</dt>
                    <dd>{questXp}</dd>
                  </div>
                  <div>
                    <dt>Today</dt>
                    <dd>{completedToday ? 'done' : 'open'}</dd>
                  </div>
                </dl>
                <small>Proof: {quest.proof || linkedCard?.proof || 'Score the linked drill proof.'}</small>
                <div>
                  {linkedCard ? (
                    <Link className="button-primary" href={`/level-up/${identitySlug}?card=${linkedCard.id}&quest=${quest.id}#level-up-flow`}>
                      Start drill
                    </Link>
                  ) : null}
                  <button
                    className="button-secondary"
                    type="button"
                    disabled={archivingId === quest.id}
                    onClick={() => void archiveQuest(quest.id)}
                  >
                    {archivingId === quest.id ? 'Archiving' : 'Archive'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function buildDraftFromTemplate(template: QuestBuilderTemplateOption | undefined, fallbackCardId: string): QuestBuilderDraft {
  return {
    title: template?.title ?? '',
    category: template?.category ?? 'tennis-skill',
    cadence: template?.cadence ?? 'practice-day',
    xp: template?.xp ?? 10,
    linkedCardId: template?.primaryCardId ?? fallbackCardId,
    proof: template?.proof ?? '',
    starterHabit: template?.starterHabit ?? '',
  }
}

function mapCustomQuestRow(row: CustomQuestRow): LevelUpCustomQuest {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    category: row.category,
    cadence: row.cadence,
    xp: row.xp,
    linkedCardId: row.linked_card_id,
    proof: row.proof,
    starterHabit: row.starter_habit,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapCustomQuestCompletionRow(row: CustomQuestCompletionRow): LevelUpCustomQuestCompletion {
  return {
    id: row.id,
    userId: row.user_id,
    customQuestId: row.custom_quest_id,
    levelUpSessionId: row.level_up_session_id,
    identitySlug: row.identity_slug,
    cardId: row.card_id,
    completedOn: row.completed_on,
    completedAt: row.completed_at,
    xp: row.xp,
    proofRating: row.proof_rating,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function buildCustomQuestProgress(completions: LevelUpCustomQuestCompletion[], todayKey: string, weekStartKey: string) {
  const completedDays = new Set(completions.map((completion) => completion.completedOn))
  let streakDays = 0
  let cursor = parseDateKey(todayKey)

  while (completedDays.has(formatDateKey(cursor))) {
    streakDays += 1
    cursor = addDays(cursor, -1)
  }

  return {
    totalXp: completions.reduce((total, completion) => total + completion.xp, 0),
    weeklyXp: completions
      .filter((completion) => completion.completedOn >= weekStartKey)
      .reduce((total, completion) => total + completion.xp, 0),
    streakDays,
  }
}

function buildTodayQuestStack(
  quests: LevelUpCustomQuest[],
  completions: LevelUpCustomQuestCompletion[],
  todayKey: string,
  weekStartKey: string,
  identitySlug: string,
) {
  const identityCategories = getIdentityQuestCategories(identitySlug)
  const items = quests
    .map((quest) => {
      const questCompletions = completions.filter((completion) => completion.customQuestId === quest.id)
      const completedToday = questCompletions.some((completion) => completion.completedOn === todayKey)
      const completedThisWeek = questCompletions.some((completion) => completion.completedOn >= weekStartKey)
      const identityFit = identityCategories.includes(quest.category)
      let score = completedToday ? -50 : 40

      if (identityFit) score += 18
      if (questCompletions.length === 0) score += 14
      if (quest.cadence === 'daily' || quest.cadence === 'practice-day') score += 8
      if (quest.cadence === 'weekly' && !completedThisWeek) score += 12
      if (quest.linkedCardId) score += 6

      return {
        quest,
        completedToday,
        reason: getTodayQuestReason({ completedToday, completedThisWeek, identityFit, quest, questCompletions }),
        score,
      }
    })
    .sort((a, b) => b.score - a.score || b.quest.xp - a.quest.xp)
    .slice(0, 4)

  return {
    items,
    completedCount: items.filter((item) => item.completedToday).length,
    availableXp: items.filter((item) => !item.completedToday).reduce((total, item) => total + item.quest.xp, 0),
  }
}

function getTodayQuestReason({
  completedToday,
  completedThisWeek,
  identityFit,
  quest,
  questCompletions,
}: {
  completedToday: boolean
  completedThisWeek: boolean
  identityFit: boolean
  quest: LevelUpCustomQuest
  questCompletions: LevelUpCustomQuestCompletion[]
}) {
  if (completedToday) return 'Done today'
  if (identityFit) return 'Identity fit'
  if (questCompletions.length === 0) return 'Start streak'
  if (quest.cadence === 'weekly' && !completedThisWeek) return 'Weekly target'
  if (quest.cadence === 'match-day') return 'Match prep'
  if (quest.cadence === 'practice-day') return 'Practice ready'
  return 'Next rep'
}

function getIdentityQuestCategories(identitySlug: string): LevelUpHabitCategory[] {
  if (identitySlug.includes('pressure') || identitySlug.includes('closer')) return ['mindset', 'match-prep', 'tennis-skill']
  if (identitySlug.includes('serve')) return ['tennis-skill', 'fitness', 'match-prep']
  if (identitySlug.includes('doubles')) return ['match-prep', 'mindset', 'tennis-skill']
  if (identitySlug.includes('defensive') || identitySlug.includes('movement')) return ['fitness', 'recovery', 'tennis-skill']
  if (identitySlug.includes('return')) return ['tennis-skill', 'match-prep', 'mindset']
  if (identitySlug.includes('net')) return ['tennis-skill', 'fitness', 'mindset']
  return ['tennis-skill', 'fitness', 'mindset']
}

function getWeekStartKey(date: Date) {
  const day = new Date(date)
  const dayOfWeek = day.getDay()
  day.setDate(day.getDate() - dayOfWeek)
  return formatDateKey(day)
}

function getDateOffsetKey(dateKey: string, offsetDays: number) {
  return formatDateKey(addDays(parseDateKey(dateKey), offsetDays))
}

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`)
}

function addDays(date: Date, offsetDays: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + offsetDays)
  return next
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
