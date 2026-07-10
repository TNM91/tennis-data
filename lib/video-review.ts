export type VideoReviewRole = 'player' | 'coach'

export type VideoReviewStatus = 'draft' | 'sent' | 'reviewed'

export type VideoStrokeTag =
  | 'serve'
  | 'return'
  | 'forehand'
  | 'backhand'
  | 'volley'
  | 'overhead'
  | 'footwork'
  | 'match-play'

export type VideoAnnotationTool = 'line' | 'arrow' | 'circle' | 'freehand' | 'note'

export type VideoReviewCaptureIntent = 'full-court' | 'technique'

export type VideoAnnotationPoint = {
  x: number
  y: number
}

export type VideoAnnotation = {
  id: string
  clipId: string
  timestamp: number
  tool: VideoAnnotationTool
  color: string
  text: string
  points: VideoAnnotationPoint[]
  createdBy: VideoReviewRole
  createdAt: string
}

export type VideoReviewClip = {
  id: string
  title: string
  playerName: string
  coachName: string
  stroke: VideoStrokeTag
  status: VideoReviewStatus
  createdAt: string
  updatedAt: string
  fileName: string
  fileType: string
  sizeBytes: number
  durationSeconds: number | null
  captureIntent?: VideoReviewCaptureIntent
  playerNote: string
  coachSummary: string
  annotations: VideoAnnotation[]
}

export type VideoReviewQuota = {
  maxClips: number
  maxBytes: number
  label: string
  storageCue: string
}

export type VideoReviewQuotaState = {
  usedBytes: number
  usedClips: number
  bytesRemaining: number
  clipsRemaining: number
  overLimit: boolean
  percentUsed: number
  warningLevel: 'ok' | 'tight' | 'full'
}

export type VideoReviewImportQuotaState = {
  allowed: boolean
  existingClip: boolean
  nextUsedBytes: number
  nextUsedClips: number
  reason: 'clip-limit' | 'storage-limit' | null
}

export type VideoReviewQueueSummary = {
  total: number
  needsReview: number
  reviewed: number
  privateDrafts: number
  latestNeedsReview: VideoReviewClip | null
}

export type VideoReviewStatusFilter = 'all' | VideoReviewStatus

export type VideoReviewStrokeFilter = 'all' | VideoStrokeTag

export type VideoReviewLibraryFilter = {
  role: VideoReviewRole
  query: string
  status: VideoReviewStatusFilter
  stroke: VideoReviewStrokeFilter
}

export type VideoReviewCoachCue = {
  id: string
  label: string
  stroke: VideoStrokeTag | 'all'
  note: string
  summary: string
}

export type VideoReviewPracticeStep = {
  label: string
  title: string
  body: string
}

export type VideoReviewPracticePlan = {
  title: string
  focus: string
  steps: VideoReviewPracticeStep[]
  copyText: string
}

export type VideoReviewCoachChecklistStep = {
  id: 'watch' | 'mark' | 'focus' | 'return'
  label: string
  title: string
  body: string
}

export type VideoReviewCoachChecklistItem = VideoReviewCoachChecklistStep & {
  done: boolean
}

export type VideoReviewPracticeRecord = {
  clipId: string
  doneAt: string
  focus: string
}

export type VideoReviewClipMetadataPatch = Partial<Pick<
  VideoReviewClip,
  'title' | 'playerName' | 'coachName' | 'stroke' | 'captureIntent' | 'playerNote'
>>

export const VIDEO_REVIEW_ROUTE = '/video-review'

export const VIDEO_REVIEW_STORAGE_KEY = 'tenaceiq.videoReview.indexedDb.v1'

export const VIDEO_REVIEW_NOTIFICATION_STORAGE_KEY = 'tenaceiq.videoReview.notifications.v1'

export const VIDEO_REVIEW_PRACTICE_STORAGE_KEY = 'tenaceiq.videoReview.practiceDone.v1'

export const VIDEO_REVIEW_QUOTA: VideoReviewQuota = {
  maxClips: 12,
  maxBytes: 500 * 1024 * 1024,
  label: 'On-court video lab',
  storageCue:
    'Save up to 12 clips or 500 MB on this device. Clear old clips when your review queue gets full.',
}

export const VIDEO_REVIEW_STROKES: Array<{ id: VideoStrokeTag; label: string }> = [
  { id: 'serve', label: 'Serve' },
  { id: 'return', label: 'Return' },
  { id: 'forehand', label: 'Forehand' },
  { id: 'backhand', label: 'Backhand' },
  { id: 'volley', label: 'Volley' },
  { id: 'overhead', label: 'Overhead' },
  { id: 'footwork', label: 'Footwork' },
  { id: 'match-play', label: 'Match play' },
]

export const VIDEO_REVIEW_CAPTURE_INTENTS: Array<{
  id: VideoReviewCaptureIntent
  label: string
  shortLabel: string
  playerCopy: string
  coachCopy: string
}> = [
  {
    id: 'full-court',
    label: 'Full court',
    shortLabel: 'Full court',
    playerCopy: 'Use this for serves, movement, spacing, recovery, and point play. Horizontal usually gives your coach the most useful view.',
    coachCopy: 'Check spacing, court position, recovery, and whether the full stroke shape fits the point.',
  },
  {
    id: 'technique',
    label: 'Technique close-up',
    shortLabel: 'Close-up',
    playerCopy: 'Use this for grip, toss, contact point, swing path, and balance. Portrait works when the player fills the frame.',
    coachCopy: 'Check setup, contact point, swing path, balance, and the one mechanical cue the player can repeat.',
  },
]

export const VIDEO_REVIEW_COACH_CUES: VideoReviewCoachCue[] = [
  {
    id: 'serve-toss-front',
    label: 'Toss in front',
    stroke: 'serve',
    note: 'Toss is drifting back. Release slightly farther in front so contact can stay balanced.',
    summary: 'Serve focus: release the toss farther in front and finish balanced before the next ball.',
  },
  {
    id: 'serve-contact-extension',
    label: 'Reach contact',
    stroke: 'serve',
    note: 'Contact is below full extension. Reach up through the ball before the shoulder turns down.',
    summary: 'Serve focus: reach full extension at contact, then finish without falling off the line.',
  },
  {
    id: 'return-split',
    label: 'Split earlier',
    stroke: 'return',
    note: 'Split step is late. Land as the server makes contact so the first move is already loaded.',
    summary: 'Return focus: land the split on opponent contact and make the first step earlier.',
  },
  {
    id: 'groundstroke-unit-turn',
    label: 'Unit turn',
    stroke: 'all',
    note: 'Shoulders are turning after the bounce. Start the unit turn as soon as the ball leaves the opponent.',
    summary: 'Rally focus: prepare earlier with the shoulders so contact is not rushed.',
  },
  {
    id: 'contact-spacing',
    label: 'Spacing',
    stroke: 'all',
    note: 'Spacing is tight at contact. Use one more adjustment step to keep the swing path clear.',
    summary: 'Next focus: add one more adjustment step so contact stays away from the body.',
  },
  {
    id: 'recovery-base',
    label: 'Recover base',
    stroke: 'all',
    note: 'Recovery pauses after the finish. Recenter right after contact before watching the result.',
    summary: 'Next focus: finish the swing, then recover immediately before tracking the next shot.',
  },
]

export const VIDEO_REVIEW_WORKFLOW = [
  {
    label: 'Capture',
    title: 'Record the stroke on court.',
    body: 'Use your phone camera or upload a clip already saved on the device.',
  },
  {
    label: 'Share',
    title: 'Send the review request.',
    body: 'Add the stroke, player note, and coach name, then send it to your coach or share a review file.',
  },
  {
    label: 'Review',
    title: 'Mark the exact moment.',
    body: 'Coach notes, lines, arrows, circles, and freehand cues stay tied to video timestamps.',
  },
  {
    label: 'Return',
    title: 'Give the player one next focus.',
    body: 'The player sees the coach markup and a clear practice note for the next court session.',
  },
] as const

export const VIDEO_REVIEW_COACH_CHECKLIST: VideoReviewCoachChecklistStep[] = [
  {
    id: 'watch',
    label: '1',
    title: 'Watch the stroke',
    body: 'Play enough of the clip to see the setup, contact, and finish.',
  },
  {
    id: 'mark',
    label: '2',
    title: 'Mark the exact frame',
    body: 'Add one line, arrow, circle, or note at the timestamp that matters.',
  },
  {
    id: 'focus',
    label: '3',
    title: 'Name one next focus',
    body: 'Use the summary box or a timestamp note to keep the return actionable.',
  },
  {
    id: 'return',
    label: '4',
    title: 'Send it back',
    body: 'Return the reviewed clip so the player can practice from the coach mark.',
  },
]

export type VideoReviewNotificationType = 'clip_sent' | 'review_returned'

export type VideoReviewNotification = {
  id: string
  type: VideoReviewNotificationType
  recipientRole: VideoReviewRole
  clipId: string
  title: string
  body: string
  href: string
  readAt: string | null
  createdAt: string
}

export const VIDEO_REVIEW_PACKAGE_KIND = 'tenaceiq.videoReviewPackage'

export const VIDEO_REVIEW_PACKAGE_VERSION = 1

export type VideoReviewTransferPackage = {
  kind: typeof VIDEO_REVIEW_PACKAGE_KIND
  version: typeof VIDEO_REVIEW_PACKAGE_VERSION
  exportedAt: string
  clip: VideoReviewClip
  video: {
    fileName: string
    fileType: string
    sizeBytes: number
    dataUrl: string
  }
}

export function formatVideoReviewBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb < 1024) return `${Math.round(mb * 10) / 10} MB`
  const gb = mb / 1024
  return `${Math.round(gb * 10) / 10} GB`
}

export function formatVideoReviewDuration(seconds: number | null | undefined) {
  if (!Number.isFinite(seconds ?? NaN) || !seconds || seconds <= 0) return 'Clip'
  const total = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(total / 60)
  const remaining = total % 60
  return `${minutes}:${remaining.toString().padStart(2, '0')}`
}

export function getVideoReviewStrokeLabel(stroke: VideoStrokeTag) {
  return VIDEO_REVIEW_STROKES.find((candidate) => candidate.id === stroke)?.label ?? 'Clip'
}

export function getVideoReviewCaptureIntent(intent: VideoReviewCaptureIntent | undefined) {
  return VIDEO_REVIEW_CAPTURE_INTENTS.find((candidate) => candidate.id === intent) ?? VIDEO_REVIEW_CAPTURE_INTENTS[0]
}

export function getVideoReviewCaptureIntentLabel(intent: VideoReviewCaptureIntent | undefined) {
  return getVideoReviewCaptureIntent(intent).label
}

export function getVideoReviewQuotaState(clips: Array<Pick<VideoReviewClip, 'sizeBytes'>>): VideoReviewQuotaState {
  const usedBytes = clips.reduce((total, clip) => total + Math.max(0, clip.sizeBytes || 0), 0)
  const usedClips = clips.length
  const bytesRemaining = Math.max(0, VIDEO_REVIEW_QUOTA.maxBytes - usedBytes)
  const clipsRemaining = Math.max(0, VIDEO_REVIEW_QUOTA.maxClips - usedClips)
  const overLimit = usedBytes > VIDEO_REVIEW_QUOTA.maxBytes || usedClips > VIDEO_REVIEW_QUOTA.maxClips
  const percentUsed = Math.min(100, Math.round((usedBytes / VIDEO_REVIEW_QUOTA.maxBytes) * 100))
  return {
    usedBytes,
    usedClips,
    bytesRemaining,
    clipsRemaining,
    overLimit,
    percentUsed,
    warningLevel: getVideoReviewQuotaWarningLevel({
      overLimit,
      percentUsed,
      clipsRemaining,
      bytesRemaining,
    }),
  }
}

export function getVideoReviewImportQuotaState(
  clips: Array<Pick<VideoReviewClip, 'id' | 'sizeBytes'>>,
  incomingClip: Pick<VideoReviewClip, 'id' | 'sizeBytes'>,
): VideoReviewImportQuotaState {
  const existingClip = clips.find((clip) => clip.id === incomingClip.id)
  const usedBytes = clips.reduce((total, clip) => total + Math.max(0, clip.sizeBytes || 0), 0)
  const nextUsedClips = clips.length + (existingClip ? 0 : 1)
  const nextUsedBytes = usedBytes - (existingClip?.sizeBytes ?? 0) + Math.max(0, incomingClip.sizeBytes || 0)
  const reason = nextUsedClips > VIDEO_REVIEW_QUOTA.maxClips
    ? 'clip-limit'
    : nextUsedBytes > VIDEO_REVIEW_QUOTA.maxBytes
      ? 'storage-limit'
      : null

  return {
    allowed: !reason,
    existingClip: Boolean(existingClip),
    nextUsedBytes,
    nextUsedClips,
    reason,
  }
}

export function estimateVideoReviewPackageBytes(
  reviewPackage: Pick<VideoReviewTransferPackage, 'video'>,
) {
  return Math.max(
    0,
    reviewPackage.video.sizeBytes,
    estimateDataUrlPayloadBytes(reviewPackage.video.dataUrl),
  )
}

export function getVideoReviewQueueSummary(clips: VideoReviewClip[]): VideoReviewQueueSummary {
  const queueClips = clips.filter((clip) => clip.status !== 'draft')
  const needsReview = queueClips.filter((clip) => clip.status === 'sent')
  return {
    total: queueClips.length,
    needsReview: needsReview.length,
    reviewed: queueClips.filter((clip) => clip.status === 'reviewed').length,
    privateDrafts: clips.length - queueClips.length,
    latestNeedsReview: [...needsReview].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ?? null,
  }
}

export function filterVideoReviewClips(clips: VideoReviewClip[], filter: VideoReviewLibraryFilter) {
  const query = filter.query.trim().toLowerCase()
  return clips.filter((clip) => {
    if (filter.role === 'coach' && clip.status === 'draft') return false
    if (filter.status !== 'all' && clip.status !== filter.status) return false
    if (filter.stroke !== 'all' && clip.stroke !== filter.stroke) return false
    if (!query) return true
    return buildVideoReviewSearchText(clip).includes(query)
  })
}

export function getVideoReviewCleanupCandidate(clips: VideoReviewClip[]) {
  if (!clips.length) return null
  return [...clips].sort((left, right) => {
    const leftPriority = getCleanupPriority(left.status)
    const rightPriority = getCleanupPriority(right.status)
    if (leftPriority !== rightPriority) return leftPriority - rightPriority
    if (left.sizeBytes !== right.sizeBytes) return right.sizeBytes - left.sizeBytes
    return Date.parse(left.updatedAt) - Date.parse(right.updatedAt)
  })[0] ?? null
}

export function removeVideoReviewAnnotation(clip: VideoReviewClip, annotationId: string) {
  return {
    ...clip,
    annotations: clip.annotations.filter((annotation) => annotation.id !== annotationId),
  }
}

export function canEditVideoReviewAnnotations(role: VideoReviewRole) {
  return role === 'coach'
}

export function buildVideoReviewReturnFocus(
  clip: Pick<VideoReviewClip, 'annotations' | 'coachSummary'>,
  draftSummary = '',
) {
  return normalizeVideoReviewText(
    draftSummary
      || clip.coachSummary
      || getFirstCoachAnnotationText(clip)
      || '',
    700,
  )
}

export function canReturnVideoReview(clip: VideoReviewClip, draftSummary = '') {
  return Boolean(buildVideoReviewReturnFocus(clip, draftSummary))
}

export function buildVideoReviewCoachChecklistState(
  clip: Pick<VideoReviewClip, 'annotations' | 'coachSummary' | 'status'>,
  draftSummary = '',
  currentTime = 0,
): VideoReviewCoachChecklistItem[] {
  const doneById: Record<VideoReviewCoachChecklistStep['id'], boolean> = {
    watch: currentTime > 0.2,
    mark: getVideoReviewCoachAnnotations(clip).length > 0,
    focus: Boolean(buildVideoReviewReturnFocus(clip, draftSummary)),
    return: clip.status === 'reviewed',
  }

  return VIDEO_REVIEW_COACH_CHECKLIST.map((step) => ({
    ...step,
    done: doneById[step.id],
  }))
}

export function normalizeImportedVideoReviewClip(clip: VideoReviewClip): VideoReviewClip {
  if (clip.status !== 'reviewed' || canReturnVideoReview(clip)) return clip
  return {
    ...clip,
    status: 'sent',
    coachSummary: '',
  }
}

export function getVideoReviewAnnotationSaveStatus(clip: Pick<VideoReviewClip, 'status'>): VideoReviewStatus {
  return clip.status === 'reviewed' ? 'reviewed' : 'sent'
}

export function getVideoReviewAnnotationNotificationType(
  clip: Pick<VideoReviewClip, 'status'>,
): VideoReviewNotificationType | null {
  return clip.status === 'reviewed' ? 'review_returned' : null
}

export function getVideoReviewCoachAnnotations(
  clip: Pick<VideoReviewClip, 'annotations'>,
): VideoAnnotation[] {
  return clip.annotations
    .filter((annotation) => annotation.createdBy === 'coach')
    .sort((left, right) => left.timestamp - right.timestamp)
}

export function formatVideoReviewCoachMarkCount(count: number) {
  return `${count} coach ${count === 1 ? 'mark' : 'marks'}`
}

export function getLatestVideoReviewCoachAnnotation(
  clip: Pick<VideoReviewClip, 'annotations'>,
): VideoAnnotation | null {
  const coachAnnotations = getVideoReviewCoachAnnotations(clip)
  if (!coachAnnotations.length) return null
  return [...coachAnnotations].sort((left, right) => {
    const createdDelta = Date.parse(right.createdAt) - Date.parse(left.createdAt)
    return createdDelta || right.timestamp - left.timestamp
  })[0] ?? null
}

export function buildVideoReviewPracticePlan(clip: VideoReviewClip): VideoReviewPracticePlan {
  const strokeLabel = getVideoReviewStrokeLabel(clip.stroke)
  const focus = clip.coachSummary.trim()
    || getFirstCoachAnnotationText(clip)
    || clip.playerNote.trim()
    || `${strokeLabel} focus from this video review.`
  const steps = getPracticeStepsForStroke(clip.stroke)
  return {
    title: `${strokeLabel} follow-through`,
    focus,
    steps,
    copyText: [
      `${strokeLabel} video review`,
      `Focus: ${focus}`,
      ...steps.map((step) => `${step.label}: ${step.title} - ${step.body}`),
    ].join('\n'),
  }
}

export function buildVideoReviewPracticeRecord(
  clip: VideoReviewClip,
  doneAt = new Date().toISOString(),
): VideoReviewPracticeRecord {
  return {
    clipId: clip.id,
    doneAt,
    focus: buildVideoReviewPracticePlan(clip).focus,
  }
}

export function buildVideoReviewSummaryText(clip: VideoReviewClip) {
  const strokeLabel = getVideoReviewStrokeLabel(clip.stroke)
  const practicePlan = buildVideoReviewPracticePlan(clip)
  const marks = getVideoReviewCoachAnnotations(clip)
  return [
    `TenAceIQ Video Review`,
    ``,
    `Clip: ${clip.title}`,
    `Player: ${clip.playerName}`,
    `Coach: ${clip.coachName}`,
    `Stroke: ${strokeLabel}`,
    `Clip goal: ${getVideoReviewCaptureIntentLabel(clip.captureIntent)}`,
    `Status: ${statusLabelForSummary(clip.status)}`,
    `Duration: ${formatVideoReviewDuration(clip.durationSeconds)}`,
    `Updated: ${formatSummaryDate(clip.updatedAt)}`,
    ``,
    `Player note`,
    clip.playerNote || 'No player note added.',
    ``,
    `Coach feedback`,
    clip.coachSummary || 'No coach summary added.',
    ``,
    `Coach timestamp marks (${marks.length})`,
    marks.length
      ? marks.map((annotation) => `${formatVideoReviewDuration(annotation.timestamp)} | ${annotation.tool} | ${annotation.text || 'Coach markup'}`).join('\n')
      : 'No coach timestamp marks added.',
    ``,
    `Practice plan`,
    `Focus: ${practicePlan.focus}`,
    ...practicePlan.steps.map((step) => `${step.label}. ${step.title}: ${step.body}`),
  ].join('\n')
}

export function buildVideoReviewSummaryFileName(clip: Pick<VideoReviewClip, 'id' | 'title'>) {
  const packageName = buildVideoReviewPackageFileName(clip)
  return packageName.replace('.tenaceiq-video-review.json', '.tenaceiq-video-summary.txt')
}

export function buildVideoReviewPackageExportMessage(recipientRole: VideoReviewRole) {
  return `Review file downloaded. Send it to the ${recipientRole}.`
}

function buildReturnedReviewActionCopy(coachMarkCount: number) {
  return coachMarkCount
    ? `watch ${coachMarkCount} coach ${coachMarkCount === 1 ? 'mark' : 'marks'} and the practice plan`
    : 'read the practice plan'
}

function capitalizeFirst(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value
}

export function buildVideoReviewPackageShareText(
  clip: Pick<VideoReviewClip, 'title' | 'playerName' | 'coachName' | 'stroke' | 'status' | 'annotations'>,
  recipientRole: VideoReviewRole,
) {
  const strokeLabel = getVideoReviewStrokeLabel(clip.stroke).toLowerCase()
  if (recipientRole === 'coach') {
    return [
      `${clip.playerName} sent ${clip.title} for ${strokeLabel} review.`,
      'Open TenAceIQ Video Review, import this review file, add coach marks, then send the reviewed file back.',
    ].join(' ')
  }
  const coachMarkCount = getVideoReviewCoachAnnotations(clip).length
  return [
    `${clip.coachName} returned feedback on ${clip.title}.`,
    `Open TenAceIQ Video Review and import this review file to ${buildReturnedReviewActionCopy(coachMarkCount)}.`,
  ].join(' ')
}

export function buildVideoReviewDeletePrompt(clip: Pick<VideoReviewClip, 'title'>) {
  return `Delete "${clip.title}" from this device? This permanently removes the video and coach marks.`
}

export function applyVideoReviewClipMetadata(
  clip: VideoReviewClip,
  patch: VideoReviewClipMetadataPatch,
  updatedAt: string,
) {
  return {
    ...clip,
    ...patch,
    title: normalizeVideoReviewText(patch.title ?? clip.title, 96) || clip.title,
    playerName: normalizeVideoReviewText(patch.playerName ?? clip.playerName, 80) || 'Player',
    coachName: normalizeVideoReviewText(patch.coachName ?? clip.coachName, 80) || 'Coach',
    captureIntent: patch.captureIntent ?? clip.captureIntent,
    playerNote: normalizeVideoReviewText(patch.playerNote ?? clip.playerNote, 700),
    updatedAt,
  }
}

export function buildVideoReviewHandoffHref(clipId: string, recipientRole: VideoReviewRole) {
  const params = new URLSearchParams({
    mode: recipientRole,
    clip: clipId,
  })
  return `${VIDEO_REVIEW_ROUTE}?${params.toString()}`
}

function buildVideoReviewSearchText(clip: VideoReviewClip) {
  return [
    clip.title,
    clip.playerName,
    clip.coachName,
    getVideoReviewStrokeLabel(clip.stroke),
    getVideoReviewCaptureIntentLabel(clip.captureIntent),
    statusLabelForSearch(clip.status),
    clip.playerNote,
    clip.coachSummary,
    clip.annotations.map((annotation) => annotation.text).join(' '),
  ].join(' ').toLowerCase()
}

function getVideoReviewQuotaWarningLevel(input: Pick<
  VideoReviewQuotaState,
  'bytesRemaining' | 'clipsRemaining' | 'overLimit' | 'percentUsed'
>): VideoReviewQuotaState['warningLevel'] {
  if (input.overLimit || input.percentUsed >= 100 || input.clipsRemaining === 0) return 'full'
  if (input.percentUsed >= 82 || input.clipsRemaining <= 2 || input.bytesRemaining <= 90 * 1024 * 1024) return 'tight'
  return 'ok'
}

function getCleanupPriority(status: VideoReviewStatus) {
  if (status === 'reviewed') return 0
  if (status === 'draft') return 1
  return 2
}

function getFirstCoachAnnotationText(clip: Pick<VideoReviewClip, 'annotations'>) {
  return [...clip.annotations]
    .sort((left, right) => left.timestamp - right.timestamp)
    .find((annotation) => annotation.createdBy === 'coach' && annotation.text.trim())
    ?.text
    .trim()
}

function statusLabelForSearch(status: VideoReviewStatus) {
  if (status === 'reviewed') return 'reviewed feedback returned'
  if (status === 'sent') return 'sent coach queue'
  return 'draft saved private'
}

function statusLabelForSummary(status: VideoReviewStatus) {
  if (status === 'reviewed') return 'Reviewed'
  if (status === 'sent') return 'Coach queue'
  return 'Saved'
}

function formatSummaryDate(value: string) {
  if (Number.isNaN(Date.parse(value))) return value
  return new Date(value).toISOString()
}

function getPracticeStepsForStroke(stroke: VideoStrokeTag): VideoReviewPracticeStep[] {
  if (stroke === 'serve') {
    return [
      {
        label: '1',
        title: 'Shadow the shape',
        body: 'Make 10 slow rehearsals with the toss arm and finish balanced before hitting balls.',
      },
      {
        label: '2',
        title: 'Basket check',
        body: 'Hit 12 serves at half speed and hold the finish for two seconds after contact.',
      },
      {
        label: '3',
        title: 'Pressure rep',
        body: 'Play first serve in from deuce and ad until you make 6 of 10 with the same cue.',
      },
    ]
  }

  if (stroke === 'return') {
    return [
      {
        label: '1',
        title: 'Split timing',
        body: 'Call split as the server contacts the ball, then land before the first move.',
      },
      {
        label: '2',
        title: 'Short block set',
        body: 'Block 15 returns crosscourt with a compact swing and reset after each contact.',
      },
      {
        label: '3',
        title: 'Target game',
        body: 'Score one point for every return that starts neutral or better in the first four balls.',
      },
    ]
  }

  if (stroke === 'footwork') {
    return [
      {
        label: '1',
        title: 'First step',
        body: 'React to a hand feed and make the first recovery step before tracking the result.',
      },
      {
        label: '2',
        title: 'Adjustment set',
        body: 'Hit 20 balls with a clear small step before contact, then call balanced or rushed.',
      },
      {
        label: '3',
        title: 'Recover pattern',
        body: 'Play 10 live points where the goal is recovering before the opponent contacts the ball.',
      },
    ]
  }

  return [
    {
      label: '1',
      title: 'Rehearse the cue',
      body: 'Make 10 slow shadow swings with the exact coach cue before adding ball speed.',
    },
    {
      label: '2',
      title: 'Controlled reps',
      body: 'Hit 20 controlled balls and rate each contact as early, on time, or late.',
    },
    {
      label: '3',
      title: 'Live transfer',
      body: 'Play a short target game and only count points where the cue appears under pressure.',
    },
  ]
}

function normalizeVideoReviewText(value: string, maxLength: number) {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

function estimateDataUrlPayloadBytes(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex < 0) return dataUrl.length
  const payload = dataUrl.slice(commaIndex + 1)
  if (!payload) return 0
  if (!dataUrl.slice(0, commaIndex).includes(';base64')) return payload.length
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0
  return Math.max(0, Math.ceil((payload.length * 3) / 4) - padding)
}

export function buildVideoReviewNotification(input: {
  id: string
  type: VideoReviewNotificationType
  clip: Pick<VideoReviewClip, 'id' | 'title' | 'playerName' | 'coachName' | 'stroke' | 'annotations'>
  createdAt: string
}): VideoReviewNotification {
  const recipientRole: VideoReviewRole = input.type === 'clip_sent' ? 'coach' : 'player'
  const strokeLabel = getVideoReviewStrokeLabel(input.clip.stroke).toLowerCase()
  const coachMarkCount = getVideoReviewCoachAnnotations(input.clip).length
  return {
    id: input.id,
    type: input.type,
    recipientRole,
    clipId: input.clip.id,
    title: input.type === 'clip_sent' ? 'Video ready for coach review' : 'Coach video feedback ready',
    body: input.type === 'clip_sent'
      ? `${input.clip.playerName} sent ${input.clip.title} for ${strokeLabel} review.`
      : `${input.clip.coachName} returned feedback on ${input.clip.title}. ${capitalizeFirst(buildReturnedReviewActionCopy(coachMarkCount))}.`,
    href: buildVideoReviewHandoffHref(input.clip.id, recipientRole),
    readAt: null,
    createdAt: input.createdAt,
  }
}

export function upsertVideoReviewNotification(
  notifications: VideoReviewNotification[],
  notification: VideoReviewNotification,
) {
  return [
    notification,
    ...notifications.filter((item) => item.id !== notification.id),
  ].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
}

export function markVideoReviewNotificationRead(
  notifications: VideoReviewNotification[],
  notificationId: string,
  readAt: string,
) {
  return notifications.map((notification) => (
    notification.id === notificationId
      ? { ...notification, readAt }
      : notification
  ))
}

export function removeVideoReviewClipNotifications(
  notifications: VideoReviewNotification[],
  clipId: string,
) {
  return notifications.filter((notification) => notification.clipId !== clipId)
}

export function buildVideoReviewPackageFileName(clip: Pick<VideoReviewClip, 'id' | 'title'>) {
  const slug = clip.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 54)
    || 'video-review'
  return `${slug}-${clip.id.slice(-8)}.tenaceiq-video-review.json`
}

export function parseVideoReviewPackageJson(contents: string): VideoReviewTransferPackage | null {
  try {
    const parsed = JSON.parse(contents) as unknown
    return isVideoReviewTransferPackage(parsed) ? parsed : null
  } catch {
    return null
  }
}

function isVideoReviewTransferPackage(value: unknown): value is VideoReviewTransferPackage {
  if (!isRecord(value)) return false
  if (value.kind !== VIDEO_REVIEW_PACKAGE_KIND || value.version !== VIDEO_REVIEW_PACKAGE_VERSION) return false
  if (typeof value.exportedAt !== 'string' || Number.isNaN(Date.parse(value.exportedAt))) return false
  if (!isVideoReviewClip(value.clip)) return false
  if (!isRecord(value.video)) return false
  return (
    typeof value.video.fileName === 'string'
    && typeof value.video.fileType === 'string'
    && typeof value.video.sizeBytes === 'number'
    && Number.isFinite(value.video.sizeBytes)
    && value.video.sizeBytes >= 0
    && typeof value.video.dataUrl === 'string'
    && value.video.dataUrl.startsWith('data:')
  )
}

function isVideoReviewClip(value: unknown): value is VideoReviewClip {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.playerName === 'string'
    && typeof value.coachName === 'string'
    && isVideoStrokeTag(value.stroke)
    && isVideoReviewStatus(value.status)
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string'
    && typeof value.fileName === 'string'
    && typeof value.fileType === 'string'
    && typeof value.sizeBytes === 'number'
    && Number.isFinite(value.sizeBytes)
    && (typeof value.durationSeconds === 'number' || value.durationSeconds === null)
    && (value.captureIntent === undefined || isVideoReviewCaptureIntent(value.captureIntent))
    && typeof value.playerNote === 'string'
    && typeof value.coachSummary === 'string'
    && Array.isArray(value.annotations)
    && value.annotations.every(isVideoAnnotation)
  )
}

function isVideoAnnotation(value: unknown): value is VideoAnnotation {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string'
    && typeof value.clipId === 'string'
    && typeof value.timestamp === 'number'
    && Number.isFinite(value.timestamp)
    && isVideoAnnotationTool(value.tool)
    && typeof value.color === 'string'
    && typeof value.text === 'string'
    && Array.isArray(value.points)
    && value.points.every(isVideoAnnotationPoint)
    && (value.createdBy === 'player' || value.createdBy === 'coach')
    && typeof value.createdAt === 'string'
  )
}

function isVideoAnnotationPoint(value: unknown): value is VideoAnnotationPoint {
  return (
    isRecord(value)
    && typeof value.x === 'number'
    && Number.isFinite(value.x)
    && typeof value.y === 'number'
    && Number.isFinite(value.y)
  )
}

function isVideoReviewStatus(value: unknown): value is VideoReviewStatus {
  return value === 'draft' || value === 'sent' || value === 'reviewed'
}

function isVideoReviewCaptureIntent(value: unknown): value is VideoReviewCaptureIntent {
  return value === 'full-court' || value === 'technique'
}

function isVideoStrokeTag(value: unknown): value is VideoStrokeTag {
  return VIDEO_REVIEW_STROKES.some((stroke) => stroke.id === value)
}

function isVideoAnnotationTool(value: unknown): value is VideoAnnotationTool {
  return value === 'line' || value === 'arrow' || value === 'circle' || value === 'freehand' || value === 'note'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}
