'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import {
  applyVideoReviewClipMetadata,
  VIDEO_REVIEW_COACH_CUES,
  VIDEO_REVIEW_CAPTURE_INTENTS,
  VIDEO_REVIEW_QUOTA,
  VIDEO_REVIEW_NOTIFICATION_STORAGE_KEY,
  VIDEO_REVIEW_PRACTICE_STORAGE_KEY,
  VIDEO_REVIEW_WATCHED_MARKS_STORAGE_KEY,
  VIDEO_REVIEW_STROKES,
  VIDEO_REVIEW_WORKFLOW,
  buildVideoReviewCoachChecklistState,
  buildVideoReviewHandoffHref,
  buildVideoReviewNotification,
  buildVideoReviewDeletePrompt,
  buildVideoReviewPackageExportMessage,
  buildVideoReviewPackageFileName,
  buildVideoReviewPackageShareText,
  buildVideoReviewPracticePlan,
  buildVideoReviewPracticeRecord,
  buildVideoReviewReturnFocus,
  buildVideoReviewSummaryFileName,
  buildVideoReviewSummaryText,
  canEditVideoReviewAnnotations,
  canReturnVideoReview,
  estimateVideoReviewPackageBytes,
  filterVideoReviewClips,
  formatVideoReviewBytes,
  formatVideoReviewCoachMarkCount,
  formatVideoReviewDuration,
  getVideoReviewCleanupCandidate,
  getVideoReviewAnnotationNotificationType,
  getVideoReviewAnnotationSaveStatus,
  getVideoReviewCaptureIntent,
  getVideoReviewCoachAnnotations,
  getVideoReviewImportQuotaState,
  getLatestVideoReviewCoachAnnotation,
  getVideoReviewQuotaState,
  getVideoReviewQueueSummary,
  getVideoReviewStrokeLabel,
  markVideoReviewNotificationRead,
  normalizeImportedVideoReviewClip,
  parseVideoReviewPackageJson,
  removeVideoReviewAnnotation,
  removeVideoReviewClipNotifications,
  upsertVideoReviewNotification,
  type VideoAnnotation,
  type VideoAnnotationPoint,
  type VideoAnnotationTool,
  type VideoReviewCaptureIntent,
  type VideoReviewNotification,
  type VideoReviewPracticeRecord,
  type VideoReviewClip,
  type VideoReviewRole,
  type VideoReviewStatus,
  type VideoReviewClipMetadataPatch,
  type VideoReviewStatusFilter,
  type VideoReviewStrokeFilter,
  type VideoReviewTransferPackage,
  type VideoStrokeTag,
} from '@/lib/video-review'
import styles from './video-review.module.css'

const DB_NAME = 'tenaceiq-video-review-v1'
const CLIP_STORE = 'clips'
const BLOB_STORE = 'blobs'
const ANNOTATION_COLORS = ['#9be11d', '#74beff', '#ffc257', '#ff7a7a']
const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 1.5] as const
const FRAME_STEP_SECONDS = 1 / 30
const PLAYER_NOTE_CUES = [
  {
    label: 'Toss',
    note: 'Please check whether my toss is consistent and far enough in front.',
  },
  {
    label: 'Contact',
    note: 'Please check my contact point and whether I am meeting the ball early enough.',
  },
  {
    label: 'Footwork',
    note: 'Please check my setup steps and whether I am balanced before contact.',
  },
  {
    label: 'Recovery',
    note: 'Please check how quickly I recover after the shot.',
  },
  {
    label: 'Timing',
    note: 'Please check whether my timing is rushed or late.',
  },
  {
    label: 'Swing path',
    note: 'Please check my swing path and finish.',
  },
] as const
const PLAYER_QUICK_FILTERS = [
  { label: 'All clips', status: 'all' },
  { label: 'Private', status: 'draft' },
  { label: 'Waiting on coach', status: 'sent' },
  { label: 'Feedback ready', status: 'reviewed' },
] as const satisfies Array<{ label: string; status: VideoReviewStatusFilter }>
const COACH_QUICK_FILTERS = [
  { label: 'All clips', status: 'all' },
  { label: 'Needs review', status: 'sent' },
  { label: 'Returned', status: 'reviewed' },
] as const satisfies Array<{ label: string; status: VideoReviewStatusFilter }>

type ClipBlobRecord = {
  id: string
  blob: Blob
}

type DraftState = {
  title: string
  playerName: string
  coachName: string
  stroke: VideoStrokeTag
  captureIntent: VideoReviewCaptureIntent
  playerNote: string
}

type VideoReviewOrientation = 'landscape' | 'portrait' | 'square'

type VideoReviewVideoShape = {
  width: number
  height: number
  orientation: VideoReviewOrientation
}

const INITIAL_DRAFT: DraftState = {
  title: '',
  playerName: '',
  coachName: '',
  stroke: 'serve',
  captureIntent: 'full-court',
  playerNote: '',
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function cleanText(value: string, maxLength = 240) {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function openVideoReviewDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(CLIP_STORE)) {
        db.createObjectStore(CLIP_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readAllClips() {
  const db = await openVideoReviewDb()
  return new Promise<VideoReviewClip[]>((resolve, reject) => {
    const transaction = db.transaction(CLIP_STORE, 'readonly')
    const request = transaction.objectStore(CLIP_STORE).getAll()
    request.onsuccess = () => resolve((request.result as VideoReviewClip[]).sort(sortClips))
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => db.close()
  })
}

async function readClipBlob(id: string) {
  const db = await openVideoReviewDb()
  return new Promise<Blob | null>((resolve, reject) => {
    const transaction = db.transaction(BLOB_STORE, 'readonly')
    const request = transaction.objectStore(BLOB_STORE).get(id)
    request.onsuccess = () => resolve((request.result as ClipBlobRecord | undefined)?.blob ?? null)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => db.close()
  })
}

async function saveClip(clip: VideoReviewClip, blob?: Blob) {
  const db = await openVideoReviewDb()
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([CLIP_STORE, BLOB_STORE], 'readwrite')
    transaction.objectStore(CLIP_STORE).put(clip)
    if (blob) {
      transaction.objectStore(BLOB_STORE).put({ id: clip.id, blob } satisfies ClipBlobRecord)
    }
    transaction.oncomplete = () => {
      db.close()
      resolve()
    }
    transaction.onerror = () => {
      db.close()
      reject(transaction.error)
    }
  })
}

async function removeClip(id: string) {
  const db = await openVideoReviewDb()
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([CLIP_STORE, BLOB_STORE], 'readwrite')
    transaction.objectStore(CLIP_STORE).delete(id)
    transaction.objectStore(BLOB_STORE).delete(id)
    transaction.oncomplete = () => {
      db.close()
      resolve()
    }
    transaction.onerror = () => {
      db.close()
      reject(transaction.error)
    }
  })
}

function sortClips(left: VideoReviewClip, right: VideoReviewClip) {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
}

function getDuration(file: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : null
      URL.revokeObjectURL(url)
      resolve(duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    video.src = url
  })
}

function statusLabel(status: VideoReviewStatus) {
  if (status === 'reviewed') return 'Reviewed'
  if (status === 'sent') return 'Coach queue'
  return 'Saved'
}

function timeLabel(seconds: number) {
  return formatVideoReviewDuration(seconds)
}

function buildActiveVideoReviewNextStep(input: {
  clip: VideoReviewClip
  mode: VideoReviewRole
  coachMarkCount: number
  canSendReviewBack: boolean
  practiceDone: boolean
}) {
  const strokeLabel = getVideoReviewStrokeLabel(input.clip.stroke).toLowerCase()

  if (input.mode === 'coach') {
    if (input.clip.status === 'reviewed') {
      return {
        badge: 'Ready for player',
        title: `Return ${strokeLabel} feedback`,
        body: `${input.clip.playerName} can open the coach marks and take the next focus back to court.`,
      }
    }

    if (input.clip.status === 'sent') {
      if (input.canSendReviewBack) {
        return {
          badge: 'Ready to return',
          title: 'Send one clear focus back',
          body: 'The review has enough feedback. Return it now or add one more timestamp mark first.',
        }
      }

      if (input.coachMarkCount) {
        return {
          badge: 'Next focus',
          title: 'Name the practice cue',
          body: 'Add the one thing the player should work on before sending this clip back.',
        }
      }

      return {
        badge: 'Coach queue',
        title: 'Mark the key moment',
        body: 'Play the clip, pause at the frame that matters, then add a line, arrow, circle, or note.',
      }
    }

    return {
      badge: 'Private clip',
      title: 'Open the player view',
      body: 'This clip has not been sent into the coach queue yet.',
    }
  }

  if (input.clip.status === 'reviewed') {
    return {
      badge: input.practiceDone ? 'Practice logged' : 'Feedback ready',
      title: input.practiceDone ? 'Keep the cue active' : 'Watch, then practice',
      body: input.practiceDone
        ? 'Your feedback is saved. Use the same cue again before deleting or archiving the clip.'
        : 'Open the first coach mark, copy the practice plan, then mark the work done after your next session.',
    }
  }

  if (input.clip.status === 'sent') {
    return {
      badge: 'Waiting on coach',
      title: `Share this with ${input.clip.coachName}`,
      body: 'Copy the coach link or share the review file so your coach can mark the clip and return feedback.',
    }
  }

  return {
    badge: 'Saved private',
    title: 'Send it when ready',
    body: 'This clip is only on this device. Send it to coach review when you want feedback.',
  }
}

function buildPlayerFeedbackChecklist(input: {
  clip: VideoReviewClip
  coachMarkCount: number
  watchedCoachMarkCount: number
  practiceDone: boolean
}) {
  const watchedMarkCopy = input.coachMarkCount
    ? `${input.watchedCoachMarkCount} of ${input.coachMarkCount} opened.`
    : 'Start with the one focus your coach returned.'

  return [
    {
      id: 'watch',
      label: '1',
      title: input.coachMarkCount ? 'Watch the coach marks' : 'Read the coach focus',
      body: watchedMarkCopy,
      done: input.coachMarkCount === 0 || input.watchedCoachMarkCount >= input.coachMarkCount,
    },
    {
      id: 'cue',
      label: '2',
      title: 'Take one cue to court',
      body: input.clip.coachSummary || 'Use the coach focus during the next practice block.',
      done: Boolean(input.clip.coachSummary),
    },
    {
      id: 'practice',
      label: '3',
      title: 'Log the practice',
      body: 'Mark it practiced after the next session so the clip can move out of the main queue.',
      done: input.practiceDone,
    },
  ]
}

function buildLibraryClipNextAction(input: {
  clip: VideoReviewClip
  mode: VideoReviewRole
  practiceDone: boolean
  watchedCoachMarkIds: string[]
}) {
  const coachMarks = getVideoReviewCoachAnnotations(input.clip)

  if (input.mode === 'coach') {
    if (input.clip.status === 'reviewed') return 'Next: share player feedback'
    if (input.clip.status === 'sent') {
      if (canReturnVideoReview(input.clip)) return 'Next: send back'
      if (coachMarks.length) return 'Next: add one focus'
      return 'Next: mark key moment'
    }
    return 'Next: wait for player send'
  }

  if (input.clip.status === 'reviewed') {
    if (input.practiceDone) return 'Next: practice logged'
    const nextMarkIndex = coachMarks.findIndex((mark) => !input.watchedCoachMarkIds.includes(mark.id))
    if (nextMarkIndex >= 0) return `Next: watch Mark ${nextMarkIndex + 1}`
    return coachMarks.length ? 'Next: practice the cue' : 'Next: read coach focus'
  }

  if (input.clip.status === 'sent') return 'Next: waiting on coach'
  return 'Next: send to coach'
}

function clampPoint(point: VideoAnnotationPoint): VideoAnnotationPoint {
  return {
    x: Math.max(0, Math.min(1, point.x)),
    y: Math.max(0, Math.min(1, point.y)),
  }
}

function getCanvasPoint(event: PointerEvent<HTMLCanvasElement>): VideoAnnotationPoint {
  const rect = event.currentTarget.getBoundingClientRect()
  return clampPoint({
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
  })
}

function readLocalNotifications(): VideoReviewNotification[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(VIDEO_REVIEW_NOTIFICATION_STORAGE_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is VideoReviewNotification => (
        Boolean(item)
        && typeof item.id === 'string'
        && (item.recipientRole === 'player' || item.recipientRole === 'coach')
        && typeof item.clipId === 'string'
        && typeof item.title === 'string'
        && typeof item.createdAt === 'string'
      ))
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 40)
  } catch {
    return []
  }
}

function writeLocalNotifications(notifications: VideoReviewNotification[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(VIDEO_REVIEW_NOTIFICATION_STORAGE_KEY, JSON.stringify(notifications.slice(0, 40)))
}

function readLocalPracticeRecords(): Record<string, VideoReviewPracticeRecord> {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(VIDEO_REVIEW_PRACTICE_STORAGE_KEY) || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, VideoReviewPracticeRecord] => {
        const [clipId, record] = entry
        return Boolean(record)
          && typeof clipId === 'string'
          && typeof record === 'object'
          && !Array.isArray(record)
          && typeof (record as VideoReviewPracticeRecord).clipId === 'string'
          && typeof (record as VideoReviewPracticeRecord).doneAt === 'string'
          && typeof (record as VideoReviewPracticeRecord).focus === 'string'
      }),
    )
  } catch {
    return {}
  }
}

function writeLocalPracticeRecords(records: Record<string, VideoReviewPracticeRecord>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(VIDEO_REVIEW_PRACTICE_STORAGE_KEY, JSON.stringify(records))
}

function readLocalWatchedCoachMarks(): Record<string, string[]> {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(VIDEO_REVIEW_WATCHED_MARKS_STORAGE_KEY) || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([clipId, annotationIds]) => (
        typeof clipId === 'string' && Array.isArray(annotationIds)
          ? [[clipId, annotationIds.filter((id): id is string => typeof id === 'string').slice(0, 80)]]
          : []
      )),
    )
  } catch {
    return {}
  }
}

function writeLocalWatchedCoachMarks(records: Record<string, string[]>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(VIDEO_REVIEW_WATCHED_MARKS_STORAGE_KEY, JSON.stringify(records))
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl: string, fallbackType: string) {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  return blob.type ? blob : new Blob([blob], { type: fallbackType || 'video/webm' })
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function scrollToVideoReviewPanel(panelId: string, behavior: ScrollBehavior = 'smooth') {
  document.getElementById(panelId)?.scrollIntoView({ behavior, block: 'start' })
}

function importQuotaMessage(reason: ReturnType<typeof getVideoReviewImportQuotaState>['reason']) {
  return reason === 'clip-limit'
    ? 'Your video slots are full. Delete an old clip before adding this review.'
    : 'Your video space is full. Delete an old clip before adding this review.'
}

function formatPracticeDoneDate(doneAt: string) {
  const date = new Date(doneAt)
  if (Number.isNaN(date.getTime())) return 'Practice logged'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatRecordingTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = String(safeSeconds % 60).padStart(2, '0')
  return `${minutes}:${remainingSeconds}`
}

function getVideoReviewOrientation(width: number, height: number): VideoReviewOrientation {
  if (width > height) return 'landscape'
  if (height > width) return 'portrait'
  return 'square'
}

function readVideoShape(video: HTMLVideoElement): VideoReviewVideoShape | null {
  if (!video.videoWidth || !video.videoHeight) return null
  return {
    width: video.videoWidth,
    height: video.videoHeight,
    orientation: getVideoReviewOrientation(video.videoWidth, video.videoHeight),
  }
}

function getVideoShapeLabel(shape: VideoReviewVideoShape | null) {
  if (!shape) return 'Phone angle'
  if (shape.orientation === 'landscape') return 'Horizontal clip'
  if (shape.orientation === 'portrait') return 'Portrait clip'
  return 'Square clip'
}

function getVideoShapeCopy(shape: VideoReviewVideoShape | null) {
  if (!shape) {
    return 'Horizontal is best for serves, point play, and full-court spacing. Portrait works for close-up mechanics.'
  }
  if (shape.orientation === 'landscape') {
    return 'Good for full-court spacing, serves, movement, and coach markup across the whole frame.'
  }
  if (shape.orientation === 'portrait') {
    return 'Good for close-up mechanics. Turn the phone sideways when you want full-court spacing or serve path.'
  }
  return 'Keep the player, contact point, and recovery steps inside the frame before sending.'
}

export default function VideoReviewClient() {
  const [mode, setMode] = useState<VideoReviewRole>('player')
  const [clips, setClips] = useState<VideoReviewClip[]>([])
  const [activeClipId, setActiveClipId] = useState('')
  const [activeBlobUrl, setActiveBlobUrl] = useState('')
  const [draft, setDraft] = useState<DraftState>(INITIAL_DRAFT)
  const [selectedFile, setSelectedFile] = useState<File | Blob | null>(null)
  const [selectedFileName, setSelectedFileName] = useState('')
  const [draftPreviewUrl, setDraftPreviewUrl] = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraPreviewReady, setCameraPreviewReady] = useState(false)
  const [captureVideoShape, setCaptureVideoShape] = useState<VideoReviewVideoShape | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [message, setMessage] = useState('')
  const [tool, setTool] = useState<VideoAnnotationTool>('line')
  const [color, setColor] = useState(ANNOTATION_COLORS[0])
  const [coachNote, setCoachNote] = useState('')
  const [coachSummary, setCoachSummary] = useState('')
  const [drawingPoints, setDrawingPoints] = useState<VideoAnnotationPoint[]>([])
  const [previewPoints, setPreviewPoints] = useState<VideoAnnotationPoint[]>([])
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [storageReady, setStorageReady] = useState(false)
  const [storageError, setStorageError] = useState('')
  const [notifications, setNotifications] = useState<VideoReviewNotification[]>([])
  const [practiceRecords, setPracticeRecords] = useState<Record<string, VideoReviewPracticeRecord>>({})
  const [watchedCoachMarks, setWatchedCoachMarks] = useState<Record<string, string[]>>({})
  const [clipSearch, setClipSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<VideoReviewStatusFilter>('all')
  const [strokeFilter, setStrokeFilter] = useState<VideoReviewStrokeFilter>('all')

  const videoRef = useRef<HTMLVideoElement>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const activeClip = useMemo(
    () => clips.find((clip) => clip.id === activeClipId) ?? clips[0] ?? null,
    [activeClipId, clips],
  )
  const practicePlan = useMemo(
    () => activeClip ? buildVideoReviewPracticePlan(activeClip) : null,
    [activeClip],
  )
  const latestCoachMark = useMemo(
    () => activeClip ? getLatestVideoReviewCoachAnnotation(activeClip) : null,
    [activeClip],
  )
  const activeCoachAnnotations = useMemo(
    () => activeClip ? getVideoReviewCoachAnnotations(activeClip) : [],
    [activeClip],
  )
  const watchedCoachMarkIds = useMemo(() => {
    if (!activeClip) return new Set<string>()
    return new Set(watchedCoachMarks[activeClip.id] ?? [])
  }, [activeClip, watchedCoachMarks])
  const watchedCoachMarkCount = useMemo(
    () => activeCoachAnnotations.filter((annotation) => watchedCoachMarkIds.has(annotation.id)).length,
    [activeCoachAnnotations, watchedCoachMarkIds],
  )
  const nextUnwatchedCoachMark = useMemo(
    () => activeCoachAnnotations.find((annotation) => !watchedCoachMarkIds.has(annotation.id)) ?? null,
    [activeCoachAnnotations, watchedCoachMarkIds],
  )
  const nextUnwatchedCoachMarkNumber = nextUnwatchedCoachMark
    ? activeCoachAnnotations.findIndex((annotation) => annotation.id === nextUnwatchedCoachMark.id) + 1
    : 0
  const nextCoachMarkCue = nextUnwatchedCoachMark && nextUnwatchedCoachMarkNumber
    ? `Next: Mark ${nextUnwatchedCoachMarkNumber} at ${timeLabel(nextUnwatchedCoachMark.timestamp)}.`
    : activeCoachAnnotations.length
      ? 'All marks watched. Replay any mark or start over.'
      : ''
  const playerWatchProgressLabel = activeCoachAnnotations.length
    ? nextUnwatchedCoachMark && nextUnwatchedCoachMarkNumber
      ? `${watchedCoachMarkCount} of ${activeCoachAnnotations.length} watched. Mark ${nextUnwatchedCoachMarkNumber} next.`
      : 'All marks watched'
    : 'Coach focus'
  const returnReviewFocus = useMemo(
    () => activeClip ? buildVideoReviewReturnFocus(activeClip, coachSummary) : '',
    [activeClip, coachSummary],
  )
  const coachChecklist = useMemo(
    () => activeClip ? buildVideoReviewCoachChecklistState(activeClip, coachSummary, currentTime) : [],
    [activeClip, coachSummary, currentTime],
  )
  const activePracticeRecord = activeClip ? practiceRecords[activeClip.id] ?? null : null
  const canEditMarks = canEditVideoReviewAnnotations(mode)
  const canSendReviewBack = Boolean(activeClip && mode === 'coach' && canReturnVideoReview(activeClip, coachSummary))
  const firstReviewMark = activeCoachAnnotations[0] ?? null
  const currentMarkNumber = activeCoachAnnotations.findIndex((annotation) => Math.abs(annotation.timestamp - currentTime) <= 1.25) + 1
  const quota = useMemo(() => getVideoReviewQuotaState(clips), [clips])
  const visibleAnnotations = useMemo(() => {
    if (!activeClip) return []
    return activeCoachAnnotations.filter((annotation) => Math.abs(annotation.timestamp - currentTime) <= 1.25)
  }, [activeClip, activeCoachAnnotations, currentTime])
  const visibleAnnotationIds = useMemo(
    () => new Set(visibleAnnotations.map((annotation) => annotation.id)),
    [visibleAnnotations],
  )
  const coachCues = useMemo(
    () => VIDEO_REVIEW_COACH_CUES.filter((cue) => cue.stroke === 'all' || cue.stroke === activeClip?.stroke),
    [activeClip?.stroke],
  )
  const cleanupCandidate = useMemo(() => getVideoReviewCleanupCandidate(clips), [clips])
  const queueSummary = useMemo(() => getVideoReviewQueueSummary(clips), [clips])
  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => notification.recipientRole === mode),
    [mode, notifications],
  )
  const unreadNotificationCount = visibleNotifications.filter((notification) => !notification.readAt).length
  const coachUnreadNotificationCount = notifications.filter((notification) => notification.recipientRole === 'coach' && !notification.readAt).length
  const filteredClips = useMemo(
    () => filterVideoReviewClips(clips, {
      role: mode,
      query: clipSearch,
      status: statusFilter,
      stroke: strokeFilter,
    }),
    [clipSearch, clips, mode, statusFilter, strokeFilter],
  )
  const hasClipFilters = Boolean(clipSearch.trim()) || statusFilter !== 'all' || strokeFilter !== 'all'
  const draftFileSizeLabel = selectedFile ? formatVideoReviewBytes(selectedFile.size) : ''
  const storageStatusTitle = quota.warningLevel === 'full'
    ? 'Storage full'
    : quota.warningLevel === 'tight'
      ? 'Storage getting tight'
      : 'Next cleanup'
  const storageStatusCopy = quota.warningLevel === 'full'
    ? 'Delete one reviewed or private clip before saving another court video.'
    : quota.warningLevel === 'tight'
      ? 'You are close to the clip limit. Clear an old reviewed or private clip before the next upload.'
      : 'Keep the queue moving by clearing reviewed or private clips first.'
  const latestPlayerClip = useMemo(
    () => clips.find((clip) => clip.status === 'reviewed')
      ?? clips.find((clip) => clip.status === 'sent')
      ?? clips.find((clip) => clip.status === 'draft')
      ?? null,
    [clips],
  )
  const latestPlayerClipAction = latestPlayerClip?.status === 'reviewed'
    ? 'Open feedback'
    : latestPlayerClip?.status === 'sent'
      ? 'Check status'
      : latestPlayerClip
        ? 'Continue clip'
        : ''
  const quickFilters = mode === 'coach' ? COACH_QUICK_FILTERS : PLAYER_QUICK_FILTERS
  const activeNextStep = activeClip ? buildActiveVideoReviewNextStep({
    clip: activeClip,
    mode,
    coachMarkCount: activeCoachAnnotations.length,
    canSendReviewBack,
    practiceDone: Boolean(activePracticeRecord),
  }) : null
  const playerFeedbackChecklist = activeClip && activeClip.status === 'reviewed'
    ? buildPlayerFeedbackChecklist({
      clip: activeClip,
      coachMarkCount: activeCoachAnnotations.length,
      watchedCoachMarkCount,
      practiceDone: Boolean(activePracticeRecord),
    })
    : []
  const nextCoachMarkActionLabel = nextUnwatchedCoachMark && nextUnwatchedCoachMarkNumber
    ? `${watchedCoachMarkCount ? 'Continue' : 'Watch'} Mark ${nextUnwatchedCoachMarkNumber}`
    : activeCoachAnnotations.length ? 'Replay marks' : 'Open feedback'
  const coachActionTitle = !activeClip
    ? 'Choose a clip first'
    : activeClip.status === 'reviewed'
      ? 'Review already returned'
      : canSendReviewBack
        ? 'Ready to send back'
        : activeCoachAnnotations.length
          ? 'Name one next focus'
          : 'Mark the key moment'
  const coachActionCopy = !activeClip
    ? 'Open a clip from the library before adding coach marks.'
    : activeClip.status === 'reviewed'
      ? 'Copy the player link or preview the player feedback.'
      : canSendReviewBack
        ? 'Send the review back, then copy the player link if you want to text it.'
        : activeCoachAnnotations.length
          ? 'Write the one court cue the player should use next.'
          : 'Pause at the frame that matters, then add a line, arrow, circle, or note.'

  function openClip(clipId: string, nextMode: VideoReviewRole = mode) {
    if (!clipId) return
    setMode(nextMode)
    setActiveClipId(clipId)
    window.history.replaceState(null, '', buildVideoReviewHandoffHref(clipId, nextMode))
    if (window.matchMedia('(max-width: 767px)').matches) {
      scrollToVideoReviewPanel('video-review-active', 'auto')
      window.requestAnimationFrame(() => scrollToVideoReviewPanel('video-review-active', 'auto'))
    }
  }

  function switchMode(nextMode: VideoReviewRole) {
    setMode(nextMode)
    if (activeClip) {
      window.history.replaceState(null, '', buildVideoReviewHandoffHref(activeClip.id, nextMode))
    }
  }

  useEffect(() => {
    setCoachNote('')
    setCoachSummary('')
    setDrawingPoints([])
    setPreviewPoints([])
    setCurrentTime(0)
  }, [activeClip?.id])

  const loadClips = useCallback(async () => {
    try {
      const stored = await readAllClips()
      setClips(stored)
      setActiveClipId((current) => (
        current && stored.some((clip) => clip.id === current)
          ? current
          : stored[0]?.id || ''
      ))
      setStorageReady(true)
      setStorageError('')
    } catch {
      setStorageError('This device cannot save video clips right now.')
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadClips()
      setNotifications(readLocalNotifications())
      setPracticeRecords(readLocalPracticeRecords())
      setWatchedCoachMarks(readLocalWatchedCoachMarks())
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [loadClips])

  useEffect(() => {
    if (!storageReady || !clips.length) return
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search)
      const requestedMode = params.get('mode')
      const requestedClipId = params.get('clip')
      if (requestedMode === 'player' || requestedMode === 'coach') {
        setMode(requestedMode)
      }
      if (requestedClipId && clips.some((clip) => clip.id === requestedClipId)) {
        setActiveClipId(requestedClipId)
      }
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [clips, storageReady])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === VIDEO_REVIEW_NOTIFICATION_STORAGE_KEY) {
        setNotifications(readLocalNotifications())
      }
      if (event.key === VIDEO_REVIEW_PRACTICE_STORAGE_KEY) {
        setPracticeRecords(readLocalPracticeRecords())
      }
      if (event.key === VIDEO_REVIEW_WATCHED_MARKS_STORAGE_KEY) {
        setWatchedCoachMarks(readLocalWatchedCoachMarks())
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  useEffect(() => {
    let revokedUrl = ''

    async function loadActiveBlob() {
      if (!activeClip) {
        setActiveBlobUrl('')
        return
      }

      const blob = await readClipBlob(activeClip.id)
      if (!blob) {
        setActiveBlobUrl('')
        return
      }

      const url = URL.createObjectURL(blob)
      revokedUrl = url
      setActiveBlobUrl(url)
    }

    void loadActiveBlob()

    return () => {
      if (revokedUrl) URL.revokeObjectURL(revokedUrl)
    }
  }, [activeClip])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate
    }
  }, [activeBlobUrl, playbackRate])

  useEffect(() => {
    if (!selectedFile) {
      setDraftPreviewUrl('')
      return
    }

    const url = URL.createObjectURL(selectedFile)
    setDraftPreviewUrl(url)

    return () => URL.revokeObjectURL(url)
  }, [selectedFile])

  useEffect(() => {
    if (!draftPreviewUrl) return
    const timeout = window.setTimeout(() => {
      document.getElementById('video-review-draft-preview')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 80)

    return () => window.clearTimeout(timeout)
  }, [draftPreviewUrl])

  useEffect(() => {
    if (!recording) {
      setRecordingSeconds(0)
      return
    }

    const startedAt = Date.now()
    const updateTimer = () => setRecordingSeconds(Math.floor((Date.now() - startedAt) / 1000))
    updateTimer()
    const interval = window.setInterval(updateTimer, 500)

    return () => window.clearInterval(interval)
  }, [recording])

  useEffect(() => {
    if (!cameraActive || !previewVideoRef.current || !streamRef.current) return

    const preview = previewVideoRef.current
    const activeStream = streamRef.current
    preview.srcObject = activeStream
    preview.muted = true
    preview.playsInline = true

    const playPreview = async () => {
      try {
        await preview.play()
      } catch {
        setMessage('Tap Record when the camera preview is ready.')
      }
    }

    void playPreview()

    return () => {
      if (preview.srcObject === activeStream) {
        preview.srcObject = null
      }
    }
  }, [cameraActive])

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !activeClip) return

    const rect = canvas.getBoundingClientRect()
    const ratio = window.devicePixelRatio || 1
    const width = Math.max(1, Math.round(rect.width * ratio))
    const height = Math.max(1, Math.round(rect.height * ratio))

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const drawAnnotation = (annotation: Pick<VideoAnnotation, 'tool' | 'points' | 'color' | 'text'>) => {
      const points = annotation.points
      if (!points.length) return
      ctx.strokeStyle = annotation.color
      ctx.fillStyle = annotation.color
      ctx.lineWidth = 4 * ratio
      ctx.font = `${13 * ratio}px system-ui, sans-serif`

      if (annotation.tool === 'circle' && points.length >= 2) {
        const [start, end] = points
        const x = start.x * width
        const y = start.y * height
        const radius = Math.max(12 * ratio, Math.hypot((end.x - start.x) * width, (end.y - start.y) * height))
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.stroke()
        return
      }

      if ((annotation.tool === 'line' || annotation.tool === 'arrow') && points.length >= 2) {
        const [start, end] = points
        const startX = start.x * width
        const startY = start.y * height
        const endX = end.x * width
        const endY = end.y * height
        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.lineTo(endX, endY)
        ctx.stroke()

        if (annotation.tool === 'arrow') {
          const angle = Math.atan2(endY - startY, endX - startX)
          const headLength = 16 * ratio
          ctx.beginPath()
          ctx.moveTo(endX, endY)
          ctx.lineTo(endX - headLength * Math.cos(angle - Math.PI / 6), endY - headLength * Math.sin(angle - Math.PI / 6))
          ctx.lineTo(endX - headLength * Math.cos(angle + Math.PI / 6), endY - headLength * Math.sin(angle + Math.PI / 6))
          ctx.closePath()
          ctx.fill()
        }
        return
      }

      if (annotation.tool === 'freehand') {
        ctx.beginPath()
        points.forEach((point, index) => {
          const x = point.x * width
          const y = point.y * height
          if (index === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.stroke()
        return
      }

      const [point] = points
      const x = point.x * width
      const y = point.y * height
      ctx.beginPath()
      ctx.arc(x, y, 6 * ratio, 0, Math.PI * 2)
      ctx.fill()
      if (annotation.text) {
        ctx.fillText(annotation.text.slice(0, 44), x + 10 * ratio, y - 10 * ratio)
      }
    }

    visibleAnnotations.forEach(drawAnnotation)
    if (previewPoints.length) {
      drawAnnotation({ tool, points: previewPoints, color, text: coachNote })
    }
  }, [activeClip, coachNote, color, previewPoints, tool, visibleAnnotations])

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  useEffect(() => {
    const handleResize = () => drawCanvas()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [drawCanvas])

  async function handleFileChange(file: File | null) {
    if (!file) return
    setSelectedFile(file)
    setSelectedFileName(file.name)
    setCaptureVideoShape(null)
    setMessage('Clip ready. Add context, then save or send it.')
  }

  function clearDraftClip(messageText = 'Draft clip discarded.') {
    chunksRef.current = []
    setSelectedFile(null)
    setSelectedFileName('')
    setCaptureVideoShape(null)
    setMessage(messageText)
  }

  async function startCamera() {
    try {
      setCameraPreviewReady(false)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      setCameraActive(true)
      setMessage('Starting camera preview.')
    } catch {
      setMessage('Camera access was blocked. Upload a saved clip instead.')
    }
  }

  function stopCamera() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
    setRecording(false)
    setCameraActive(false)
    setCameraPreviewReady(false)
    setCaptureVideoShape(null)
  }

  function startRecording() {
    if (!streamRef.current) return
    if (!cameraPreviewReady) {
      setMessage('Camera is almost ready. Start recording when the preview appears.')
      return
    }
    clearDraftClip('Recording.')
    chunksRef.current = []
    const recorder = new MediaRecorder(streamRef.current, { mimeType: pickRecorderMimeType() })
    recorderRef.current = recorder
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      recorderRef.current = null
      setRecording(false)
      if (!chunksRef.current.length) {
        setMessage('No video was captured. Try recording again.')
        return
      }
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' })
      setSelectedFile(blob)
      setSelectedFileName(`court-recording-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.webm`)
      setCaptureVideoShape(null)
      setMessage('Recording ready. Save it or send it to coach review.')
    }
    recorder.start(250)
    setRecording(true)
    setMessage('Recording.')
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
  }

  function recordAgain() {
    clearDraftClip('Ready for a new recording.')
    if (!cameraActive) {
      void startCamera()
    }
  }

  async function saveDraft(status: VideoReviewStatus) {
    if (!selectedFile) {
      setMessage('Choose a video or record one before saving.')
      return
    }
    if (quota.usedClips >= VIDEO_REVIEW_QUOTA.maxClips || quota.usedBytes + selectedFile.size > VIDEO_REVIEW_QUOTA.maxBytes) {
      setMessage('Your video space is full. Delete an old clip before saving another.')
      return
    }

    const now = new Date().toISOString()
    const durationSeconds = await getDuration(selectedFile)
    const title = cleanText(draft.title) || `${getVideoReviewStrokeLabel(draft.stroke)} review`
    const clip: VideoReviewClip = {
      id: createId('clip'),
      title,
      playerName: cleanText(draft.playerName) || 'Player',
      coachName: cleanText(draft.coachName) || 'Coach',
      stroke: draft.stroke,
      status,
      createdAt: now,
      updatedAt: now,
      fileName: selectedFileName || 'video-clip.webm',
      fileType: selectedFile.type || 'video/webm',
      sizeBytes: selectedFile.size,
      durationSeconds,
      captureIntent: draft.captureIntent,
      playerNote: cleanText(draft.playerNote, 700),
      coachSummary: '',
      annotations: [],
    }

    try {
      await saveClip(clip, selectedFile)
      setSelectedFile(null)
      setSelectedFileName('')
      setCaptureVideoShape(null)
      setDraft(INITIAL_DRAFT)
      openClip(clip.id, 'player')
      if (status === 'sent') {
        pushLocalNotification(clip, 'clip_sent')
      }
      setMessage(status === 'sent' ? 'Coach notified. Copy the coach review link if you want to text or email it.' : 'Clip saved to your video lab.')
      await loadClips()
    } catch {
      setMessage('The clip could not be saved on this device.')
    }
  }

  async function updateClip(nextClip: VideoReviewClip, updatedAt = new Date().toISOString()) {
    const updatedClip = { ...nextClip, updatedAt }
    await saveClip(updatedClip)
    setClips((current) => current.map((clip) => (clip.id === nextClip.id ? updatedClip : clip)).sort(sortClips))
  }

  async function updateActiveClipDetails(patch: VideoReviewClipMetadataPatch) {
    if (!activeClip) return
    const updatedAt = new Date().toISOString()
    await updateClip(applyVideoReviewClipMetadata(activeClip, patch, updatedAt), updatedAt)
    setMessage('Clip details updated.')
  }

  function clearClipNotifications(clipId: string) {
    setNotifications((current) => {
      const next = removeVideoReviewClipNotifications(current, clipId)
      writeLocalNotifications(next)
      return next
    })
  }

  function clearDeletedClipFromView(clipId: string) {
    setClips((current) => current.filter((clip) => clip.id !== clipId))
    setWatchedCoachMarks((current) => {
      if (!current[clipId]) return current
      const next = { ...current }
      delete next[clipId]
      writeLocalWatchedCoachMarks(next)
      return next
    })
    if (activeClip?.id === clipId) {
      setActiveClipId('')
      setActiveBlobUrl('')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }

  async function deleteActiveClip() {
    if (!activeClip) return
    const ok = window.confirm(buildVideoReviewDeletePrompt(activeClip))
    if (!ok) return
    const deletedClipId = activeClip.id
    await removeClip(activeClip.id)
    clearClipNotifications(deletedClipId)
    clearDeletedClipFromView(deletedClipId)
    setMessage('Clip deleted from this device.')
    await loadClips()
  }

  async function deleteSuggestedCleanupClip() {
    if (!cleanupCandidate) return
    const ok = window.confirm(buildVideoReviewDeletePrompt(cleanupCandidate))
    if (!ok) return
    const deletedClipId = cleanupCandidate.id
    await removeClip(deletedClipId)
    clearClipNotifications(deletedClipId)
    clearDeletedClipFromView(deletedClipId)
    setMessage('Suggested cleanup clip deleted.')
    await loadClips()
  }

  async function sendActiveClip() {
    if (!activeClip) return
    await updateClip({ ...activeClip, status: 'sent' })
    pushLocalNotification(activeClip, 'clip_sent')
    setMessage('Coach notified. Copy the coach review link if you want to text or email it.')
  }

  async function saveAnnotation(points: VideoAnnotationPoint[], annotationTool = tool, text = coachNote) {
    if (!activeClip || !points.length) return
    if (!canEditMarks) {
      setMessage('Switch to coach mode to add marks.')
      return
    }
    const timestamp = videoRef.current?.currentTime ?? currentTime
    const annotation: VideoAnnotation = {
      id: createId('annotation'),
      clipId: activeClip.id,
      timestamp,
      tool: annotationTool,
      color,
      text: cleanText(text, 280),
      points: points.map(clampPoint),
      createdBy: 'coach',
      createdAt: new Date().toISOString(),
    }
    const updatedClip = {
      ...activeClip,
      status: getVideoReviewAnnotationSaveStatus(activeClip),
      annotations: [...activeClip.annotations, annotation],
    } satisfies VideoReviewClip
    await updateClip(updatedClip)
    const notificationType = getVideoReviewAnnotationNotificationType(activeClip)
    if (notificationType) {
      pushLocalNotification(updatedClip, notificationType)
    }
    setCoachNote('')
    setMessage(notificationType
      ? 'Coach markup saved and player feedback refreshed.'
      : 'Coach markup saved at this timestamp.')
  }

  function applyCoachCue(cue: { note: string; summary: string }) {
    setCoachNote(cue.note)
    setCoachSummary((current) => current.trim() ? current : cue.summary)
    setTool('note')
    setMessage('Coach cue loaded. Edit it or add it at the current timestamp.')
  }

  function usePlayerNoteAsCoachNote() {
    const note = activeClip?.playerNote.trim()
    if (!note) {
      setMessage('No player note added.')
      return
    }
    setCoachNote(cleanText(note, 280))
    setTool('note')
    setMessage('Player note loaded. Add it at the current timestamp or edit it first.')
    scrollToVideoReviewPanel('video-review-coach-tools')
  }

  async function markPlayerQuestion() {
    const note = activeClip?.playerNote.trim()
    if (!note) {
      setMessage('No player note added.')
      return
    }
    await saveAnnotation([{ x: 0.5, y: 0.5 }], 'note', note)
    scrollToVideoReviewPanel('video-review-return-review')
  }

  function applyCoachReturnFocus(summary: string) {
    setCoachSummary(summary)
    setMessage('Next focus ready. Add a mark or send the review back.')
  }

  async function sendReview() {
    if (!activeClip) return
    const returnFocus = buildVideoReviewReturnFocus(activeClip, coachSummary)
    if (!returnFocus) {
      setMessage('Add one coach mark or next focus before sending the review back.')
      return
    }
    const reviewedClip = {
      ...activeClip,
      status: 'reviewed',
      coachSummary: returnFocus,
    } satisfies VideoReviewClip
    await updateClip(reviewedClip)
    pushLocalNotification(reviewedClip, 'review_returned')
    setCoachSummary('')
    setMessage('Player notified. Copy the return link if you want to text or email it.')
  }

  function pushLocalNotification(clip: VideoReviewClip, type: 'clip_sent' | 'review_returned') {
    const notification = buildVideoReviewNotification({
      id: `${type}:${clip.id}`,
      type,
      clip,
      createdAt: new Date().toISOString(),
    })
    setNotifications((current) => {
      const next = upsertVideoReviewNotification(current, notification)
      writeLocalNotifications(next)
      return next
    })
  }

  function openNotification(notification: VideoReviewNotification) {
    if (!clips.some((clip) => clip.id === notification.clipId)) {
      clearClipNotifications(notification.clipId)
      setMessage('That local clip is no longer on this device. Notification cleared.')
      return
    }
    openClip(notification.clipId, notification.recipientRole)
    const nextNotifications = markVideoReviewNotificationRead(notifications, notification.id, new Date().toISOString())
    setNotifications(nextNotifications)
    writeLocalNotifications(nextNotifications)
    setMessage(notification.type === 'clip_sent' ? 'Coach review opened.' : 'Player feedback opened.')
  }

  async function copyHandoffLink(role: VideoReviewRole) {
    if (!activeClip) return
    const href = `${window.location.origin}${buildVideoReviewHandoffHref(activeClip.id, role)}`
    try {
      await navigator.clipboard.writeText(href)
      setMessage(role === 'coach' ? 'Coach review link copied for this device.' : 'Player return link copied for this device.')
    } catch {
      setMessage(`${role === 'coach' ? 'Coach review' : 'Player return'} link: ${href}`)
    }
  }

  async function createActivePackageFile(blob: Blob) {
    if (!activeClip) return null
    const dataUrl = await blobToDataUrl(blob)
    const reviewPackage: VideoReviewTransferPackage = {
      kind: 'tenaceiq.videoReviewPackage',
      version: 1,
      exportedAt: new Date().toISOString(),
      clip: activeClip,
      video: {
        fileName: activeClip.fileName || 'video-review.webm',
        fileType: blob.type || activeClip.fileType || 'video/webm',
        sizeBytes: blob.size || activeClip.sizeBytes,
        dataUrl,
      },
    }
    const fileName = buildVideoReviewPackageFileName(activeClip)
    const file = new File([JSON.stringify(reviewPackage)], fileName, { type: 'application/json' })
    const recipientRole: VideoReviewRole = activeClip.status === 'reviewed' ? 'player' : 'coach'
    return {
      file,
      fileName,
      recipientRole,
      shareText: buildVideoReviewPackageShareText(activeClip, recipientRole),
      shareTitle: activeClip.status === 'reviewed' ? 'TenAceIQ coach feedback' : 'TenAceIQ video review',
    }
  }

  async function exportActivePackage() {
    if (!activeClip) return
    const blob = await readClipBlob(activeClip.id)
    if (!blob) {
      setMessage('The selected clip video is not available on this device.')
      return
    }

    try {
      setMessage('Preparing review file.')
      const reviewFile = await createActivePackageFile(blob)
      if (!reviewFile) return
      downloadBlob(reviewFile.file, reviewFile.fileName)
      setMessage(buildVideoReviewPackageExportMessage(reviewFile.recipientRole))
    } catch {
      setMessage('The review file could not be created.')
    }
  }

  async function shareActivePackage() {
    if (!activeClip) return
    const blob = await readClipBlob(activeClip.id)
    if (!blob) {
      setMessage('The selected clip video is not available on this device.')
      return
    }

    try {
      setMessage('Preparing review file.')
      const reviewFile = await createActivePackageFile(blob)
      if (!reviewFile) return
      const shareData: ShareData & { files: File[] } = {
        title: reviewFile.shareTitle,
        text: reviewFile.shareText,
        files: [reviewFile.file],
      }
      if (typeof navigator.canShare === 'function' && navigator.canShare(shareData) && typeof navigator.share === 'function') {
        await navigator.share(shareData)
        setMessage('Review file ready to share.')
        return
      }

      downloadBlob(reviewFile.file, reviewFile.fileName)
      try {
        await navigator.clipboard.writeText(reviewFile.shareText)
        setMessage('Review file downloaded and message copied.')
      } catch {
        setMessage('Review file downloaded.')
      }
    } catch {
      setMessage('The review file could not be created.')
    }
  }

  async function importReviewPackage(file: File | null) {
    if (!file) return
    try {
      const reviewPackage = parseVideoReviewPackageJson(await file.text())
      if (!reviewPackage) {
        setMessage('That file is not a TenAceIQ video review file.')
        return
      }

      const preflightQuota = getVideoReviewImportQuotaState(clips, {
        id: reviewPackage.clip.id,
        sizeBytes: estimateVideoReviewPackageBytes(reviewPackage),
      })
      if (!preflightQuota.allowed) {
        setMessage(importQuotaMessage(preflightQuota.reason))
        return
      }

      const blob = await dataUrlToBlob(reviewPackage.video.dataUrl, reviewPackage.video.fileType)
      const importQuota = getVideoReviewImportQuotaState(clips, {
        id: reviewPackage.clip.id,
        sizeBytes: blob.size || reviewPackage.video.sizeBytes,
      })
      if (!importQuota.allowed) {
        setMessage(importQuotaMessage(importQuota.reason))
        return
      }

      const importedClip = normalizeImportedVideoReviewClip({
        ...reviewPackage.clip,
        fileName: reviewPackage.video.fileName || reviewPackage.clip.fileName,
        fileType: blob.type || reviewPackage.video.fileType || reviewPackage.clip.fileType,
        sizeBytes: blob.size || reviewPackage.video.sizeBytes,
      })
      await saveClip(importedClip, blob)
      openClip(importedClip.id, importedClip.status === 'sent' ? 'coach' : 'player')
      if (importedClip.status === 'sent') {
        pushLocalNotification(importedClip, 'clip_sent')
      }
      if (importedClip.status === 'reviewed') {
        pushLocalNotification(importedClip, 'review_returned')
      }
      await loadClips()
      setMessage(importQuota.existingClip
        ? 'Video review file updated the saved clip.'
        : importedClip.status === 'reviewed'
          ? 'Coach feedback added. Open player feedback to watch the marks and practice plan.'
          : 'Video review added. Open coach review to mark the clip and return one focus.')
    } catch {
      setMessage('The video review file could not be added.')
    }
  }

  async function downloadActiveVideo() {
    if (!activeClip) return
    const blob = await readClipBlob(activeClip.id)
    if (!blob) {
      setMessage('The selected clip video is not available on this device.')
      return
    }
    downloadBlob(blob, activeClip.fileName || `${activeClip.title}.webm`)
    setMessage('Video file downloaded.')
  }

  async function copyPracticePlan() {
    if (!practicePlan) return
    try {
      await navigator.clipboard.writeText(practicePlan.copyText)
      setMessage('Practice plan copied.')
    } catch {
      setMessage(practicePlan.copyText)
    }
  }

  function markPracticeDone() {
    if (!activeClip) return
    const record = buildVideoReviewPracticeRecord(activeClip)
    const nextRecords = {
      ...practiceRecords,
      [activeClip.id]: record,
    }
    setPracticeRecords(nextRecords)
    writeLocalPracticeRecords(nextRecords)
    setMessage(`Practice marked done for ${activeClip.title}.`)
  }

  function downloadReviewSummary() {
    if (!activeClip) return
    downloadBlob(
      new Blob([buildVideoReviewSummaryText(activeClip)], { type: 'text/plain;charset=utf-8' }),
      buildVideoReviewSummaryFileName(activeClip),
    )
    setMessage('Review summary downloaded.')
  }

  function markCoachMarkWatched(annotationId: string) {
    if (!activeClip) return
    setWatchedCoachMarks((current) => {
      const currentIds = current[activeClip.id] ?? []
      if (currentIds.includes(annotationId)) return current
      const next = {
        ...current,
        [activeClip.id]: [...currentIds, annotationId],
      }
      writeLocalWatchedCoachMarks(next)
      return next
    })
  }

  function forgetWatchedCoachMark(annotationId: string) {
    if (!activeClip) return
    setWatchedCoachMarks((current) => {
      const currentIds = current[activeClip.id] ?? []
      if (!currentIds.includes(annotationId)) return current
      const nextIds = currentIds.filter((id) => id !== annotationId)
      const next = { ...current }
      if (nextIds.length) {
        next[activeClip.id] = nextIds
      } else {
        delete next[activeClip.id]
      }
      writeLocalWatchedCoachMarks(next)
      return next
    })
  }

  function resetWatchedCoachMarks() {
    if (!activeClip || !watchedCoachMarkCount) return
    setWatchedCoachMarks((current) => {
      if (!current[activeClip.id]?.length) return current
      const next = { ...current }
      delete next[activeClip.id]
      writeLocalWatchedCoachMarks(next)
      return next
    })
    setMessage('Coach marks ready to watch again.')
  }

  function openCoachMark(annotation: VideoAnnotation, label: string) {
    markCoachMarkWatched(annotation.id)
    seekTo(annotation.timestamp)
    setMessage(`Opened ${label} at ${timeLabel(annotation.timestamp)}.`)
  }

  function openFirstReviewMark() {
    if (!firstReviewMark) {
      seekTo(0)
      setMessage('Review opened from the start.')
      return
    }
    openCoachMark(firstReviewMark, 'first coach mark')
  }

  function openLatestCoachMark() {
    if (!latestCoachMark) {
      seekTo(0)
      setMessage('Review opened from the start.')
      return
    }
    openCoachMark(latestCoachMark, 'latest coach mark')
  }

  function openNextUnwatchedCoachMark() {
    const mark = nextUnwatchedCoachMark ?? firstReviewMark
    if (!mark) {
      seekTo(0)
      setMessage('Review opened from the start.')
      return
    }
    openCoachMark(mark, nextUnwatchedCoachMark ? 'next mark' : 'first coach mark')
  }

  function jumpToReviewMark(direction: 'previous' | 'next') {
    if (!activeCoachAnnotations.length) {
      setMessage('Add a timestamp mark first.')
      return
    }
    const margin = 0.25
    const mark = direction === 'next'
      ? activeCoachAnnotations.find((annotation) => annotation.timestamp > currentTime + margin) ?? activeCoachAnnotations[0]
      : [...activeCoachAnnotations].reverse().find((annotation) => annotation.timestamp < currentTime - margin) ?? activeCoachAnnotations[activeCoachAnnotations.length - 1]
    openCoachMark(mark, `${direction} mark`)
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!activeClip || mode !== 'coach' || tool === 'note') return
    const point = getCanvasPoint(event)
    setDrawingPoints([point])
    setPreviewPoints([point])
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingPoints.length || mode !== 'coach') return
    const point = getCanvasPoint(event)
    const nextPoints = tool === 'freehand' ? [...drawingPoints, point] : [drawingPoints[0], point]
    setDrawingPoints(nextPoints)
    setPreviewPoints(nextPoints)
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingPoints.length || mode !== 'coach') return
    const point = getCanvasPoint(event)
    const finalPoints = tool === 'freehand' ? [...drawingPoints, point] : [drawingPoints[0], point]
    setDrawingPoints([])
    setPreviewPoints([])
    void saveAnnotation(finalPoints)
  }

  function seekTo(seconds: number) {
    if (!videoRef.current) return
    const duration = Number.isFinite(videoRef.current.duration) ? videoRef.current.duration : activeClip?.durationSeconds ?? seconds
    const nextTime = Math.max(0, Math.min(duration || seconds, seconds))
    videoRef.current.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  function stepVideo(seconds: number) {
    seekTo((videoRef.current?.currentTime ?? currentTime) + seconds)
  }

  async function deleteAnnotation(annotationId: string) {
    if (!activeClip) return
    if (!canEditMarks) {
      setMessage('Coach marks are view-only in player mode.')
      return
    }
    await updateClip(removeVideoReviewAnnotation(activeClip, annotationId))
    forgetWatchedCoachMark(annotationId)
    setMessage('Timestamp mark removed.')
  }

  async function undoLatestCoachMark() {
    if (!activeClip || !latestCoachMark) {
      setMessage('Add a timestamp mark first.')
      return
    }
    if (!canEditMarks) {
      setMessage('Coach marks are view-only in player mode.')
      return
    }
    await updateClip(removeVideoReviewAnnotation(activeClip, latestCoachMark.id))
    forgetWatchedCoachMark(latestCoachMark.id)
    setMessage('Latest mark removed.')
  }

  function openMobilePanel(panelId: string, nextMode?: VideoReviewRole) {
    if (nextMode) {
      switchMode(nextMode)
      window.setTimeout(() => scrollToVideoReviewPanel(panelId), 0)
      return
    }
    scrollToVideoReviewPanel(panelId)
  }

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.heroPanel}>
          <div className={styles.heroCopy}>
            <span className={styles.kicker}>My Lab video</span>
            <h1 className={styles.title}>Capture the stroke. Mark the moment.</h1>
            <p className={styles.subtitle}>
              Record or upload a tennis clip, send it to your coach, then get timestamped lines, arrows, circles, and notes back for the next practice.
            </p>
            <div className={styles.modeBar} aria-label="Video review mode">
              <button
                type="button"
                className={`${styles.modeButton} ${mode === 'player' ? styles.modeButtonActive : ''}`}
                onClick={() => switchMode('player')}
              >
                Player capture
              </button>
              <button
                type="button"
                className={`${styles.modeButton} ${mode === 'coach' ? styles.modeButtonActive : ''}`}
                onClick={() => switchMode('coach')}
              >
                Coach review{queueSummary.needsReview ? ` (${queueSummary.needsReview})` : coachUnreadNotificationCount ? ` (${coachUnreadNotificationCount})` : ''}
              </button>
            </div>
            <div className={styles.mobileQuickBar} aria-label="Video review shortcuts">
              <button type="button" className={styles.ghostButton} onClick={() => openMobilePanel('video-review-capture', 'player')}>
                Capture
              </button>
              <button type="button" className={styles.ghostButton} onClick={() => openMobilePanel('video-review-library')}>
                Library
              </button>
              <button type="button" className={styles.ghostButton} onClick={() => openMobilePanel('video-review-active')}>
                Review
              </button>
            </div>
          </div>
        </div>
        <aside className={styles.quotaPanel} aria-label="Free storage limits">
          <div>
            <p className={styles.kicker}>{VIDEO_REVIEW_QUOTA.label}</p>
            <h2 className={styles.quotaTitle}>Keep the clip queue light.</h2>
          </div>
          <p className={styles.quotaText}>{VIDEO_REVIEW_QUOTA.storageCue}</p>
          <div className={styles.meter} aria-label={`${quota.percentUsed}% of video space used`}>
            <div className={styles.meterFill} style={{ width: `${quota.percentUsed}%` }} />
          </div>
          <div className={styles.statsGrid}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{quota.usedClips}/{VIDEO_REVIEW_QUOTA.maxClips}</span>
              <span className={styles.statLabel}>clips</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{formatVideoReviewBytes(quota.usedBytes)}</span>
              <span className={styles.statLabel}>stored</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{quota.clipsRemaining}</span>
              <span className={styles.statLabel}>clip slots left</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{formatVideoReviewBytes(quota.bytesRemaining)}</span>
              <span className={styles.statLabel}>space left</span>
            </div>
          </div>
          {cleanupCandidate ? (
            <div className={`${styles.storageTip} ${quota.warningLevel === 'full' ? styles.storageFull : quota.warningLevel === 'tight' ? styles.storageTight : ''}`}>
              <span className={styles.noteTime}>{storageStatusTitle}</span>
              <span>{storageStatusCopy}</span>
              <strong>{cleanupCandidate.title}</strong>
              <span>{formatVideoReviewBytes(cleanupCandidate.sizeBytes)} | {statusLabel(cleanupCandidate.status)}</span>
              <div className={styles.actionRow}>
                <button type="button" className={styles.ghostButton} onClick={() => openClip(cleanupCandidate.id)}>
                  Open clip
                </button>
                {quota.warningLevel !== 'ok' ? (
                  <button type="button" className={styles.dangerButton} onClick={() => void deleteSuggestedCleanupClip()}>
                    Delete suggestion
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </aside>
      </section>

      <section id="video-review-sharing" className={styles.handoffPanel} aria-label="Video review notifications">
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.kicker}>Coach-player sharing</p>
            <h2 className={styles.panelTitle}>{mode === 'coach' ? 'Coach notifications' : 'Player notifications'}</h2>
            <p className={styles.smallText}>
              Review alerts stay here on this device. Copy a link or share a review file when you want to send feedback by text or email.
            </p>
          </div>
          <span className={styles.statusBadge}>{unreadNotificationCount} unread</span>
        </div>
        <div className={styles.shareStrip}>
          <div className={styles.shareCopy}>
            <strong>Share a review file</strong>
            <span>Send the selected clip for review, or add a file returned by your coach.</span>
            <div className={styles.shareSteps} aria-label="Review file steps">
              <span>
                <strong>1</strong>
                Export or share
              </span>
              <span>
                <strong>2</strong>
                Import on the other device
              </span>
              <span>
                <strong>3</strong>
                Review or practice
              </span>
            </div>
          </div>
          <div className={styles.actionRow}>
            <button type="button" className={styles.primaryButton} disabled={!activeClip} onClick={() => void exportActivePackage()}>
              Export review file
            </button>
            <button type="button" className={styles.ghostButton} disabled={!activeClip} onClick={() => void shareActivePackage()}>
              Share review file
            </button>
            <label className={styles.ghostButton}>
              Import review file
              <input
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0] ?? null
                  event.currentTarget.value = ''
                  void importReviewPackage(file)
                }}
                style={{ display: 'none' }}
              />
            </label>
            <button type="button" className={styles.ghostButton} disabled={!activeClip} onClick={() => void downloadActiveVideo()}>
              Download video
            </button>
          </div>
        </div>
        {visibleNotifications.length ? (
          <div className={styles.notificationGrid}>
            {visibleNotifications.slice(0, 4).map((notification) => (
              <button
                type="button"
                key={notification.id}
                className={`${styles.notificationCard} ${notification.readAt ? '' : styles.notificationUnread}`}
                onClick={() => openNotification(notification)}
              >
                <span className={styles.noteTime}>{notification.readAt ? 'Read' : 'New'} | {new Date(notification.createdAt).toLocaleString()}</span>
                <strong>{notification.title}</strong>
                <span>{notification.body}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            {mode === 'coach'
              ? 'Send a clip from Player capture to create the first coach review notification.'
              : 'Coach feedback notifications appear here after a review is sent back.'}
          </div>
        )}
      </section>

      <section className={styles.workflow} aria-label="Video review workflow">
        {VIDEO_REVIEW_WORKFLOW.map((item) => (
          <div key={item.label} className={styles.workflowItem}>
            <span className={styles.workflowLabel}>{item.label}</span>
            <h2 className={styles.workflowTitle}>{item.title}</h2>
            <p className={styles.workflowBody}>{item.body}</p>
          </div>
        ))}
      </section>

      <section id="video-review-workspace" className={styles.workspace}>
        <aside id="video-review-library" className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>{mode === 'coach' ? 'Review queue' : 'Video library'}</h2>
              <p className={styles.smallText}>
                {mode === 'coach'
                  ? `${queueSummary.needsReview} need feedback. ${queueSummary.reviewed} returned.`
                  : `${clips.length} clips in your video lab.`}
              </p>
            </div>
            {mode === 'coach' ? (
              <div className={styles.queueStats} aria-label="Coach queue summary">
                <span className={styles.queueMetric}>
                  <strong>{queueSummary.needsReview}</strong>
                  <span>needs review</span>
                </span>
                <span className={styles.queueMetric}>
                  <strong>{queueSummary.reviewed}</strong>
                  <span>returned</span>
                </span>
                {queueSummary.latestNeedsReview ? (
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={() => {
                      if (queueSummary.latestNeedsReview) openClip(queueSummary.latestNeedsReview.id, 'coach')
                      setStatusFilter('sent')
                    }}
                  >
                    Open next
                  </button>
                ) : null}
              </div>
            ) : (
              <div className={styles.queueStats} aria-label="Player video library summary">
                <span className={styles.queueMetric}>
                  <strong>{queueSummary.privateDrafts}</strong>
                  <span>private</span>
                </span>
                <span className={styles.queueMetric}>
                  <strong>{queueSummary.needsReview}</strong>
                  <span>waiting</span>
                </span>
                <span className={styles.queueMetric}>
                  <strong>{queueSummary.reviewed}</strong>
                  <span>feedback</span>
                </span>
                {latestPlayerClip ? (
                  <button
                    type="button"
                    className={styles.ghostButton}
                    onClick={() => {
                      setClipSearch('')
                      setStatusFilter(latestPlayerClip.status)
                      setStrokeFilter('all')
                      openClip(latestPlayerClip.id, 'player')
                    }}
                  >
                    {latestPlayerClipAction}
                  </button>
                ) : null}
              </div>
            )}
          </div>
          <div className={styles.filterPanel} aria-label="Video library filters">
            <label className={styles.field}>
              <span className={styles.label}>Find clip</span>
              <input
                className={styles.input}
                value={clipSearch}
                onChange={(event) => setClipSearch(event.target.value)}
                placeholder="Search player, coach, stroke, or note"
              />
            </label>
            <div className={styles.quickFilterPanel} aria-label="Quick video filters">
              <span className={styles.label}>Quick filters</span>
              <div className={styles.quickFilterRow}>
                {quickFilters.map((filter) => (
                  <button
                    type="button"
                    key={`${mode}-${filter.status}`}
                    className={`${styles.quickFilterButton} ${statusFilter === filter.status ? styles.quickFilterButtonActive : ''}`}
                    onClick={() => setStatusFilter(filter.status)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.filterGrid}>
              <label className={styles.field}>
                <span className={styles.label}>Status</span>
                <select
                  className={styles.select}
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as VideoReviewStatusFilter)}
                >
                  <option value="all">All statuses</option>
                  <option value="draft">Saved</option>
                  <option value="sent">Coach queue</option>
                  <option value="reviewed">Reviewed</option>
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Stroke</span>
                <select
                  className={styles.select}
                  value={strokeFilter}
                  onChange={(event) => setStrokeFilter(event.target.value as VideoReviewStrokeFilter)}
                >
                  <option value="all">All strokes</option>
                  {VIDEO_REVIEW_STROKES.map((stroke) => (
                    <option key={stroke.id} value={stroke.id}>{stroke.label}</option>
                  ))}
                </select>
              </label>
            </div>
            {hasClipFilters ? (
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => {
                  setClipSearch('')
                  setStatusFilter('all')
                  setStrokeFilter('all')
                }}
              >
                Clear filters
              </button>
            ) : null}
          </div>
          {storageError ? <div className={styles.emptyState}>{storageError}</div> : null}
          {!storageError && !storageReady ? <div className={styles.emptyState}>Opening video lab.</div> : null}
          {storageReady && filteredClips.length === 0 ? (
            <div className={styles.emptyState}>
              {hasClipFilters ? (
                <>
                  <strong>No clips match these filters.</strong>
                  <span>Clear the filters or search by a different player, coach, stroke, or note.</span>
                  <div className={styles.emptyActions} aria-label="Empty video library actions">
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={() => {
                        setClipSearch('')
                        setStatusFilter('all')
                        setStrokeFilter('all')
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                </>
              ) : mode === 'coach' ? (
                <>
                  <strong>{queueSummary.reviewed ? 'All coach clips are returned.' : 'No clips are waiting yet.'}</strong>
                  <span>{queueSummary.reviewed ? 'Open returned clips, add a review file, or wait for the next player send.' : 'Send a clip from Player capture, or add a review file your player shared.'}</span>
                  <div className={styles.emptyActions} aria-label="Empty coach queue actions">
                    {queueSummary.reviewed ? (
                      <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={() => setStatusFilter('reviewed')}
                      >
                        Show returned clips
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={() => openMobilePanel('video-review-capture', 'player')}
                      >
                        Capture a clip
                      </button>
                    )}
                    <button type="button" className={styles.ghostButton} onClick={() => scrollToVideoReviewPanel('video-review-sharing')}>
                      Add review file
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <strong>Start with one clip.</strong>
                  <span>Record or upload a serve, return, rally, or footwork clip, then send it to your coach.</span>
                  <div className={styles.emptyActions} aria-label="Empty player library actions">
                    <button type="button" className={styles.primaryButton} onClick={() => openMobilePanel('video-review-capture', 'player')}>
                      Record first clip
                    </button>
                    <button type="button" className={styles.ghostButton} onClick={() => scrollToVideoReviewPanel('video-review-sharing')}>
                      Add review file
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}
          <div className={styles.clipList} aria-label="Video library clips">
            {filteredClips.map((clip) => {
              const clipCoachMarks = getVideoReviewCoachAnnotations(clip)
              const libraryNextAction = buildLibraryClipNextAction({
                clip,
                mode,
                practiceDone: Boolean(practiceRecords[clip.id]),
                watchedCoachMarkIds: watchedCoachMarks[clip.id] ?? [],
              })
              return (
                <button
                  type="button"
                  key={clip.id}
                  className={`${styles.clipCard} ${activeClip?.id === clip.id ? styles.clipCardActive : ''}`}
                  onClick={() => openClip(clip.id)}
                >
                  <span className={styles.clipTop}>
                    <span>
                      <span className={styles.clipTitle}>{clip.title}</span>
                      <span className={styles.clipMeta}>
                        {clip.playerName} | {getVideoReviewStrokeLabel(clip.stroke)} | {formatVideoReviewDuration(clip.durationSeconds)}
                      </span>
                    </span>
                    <span
                      className={`${styles.statusBadge} ${
                        clip.status === 'reviewed' ? styles.statusReviewed : clip.status === 'sent' ? styles.statusSent : ''
                      }`}
                    >
                      {statusLabel(clip.status)}
                    </span>
                  </span>
                  <span className={styles.clipNextStep}>{libraryNextAction}</span>
                  <span className={styles.clipMeta}>{formatVideoReviewBytes(clip.sizeBytes)} | {formatVideoReviewCoachMarkCount(clipCoachMarks.length)}</span>
                </button>
              )
            })}
          </div>
        </aside>

        <div className={styles.reviewPanel}>
          {mode === 'player' ? (
            <PlayerCapture
              draft={draft}
              setDraft={setDraft}
              selectedFileName={selectedFileName}
              draftFileSizeLabel={draftFileSizeLabel}
              draftPreviewUrl={draftPreviewUrl}
              videoShape={captureVideoShape}
              cameraActive={cameraActive}
              cameraPreviewReady={cameraPreviewReady}
              recording={recording}
              recordingSeconds={recordingSeconds}
              previewVideoRef={previewVideoRef}
              onFileChange={handleFileChange}
              onStartCamera={startCamera}
              onStopCamera={stopCamera}
              onPreviewReady={() => {
                const nextShape = previewVideoRef.current ? readVideoShape(previewVideoRef.current) : null
                if (nextShape) setCaptureVideoShape(nextShape)
                if (cameraPreviewReady) return
                setCameraPreviewReady(true)
                setMessage('Camera ready.')
              }}
              onDraftMetadata={(video) => {
                const nextShape = readVideoShape(video)
                if (nextShape) setCaptureVideoShape(nextShape)
              }}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onRecordAgain={recordAgain}
              onDiscardDraft={() => clearDraftClip()}
              onSave={() => void saveDraft('draft')}
              onSend={() => void saveDraft('sent')}
              quotaFull={quota.usedClips >= VIDEO_REVIEW_QUOTA.maxClips || quota.usedBytes >= VIDEO_REVIEW_QUOTA.maxBytes}
            />
          ) : null}

          <section id="video-review-active" className={styles.reviewGrid} aria-label="Active video review">
            <div>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>{activeClip ? activeClip.title : 'Select a clip'}</h2>
                  <p className={styles.smallText}>
                    {activeClip
                      ? `${activeClip.playerName} to ${activeClip.coachName} | ${getVideoReviewStrokeLabel(activeClip.stroke)}`
                      : 'The review canvas appears after a clip is saved.'}
                  </p>
                </div>
                {activeClip ? (
                  <div className={styles.clipActions}>
                    {activeClip.status === 'draft' ? (
                      <button type="button" className={styles.primaryButton} onClick={() => void sendActiveClip()}>
                        Send to coach
                      </button>
                    ) : null}
                    {activeClip.status !== 'draft' ? (
                      <button type="button" className={styles.ghostButton} onClick={() => void copyHandoffLink(mode === 'coach' ? 'player' : 'coach')}>
                        Copy {mode === 'coach' ? 'player return' : 'coach review'} link
                      </button>
                    ) : null}
                    <button type="button" className={styles.dangerButton} onClick={() => void deleteActiveClip()}>
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>

              {activeClip && activeNextStep ? (
                <section className={styles.nextStepPanel} aria-label="Next video review step">
                  <div className={styles.lessonCopy}>
                    <span className={styles.noteTime}>Next step | {activeNextStep.badge}</span>
                    <h3 className={styles.clipTitle}>{activeNextStep.title}</h3>
                    <p>{activeNextStep.body}</p>
                  </div>
                  <div className={styles.actionRow}>
                    {mode === 'player' && activeClip.status === 'draft' ? (
                      <button type="button" className={styles.primaryButton} onClick={() => void sendActiveClip()}>
                        Send clip
                      </button>
                    ) : null}
                    {mode === 'player' && activeClip.status === 'sent' ? (
                      <>
                        <button type="button" className={styles.primaryButton} onClick={() => void copyHandoffLink('coach')}>
                          Copy coach link
                        </button>
                        <button type="button" className={styles.ghostButton} onClick={() => switchMode('coach')}>
                          Open coach view
                        </button>
                      </>
                    ) : null}
                    {mode === 'player' && activeClip.status === 'reviewed' ? (
                      <>
                        <button type="button" className={styles.primaryButton} onClick={openNextUnwatchedCoachMark}>
                          {nextCoachMarkActionLabel}
                        </button>
                        <button type="button" className={styles.ghostButton} onClick={markPracticeDone}>
                          {activePracticeRecord ? 'Practice again' : 'Mark practiced'}
                        </button>
                      </>
                    ) : null}
                    {mode === 'coach' && activeClip.status === 'sent' ? (
                      <>
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={() => {
                            if (canSendReviewBack) {
                              void sendReview()
                            } else {
                              seekTo(0)
                            }
                          }}
                        >
                          {canSendReviewBack ? 'Return to player' : 'Start review'}
                        </button>
                        <button type="button" className={styles.ghostButton} onClick={() => scrollToVideoReviewPanel('video-review-return-review')}>
                          Next focus
                        </button>
                      </>
                    ) : null}
                    {mode === 'coach' && activeClip.status === 'reviewed' ? (
                      <>
                        <button type="button" className={styles.primaryButton} onClick={() => void copyHandoffLink('player')}>
                          Copy player link
                        </button>
                        <button type="button" className={styles.ghostButton} onClick={() => switchMode('player')}>
                          Open player view
                        </button>
                      </>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {activeClip?.status === 'reviewed' && practicePlan ? (
                <section className={styles.lessonPanel} aria-label="Returned coach lesson">
                  <div className={styles.lessonCopy}>
                    <span className={styles.noteTime}>Coach return</span>
                    <h3 className={styles.clipTitle}>Feedback ready for {activeClip.playerName}</h3>
                    <p>{practicePlan.focus}</p>
                    {latestCoachMark ? (
                      <div className={styles.latestMark}>
                        <span className={styles.noteTime}>Latest coach mark | {timeLabel(latestCoachMark.timestamp)} | {latestCoachMark.tool}</span>
                        <strong>{latestCoachMark.text || 'Coach markup saved at this timestamp.'}</strong>
                      </div>
                    ) : null}
                    {activePracticeRecord ? (
                      <div className={styles.latestMark}>
                        <span className={styles.noteTime}>Practice done | {formatPracticeDoneDate(activePracticeRecord.doneAt)}</span>
                        <strong>{activePracticeRecord.focus}</strong>
                      </div>
                    ) : null}
                  </div>
                  <div className={styles.lessonStats} aria-label="Returned review details">
                    <span>
                      <strong>{activeCoachAnnotations.length}</strong>
                      <span>marks</span>
                    </span>
                    <span>
                      <strong>{formatVideoReviewDuration(activeClip.durationSeconds)}</strong>
                      <span>clip</span>
                    </span>
                    <span>
                      <strong>{getVideoReviewStrokeLabel(activeClip.stroke)}</strong>
                      <span>stroke</span>
                    </span>
                  </div>
                  {mode === 'player' ? (
                    <div className={styles.briefSteps} aria-label="Player practice checklist">
                      {playerFeedbackChecklist.map((item) => (
                        <span key={item.id} className={`${styles.checklistStep} ${item.done ? styles.checklistDone : ''}`}>
                          <strong>{item.label}. {item.title}</strong>
                          <em>{item.body}</em>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {mode === 'player' ? (
                    <div className={`${styles.sendReadiness} ${styles.playerFeedbackFocus}`} aria-label="Player feedback focus">
                      <span className={styles.noteTime}>{activePracticeRecord ? 'Practice logged' : 'Take this to court'}</span>
                      <div className={styles.readinessGrid}>
                        <span className={styles.readinessItem}>
                          <strong>Watch</strong>
                          <em>{playerWatchProgressLabel}</em>
                        </span>
                        <span className={styles.readinessItem}>
                          <strong>Cue</strong>
                          <em>{practicePlan.steps[0]?.title ?? 'One focus'}</em>
                        </span>
                        <span className={`${styles.readinessItem} ${activePracticeRecord ? styles.readinessItemReady : styles.readinessItemTodo}`}>
                          <strong>Practice</strong>
                          <em>{activePracticeRecord ? 'Logged' : 'Mark after session'}</em>
                        </span>
                      </div>
                    </div>
                  ) : null}
                  <div className={styles.actionRow}>
                    <button type="button" className={styles.primaryButton} onClick={openNextUnwatchedCoachMark}>
                      {nextCoachMarkActionLabel}
                    </button>
                    <button type="button" className={styles.ghostButton} disabled={!latestCoachMark} onClick={openLatestCoachMark}>
                      Latest mark
                    </button>
                    <button type="button" className={styles.ghostButton} onClick={() => void copyPracticePlan()}>
                      Copy plan
                    </button>
                    <button type="button" className={styles.ghostButton} onClick={markPracticeDone}>
                      {activePracticeRecord ? 'Practice again' : 'Mark practiced'}
                    </button>
                    <button type="button" className={styles.ghostButton} onClick={downloadReviewSummary}>
                      Download summary
                    </button>
                  </div>
                </section>
              ) : null}

              {mode === 'player' && activeClip?.status === 'sent' ? (
                <section className={styles.coachBriefPanel} aria-label="Coach handoff">
                  <div className={styles.lessonCopy}>
                    <span className={styles.noteTime}>Coach link ready</span>
                    <h3 className={styles.clipTitle}>Send this clip to {activeClip.coachName}</h3>
                    <p>Copy the coach review link or share a review file. Your coach can open the clip, mark the key moment, and send one focus back.</p>
                  </div>
                  <div className={styles.lessonStats} aria-label="Coach handoff details">
                    <span>
                      <strong>Sent</strong>
                      <span>status</span>
                    </span>
                    <span>
                      <strong>{formatVideoReviewDuration(activeClip.durationSeconds)}</strong>
                      <span>clip</span>
                    </span>
                    <span>
                      <strong>{activeClip.coachName}</strong>
                      <span>coach</span>
                    </span>
                  </div>
                  <div className={styles.handoffGuide} aria-label="Coach sharing options">
                    <span className={styles.noteTime}>Share options</span>
                    <div className={styles.handoffChoiceGrid}>
                      <span className={styles.handoffChoice}>
                        <strong>Different phone or computer</strong>
                        <em>Share review file</em>
                      </span>
                      <span className={styles.handoffChoice}>
                        <strong>This device</strong>
                        <em>Copy coach link</em>
                      </span>
                    </div>
                  </div>
                  <div className={styles.actionRow}>
                    <button type="button" className={styles.primaryButton} onClick={() => void copyHandoffLink('coach')}>
                      Copy coach link
                    </button>
                    <button type="button" className={styles.ghostButton} onClick={() => switchMode('coach')}>
                      Preview coach view
                    </button>
                    <button type="button" className={styles.ghostButton} onClick={() => void shareActivePackage()}>
                      Share review file
                    </button>
                  </div>
                </section>
              ) : null}

              {mode === 'coach' && activeClip?.status === 'sent' ? (
                <section className={styles.coachBriefPanel} aria-label="Coach review brief">
                  <div className={styles.lessonCopy}>
                    <span className={styles.noteTime}>Coach queue</span>
                    <h3 className={styles.clipTitle}>Review {activeClip.playerName}&apos;s {getVideoReviewStrokeLabel(activeClip.stroke).toLowerCase()}</h3>
                    <p>{activeClip.playerNote || 'No player note added. Watch the clip, mark the key moment, then return one next focus.'}</p>
                    <div className={styles.intentBrief} aria-label="Clip goal for coach">
                      <strong>{getVideoReviewCaptureIntent(activeClip.captureIntent).label}</strong>
                      <span>{getVideoReviewCaptureIntent(activeClip.captureIntent).coachCopy}</span>
                    </div>
                  </div>
                  <div className={styles.lessonStats} aria-label="Coach review progress">
                    <span>
                      <strong>{activeCoachAnnotations.length}</strong>
                      <span>marks</span>
                    </span>
                    <span>
                      <strong>{formatVideoReviewDuration(activeClip.durationSeconds)}</strong>
                      <span>clip</span>
                    </span>
                    <span>
                      <strong>{canSendReviewBack ? 'Ready' : 'Open'}</strong>
                      <span>focus</span>
                    </span>
                  </div>
                  <div className={styles.briefSteps}>
                    {coachChecklist.map((item) => (
                      <span key={item.id} className={`${styles.checklistStep} ${item.done ? styles.checklistDone : ''}`}>
                        <strong>{item.label}. {item.title}</strong>
                        <em>{item.body}</em>
                      </span>
                    ))}
                  </div>
                  <div className={styles.actionRow}>
                    <button type="button" className={styles.primaryButton} onClick={() => seekTo(0)}>
                      Start review
                    </button>
                    {activeClip.playerNote.trim() ? (
                      <button type="button" className={styles.ghostButton} onClick={usePlayerNoteAsCoachNote}>
                        Use player note
                      </button>
                    ) : null}
                    {activeClip.playerNote.trim() ? (
                      <button type="button" className={styles.ghostButton} onClick={() => void markPlayerQuestion()}>
                        Mark player question
                      </button>
                    ) : null}
                    <button type="button" className={styles.ghostButton} disabled={!activeCoachAnnotations.length} onClick={() => jumpToReviewMark('next')}>
                      Next mark
                    </button>
                  </div>
                </section>
              ) : null}

              {mode === 'coach' && activeClip?.status === 'reviewed' && practicePlan ? (
                <section className={styles.coachBriefPanel} aria-label="Player return handoff">
                  <div className={styles.lessonCopy}>
                    <span className={styles.noteTime}>Review ready to send</span>
                    <h3 className={styles.clipTitle}>Return feedback to {activeClip.playerName}</h3>
                    <p>{practicePlan.focus}</p>
                  </div>
                  <div className={styles.lessonStats} aria-label="Player return details">
                    <span>
                      <strong>{activeCoachAnnotations.length}</strong>
                      <span>marks</span>
                    </span>
                    <span>
                      <strong>{formatVideoReviewDuration(activeClip.durationSeconds)}</strong>
                      <span>clip</span>
                    </span>
                    <span>
                      <strong>{activeClip.playerName}</strong>
                      <span>player</span>
                    </span>
                  </div>
                  <div className={styles.handoffGuide} aria-label="Player sharing options">
                    <span className={styles.noteTime}>Share options</span>
                    <div className={styles.handoffChoiceGrid}>
                      <span className={styles.handoffChoice}>
                        <strong>Different phone or computer</strong>
                        <em>Share returned file</em>
                      </span>
                      <span className={styles.handoffChoice}>
                        <strong>This device</strong>
                        <em>Copy player link</em>
                      </span>
                    </div>
                  </div>
                  <div className={styles.actionRow}>
                    <button type="button" className={styles.primaryButton} onClick={() => void copyHandoffLink('player')}>
                      Copy player link
                    </button>
                    <button type="button" className={styles.ghostButton} onClick={() => switchMode('player')}>
                      Preview player feedback
                    </button>
                    <button type="button" className={styles.ghostButton} onClick={() => void shareActivePackage()}>
                      Share returned file
                    </button>
                  </div>
                </section>
              ) : null}

              <div className={styles.videoStage}>
                {activeBlobUrl ? (
                  <>
                    <video
                      ref={videoRef}
                      className={styles.video}
                      src={activeBlobUrl}
                      controls
                      playsInline
                      onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                      onLoadedMetadata={(event) => setCurrentTime(event.currentTarget.currentTime)}
                    />
                    <canvas
                      ref={canvasRef}
                      className={styles.canvas}
                      aria-label="Coach markup canvas"
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={() => {
                        setDrawingPoints([])
                        setPreviewPoints([])
                      }}
                    />
                  </>
                ) : (
                  <div className={styles.emptyState}>
                    <strong>Choose a clip when you are ready to review.</strong>
                    <span>Record or upload first, then this canvas will hold the video and coach marks.</span>
                    <span className={styles.emptyActions}>
                      <button type="button" className={styles.primaryButton} onClick={() => openMobilePanel('video-review-capture', 'player')}>
                        Start a clip
                      </button>
                      <button type="button" className={styles.ghostButton} onClick={() => openMobilePanel('video-review-library')}>
                        Open library
                      </button>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <aside className={styles.reviewSide}>
              {activeClip ? (
                <div className={styles.panel} key={`${activeClip.id}-details`}>
                  <h3 className={styles.clipTitle}>Clip details</h3>
                  <p className={styles.formHelp}>Fix the context saved with this clip before sharing or reviewing it.</p>
                  <div className={styles.filterGrid}>
                    <label className={styles.field}>
                      <span className={styles.label}>Title</span>
                      <input
                        className={styles.input}
                        defaultValue={activeClip.title}
                        onBlur={(event) => void updateActiveClipDetails({ title: event.currentTarget.value })}
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Stroke</span>
                      <select
                        className={styles.select}
                        value={activeClip.stroke}
                        onChange={(event) => void updateActiveClipDetails({ stroke: event.currentTarget.value as VideoStrokeTag })}
                      >
                        {VIDEO_REVIEW_STROKES.map((stroke) => (
                          <option key={stroke.id} value={stroke.id}>{stroke.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Clip goal</span>
                      <select
                        className={styles.select}
                        value={getVideoReviewCaptureIntent(activeClip.captureIntent).id}
                        onChange={(event) => void updateActiveClipDetails({ captureIntent: event.target.value as VideoReviewCaptureIntent })}
                      >
                        {VIDEO_REVIEW_CAPTURE_INTENTS.map((intent) => (
                          <option key={intent.id} value={intent.id}>{intent.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Player</span>
                      <input
                        className={styles.input}
                        defaultValue={activeClip.playerName}
                        onBlur={(event) => void updateActiveClipDetails({ playerName: event.currentTarget.value })}
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.label}>Coach</span>
                      <input
                        className={styles.input}
                        defaultValue={activeClip.coachName}
                        onBlur={(event) => void updateActiveClipDetails({ coachName: event.currentTarget.value })}
                      />
                    </label>
                  </div>
                  <label className={styles.field}>
                    <span className={styles.label}>Player note</span>
                    <textarea
                      className={styles.textarea}
                      defaultValue={activeClip.playerNote}
                      onBlur={(event) => void updateActiveClipDetails({ playerNote: event.currentTarget.value })}
                    />
                  </label>
                </div>
              ) : null}

              <div className={styles.panel}>
                <h3 className={styles.clipTitle}>Precision playback</h3>
                <p className={styles.formHelp}>Slow the clip down, then step to the exact frame before adding a mark.</p>
                <div className={styles.toolBar} aria-label="Playback speed">
                  {PLAYBACK_SPEEDS.map((speed) => (
                    <button
                      type="button"
                      key={speed}
                      className={`${styles.toolButton} ${playbackRate === speed ? styles.toolButtonActive : ''}`}
                      disabled={!activeClip}
                      onClick={() => setPlaybackRate(speed)}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
                <div className={styles.toolBar} aria-label="Frame step controls">
                  <button type="button" className={styles.ghostButton} disabled={!activeClip} onClick={() => stepVideo(-5)}>
                    -5 sec
                  </button>
                  <button type="button" className={styles.ghostButton} disabled={!activeClip} onClick={() => stepVideo(-FRAME_STEP_SECONDS)}>
                    Back frame
                  </button>
                  <button type="button" className={styles.ghostButton} disabled={!activeClip} onClick={() => stepVideo(FRAME_STEP_SECONDS)}>
                    Next frame
                  </button>
                  <button type="button" className={styles.ghostButton} disabled={!activeClip} onClick={() => stepVideo(5)}>
                    +5 sec
                  </button>
                </div>
                <div className={styles.toolBar} aria-label="Timestamp mark navigation">
                  <button type="button" className={styles.ghostButton} disabled={!activeCoachAnnotations.length} onClick={() => jumpToReviewMark('previous')}>
                    Previous mark
                  </button>
                  <button type="button" className={styles.ghostButton} disabled={!latestCoachMark} onClick={openLatestCoachMark}>
                    Latest mark
                  </button>
                  <button type="button" className={styles.ghostButton} disabled={!activeCoachAnnotations.length} onClick={() => jumpToReviewMark('next')}>
                    Next mark
                  </button>
                </div>
                <p className={styles.formHelp}>Current time {timeLabel(currentTime)}</p>
                {activeCoachAnnotations.length ? (
                  <p className={styles.formHelp}>
                    {currentMarkNumber ? `Mark ${currentMarkNumber} of ${activeCoachAnnotations.length}` : `${activeCoachAnnotations.length} marks saved`}
                  </p>
                ) : null}
              </div>

              {mode === 'coach' ? (
                <>
                  <div id="video-review-coach-tools" className={styles.panel}>
                    <h3 className={styles.clipTitle}>Coach tools</h3>
                    <p className={styles.formHelp}>Pause the video, choose a tool, then draw on the frame.</p>
                    <div className={styles.nextActionStatus} aria-label="Coach next step">
                      <span>{coachActionTitle}</span>
                      <p>{coachActionCopy}</p>
                    </div>
                    <div className={styles.toolBar}>
                      {(['line', 'arrow', 'circle', 'freehand', 'note'] as VideoAnnotationTool[]).map((candidate) => (
                        <button
                          type="button"
                          key={candidate}
                          className={`${styles.toolButton} ${tool === candidate ? styles.toolButtonActive : ''}`}
                          disabled={!activeClip}
                          onClick={() => setTool(candidate)}
                        >
                          {candidate}
                        </button>
                      ))}
                    </div>
                    <div className={styles.toolBar} aria-label="Annotation color">
                      {ANNOTATION_COLORS.map((candidate) => (
                        <button
                          type="button"
                          key={candidate}
                          className={`${styles.toolButton} ${color === candidate ? styles.toolButtonActive : ''}`}
                          disabled={!activeClip}
                          onClick={() => setColor(candidate)}
                          style={{ color: candidate }}
                        >
                          Color
                        </button>
                      ))}
                    </div>
                    <div className={styles.cuePanel} aria-label="Coach quick cues">
                      <span className={styles.label}>Quick cues</span>
                      <div className={styles.cueGrid}>
                        {coachCues.map((cue) => (
                          <button
                            type="button"
                            key={cue.id}
                            className={styles.cueButton}
                            disabled={!activeClip}
                            onClick={() => applyCoachCue(cue)}
                          >
                            <strong>{cue.label}</strong>
                            <span>{cue.note}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className={styles.field}>
                      <span className={styles.label}>Timestamp note</span>
                      <textarea
                        className={styles.textarea}
                        value={coachNote}
                        onChange={(event) => setCoachNote(event.target.value)}
                        placeholder="Contact point is drifting left."
                        disabled={!activeClip}
                      />
                    </label>
                    <div className={styles.actionRow}>
                      <button
                        type="button"
                        className={styles.primaryButton}
                        disabled={!activeClip || !coachNote.trim()}
                        onClick={() => void saveAnnotation([{ x: 0.5, y: 0.5 }], 'note', coachNote)}
                      >
                        Add note at {timeLabel(currentTime)}
                      </button>
                      <button
                        type="button"
                        className={styles.ghostButton}
                        disabled={!latestCoachMark}
                        onClick={() => void undoLatestCoachMark()}
                      >
                        Undo last mark
                      </button>
                    </div>
                  </div>

                  <div id="video-review-return-review" className={styles.panel}>
                    <h3 className={styles.clipTitle}>Return review</h3>
                    <div className={styles.returnCuePanel} aria-label="Coach return focus cues">
                      <span className={styles.label}>Quick focus</span>
                      <div className={styles.returnCueGrid}>
                        {coachCues.map((cue) => (
                          <button
                            type="button"
                            key={`${cue.id}-return`}
                            className={styles.returnCueButton}
                            disabled={!activeClip}
                            onClick={() => applyCoachReturnFocus(cue.summary)}
                          >
                            <strong>{cue.label}</strong>
                            <span>{cue.summary}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className={styles.field}>
                      <span className={styles.label}>Next focus</span>
                      <textarea
                        className={styles.textarea}
                        value={coachSummary}
                        onChange={(event) => setCoachSummary(event.target.value)}
                        placeholder={activeClip?.coachSummary || 'Keep the toss more in front and finish balanced before the next serve basket.'}
                        disabled={!activeClip}
                      />
                    </label>
                    <p className={styles.formHelp}>
                      {returnReviewFocus
                        ? `Ready to return: ${returnReviewFocus}`
                        : 'Add one timestamp mark or write the next focus before sending this review back.'}
                    </p>
                    <div className={`${styles.sendReadiness} ${styles.returnReadiness}`} aria-label="Coach return readiness">
                      <span className={styles.noteTime}>{canSendReviewBack ? 'Ready to return' : 'Return readiness'}</span>
                      <div className={styles.readinessGrid}>
                        <span className={`${styles.readinessItem} ${currentTime > 0.2 ? styles.readinessItemReady : styles.readinessItemTodo}`}>
                          <strong>Watch</strong>
                          <em>{currentTime > 0.2 ? 'Started' : 'Start video'}</em>
                        </span>
                        <span className={`${styles.readinessItem} ${activeCoachAnnotations.length ? styles.readinessItemReady : styles.readinessItemTodo}`}>
                          <strong>Mark</strong>
                          <em>{activeCoachAnnotations.length ? `${activeCoachAnnotations.length} saved` : 'Add mark'}</em>
                        </span>
                        <span className={`${styles.readinessItem} ${returnReviewFocus ? styles.readinessItemReady : styles.readinessItemTodo}`}>
                          <strong>Focus</strong>
                          <em>{returnReviewFocus ? 'Ready' : 'Add focus'}</em>
                        </span>
                        <span className={`${styles.readinessItem} ${canSendReviewBack ? styles.readinessItemReady : styles.readinessItemTodo}`}>
                          <strong>Send</strong>
                          <em>{canSendReviewBack ? 'Ready' : 'Waiting'}</em>
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={!canSendReviewBack}
                      onClick={() => void sendReview()}
                    >
                      Send review back
                    </button>
                  </div>
                </>
              ) : null}

              {activeClip?.status === 'reviewed' && practicePlan ? (
                <div className={styles.panel}>
                  <div className={styles.panelHeader}>
                    <div>
                      <h3 className={styles.clipTitle}>{practicePlan.title}</h3>
                      <p className={styles.formHelp}>{practicePlan.focus}</p>
                    </div>
                    <div className={styles.actionRow}>
                      <button type="button" className={styles.ghostButton} onClick={() => void copyPracticePlan()}>
                        Copy plan
                      </button>
                      <button type="button" className={styles.ghostButton} onClick={markPracticeDone}>
                        {activePracticeRecord ? 'Practice again' : 'Mark practiced'}
                      </button>
                      <button type="button" className={styles.ghostButton} onClick={downloadReviewSummary}>
                        Download summary
                      </button>
                    </div>
                  </div>
                  <div className={styles.practiceList}>
                    {practicePlan.steps.map((step) => (
                      <div key={`${step.label}-${step.title}`} className={styles.practiceStep}>
                        <span className={styles.practiceStepLabel}>{step.label}</span>
                        <span>
                          <strong>{step.title}</strong>
                          <span>{step.body}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className={styles.panel} aria-label="Timeline marks">
                <div className={styles.panelHeader}>
                  <div>
                    <h3 className={styles.clipTitle}>Timeline marks</h3>
                    <p className={styles.formHelp}>
                      {activeCoachAnnotations.length
                        ? `${activeCoachAnnotations.length} ${activeCoachAnnotations.length === 1 ? 'mark' : 'marks'} saved. ${watchedCoachMarkCount} of ${activeCoachAnnotations.length} watched. ${nextCoachMarkCue}`
                        : 'Coach markups will appear here by timestamp.'}
                    </p>
                  </div>
                  {activeCoachAnnotations.length ? (
                    <div className={styles.actionRow}>
                      <button type="button" className={styles.ghostButton} disabled={!nextUnwatchedCoachMark} onClick={openNextUnwatchedCoachMark}>
                        {nextUnwatchedCoachMark && nextUnwatchedCoachMarkNumber ? `Watch Mark ${nextUnwatchedCoachMarkNumber}` : 'All watched'}
                      </button>
                      <button type="button" className={styles.ghostButton} disabled={!firstReviewMark} onClick={openFirstReviewMark}>
                        First mark
                      </button>
                      <button type="button" className={styles.ghostButton} disabled={!latestCoachMark} onClick={openLatestCoachMark}>
                        Latest mark
                      </button>
                      {watchedCoachMarkCount ? (
                        <button type="button" className={styles.ghostButton} onClick={resetWatchedCoachMarks}>
                          Start over
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {activeCoachAnnotations.length ? (
                  <div className={styles.noteList}>
                    {activeCoachAnnotations.map((annotation, index) => {
                      const isVisibleOnVideo = visibleAnnotationIds.has(annotation.id)
                      const isWatched = watchedCoachMarkIds.has(annotation.id)
                      return (
                        <div
                          key={annotation.id}
                          className={`${styles.noteItem} ${isVisibleOnVideo ? styles.noteItemActive : ''}`}
                        >
                          <span className={styles.noteMeta}>
                            <span className={styles.noteNumber}>Mark {index + 1}</span>
                            <span className={styles.noteTime}>{timeLabel(annotation.timestamp)} | {annotation.tool}</span>
                            {isVisibleOnVideo ? <span className={styles.noteNow}>On video now</span> : null}
                            {isWatched ? <span className={styles.noteWatched}>Watched</span> : null}
                          </span>
                          <span>{annotation.text || 'Coach markup'}</span>
                          <span className={styles.noteActions}>
                            <button type="button" className={styles.ghostButton} onClick={() => openCoachMark(annotation, `Mark ${index + 1}`)}>
                              Open
                            </button>
                            {canEditMarks ? (
                              <button type="button" className={styles.dangerButton} onClick={() => void deleteAnnotation(annotation.id)}>
                                Delete
                              </button>
                            ) : (
                              <span className={styles.formHelp}>View only</span>
                            )}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className={styles.formHelp}>Add the first coach note or drawing when you see the key moment.</p>
                )}
              </div>

              {activeClip?.coachSummary ? (
                <div className={styles.toast}>
                  Player feedback: {activeClip.coachSummary}
                </div>
              ) : null}
            </aside>
          </section>
        </div>
      </section>

      {message ? <p className={styles.toast} aria-live="polite">{message}</p> : null}
      <nav className={styles.mobileDock} aria-label="Video review mobile shortcuts">
        <button type="button" onClick={() => openMobilePanel('video-review-capture', 'player')}>
          Capture
        </button>
        <button type="button" onClick={() => openMobilePanel('video-review-library')}>
          Library
        </button>
        <button type="button" onClick={() => openMobilePanel('video-review-active')}>
          Review
        </button>
      </nav>
    </main>
  )
}

function PlayerCapture({
  draft,
  setDraft,
  selectedFileName,
  draftFileSizeLabel,
  draftPreviewUrl,
  videoShape,
  cameraActive,
  cameraPreviewReady,
  recording,
  recordingSeconds,
  previewVideoRef,
  onFileChange,
  onStartCamera,
  onStopCamera,
  onPreviewReady,
  onDraftMetadata,
  onStartRecording,
  onStopRecording,
  onRecordAgain,
  onDiscardDraft,
  onSave,
  onSend,
  quotaFull,
}: {
  draft: DraftState
  setDraft: (draft: DraftState) => void
  selectedFileName: string
  draftFileSizeLabel: string
  draftPreviewUrl: string
  videoShape: VideoReviewVideoShape | null
  cameraActive: boolean
  cameraPreviewReady: boolean
  recording: boolean
  recordingSeconds: number
  previewVideoRef: React.RefObject<HTMLVideoElement | null>
  onFileChange: (file: File | null) => void
  onStartCamera: () => void
  onStopCamera: () => void
  onPreviewReady: () => void
  onDraftMetadata: (video: HTMLVideoElement) => void
  onStartRecording: () => void
  onStopRecording: () => void
  onRecordAgain: () => void
  onDiscardDraft: () => void
  onSave: () => void
  onSend: () => void
  quotaFull: boolean
}) {
  const captureStep = draftPreviewUrl ? 'check' : cameraActive ? 'record' : 'start'
  const playerNoteText = draft.playerNote.trim()
  const orientationLabel = getVideoShapeLabel(videoShape)
  const orientationCopy = getVideoShapeCopy(videoShape)
  const selectedIntent = getVideoReviewCaptureIntent(draft.captureIntent)
  const captureReadyLabel = recording
    ? 'Recording now'
    : draftPreviewUrl
      ? 'Check the clip'
      : cameraActive
        ? cameraPreviewReady
          ? 'Ready to record'
          : 'Opening camera'
        : 'Set up the shot'
  const angleCheck = selectedIntent.id === 'full-court' ? 'Phone sideways' : 'Close-up ok'
  const frameCheck = selectedIntent.id === 'full-court' ? 'Player, ball path, recovery' : 'Grip, contact, finish'
  const captureActionTitle = quotaFull
    ? 'Free space first'
    : draftPreviewUrl
      ? playerNoteText ? 'Ready to save or send' : 'Add one coach question'
      : recording
        ? 'Finish the take'
        : cameraActive
          ? cameraPreviewReady ? 'Start when framed' : 'Camera opening'
          : selectedFileName ? 'Checking clip' : 'Record or upload first'
  const captureActionCopy = quotaFull
    ? 'Delete an old clip before saving another video.'
    : draftPreviewUrl
      ? playerNoteText
        ? 'Play it once, then send it to your coach or keep it private.'
        : 'Add one thing you want your coach to check before sending.'
      : recording
        ? 'Stop recording when the stroke and recovery are captured.'
        : cameraActive
          ? cameraPreviewReady
            ? 'Frame the player and ball path, then start recording.'
            : 'Keep this page open while the camera preview loads.'
          : selectedFileName
            ? 'The preview will open so you can check the clip.'
            : 'Open the camera on court or upload a video from your phone.'

  function applyPlayerNoteCue(note: string) {
    const currentNote = draft.playerNote.trim()
    const nextNote = currentNote.includes(note)
      ? currentNote
      : currentNote
        ? `${currentNote} ${note}`
        : note
    setDraft({ ...draft, playerNote: nextNote.slice(0, 700) })
  }

  function focusPlayerNote() {
    const field = document.getElementById('video-review-player-note')
    field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (field instanceof HTMLTextAreaElement) {
      field.focus()
    }
  }

  return (
    <section id="video-review-capture" className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>Capture or upload</h2>
          <p className={styles.smallText}>Save a private clip or send it into the coach queue.</p>
        </div>
      </div>

      <div className={styles.formGrid}>
        <ol className={styles.captureSteps} aria-label="Capture steps">
          <li className={`${styles.captureStep} ${captureStep === 'start' ? styles.captureStepActive : styles.captureStepDone}`}>
            <span>1</span>
            <strong>Record or upload</strong>
          </li>
          <li className={`${styles.captureStep} ${captureStep === 'check' ? styles.captureStepActive : ''}`}>
            <span>2</span>
            <strong>Check the clip</strong>
          </li>
          <li className={styles.captureStep}>
            <span>3</span>
            <strong>Save or send</strong>
          </li>
        </ol>

        <div className={styles.actionRow}>
          <label className={styles.ghostButton}>
            Upload video
            <input
              type="file"
              accept="video/*"
              capture="environment"
              onChange={(event) => {
                onFileChange(event.target.files?.[0] ?? null)
                event.currentTarget.value = ''
              }}
              style={{ display: 'none' }}
            />
          </label>
          {!cameraActive ? (
            <button type="button" className={styles.ghostButton} onClick={onStartCamera}>
              Open camera
            </button>
          ) : (
            <>
              {!recording ? (
                <button type="button" className={styles.primaryButton} disabled={!cameraPreviewReady} onClick={onStartRecording}>
                  Start recording
                </button>
              ) : (
                <button type="button" className={styles.dangerButton} onClick={onStopRecording}>
                  Stop recording
                </button>
              )}
              <button type="button" className={styles.ghostButton} onClick={onStopCamera}>
                Close camera
              </button>
            </>
          )}
        </div>

        <div className={styles.nextActionStatus} aria-label="Capture next step">
          <span>{captureActionTitle}</span>
          <p>{captureActionCopy}</p>
        </div>

        <div className={styles.orientationPanel} aria-label="Phone recording angle">
          <span className={styles.noteTime}>{orientationLabel}</span>
          <p>{orientationCopy}</p>
        </div>

        <div className={styles.intentPanel} aria-label="Clip goal">
          <div>
            <span className={styles.label}>Clip goal</span>
            <p className={styles.formHelp}>{selectedIntent.playerCopy}</p>
          </div>
          <div className={styles.intentGrid}>
            {VIDEO_REVIEW_CAPTURE_INTENTS.map((intent) => (
              <button
                type="button"
                key={intent.id}
                aria-label={`Choose ${intent.label}`}
                className={`${styles.intentButton} ${draft.captureIntent === intent.id ? styles.intentButtonActive : ''}`}
                onClick={() => setDraft({ ...draft, captureIntent: intent.id })}
              >
                <strong>{intent.label}</strong>
                <span>{intent.id === 'full-court' ? 'Spacing, movement, serve path' : 'Grip, contact, swing path'}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.captureSetup} aria-label="Before recording">
          <span className={styles.noteTime}>{captureReadyLabel}</span>
          <div className={styles.readinessGrid}>
            <span className={styles.readinessItem}>
              <strong>Angle</strong>
              <em>{angleCheck}</em>
            </span>
            <span className={styles.readinessItem}>
              <strong>Frame</strong>
              <em>{frameCheck}</em>
            </span>
            <span className={`${styles.readinessItem} ${playerNoteText ? styles.readinessItemReady : styles.readinessItemTodo}`}>
              <strong>Question</strong>
              <em>{playerNoteText ? 'Ready' : 'Add one cue'}</em>
            </span>
          </div>
        </div>

        {cameraActive ? (
          <div className={styles.cameraPreview}>
            <div className={styles.cameraPreviewFrame}>
              <video
                ref={previewVideoRef}
                autoPlay
                muted
                playsInline
                className={styles.cameraVideo}
                onCanPlay={onPreviewReady}
                onPlaying={onPreviewReady}
                onLoadedMetadata={onPreviewReady}
              />
              {recording ? (
                <span className={styles.recordingBadge}>Recording {formatRecordingTime(recordingSeconds)}</span>
              ) : null}
              {!cameraPreviewReady ? (
                <span className={styles.cameraPreviewStatus}>Starting camera...</span>
              ) : null}
            </div>
            <p className={styles.formHelp}>
              {recording
                ? `Recording ${formatRecordingTime(recordingSeconds)}. Keep the phone steady.`
                : cameraPreviewReady
                  ? 'Frame the stroke, then start recording.'
                  : 'The preview will appear here before recording starts.'}
            </p>
          </div>
        ) : null}

        {draftPreviewUrl ? (
          <section id="video-review-draft-preview" className={styles.draftPreview} aria-label="Draft clip preview">
            <div className={styles.draftPreviewHeader}>
              <div>
                <h3 className={styles.clipTitle}>Check this clip</h3>
                <p className={styles.formHelp}>Play it back before saving or sending it to your coach.</p>
              </div>
              <span className={styles.statusBadge}>{draftFileSizeLabel || 'Not saved yet'}</span>
            </div>
            <video
              className={styles.draftVideo}
              src={draftPreviewUrl}
              controls
              playsInline
              preload="metadata"
              onLoadedMetadata={(event) => onDraftMetadata(event.currentTarget)}
            />
            <p className={styles.draftMeta}>{selectedFileName}</p>
            <div className={styles.sendReadiness} aria-label="Send readiness">
              <span className={styles.noteTime}>{playerNoteText ? 'Ready to send' : 'Almost ready'}</span>
              <div className={styles.readinessGrid}>
                <span className={styles.readinessItem}>
                  <strong>Video</strong>
                  <em>Ready</em>
                </span>
                <span className={styles.readinessItem}>
                  <strong>Goal</strong>
                  <em>{selectedIntent.shortLabel}</em>
                </span>
                <span className={`${styles.readinessItem} ${playerNoteText ? styles.readinessItemReady : styles.readinessItemTodo}`}>
                  <strong>Question</strong>
                  <em>{playerNoteText ? 'Ready' : 'Add one cue'}</em>
                </span>
                <span className={styles.readinessItem}>
                  <strong>Size</strong>
                  <em>{draftFileSizeLabel || 'Not saved yet'}</em>
                </span>
              </div>
            </div>
            <div className={styles.draftCoachNote} aria-label="Draft coach question">
              <span className={styles.noteTime}>{playerNoteText ? 'Coach question ready' : 'Coach question'}</span>
              <p>
                {playerNoteText || 'Add one thing you want your coach to check before you send this.'}
              </p>
              <button type="button" className={styles.ghostButton} onClick={focusPlayerNote}>
                {playerNoteText ? 'Edit note' : 'Add note'}
              </button>
            </div>
            <div className={styles.actionRow}>
              <button type="button" className={styles.primaryButton} disabled={quotaFull} onClick={onSend}>
                Send to coach
              </button>
              <button type="button" className={styles.ghostButton} disabled={quotaFull} onClick={onSave}>
                Save private
              </button>
              <button type="button" className={styles.ghostButton} onClick={onRecordAgain}>
                Record again
              </button>
              <button type="button" className={styles.dangerButton} onClick={onDiscardDraft}>
                Discard clip
              </button>
            </div>
          </section>
        ) : null}

        <div className={styles.statsGrid}>
          <label className={styles.field}>
            <span className={styles.label}>Clip title</span>
            <input
              className={styles.input}
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder="Serve from deuce court"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Stroke</span>
            <select
              className={styles.select}
              value={draft.stroke}
              onChange={(event) => setDraft({ ...draft, stroke: event.target.value as VideoStrokeTag })}
            >
              {VIDEO_REVIEW_STROKES.map((stroke) => (
                <option key={stroke.id} value={stroke.id}>{stroke.label}</option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Player</span>
            <input
              className={styles.input}
              value={draft.playerName}
              onChange={(event) => setDraft({ ...draft, playerName: event.target.value })}
              placeholder="Player name"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Coach</span>
            <input
              className={styles.input}
              value={draft.coachName}
              onChange={(event) => setDraft({ ...draft, coachName: event.target.value })}
              placeholder="Coach name"
            />
          </label>
        </div>

        <div className={styles.noteCuePanel}>
          <div>
            <span className={styles.label}>Ask coach to check</span>
            <p className={styles.formHelp}>Tap a cue or write your own note.</p>
          </div>
          <div className={styles.noteCueGrid}>
            {PLAYER_NOTE_CUES.map((cue) => (
              <button
                type="button"
                key={cue.label}
                className={styles.noteCueButton}
                onClick={() => applyPlayerNoteCue(cue.note)}
                aria-label={`Ask coach to check ${cue.label}`}
              >
                {cue.label}
              </button>
            ))}
          </div>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Player note</span>
          <textarea
            id="video-review-player-note"
            className={styles.textarea}
            value={draft.playerNote}
            onChange={(event) => setDraft({ ...draft, playerNote: event.target.value })}
            placeholder="I want to know if my toss and contact point are in the right place."
          />
        </label>

        {!draftPreviewUrl ? (
          <div className={styles.actionRow}>
            <button type="button" className={styles.ghostButton} disabled={!selectedFileName || quotaFull} onClick={onSave}>
              Save private
            </button>
            <button type="button" className={styles.primaryButton} disabled={!selectedFileName || quotaFull} onClick={onSend}>
              Send to coach
            </button>
            <span className={styles.formHelp}>No clip selected yet.</span>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function pickRecorderMimeType() {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || ''
}
