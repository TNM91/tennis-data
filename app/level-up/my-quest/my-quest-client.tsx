'use client'

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import {
  PERSONAL_DAILY_QUESTS,
  PERSONAL_QUEST_PHOTO_BUCKET,
  buildPersonalQuestBossForecast,
  buildPersonalQuestBossCalendar,
  buildPersonalQuestBossWarnings,
  buildPersonalQuestCombos,
  buildPersonalQuestAchievementDetails,
  buildPersonalQuestDailyRecap,
  buildPersonalQuestDayModes,
  buildPersonalQuestFinale,
  buildPersonalQuestGamePlan,
  buildPersonalQuestHeatmap,
  buildPersonalQuestLoadouts,
  buildPersonalQuestMonthView,
  buildPersonalQuestMomentum,
  buildPersonalQuestRepairSummary,
  buildPersonalQuestReminders,
  buildPhotoCaptureGuidance,
  buildPersonalQuestRecapToast,
  buildPersonalQuestSeasonMap,
  buildPersonalQuestSeasonTimeline,
  buildPersonalQuestStats,
  buildPersonalQuestStreakShield,
  buildPersonalQuestTrendCards,
  buildPersonalQuestMomentumNudges,
  buildPersonalQuestMissPatterns,
  buildPersonalQuestCoachNote,
  buildPersonalQuestWeeklyPlan,
  buildPersonalQuestWaistTrend,
  buildPersonalQuestWeeklyGrade,
  buildQuestFeedback,
  buildSmartQuestRecommendation,
  buildStreakFreezeStatus,
  buildWeeklyFocusSuggestion,
  getDateOffsetKey,
  buildWeeklyBossStrategy,
  getDefaultPersonalQuestRule,
  getTodayKey,
  getWeekEndKey,
  getWeekStartKey,
  isPersonalQuestOwner,
  type DailyLog,
  type DailyQuestCompletion,
  type Measurement,
  type PersonalQuestId,
  type PersonalQuestMode,
  type PersonalQuestDefinition,
  type PersonalQuestAchievementDetail,
  type PersonalQuestFocusSuggestion,
  type PersonalStreakFreeze,
  type ProgressPhoto,
  type ProgressPhotoType,
  type WeeklyReview,
} from '@/lib/personal-quest'
import { supabase } from '@/lib/supabase'
import styles from './my-quest.module.css'

type PhotoPreview = ProgressPhoto & {
  signedUrl: string
}

type QuestUndo = {
  quest: PersonalQuestDefinition
  targetDate: string
  action: 'completed' | 'removed'
  message: string
}

type OfflineQuestAction = {
  id: string
  questId: PersonalQuestId
  targetDate: string
  action: 'complete' | 'remove'
  xp: number
}

type ClientIssue = {
  at: string
  scope: string
  detail: string
}

type LoadState = 'checking' | 'loading' | 'ready'
type PhotoCompareMode = 'latest_previous' | 'first_latest' | 'week_over_week'

const PHOTO_TYPES: Array<{ id: ProgressPhotoType; label: string }> = [
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'flex', label: 'Flex' },
]

const PHOTO_COMPARE_MODES: Array<{ id: PhotoCompareMode; label: string }> = [
  { id: 'latest_previous', label: 'Latest' },
  { id: 'first_latest', label: 'First' },
  { id: 'week_over_week', label: 'Week' },
]

const QUEST_STACKS: Array<{ id: string; label: string; hint: string; questIds: PersonalQuestId[] }> = [
  {
    id: 'morning_stack',
    label: 'Morning Stack',
    hint: 'Breakfast, creamer, water',
    questIds: ['protein_breakfast', 'creamer_goal', 'water_80_oz'],
  },
  {
    id: 'evening_close',
    label: 'Evening Close',
    hint: 'Core, IPA limit, kitchen closed',
    questIds: ['core_workout', 'alcohol_limit', 'no_food_after_8'],
  },
]

const MOBILE_TAP_PLAN_GROUPS: Array<{ id: string; label: string; questIds: PersonalQuestId[] }> = [
  {
    id: 'prime',
    label: 'Prime',
    questIds: ['protein_breakfast', 'creamer_goal', 'water_80_oz'],
  },
  {
    id: 'move',
    label: 'Move',
    questIds: ['no_chips_lunch', 'activity_20_min', 'core_workout'],
  },
  {
    id: 'close',
    label: 'Close',
    questIds: ['alcohol_limit', 'no_food_after_8'],
  },
]

const DAILY_QUEST_BY_ID = new Map(PERSONAL_DAILY_QUESTS.map((quest) => [quest.id, quest]))

const OFFLINE_QUEUE_KEY_PREFIX = 'personal-quest-offline-queue:'
const CLIENT_ISSUE_KEY_PREFIX = 'personal-quest-client-issues:'
const PHONE_MODE_PREFERENCE_KEY = 'personal-quest-phone-mode'
const PHOTO_SIGNED_URL_TTL_SECONDS = 300

export default function MyQuestClient() {
  const { authResolved, session, userId } = useAuth()
  const [loadState, setLoadState] = useState<LoadState>('checking')
  const [completions, setCompletions] = useState<DailyQuestCompletion[]>([])
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [streakFreezes, setStreakFreezes] = useState<PersonalStreakFreeze[]>([])
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [weeklyReview, setWeeklyReview] = useState<WeeklyReview | null>(null)
  const [photos, setPhotos] = useState<PhotoPreview[]>([])
  const [mode, setMode] = useState<PersonalQuestMode>(() => new Date().getHours() < 15 ? 'morning' : 'evening')
  const [ipaInput, setIpaInput] = useState('0')
  const [notesInput, setNotesInput] = useState('')
  const [repairIpaInput, setRepairIpaInput] = useState('0')
  const [repairNotesInput, setRepairNotesInput] = useState('')
  const [waistInput, setWaistInput] = useState('')
  const [weeklyRule, setWeeklyRule] = useState(getDefaultPersonalQuestRule())
  const [reviewWin, setReviewWin] = useState('')
  const [reviewMiss, setReviewMiss] = useState('')
  const [reviewFocus, setReviewFocus] = useState('')
  const [savingTracker, setSavingTracker] = useState(false)
  const [savingReview, setSavingReview] = useState(false)
  const [savingRule, setSavingRule] = useState(false)
  const [pendingQuest, setPendingQuest] = useState('')
  const [pendingStack, setPendingStack] = useState('')
  const [pendingFreeze, setPendingFreeze] = useState(false)
  const [uploadingType, setUploadingType] = useState<ProgressPhotoType | ''>('')
  const [compareType, setCompareType] = useState<ProgressPhotoType>('front')
  const [compareMode, setCompareMode] = useState<PhotoCompareMode>('latest_previous')
  const [selectedAchievementId, setSelectedAchievementId] = useState('')
  const [undoQuest, setUndoQuest] = useState<QuestUndo | null>(null)
  const [offlineQueueCount, setOfflineQueueCount] = useState(0)
  const [clientIssueCount, setClientIssueCount] = useState(0)
  const [lastClientIssue, setLastClientIssue] = useState('Clear')
  const [syncingOffline, setSyncingOffline] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('unsupported')
  const [phoneCompact, setPhoneCompact] = useState(false)
  const [intelOpen, setIntelOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [celebration, setCelebration] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const authUser = session?.user ?? null
  const ownerAllowed = isPersonalQuestOwner({ id: authUser?.id ?? userId, email: authUser?.email })
  const accessDenied = authResolved && (!(authUser?.id ?? userId) || !ownerAllowed)
  const today = useMemo(() => getTodayKey(), [])
  const repairDate = useMemo(() => getDateOffsetKey(today, -1), [today])
  const weekStart = useMemo(() => getWeekStartKey(), [])
  const weekEnd = useMemo(() => getWeekEndKey(weekStart), [weekStart])
  const isSunday = useMemo(() => new Date(`${today}T00:00:00`).getDay() === 0, [today])

  const stats = useMemo(
    () => buildPersonalQuestStats({ completions, logs, freezes: streakFreezes, today, weekStart }),
    [completions, logs, streakFreezes, today, weekStart],
  )

  const completedToday = useMemo(
    () => new Set(completions.filter((item) => item.completed_on === today).map((item) => item.quest_id)),
    [completions, today],
  )
  const completedRepairDay = useMemo(
    () => new Set(completions.filter((item) => item.completed_on === repairDate).map((item) => item.quest_id)),
    [completions, repairDate],
  )

  const bossBonus = stats.weeklyBossXp
  const heatmapDays = useMemo(
    () => buildPersonalQuestHeatmap({ completions, today, days: 90 }),
    [completions, today],
  )
  const monthView = useMemo(
    () => buildPersonalQuestMonthView({ completions, logs, freezes: streakFreezes, today }),
    [completions, logs, streakFreezes, today],
  )
  const repairSummary = useMemo(
    () => buildPersonalQuestRepairSummary({ completions, logs, date: repairDate }),
    [completions, logs, repairDate],
  )
  const weeklyFocusSuggestion = useMemo(
    () => buildWeeklyFocusSuggestion({ completions, logs, today, weekStart }),
    [completions, logs, today, weekStart],
  )
  const photoGuidance = useMemo(
    () => buildPhotoCaptureGuidance(photos, today),
    [photos, today],
  )
  const dayModes = useMemo(
    () => buildPersonalQuestDayModes({ completions, logs, today, weekStart }),
    [completions, logs, today, weekStart],
  )
  const streakShield = useMemo(
    () => buildPersonalQuestStreakShield({ completions, freezes: streakFreezes, today }),
    [completions, streakFreezes, today],
  )
  const weeklyGrade = useMemo(
    () => buildPersonalQuestWeeklyGrade({ stats, weeklyReviewSaved: Boolean(weeklyReview) }),
    [stats, weeklyReview],
  )
  const seasonTimeline = useMemo(
    () => buildPersonalQuestSeasonTimeline({ stats }),
    [stats],
  )
  const todayCompletedCount = completedToday.size
  const todayRemainingCount = Math.max(0, PERSONAL_DAILY_QUESTS.length - todayCompletedCount)
  const todayXp = useMemo(
    () => completions
      .filter((item) => item.completed_on === today)
      .reduce((sum, item) => sum + Math.max(0, item.xp_awarded), 0),
    [completions, today],
  )
  const smartQuest = useMemo(
    () => buildSmartQuestRecommendation({ completions, logs, today, weekStart, mode }),
    [completions, logs, mode, today, weekStart],
  )
  const todayFocusQuest = useMemo(
    () => smartQuest.quest ?? PERSONAL_DAILY_QUESTS.find((quest) => !completedToday.has(quest.id)) ?? null,
    [completedToday, smartQuest.quest],
  )
  const todayFocusProgress = Math.round((todayCompletedCount / PERSONAL_DAILY_QUESTS.length) * 100)
  const gamePlan = useMemo(
    () => buildPersonalQuestGamePlan({ completions, logs, today, weekStart, mode }),
    [completions, logs, mode, today, weekStart],
  )
  const loadouts = useMemo(
    () => buildPersonalQuestLoadouts({ completions, logs, today, weekStart }),
    [completions, logs, today, weekStart],
  )
  const seasonMap = useMemo(
    () => buildPersonalQuestSeasonMap(stats.totalXp),
    [stats.totalXp],
  )
  const dailyRecap = useMemo(
    () => buildPersonalQuestDailyRecap({ completions, logs, freezes: streakFreezes, today, weekStart }),
    [completions, logs, streakFreezes, today, weekStart],
  )
  const momentum = useMemo(
    () => buildPersonalQuestMomentum({ completions, freezes: streakFreezes, today }),
    [completions, streakFreezes, today],
  )
  const reminders = useMemo(
    () => buildPersonalQuestReminders({ completions, today, isSunday }),
    [completions, isSunday, today],
  )
  const waistTrend = useMemo(
    () => buildPersonalQuestWaistTrend(measurements),
    [measurements],
  )
  const finale = useMemo(
    () => buildPersonalQuestFinale(stats.totalXp),
    [stats.totalXp],
  )
  const achievementDetails = useMemo(
    () => buildPersonalQuestAchievementDetails(stats.achievements),
    [stats.achievements],
  )
  const selectedAchievement = useMemo(
    () => achievementDetails.find((achievement) => achievement.id === selectedAchievementId) ?? null,
    [achievementDetails, selectedAchievementId],
  )
  const trendCards = useMemo(
    () => buildPersonalQuestTrendCards({ completions, logs, measurements, today, weekStart }),
    [completions, logs, measurements, today, weekStart],
  )
  const bossForecast = useMemo(
    () => buildPersonalQuestBossForecast({ completions, logs, today, weekStart }),
    [completions, logs, today, weekStart],
  )
  const bossWarnings = useMemo(
    () => buildPersonalQuestBossWarnings(bossForecast),
    [bossForecast],
  )
  const momentumNudges = useMemo(
    () => buildPersonalQuestMomentumNudges({ completions, logs, today, weekStart }),
    [completions, logs, today, weekStart],
  )
  const missPatterns = useMemo(
    () => buildPersonalQuestMissPatterns({ completions, logs, today }),
    [completions, logs, today],
  )
  const weeklyPlan = useMemo(
    () => buildPersonalQuestWeeklyPlan({ completions, logs, today, weekStart }),
    [completions, logs, today, weekStart],
  )
  const coachNote = useMemo(
    () => buildPersonalQuestCoachNote({ completions, logs, today, weekStart }),
    [completions, logs, today, weekStart],
  )
  const bossCalendar = useMemo(
    () => buildPersonalQuestBossCalendar({ completions, logs, today, weekStart }),
    [completions, logs, today, weekStart],
  )
  const bossStrategy = useMemo(
    () => buildWeeklyBossStrategy({ forecast: bossForecast }),
    [bossForecast],
  )
  const questCombos = useMemo(
    () => buildPersonalQuestCombos({ completions, today }),
    [completions, today],
  )
  const freezeStatus = useMemo(
    () => buildStreakFreezeStatus({ completions, freezes: streakFreezes, today }),
    [completions, streakFreezes, today],
  )
  const recapToast = useMemo(
    () => buildPersonalQuestRecapToast({ recap: dailyRecap, shield: streakShield, warnings: bossWarnings }),
    [bossWarnings, dailyRecap, streakShield],
  )
  const dayCompleteSummary = useMemo(() => {
    const ipaCount = clampInt(ipaInput, 0, 30)

    if (todayRemainingCount === 0) {
      return {
        tone: 'green',
        title: 'Day complete',
        detail: `${todayXp} XP banked, ${stats.currentStreak} day streak live, ${ipaCount} IPAs logged.`,
        cta: 'Review recap',
        href: '#daily-recap',
      }
    }

    if (todayRemainingCount <= 2) {
      return {
        tone: 'amber',
        title: `${todayRemainingCount} quest${todayRemainingCount === 1 ? '' : 's'} to close`,
        detail: `${todayFocusQuest?.shortTitle ?? 'Next quest'} is the fastest path to a clean day.`,
        cta: todayFocusQuest ? `Bank +${todayFocusQuest.xp}` : 'View quests',
        href: '#today-quests',
      }
    }

    return {
      tone: 'blue',
      title: 'Build the board',
      detail: `${todayCompletedCount}/${PERSONAL_DAILY_QUESTS.length} complete. Start with ${todayFocusQuest?.shortTitle ?? 'the smart next quest'}.`,
      cta: todayFocusQuest ? `Bank +${todayFocusQuest.xp}` : 'View quests',
      href: '#today-quests',
    }
  }, [ipaInput, stats.currentStreak, todayCompletedCount, todayFocusQuest, todayRemainingCount, todayXp])
  const activeReminder = useMemo(
    () => reminders.find((reminder) => reminder.active) ?? reminders[0] ?? null,
    [reminders],
  )
  const mobileQuestShortcuts = [
    {
      label: 'Today',
      value: `${todayCompletedCount}/${PERSONAL_DAILY_QUESTS.length}`,
      href: '#lock-screen',
    },
    {
      label: 'Next',
      value: smartQuest.quest?.shortTitle ?? 'Done',
      href: phoneCompact ? '#lock-screen' : '#today-quests',
    },
    {
      label: 'Boss',
      value: weeklyGrade.grade,
      href: '#boss-warnings',
    },
    {
      label: 'Repair',
      value: repairSummary.status,
      href: '#repair-day',
    },
    {
      label: 'Phone',
      value: phoneCompact ? 'Pocket' : 'Full',
      href: '#phone-mode-control',
    },
  ]
  const mobileFocusQuests = useMemo(() => {
    const seen = new Set<PersonalQuestId>()
    return [
      smartQuest.quest,
      ...PERSONAL_DAILY_QUESTS.filter((quest) => !completedToday.has(quest.id)),
      ...PERSONAL_DAILY_QUESTS,
    ].filter((quest): quest is PersonalQuestDefinition => {
      if (!quest || seen.has(quest.id)) return false
      seen.add(quest.id)
      return true
    }).slice(0, 4)
  }, [completedToday, smartQuest.quest])
  const mobileTapPlan = useMemo(() => MOBILE_TAP_PLAN_GROUPS.map((group) => {
    const quests = group.questIds
      .map((questId) => DAILY_QUEST_BY_ID.get(questId))
      .filter((quest): quest is PersonalQuestDefinition => Boolean(quest))
    const remaining = quests.filter((quest) => !completedToday.has(quest.id))
    const nextQuest = remaining[0] ?? null

    return {
      ...group,
      completedCount: quests.length - remaining.length,
      nextQuest,
      totalCount: quests.length,
    }
  }), [completedToday])
  const mobilePocketTools = useMemo(() => [
    {
      label: 'Bosses',
      value: weeklyGrade.grade,
      sectionId: 'weekly-bosses',
    },
    {
      label: 'Trends',
      value: momentum.trend,
      sectionId: 'trend-strip',
    },
    {
      label: 'Photos',
      value: `${photos.length}`,
      sectionId: 'photo-compare',
    },
    {
      label: 'Badges',
      value: `${achievementDetails.filter((achievement) => achievement.unlocked).length}/${achievementDetails.length}`,
      sectionId: 'achievements',
    },
  ], [achievementDetails, momentum.trend, photos.length, weeklyGrade.grade])
  const comparePhotos = useMemo(() => {
    const matching = photos.filter((photo) => photo.photo_type === compareType)
    const latest = matching[0] ?? null
    const previous = matching[1] ?? null
    const first = matching[matching.length - 1] ?? null
    const weekPrior = latest?.captured_on
      ? matching.find((photo) => photo.captured_on && daysBetween(photo.captured_on, latest.captured_on ?? today) >= 7) ?? previous
      : previous

    if (compareMode === 'first_latest') {
      return {
        latest,
        previous: first,
        latestLabel: 'Latest',
        previousLabel: 'First',
      }
    }

    if (compareMode === 'week_over_week') {
      return {
        latest,
        previous: weekPrior,
        latestLabel: 'Latest',
        previousLabel: 'Week prior',
      }
    }

    return {
      latest,
      previous,
      latestLabel: 'Latest',
      previousLabel: 'Previous',
    }
  }, [compareMode, compareType, photos, today])

  const weeklyIpaCount = useMemo(
    () => logs
      .filter((log) => log.log_date >= weekStart && log.log_date <= weekEnd)
      .reduce((sum, log) => sum + Math.max(0, log.ipa_count || 0), 0),
    [logs, weekEnd, weekStart],
  )

  const weeklyChipFreeLunches = useMemo(
    () => new Set(
      completions
        .filter((item) => item.quest_id === 'no_chips_lunch' && item.completed_on >= weekStart && item.completed_on <= weekEnd)
        .map((item) => item.completed_on),
    ).size,
    [completions, weekEnd, weekStart],
  )

  const loadDashboard = useCallback(async (ownerId: string) => {
    setLoadState('loading')
    setError('')

    const [
      profileResult,
      completionResult,
      logResult,
      freezeResult,
      measurementResult,
      reviewResult,
      photoResult,
    ] = await Promise.all([
      supabase
        .from('personal_quest_profiles')
        .select('weekly_rule')
        .eq('user_id', ownerId)
        .maybeSingle(),
      supabase
        .from('personal_daily_quest_completions')
        .select('quest_id, completed_on, xp_awarded')
        .eq('user_id', ownerId)
        .order('completed_on', { ascending: false })
        .limit(500),
      supabase
        .from('personal_daily_logs')
        .select('log_date, ipa_count, notes')
        .eq('user_id', ownerId)
        .order('log_date', { ascending: false })
        .limit(180),
      supabase
        .from('personal_streak_freezes')
        .select('freeze_date, reason')
        .eq('user_id', ownerId)
        .order('freeze_date', { ascending: false })
        .limit(120),
      supabase
        .from('personal_measurements')
        .select('measured_on, waist_inches')
        .eq('user_id', ownerId)
        .order('measured_on', { ascending: false })
        .limit(80),
      supabase
        .from('personal_weekly_reviews')
        .select('week_start, waist_inches, weekly_xp, ipa_count, chip_free_lunches, biggest_win, biggest_miss, focus_next_week')
        .eq('user_id', ownerId)
        .eq('week_start', weekStart)
        .maybeSingle(),
      supabase
        .from('personal_progress_photos')
        .select('id, photo_type, storage_path, captured_on, created_at')
        .eq('user_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(12),
    ])

    if (profileResult.error) throw new Error(profileResult.error.message)
    if (completionResult.error) throw new Error(completionResult.error.message)
    if (logResult.error) throw new Error(logResult.error.message)
    if (freezeResult.error) throw new Error(freezeResult.error.message)
    if (measurementResult.error) throw new Error(measurementResult.error.message)
    if (reviewResult.error) throw new Error(reviewResult.error.message)
    if (photoResult.error) throw new Error(photoResult.error.message)

    const nextCompletions = (completionResult.data ?? []) as DailyQuestCompletion[]
    const nextLogs = (logResult.data ?? []) as DailyLog[]
    const nextFreezes = (freezeResult.data ?? []) as PersonalStreakFreeze[]
    const nextMeasurements = (measurementResult.data ?? []) as Measurement[]
    const nextReview = (reviewResult.data ?? null) as WeeklyReview | null
    const nextPhotos = (photoResult.data ?? []) as ProgressPhoto[]

    setCompletions(nextCompletions)
    setLogs(nextLogs)
    setStreakFreezes(nextFreezes)
    setMeasurements(nextMeasurements)
    setWeeklyReview(nextReview)
    setWeeklyRule((profileResult.data as { weekly_rule?: string } | null)?.weekly_rule || getDefaultPersonalQuestRule())
    setIpaInput(String(nextLogs.find((log) => log.log_date === today)?.ipa_count ?? 0))
    setNotesInput(nextLogs.find((log) => log.log_date === today)?.notes ?? '')
    setWaistInput(
      String(
        nextReview?.waist_inches ??
        nextMeasurements.find((measurement) => measurement.measured_on === weekStart)?.waist_inches ??
        '',
      ),
    )
    setReviewWin(nextReview?.biggest_win ?? '')
    setReviewMiss(nextReview?.biggest_miss ?? '')
    setReviewFocus(nextReview?.focus_next_week ?? '')
    setPhotos(await signPhotos(nextPhotos))

    await supabase.from('personal_quest_profiles').upsert({
      user_id: ownerId,
      season_slug: 'operation-visible-abs',
      display_name: 'Nathan',
      weekly_rule: (profileResult.data as { weekly_rule?: string } | null)?.weekly_rule || getDefaultPersonalQuestRule(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    setLoadState('ready')
  }, [today, weekStart])

  const recordClientIssue = useCallback((scope: string, detail: string) => {
    const ownerId = authUser?.id ?? userId
    if (!ownerId) return

    const nextCount = recordQuestClientIssue(ownerId, scope, detail)
    setClientIssueCount(nextCount)
    setLastClientIssue(scope)
  }, [authUser?.id, userId])

  const setQuestError = useCallback((scope: string, detail: string) => {
    setError(detail)
    recordClientIssue(scope, detail)
  }, [recordClientIssue])

  useEffect(() => {
    if (!authResolved) return

    const ownerId = authUser?.id ?? userId
    if (!ownerId || !ownerAllowed) {
      return
    }

    const timeout = window.setTimeout(() => {
      void loadDashboard(ownerId).catch((err) => {
        setQuestError('load dashboard', err instanceof Error ? err.message : 'My Quest could not load.')
        setLoadState('ready')
      })
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [authResolved, authUser?.id, loadDashboard, ownerAllowed, setQuestError, userId])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const media = window.matchMedia('(max-width: 640px)')
    const updateCompactMode = () => {
      const preference = readPhoneModePreference()
      setPhoneCompact(media.matches && (preference ? preference === 'pocket' : true))
    }
    updateCompactMode()
    media.addEventListener('change', updateCompactMode)

    return () => media.removeEventListener('change', updateCompactMode)
  }, [])

  useEffect(() => {
    const ownerId = authUser?.id ?? userId
    if (!ownerId || !ownerAllowed || loadState !== 'ready') return

    const unlocked = stats.achievements
      .filter((achievement) => achievement.unlocked)
      .map((achievement) => ({
        user_id: ownerId,
        achievement_id: achievement.id,
      }))

    if (!unlocked.length) return
    void supabase.from('personal_achievements').upsert(unlocked, { onConflict: 'user_id,achievement_id' })
  }, [authUser?.id, loadState, ownerAllowed, stats.achievements, userId])

  useEffect(() => {
    const ownerId = authUser?.id ?? userId
    if (!ownerId || !ownerAllowed || loadState !== 'ready') return

    const storageKey = `personal-quest-celebrations:${ownerId}`
    const seen = new Set((window.localStorage.getItem(storageKey) || '').split(',').filter(Boolean))
    const milestones = [
      `level:${stats.level.title}`,
      ...stats.achievements.filter((achievement) => achievement.unlocked).map((achievement) => `badge:${achievement.id}`),
    ]
    const nextMilestone = milestones.find((item) => !seen.has(item))
    if (!nextMilestone) return

    seen.add(nextMilestone)
    window.localStorage.setItem(storageKey, Array.from(seen).join(','))
    const message = nextMilestone.startsWith('level:')
      ? `${stats.level.title} unlocked. New level banked.`
      : `${stats.achievements.find((achievement) => `badge:${achievement.id}` === nextMilestone)?.title ?? 'Badge'} unlocked.`
    const timeout = window.setTimeout(() => setCelebration(message), 0)
    return () => window.clearTimeout(timeout)
  }, [authUser?.id, loadState, ownerAllowed, stats.achievements, stats.level.title, userId])

  useEffect(() => {
    const repairLog = logs.find((log) => log.log_date === repairDate)
    const timeout = window.setTimeout(() => {
      setRepairIpaInput(String(repairLog?.ipa_count ?? 0))
      setRepairNotesInput(repairLog?.notes ?? '')
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [logs, repairDate])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setNotificationPermission(getBrowserNotificationPermission())
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    const ownerId = authUser?.id ?? userId
    if (!ownerId || !ownerAllowed) return

    const timeout = window.setTimeout(() => {
      setOfflineQueueCount(readOfflineQueue(ownerId).length)
      const issues = readQuestClientIssues(ownerId)
      setClientIssueCount(issues.length)
      setLastClientIssue(issues[0]?.scope ?? 'Clear')
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [authUser?.id, ownerAllowed, userId])

  const flushOfflineQueue = useCallback(async (ownerId: string) => {
    const queued = readOfflineQueue(ownerId)
    if (!queued.length || syncingOffline || !isBrowserOnline()) {
      setOfflineQueueCount(queued.length)
      return
    }

    setSyncingOffline(true)
    setError('')

    const remaining: OfflineQuestAction[] = []
    for (const action of queued) {
      const quest = PERSONAL_DAILY_QUESTS.find((item) => item.id === action.questId)
      if (!quest) continue

      const result = action.action === 'remove'
        ? await supabase
            .from('personal_daily_quest_completions')
            .delete()
            .eq('user_id', ownerId)
            .eq('completed_on', action.targetDate)
            .eq('quest_id', action.questId)
        : await supabase
            .from('personal_daily_quest_completions')
            .upsert({
              user_id: ownerId,
              completed_on: action.targetDate,
              quest_id: action.questId,
              xp_awarded: action.xp || quest.xp,
            }, { onConflict: 'user_id,completed_on,quest_id' })

      if (result.error) remaining.push(action)
    }

    writeOfflineQueue(ownerId, remaining)
    setOfflineQueueCount(remaining.length)
    setSyncingOffline(false)
    if (queued.length && !remaining.length) setMessage('Offline quest queue synced.')
    if (remaining.length) setQuestError('offline sync', `${remaining.length} offline ${remaining.length === 1 ? 'action' : 'actions'} still need sync.`)
  }, [setQuestError, syncingOffline])

  useEffect(() => {
    const ownerId = authUser?.id ?? userId
    if (!ownerId || !ownerAllowed || loadState !== 'ready') return

    const handleOnline = () => {
      void flushOfflineQueue(ownerId)
    }
    window.addEventListener('online', handleOnline)
    const timeout = window.setTimeout(() => {
      if (isBrowserOnline()) void flushOfflineQueue(ownerId)
    }, 0)

    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener('online', handleOnline)
    }
  }, [authUser?.id, flushOfflineQueue, loadState, ownerAllowed, userId])

  async function toggleQuest(quest: PersonalQuestDefinition) {
    await toggleQuestForDate(quest, today)
  }

  async function toggleQuestForDate(
    quest: PersonalQuestDefinition,
    targetDate: string,
    options: { suppressUndo?: boolean } = {},
  ) {
    const ownerId = authUser?.id ?? userId
    if (!ownerId || pendingQuest) return

    const alreadyComplete = completions.some((item) => item.completed_on === targetDate && item.quest_id === quest.id)
    const pendingKey = `${targetDate}:${quest.id}`
    setPendingQuest(pendingKey)
    setError('')
    setMessage('')

    if (alreadyComplete) {
      const before = completions
      setCompletions((current) => current.filter((item) => !(item.completed_on === targetDate && item.quest_id === quest.id)))

      if (!isBrowserOnline()) {
        setPendingQuest('')
        setOfflineQueueCount(queueOfflineQuestAction(ownerId, {
          id: createOfflineActionId(),
          questId: quest.id,
          targetDate,
          action: 'remove',
          xp: quest.xp,
        }))
        if (!options.suppressUndo) {
          setUndoQuest({ quest, targetDate, action: 'removed', message: 'Quest removal queued.' })
        }
        setMessage(`${targetDate === today ? buildQuestFeedback(quest, 'removed') : `${quest.shortTitle} removed from yesterday.`} Queued offline.`)
        return
      }

      const { error: deleteError } = await supabase
        .from('personal_daily_quest_completions')
        .delete()
        .eq('user_id', ownerId)
        .eq('completed_on', targetDate)
        .eq('quest_id', quest.id)

      if (deleteError) {
        setCompletions(before)
        setQuestError('quest delete', deleteError.message)
      } else {
        setMessage(targetDate === today ? buildQuestFeedback(quest, 'removed') : `${quest.shortTitle} removed from yesterday. XP adjusted.`)
        if (!options.suppressUndo) {
          setUndoQuest({ quest, targetDate, action: 'removed', message: 'Quest removed.' })
        }
      }
      setPendingQuest('')
      return
    }

    const completion: DailyQuestCompletion = {
      quest_id: quest.id,
      completed_on: targetDate,
      xp_awarded: quest.xp,
    }
    setCompletions((current) => [completion, ...current])

    if (!isBrowserOnline()) {
      setPendingQuest('')
      setOfflineQueueCount(queueOfflineQuestAction(ownerId, {
        id: createOfflineActionId(),
        questId: quest.id,
        targetDate,
        action: 'complete',
        xp: quest.xp,
      }))
      if (!options.suppressUndo) {
        setUndoQuest({ quest, targetDate, action: 'completed', message: 'Quest completion queued.' })
      }
      setMessage(`${targetDate === today ? buildQuestFeedback(quest, 'completed') : `${quest.shortTitle} repaired for yesterday. +${quest.xp} XP.`} Queued offline.`)
      return
    }

    const { error: upsertError } = await supabase
      .from('personal_daily_quest_completions')
      .upsert({
        user_id: ownerId,
        completed_on: targetDate,
        quest_id: quest.id,
        xp_awarded: quest.xp,
      }, { onConflict: 'user_id,completed_on,quest_id' })

    if (upsertError) {
      setCompletions((current) => current.filter((item) => !(item.completed_on === targetDate && item.quest_id === quest.id)))
      setQuestError('quest upsert', upsertError.message)
    } else {
      setMessage(targetDate === today ? buildQuestFeedback(quest, 'completed') : `${quest.shortTitle} repaired for yesterday. +${quest.xp} XP.`)
      if (!options.suppressUndo) {
        setUndoQuest({ quest, targetDate, action: 'completed', message: 'Quest completed.' })
      }
    }

    setPendingQuest('')
  }

  async function completeQuestStack(stack: { label: string; questIds: PersonalQuestId[] }) {
    const ownerId = authUser?.id ?? userId
    if (!ownerId || pendingQuest || pendingStack) return

    const quests = stack.questIds
      .map((questId) => PERSONAL_DAILY_QUESTS.find((quest) => quest.id === questId))
      .filter((quest): quest is PersonalQuestDefinition => Boolean(quest))
      .filter((quest) => !completedToday.has(quest.id))

    if (!quests.length) {
      setMessage(`${stack.label} already complete.`)
      return
    }

    setPendingStack(stack.label)
    setError('')
    setMessage('')

    const before = completions
    const nextCompletions = quests.map((quest) => ({
      quest_id: quest.id,
      completed_on: today,
      xp_awarded: quest.xp,
    }))
    setCompletions((current) => [...nextCompletions, ...current])

    if (!isBrowserOnline()) {
      let queuedCount = 0
      for (const quest of quests) {
        queuedCount = queueOfflineQuestAction(ownerId, {
          id: createOfflineActionId(),
          questId: quest.id,
          targetDate: today,
          action: 'complete',
          xp: quest.xp,
        })
      }
      setOfflineQueueCount(queuedCount)
      const xp = nextCompletions.reduce((sum, completion) => sum + completion.xp_awarded, 0)
      setMessage(`${stack.label} queued offline. +${xp} XP visible now.`)
      setPendingStack('')
      return
    }

    const { error: upsertError } = await supabase
      .from('personal_daily_quest_completions')
      .upsert(nextCompletions.map((completion) => ({
        user_id: ownerId,
        completed_on: completion.completed_on,
        quest_id: completion.quest_id,
        xp_awarded: completion.xp_awarded,
      })), { onConflict: 'user_id,completed_on,quest_id' })

    if (upsertError) {
      setCompletions(before)
      setQuestError('stack upsert', upsertError.message)
    } else {
      const xp = nextCompletions.reduce((sum, completion) => sum + completion.xp_awarded, 0)
      setMessage(`${stack.label} complete. +${xp} XP.`)
    }

    setPendingStack('')
  }

  async function undoLastQuestAction() {
    const undo = undoQuest
    if (!undo) return
    setUndoQuest(null)
    await toggleQuestForDate(undo.quest, undo.targetDate, { suppressUndo: true })
  }

  async function requestReminderPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported')
      setQuestError('reminder support', 'Browser reminders are not supported here.')
      return
    }

    const permission = await window.Notification.requestPermission()
    setNotificationPermission(permission)
    setMessage(permission === 'granted' ? 'Browser reminders enabled on this device.' : 'Browser reminders were not enabled.')
  }

  function sendTestReminder() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported')
      setQuestError('reminder support', 'Browser reminders are not supported here.')
      return
    }

    if (window.Notification.permission !== 'granted') {
      setNotificationPermission(window.Notification.permission)
      setQuestError('reminder permission', 'Enable browser reminders first.')
      return
    }

    setNotificationPermission(window.Notification.permission)
    new window.Notification('My Quest reminder', { body: coachNote.detail })
    setMessage('Test reminder sent on this device.')
  }

  async function saveDailyTrackers(nextIpaInput = ipaInput, nextNotesInput = notesInput) {
    await saveDailyTrackersForDate(today, nextIpaInput, nextNotesInput)
  }

  async function saveRepairTrackers(nextIpaInput = repairIpaInput, nextNotesInput = repairNotesInput) {
    await saveDailyTrackersForDate(repairDate, nextIpaInput, nextNotesInput)
  }

  async function saveDailyTrackersForDate(targetDate: string, nextIpaInput: string, nextNotesInput: string) {
    const ownerId = authUser?.id ?? userId
    if (!ownerId) return

    setSavingTracker(true)
    setError('')
    setMessage('')

    const ipaCount = clampInt(nextIpaInput, 0, 30)
    const cleanNotes = nextNotesInput.trim().slice(0, 1600)
    const payload = {
      user_id: ownerId,
      log_date: targetDate,
      ipa_count: ipaCount,
      notes: cleanNotes,
      updated_at: new Date().toISOString(),
    }

    const { error: upsertError } = await supabase
      .from('personal_daily_logs')
      .upsert(payload, { onConflict: 'user_id,log_date' })

    if (upsertError) {
      setQuestError('daily tracker', upsertError.message)
    } else {
      setLogs((current) => upsertByDate(current, { log_date: targetDate, ipa_count: ipaCount, notes: cleanNotes }, 'log_date'))
      if (targetDate === today) {
        setIpaInput(String(ipaCount))
        setNotesInput(cleanNotes)
      } else {
        setRepairIpaInput(String(ipaCount))
        setRepairNotesInput(cleanNotes)
      }
      setMessage(targetDate === today ? 'Daily tracker saved.' : 'Yesterday repair saved.')
    }

    setSavingTracker(false)
  }

  async function saveWeeklyReview() {
    const ownerId = authUser?.id ?? userId
    if (!ownerId) return

    setSavingReview(true)
    setError('')
    setMessage('')

    const waist = normalizeOptionalNumber(waistInput)
    const reviewPayload = {
      user_id: ownerId,
      week_start: weekStart,
      waist_inches: waist,
      weekly_xp: stats.weeklyXp,
      ipa_count: weeklyIpaCount,
      chip_free_lunches: weeklyChipFreeLunches,
      biggest_win: reviewWin.trim().slice(0, 1200),
      biggest_miss: reviewMiss.trim().slice(0, 1200),
      focus_next_week: reviewFocus.trim().slice(0, 1200),
      updated_at: new Date().toISOString(),
    }

    const [reviewResult, measurementResult] = await Promise.all([
      supabase
        .from('personal_weekly_reviews')
        .upsert(reviewPayload, { onConflict: 'user_id,week_start' })
        .select('week_start, waist_inches, weekly_xp, ipa_count, chip_free_lunches, biggest_win, biggest_miss, focus_next_week')
        .single(),
      waist === null
        ? Promise.resolve({ error: null })
        : supabase
            .from('personal_measurements')
            .upsert({
              user_id: ownerId,
              measured_on: weekStart,
              waist_inches: waist,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,measured_on' }),
    ])

    if (reviewResult.error) {
      setQuestError('weekly review', reviewResult.error.message)
    } else if (measurementResult.error) {
      setQuestError('weekly measurement', measurementResult.error.message)
    } else {
      const nextReview = reviewResult.data as WeeklyReview
      setWeeklyReview(nextReview)
      if (waist !== null) {
        setWaistInput(String(waist))
        setMeasurements((current) => upsertByDate(current, { measured_on: weekStart, waist_inches: waist }, 'measured_on'))
      }
      setMessage('Weekly review saved.')
    }

    setSavingReview(false)
  }

  async function saveWeeklyRule() {
    const ownerId = authUser?.id ?? userId
    if (!ownerId) return

    setSavingRule(true)
    setError('')
    setMessage('')

    const cleanRule = weeklyRule.trim().slice(0, 220) || getDefaultPersonalQuestRule()
    const { error: upsertError } = await supabase
      .from('personal_quest_profiles')
      .upsert({
        user_id: ownerId,
        season_slug: 'operation-visible-abs',
        display_name: 'Nathan',
        weekly_rule: cleanRule,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (upsertError) {
      setQuestError('weekly rule', upsertError.message)
    } else {
      setWeeklyRule(cleanRule)
      setMessage('Weekly rule locked in.')
    }

    setSavingRule(false)
  }

  async function spendStreakFreeze() {
    const ownerId = authUser?.id ?? userId
    if (!ownerId || pendingFreeze || !freezeStatus.canUseToday) return

    setPendingFreeze(true)
    setError('')
    setMessage('')

    const nextFreeze: PersonalStreakFreeze = {
      freeze_date: freezeStatus.targetDate,
      reason: 'Save the day',
    }
    const before = streakFreezes
    setStreakFreezes((current) => [nextFreeze, ...current.filter((item) => item.freeze_date !== nextFreeze.freeze_date)])

    const { error: upsertError } = await supabase
      .from('personal_streak_freezes')
      .upsert({
        user_id: ownerId,
        freeze_date: nextFreeze.freeze_date,
        reason: nextFreeze.reason,
      }, { onConflict: 'user_id,freeze_date' })

    if (upsertError) {
      setStreakFreezes(before)
      setQuestError('streak freeze', upsertError.message)
    } else {
      setMessage('Streak freeze used. Streak protected, no XP awarded.')
    }

    setPendingFreeze(false)
  }

  async function uploadPhoto(type: ProgressPhotoType, event: ChangeEvent<HTMLInputElement>) {
    const ownerId = authUser?.id ?? userId
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!ownerId || !file) return

    setUploadingType(type)
    setError('')
    setMessage('')

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setQuestError('photo file type', 'Upload a JPG, PNG, or WebP progress photo.')
      setUploadingType('')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setQuestError('photo file size', 'Progress photos need to be 10 MB or smaller.')
      setUploadingType('')
      return
    }

    const extension = getPhotoExtension(file)
    const photoNonce = createPrivatePhotoNonce()
    const storagePath = `${ownerId}/${today}/${type}-${photoNonce}.${extension}`
    const upload = await supabase.storage
      .from(PERSONAL_QUEST_PHOTO_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      })

    if (upload.error) {
      setQuestError('photo upload', upload.error.message)
      setUploadingType('')
      return
    }

    const inserted = await supabase
      .from('personal_progress_photos')
      .insert({
        user_id: ownerId,
        photo_type: type,
        storage_bucket: PERSONAL_QUEST_PHOTO_BUCKET,
        storage_path: storagePath,
        captured_on: today,
      })
      .select('id, photo_type, storage_path, created_at')
      .single()

    if (inserted.error) {
      await supabase.storage.from(PERSONAL_QUEST_PHOTO_BUCKET).remove([storagePath])
      setQuestError('photo metadata', inserted.error.message)
      setUploadingType('')
      return
    }

    const signed = await signPhotos([inserted.data as ProgressPhoto])
    setPhotos((current) => [...signed, ...current].slice(0, 12))
    setMessage(`${PHOTO_TYPES.find((photoType) => photoType.id === type)?.label ?? 'Progress'} photo saved privately.`)
    setUploadingType('')
  }

  async function adjustIpa(delta: number) {
    const nextValue = String(Math.max(0, clampInt(ipaInput, 0, 30) + delta))
    setIpaInput(nextValue)
    await saveDailyTrackers(nextValue, notesInput)
  }

  async function adjustRepairIpa(delta: number) {
    const nextValue = String(Math.max(0, clampInt(repairIpaInput, 0, 30) + delta))
    setRepairIpaInput(nextValue)
    await saveRepairTrackers(nextValue, repairNotesInput)
  }

  function openFullDashboardSection(sectionId: string) {
    writePhoneModePreference('full')
    setPhoneCompact(false)

    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }, 0)
  }

  if (accessDenied) {
    return (
      <section className={styles.pageShell}>
        <div className={styles.notFoundPanel}>
          <p className={styles.notFoundCode}>404</p>
          <h1>Not Found</h1>
        </div>
      </section>
    )
  }

  if (loadState === 'checking' || loadState === 'loading') {
    return (
      <section className={styles.pageShell}>
        <div className={styles.loadingPanel}>
          <span className={styles.loaderBall} aria-hidden="true" />
          <p>Loading My Quest.</p>
        </div>
      </section>
    )
  }

  return (
    <section className={styles.pageShell} data-phone-mode={phoneCompact ? 'pocket' : 'full'}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Level Up: My Quest</p>
          <h1>Operation Visible Abs</h1>
          <p className={styles.heroText}>Season 1 private quest board. Stack the habits, keep the streak alive, and beat the weekly bosses.</p>
          <div className={styles.heroActions}>
            <a href="#lock-screen">Lock</a>
            <a href="#today-quests">Today</a>
            <a href="#boss-warnings">Boss</a>
            <a href="#month-view">Month</a>
            <a href="#repair-day">Repair</a>
            <a href="#season-timeline">Timeline</a>
            <a href="#season-map">Season</a>
            <a href="#momentum">Momentum</a>
            <a href="#trend-strip">Trends</a>
            <a href="#private-coach">Coach</a>
            <a href="#weekly-review">Review</a>
            <a href="#photo-compare">Photos</a>
            <a href="#phone-mode">Phone</a>
            <a href="#private-ops">Ops</a>
          </div>
        </div>
        <div className={styles.levelPanel}>
          <div className={styles.levelTopline}>
            <span>Current Level</span>
            <strong>{stats.level.title}</strong>
          </div>
          <ProgressBar value={stats.levelProgress} label={`${stats.levelProgress}% to next level`} />
          <div className={styles.levelMeta}>
            <span>{stats.totalXp.toLocaleString()} XP total</span>
            <span>{stats.nextLevel ? `${stats.xpIntoLevel}/${stats.xpForNextLevel} XP` : 'Max level'}</span>
          </div>
        </div>
      </section>

      <section className={styles.mobileTodayFocus} aria-label="My Quest iPhone today focus">
        <div>
          <span>Today focus</span>
          <strong>{todayFocusQuest?.shortTitle ?? 'Board cleared'}</strong>
          <small>{todayFocusQuest ? `${todayRemainingCount} left | +${todayFocusQuest.xp} XP next` : `${todayXp} XP banked today`}</small>
        </div>
        <ProgressBar value={todayFocusProgress} label={`${todayFocusProgress}% today`} />
        <div className={styles.mobileHeroStats} aria-label="My Quest iPhone hero stats">
          <div>
            <span>Level</span>
            <strong>{stats.level.title}</strong>
          </div>
          <div>
            <span>XP</span>
            <strong>{stats.totalXp.toLocaleString()}</strong>
          </div>
          <div>
            <span>Streak</span>
            <strong>{stats.currentStreak}</strong>
          </div>
          <div>
            <span>Week</span>
            <strong>{weeklyGrade.grade}</strong>
          </div>
        </div>
        <div className={styles.mobileQuestRail} aria-label="My Quest iPhone quick quest rail">
          {mobileFocusQuests.map((quest) => {
            const complete = completedToday.has(quest.id)
            const pendingKey = `${today}:${quest.id}`
            return (
              <button
                key={quest.id}
                type="button"
                data-complete={complete ? 'true' : 'false'}
                onClick={() => void toggleQuest(quest)}
                disabled={Boolean(pendingQuest)}
              >
                <span>{pendingQuest === pendingKey ? 'Saving' : complete ? 'Done' : `+${quest.xp}`}</span>
                <strong>{quest.shortTitle}</strong>
              </button>
            )
          })}
        </div>
        <div className={styles.mobileTapPlan} aria-label="My Quest iPhone tap plan">
          {mobileTapPlan.map((plan) => {
            const pendingKey = plan.nextQuest ? `${today}:${plan.nextQuest.id}` : ''

            return (
              <button
                key={plan.id}
                type="button"
                data-complete={plan.nextQuest ? 'false' : 'true'}
                onClick={() => plan.nextQuest ? void toggleQuest(plan.nextQuest) : undefined}
                disabled={!plan.nextQuest || Boolean(pendingQuest)}
              >
                <span>{pendingQuest === pendingKey ? 'Saving' : plan.label}</span>
                <strong>{plan.nextQuest?.shortTitle ?? 'Clear'}</strong>
                <small>{plan.nextQuest ? `${plan.completedCount}/${plan.totalCount} | +${plan.nextQuest.xp}` : `${plan.totalCount}/${plan.totalCount} done`}</small>
              </button>
            )
          })}
        </div>
        <div id="phone-mode-control" className={styles.mobilePocketToggle} aria-label="My Quest iPhone pocket mode">
          <div>
            <span>Phone mode</span>
            <strong>{phoneCompact ? 'Pocket dashboard' : 'Full dashboard'}</strong>
          </div>
          <div>
            <button
              type="button"
              data-active={phoneCompact ? 'true' : 'false'}
              onClick={() => {
                writePhoneModePreference('pocket')
                setPhoneCompact(true)
                setIntelOpen(false)
                setSupportOpen(false)
              }}
            >
              Pocket
            </button>
            <button type="button" data-active={!phoneCompact ? 'true' : 'false'} onClick={() => {
              writePhoneModePreference('full')
              setPhoneCompact(false)
            }}>
              Full
            </button>
          </div>
        </div>
        <details className={styles.mobilePocketMore} aria-label="My Quest iPhone full dashboard shortcuts">
          <summary>
            <span>More tools</span>
            <strong>Open full sections</strong>
          </summary>
          <div>
            {mobilePocketTools.map((tool) => (
              <button key={tool.sectionId} type="button" onClick={() => openFullDashboardSection(tool.sectionId)}>
                <span>{tool.label}</span>
                <strong>{tool.value}</strong>
                <small>Open</small>
              </button>
            ))}
          </div>
        </details>
        <div className={styles.mobileModeRail} aria-label="Today focus mode">
          <button type="button" data-active={mode === 'morning' ? 'true' : 'false'} onClick={() => setMode('morning')}>
            Morning
          </button>
          <button type="button" data-active={mode === 'evening' ? 'true' : 'false'} onClick={() => setMode('evening')}>
            Evening
          </button>
          <button type="button" data-active={mode === 'recovery' ? 'true' : 'false'} onClick={() => setMode('recovery')}>
            Recovery
          </button>
        </div>
        <label className={styles.mobileQuickNote}>
          <span>Quick note</span>
          <input
            value={notesInput}
            onChange={(event) => setNotesInput(event.target.value)}
            onBlur={() => void saveDailyTrackers()}
            placeholder="One line from today"
          />
        </label>
        <label className={styles.mobileIpaQuick}>
          <span>IPA quick log</span>
          <div>
            <button type="button" onClick={() => void adjustIpa(-1)} aria-label="Decrease IPA count from today focus">-</button>
            <input
              value={ipaInput}
              inputMode="numeric"
              onChange={(event) => setIpaInput(event.target.value)}
              onBlur={() => void saveDailyTrackers()}
              aria-label="IPA count from today focus"
            />
            <button type="button" onClick={() => void adjustIpa(1)} aria-label="Increase IPA count from today focus">+</button>
          </div>
        </label>
        <div className={styles.mobileReminderStrip}>
          <div>
            <span>Reminder</span>
            <strong>{notificationPermission === 'granted' ? activeReminder?.time ?? 'Ready' : 'Off'}</strong>
            <small>{notificationPermission === 'granted' ? activeReminder?.title ?? 'Device ready' : 'This device only'}</small>
          </div>
          <button type="button" onClick={() => notificationPermission === 'granted' ? sendTestReminder() : void requestReminderPermission()}>
            {notificationPermission === 'granted' ? 'Test' : 'Enable'}
          </button>
        </div>
        <div>
          <button type="button" onClick={() => todayFocusQuest ? void toggleQuest(todayFocusQuest) : undefined} disabled={!todayFocusQuest || Boolean(pendingQuest)}>
            {todayFocusQuest ? `Bank +${todayFocusQuest.xp}` : 'Done'}
          </button>
          <a href="#repair-day">Repair</a>
        </div>
      </section>

      <div className={styles.statGrid}>
        <MetricTile label="XP Total" value={stats.totalXp.toLocaleString()} hint={stats.level.title} />
        <MetricTile label="Current Streak" value={`${stats.currentStreak}`} hint="days" accent="fire" />
        <MetricTile label="Weekly Score" value={`${stats.weeklyXp.toLocaleString()}`} hint={`${stats.weeklyQuestXp} quest + ${bossBonus} bonus XP`} />
        <MetricTile label="Momentum" value={`${momentum.score}`} hint={momentum.label} compact />
      </div>

      <nav className={styles.mobileMissionControl} aria-label="My Quest iPhone mission control">
        {mobileQuestShortcuts.map((shortcut) => (
          <a key={shortcut.label} href={shortcut.href}>
            <span>{shortcut.label}</span>
            <strong>{shortcut.value}</strong>
          </a>
        ))}
      </nav>

      <section className={styles.mobileDayComplete} data-tone={dayCompleteSummary.tone} aria-label="My Quest iPhone day complete summary">
        <div>
          <span>Day command</span>
          <strong>{dayCompleteSummary.title}</strong>
          <small>{dayCompleteSummary.detail}</small>
        </div>
        {todayFocusQuest && todayRemainingCount > 0 ? (
          <button type="button" onClick={() => void toggleQuest(todayFocusQuest)} disabled={Boolean(pendingQuest)}>
            {dayCompleteSummary.cta}
          </button>
        ) : (
          <a href={dayCompleteSummary.href}>{dayCompleteSummary.cta}</a>
        )}
      </section>

      {error ? <div className={styles.errorNotice}>{error}</div> : null}
      {message ? <div className={styles.successNotice}>{message}</div> : null}
      {undoQuest ? (
        <div className={styles.undoNotice}>
          <div>
            <span>{undoQuest.action === 'completed' ? 'Quest banked' : 'Quest reopened'}</span>
            <strong>{undoQuest.quest.shortTitle}</strong>
            <small>{undoQuest.message}</small>
          </div>
          <button type="button" onClick={() => void undoLastQuestAction()} disabled={Boolean(pendingQuest)}>
            Undo
          </button>
        </div>
      ) : null}
      {celebration ? (
        <div className={styles.celebrationOverlay} role="dialog" aria-modal="true" aria-label="Milestone unlocked">
          <div className={styles.celebrationPanel}>
            <p className={styles.eyebrow}>Milestone</p>
            <h2>{celebration}</h2>
            <button type="button" className={styles.primaryButton} onClick={() => setCelebration('')}>
              Back to quest
            </button>
          </div>
        </div>
      ) : null}

      <section id="lock-screen" className={`${styles.quickAddPanel} ${styles.lockScreenPanel}`}>
        <div className={styles.quickAddHeader}>
          <div>
            <p className={styles.eyebrow}>Today Lock Screen</p>
            <h2>{streakShield.label}</h2>
          </div>
          <div className={styles.quickAddScore}>
            <strong>{todayXp}</strong>
            <span>XP</span>
          </div>
        </div>
        <div className={styles.lockScreenMetrics}>
          <div className={styles.lockScreenMetric} data-tone={streakShield.tier}>
            <span>Shield</span>
            <strong>{todayCompletedCount}/{PERSONAL_DAILY_QUESTS.length}</strong>
            <small>{streakShield.detail}</small>
          </div>
          <div className={styles.lockScreenMetric}>
            <span>Next</span>
            <strong>{smartQuest.quest?.shortTitle ?? 'Done'}</strong>
            <small>{smartQuest.reason}</small>
          </div>
          <div className={styles.lockScreenMetric}>
            <span>Week grade</span>
            <strong>{weeklyGrade.grade}</strong>
            <small>{weeklyGrade.label} | {weeklyGrade.score}/100</small>
          </div>
          <div className={styles.lockScreenStepper}>
            <span>IPAs</span>
            <div className={styles.stepper}>
              <button type="button" onClick={() => void adjustIpa(-1)} aria-label="Decrease IPA count">-</button>
              <input
                value={ipaInput}
                inputMode="numeric"
                onChange={(event) => setIpaInput(event.target.value)}
                onBlur={() => void saveDailyTrackers()}
                aria-label="IPA count today"
              />
              <button type="button" onClick={() => void adjustIpa(1)} aria-label="Increase IPA count">+</button>
            </div>
          </div>
        </div>
        <div className={styles.quickAddQuestGrid}>
          {PERSONAL_DAILY_QUESTS.map((quest) => {
            const complete = completedToday.has(quest.id)
            return (
              <button
                key={quest.id}
                type="button"
                className={styles.quickQuestButton}
                data-complete={complete ? 'true' : 'false'}
                onClick={() => void toggleQuest(quest)}
                disabled={Boolean(pendingQuest)}
              >
                <span>{complete ? 'OK' : `+${quest.xp}`}</span>
                <strong>{quest.shortTitle}</strong>
              </button>
            )
          })}
        </div>
        <div className={styles.quickAddFooter}>
          <span>{recapToast.title}</span>
          <button type="button" onClick={() => smartQuest.quest ? void toggleQuest(smartQuest.quest) : undefined} disabled={!smartQuest.quest || Boolean(pendingQuest)}>
            {smartQuest.quest ? smartQuest.cta : 'Done'}
          </button>
        </div>
      </section>

      <section className={styles.gamePlanPanel}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Today&apos;s Game Plan</p>
            <h2>Win the day clean</h2>
          </div>
          <span className={styles.scorePill}>{mode === 'morning' ? 'Morning plan' : 'Evening close'}</span>
        </div>
        <div className={styles.planGrid}>
          <div className={styles.planCard}>
            <span>Win condition</span>
            <strong>{gamePlan.winCondition}</strong>
          </div>
          <div className={styles.planCard}>
            <span>Do not miss</span>
            <strong>{gamePlan.doNotMiss}</strong>
          </div>
          <div className={styles.planCard}>
            <span>Lowest effort XP</span>
            <strong>{gamePlan.lowestEffortXp}</strong>
          </div>
          <div className={styles.planCard}>
            <span>Boss danger</span>
            <strong>{gamePlan.bossDanger}</strong>
          </div>
        </div>
      </section>

      <section id="private-coach" className={styles.coachPanel}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Private Coach</p>
            <h2>{coachNote.title}</h2>
          </div>
          <span className={styles.scorePill}>Nathan only</span>
        </div>
        <div className={styles.coachLayout}>
          <div className={styles.coachCard}>
            <span>Coach note</span>
            <strong>{coachNote.detail}</strong>
          </div>
          <div className={styles.weeklyPlanGrid}>
            <div className={styles.weeklyPlanCard}>
              <span>Focus habit</span>
              <strong>{weeklyPlan.focusHabit}</strong>
            </div>
            <div className={styles.weeklyPlanCard}>
              <span>Boss to protect</span>
              <strong>{weeklyPlan.bossToProtect}</strong>
            </div>
            <div className={styles.weeklyPlanCard}>
              <span>Danger window</span>
              <strong>{weeklyPlan.dangerWindow}</strong>
            </div>
            <div className={styles.weeklyPlanCard}>
              <span>Minimum rule</span>
              <strong>{weeklyPlan.minimumRule}</strong>
            </div>
          </div>
        </div>
        <div className={styles.patternGrid}>
          {missPatterns.map((pattern) => (
            <div key={pattern.id} className={styles.patternCard} data-tone={pattern.tone}>
              <span>{pattern.title}</span>
              <strong>{pattern.detail}</strong>
            </div>
          ))}
        </div>
      </section>

      <section id="boss-warnings" className={styles.warningPanel}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Boss Warnings</p>
            <h2>Week pressure</h2>
          </div>
          <span className={styles.scorePill}>{weeklyGrade.grade} grade</span>
        </div>
        <div className={styles.warningGrid}>
          {bossWarnings.map((warning) => (
            <div key={warning.key} className={styles.warningCard} data-tone={warning.tone}>
              <span>{warning.title}</span>
              <strong>{warning.message}</strong>
              <small>{warning.cta}</small>
            </div>
          ))}
        </div>
      </section>

      <section id="momentum" className={styles.momentumPanel}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Momentum Score</p>
            <h2>{momentum.score}/100 | {momentum.label}</h2>
          </div>
          <span className={styles.scorePill}>{momentum.trend}</span>
        </div>
        <div className={styles.momentumLayout}>
          <div className={styles.momentumMeter}>
            <strong>{momentum.score}</strong>
            <span>{momentum.detail}</span>
            <ProgressBar value={momentum.score} label={`${momentum.score}% momentum`} />
          </div>
          <div className={styles.momentumDays}>
            {momentum.days.map((day) => (
              <div key={day.date} className={styles.momentumDay}>
                <span style={{ height: `${Math.max(8, day.score)}%` }} />
                <small>{day.label}</small>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.nudgeGrid}>
          {momentumNudges.map((nudge) => (
            <div key={nudge.id} className={styles.nudgeCard} data-tone={nudge.tone}>
              <span>{nudge.title}</span>
              <strong>{nudge.detail}</strong>
            </div>
          ))}
        </div>
      </section>

      <details
        className={styles.mobileIntelDrawer}
        open={!phoneCompact || intelOpen}
        onToggle={(event) => {
          if (phoneCompact) setIntelOpen(event.currentTarget.open)
        }}
      >
        <summary>
          <span>More Quest Intel</span>
          <strong>Month, season, recap</strong>
        </summary>
        <div className={styles.mobileIntelBody}>
          <section id="month-view" className={styles.monthPanel}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.eyebrow}>Month View</p>
                <h2>{monthView.monthLabel}</h2>
              </div>
              <span className={styles.scorePill}>Quest calendar</span>
            </div>
            <div className={styles.monthWeekdays} aria-hidden="true">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>
            <div className={styles.monthGrid} aria-label={`${monthView.monthLabel} quest calendar`}>
              {monthView.days.map((day) => (
                <div
                  key={day.date}
                  className={styles.monthDay}
                  data-intensity={day.intensity}
                  data-in-month={day.inMonth ? 'true' : 'false'}
                  data-today={day.date === today ? 'true' : 'false'}
                  title={`${day.date}: ${day.completedCount}/${day.totalCount} quests, ${day.xp} XP, ${day.ipaCount} IPAs${day.frozen ? ', freeze used' : ''}`}
                >
                  <span>{day.dayLabel}</span>
                  <strong>{day.completedCount ? `${day.completedCount}/${day.totalCount}` : day.frozen ? 'Freeze' : '-'}</strong>
                  <small>{day.ipaCount ? `${day.ipaCount} IPA` : `${day.xp} XP`}</small>
                </div>
              ))}
            </div>
          </section>

          <section id="season-map" className={styles.seasonPanel}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.eyebrow}>Season Map</p>
                <h2>Road to Six Pack Mode</h2>
              </div>
              <span className={styles.scorePill}>{stats.level.title}</span>
            </div>
            <div className={styles.seasonMap}>
              {seasonMap.map((node) => (
                <div key={node.title} className={styles.seasonNode} data-status={node.status}>
                  <span>{node.xp.toLocaleString()} XP</span>
                  <strong>{node.title}</strong>
                  <ProgressBar value={node.progress} label={node.status} />
                </div>
              ))}
            </div>
          </section>

          <section id="season-timeline" className={styles.timelinePanel}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.eyebrow}>Season Timeline</p>
                <h2>Season 1 chapters</h2>
              </div>
              <span className={styles.scorePill}>{stats.totalXp.toLocaleString()} XP</span>
            </div>
            <div className={styles.timelineGrid}>
              {seasonTimeline.map((chapter) => (
                <div key={chapter.week} className={styles.timelineCard} data-status={chapter.status}>
                  <span>Week {chapter.week} | {chapter.target}</span>
                  <strong>{chapter.title}</strong>
                  <small>{chapter.detail}</small>
                  <ProgressBar value={chapter.progress} label={`${chapter.progress}% chapter`} />
                </div>
              ))}
            </div>
          </section>

          <section id="daily-recap" className={styles.recapPanel}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.eyebrow}>Daily Recap</p>
                <h2>{dailyRecap.title}</h2>
              </div>
              <span className={styles.scorePill}>{dailyRecap.xp} XP</span>
            </div>
            <div className={styles.recapGrid}>
              <div className={styles.recapCard}>
                <span>Board</span>
                <strong>{dailyRecap.completedCount}/{dailyRecap.totalCount}</strong>
                <small>{dailyRecap.streakStatus}</small>
              </div>
              <div className={styles.recapCard}>
                <span>Boss misses</span>
                <strong>{dailyRecap.bossMisses.length ? dailyRecap.bossMisses[0] : 'None'}</strong>
                <small>{dailyRecap.bossMisses[1] ?? 'No extra pressure.'}</small>
              </div>
              <div className={styles.recapCard}>
                <span>Tomorrow</span>
                <strong>{dailyRecap.tomorrow}</strong>
                <small>Next open.</small>
              </div>
            </div>
            <div className={styles.recapToast} data-tone={recapToast.tone}>
              <span>Private recap</span>
              <strong>{recapToast.title}</strong>
              <small>{recapToast.detail}</small>
            </div>
          </section>

          <section className={styles.finalePanel} data-unlocked={finale.unlocked ? 'true' : 'false'}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.eyebrow}>Season 1 Finale</p>
                <h2>{finale.title}</h2>
              </div>
              <span className={styles.scorePill}>{finale.badge}</span>
            </div>
            <div className={styles.finaleBody}>
              <div>
                <strong>{finale.detail}</strong>
                <p>{finale.challenge}</p>
              </div>
              <ProgressBar value={finale.progress} label={`${finale.progress}% finale progress`} />
            </div>
          </section>
        </div>
      </details>

      <section id="trend-strip" className={styles.trendStrip}>
        {trendCards.map((card) => (
          <div key={card.label} className={styles.trendCard} data-tone={card.tone}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.detail}</small>
          </div>
        ))}
      </section>

      {isSunday ? (
        <WeeklyReviewPanel
          weeklyReview={weeklyReview}
          statsWeeklyXp={stats.weeklyXp}
          weeklyIpaCount={weeklyIpaCount}
          weeklyChipFreeLunches={weeklyChipFreeLunches}
          waistInput={waistInput}
          reviewWin={reviewWin}
          reviewMiss={reviewMiss}
          reviewFocus={reviewFocus}
          suggestedFocus={weeklyFocusSuggestion}
          savingReview={savingReview}
          setWaistInput={setWaistInput}
          setReviewWin={setReviewWin}
          setReviewMiss={setReviewMiss}
          setReviewFocus={setReviewFocus}
          saveWeeklyReview={saveWeeklyReview}
        />
      ) : null}

      <section id="today-quests" className={styles.todayCommand}>
        <div className={styles.todayHeader}>
          <div>
            <p className={styles.eyebrow}>Today&apos;s Quest</p>
            <h2>{todayCompletedCount}/{PERSONAL_DAILY_QUESTS.length} complete</h2>
          </div>
          <div className={styles.todayScore}>
            <strong>{todayXp}</strong>
            <span>XP today</span>
          </div>
        </div>
        <div className={styles.modeToggle} aria-label="Quest mode">
          <button type="button" data-active={mode === 'morning' ? 'true' : 'false'} onClick={() => setMode('morning')}>
            Morning
          </button>
          <button type="button" data-active={mode === 'evening' ? 'true' : 'false'} onClick={() => setMode('evening')}>
            Evening
          </button>
          <button type="button" data-active={mode === 'recovery' ? 'true' : 'false'} onClick={() => setMode('recovery')}>
            Recovery
          </button>
        </div>
        <div className={styles.dayModeGrid}>
          {dayModes.map((dayMode) => (
            <button
              key={dayMode.id}
              type="button"
              className={styles.dayModeCard}
              data-recommended={dayMode.recommended ? 'true' : 'false'}
              data-complete={dayMode.completed ? 'true' : 'false'}
              onClick={() => void completeQuestStack({ label: dayMode.title, questIds: dayMode.questIds })}
              disabled={Boolean(pendingStack || pendingQuest)}
            >
              <span>{dayMode.recommended ? 'Recommended mode' : `${dayMode.progress}%`}</span>
              <strong>{pendingStack === dayMode.title ? 'Completing' : dayMode.title}</strong>
              <small>{dayMode.detail}</small>
              <ProgressBar value={dayMode.progress} label={dayMode.completed ? 'Mode complete' : `${dayMode.progress}% mode`} />
            </button>
          ))}
        </div>
        <div className={styles.smartQuestCard}>
          <div>
            <p className={styles.eyebrow}>Smart Next Quest</p>
            <h3>{smartQuest.quest?.title ?? 'Daily board cleared'}</h3>
            <p>{smartQuest.reason}</p>
          </div>
          {smartQuest.quest ? (
            <button type="button" className={styles.primaryButton} onClick={() => void toggleQuest(smartQuest.quest!)} disabled={Boolean(pendingQuest)}>
              {smartQuest.cta}
            </button>
          ) : null}
        </div>
        <div className={styles.loadoutGrid}>
          {loadouts.map((loadout) => (
            <button
              key={loadout.id}
              type="button"
              className={styles.loadoutCard}
              data-recommended={loadout.recommended ? 'true' : 'false'}
              data-complete={loadout.completed ? 'true' : 'false'}
              onClick={() => void completeQuestStack({ label: loadout.title, questIds: loadout.questIds })}
              disabled={Boolean(pendingStack || pendingQuest)}
            >
              <span>{loadout.recommended ? 'Recommended' : `${loadout.progress}%`}</span>
              <strong>{pendingStack === loadout.title ? 'Completing' : loadout.title}</strong>
              <small>{loadout.detail}</small>
              <ProgressBar value={loadout.progress} label={loadout.completed ? 'Loadout complete' : `${loadout.progress}% loadout`} />
            </button>
          ))}
        </div>
        <div className={styles.stackGrid}>
          {QUEST_STACKS.map((stack) => (
            <button
              key={stack.id}
              type="button"
              className={styles.stackButton}
              onClick={() => void completeQuestStack(stack)}
              disabled={Boolean(pendingStack || pendingQuest)}
            >
              <strong>{pendingStack === stack.label ? 'Completing' : stack.label}</strong>
              <span>{stack.hint}</span>
            </button>
          ))}
        </div>
        <div className={styles.comboGrid}>
          {questCombos.map((combo) => (
            <div key={combo.id} className={styles.comboCard} data-complete={combo.completed ? 'true' : 'false'}>
              <div>
                <strong>{combo.title}</strong>
                <span>{combo.detail}</span>
              </div>
              <ProgressBar value={combo.progress} label={combo.completed ? 'Combo locked' : `${combo.progress}% combo`} />
            </div>
          ))}
        </div>
        <div className={styles.weeklyRuleCard}>
          <label className={styles.field}>
            <span>Today&apos;s rule</span>
            <input
              value={weeklyRule}
              onChange={(event) => setWeeklyRule(event.target.value)}
              onBlur={() => void saveWeeklyRule()}
              aria-label="Today rule"
            />
          </label>
          <button type="button" className={styles.primaryButton} onClick={() => void saveWeeklyRule()} disabled={savingRule}>
            {savingRule ? 'Saving rule' : 'Lock rule'}
          </button>
        </div>
        <div className={styles.reminderGrid}>
          {reminders.map((reminder) => (
            <div key={reminder.id} className={styles.reminderCard} data-active={reminder.active ? 'true' : 'false'}>
              <span>{reminder.time}</span>
              <strong>{reminder.title}</strong>
              <small>{reminder.detail}</small>
            </div>
          ))}
        </div>
        <ProgressBar value={Math.round((todayCompletedCount / PERSONAL_DAILY_QUESTS.length) * 100)} label={`${todayRemainingCount} quests left`} />
        <div className={styles.todayQuickGrid}>
          {PERSONAL_DAILY_QUESTS.map((quest) => {
            const complete = completedToday.has(quest.id)
            return (
              <button
                key={quest.id}
                type="button"
                className={`${styles.questCard} ${complete ? styles.questCardComplete : ''}`}
                onClick={() => void toggleQuest(quest)}
                disabled={Boolean(pendingQuest)}
              >
                <span className={styles.questCheck}>{complete ? 'OK' : '+'}</span>
                <span>
                  <strong>{quest.title}</strong>
                  <small>+{quest.xp} XP</small>
                </span>
              </button>
            )
          })}
        </div>
        <div className={styles.quickTrackerRow}>
          <label className={styles.inlineStepper}>
            <span>IPAs</span>
            <div className={styles.stepper}>
              <button type="button" onClick={() => void adjustIpa(-1)} aria-label="Decrease IPA count">-</button>
              <input
                value={ipaInput}
                inputMode="numeric"
                onChange={(event) => setIpaInput(event.target.value)}
                onBlur={() => void saveDailyTrackers()}
                aria-label="IPA count today"
              />
              <button type="button" onClick={() => void adjustIpa(1)} aria-label="Increase IPA count">+</button>
            </div>
          </label>
          <button type="button" className={styles.primaryButton} onClick={() => void saveDailyTrackers()} disabled={savingTracker}>
            {savingTracker ? 'Saving' : 'Save today'}
          </button>
        </div>
      </section>

      <section id="repair-day" className={styles.repairPanel}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Yesterday Repair</p>
            <h2>{repairSummary.completedCount}/{repairSummary.totalCount} repaired</h2>
          </div>
          <span className={styles.scorePill}>{repairSummary.xp} XP | {repairSummary.status}</span>
        </div>
        <div className={styles.repairBody}>
          <div className={styles.repairQuestGrid}>
            {PERSONAL_DAILY_QUESTS.map((quest) => {
              const complete = completedRepairDay.has(quest.id)
              return (
                <button
                  key={quest.id}
                  type="button"
                  className={styles.repairQuestButton}
                  data-complete={complete ? 'true' : 'false'}
                  onClick={() => void toggleQuestForDate(quest, repairDate)}
                  disabled={Boolean(pendingQuest)}
                >
                  <span>{complete ? 'OK' : `+${quest.xp}`}</span>
                  <strong>{quest.shortTitle}</strong>
                </button>
              )
            })}
          </div>
          <div className={styles.repairTracker}>
            <div>
              <span>{repairDate}</span>
              <strong>{repairSummary.ipaCount} IPAs logged</strong>
              <small>Backfill only what actually happened.</small>
            </div>
            <label className={styles.field}>
              <span>Yesterday IPAs</span>
              <div className={styles.stepper}>
                <button type="button" onClick={() => void adjustRepairIpa(-1)} aria-label="Decrease yesterday IPA count">-</button>
                <input
                  value={repairIpaInput}
                  inputMode="numeric"
                  onChange={(event) => setRepairIpaInput(event.target.value)}
                  onBlur={() => void saveRepairTrackers()}
                  aria-label="Yesterday IPA count"
                />
                <button type="button" onClick={() => void adjustRepairIpa(1)} aria-label="Increase yesterday IPA count">+</button>
              </div>
            </label>
            <label className={styles.field}>
              <span>Yesterday notes</span>
              <textarea
                value={repairNotesInput}
                onChange={(event) => setRepairNotesInput(event.target.value)}
                onBlur={() => void saveRepairTrackers()}
                rows={3}
                placeholder="Repair note"
              />
            </label>
            <button type="button" className={styles.primaryButton} onClick={() => void saveRepairTrackers()} disabled={savingTracker}>
              {savingTracker ? 'Saving' : 'Save repair'}
            </button>
          </div>
        </div>
      </section>

      <section className={styles.sectionGrid}>
        <div className={styles.questPanel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Consistency</p>
              <h2>90-day grid</h2>
            </div>
            <span className={styles.scorePill}>{stats.currentStreak} day streak</span>
          </div>
          <Heatmap days={heatmapDays} />
          <div className={styles.heatmapLegend}>
            <span>No quests</span>
            <span>Partial</span>
            <span>Strong</span>
            <span>Perfect</span>
          </div>
          <div className={styles.freezeCard} data-active={freezeStatus.protectedToday ? 'true' : 'false'}>
            <div>
              <span>Streak Freeze</span>
              <strong>{freezeStatus.remainingThisMonth}/2 left this month</strong>
              <small>{freezeStatus.detail}</small>
            </div>
            <button type="button" className={styles.primaryButton} onClick={() => void spendStreakFreeze()} disabled={!freezeStatus.canUseToday || pendingFreeze}>
              {pendingFreeze ? 'Protecting' : freezeStatus.protectedToday ? 'Protected' : 'Save the day'}
            </button>
          </div>
        </div>

        <div className={styles.trackerPanel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Manual Trackers</p>
              <h2>Daily log</h2>
            </div>
            <span className={styles.scorePill}>{savingTracker ? 'Saving' : 'Private'}</span>
          </div>
          <label className={styles.field}>
            <span>IPA count today</span>
            <div className={styles.stepper}>
              <button type="button" onClick={() => void adjustIpa(-1)} aria-label="Decrease IPA count">-</button>
              <input
                value={ipaInput}
                inputMode="numeric"
                onChange={(event) => setIpaInput(event.target.value)}
                onBlur={() => void saveDailyTrackers()}
                aria-label="IPA count today"
              />
              <button type="button" onClick={() => void adjustIpa(1)} aria-label="Increase IPA count">+</button>
            </div>
          </label>
          <label className={styles.field}>
            <span>Notes</span>
            <textarea
              value={notesInput}
              onChange={(event) => setNotesInput(event.target.value)}
              onBlur={() => void saveDailyTrackers()}
              rows={4}
              placeholder="Quick win, miss, or adjustment"
            />
          </label>
          <button type="button" className={styles.primaryButton} onClick={() => void saveDailyTrackers()} disabled={savingTracker}>
            {savingTracker ? 'Saving' : 'Save daily log'}
          </button>
          <div className={styles.waistTrendCard}>
            <div className={styles.waistTrendHeader}>
              <div>
                <span>Waist trend</span>
                <strong>{waistTrend.latest === null ? 'Baseline' : `${waistTrend.latest}"`}</strong>
              </div>
              <small>{waistTrend.label}</small>
            </div>
            <div className={styles.waistChart} aria-label="Waist trend mini chart">
              {waistTrend.points.length ? waistTrend.points.map((point) => (
                <span key={point.date} title={`${point.date}: ${point.value}"`} style={{ height: `${Math.max(8, point.progress)}%` }} />
              )) : (
                <em>Add weekly waist measurement.</em>
              )}
            </div>
          </div>
        </div>
      </section>

      <details
        className={styles.mobileSupportDrawer}
        open={!phoneCompact || supportOpen}
        onToggle={(event) => {
          if (phoneCompact) setSupportOpen(event.currentTarget.open)
        }}
      >
        <summary>
          <span>Device and Privacy</span>
          <strong>{offlineQueueCount || clientIssueCount ? 'Needs glance' : 'Healthy'}</strong>
        </summary>
        <div className={styles.mobileSupportBody}>
          <section id="phone-mode" className={styles.phonePanel}>
            <div>
              <p className={styles.eyebrow}>Phone Mode</p>
              <h2>Home-screen ready</h2>
              <p>Open this private route from Safari, add TenAceIQ to your Home Screen, and it will run as a standalone app with the same Nathan-only access gate.</p>
            </div>
            <div className={styles.phoneSteps}>
              <span>Share</span>
              <span>Add to Home Screen</span>
              <span>Open My Quest</span>
            </div>
          </section>

          <section id="private-ops" className={styles.privateOpsPanel}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.eyebrow}>Private Ops</p>
                <h2>Sync and privacy health</h2>
              </div>
              <span className={styles.scorePill}>{syncingOffline ? 'Syncing' : 'Ready'}</span>
            </div>
            <div className={styles.healthGrid}>
              <div className={styles.healthCard} data-tone="green">
                <span>Access gate</span>
                <strong>Nathan-only</strong>
                <small>{authUser?.email ?? 'Authenticated owner'}</small>
              </div>
              <div className={styles.healthCard} data-tone={offlineQueueCount ? 'amber' : 'green'}>
                <span>Offline queue</span>
                <strong>{offlineQueueCount}</strong>
                <small>{offlineQueueCount ? 'Waiting to sync' : 'Clear'}</small>
              </div>
              <div className={styles.healthCard} data-tone="green">
                <span>Photo vault</span>
                <strong>{photos.filter((photo) => photo.signedUrl).length}/{photos.length}</strong>
                <small>Signed viewing only</small>
              </div>
              <div className={styles.healthCard} data-tone={notificationPermission === 'granted' ? 'green' : 'blue'}>
                <span>Reminders</span>
                <strong>{notificationPermission}</strong>
                <small>This device only</small>
              </div>
              <div className={styles.healthCard} data-tone={clientIssueCount ? 'amber' : 'green'}>
                <span>Client issues</span>
                <strong>{clientIssueCount}</strong>
                <small>{lastClientIssue}</small>
              </div>
            </div>
            <div className={styles.opsActions}>
              <button type="button" onClick={() => void requestReminderPermission()}>
                Enable reminders
              </button>
              <button type="button" onClick={sendTestReminder} disabled={notificationPermission !== 'granted'}>
                Test reminder
              </button>
              <button type="button" onClick={() => {
                const ownerId = authUser?.id ?? userId
                if (ownerId) void flushOfflineQueue(ownerId)
              }} disabled={!offlineQueueCount || syncingOffline}>
                Sync queued
              </button>
              <button type="button" onClick={() => {
                const ownerId = authUser?.id ?? userId
                if (!ownerId) return
                clearQuestClientIssues(ownerId)
                setClientIssueCount(0)
                setLastClientIssue('Clear')
              }} disabled={!clientIssueCount}>
                Clear issues
              </button>
            </div>
          </section>
        </div>
      </details>

      <section id="weekly-bosses" className={styles.bossPanel}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Weekly Boss Battles</p>
            <h2>Week of {weekStart}</h2>
          </div>
          <span className={styles.scorePill}>Bonus +{bossBonus} XP</span>
        </div>
        <div className={styles.forecastGrid}>
          {bossForecast.map((forecast) => (
            <div key={forecast.key} className={styles.forecastCard} data-status={forecast.status}>
              <span>{forecast.title}</span>
              <strong>{forecast.headline}</strong>
              <small>{forecast.detail}</small>
              <ProgressBar value={forecast.progress} label={forecast.status.replace('-', ' ')} />
            </div>
          ))}
        </div>
        <div className={styles.bossCalendarGrid}>
          {bossCalendar.map((item) => (
            <div key={item.key} className={styles.bossCalendarCard} data-tone={item.tone}>
              <span>{item.title}</span>
              <strong>{item.headline}</strong>
              <small>{item.detail}</small>
              <ProgressBar value={item.progress} label={`${item.progress}% boss pace`} />
            </div>
          ))}
        </div>
        <div className={styles.strategyGrid}>
          {bossStrategy.map((strategy) => (
            <div key={strategy.title} className={styles.strategyCard} data-tone={strategy.tone}>
              <span>{strategy.title}</span>
              <strong>{strategy.headline}</strong>
              <small>{strategy.action}</small>
            </div>
          ))}
        </div>
        <div className={styles.bossGrid}>
          {stats.bosses.map((boss) => (
            <div key={boss.key} className={`${styles.bossCard} ${boss.completed ? styles.bossComplete : ''}`}>
              <div className={styles.bossTopline}>
                <strong>{boss.title}</strong>
                <span>{boss.completed ? `+${boss.xp} XP` : 'In progress'}</span>
              </div>
              <ProgressBar value={boss.progress} label={boss.label} />
              <small>{boss.key === 'ipa' ? 'Goal <= 6 IPAs/week' : boss.label}</small>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.sectionGrid}>
        {!isSunday ? (
          <WeeklyReviewPanel
            weeklyReview={weeklyReview}
            statsWeeklyXp={stats.weeklyXp}
            weeklyIpaCount={weeklyIpaCount}
            weeklyChipFreeLunches={weeklyChipFreeLunches}
            waistInput={waistInput}
            reviewWin={reviewWin}
            reviewMiss={reviewMiss}
            reviewFocus={reviewFocus}
            suggestedFocus={weeklyFocusSuggestion}
            savingReview={savingReview}
            setWaistInput={setWaistInput}
            setReviewWin={setReviewWin}
            setReviewMiss={setReviewMiss}
            setReviewFocus={setReviewFocus}
            saveWeeklyReview={saveWeeklyReview}
          />
        ) : null}

        <div className={styles.photoPanel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Progress Photos</p>
              <h2>Private vault</h2>
            </div>
            <span className={styles.scorePill}>Signed URLs</span>
          </div>
          <div className={styles.photoButtons}>
            {PHOTO_TYPES.map((type) => (
              <label key={type.id} className={styles.photoUpload}>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadPhoto(type.id, event)} />
                <span>{uploadingType === type.id ? 'Uploading' : type.label}</span>
              </label>
            ))}
          </div>
          <div className={styles.photoGuidanceGrid}>
            {photoGuidance.map((item) => (
              <div key={item.id} className={styles.photoGuidanceCard} data-status={item.status}>
                <span>{item.status}</span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </div>
            ))}
          </div>
          <div id="photo-compare" className={styles.photoCompare}>
            <div className={styles.compareModeTabs} aria-label="Photo comparison mode">
              {PHOTO_COMPARE_MODES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-active={compareMode === item.id ? 'true' : 'false'}
                  onClick={() => setCompareMode(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className={styles.compareTabs} aria-label="Photo compare type">
              {PHOTO_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  data-active={compareType === type.id ? 'true' : 'false'}
                  onClick={() => setCompareType(type.id)}
                >
                  {type.label}
                </button>
              ))}
            </div>
            <div className={styles.compareGrid}>
              <ComparePhoto label={comparePhotos.latestLabel} photo={comparePhotos.latest} />
              <ComparePhoto label={comparePhotos.previousLabel} photo={comparePhotos.previous} />
            </div>
          </div>
          <div className={styles.photoGrid}>
            {photos.length ? photos.map((photo) => (
              <figure key={photo.id} className={styles.photoCard}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.signedUrl} alt={`${photo.photo_type} progress`} />
                <figcaption>{photo.photo_type}</figcaption>
              </figure>
            )) : (
              <div className={styles.emptyVault}>No private progress photos yet.</div>
            )}
          </div>
        </div>
      </section>

      <section id="achievements" className={styles.achievementPanel}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Achievements</p>
            <h2>Badge board</h2>
          </div>
          <span className={styles.scorePill}>
            {stats.achievements.filter((achievement) => achievement.unlocked).length}/{stats.achievements.length}
          </span>
        </div>
        <div className={styles.badgeGrid}>
          {achievementDetails.map((achievement) => (
            <button
              key={achievement.id}
              type="button"
              className={`${styles.badgeCard} ${achievement.unlocked ? styles.badgeUnlocked : ''}`}
              onClick={() => setSelectedAchievementId(achievement.id)}
            >
              <span className={styles.badgeIcon}>{achievement.unlocked ? '*' : '-'}</span>
              <strong>{achievement.title}</strong>
              <ProgressBar value={Math.min(100, Math.round((achievement.progress / achievement.target) * 100))} label={`${achievement.progress}/${achievement.target}`} />
            </button>
          ))}
        </div>
      </section>

      {selectedAchievement ? (
        <AchievementDetailDrawer achievement={selectedAchievement} onClose={() => setSelectedAchievementId('')} />
      ) : null}
    </section>
  )
}

function AchievementDetailDrawer({
  achievement,
  onClose,
}: {
  achievement: PersonalQuestAchievementDetail
  onClose: () => void
}) {
  const progress = Math.min(100, Math.round((achievement.progress / achievement.target) * 100))
  return (
    <div className={styles.drawerOverlay} role="dialog" aria-modal="true" aria-label={`${achievement.title} achievement detail`}>
      <div className={styles.achievementDrawer}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Achievement Detail</p>
            <h2>{achievement.title}</h2>
          </div>
          <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close achievement detail">
            X
          </button>
        </div>
        <div className={styles.drawerStats}>
          <MetricTile label="Progress" value={`${achievement.progress}/${achievement.target}`} hint={`${progress}%`} compact />
          <MetricTile label="Remaining" value={`${achievement.remaining}`} hint={achievement.unlocked ? 'unlocked' : 'to unlock'} compact />
        </div>
        <ProgressBar value={progress} label={`${progress}% complete`} />
        <div className={styles.drawerPath}>
          <span>Fastest path</span>
          <strong>{achievement.fastestPath}</strong>
        </div>
      </div>
    </div>
  )
}

function MetricTile({
  label,
  value,
  hint,
  accent,
  compact,
}: {
  label: string
  value: string
  hint: string
  accent?: 'fire'
  compact?: boolean
}) {
  return (
    <div className={`${styles.metricTile} ${compact ? styles.metricTileCompact : ''}`}>
      <span>{label}</span>
      <strong>{accent === 'fire' ? <span className={styles.fireIcon} aria-label="Streak fire">FIRE</span> : null}{value}</strong>
      <small>{hint}</small>
    </div>
  )
}

function WeeklyReviewPanel({
  weeklyReview,
  statsWeeklyXp,
  weeklyIpaCount,
  weeklyChipFreeLunches,
  waistInput,
  reviewWin,
  reviewMiss,
  reviewFocus,
  suggestedFocus,
  savingReview,
  setWaistInput,
  setReviewWin,
  setReviewMiss,
  setReviewFocus,
  saveWeeklyReview,
}: {
  weeklyReview: WeeklyReview | null
  statsWeeklyXp: number
  weeklyIpaCount: number
  weeklyChipFreeLunches: number
  waistInput: string
  reviewWin: string
  reviewMiss: string
  reviewFocus: string
  suggestedFocus: PersonalQuestFocusSuggestion
  savingReview: boolean
  setWaistInput: (value: string) => void
  setReviewWin: (value: string) => void
  setReviewMiss: (value: string) => void
  setReviewFocus: (value: string) => void
  saveWeeklyReview: () => Promise<void>
}) {
  return (
    <div id="weekly-review" className={styles.reviewPanel}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>Sunday Check-In</p>
          <h2>Weekly review</h2>
        </div>
        <span className={styles.scorePill}>{weeklyReview ? 'Saved' : 'Open'}</span>
      </div>
      <div className={styles.reviewMetrics}>
        <MetricTile label="Weekly XP" value={`${statsWeeklyXp}`} hint="with bonus" compact />
        <MetricTile label="IPAs" value={`${weeklyIpaCount}`} hint="this week" compact />
        <MetricTile label="Chip-free lunches" value={`${weeklyChipFreeLunches}`} hint="this week" compact />
      </div>
      <label className={styles.field}>
        <span>Waist this week</span>
        <input
          value={waistInput}
          inputMode="decimal"
          onChange={(event) => setWaistInput(event.target.value)}
          placeholder="Inches"
        />
      </label>
      <label className={styles.field}>
        <span>Biggest win</span>
        <textarea value={reviewWin} onChange={(event) => setReviewWin(event.target.value)} rows={3} />
      </label>
      <label className={styles.field}>
        <span>Biggest miss</span>
        <textarea value={reviewMiss} onChange={(event) => setReviewMiss(event.target.value)} rows={3} />
      </label>
      <label className={styles.field}>
        <span>Focus for next week</span>
        <textarea value={reviewFocus} onChange={(event) => setReviewFocus(event.target.value)} rows={3} />
      </label>
      <div className={styles.focusSuggestion}>
        <div>
          <span>Suggested focus</span>
          <strong>{suggestedFocus.title}</strong>
          <small>{suggestedFocus.detail}</small>
        </div>
        <button type="button" onClick={() => setReviewFocus(suggestedFocus.focus)}>
          Use
        </button>
      </div>
      <button type="button" className={styles.primaryButton} onClick={() => void saveWeeklyReview()} disabled={savingReview}>
        {savingReview ? 'Saving review' : 'Save weekly review'}
      </button>
    </div>
  )
}

function Heatmap({ days }: { days: ReturnType<typeof buildPersonalQuestHeatmap> }) {
  return (
    <div className={styles.heatmapGrid} aria-label="90-day consistency grid">
      {days.map((day) => (
        <span
          key={day.date}
          className={styles.heatmapDay}
          data-intensity={day.intensity}
          data-today={day.isToday ? 'true' : 'false'}
          title={`${day.date}: ${day.completedCount}/${day.totalCount} quests, ${day.xp} XP`}
        />
      ))}
    </div>
  )
}

function ComparePhoto({ label, photo }: { label: string; photo: PhotoPreview | null }) {
  return (
    <figure className={styles.comparePhoto}>
      {photo?.signedUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.signedUrl} alt={`${label} ${photo.photo_type} progress`} />
      ) : (
        <div className={styles.compareEmpty}>Add {label.toLowerCase()} photo</div>
      )}
      <figcaption>{label}</figcaption>
    </figure>
  )
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.progressWrap}>
      <div className={styles.progressTrack} aria-label={label} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <small>{label}</small>
    </div>
  )
}

async function signPhotos(photos: ProgressPhoto[]): Promise<PhotoPreview[]> {
  if (!photos.length) return []
  const signed = await supabase.storage
    .from(PERSONAL_QUEST_PHOTO_BUCKET)
    .createSignedUrls(photos.map((photo) => photo.storage_path), PHOTO_SIGNED_URL_TTL_SECONDS)

  if (signed.error) return photos.map((photo) => ({ ...photo, signedUrl: '' }))

  return photos.map((photo, index) => ({
    ...photo,
    signedUrl: signed.data?.[index]?.signedUrl ?? '',
  }))
}

function upsertByDate<T extends Record<K, string>, K extends keyof T>(items: T[], next: T, key: K) {
  const filtered = items.filter((item) => item[key] !== next[key])
  return [next, ...filtered].sort((a, b) => String(b[key]).localeCompare(String(a[key])))
}

function clampInt(value: string, min: number, max: number) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return min
  return Math.min(max, Math.max(min, parsed))
}

function normalizeOptionalNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed)) return null
  return Math.round(parsed * 100) / 100
}

function daysBetween(earlier: string, later: string) {
  const start = new Date(`${earlier}T00:00:00`).getTime()
  const end = new Date(`${later}T00:00:00`).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.floor((end - start) / (24 * 60 * 60 * 1000))
}

function getPhotoExtension(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'webp'].includes(extension)) return extension
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

function createPrivatePhotoNonce() {
  if (typeof crypto === 'undefined') return 'private-photo'
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()

  const values = new Uint32Array(4)
  crypto.getRandomValues(values)
  return Array.from(values, (value) => value.toString(36)).join('-')
}

function readPhoneModePreference() {
  if (typeof window === 'undefined') return null

  try {
    const preference = window.localStorage.getItem(PHONE_MODE_PREFERENCE_KEY)
    return preference === 'pocket' || preference === 'full' ? preference : null
  } catch {
    return null
  }
}

function writePhoneModePreference(preference: 'pocket' | 'full') {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(PHONE_MODE_PREFERENCE_KEY, preference)
  } catch {
    // Phone mode still works for the current session when storage is unavailable.
  }
}

function isBrowserOnline() {
  if (typeof window === 'undefined' || typeof window.navigator === 'undefined') return true
  return window.navigator.onLine
}

function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return window.Notification.permission
}

function getOfflineQueueKey(ownerId: string) {
  return `${OFFLINE_QUEUE_KEY_PREFIX}${ownerId}`
}

function readOfflineQueue(ownerId: string): OfflineQuestAction[] {
  if (typeof window === 'undefined') return []

  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(getOfflineQueueKey(ownerId)) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isOfflineQuestAction).slice(-80)
  } catch {
    return []
  }
}

function writeOfflineQueue(ownerId: string, actions: OfflineQuestAction[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(getOfflineQueueKey(ownerId), JSON.stringify(actions.slice(-80)))
}

function queueOfflineQuestAction(ownerId: string, action: OfflineQuestAction) {
  const next = [
    ...readOfflineQueue(ownerId).filter((item) => !(item.questId === action.questId && item.targetDate === action.targetDate)),
    action,
  ].slice(-80)
  writeOfflineQueue(ownerId, next)
  return next.length
}

function isOfflineQuestAction(value: unknown): value is OfflineQuestAction {
  if (!value || typeof value !== 'object') return false
  const action = value as Partial<OfflineQuestAction>
  return Boolean(
    action.id &&
    typeof action.id === 'string' &&
    action.questId &&
    PERSONAL_DAILY_QUESTS.some((quest) => quest.id === action.questId) &&
    action.targetDate &&
    typeof action.targetDate === 'string' &&
    (action.action === 'complete' || action.action === 'remove') &&
    typeof action.xp === 'number',
  )
}

function createOfflineActionId() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) return window.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getClientIssueKey(ownerId: string) {
  return `${CLIENT_ISSUE_KEY_PREFIX}${ownerId}`
}

function readQuestClientIssues(ownerId: string): ClientIssue[] {
  if (typeof window === 'undefined') return []

  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(getClientIssueKey(ownerId)) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isClientIssue).slice(-40).reverse()
  } catch {
    return []
  }
}

function recordQuestClientIssue(ownerId: string, scope: string, detail: string) {
  if (typeof window === 'undefined') return 0

  const next = [
    ...readQuestClientIssues(ownerId).reverse(),
    {
      at: new Date().toISOString(),
      scope: scope.slice(0, 80),
      detail: detail.slice(0, 240),
    },
  ].slice(-40)
  window.localStorage.setItem(getClientIssueKey(ownerId), JSON.stringify(next))
  return next.length
}

function clearQuestClientIssues(ownerId: string) {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(getClientIssueKey(ownerId))
}

function isClientIssue(value: unknown): value is ClientIssue {
  if (!value || typeof value !== 'object') return false
  const issue = value as Partial<ClientIssue>
  return Boolean(
    typeof issue.at === 'string' &&
    typeof issue.scope === 'string' &&
    typeof issue.detail === 'string',
  )
}
