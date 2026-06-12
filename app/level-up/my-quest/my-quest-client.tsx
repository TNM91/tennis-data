'use client'

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import {
  PERSONAL_DAILY_QUESTS,
  PERSONAL_QUEST_PHOTO_BUCKET,
  buildPersonalQuestStats,
  getTodayKey,
  getWeekEndKey,
  getWeekStartKey,
  isPersonalQuestOwner,
  type DailyLog,
  type DailyQuestCompletion,
  type PersonalQuestDefinition,
  type ProgressPhoto,
  type ProgressPhotoType,
  type WeeklyReview,
} from '@/lib/personal-quest'
import { supabase } from '@/lib/supabase'
import styles from './my-quest.module.css'

type PhotoPreview = ProgressPhoto & {
  signedUrl: string
}

type LoadState = 'checking' | 'loading' | 'ready'

const PHOTO_TYPES: Array<{ id: ProgressPhotoType; label: string }> = [
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'flex', label: 'Flex' },
]

export default function MyQuestClient() {
  const { authResolved, session, userId } = useAuth()
  const [loadState, setLoadState] = useState<LoadState>('checking')
  const [completions, setCompletions] = useState<DailyQuestCompletion[]>([])
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [weeklyReview, setWeeklyReview] = useState<WeeklyReview | null>(null)
  const [photos, setPhotos] = useState<PhotoPreview[]>([])
  const [ipaInput, setIpaInput] = useState('0')
  const [notesInput, setNotesInput] = useState('')
  const [waistInput, setWaistInput] = useState('')
  const [reviewWin, setReviewWin] = useState('')
  const [reviewMiss, setReviewMiss] = useState('')
  const [reviewFocus, setReviewFocus] = useState('')
  const [savingTracker, setSavingTracker] = useState(false)
  const [savingReview, setSavingReview] = useState(false)
  const [pendingQuest, setPendingQuest] = useState('')
  const [uploadingType, setUploadingType] = useState<ProgressPhotoType | ''>('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const authUser = session?.user ?? null
  const ownerAllowed = isPersonalQuestOwner({ id: authUser?.id ?? userId, email: authUser?.email })
  const accessDenied = authResolved && (!(authUser?.id ?? userId) || !ownerAllowed)
  const today = useMemo(() => getTodayKey(), [])
  const weekStart = useMemo(() => getWeekStartKey(), [])
  const weekEnd = useMemo(() => getWeekEndKey(weekStart), [weekStart])

  const stats = useMemo(
    () => buildPersonalQuestStats({ completions, logs, today, weekStart }),
    [completions, logs, today, weekStart],
  )

  const completedToday = useMemo(
    () => new Set(completions.filter((item) => item.completed_on === today).map((item) => item.quest_id)),
    [completions, today],
  )

  const bossBonus = stats.weeklyBossXp

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
      completionResult,
      logResult,
      measurementResult,
      reviewResult,
      photoResult,
    ] = await Promise.all([
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
        .select('id, photo_type, storage_path, created_at')
        .eq('user_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(12),
    ])

    if (completionResult.error) throw new Error(completionResult.error.message)
    if (logResult.error) throw new Error(logResult.error.message)
    if (measurementResult.error) throw new Error(measurementResult.error.message)
    if (reviewResult.error) throw new Error(reviewResult.error.message)
    if (photoResult.error) throw new Error(photoResult.error.message)

    const nextCompletions = (completionResult.data ?? []) as DailyQuestCompletion[]
    const nextLogs = (logResult.data ?? []) as DailyLog[]
    const nextMeasurements = (measurementResult.data ?? []) as Array<{ measured_on: string; waist_inches: number | null }>
    const nextReview = (reviewResult.data ?? null) as WeeklyReview | null
    const nextPhotos = (photoResult.data ?? []) as ProgressPhoto[]

    setCompletions(nextCompletions)
    setLogs(nextLogs)
    setWeeklyReview(nextReview)
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
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    setLoadState('ready')
  }, [today, weekStart])

  useEffect(() => {
    if (!authResolved) return

    const ownerId = authUser?.id ?? userId
    if (!ownerId || !ownerAllowed) {
      return
    }

    const timeout = window.setTimeout(() => {
      void loadDashboard(ownerId).catch((err) => {
        setError(err instanceof Error ? err.message : 'My Quest could not load.')
        setLoadState('ready')
      })
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [authResolved, authUser?.id, loadDashboard, ownerAllowed, userId])

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

  async function toggleQuest(quest: PersonalQuestDefinition) {
    const ownerId = authUser?.id ?? userId
    if (!ownerId || pendingQuest) return

    const alreadyComplete = completedToday.has(quest.id)
    setPendingQuest(quest.id)
    setError('')
    setMessage('')

    if (alreadyComplete) {
      const before = completions
      setCompletions((current) => current.filter((item) => !(item.completed_on === today && item.quest_id === quest.id)))
      const { error: deleteError } = await supabase
        .from('personal_daily_quest_completions')
        .delete()
        .eq('user_id', ownerId)
        .eq('completed_on', today)
        .eq('quest_id', quest.id)

      if (deleteError) {
        setCompletions(before)
        setError(deleteError.message)
      }
      setPendingQuest('')
      return
    }

    const completion: DailyQuestCompletion = {
      quest_id: quest.id,
      completed_on: today,
      xp_awarded: quest.xp,
    }
    setCompletions((current) => [completion, ...current])

    const { error: upsertError } = await supabase
      .from('personal_daily_quest_completions')
      .upsert({
        user_id: ownerId,
        completed_on: today,
        quest_id: quest.id,
        xp_awarded: quest.xp,
      }, { onConflict: 'user_id,completed_on,quest_id' })

    if (upsertError) {
      setCompletions((current) => current.filter((item) => !(item.completed_on === today && item.quest_id === quest.id)))
      setError(upsertError.message)
    }

    setPendingQuest('')
  }

  async function saveDailyTrackers(nextIpaInput = ipaInput, nextNotesInput = notesInput) {
    const ownerId = authUser?.id ?? userId
    if (!ownerId) return

    setSavingTracker(true)
    setError('')
    setMessage('')

    const ipaCount = clampInt(nextIpaInput, 0, 30)
    const cleanNotes = nextNotesInput.trim().slice(0, 1600)
    const payload = {
      user_id: ownerId,
      log_date: today,
      ipa_count: ipaCount,
      notes: cleanNotes,
      updated_at: new Date().toISOString(),
    }

    const { error: upsertError } = await supabase
      .from('personal_daily_logs')
      .upsert(payload, { onConflict: 'user_id,log_date' })

    if (upsertError) {
      setError(upsertError.message)
    } else {
      setLogs((current) => upsertByDate(current, { log_date: today, ipa_count: ipaCount, notes: cleanNotes }, 'log_date'))
      setIpaInput(String(ipaCount))
      setNotesInput(cleanNotes)
      setMessage('Daily tracker saved.')
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
      setError(reviewResult.error.message)
    } else if (measurementResult.error) {
      setError(measurementResult.error.message)
    } else {
      const nextReview = reviewResult.data as WeeklyReview
      setWeeklyReview(nextReview)
      if (waist !== null) {
        setWaistInput(String(waist))
      }
      setMessage('Weekly review saved.')
    }

    setSavingReview(false)
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
      setError('Upload a JPG, PNG, or WebP progress photo.')
      setUploadingType('')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Progress photos need to be 10 MB or smaller.')
      setUploadingType('')
      return
    }

    const extension = getPhotoExtension(file)
    const storagePath = `${ownerId}/${today}/${type}-${file.lastModified}-${file.size}-${photos.length}.${extension}`
    const upload = await supabase.storage
      .from(PERSONAL_QUEST_PHOTO_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      })

    if (upload.error) {
      setError(upload.error.message)
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
      setError(inserted.error.message)
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
    <section className={styles.pageShell}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Level Up: My Quest</p>
          <h1>Operation Visible Abs</h1>
          <p className={styles.heroText}>Season 1 private quest board. Stack the habits, keep the streak alive, and beat the weekly bosses.</p>
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

      <div className={styles.statGrid}>
        <MetricTile label="XP Total" value={stats.totalXp.toLocaleString()} hint={stats.level.title} />
        <MetricTile label="Current Streak" value={`${stats.currentStreak}`} hint="days" accent="fire" />
        <MetricTile label="Weekly Score" value={`${stats.weeklyXp.toLocaleString()}`} hint={`${stats.weeklyQuestXp} quest + ${bossBonus} bonus XP`} />
        <MetricTile label="Next Milestone" value={stats.nextMilestone} hint="target" compact />
      </div>

      {error ? <div className={styles.errorNotice}>{error}</div> : null}
      {message ? <div className={styles.successNotice}>{message}</div> : null}

      <section className={styles.sectionGrid}>
        <div className={styles.questPanel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Daily Quests</p>
              <h2>Today&apos;s XP</h2>
            </div>
            <span className={styles.scorePill}>{today}</span>
          </div>
          <div className={styles.questGrid}>
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
        </div>
      </section>

      <section className={styles.bossPanel}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Weekly Boss Battles</p>
            <h2>Week of {weekStart}</h2>
          </div>
          <span className={styles.scorePill}>Bonus +{bossBonus} XP</span>
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
        <div className={styles.reviewPanel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>Sunday Check-In</p>
              <h2>Weekly review</h2>
            </div>
            <span className={styles.scorePill}>{weeklyReview ? 'Saved' : 'Open'}</span>
          </div>
          <div className={styles.reviewMetrics}>
            <MetricTile label="Weekly XP" value={`${stats.weeklyXp}`} hint="with bonus" compact />
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
          <button type="button" className={styles.primaryButton} onClick={() => void saveWeeklyReview()} disabled={savingReview}>
            {savingReview ? 'Saving review' : 'Save weekly review'}
          </button>
        </div>

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

      <section className={styles.achievementPanel}>
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
          {stats.achievements.map((achievement) => (
            <div key={achievement.id} className={`${styles.badgeCard} ${achievement.unlocked ? styles.badgeUnlocked : ''}`}>
              <span className={styles.badgeIcon}>{achievement.unlocked ? '*' : '-'}</span>
              <strong>{achievement.title}</strong>
              <ProgressBar value={Math.min(100, Math.round((achievement.progress / achievement.target) * 100))} label={`${achievement.progress}/${achievement.target}`} />
            </div>
          ))}
        </div>
      </section>
    </section>
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
      <strong>{accent === 'fire' ? <span className={styles.fireIcon} aria-label="Streak fire">🔥</span> : null}{value}</strong>
      <small>{hint}</small>
    </div>
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
    .createSignedUrls(photos.map((photo) => photo.storage_path), 900)

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

function getPhotoExtension(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg', 'jpeg', 'png', 'webp'].includes(extension)) return extension
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}
