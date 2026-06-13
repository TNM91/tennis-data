'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import { buildProductAccessState } from '@/lib/access-model'
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

type QuestPackAudience = 'player' | 'coach' | 'captain'

type QuestPack = {
  id: string
  title: string
  audience: QuestPackAudience
  goal: string
  description: string
  items: Array<{
    title: string
    category: LevelUpHabitCategory
    cadence: LevelUpQuestCadence
    xp: number
    linkedCardId: string
    proof: string
    starterHabit: string
  }>
}

type QuestGoalOption = {
  id: string
  title: string
  signal: string
  detail: string
  packId: string
  templateId: string
  cardId: string
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
const QUEST_BUILDER_DRAFT_KEY = 'tiq-level-up-quest-builder-draft-v1'

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

const QUEST_PACKS: QuestPack[] = [
  {
    id: 'build-consistency',
    title: 'Build Consistency',
    audience: 'player',
    goal: 'Reduce loose errors',
    description: 'Three repeatable habits for rally tolerance, recovery, and post-play learning.',
    items: [
      {
        title: 'Crosscourt tolerance block',
        category: 'tennis-skill',
        cadence: 'practice-day',
        xp: 15,
        linkedCardId: 'crosscourt-consistency',
        proof: 'Crosscourt build quality scored 0-5.',
        starterHabit: 'Run one crosscourt block before changing direction.',
      },
      {
        title: 'Recover before judging',
        category: 'fitness',
        cadence: 'practice-day',
        xp: 15,
        linkedCardId: 'recover-before-score',
        proof: 'Recovered before watching 0-5.',
        starterHabit: 'Recover fully before deciding if the shot was good.',
      },
      {
        title: 'One useful post-play note',
        category: 'match-prep',
        cadence: 'weekly',
        xp: 10,
        linkedCardId: 'post-match-five-minute-debrief',
        proof: 'One proof, one leak, one next rep.',
        starterHabit: 'Write one useful note after a match or hard practice.',
      },
    ],
  },
  {
    id: 'serve-under-pressure',
    title: 'Serve Under Pressure',
    audience: 'player',
    goal: 'Make serve starts clearer',
    description: 'Serve target, routine, and reset habits for tight points.',
    items: [
      {
        title: 'Serve target call',
        category: 'tennis-skill',
        cadence: 'practice-day',
        xp: 15,
        linkedCardId: 'serve-target-ladder',
        proof: 'Serve target clarity 0-5.',
        starterHabit: 'Call the serve target before the toss.',
      },
      {
        title: 'Second serve routine',
        category: 'mindset',
        cadence: 'practice-day',
        xp: 15,
        linkedCardId: 'second-serve-routine-reps',
        proof: 'Second-serve routine commitment 0-5.',
        starterHabit: 'Use the same breath and target before each second serve.',
      },
      {
        title: 'Double fault reset',
        category: 'match-prep',
        cadence: 'match-day',
        xp: 10,
        linkedCardId: 'double-fault-reset',
        proof: 'Reset used before the next point.',
        starterHabit: 'Reset with one breath and one target after a double fault.',
      },
    ],
  },
  {
    id: 'move-better',
    title: 'Move Better',
    audience: 'player',
    goal: 'Improve first move',
    description: 'Short movement habits tied to split timing, recovery, and durability.',
    items: [
      {
        title: 'Split-step timing',
        category: 'fitness',
        cadence: 'daily',
        xp: 10,
        linkedCardId: 'split-step-rhythm',
        proof: 'Split-step timing scored after the drill.',
        starterHabit: 'Complete one controlled split-step rhythm block.',
      },
      {
        title: 'Four-cone tennis star',
        category: 'fitness',
        cadence: 'practice-day',
        xp: 15,
        linkedCardId: 'four-cone-tennis-star',
        proof: 'Arrived balanced and recovered 0-5.',
        starterHabit: 'Move, set, recover before the next rep starts.',
      },
      {
        title: 'Post-play mobility',
        category: 'recovery',
        cadence: 'practice-day',
        xp: 10,
        linkedCardId: 'post-play-mobility-reset',
        proof: 'Recovery reset completed after play.',
        starterHabit: 'Do one mobility reset before leaving the court.',
      },
    ],
  },
  {
    id: 'doubles-readiness',
    title: 'Doubles Readiness',
    audience: 'coach',
    goal: 'Sharpen partner clarity',
    description: 'Assignment-ready habits for communication, first move, and 30-30 doubles clarity.',
    items: [
      {
        title: 'Partner first move',
        category: 'match-prep',
        cadence: 'practice-day',
        xp: 15,
        linkedCardId: 'partner-first-move-call',
        proof: 'Partner first-move clarity 0-5.',
        starterHabit: 'Call the partner job before the point starts.',
      },
      {
        title: 'Poach timing shadow',
        category: 'tennis-skill',
        cadence: 'practice-day',
        xp: 15,
        linkedCardId: 'poach-timing-shadow',
        proof: 'Switch call timing 0-5.',
        starterHabit: 'Shadow one switch call before live points.',
      },
      {
        title: '30-30 doubles clarity',
        category: 'mindset',
        cadence: 'match-day',
        xp: 15,
        linkedCardId: 'doubles-30-30-game',
        proof: 'Doubles clarity at 30-30 0-5.',
        starterHabit: 'Name the return job before every 30-30 point.',
      },
    ],
  },
  {
    id: 'match-day-routine',
    title: 'Match-Day Routine',
    audience: 'captain',
    goal: 'Arrive ready as a lineup',
    description: 'Team-ready pack for warm-up, return intent, and post-match learning.',
    items: [
      {
        title: 'Five-minute match primer',
        category: 'match-prep',
        cadence: 'match-day',
        xp: 10,
        linkedCardId: 'five-minute-match-primer',
        proof: 'Hydration plan checked before warm-up.',
        starterHabit: 'Check water, first target, and one match job before warm-up.',
      },
      {
        title: 'Return intent at 30-30',
        category: 'tennis-skill',
        cadence: 'match-day',
        xp: 15,
        linkedCardId: 'return-30-30-game',
        proof: 'Return intent at 30-30 0-5.',
        starterHabit: 'Choose the return job before the server tosses.',
      },
      {
        title: 'Post-match debrief',
        category: 'match-prep',
        cadence: 'weekly',
        xp: 10,
        linkedCardId: 'post-match-five-minute-debrief',
        proof: 'One proof, one leak, one next rep.',
        starterHabit: 'Capture one useful lesson before leaving the site.',
      },
    ],
  },
]

const QUEST_GOAL_OPTIONS: QuestGoalOption[] = [
  {
    id: 'reduce-errors',
    title: 'Reduce loose errors',
    signal: 'Rally tolerance',
    detail: 'Start with one crosscourt habit, then add recovery and a short debrief.',
    packId: 'build-consistency',
    templateId: 'opponent-scout-note',
    cardId: 'crosscourt-consistency',
  },
  {
    id: 'serve-pressure',
    title: 'Serve under pressure',
    signal: 'Target clarity',
    detail: 'Train target call, second-serve routine, and reset after misses.',
    packId: 'serve-under-pressure',
    templateId: 'serve-routine-builder',
    cardId: 'serve-target-ladder',
  },
  {
    id: 'move-better',
    title: 'Move better',
    signal: 'First move',
    detail: 'Connect split timing, balanced arrival, and post-play recovery.',
    packId: 'move-better',
    templateId: 'first-step-footwork',
    cardId: 'split-step-rhythm',
  },
  {
    id: 'doubles-clarity',
    title: 'Doubles clarity',
    signal: 'Partner jobs',
    detail: 'Use first-move calls, poach timing, and 30-30 return clarity.',
    packId: 'doubles-readiness',
    templateId: 'pressure-reset',
    cardId: 'partner-first-move-call',
  },
  {
    id: 'match-day-ready',
    title: 'Match-day ready',
    signal: 'Routine',
    detail: 'Turn warm-up, return intent, and post-match learning into repeatable habits.',
    packId: 'match-day-routine',
    templateId: 'match-day-hydration',
    cardId: 'five-minute-match-primer',
  },
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
  const { authResolved, userId, role, entitlements } = useAuth()
  const searchParams = useSearchParams()
  const firstTemplate = templates[0]
  const fallbackCardId = firstTemplate?.primaryCardId ?? cardOptions[0]?.id ?? ''
  const requestedQuestCardId = searchParams.get('questCard') || ''
  const requestedQuestCard = requestedQuestCardId ? cardOptions.find((card) => card.id === requestedQuestCardId) : undefined
  const [draft, setDraft] = useState<QuestBuilderDraft>(() => requestedQuestCard
    ? buildDraftFromCard(requestedQuestCard)
    : buildDraftFromTemplate(firstTemplate, fallbackCardId))
  const [customQuests, setCustomQuests] = useState<LevelUpCustomQuest[]>([])
  const [completions, setCompletions] = useState<LevelUpCustomQuestCompletion[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creatingPackId, setCreatingPackId] = useState('')
  const [archivingId, setArchivingId] = useState('')
  const [selectedQuestId, setSelectedQuestId] = useState('')
  const [selectedGoalId, setSelectedGoalId] = useState(QUEST_GOAL_OPTIONS[0]?.id ?? '')
  const draftHydratedRef = useRef(false)
  const [draftStorageReady, setDraftStorageReady] = useState(false)
  const [draftSyncStatus, setDraftSyncStatus] = useState(requestedQuestCard ? 'Loaded from drill card.' : 'Draft autosaves on this device.')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const access = useMemo(() => buildProductAccessState(userId ? role : 'public', entitlements), [entitlements, role, userId])
  const accessPending = Boolean(userId) && (!authResolved || entitlements === null)
  const canUseSavedQuestFeatures = Boolean(userId && access.canUseAdvancedPlayerInsights)

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
  const questCoach = useMemo(
    () => buildQuestCoachInsights(customQuests, completions, todayKey, weekStartKey, identitySlug),
    [completions, customQuests, identitySlug, todayKey, weekStartKey],
  )
  const weeklyReview = useMemo(
    () => buildWeeklyQuestReview(customQuests, completions, todayKey, weekStartKey),
    [completions, customQuests, todayKey, weekStartKey],
  )
  const selectedQuest = customQuests.find((quest) => quest.id === selectedQuestId) ?? customQuests[0] ?? null
  const selectedQuestCompletions = selectedQuest
    ? completions.filter((completion) => completion.customQuestId === selectedQuest.id).slice(0, 8)
    : []
  const selectedGoal = QUEST_GOAL_OPTIONS.find((goal) => goal.id === selectedGoalId) ?? QUEST_GOAL_OPTIONS[0]
  const selectedGoalPack = QUEST_PACKS.find((pack) => pack.id === selectedGoal?.packId)
  const selectedGoalTemplate = templates.find((template) => template.id === selectedGoal?.templateId)
  const selectedGoalCard = selectedGoal ? cardOptions.find((card) => card.id === selectedGoal.cardId) : undefined
  const selectedGoalWeekPlan = selectedGoal ? buildGoalWeekPlan(selectedGoal, selectedGoalPack, selectedGoalCard) : []
  const selectedGoalCoachHref = selectedGoal ? buildQuestHandoffHref('coach', selectedGoalPack, selectedGoal) : '/coach'
  const selectedGoalTeamHref = selectedGoal ? buildQuestHandoffHref('captain', selectedGoalPack, selectedGoal) : '/captain'

  const loadCustomQuests = useCallback(async () => {
    if (!userId || !canUseSavedQuestFeatures) {
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
        .limit(24),
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
  }, [canUseSavedQuestFeatures, todayKey, userId])

  useEffect(() => {
    if (!authResolved || accessPending) return

    const loadTimer = globalThis.setTimeout(() => {
      void loadCustomQuests()
    }, 0)

    return () => {
      globalThis.clearTimeout(loadTimer)
    }
  }, [accessPending, authResolved, loadCustomQuests])

  useEffect(() => {
    if (draftHydratedRef.current) return
    draftHydratedRef.current = true

    const hydrateTimer = globalThis.setTimeout(() => {
      if (requestedQuestCardId) {
        setDraftSyncStatus('Loaded from drill card. Draft saved on this device.')
        setDraftStorageReady(true)
        return
      }

      try {
        const storedDraft = globalThis.localStorage?.getItem(QUEST_BUILDER_DRAFT_KEY)
        const parsedDraft = parseQuestBuilderDraft(storedDraft)

        if (parsedDraft) {
          setDraft((current) => ({ ...current, ...parsedDraft }))
          setDraftSyncStatus('Draft restored from this device.')
        } else {
          setDraftSyncStatus('Draft saved on this device.')
        }
      } catch {
        setDraftSyncStatus('Draft autosaves on this device.')
      }

      setDraftStorageReady(true)
    }, 0)

    return () => {
      globalThis.clearTimeout(hydrateTimer)
    }
  }, [requestedQuestCardId])

  useEffect(() => {
    if (!draftStorageReady) return

    try {
      globalThis.localStorage?.setItem(QUEST_BUILDER_DRAFT_KEY, JSON.stringify(draft))
    } catch {
      // Storage can be blocked by browser settings; the in-memory draft still works.
    }
  }, [draft, draftStorageReady])

  function applyTemplate(template: QuestBuilderTemplateOption) {
    setDraft(buildDraftFromTemplate(template, template.primaryCardId))
    setMessage(`${template.title} loaded.`)
    setError('')
  }

  function resetDraft() {
    const nextDraft = requestedQuestCard
      ? buildDraftFromCard(requestedQuestCard)
      : buildDraftFromTemplate(firstTemplate, fallbackCardId)

    setDraft(nextDraft)
    setMessage('Draft reset.')
    setError('')

    try {
      globalThis.localStorage?.removeItem(QUEST_BUILDER_DRAFT_KEY)
      setDraftSyncStatus('Draft reset. New changes will autosave on this device.')
    } catch {
      setDraftSyncStatus('Draft reset for this tab.')
    }
  }

  function applyGoalOption(goal: QuestGoalOption) {
    const pack = QUEST_PACKS.find((item) => item.id === goal.packId)
    const packItem = pack?.items.find((item) => item.linkedCardId === goal.cardId) ?? pack?.items[0]
    const template = templates.find((item) => item.id === goal.templateId)
    const card = cardOptions.find((item) => item.id === goal.cardId)

    setSelectedGoalId(goal.id)
    setDraft(packItem
      ? buildDraftFromPackItem(packItem)
      : card
        ? buildDraftFromCard(card)
        : buildDraftFromTemplate(template, fallbackCardId))
    setMessage(`${goal.title} starter quest loaded.`)
    setError('')
  }

  async function saveQuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!userId || !canUseSavedQuestFeatures) {
      setError('Sign in to save custom quests.')
      return
    }
    const ownerId = userId

    const title = draft.title.trim()
    if (!title) {
      setError('Add a quest title.')
      return
    }

    setSaving(true)
    setMessage('')
    setError('')

    const payload = {
      user_id: ownerId,
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
      setCustomQuests((current) => [mapCustomQuestRow(data as CustomQuestRow), ...current].slice(0, 24))
      setMessage('Quest saved to your private Level Up plan.')
    }

    setSaving(false)
  }

  async function archiveQuest(id: string) {
    if (!userId || !canUseSavedQuestFeatures) return
    const ownerId = userId

    setArchivingId(id)
    setError('')
    setMessage('')

    const { error: archiveError } = await supabase
      .from('level_up_custom_quests')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', ownerId)

    if (archiveError) {
      setError('Quest could not be archived.')
    } else {
      setCustomQuests((current) => current.filter((quest) => quest.id !== id))
      setMessage('Quest archived.')
    }

    setArchivingId('')
  }

  async function createQuestPack(pack: QuestPack) {
    if (!userId) {
      setError('Sign in to save quest packs.')
      return
    }
    if (!canUseSavedQuestFeatures) {
      setError('Player access is required to save quest packs.')
      return
    }
    const ownerId = userId

    setCreatingPackId(pack.id)
    setMessage('')
    setError('')

    const existingKeys = new Set(customQuests.map((quest) => `${quest.title.toLowerCase()}::${quest.linkedCardId ?? ''}`))
    const payloads = pack.items
      .filter((item) => cardOptions.some((card) => card.id === item.linkedCardId))
      .filter((item) => !existingKeys.has(`${item.title.toLowerCase()}::${item.linkedCardId}`))
      .map((item) => ({
        user_id: ownerId,
        title: item.title,
        category: item.category,
        cadence: item.cadence,
        xp: item.xp,
        linked_card_id: item.linkedCardId,
        proof: item.proof,
        starter_habit: item.starterHabit,
        active: true,
        updated_at: new Date().toISOString(),
      }))

    if (payloads.length === 0) {
      setMessage(`${pack.title} is already in your saved quests.`)
      setCreatingPackId('')
      return
    }

    const { data, error: packError } = await supabase
      .from('level_up_custom_quests')
      .insert(payloads)
      .select(QUEST_SELECT)

    if (packError) {
      setError('Quest pack could not be saved.')
    } else {
      const nextQuests = ((data ?? []) as CustomQuestRow[]).map(mapCustomQuestRow)
      setCustomQuests((current) => [...nextQuests, ...current].slice(0, 24))
      setMessage(`${pack.title} added ${nextQuests.length} quest${nextQuests.length === 1 ? '' : 's'}.`)
    }

    setCreatingPackId('')
  }

  return (
    <div className={styles.levelUpQuestSavePanel} aria-labelledby="custom-quest-title">
      <div className={styles.levelUpQuestTemplatePicker}>
        <span>Templates</span>
        <strong id="custom-quest-title">Create your own quest</strong>
        <p>Start from a tennis-ready template, or use Add as quest on any drill card to prefill this builder.</p>
        <div>
          {templates.map((template) => (
            <button key={template.id} type="button" onClick={() => applyTemplate(template)}>
              <strong>{template.title}</strong>
              <small>{template.primaryCardTitle}</small>
            </button>
          ))}
        </div>
        <div className={styles.levelUpQuestGoalWizard} aria-label="Quest Builder goal wizard">
          <div>
            <span>Goal wizard</span>
            <strong>Pick the tennis problem first.</strong>
            <p>Choose one goal and the builder will load a starter quest, linked drill, proof, and cadence.</p>
          </div>
          <div className={styles.levelUpQuestGoalOptions}>
            {QUEST_GOAL_OPTIONS.map((goal) => (
              <button
                key={goal.id}
                type="button"
                data-active={selectedGoal?.id === goal.id ? 'true' : 'false'}
                onClick={() => setSelectedGoalId(goal.id)}
              >
                <strong>{goal.title}</strong>
                <small>{goal.signal}</small>
              </button>
            ))}
          </div>
          {selectedGoal ? (
            <article>
              <span>Recommended path</span>
              <strong>{selectedGoal.title}</strong>
              <p>{selectedGoal.detail}</p>
              <dl>
                <div>
                  <dt>Starter</dt>
                  <dd>{selectedGoalCard?.title ?? selectedGoalTemplate?.primaryCardTitle ?? 'Best matching card'}</dd>
                </div>
                <div>
                  <dt>Pack</dt>
                  <dd>{selectedGoalPack?.title ?? 'Custom path'}</dd>
                </div>
                <div>
                  <dt>Cadence</dt>
                  <dd>{selectedGoalTemplate?.cadence ? selectedGoalTemplate.cadence.replace('-', ' ') : 'practice day'}</dd>
                </div>
              </dl>
              <div className={styles.levelUpQuestWeekPlan} aria-label="7-day starter plan">
                <span>7-day starter plan</span>
                {selectedGoalWeekPlan.map((item) => (
                  <section key={item.label}>
                    <b>{item.label}</b>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </section>
                ))}
              </div>
              <div className={styles.levelUpQuestHandoffGrid} aria-label="Quest handoff options">
                <Link href={selectedGoalCoachHref}>
                  <span>Coach assignment bridge</span>
                  <strong>Assign through Coach Hub</strong>
                  <small>Send the same card, proof, and cadence into a coach-ready assignment flow.</small>
                </Link>
                <Link href={selectedGoalTeamHref}>
                  <span>Team challenge mode</span>
                  <strong>Launch as a team habit</strong>
                  <small>Aggregate completion only. Private player notes and proof stay with the player.</small>
                </Link>
              </div>
              <div>
                <button type="button" onClick={() => applyGoalOption(selectedGoal)}>Load starter quest</button>
                {selectedGoalPack ? (
                  <button type="button" onClick={() => void createQuestPack(selectedGoalPack)} disabled={creatingPackId === selectedGoalPack.id || accessPending}>
                    {creatingPackId === selectedGoalPack.id ? 'Adding pack' : 'Add full pack'}
                  </button>
                ) : null}
              </div>
            </article>
          ) : null}
        </div>
        <div className={styles.levelUpQuestPackList} aria-label="Goal-based quest packs">
          <strong>Goal packs</strong>
          {QUEST_PACKS.filter((pack) => pack.audience === 'player').map((pack) => (
            <article key={pack.id}>
              <span>{pack.goal}</span>
              <strong>{pack.title}</strong>
              <p>{pack.description}</p>
              <button type="button" onClick={() => void createQuestPack(pack)} disabled={creatingPackId === pack.id || accessPending}>
                {creatingPackId === pack.id ? 'Adding pack' : 'Add pack'}
              </button>
            </article>
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
          {authResolved && canUseSavedQuestFeatures ? (
            <button className="button-primary" type="submit" disabled={saving}>
              {saving ? 'Saving quest' : 'Save custom quest'}
            </button>
          ) : authResolved && userId ? (
            <Link className="button-primary" href="/pricing">Unlock Player</Link>
          ) : (
            <Link className="button-primary" href="/login">Sign in to save</Link>
          )}
          {selectedCard ? (
            <Link className="button-secondary" href={`/level-up/${identitySlug}?card=${selectedCard.id}#level-up-flow`}>
              Open linked drill
            </Link>
          ) : null}
          <button className="button-secondary" type="button" onClick={resetDraft}>
            Reset draft
          </button>
        </div>

        <p className={styles.levelUpQuestDraftStatus}>{draftSyncStatus}</p>
        {!authResolved ? <p className={styles.levelUpQuestNotice}>Checking your account.</p> : null}
        {authResolved && !userId ? <p className={styles.levelUpQuestNotice}>Saved quests unlock after sign-in.</p> : null}
        {authResolved && userId && !canUseSavedQuestFeatures ? (
          <p className={styles.levelUpQuestNotice}>Templates stay open. Saved custom quests, history, Quest Coach, and packs are Player features.</p>
        ) : null}
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

        <div className={styles.levelUpQuestCoachPanel} aria-labelledby="quest-coach-title">
          <div className={styles.levelUpQuestCoachHeader}>
            <span>Quest Coach</span>
            <strong id="quest-coach-title">This week&apos;s read</strong>
          </div>
          <div className={styles.levelUpQuestCoachGrid}>
            {questCoach.map((insight) => (
              <article key={insight.id}>
                <span>{insight.label}</span>
                <strong>{insight.title}</strong>
                <p>{insight.detail}</p>
              </article>
            ))}
          </div>
        </div>

        <div className={styles.levelUpQuestWeeklyReview} aria-label="Weekly quest review">
          <div>
            <span>Weekly review</span>
            <strong>{weeklyReview.title}</strong>
            <p>{weeklyReview.detail}</p>
          </div>
          <dl>
            <div>
              <dt>Completed</dt>
              <dd>{weeklyReview.completedCount}</dd>
            </div>
            <div>
              <dt>Best lane</dt>
              <dd>{weeklyReview.bestLane}</dd>
            </div>
            <div>
              <dt>Focus</dt>
              <dd>{weeklyReview.nextFocus}</dd>
            </div>
          </dl>
        </div>

        <div className={styles.levelUpQuestAssignmentPacks} aria-label="Coach and team quest packs">
          {QUEST_PACKS.filter((pack) => pack.audience !== 'player').map((pack) => (
            <article key={pack.id}>
              <span>{pack.audience === 'coach' ? 'Coach assignable' : 'Team pack'}</span>
              <strong>{pack.title}</strong>
              <p>{pack.description}</p>
              <div className={styles.levelUpQuestAssignmentActions}>
                <button type="button" onClick={() => void createQuestPack(pack)} disabled={creatingPackId === pack.id || accessPending}>
                  {creatingPackId === pack.id ? 'Adding pack' : 'Add to my plan'}
                </button>
                <Link href={pack.audience === 'coach' ? buildQuestHandoffHref('coach', pack) : buildQuestHandoffHref('captain', pack)}>
                  {pack.audience === 'coach' ? 'Open Coach bridge' : 'Open team challenge'}
                </Link>
              </div>
            </article>
          ))}
        </div>

        {selectedQuest ? (
          <details className={styles.levelUpQuestHistoryDrawer} open>
            <summary>
              <span>Quest history</span>
              <strong>{selectedQuest.title}</strong>
            </summary>
            <div>
              {selectedQuestCompletions.length ? (
                selectedQuestCompletions.map((completion) => (
                  <article key={completion.id}>
                    <span>{completion.completedOn}</span>
                    <strong>{completion.xp} XP{completion.proofRating === null ? '' : ` / ${completion.proofRating}/5 proof`}</strong>
                    <p>{completion.note || 'Linked drill proof saved.'}</p>
                  </article>
                ))
              ) : (
                <p>No completion history for this quest yet.</p>
              )}
            </div>
          </details>
        ) : null}

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
                    onClick={() => setSelectedQuestId(quest.id)}
                  >
                    History
                  </button>
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

function buildDraftFromCard(card: QuestBuilderCardOption): QuestBuilderDraft {
  return {
    title: `${card.title} Habit`,
    category: 'tennis-skill',
    cadence: 'practice-day',
    xp: 15,
    linkedCardId: card.id,
    proof: card.proof,
    starterHabit: `Run ${card.title}, score the proof, and repeat one useful cue.`,
  }
}

function buildDraftFromPackItem(item: QuestPack['items'][number]): QuestBuilderDraft {
  return {
    title: item.title,
    category: item.category,
    cadence: item.cadence,
    xp: item.xp,
    linkedCardId: item.linkedCardId,
    proof: item.proof,
    starterHabit: item.starterHabit,
  }
}

function parseQuestBuilderDraft(value: string | null): Partial<QuestBuilderDraft> | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<QuestBuilderDraft>
    const nextDraft: Partial<QuestBuilderDraft> = {}

    if (typeof parsed.title === 'string') nextDraft.title = parsed.title.slice(0, 90)
    if (CATEGORY_OPTIONS.includes(parsed.category as LevelUpHabitCategory)) nextDraft.category = parsed.category
    if (CADENCE_OPTIONS.some((option) => option.id === parsed.cadence)) nextDraft.cadence = parsed.cadence
    if (typeof parsed.xp === 'number' && Number.isFinite(parsed.xp)) nextDraft.xp = Math.min(100, Math.max(1, Math.round(parsed.xp)))
    if (typeof parsed.linkedCardId === 'string') nextDraft.linkedCardId = parsed.linkedCardId
    if (typeof parsed.proof === 'string') nextDraft.proof = parsed.proof.slice(0, 180)
    if (typeof parsed.starterHabit === 'string') nextDraft.starterHabit = parsed.starterHabit.slice(0, 220)

    return Object.keys(nextDraft).length ? nextDraft : null
  } catch {
    return null
  }
}

function buildQuestHandoffHref(target: 'coach' | 'captain', pack: QuestPack | undefined, goal?: QuestGoalOption) {
  const params = new URLSearchParams()

  if (pack) params.set(target === 'coach' ? 'levelUpPack' : 'levelUpChallenge', pack.id)
  if (goal) params.set('goal', goal.id)
  if (goal?.cardId) params.set('card', goal.cardId)

  const query = params.toString()
  return query ? `/${target}?${query}` : `/${target}`
}

function buildGoalWeekPlan(goal: QuestGoalOption, pack: QuestPack | undefined, card: QuestBuilderCardOption | undefined) {
  const starter = pack?.items.find((item) => item.linkedCardId === goal.cardId) ?? pack?.items[0]
  const repeat = pack?.items.find((item) => item.linkedCardId !== starter?.linkedCardId) ?? pack?.items[1] ?? starter
  const pressure = pack?.items.find((item) => item.cadence === 'match-day' || item.category === 'mindset' || item.category === 'match-prep') ?? pack?.items[2] ?? repeat

  return [
    {
      label: 'Day 1',
      title: starter?.title ?? card?.title ?? goal.title,
      detail: 'Load the starter quest, run one linked drill, and save one honest proof score.',
    },
    {
      label: 'Next practice',
      title: repeat?.title ?? starter?.title ?? goal.signal,
      detail: 'Repeat the same habit before adding more. Cleaner proof beats more volume.',
    },
    {
      label: 'Pressure rep',
      title: pressure?.title ?? goal.signal,
      detail: 'Add score, partner, or match-day context only after the base cue shows up.',
    },
    {
      label: 'Review',
      title: `${goal.signal} read`,
      detail: 'Use Quest history and Weekly review to decide whether to repeat, scale down, or add the full pack.',
    },
  ]
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

function buildQuestCoachInsights(
  quests: LevelUpCustomQuest[],
  completions: LevelUpCustomQuestCompletion[],
  todayKey: string,
  weekStartKey: string,
  identitySlug: string,
) {
  const identityCategories = getIdentityQuestCategories(identitySlug)
  const weeklyCompletions = completions.filter((completion) => completion.completedOn >= weekStartKey)
  const completedToday = new Set(completions.filter((completion) => completion.completedOn === todayKey).map((completion) => completion.customQuestId))
  const categoryCounts = CATEGORY_OPTIONS.map((category) => ({
    category,
    count: quests.filter((quest) => quest.category === category).length,
    weeklyCount: weeklyCompletions.filter((completion) => {
      const quest = quests.find((item) => item.id === completion.customQuestId)
      return quest?.category === category
    }).length,
  }))
  const identityGap = identityCategories.find((category) => categoryCounts.find((item) => item.category === category)?.count === 0)
  const quietLane = categoryCounts
    .filter((item) => item.count > 0)
    .sort((a, b) => a.weeklyCount - b.weeklyCount || b.count - a.count)[0]
  const strongestQuest = quests
    .map((quest) => ({
      quest,
      completions: completions.filter((completion) => completion.customQuestId === quest.id).length,
      doneToday: completedToday.has(quest.id),
    }))
    .sort((a, b) => b.completions - a.completions || Number(b.doneToday) - Number(a.doneToday))[0]
  const openToday = quests.filter((quest) => !completedToday.has(quest.id)).length

  return [
    {
      id: 'focus-lane',
      label: 'Focus lane',
      title: identityGap ? `Add ${formatHabitCategory(identityGap)}` : quietLane ? `Feed ${formatHabitCategory(quietLane.category)}` : 'Build the first lane',
      detail: identityGap
        ? 'Your identity stack has room for one more supporting habit lane.'
        : quietLane
          ? 'This lane exists but has the lightest proof this week.'
          : 'Save one drill-backed quest to unlock weekly reads.',
    },
    {
      id: 'momentum',
      label: 'Momentum',
      title: strongestQuest?.completions ? strongestQuest.quest.title : 'Start a proof trail',
      detail: strongestQuest?.completions
        ? `${strongestQuest.completions} proof log${strongestQuest.completions === 1 ? '' : 's'} on this quest. ${strongestQuest.doneToday ? 'Already handled today.' : 'It is still open today.'}`
        : 'One scored linked drill creates the first XP signal.',
    },
    {
      id: 'next-upgrade',
      label: 'Next upgrade',
      title: openToday ? `${openToday} quest${openToday === 1 ? '' : 's'} open` : 'Stack complete today',
      detail: openToday
        ? 'Start with the highest-ranked quest above and keep the session short enough to finish.'
        : 'Repeat a linked drill only if you want extra reps; the daily stack is clean.',
    },
  ]
}

function buildWeeklyQuestReview(
  quests: LevelUpCustomQuest[],
  completions: LevelUpCustomQuestCompletion[],
  todayKey: string,
  weekStartKey: string,
) {
  const weeklyCompletions = completions.filter((completion) => completion.completedOn >= weekStartKey && completion.completedOn <= todayKey)
  const bestCategory = CATEGORY_OPTIONS.map((category) => {
    const count = weeklyCompletions.filter((completion) => {
      const quest = quests.find((item) => item.id === completion.customQuestId)
      return quest?.category === category
    }).length
    return { category, count }
  }).sort((a, b) => b.count - a.count)[0]
  const openQuests = quests.filter((quest) => !weeklyCompletions.some((completion) => completion.customQuestId === quest.id))
  const nextFocus = openQuests[0]?.category ?? bestCategory?.category ?? 'tennis-skill'
  const completedCount = new Set(weeklyCompletions.map((completion) => `${completion.customQuestId}:${completion.completedOn}`)).size

  return {
    title: completedCount ? `${completedCount} quest proof${completedCount === 1 ? '' : 's'} this week` : 'No quest proof yet this week',
    detail: completedCount
      ? 'Use the best lane, missed lane, and next focus to keep next week simple.'
      : 'Start with one short linked drill so the review has a real signal.',
    completedCount,
    bestLane: bestCategory?.count ? formatHabitCategory(bestCategory.category) : 'Open',
    nextFocus: formatHabitCategory(nextFocus),
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
