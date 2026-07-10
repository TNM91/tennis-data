import { describe, expect, it } from 'vitest'
import {
  applyVideoReviewClipMetadata,
  VIDEO_REVIEW_COACH_CUES,
  VIDEO_REVIEW_PACKAGE_KIND,
  VIDEO_REVIEW_PACKAGE_VERSION,
  VIDEO_REVIEW_QUOTA,
  buildVideoReviewCoachChecklistState,
  buildVideoReviewPracticePlan,
  buildVideoReviewPracticeRecord,
  buildVideoReviewPackageFileName,
  buildVideoReviewPackageExportMessage,
  buildVideoReviewPackageShareText,
  buildVideoReviewDeletePrompt,
  buildVideoReviewReturnFocus,
  buildVideoReviewSummaryFileName,
  buildVideoReviewSummaryText,
  buildVideoReviewHandoffHref,
  buildVideoReviewNotification,
  canEditVideoReviewAnnotations,
  canReturnVideoReview,
  estimateVideoReviewPackageBytes,
  formatVideoReviewBytes,
  formatVideoReviewDuration,
  filterVideoReviewClips,
  getVideoReviewCleanupCandidate,
  getVideoReviewAnnotationNotificationType,
  getVideoReviewAnnotationSaveStatus,
  getVideoReviewCoachAnnotations,
  getVideoReviewImportQuotaState,
  getLatestVideoReviewCoachAnnotation,
  getVideoReviewQuotaState,
  getVideoReviewQueueSummary,
  getVideoReviewStrokeLabel,
  formatVideoReviewCoachMarkCount,
  markVideoReviewNotificationRead,
  normalizeImportedVideoReviewClip,
  parseVideoReviewPackageJson,
  removeVideoReviewClipNotifications,
  removeVideoReviewAnnotation,
  upsertVideoReviewNotification,
  type VideoReviewClip,
} from '../video-review'

describe('video review product model', () => {
  const baseClip: VideoReviewClip = {
    id: 'clip-base',
    title: 'Base clip',
    playerName: 'Player A',
    coachName: 'Coach B',
    stroke: 'serve',
    status: 'draft',
    createdAt: '2026-07-09T12:00:00.000Z',
    updatedAt: '2026-07-09T12:00:00.000Z',
    fileName: 'serve.webm',
    fileType: 'video/webm',
    sizeBytes: 100,
    durationSeconds: 8,
    playerNote: '',
    coachSummary: '',
    annotations: [],
  }

  it('formats video storage for player and coach quota reads', () => {
    expect(formatVideoReviewBytes(0)).toBe('0 MB')
    expect(formatVideoReviewBytes(2.5 * 1024 * 1024)).toBe('2.5 MB')
    expect(formatVideoReviewBytes(1.25 * 1024 * 1024 * 1024)).toBe('1.3 GB')
  })

  it('formats clip duration for timestamped review', () => {
    expect(formatVideoReviewDuration(null)).toBe('Clip')
    expect(formatVideoReviewDuration(8)).toBe('0:08')
    expect(formatVideoReviewDuration(74.4)).toBe('1:14')
  })

  it('calculates free local quota state', () => {
    const clips = [
      { sizeBytes: 120 * 1024 * 1024 },
      { sizeBytes: 80 * 1024 * 1024 },
    ]

    const state = getVideoReviewQuotaState(clips)

    expect(state.usedClips).toBe(2)
    expect(state.usedBytes).toBe(200 * 1024 * 1024)
    expect(state.clipsRemaining).toBe(VIDEO_REVIEW_QUOTA.maxClips - 2)
    expect(state.overLimit).toBe(false)
  })

  it('flags local quota overages before paid storage is needed', () => {
    const clips = Array.from({ length: VIDEO_REVIEW_QUOTA.maxClips + 1 }, () => ({ sizeBytes: 1 }))

    expect(getVideoReviewQuotaState(clips).overLimit).toBe(true)
    expect(getVideoReviewQuotaState(clips).warningLevel).toBe('full')
    expect(getVideoReviewStrokeLabel('match-play')).toBe('Match play')
  })

  it('warns before free local video storage is full', () => {
    const clips = Array.from({ length: VIDEO_REVIEW_QUOTA.maxClips - 1 }, () => ({ sizeBytes: 8 * 1024 * 1024 }))

    const state = getVideoReviewQuotaState(clips)

    expect(state.warningLevel).toBe('tight')
    expect(state.clipsRemaining).toBe(1)
  })

  it('allows returned packages to update an existing clip without using another slot', () => {
    const clips = Array.from({ length: VIDEO_REVIEW_QUOTA.maxClips }, (_, index) => ({
      id: `clip-${index}`,
      sizeBytes: 8 * 1024 * 1024,
    }))

    const importState = getVideoReviewImportQuotaState(clips, {
      id: 'clip-3',
      sizeBytes: 10 * 1024 * 1024,
    })

    expect(importState.allowed).toBe(true)
    expect(importState.existingClip).toBe(true)
    expect(importState.nextUsedClips).toBe(VIDEO_REVIEW_QUOTA.maxClips)
  })

  it('blocks imported packages that would exceed free local limits', () => {
    const fullClipLibrary = Array.from({ length: VIDEO_REVIEW_QUOTA.maxClips }, (_, index) => ({
      id: `clip-${index}`,
      sizeBytes: 1,
    }))
    const nearlyFullStorage = [
      { id: 'clip-existing', sizeBytes: VIDEO_REVIEW_QUOTA.maxBytes - 10 },
    ]

    expect(getVideoReviewImportQuotaState(fullClipLibrary, {
      id: 'clip-new',
      sizeBytes: 1,
    }).reason).toBe('clip-limit')

    expect(getVideoReviewImportQuotaState(nearlyFullStorage, {
      id: 'clip-new',
      sizeBytes: 20,
    }).reason).toBe('storage-limit')
  })

  it('estimates package bytes from the embedded data URL before import decode', () => {
    const reviewPackage = {
      video: {
        fileName: 'serve.webm',
        fileType: 'video/webm',
        sizeBytes: 2,
        dataUrl: 'data:video/webm;base64,QUJDRA==',
      },
    }

    expect(estimateVideoReviewPackageBytes(reviewPackage)).toBe(4)
  })

  it('builds local handoff links and notifications for player and coach', () => {
    const clip = {
      id: 'clip-1',
      title: 'Deuce court serve',
      playerName: 'Player A',
      coachName: 'Coach B',
      stroke: 'serve' as const,
      annotations: [
        {
          id: 'coach-mark',
          clipId: 'clip-1',
          timestamp: 4,
          tool: 'note' as const,
          color: '#9be11d',
          text: 'Finish through contact.',
          points: [{ x: 0.5, y: 0.5 }],
          createdBy: 'coach' as const,
          createdAt: '2026-07-09T12:04:00.000Z',
        },
      ],
    }

    const sent = buildVideoReviewNotification({
      id: 'notice-1',
      type: 'clip_sent',
      clip,
      createdAt: '2026-07-09T12:00:00.000Z',
    })
    const returned = buildVideoReviewNotification({
      id: 'notice-2',
      type: 'review_returned',
      clip,
      createdAt: '2026-07-09T12:05:00.000Z',
    })
    const returnedWithoutMarks = buildVideoReviewNotification({
      id: 'notice-3',
      type: 'review_returned',
      clip: { ...clip, annotations: [] },
      createdAt: '2026-07-09T12:06:00.000Z',
    })

    expect(buildVideoReviewHandoffHref('clip-1', 'coach')).toBe('/video-review?mode=coach&clip=clip-1')
    expect(sent.recipientRole).toBe('coach')
    expect(sent.body).toContain('Player A sent Deuce court serve')
    expect(returned.recipientRole).toBe('player')
    expect(returned.body).toContain('Watch 1 coach mark and the practice plan.')
    expect(returnedWithoutMarks.body).toContain('Read the practice plan.')
    expect(returned.href).toBe('/video-review?mode=player&clip=clip-1')
  })

  it('keeps local handoff notifications deduped and readable', () => {
    const notification = buildVideoReviewNotification({
      id: 'notice-1',
      type: 'clip_sent',
      clip: {
        id: 'clip-1',
        title: 'Serve review',
        playerName: 'Player A',
        coachName: 'Coach B',
        stroke: 'serve',
        annotations: [],
      },
      createdAt: '2026-07-09T12:00:00.000Z',
    })

    const upserted = upsertVideoReviewNotification([notification], {
      ...notification,
      body: 'Updated',
      createdAt: '2026-07-09T12:02:00.000Z',
    })

    expect(upserted).toHaveLength(1)
    expect(upserted[0].body).toBe('Updated')
    expect(markVideoReviewNotificationRead(upserted, 'notice-1', 'now')[0].readAt).toBe('now')
  })

  it('removes stale notifications when a local clip is deleted', () => {
    const notifications = [
      buildVideoReviewNotification({
        id: 'sent:clip-1',
        type: 'clip_sent',
        clip: {
          id: 'clip-1',
          title: 'Serve review',
          playerName: 'Player A',
          coachName: 'Coach B',
          stroke: 'serve',
          annotations: [],
        },
        createdAt: '2026-07-09T12:00:00.000Z',
      }),
      buildVideoReviewNotification({
        id: 'returned:clip-1',
        type: 'review_returned',
        clip: {
          id: 'clip-1',
          title: 'Serve review',
          playerName: 'Player A',
          coachName: 'Coach B',
          stroke: 'serve',
          annotations: [],
        },
        createdAt: '2026-07-09T12:05:00.000Z',
      }),
      buildVideoReviewNotification({
        id: 'sent:clip-2',
        type: 'clip_sent',
        clip: {
          id: 'clip-2',
          title: 'Return review',
          playerName: 'Player A',
          coachName: 'Coach B',
          stroke: 'return',
          annotations: [],
        },
        createdAt: '2026-07-09T12:10:00.000Z',
      }),
    ]

    expect(removeVideoReviewClipNotifications(notifications, 'clip-1').map((notification) => notification.clipId)).toEqual(['clip-2'])
  })

  it('builds and validates free video review package files', () => {
    const clip = {
      id: 'clip-serve-12345678',
      title: 'Deuce Court Serve!',
      playerName: 'Player A',
      coachName: 'Coach B',
      stroke: 'serve',
      status: 'reviewed',
      createdAt: '2026-07-09T12:00:00.000Z',
      updatedAt: '2026-07-09T12:05:00.000Z',
      fileName: 'serve.webm',
      fileType: 'video/webm',
      sizeBytes: 123,
      durationSeconds: 8,
      playerNote: 'Check toss.',
      coachSummary: 'Finish balanced.',
      annotations: [],
    } as const

    const parsed = parseVideoReviewPackageJson(JSON.stringify({
      kind: VIDEO_REVIEW_PACKAGE_KIND,
      version: VIDEO_REVIEW_PACKAGE_VERSION,
      exportedAt: '2026-07-09T12:06:00.000Z',
      clip,
      video: {
        fileName: 'serve.webm',
        fileType: 'video/webm',
        sizeBytes: 123,
        dataUrl: 'data:video/webm;base64,AAAA',
      },
    }))

    expect(buildVideoReviewPackageFileName(clip)).toBe('deuce-court-serve-12345678.tenaceiq-video-review.json')
    expect(parsed?.clip.coachSummary).toBe('Finish balanced.')
  })

  it('builds role-specific package share instructions', () => {
    const coachText = buildVideoReviewPackageShareText({
      ...baseClip,
      title: 'Serve review',
      playerName: 'Player A',
      coachName: 'Coach B',
      stroke: 'serve',
      status: 'sent',
    }, 'coach')
    const playerText = buildVideoReviewPackageShareText({
      ...baseClip,
      title: 'Serve review',
      playerName: 'Player A',
      coachName: 'Coach B',
      stroke: 'serve',
      status: 'reviewed',
      annotations: [
        {
          id: 'coach-mark',
          clipId: baseClip.id,
          timestamp: 4,
          tool: 'note',
          color: '#9be11d',
          text: 'Finish through contact.',
          points: [{ x: 0.5, y: 0.5 }],
          createdBy: 'coach',
          createdAt: '2026-07-09T12:02:00.000Z',
        },
      ],
    }, 'player')
    const playerTextWithoutMarks = buildVideoReviewPackageShareText({
      ...baseClip,
      title: 'Serve review',
      playerName: 'Player A',
      coachName: 'Coach B',
      stroke: 'serve',
      status: 'reviewed',
      annotations: [],
    }, 'player')

    expect(coachText).toContain('Player A sent Serve review for serve review.')
    expect(coachText).toContain('import this review file')
    expect(playerText).toContain('Coach B returned feedback on Serve review.')
    expect(playerText).toContain('watch 1 coach mark and the practice plan')
    expect(playerTextWithoutMarks).toContain('read the practice plan')
  })

  it('builds role-specific package export next steps', () => {
    expect(buildVideoReviewPackageExportMessage('coach')).toBe('Review file downloaded. Send it to the coach.')
    expect(buildVideoReviewPackageExportMessage('player')).toBe('Review file downloaded. Send it to the player.')
  })

  it('builds a clear local delete confirmation', () => {
    expect(buildVideoReviewDeletePrompt({ title: 'Deuce serve review' })).toBe(
      'Delete "Deuce serve review" from this device? This permanently removes the video and coach marks.',
    )
  })

  it('builds a complete portable review summary', () => {
    const clip: VideoReviewClip = {
      ...baseClip,
      id: 'clip-summary-12345678',
      title: 'Deuce serve review',
      status: 'reviewed',
      coachSummary: 'Keep the toss in front.',
      playerNote: 'Check balance.',
      annotations: [
        {
          id: 'player-question',
          clipId: baseClip.id,
          timestamp: 1,
          tool: 'note',
          color: '#74beff',
          text: 'Player asked about balance.',
          points: [{ x: 0.5, y: 0.5 }],
          createdBy: 'player',
          createdAt: '2026-07-09T12:00:00.000Z',
        },
        {
          id: 'mark-2',
          clipId: baseClip.id,
          timestamp: 5,
          tool: 'note',
          color: '#74beff',
          text: 'Recover after contact.',
          points: [{ x: 0.5, y: 0.5 }],
          createdBy: 'coach',
          createdAt: '2026-07-09T12:02:00.000Z',
        },
        {
          id: 'mark-1',
          clipId: baseClip.id,
          timestamp: 2,
          tool: 'line',
          color: '#9be11d',
          text: 'Contact point.',
          points: [{ x: 0.4, y: 0.3 }],
          createdBy: 'coach',
          createdAt: '2026-07-09T12:01:00.000Z',
        },
      ],
    }

    const summary = buildVideoReviewSummaryText(clip)

    expect(summary).toContain('TenAceIQ Video Review')
    expect(summary).toContain('Clip: Deuce serve review')
    expect(summary).toContain('Clip goal: Full court')
    expect(summary).toContain('Coach feedback\nKeep the toss in front.')
    expect(summary).toContain('Coach timestamp marks (2)')
    expect(summary).not.toContain('Player asked about balance.')
    expect(summary.indexOf('0:02 | line')).toBeLessThan(summary.indexOf('0:05 | note'))
    expect(summary).toContain('Practice plan')
    expect(buildVideoReviewSummaryFileName(clip)).toBe('deuce-serve-review-12345678.tenaceiq-video-summary.txt')

    const playerOnlySummary = buildVideoReviewSummaryText({
      ...clip,
      coachSummary: '',
      annotations: [clip.annotations[0]],
    })
    expect(playerOnlySummary).toContain('Coach timestamp marks (0)\nNo coach timestamp marks added.')
  })

  it('rejects malformed video review package files', () => {
    expect(parseVideoReviewPackageJson('not json')).toBeNull()
    expect(parseVideoReviewPackageJson(JSON.stringify({
      kind: VIDEO_REVIEW_PACKAGE_KIND,
      version: VIDEO_REVIEW_PACKAGE_VERSION,
      exportedAt: 'bad-date',
      clip: {},
      video: {},
    }))).toBeNull()
  })

  it('filters the local video library by role, status, stroke, and search text', () => {
    const clips: VideoReviewClip[] = [
      { ...baseClip, id: 'draft-1', title: 'Private serve draft' },
      { ...baseClip, id: 'sent-1', title: 'Forehand shape', stroke: 'forehand', status: 'sent', playerNote: 'Racket path check' },
      { ...baseClip, id: 'reviewed-1', title: 'Return split', stroke: 'return', status: 'reviewed', coachSummary: 'Earlier split step' },
    ]

    expect(filterVideoReviewClips(clips, {
      role: 'coach',
      query: '',
      status: 'all',
      stroke: 'all',
    }).map((clip) => clip.id)).toEqual(['sent-1', 'reviewed-1'])

    expect(filterVideoReviewClips(clips, {
      role: 'player',
      query: 'split',
      status: 'reviewed',
      stroke: 'return',
    }).map((clip) => clip.id)).toEqual(['reviewed-1'])
  })

  it('summarizes the coach queue by review state', () => {
    const summary = getVideoReviewQueueSummary([
      { ...baseClip, id: 'draft-1', status: 'draft' },
      { ...baseClip, id: 'sent-old', status: 'sent', updatedAt: '2026-07-09T12:02:00.000Z' },
      { ...baseClip, id: 'reviewed-1', status: 'reviewed' },
      { ...baseClip, id: 'sent-new', status: 'sent', updatedAt: '2026-07-09T12:08:00.000Z' },
    ])

    expect(summary.total).toBe(3)
    expect(summary.needsReview).toBe(2)
    expect(summary.reviewed).toBe(1)
    expect(summary.privateDrafts).toBe(1)
    expect(summary.latestNeedsReview?.id).toBe('sent-new')
  })

  it('recommends reviewed or private clips before active coach queue clips for cleanup', () => {
    const candidate = getVideoReviewCleanupCandidate([
      { ...baseClip, id: 'sent-large', status: 'sent', sizeBytes: 900 },
      { ...baseClip, id: 'draft-small', status: 'draft', sizeBytes: 200 },
      { ...baseClip, id: 'reviewed-medium', status: 'reviewed', sizeBytes: 500 },
    ])

    expect(candidate?.id).toBe('reviewed-medium')
    expect(getVideoReviewCleanupCandidate([])).toBeNull()
  })

  it('removes a single timestamp annotation without changing the clip identity', () => {
    const clip: VideoReviewClip = {
      ...baseClip,
      annotations: [
        {
          id: 'mark-1',
          clipId: baseClip.id,
          timestamp: 3,
          tool: 'line',
          color: '#9be11d',
          text: 'Contact',
          points: [{ x: 0.4, y: 0.3 }],
          createdBy: 'coach',
          createdAt: '2026-07-09T12:01:00.000Z',
        },
        {
          id: 'mark-2',
          clipId: baseClip.id,
          timestamp: 5,
          tool: 'note',
          color: '#74beff',
          text: 'Recover',
          points: [{ x: 0.5, y: 0.5 }],
          createdBy: 'coach',
          createdAt: '2026-07-09T12:02:00.000Z',
        },
      ],
    }

    const nextClip = removeVideoReviewAnnotation(clip, 'mark-1')

    expect(nextClip.id).toBe(clip.id)
    expect(nextClip.annotations.map((annotation) => annotation.id)).toEqual(['mark-2'])
  })

  it('limits coach markup editing to coach mode', () => {
    expect(canEditVideoReviewAnnotations('coach')).toBe(true)
    expect(canEditVideoReviewAnnotations('player')).toBe(false)
  })

  it('keeps coach quick cues tennis-specific and return-ready', () => {
    expect(VIDEO_REVIEW_COACH_CUES.length).toBeGreaterThanOrEqual(6)
    expect(VIDEO_REVIEW_COACH_CUES.some((cue) => cue.stroke === 'serve')).toBe(true)
    expect(VIDEO_REVIEW_COACH_CUES.some((cue) => cue.stroke === 'return')).toBe(true)
    for (const cue of VIDEO_REVIEW_COACH_CUES) {
      expect(cue.note.length).toBeGreaterThan(40)
      expect(cue.summary.length).toBeGreaterThan(40)
      expect(cue.summary).not.toContain('dashboard')
    }
  })

  it('builds player follow-through from reviewed coach feedback', () => {
    const plan = buildVideoReviewPracticePlan({
      ...baseClip,
      status: 'reviewed',
      stroke: 'serve',
      coachSummary: 'Keep the toss more in front and hold the finish.',
    })

    expect(plan.title).toBe('Serve follow-through')
    expect(plan.focus).toContain('toss')
    expect(plan.steps).toHaveLength(3)
    expect(plan.steps[0].title).toBe('Shadow the shape')
    expect(plan.copyText).toContain('Focus: Keep the toss')
  })

  it('falls back to timestamp notes when coach summary is empty', () => {
    const plan = buildVideoReviewPracticePlan({
      ...baseClip,
      status: 'sent',
      stroke: 'return',
      annotations: [
        {
          id: 'mark-return',
          clipId: baseClip.id,
          timestamp: 2,
          tool: 'note',
          color: '#74beff',
          text: 'Split earlier on server contact.',
          points: [{ x: 0.5, y: 0.5 }],
          createdBy: 'coach',
          createdAt: '2026-07-09T12:02:00.000Z',
        },
      ],
    })

    expect(plan.title).toBe('Return follow-through')
    expect(plan.focus).toBe('Split earlier on server contact.')
    expect(plan.steps[0].title).toBe('Split timing')
  })

  it('ignores player-authored timestamp notes as coach feedback', () => {
    const clip: VideoReviewClip = {
      ...baseClip,
      playerNote: 'Player asked about the toss.',
      annotations: [
        {
          id: 'player-mark',
          clipId: baseClip.id,
          timestamp: 1,
          tool: 'note',
          color: '#74beff',
          text: 'Player note from an imported package.',
          points: [{ x: 0.5, y: 0.5 }],
          createdBy: 'player',
          createdAt: '2026-07-09T12:01:00.000Z',
        },
        {
          id: 'coach-mark',
          clipId: baseClip.id,
          timestamp: 4,
          tool: 'note',
          color: '#9be11d',
          text: 'Coach note should drive the return.',
          points: [{ x: 0.4, y: 0.3 }],
          createdBy: 'coach',
          createdAt: '2026-07-09T12:02:00.000Z',
        },
      ],
    }

    expect(buildVideoReviewReturnFocus({ ...clip, annotations: [clip.annotations[0]] })).toBe('')
    expect(canReturnVideoReview({ ...clip, annotations: [clip.annotations[0]] })).toBe(false)
    expect(buildVideoReviewReturnFocus(clip)).toBe('Coach note should drive the return.')
    expect(buildVideoReviewPracticePlan({ ...clip, annotations: [clip.annotations[0]] }).focus).toBe('Player asked about the toss.')
  })

  it('moves imported reviewed clips without coach feedback back to the coach queue', () => {
    const emptyReviewedClip: VideoReviewClip = {
      ...baseClip,
      status: 'reviewed',
      coachSummary: '',
      annotations: [
        {
          id: 'player-mark',
          clipId: baseClip.id,
          timestamp: 1,
          tool: 'note',
          color: '#74beff',
          text: 'Player note only.',
          points: [{ x: 0.5, y: 0.5 }],
          createdBy: 'player',
          createdAt: '2026-07-09T12:01:00.000Z',
        },
      ],
    }
    const completeReviewedClip: VideoReviewClip = {
      ...baseClip,
      status: 'reviewed',
      coachSummary: 'Coach feedback is ready.',
    }

    expect(normalizeImportedVideoReviewClip(emptyReviewedClip).status).toBe('sent')
    expect(normalizeImportedVideoReviewClip(emptyReviewedClip).coachSummary).toBe('')
    expect(normalizeImportedVideoReviewClip(completeReviewedClip).status).toBe('reviewed')
  })

  it('keeps reviewed clips reviewed when coach marks are added later', () => {
    expect(getVideoReviewAnnotationSaveStatus({ status: 'draft' })).toBe('sent')
    expect(getVideoReviewAnnotationSaveStatus({ status: 'sent' })).toBe('sent')
    expect(getVideoReviewAnnotationSaveStatus({ status: 'reviewed' })).toBe('reviewed')
  })

  it('refreshes player feedback notifications when reviewed clips get new coach marks', () => {
    expect(getVideoReviewAnnotationNotificationType({ status: 'draft' })).toBeNull()
    expect(getVideoReviewAnnotationNotificationType({ status: 'sent' })).toBeNull()
    expect(getVideoReviewAnnotationNotificationType({ status: 'reviewed' })).toBe('review_returned')
  })

  it('finds the latest coach mark for returned player feedback', () => {
    const annotations: VideoReviewClip['annotations'] = [
      {
        id: 'player-mark',
        clipId: baseClip.id,
        timestamp: 8,
        tool: 'note',
        color: '#74beff',
        text: 'Player imported question.',
        points: [{ x: 0.5, y: 0.5 }],
        createdBy: 'player',
        createdAt: '2026-07-09T12:04:00.000Z',
      },
      {
        id: 'coach-early',
        clipId: baseClip.id,
        timestamp: 3,
        tool: 'line',
        color: '#9be11d',
        text: 'Track the toss arm longer.',
        points: [{ x: 0.4, y: 0.3 }],
        createdBy: 'coach',
        createdAt: '2026-07-09T12:02:00.000Z',
      },
      {
        id: 'coach-late',
        clipId: baseClip.id,
        timestamp: 5,
        tool: 'note',
        color: '#9be11d',
        text: 'Hold the finish after contact.',
        points: [{ x: 0.6, y: 0.4 }],
        createdBy: 'coach',
        createdAt: '2026-07-09T12:03:00.000Z',
      },
    ]
    const latest = getLatestVideoReviewCoachAnnotation({ annotations })

    expect(getVideoReviewCoachAnnotations({ annotations }).map((annotation) => annotation.id)).toEqual(['coach-early', 'coach-late'])
    expect(latest?.id).toBe('coach-late')
    expect(getLatestVideoReviewCoachAnnotation({ annotations: [] })).toBeNull()
  })

  it('formats coach mark counts for visible review copy', () => {
    expect(formatVideoReviewCoachMarkCount(0)).toBe('0 coach marks')
    expect(formatVideoReviewCoachMarkCount(1)).toBe('1 coach mark')
    expect(formatVideoReviewCoachMarkCount(2)).toBe('2 coach marks')
  })

  it('builds the return focus from draft, saved summary, or timestamp notes', () => {
    const clip: VideoReviewClip = {
      ...baseClip,
      coachSummary: '  Hold   the finish after contact. ',
      annotations: [
        {
          id: 'mark-late',
          clipId: baseClip.id,
          timestamp: 6,
          tool: 'note',
          color: '#74beff',
          text: 'Recover through the split step.',
          points: [{ x: 0.5, y: 0.5 }],
          createdBy: 'coach',
          createdAt: '2026-07-09T12:02:00.000Z',
        },
      ],
    }

    expect(buildVideoReviewReturnFocus(clip, '  Toss   farther in front. ')).toBe('Toss farther in front.')
    expect(buildVideoReviewReturnFocus(clip)).toBe('Hold the finish after contact.')
  })

  it('requires a useful coach focus before returning a review', () => {
    const clipWithMarks: VideoReviewClip = {
      ...baseClip,
      annotations: [
        {
          id: 'mark-late',
          clipId: baseClip.id,
          timestamp: 6,
          tool: 'note',
          color: '#74beff',
          text: 'Recover through the split step.',
          points: [{ x: 0.5, y: 0.5 }],
          createdBy: 'coach',
          createdAt: '2026-07-09T12:02:00.000Z',
        },
        {
          id: 'mark-early',
          clipId: baseClip.id,
          timestamp: 2,
          tool: 'line',
          color: '#9be11d',
          text: 'Contact farther in front.',
          points: [{ x: 0.4, y: 0.3 }],
          createdBy: 'coach',
          createdAt: '2026-07-09T12:01:00.000Z',
        },
      ],
    }

    expect(canReturnVideoReview(baseClip)).toBe(false)
    expect(canReturnVideoReview(baseClip, '  ')).toBe(false)
    expect(canReturnVideoReview(clipWithMarks)).toBe(true)
    expect(buildVideoReviewReturnFocus(clipWithMarks)).toBe('Contact farther in front.')
  })

  it('tracks coach checklist progress from video time, marks, focus, and return status', () => {
    const clip: VideoReviewClip = {
      ...baseClip,
      status: 'sent',
      annotations: [
        {
          id: 'coach-mark',
          clipId: baseClip.id,
          timestamp: 4,
          tool: 'arrow',
          color: '#9be11d',
          text: 'Reach higher before the shoulder drops.',
          points: [{ x: 0.4, y: 0.3 }],
          createdBy: 'coach',
          createdAt: '2026-07-09T12:03:00.000Z',
        },
      ],
    }

    const progress = buildVideoReviewCoachChecklistState(clip, '', 3)

    expect(progress.map((item) => [item.id, item.done])).toEqual([
      ['watch', true],
      ['mark', true],
      ['focus', true],
      ['return', false],
    ])

    expect(buildVideoReviewCoachChecklistState({ ...clip, status: 'reviewed' }, '', 3).at(-1)?.done).toBe(true)
  })

  it('builds a player practice completion record from the returned review focus', () => {
    const clip: VideoReviewClip = {
      ...baseClip,
      id: 'clip-practiced',
      coachSummary: 'Hit ten serves holding the balanced finish.',
    }

    expect(buildVideoReviewPracticeRecord(clip, '2026-07-09T13:00:00.000Z')).toEqual({
      clipId: 'clip-practiced',
      doneAt: '2026-07-09T13:00:00.000Z',
      focus: 'Hit ten serves holding the balanced finish.',
    })
  })

  it('updates clip metadata without losing review state', () => {
    const clip: VideoReviewClip = {
      ...baseClip,
      status: 'reviewed',
      annotations: [
        {
          id: 'mark-1',
          clipId: baseClip.id,
          timestamp: 3,
          tool: 'line',
          color: '#9be11d',
          text: 'Contact',
          points: [{ x: 0.4, y: 0.3 }],
          createdBy: 'coach',
          createdAt: '2026-07-09T12:01:00.000Z',
        },
      ],
    }

    const updated = applyVideoReviewClipMetadata(clip, {
      title: '  Serve   cleanup  ',
      playerName: '',
      coachName: '  Coach C ',
      stroke: 'return',
      captureIntent: 'technique',
      playerNote: '  Watch   split timing. ',
    }, '2026-07-09T12:10:00.000Z')

    expect(updated.title).toBe('Serve cleanup')
    expect(updated.playerName).toBe('Player')
    expect(updated.coachName).toBe('Coach C')
    expect(updated.stroke).toBe('return')
    expect(updated.captureIntent).toBe('technique')
    expect(updated.playerNote).toBe('Watch split timing.')
    expect(updated.status).toBe('reviewed')
    expect(updated.annotations).toHaveLength(1)
    expect(updated.updatedAt).toBe('2026-07-09T12:10:00.000Z')
  })
})
