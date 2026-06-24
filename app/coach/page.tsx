'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import LockedPlanPage from '@/app/components/locked-plan-page'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import { buildProductAccessState } from '@/lib/access-model'
import { COACH_ASSIGNMENT_TEMPLATES, getCoachAssignmentTemplate } from '@/lib/coach-assignment-templates'
import type { CoachStudentInvite } from '@/lib/coach-invites'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import {
  assignmentNeedsCoachReview,
  getCoachAssignmentDueState,
  getCoachAssignmentPackProgress,
  getCoachAssignmentReview,
  getCoachAssignmentSummary,
  getPlayerAssignmentCheckIn,
  sortCoachAssignmentsForReview,
  type CoachAssignment,
  type CoachAssignmentPack,
  type CoachAssignmentStatus,
  type CoachStudentLink,
} from '@/lib/coach-storage'
import {
  COACH_INTEGRATION_STEPS,
  COACH_LESSON_BLOCKS,
  COACH_SESSION_PRESETS,
  COACH_WORKSPACE_COMMANDS,
  buildCoachStudentSnapshots,
  buildSessionPresetAssignment,
  getCoachPlannerHref,
  getCoachSessionPreset,
} from '@/lib/coach-workspace'
import { buildCoachStudentCalendarEvents } from '@/lib/coach-calendar'
import type { LevelUpSession } from '@/lib/level-up-sessions'
import { LEVEL_UP_CARDS } from '@/lib/level-up/level-up-cards'
import { LEVEL_UP_MODULES } from '@/lib/level-up/level-up-modules'
import { getLevelUpProfileForIdentity } from '@/lib/level-up/recommendations'
import type { LevelUpCard, LevelUpModule } from '@/lib/level-up/level-up-types'
import { PLAYER_DEVELOPMENT_IDENTITIES, getPlayerDevelopmentIdentity } from '@/lib/player-development'
import { PRODUCT_MOTTO } from '@/lib/product-story'

const CUSTOM_STUDENT_IDENTITY_ID = 'custom-development-path'
const CUSTOM_ASSIGNMENT_TEMPLATE_ID = 'custom-assignment'
const DEFAULT_STUDENT_IDENTITY_ID = 'relentless-competitor-4-0'
const COACH_STUDENT_DRAFT_KEY = 'tenaceiq.coach.studentDraft.v1'

type CoachCalendarFeedStatus = {
  active: boolean
  createdAt: string | null
  lastUsedAt: string | null
}

type CoachStudentDraft = {
  studentName: string
  studentLevel: string
  studentIdentity: string
  studentCustomIdentity: string
  inviteEmail: string
  studentPhone: string
  contactPreference: CoachStudentLink['contactPreference']
}

const FIRST_ASSIGNMENT_STARTERS = [
  {
    id: 'movement',
    templateId: 'split-recover-repeat',
    title: 'First movement standard',
    focus: 'Active feet + recovery',
    cue: 'Set the baseline habit: split, first step, recover before watching.',
    evidence: 'Player returns with four completed cycles and one note on when their feet stopped moving.',
  },
  {
    id: 'serve',
    templateId: 'serve-target-ladder',
    title: 'First serve pressure chart',
    focus: 'Serve routine + target clarity',
    cue: 'Give the player a measurable serve task they can bring back with evidence.',
    evidence: 'Player tracks 60 serves by target and names the target that held up best under pressure.',
  },
  {
    id: 'decision',
    templateId: 'attack-decision-audit',
    title: 'First attack decision audit',
    focus: 'Build, attack, or reset',
    cue: 'Start the Coach Hub with smarter ball selection instead of generic winners.',
    evidence: 'Player brings three point notes: correct attack, smart reset, and one forced attack to clean up.',
  },
] as const

const COACH_REVIEW_PROOF_SYNC_STEPS = [
  {
    label: 'Synced proof',
    text: 'Coach-visible only after the assigned Level Up log reaches this review queue.',
  },
  {
    label: 'Local boundary',
    text: 'Browser-only player logs stay private until the player syncs or shares the proof.',
  },
  {
    label: 'Next coach move',
    text: 'Use the proof score, note, and due state to choose repeat, simplify, or add pressure.',
  },
]

const COACH_SUPPORT_PATHS = [
  {
    job: 'assign_drills',
    question: 'How can I assign drills?',
    title: 'Assign the next rep',
    body: 'Use the lesson frame, Level Up packs, or Tactical Studio so the player leaves with one measurable task.',
    href: '#coach-lesson-frame',
    cta: 'Open lesson frame',
    icon: 'scenarioBuilder',
  },
  {
    job: 'track_development',
    question: 'How can I track player development?',
    title: 'Open the player bench',
    body: 'See linked players, active assignments, proof to review, due pressure, and the next focus before the next lesson.',
    href: '#coach-linked-dashboard',
    cta: 'Open player bench',
    icon: 'playerRatings',
  },
  {
    job: 'recommend_resources',
    question: 'How can I recommend resources?',
    title: 'Send the right resource',
    body: 'Point players to development paths, Level Up cards, coach planner sheets, or resource hub cues that match the goal.',
    href: '/resources?q=coach%20drills%20skills',
    cta: 'Open coach resources',
    icon: 'reports',
  },
  {
    job: 'support_between_sessions',
    question: 'How can I support players between sessions?',
    title: 'Close the loop',
    body: 'Send the assignment, schedule cue, recap request, or next focus without losing the player thread.',
    href: '#coach-student-board',
    cta: 'Support a player',
    icon: 'messagingCenter',
  },
] as const

type CoachLevelUpHandoffPack = {
  id: string
  title: string
  assignmentTitle: string
  focus: string
  detail: string
  cardIds: string[]
}

const COACH_LEVEL_UP_HANDOFF_PACKS: CoachLevelUpHandoffPack[] = [
  {
    id: 'rhythm-builder',
    title: 'Rhythm Builder',
    assignmentTitle: 'First rhythm Level Up pack',
    focus: 'Ready feet, wall rhythm, and pre-play readiness',
    detail: 'Use this when a newer or returning player needs a simple repeatable rhythm before bigger tactical work.',
    cardIds: ['split-step-rhythm', 'wall-rally-rhythm', 'dynamic-tennis-warm-up'],
  },
  {
    id: 'consistency-builder',
    title: 'Consistency Builder',
    assignmentTitle: 'Consistency Level Up pack',
    focus: 'Crosscourt tolerance, wide-ball neutralizing, and post-play recovery',
    detail: 'Use this when the player needs fewer loose errors and a cleaner recovery habit between sessions.',
    cardIds: ['crosscourt-consistency', 'wide-ball-neutralizer', 'post-play-mobility-reset'],
  },
  {
    id: 'point-start-routine',
    title: 'Point-Start Routine',
    assignmentTitle: 'Point-start Level Up pack',
    focus: 'Serve target, return job, and 30-30 reset clarity',
    detail: 'Use this when a competitive player needs sharper first-two-shot habits under pressure.',
    cardIds: ['serve-target-call', 'return-depth-lane', '30-30-pressure-game'],
  },
  {
    id: 'doubles-readiness',
    title: 'Doubles Readiness',
    assignmentTitle: 'Doubles readiness Level Up pack',
    focus: 'Partner first move, poach timing, and 30-30 doubles clarity',
    detail: 'Use this when a player needs clearer partner jobs and proof-backed doubles habits between lessons.',
    cardIds: ['partner-first-move-call', 'poach-timing-shadow', 'doubles-30-30-game'],
  },
  {
    id: 'match-day-routine',
    title: 'Match-Day Routine',
    assignmentTitle: 'Match-day routine Level Up pack',
    focus: 'Warm-up, return intent, and post-match debrief',
    detail: 'Use this when the next lesson needs a player to arrive with proof from match-day routines.',
    cardIds: ['five-minute-match-primer', 'return-30-30-game', 'post-match-five-minute-debrief'],
  },
]

export default function CoachPage() {
  return (
    <SiteShell active="/coach">
      <CoachContent />
    </SiteShell>
  )
}

function CoachContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isMobile } = useViewportBreakpoints()
  const { role, userId, entitlements, authResolved, session } = useAuth()
  const resolvedRole = authResolved || !userId ? role : 'member'
  const access = useMemo(() => buildProductAccessState(resolvedRole, entitlements), [entitlements, resolvedRole])
  const studentSnapshots = useMemo(() => buildCoachStudentSnapshots(), [])
  const [savedStudents, setSavedStudents] = useState<CoachStudentLink[]>([])
  const [assignments, setAssignments] = useState<CoachAssignment[]>([])
  const [levelUpSessions, setLevelUpSessions] = useState<LevelUpSession[]>([])
  const [studentName, setStudentName] = useState('')
  const [studentLevel, setStudentLevel] = useState('')
  const [studentIdentity, setStudentIdentity] = useState(DEFAULT_STUDENT_IDENTITY_ID)
  const [studentCustomIdentity, setStudentCustomIdentity] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [studentPhone, setStudentPhone] = useState('')
  const [contactPreference, setContactPreference] = useState<CoachStudentLink['contactPreference']>('in_app')
  const [lastCreatedStudentSetup, setLastCreatedStudentSetup] = useState<{
    student: CoachStudentLink
    invite: CoachStudentInvite | null
  } | null>(null)
  const [studentDraftHydrated, setStudentDraftHydrated] = useState(false)
  const [invites, setInvites] = useState<CoachStudentInvite[]>([])
  const [assignmentStudentId, setAssignmentStudentId] = useState('')
  const [assignmentTitle, setAssignmentTitle] = useState('')
  const [assignmentFocus, setAssignmentFocus] = useState('')
  const [assignmentDueDate, setAssignmentDueDate] = useState('')
  const [assignmentTemplateId, setAssignmentTemplateId] = useState(COACH_ASSIGNMENT_TEMPLATES[0]?.id ?? '')
  const [assignmentPresetId, setAssignmentPresetId] = useState('')
  const [assignmentStarterId, setAssignmentStarterId] = useState('')
  const [assignmentLevelUpCardId, setAssignmentLevelUpCardId] = useState('')
  const [assignmentLevelUpPackId, setAssignmentLevelUpPackId] = useState('')
  const [assignmentEditId, setAssignmentEditId] = useState('')
  const [contactStudentId, setContactStudentId] = useState('')
  const [lessonDateTime, setLessonDateTime] = useState('')
  const [lessonFocus, setLessonFocus] = useState('')
  const [lessonLocation, setLessonLocation] = useState('')
  const [sessionPresetId, setSessionPresetId] = useState(COACH_SESSION_PRESETS[0]?.id ?? '')
  const [reviewAssignmentId, setReviewAssignmentId] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [reviewNextFocus, setReviewNextFocus] = useState('')
  const [workspaceMessage, setWorkspaceMessage] = useState('')
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [lastCreatedAssignment, setLastCreatedAssignment] = useState<CoachAssignment | null>(null)
  const [calendarLinkByStudentId, setCalendarLinkByStudentId] = useState<Record<string, string>>({})
  const [calendarFeedStatusByStudentId, setCalendarFeedStatusByStudentId] = useState<Record<string, CoachCalendarFeedStatus>>({})
  const [calendarLinkLoadingStudentId, setCalendarLinkLoadingStudentId] = useState('')
  const [shareOrigin, setShareOrigin] = useState('')
  const studentPhoneDigits = getPhoneDigits(studentPhone)
  const textContactNeedsPhone = (contactPreference === 'text' || contactPreference === 'both') && !studentPhoneDigits
  const studentPhoneLooksIncomplete = Boolean(studentPhone.trim()) && studentPhoneDigits.length < 7
  const addStudentBlockedMessage = textContactNeedsPhone
    ? 'Add a cell number before using Text contact.'
    : studentPhoneLooksIncomplete
      ? 'Check the cell number before sending a text setup.'
      : ''
  const addStudentDisabled = workspaceLoading || !studentName.trim() || Boolean(addStudentBlockedMessage)
  const addStudentButtonLabel = workspaceLoading
    ? 'Saving...'
    : studentPhoneDigits.length >= 7
      ? 'Add student + text setup'
      : inviteEmail.trim()
        ? 'Add student + setup link'
        : contactPreference === 'text' || contactPreference === 'both'
          ? 'Add cell to text setup'
          : 'Add student'
  const hasStudentFormDraft = Boolean(
    studentName.trim() ||
    studentLevel.trim() ||
    studentCustomIdentity.trim() ||
    inviteEmail.trim() ||
    studentPhone.trim() ||
    studentIdentity !== DEFAULT_STUDENT_IDENTITY_ID ||
    contactPreference !== 'in_app',
  )

  useEffect(() => {
    setShareOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(COACH_STUDENT_DRAFT_KEY)
      if (rawDraft) {
        const draft = JSON.parse(rawDraft) as Partial<CoachStudentDraft>
        setStudentName(cleanText(draft.studentName))
        setStudentLevel(cleanText(draft.studentLevel))
        setStudentIdentity(cleanText(draft.studentIdentity) || DEFAULT_STUDENT_IDENTITY_ID)
        setStudentCustomIdentity(cleanText(draft.studentCustomIdentity))
        setInviteEmail(cleanText(draft.inviteEmail))
        setStudentPhone(cleanText(draft.studentPhone))
        setContactPreference(normalizeContactPreference(draft.contactPreference))
      }
    } catch {
      window.localStorage.removeItem(COACH_STUDENT_DRAFT_KEY)
    } finally {
      setStudentDraftHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!studentDraftHydrated) return

    const draft: CoachStudentDraft = {
      studentName,
      studentLevel,
      studentIdentity,
      studentCustomIdentity,
      inviteEmail,
      studentPhone,
      contactPreference,
    }
    const hasDraft =
      studentName.trim() ||
      studentLevel.trim() ||
      studentCustomIdentity.trim() ||
      inviteEmail.trim() ||
      studentPhone.trim() ||
      studentIdentity !== DEFAULT_STUDENT_IDENTITY_ID ||
      contactPreference !== 'in_app'

    if (!hasDraft) {
      window.localStorage.removeItem(COACH_STUDENT_DRAFT_KEY)
      return
    }

    window.localStorage.setItem(COACH_STUDENT_DRAFT_KEY, JSON.stringify(draft))
  }, [contactPreference, inviteEmail, studentCustomIdentity, studentDraftHydrated, studentIdentity, studentLevel, studentName, studentPhone])

  const loadCoachWorkspace = useCallback(async () => {
    if (!session?.access_token || !access.canUseCoachWorkflow) return
    setWorkspaceLoading(true)
    setWorkspaceMessage('')
    setLastCreatedStudentSetup(null)

    try {
      const [studentsResponse, assignmentsResponse, invitesResponse, levelUpResponse] = await Promise.all([
        fetch('/api/coach/students', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch('/api/coach/assignments', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch('/api/coach/invites', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch('/api/coach/level-up-sessions', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ])

      const studentsJson = (await studentsResponse.json()) as { ok?: boolean; students?: CoachStudentLink[]; message?: string }
      const assignmentsJson = (await assignmentsResponse.json()) as { ok?: boolean; assignments?: CoachAssignment[]; message?: string }
      const invitesJson = (await invitesResponse.json()) as { ok?: boolean; invites?: CoachStudentInvite[]; message?: string }
      const levelUpJson = (await levelUpResponse.json()) as { ok?: boolean; sessions?: LevelUpSession[]; message?: string }

      if (!studentsResponse.ok || !studentsJson.ok) {
        throw new Error(studentsJson.message || 'Could not load coach students.')
      }

      if (!assignmentsResponse.ok || !assignmentsJson.ok) {
        throw new Error(assignmentsJson.message || 'Could not load coach assignments.')
      }

      if (!invitesResponse.ok || !invitesJson.ok) {
        throw new Error(invitesJson.message || 'Could not load coach invites.')
      }

      setSavedStudents(studentsJson.students ?? [])
      setAssignments(assignmentsJson.assignments ?? [])
      setInvites(invitesJson.invites ?? [])
      setLevelUpSessions(levelUpResponse.ok && levelUpJson.ok ? levelUpJson.sessions ?? [] : [])
      setAssignmentStudentId((current) => current || studentsJson.students?.[0]?.id || '')
      setContactStudentId((current) => current || studentsJson.students?.[0]?.id || '')
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : 'Could not load Coach Hub.')
    } finally {
      setWorkspaceLoading(false)
    }
  }, [access.canUseCoachWorkflow, session?.access_token])

  useEffect(() => {
    if (!authResolved || role !== 'public') return
    router.replace('/login?next=/coach')
  }, [authResolved, role, router])

  useEffect(() => {
    void loadCoachWorkspace()
  }, [loadCoachWorkspace])

  useEffect(() => {
    if (!authResolved) return

    if (!session?.access_token || !access.canUseCoachWorkflow) {
      setCalendarFeedStatusByStudentId({})
      return
    }

    let active = true

    void (async () => {
      try {
        const response = await fetch('/api/coach/student-calendar-links', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = (await response.json()) as {
          ok?: boolean
          feeds?: Array<{ studentLinkId?: string; createdAt?: string | null; lastUsedAt?: string | null }>
          message?: string
        }
        if (!response.ok || !json.ok) {
          throw new Error(json.message || 'Could not load coach calendar feed status.')
        }

        if (!active) return
        setCalendarFeedStatusByStudentId(
          Object.fromEntries(
            (json.feeds ?? [])
              .filter((feed) => cleanText(feed.studentLinkId))
              .map((feed) => [
                cleanText(feed.studentLinkId),
                {
                  active: true,
                  createdAt: feed.createdAt ?? null,
                  lastUsedAt: feed.lastUsedAt ?? null,
                },
              ]),
          ),
        )
      } catch {
        if (!active) return
        setCalendarFeedStatusByStudentId({})
      }
    })()

    return () => {
      active = false
    }
  }, [access.canUseCoachWorkflow, authResolved, session?.access_token])

  async function handleAddStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session?.access_token || !studentName.trim()) return
    if (addStudentBlockedMessage) {
      setWorkspaceMessage(addStudentBlockedMessage)
      return
    }

    setWorkspaceLoading(true)
    setWorkspaceMessage('')

    try {
      const response = await fetch('/api/coach/students', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          student: {
            playerName: studentName,
            identitySlug: studentIdentity,
            levelLabel: studentIdentity === CUSTOM_STUDENT_IDENTITY_ID
              ? studentLevel || studentCustomIdentity.trim() || 'Custom path'
              : studentLevel,
            playerEmail: inviteEmail,
            playerPhone: studentPhone,
            contactPreference,
            setupStatus: inviteEmail.trim() || studentPhone.trim() ? 'invited' : 'manual',
            status: 'needs_assignment',
          },
        }),
      })
      const json = (await response.json()) as { ok?: boolean; student?: CoachStudentLink; message?: string }

      if (!response.ok || !json.ok || !json.student) {
        throw new Error(json.message || 'Could not add student.')
      }

      const savedStudent = json.student as CoachStudentLink
      const shouldCreateInvite = Boolean(inviteEmail.trim() || studentPhone.trim())
      const createdInvite = shouldCreateInvite
        ? await createInvite(savedStudent.id, inviteEmail.trim())
        : null

      setSavedStudents((current) => [savedStudent, ...current.filter((student) => student.id !== savedStudent.id)])
      setAssignmentStudentId(savedStudent.id)
      setContactStudentId(savedStudent.id)
      setLastCreatedStudentSetup({ student: savedStudent, invite: createdInvite })
      setStudentName('')
      setStudentLevel('')
      setStudentCustomIdentity('')
      setInviteEmail('')
      setStudentPhone('')
      setContactPreference('in_app')
      setWorkspaceMessage(
        createdInvite
          ? savedStudent.playerPhone
            ? 'Student added. Text the setup link now or create the first assignment.'
            : 'Student added. Setup link is ready.'
          : 'Student added. Create the first assignment while the lesson is fresh.',
      )
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : 'Could not add student.')
    } finally {
      setWorkspaceLoading(false)
    }
  }

  async function saveCoachAssignment(status: CoachAssignmentStatus, handoffPack?: CoachLevelUpHandoffPack) {
    const effectiveTitle = handoffPack?.assignmentTitle ?? assignmentTitle
    const effectiveFocus = handoffPack?.focus ?? assignmentFocus
    if (!session?.access_token || !assignmentStudentId || !effectiveTitle.trim()) return

    const customAssignmentTemplate = assignmentTemplateId === CUSTOM_ASSIGNMENT_TEMPLATE_ID
    const template = customAssignmentTemplate ? null : getCoachAssignmentTemplate(assignmentTemplateId)
    const presetAssignment = assignmentPresetId ? buildSessionPresetAssignment(assignmentPresetId) : null
    const starterAssignment = assignmentStarterId
      ? FIRST_ASSIGNMENT_STARTERS.find((starter) => starter.id === assignmentStarterId) ?? null
      : null
    const levelUpAssignmentPack = handoffPack
      ? buildCoachLevelUpAssignmentPack(handoffPack)
      : assignmentLevelUpPackId
        ? buildCoachLevelUpAssignmentPack(buildCoachLevelUpHandoffPack(assignmentLevelUpPackId, assignmentLevelUpCardId))
        : null
    const primaryPackCardId = levelUpAssignmentPack?.items[0]?.cardId ?? ''
    const exactLevelUpCardId = primaryPackCardId || assignmentLevelUpCardId
    const levelUpCard = exactLevelUpCardId
      ? LEVEL_UP_CARDS.find((card) => card.id === exactLevelUpCardId) ?? null
      : buildCoachLevelUpAssignmentCards(
          savedStudents.find((student) => student.id === assignmentStudentId) ?? null,
          effectiveTitle,
          effectiveFocus,
          assignmentTemplateId,
          assignmentStarterId,
        )[0] ?? null
    const levelUpModule = levelUpCard ? findLevelUpModuleForCard(levelUpCard) : null
    const levelUpStandard = levelUpCard ? buildCoachLevelUpAssignmentStandard(levelUpCard) : null
    const levelUpTracker = levelUpStandard
      ? levelUpStandard.tracker
      : null
    const normalizedLessonDateTime = lessonDateTime.trim()
    const normalizedLessonFocus = lessonFocus.trim()
    const normalizedLessonLocation = lessonLocation.trim()
    setWorkspaceLoading(true)
    setWorkspaceMessage('')

    try {
      const response = await fetch('/api/coach/assignments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assignment: {
            id: assignmentEditId || undefined,
            studentLinkId: assignmentStudentId,
            title: effectiveTitle,
            focus: effectiveFocus,
            dueDate: assignmentDueDate,
            status,
            assignment: {
              templateId: presetAssignment ? assignmentPresetId : template?.id ?? CUSTOM_ASSIGNMENT_TEMPLATE_ID,
              detail: levelUpAssignmentPack
                ? `Complete ${levelUpAssignmentPack.title}: ${levelUpAssignmentPack.focus}`
                : presetAssignment?.detail ?? template?.detail ?? (effectiveFocus || effectiveTitle),
              ...(template?.assignment ?? {
                tracker: ['Coach-defined target', 'Player proof returned', 'Next focus chosen'],
                playerPlusPrompt: 'Log what changed and what needs the next rep.',
              }),
              ...(presetAssignment
                ? {
                    tracker: presetAssignment.tracker,
                    prompt: presetAssignment.prompt,
                    sessionPresetId: assignmentPresetId,
                  }
                : {}),
              ...(starterAssignment
                ? {
                    starterId: starterAssignment.id,
                    expectedEvidence: starterAssignment.evidence,
                  }
                : {}),
              ...(levelUpCard
                ? {
                    cardId: levelUpCard.id,
                    moduleId: levelUpModule?.id,
                    levelUpCardTitle: levelUpCard.title,
                    levelUpModuleTitle: levelUpModule?.title,
                    proofRequired: levelUpCard.proof,
                    expectedEvidence: starterAssignment?.evidence ?? `Proof: ${levelUpCard.proof}. Coach watch: ${levelUpStandard?.coachWatches ?? levelUpCard.cue}`,
                    tracker: presetAssignment?.tracker ?? levelUpTracker,
                    playerPlusPrompt: `Score proof, note whether "${levelUpStandard?.coachWatches ?? levelUpCard.cue}" showed up, and send one next-rep signal.`,
                    portalHref: `/player-development/${savedStudents.find((student) => student.id === assignmentStudentId)?.identitySlug ?? 'relentless-competitor-4-0'}/level-up?card=${levelUpCard.id}`,
                  }
                : {}),
              ...(levelUpAssignmentPack
                ? {
                    levelUpPackId: levelUpAssignmentPack.id,
                    levelUpPackTitle: levelUpAssignmentPack.title,
                    levelUpPack: levelUpAssignmentPack,
                    tracker: levelUpAssignmentPack.items.map((item) => item.proof).filter(Boolean).slice(0, 4),
                    expectedEvidence: `${levelUpAssignmentPack.items.length} Level Up cards completed with proof.`,
                    playerPlusPrompt: 'Complete the assigned pack, send one recap, and name the next focus.',
                    sourcePack: 'coach-level-up-handoff',
                  }
                : {}),
              ...(normalizedLessonDateTime
                  ? {
                    lessonDateTime: normalizedLessonDateTime,
                    lessonFocus: normalizedLessonFocus || effectiveFocus || effectiveTitle,
                    lessonLocation: normalizedLessonLocation,
                    calendarLayer: 'coach_student_lesson',
                  }
                : {}),
              source: 'coach-portal',
              createdFrom: levelUpAssignmentPack
                ? 'level-up-pack-handoff'
                : starterAssignment
                  ? 'first-assignment-starter'
                  : presetAssignment
                    ? 'session-preset'
                    : 'one-hour-lesson-frame',
            },
          },
        }),
      })
      const json = (await response.json()) as { ok?: boolean; assignment?: CoachAssignment; message?: string }

      if (!response.ok || !json.ok || !json.assignment) {
        throw new Error(json.message || 'Could not create assignment.')
      }

      const savedAssignment = json.assignment as CoachAssignment
      setAssignments((current) => [savedAssignment, ...current.filter((assignment) => assignment.id !== savedAssignment.id)])
      setLastCreatedAssignment(status === 'assigned' ? savedAssignment : null)
      setContactStudentId(savedAssignment.studentLinkId)
      setAssignmentTitle('')
      setAssignmentFocus('')
      setAssignmentDueDate('')
      setAssignmentPresetId('')
      setAssignmentStarterId('')
      setAssignmentLevelUpCardId('')
      setAssignmentLevelUpPackId('')
      setAssignmentEditId('')
      setLessonLocation('')
      setWorkspaceMessage(
        status === 'draft'
          ? 'Level Up pack draft saved. Review it in Coach Hub, then assign it when the player is ready.'
          : 'Assignment created. Send it now so the player knows exactly what to do next.',
      )
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : 'Could not create assignment.')
    } finally {
      setWorkspaceLoading(false)
    }
  }

  async function handleCreateAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveCoachAssignment('assigned')
  }

  async function updateAssignmentStatus(assignment: CoachAssignment, status: CoachAssignmentStatus) {
    if (!session?.access_token) return
    setWorkspaceLoading(true)
    setWorkspaceMessage('')

    try {
      const response = await fetch('/api/coach/assignments', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assignmentId: assignment.id, status }),
      })
      const json = (await response.json()) as { ok?: boolean; assignment?: CoachAssignment; message?: string }
      if (!response.ok || !json.ok || !json.assignment) {
        throw new Error(json.message || 'Could not update assignment.')
      }

      setAssignments((current) => current.map((item) => (item.id === assignment.id ? json.assignment! : item)))
      setLastCreatedAssignment(status === 'assigned' ? json.assignment : null)
      setContactStudentId(json.assignment.studentLinkId)
      setWorkspaceMessage(status === 'assigned' ? 'Draft assigned. Send the player a quick note.' : 'Assignment archived.')
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : 'Could not update assignment.')
    } finally {
      setWorkspaceLoading(false)
    }
  }

  async function createInvite(studentLinkId: string, email: string) {
    if (!session?.access_token) return null

    const response = await fetch('/api/coach/invites', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invite: {
          studentLinkId,
          inviteEmail: email,
          message: 'Connect with your coach in TenAceIQ to receive assignments and development notes.',
        },
      }),
    })
    const json = (await response.json()) as { ok?: boolean; invite?: CoachStudentInvite; message?: string }

    if (!response.ok || !json.ok || !json.invite) {
      throw new Error(json.message || 'Could not create coach invite.')
    }

    setInvites((current) => [json.invite as CoachStudentInvite, ...current.filter((invite) => invite.id !== json.invite?.id)])
    return json.invite as CoachStudentInvite
  }

  async function createStudentCalendarLink(student: CoachStudentLink | null) {
    if (!session?.access_token || !student) return

    setCalendarLinkLoadingStudentId(student.id)
    setWorkspaceMessage('')

    try {
      const response = await fetch('/api/coach/student-calendar-links', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ studentLinkId: student.id }),
      })
      const json = (await response.json()) as { ok?: boolean; calendarUrl?: string; message?: string }

      if (!response.ok || !json.ok || !json.calendarUrl) {
        throw new Error(json.message || 'Could not create calendar link.')
      }

      setCalendarLinkByStudentId((current) => ({ ...current, [student.id]: json.calendarUrl as string }))
      setCalendarFeedStatusByStudentId((current) => ({
        ...current,
        [student.id]: { active: true, createdAt: new Date().toISOString(), lastUsedAt: null },
      }))
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(json.calendarUrl)
          setWorkspaceMessage(`Calendar subscribe link copied for ${student.playerName}.`)
        } catch {
          setWorkspaceMessage(`Calendar subscribe link created for ${student.playerName}. Open the feed to copy the URL.`)
        }
      } else {
        setWorkspaceMessage(`Calendar subscribe link created for ${student.playerName}.`)
      }
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : 'Could not create calendar link.')
    } finally {
      setCalendarLinkLoadingStudentId('')
    }
  }

  async function copyCoachAssignmentCourtLink(href: string, playerName: string) {
    if (!href) return

    await copyCoachText(href, `Court link copied for ${playerName}.`, `Court link is ready for ${playerName}: ${href}`)
  }

  async function copyCoachText(text: string, copiedMessage: string, fallbackMessage: string) {
    if (!text) return

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text)
        setWorkspaceMessage(copiedMessage)
        return
      } catch {
        setWorkspaceMessage(fallbackMessage)
        return
      }
    }

    setWorkspaceMessage(fallbackMessage)
  }

  async function revokeStudentCalendarLink(student: CoachStudentLink | null) {
    if (!session?.access_token || !student) return

    setCalendarLinkLoadingStudentId(student.id)
    setWorkspaceMessage('')

    try {
      const response = await fetch(`/api/coach/student-calendar-links?studentLinkId=${encodeURIComponent(student.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = (await response.json()) as { ok?: boolean; message?: string }

      if (!response.ok || !json.ok) {
        throw new Error(json.message || 'Could not revoke calendar link.')
      }

      setCalendarLinkByStudentId((current) => {
        const next = { ...current }
        delete next[student.id]
        return next
      })
      setCalendarFeedStatusByStudentId((current) => {
        const next = { ...current }
        delete next[student.id]
        return next
      })
      setWorkspaceMessage(`Calendar subscribe link revoked for ${student.playerName}.`)
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : 'Could not revoke calendar link.')
    } finally {
      setCalendarLinkLoadingStudentId('')
    }
  }

  function handleAssignmentTemplateChange(templateId: string) {
    if (templateId === CUSTOM_ASSIGNMENT_TEMPLATE_ID) {
      setAssignmentTemplateId(CUSTOM_ASSIGNMENT_TEMPLATE_ID)
      setAssignmentTitle('')
      setAssignmentFocus('')
      setAssignmentPresetId('')
      setAssignmentStarterId('')
      setAssignmentLevelUpCardId('')
      setAssignmentLevelUpPackId('')
      setAssignmentEditId('')
      return
    }

    const template = getCoachAssignmentTemplate(templateId)
    setAssignmentTemplateId(template.id)
    setAssignmentTitle(template.title)
    setAssignmentFocus(template.focus)
    setAssignmentPresetId('')
    setAssignmentStarterId('')
    setAssignmentLevelUpCardId(getCoachAssignmentShortcutCardId(`${template.id} ${template.title} ${template.focus}`))
    setAssignmentLevelUpPackId('')
    setAssignmentEditId('')
  }

  function useSessionPresetForAssignment() {
    const presetAssignment = buildSessionPresetAssignment(sessionPresetId)
    setAssignmentTitle(presetAssignment.title)
    setAssignmentFocus(presetAssignment.focus)
    setAssignmentPresetId(sessionPresetId)
    setAssignmentStarterId('')
    setAssignmentLevelUpCardId(getCoachAssignmentShortcutCardId(`${presetAssignment.title} ${presetAssignment.focus} ${presetAssignment.detail}`))
    setAssignmentLevelUpPackId('')
    setAssignmentEditId('')
    setWorkspaceMessage('Session preset loaded into the assignment form. Choose a student and due date, then create the Level Up follow-through.')
  }

  function loadFirstAssignmentStarter(starter: (typeof FIRST_ASSIGNMENT_STARTERS)[number]) {
    const template = getCoachAssignmentTemplate(starter.templateId)
    setAssignmentTemplateId(template.id)
    setAssignmentTitle(starter.title)
    setAssignmentFocus(starter.focus)
    setAssignmentDueDate(getDateInputDaysFromNow(7))
    setAssignmentPresetId('')
    setAssignmentStarterId(starter.id)
    setAssignmentLevelUpCardId(getFirstAssignmentStarterCardId(starter.id))
    setAssignmentLevelUpPackId('')
    setAssignmentEditId('')
    setWorkspaceMessage(`${starter.title} loaded. Expected evidence: ${starter.evidence}`)
  }

  function loadNextAssignmentFromProof(
    assignment: CoachAssignment,
    session: LevelUpSession,
    proofMove: LevelUpProofReviewDraft | LevelUpProofReviewDecision,
  ) {
    const nextCardId = proofMove.nextMove.cardId
    const templateId = getCoachAssignmentTemplateIdForCard(nextCardId)
    const nextCard = LEVEL_UP_CARDS.find((card) => card.id === nextCardId)

    setAssignmentStudentId(assignment.studentLinkId)
    setAssignmentTemplateId(templateId)
    setAssignmentTitle(proofMove.nextMove.title)
    setAssignmentFocus(proofMove.nextMove.focus)
    setAssignmentDueDate(getDateInputDaysFromNow(proofMove.nextMove.dueDays))
    setAssignmentPresetId('')
    setAssignmentStarterId('')
    setAssignmentLevelUpCardId(nextCardId)
    setAssignmentLevelUpPackId('')
    setAssignmentEditId('')
    setWorkspaceMessage(`Next assignment loaded from ${session.drillTitle}: ${proofMove.nextMove.label}. Create it when it fits the player.`)

    if (!nextCard) {
      setWorkspaceMessage(`Next assignment loaded, but the Level Up card needs a manual pick before saving.`)
    }
  }

  function loadReviewDecisionFromProof(assignment: CoachAssignment, session: LevelUpSession, decision: LevelUpProofReviewDecision) {
    setReviewAssignmentId(assignment.id)
    setReviewNote(decision.note)
    setReviewNextFocus(decision.nextFocus)
    loadNextAssignmentFromProof(assignment, session, decision)
    setWorkspaceMessage(`${decision.label} selected. Coach response is staged and the next assignment draft is ready.`)
  }

  async function saveAssignmentReview(assignmentId: string) {
    if (!session?.access_token || (!reviewNote.trim() && !reviewNextFocus.trim())) return

    setWorkspaceLoading(true)
    setWorkspaceMessage('')
    try {
      const response = await fetch('/api/coach/assignments', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assignmentId,
          note: reviewNote,
          nextFocus: reviewNextFocus,
        }),
      })
      const json = (await response.json()) as { ok?: boolean; assignment?: CoachAssignment; message?: string }
      if (!response.ok || !json.ok || !json.assignment) {
        throw new Error(json.message || 'Could not save assignment review.')
      }

      setAssignments((current) =>
        current.map((assignment) => (assignment.id === json.assignment?.id ? json.assignment : assignment)),
      )
      setReviewAssignmentId('')
      setReviewNote('')
      setReviewNextFocus('')
      setWorkspaceMessage('Review saved. Player can now see the next focus in My Lab.')
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : 'Could not save assignment review.')
    } finally {
      setWorkspaceLoading(false)
    }
  }

  const sortedAssignments = useMemo(() => sortCoachAssignmentsForReview(assignments), [assignments])
  const selectedSessionPreset = useMemo(() => getCoachSessionPreset(sessionPresetId), [sessionPresetId])
  const linkedPlayerCards = useMemo(
    () => buildLinkedPlayerCards(savedStudents, assignments, invites),
    [assignments, invites, savedStudents],
  )
  const [activeMobileBenchStudentId, setActiveMobileBenchStudentId] = useState('')
  const activeMobileBenchCard = useMemo(
    () =>
      linkedPlayerCards.find((card) => card.student.id === activeMobileBenchStudentId) ??
      linkedPlayerCards[0] ??
      null,
    [activeMobileBenchStudentId, linkedPlayerCards],
  )
  const selectedContactStudent = useMemo(
    () => savedStudents.find((student) => student.id === contactStudentId) ?? savedStudents[0] ?? null,
    [contactStudentId, savedStudents],
  )
  const selectedAssignmentStudent = useMemo(
    () => savedStudents.find((student) => student.id === assignmentStudentId) ?? savedStudents[0] ?? null,
    [assignmentStudentId, savedStudents],
  )
  const suggestedLevelUpAssignmentCards = useMemo(
    () => buildCoachLevelUpAssignmentCards(selectedAssignmentStudent, assignmentTitle, assignmentFocus, assignmentTemplateId, assignmentStarterId),
    [assignmentFocus, assignmentStarterId, assignmentTemplateId, assignmentTitle, selectedAssignmentStudent],
  )
  const selectedLevelUpAssignmentCard = useMemo(
    () => LEVEL_UP_CARDS.find((card) => card.id === assignmentLevelUpCardId) ?? suggestedLevelUpAssignmentCards[0] ?? null,
    [assignmentLevelUpCardId, suggestedLevelUpAssignmentCards],
  )
  const selectedLevelUpAssignmentModule = useMemo(
    () => (selectedLevelUpAssignmentCard ? findLevelUpModuleForCard(selectedLevelUpAssignmentCard) : null),
    [selectedLevelUpAssignmentCard],
  )
  const selectedLevelUpAssignmentStandard = useMemo(
    () => (selectedLevelUpAssignmentCard ? buildCoachLevelUpAssignmentStandard(selectedLevelUpAssignmentCard) : null),
    [selectedLevelUpAssignmentCard],
  )
  const selectedLevelUpAssignmentPack = useMemo(
    () => (assignmentLevelUpPackId ? buildCoachLevelUpHandoffPack(assignmentLevelUpPackId, assignmentLevelUpCardId) : null),
    [assignmentLevelUpCardId, assignmentLevelUpPackId],
  )
  const draftAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.status === 'draft').slice(0, 6),
    [assignments],
  )
  const levelUpHandoffPack = useMemo(
    () => buildCoachLevelUpHandoffPack(searchParams.get('levelUpPack') || '', searchParams.get('card') || ''),
    [searchParams],
  )
  const lessonMessage = useMemo(
    () => buildLessonConfirmMessage(selectedContactStudent?.playerName ?? 'your lesson', lessonDateTime, lessonFocus, lessonLocation),
    [lessonDateTime, lessonFocus, lessonLocation, selectedContactStudent?.playerName],
  )
  const lastCreatedAssignmentStudent = useMemo(
    () => (lastCreatedAssignment ? savedStudents.find((student) => student.id === lastCreatedAssignment.studentLinkId) ?? null : null),
    [lastCreatedAssignment, savedStudents],
  )
  const lastAssignmentSummary = useMemo(
    () => (lastCreatedAssignment ? getCoachAssignmentSummary(lastCreatedAssignment.assignment) : null),
    [lastCreatedAssignment],
  )
  const lastAssignmentCourtHref = useMemo(
    () => (lastCreatedAssignment && lastCreatedAssignmentStudent ? buildCoachAssignmentCourtHref(lastCreatedAssignment, lastCreatedAssignmentStudent) : ''),
    [lastCreatedAssignment, lastCreatedAssignmentStudent],
  )
  const lastAssignmentShareHref = useMemo(
    () => toAbsoluteAppHref(lastAssignmentCourtHref, shareOrigin),
    [lastAssignmentCourtHref, shareOrigin],
  )
  const lastAssignmentNotifyMessage = useMemo(
    () => (lastCreatedAssignment ? buildAssignmentNotifyMessage(lastCreatedAssignment, lastAssignmentSummary, lastAssignmentShareHref) : ''),
    [lastAssignmentSummary, lastAssignmentShareHref, lastCreatedAssignment],
  )
  const lastAssignmentSendChecklist = useMemo(
    () => {
      if (!lastCreatedAssignment || !lastCreatedAssignmentStudent) return []

      return [
        {
          label: 'Start',
          value: lastAssignmentSummary?.detail || lastCreatedAssignment.focus || 'One clear court task',
        },
        {
          label: 'Score',
          value: lastAssignmentSummary?.expectedEvidence || lastAssignmentSummary?.tracker[0] || '0-5 proof back',
        },
        {
          label: 'Send',
          value: lastAssignmentCourtHref
            ? 'Court link ready'
            : lastCreatedAssignmentStudent.playerUserId
              ? 'Player IM ready'
              : lastCreatedAssignmentStudent.playerPhone
                ? 'Text shortcut ready'
                : 'Add Player link or cell',
        },
      ]
    },
    [lastAssignmentCourtHref, lastAssignmentSummary, lastCreatedAssignment, lastCreatedAssignmentStudent],
  )
  const selectedCalendarUrl = selectedContactStudent ? calendarLinkByStudentId[selectedContactStudent.id] : ''
  const selectedCalendarStatus = selectedContactStudent ? calendarFeedStatusByStudentId[selectedContactStudent.id] : null
  const selectedCalendarSubscribed = Boolean(selectedCalendarUrl || selectedCalendarStatus?.active)
  const selectedCalendarStatusLabel = selectedCalendarUrl
    ? 'New calendar link ready.'
    : selectedCalendarStatus?.active
      ? `Subscribed${selectedCalendarStatus.lastUsedAt ? `, calendar app last fetched ${formatCalendarStatusDate(selectedCalendarStatus.lastUsedAt)}` : '. Create a new link to copy it again.'}`
      : 'Not subscribed yet.'
  const sharedLessonCalendarEvents = useMemo(
    () => savedStudents
      .flatMap((student) =>
        buildCoachStudentCalendarEvents(
          assignments.filter((assignment) => assignment.studentLinkId === student.id),
          student,
        ).map((event) => ({ ...event, studentName: student.playerName })),
      )
      .sort((left, right) => getCalendarEventSortKey(left).localeCompare(getCalendarEventSortKey(right)))
      .slice(0, 4),
    [assignments, savedStudents],
  )
  const assignmentsNeedingReview = useMemo(
    () => assignments.filter(assignmentNeedsCoachReview),
    [assignments],
  )
  const assignmentProofById = useMemo(
    () => buildAssignmentProofMap(levelUpSessions),
    [levelUpSessions],
  )
  const assignmentProofsById = useMemo(
    () => buildAssignmentProofListMap(levelUpSessions),
    [levelUpSessions],
  )
  const activeAssignmentsCount = assignments.filter((assignment) => assignment.status === 'assigned').length
  const reviewedAssignmentsCount = assignments.filter((assignment) => Boolean(getCoachAssignmentReview(assignment.assignment))).length
  const recentLevelUpSessions = useMemo(() => levelUpSessions.slice(0, 3), [levelUpSessions])
  const linkedPlayersCount = linkedPlayerCards.filter((card) => card.connection === 'linked').length
  const pendingInviteCount = linkedPlayerCards.filter((card) => card.connection === 'pending').length
  const overduePlayersCount = linkedPlayerCards.filter((card) => card.dueTone === 'overdue' || card.dueTone === 'today').length
  const coachQueueActions = useMemo(
    () => buildCoachQueueActions(linkedPlayerCards, assignmentsNeedingReview, savedStudents.length),
    [assignmentsNeedingReview, linkedPlayerCards, savedStudents.length],
  )
  const coachLoopItems = [
    {
      label: 'Assign',
      value: String(activeAssignmentsCount),
      title: 'One measurable task',
      body: savedStudents.length ? 'Use Level Up packs or a custom assignment while the lesson is fresh.' : 'Add the first student, then send one measurable assignment.',
      href: '#coach-lesson-frame',
    },
    {
      label: 'Review',
      value: String(assignmentsNeedingReview.length),
      title: 'Proof back from players',
      body: assignmentsNeedingReview.length ? 'Start with proof that needs a coach response.' : 'Player proof will land here when assigned work syncs back.',
      href: '#coach-linked-dashboard',
    },
    {
      label: 'Next lesson',
      value: String(sharedLessonCalendarEvents.length),
      title: 'Turn proof into focus',
      body: 'Use the score, note, and due state to choose repeat, simplify, or add pressure.',
      href: '#coach-student-board',
    },
  ]
  const responsiveLinkedDashboardHeaderStyle = isMobile
    ? mobileLinkedDashboardHeaderStyle
    : linkedDashboardHeaderStyle
  const responsiveLinkedMetricGridStyle = isMobile
    ? mobileLinkedMetricGridStyle
    : linkedMetricGridStyle
  const responsiveLinkedCardsGridStyle = isMobile
    ? mobileLinkedCardsGridStyle
    : linkedCardsGridStyle
  const responsiveLinkedPlayerCardStyle = isMobile
    ? mobileLinkedPlayerCardStyle
    : linkedPlayerCardStyle
  const responsiveLinkedCardTopStyle = isMobile
    ? mobileLinkedCardTopStyle
    : linkedCardTopStyle

  useEffect(() => {
    if (!linkedPlayerCards.length) {
      if (activeMobileBenchStudentId) setActiveMobileBenchStudentId('')
      return
    }

    if (!linkedPlayerCards.some((card) => card.student.id === activeMobileBenchStudentId)) {
      setActiveMobileBenchStudentId(linkedPlayerCards[0].student.id)
    }
  }, [activeMobileBenchStudentId, linkedPlayerCards])

  function renderLinkedPlayerCard(card: LinkedPlayerCard, featured = false) {
    const profileHref = getCoachPlayerProfileHref(card.student)
    const assignmentCourtHref = card.latestAssignment ? buildCoachAssignmentCourtHref(card.latestAssignment, card.student) : ''
    const actionLinkStyle = isMobile ? mobileBenchActionStyle : studentActionStyle
    const actionButtonStyle = isMobile ? mobileBenchActionButtonStyle : inlineActionButtonStyle

    return (
      <article
        id={`coach-player-${card.student.id}`}
        key={card.student.id}
        style={featured ? { ...responsiveLinkedPlayerCardStyle, ...mobileBenchFeaturedCardStyle } : responsiveLinkedPlayerCardStyle}
      >
        <div style={responsiveLinkedCardTopStyle}>
          <div>
            <strong>{card.student.playerName}</strong>
            <span>{getIdentityTitle(card.student.identitySlug)} / {card.student.levelLabel || 'Development path'}</span>
          </div>
          <span style={connectionBadgeStyle(card.connection)}>{card.connectionLabel}</span>
        </div>
        <div style={playerProfileRouteStyle}>
          <Link href={profileHref} style={playerProfileLinkStyle} aria-label={`Open ${card.student.playerName} player hub`}>
            Open player hub
          </Link>
          <span>{card.student.playerId ? 'TIQ profile' : 'Development path'}</span>
        </div>
        <div style={linkedBadgeRowStyle}>
          <span style={pressureBadgeStyle(card.dueTone)}>{card.dueLabel}</span>
          <span style={miniBadgeStyle}>{card.activeAssignments} active</span>
          {card.needsReview ? <span style={reviewBadgeStyle}>Needs review</span> : null}
        </div>
        <p style={studentNextStyle}>
          {card.latestAssignment
            ? `${card.latestAssignment.title}: ${card.latestAssignment.focus || 'next coach assignment'}`
            : card.pendingInvite
              ? 'Invite pending. Send setup link, then create the first Level Up assignment.'
              : 'Create a measurable next action from the last lesson.'}
        </p>
        <div style={isMobile ? mobileStudentActionRowStyle : studentActionRowStyle}>
          {assignmentCourtHref ? (
            <Link href={assignmentCourtHref} style={actionLinkStyle}>
              Current work
            </Link>
          ) : null}
          <Link href={getCoachPlannerHref(card.student.identitySlug)} style={actionLinkStyle}>
            Development path
          </Link>
          <button
            type="button"
            onClick={() => loadStudentLevelUpPack(card)}
            style={actionButtonStyle}
          >
            Level Up
          </button>
          <button
            type="button"
            onClick={() => prepareStudentAssignment(card)}
            style={actionButtonStyle}
          >
            Assign work
          </button>
          <button
            type="button"
            onClick={() => prepareStudentContact(card)}
            style={actionButtonStyle}
          >
            Contact
          </button>
          {card.student.playerUserId ? (
            <Link href={buildCoachPlayerMessageHref(card.student, 'Coach check-in', `Quick coach note for ${card.student.playerName}: `)} style={actionLinkStyle}>
              Message
            </Link>
          ) : card.pendingInvite ? (
            <a href={card.pendingInvite.inviteHref} style={actionLinkStyle}>Setup link</a>
          ) : null}
        </div>
      </article>
    )
  }

  function scrollToCoachSection(sectionId: string) {
    window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: isMobile ? 'smooth' : 'auto',
        block: 'start',
      })
    })
  }

  function scrollToCoachLessonFrame() {
    scrollToCoachSection('coach-lesson-frame')
  }

  function scrollToCoachContactPanel() {
    scrollToCoachSection('coach-contact-panel')
  }

  function scrollToCoachBench() {
    scrollToCoachSection('coach-linked-dashboard')
  }

  function chooseMobileBenchPlayer(card: LinkedPlayerCard) {
    setActiveMobileBenchStudentId(card.student.id)
    setAssignmentStudentId(card.student.id)
    setContactStudentId(card.student.id)
  }

  function prepareStudentAssignment(card: LinkedPlayerCard) {
    setActiveMobileBenchStudentId(card.student.id)
    setAssignmentStudentId(card.student.id)
    setContactStudentId(card.student.id)
    setAssignmentTitle('')
    setAssignmentFocus('')
    setAssignmentTemplateId(CUSTOM_ASSIGNMENT_TEMPLATE_ID)
    setAssignmentPresetId('')
    setAssignmentStarterId('')
    setAssignmentLevelUpPackId('')
    setAssignmentLevelUpCardId('')
    setWorkspaceMessage(`Assignment form is ready for ${card.student.playerName}.`)
    scrollToCoachLessonFrame()
  }

  function prepareStudentContact(card: LinkedPlayerCard) {
    setActiveMobileBenchStudentId(card.student.id)
    setContactStudentId(card.student.id)
    setWorkspaceMessage(`Quick contact is ready for ${card.student.playerName}.`)
    scrollToCoachContactPanel()
  }

  function loadStudentLevelUpPack(card: LinkedPlayerCard) {
    const pack = COACH_LEVEL_UP_HANDOFF_PACKS[0]
    if (!pack) return

    setActiveMobileBenchStudentId(card.student.id)
    setAssignmentStudentId(card.student.id)
    setContactStudentId(card.student.id)
    loadLevelUpHandoffPack(pack)
    setWorkspaceMessage(`${pack.title} loaded for ${card.student.playerName}. Review the Level Up cards, then save a draft or create the assignment.`)
    scrollToCoachLessonFrame()
  }

  function renderMobilePlayerWorkspaceRail(surface: 'lesson' | 'contact') {
    if (!isMobile || !activeMobileBenchCard) return null

    return (
      <div style={mobilePlayerWorkspaceRailStyle} aria-label={`Current coach action for ${activeMobileBenchCard.student.playerName}`}>
        <div style={mobilePlayerWorkspaceSummaryStyle}>
          <span>Working on</span>
          <strong>{activeMobileBenchCard.student.playerName}</strong>
        </div>
        <div style={mobilePlayerWorkspaceActionGridStyle}>
          <button type="button" onClick={scrollToCoachBench} style={mobileBenchActionButtonStyle}>
            Bench
          </button>
          <button type="button" onClick={() => loadStudentLevelUpPack(activeMobileBenchCard)} style={mobileBenchActionButtonStyle}>
            Level Up
          </button>
          {surface === 'lesson' ? (
            <button type="button" onClick={() => prepareStudentContact(activeMobileBenchCard)} style={mobileBenchActionButtonStyle}>
              Contact
            </button>
          ) : (
            <button type="button" onClick={() => prepareStudentAssignment(activeMobileBenchCard)} style={mobileBenchActionButtonStyle}>
              Assign
            </button>
          )}
        </div>
      </div>
    )
  }

  function renderAddStudentForm() {
    return (
      <form onSubmit={handleAddStudent} style={formGridStyle}>
        <label style={fieldStyle}>
          Player name
          <input className="tiq-focus-ring" value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="Add a student" style={inputStyle} />
        </label>
        <label style={fieldStyle}>
          Development path
          <select className="tiq-focus-ring" value={studentIdentity} onChange={(event) => setStudentIdentity(event.target.value)} style={inputStyle}>
            {PLAYER_DEVELOPMENT_IDENTITIES.map((identity) => (
              <option key={identity.slug} value={identity.slug}>{identity.title.replace(/^The /, '')}</option>
            ))}
            <option value={CUSTOM_STUDENT_IDENTITY_ID}>Custom path</option>
          </select>
        </label>
        {studentIdentity === CUSTOM_STUDENT_IDENTITY_ID ? (
          <label style={fieldStyle}>
            Custom path name
            <input
              className="tiq-focus-ring"
              value={studentCustomIdentity}
              onChange={(event) => setStudentCustomIdentity(event.target.value)}
              placeholder="Example: lefty doubles returner"
              style={inputStyle}
            />
          </label>
        ) : null}
        <label style={fieldStyle}>
          Level / group
          <input className="tiq-focus-ring" value={studentLevel} onChange={(event) => setStudentLevel(event.target.value)} placeholder="4.0, varsity, clinic..." style={inputStyle} />
        </label>
        <label style={fieldStyle}>
          Player email
          <input className="tiq-focus-ring" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="Optional account email" style={inputStyle} />
        </label>
        <label style={fieldStyle}>
          Cell phone
          <input
            className="tiq-focus-ring"
            inputMode="tel"
            value={studentPhone}
            onChange={(event) => setStudentPhone(event.target.value)}
            placeholder="Optional text setup"
            style={inputStyle}
            aria-invalid={Boolean(addStudentBlockedMessage)}
            aria-describedby="coach-student-phone-help"
          />
          <span id="coach-student-phone-help" style={addStudentBlockedMessage ? fieldErrorStyle : fieldHintStyle}>
            {addStudentBlockedMessage || 'Needed for text setup links and lesson reminders.'}
          </span>
        </label>
        <label style={fieldStyle}>
          Contact
          <select className="tiq-focus-ring" value={contactPreference} onChange={(event) => setContactPreference(event.target.value as CoachStudentLink['contactPreference'])} style={inputStyle}>
            <option value="in_app">TenAceIQ IM</option>
            <option value="text">Text</option>
            <option value="both">IM + text</option>
          </select>
        </label>
        <button type="submit" disabled={addStudentDisabled} style={primaryButtonStyle}>
          {addStudentButtonLabel}
        </button>
      </form>
    )
  }

  function renderFirstAssignmentStarter() {
    return (
      <div style={firstAssignmentStarterStyle}>
        <div>
          <div style={eyebrowStyle}>First assignment starter</div>
          <h3 style={sessionPlannerTitleStyle}>Answer the “what should I work on first?” message.</h3>
          <p style={studentNextStyle}>
            Load a practical first Level Up assignment, then create it and send it from the ready panel.
          </p>
        </div>
        <div style={firstAssignmentStarterGridStyle}>
          {FIRST_ASSIGNMENT_STARTERS.map((starter) => (
            <button
              key={starter.id}
              type="button"
              onClick={() => loadFirstAssignmentStarter(starter)}
              style={starterButtonStyle}
            >
              <strong>{starter.title}</strong>
              <span>{starter.cue}</span>
              <em>Evidence: {starter.evidence}</em>
            </button>
          ))}
        </div>
      </div>
    )
  }

  function renderNextLessonBuilder() {
    return (
      <div style={sessionPlannerStyle}>
        <div style={sessionPlannerHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>Next lesson builder</div>
            <h3 style={sessionPlannerTitleStyle}>{selectedSessionPreset.title}</h3>
          </div>
          <select value={sessionPresetId} onChange={(event) => setSessionPresetId(event.target.value)} style={compactSelectStyle}>
            {COACH_SESSION_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.title}</option>
            ))}
          </select>
        </div>
        <p style={sessionBestForStyle}>{selectedSessionPreset.bestFor}</p>
        <div style={sessionStepGridStyle}>
          <SessionStep label="Objective" value={selectedSessionPreset.objective} />
          <SessionStep label="Drill" value={selectedSessionPreset.drill} />
          <SessionStep label="Pressure game" value={selectedSessionPreset.pressureGame} />
          <SessionStep label="Player prompt" value={selectedSessionPreset.playerPlusPrompt} />
        </div>
        <div style={sessionActionRowStyle}>
          <button type="button" onClick={useSessionPresetForAssignment} style={smallPrimaryButtonStyle}>
            Use as assignment
          </button>
          <Link href="/tactics" style={smallGhostLinkStyle}>
            Build court board
          </Link>
        </div>
      </div>
    )
  }

  function renderSharedLessonCalendar() {
    return (
      <div style={sharedLessonCalendarStyle}>
        <div style={sessionPlannerHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>Shared calendar</div>
            <h3 style={sessionPlannerTitleStyle}>Coach + student lessons.</h3>
            <p style={studentNextStyle}>{selectedContactStudent ? `${selectedContactStudent.playerName}: ${selectedCalendarStatusLabel}` : 'Choose a student to manage a calendar feed.'}</p>
          </div>
          <div style={sessionActionRowStyle}>
            {selectedContactStudent ? (
              <button
                type="button"
                onClick={() => void createStudentCalendarLink(selectedContactStudent)}
                disabled={calendarLinkLoadingStudentId === selectedContactStudent.id}
                style={smallPrimaryButtonStyle}
              >
                {calendarLinkLoadingStudentId === selectedContactStudent.id ? 'Creating...' : selectedCalendarSubscribed ? 'Replace link' : 'Create subscribe link'}
              </button>
            ) : null}
            {selectedContactStudent && selectedCalendarUrl ? (
              <a href={selectedCalendarUrl} style={smallGhostLinkStyle}>
                Open feed
              </a>
            ) : null}
            {selectedContactStudent && selectedCalendarUrl ? (
              <a href={toWebcalUrl(selectedCalendarUrl)} style={smallGhostLinkStyle}>
                Add to calendar
              </a>
            ) : null}
            {selectedContactStudent && selectedCalendarSubscribed ? (
              <button
                type="button"
                onClick={() => void revokeStudentCalendarLink(selectedContactStudent)}
                disabled={calendarLinkLoadingStudentId === selectedContactStudent.id}
                style={smallGhostButtonStyle}
              >
                Revoke feed
              </button>
            ) : null}
          </div>
        </div>
        {sharedLessonCalendarEvents.length ? (
          <div style={sharedLessonCalendarGridStyle}>
            {sharedLessonCalendarEvents.map((event) => (
              <div key={event.id} style={sharedLessonCalendarItemStyle}>
                <strong>{event.title}</strong>
                <span>{formatSharedCalendarEventDate(event)}</span>
                <em>{getSharedCalendarEventDetail(event)}</em>
              </div>
            ))}
          </div>
        ) : (
          <p style={studentNextStyle}>Add a lesson date to an assignment, then create a private subscribe link for the coach and student calendar.</p>
        )}
      </div>
    )
  }

  function renderLessonRhythmBlocks() {
    return (
      <div style={lessonListStyle}>
        {COACH_LESSON_BLOCKS.map((block) => (
          <div key={block.minutes} style={lessonBlockStyle}>
            <span style={lessonTimeStyle}>{block.minutes}</span>
            <span style={lessonCopyStyle}>
              <strong>{block.title}</strong>
              <span>{block.detail}</span>
            </span>
          </div>
        ))}
      </div>
    )
  }

  function renderCoachIntegrationContent() {
    return (
      <>
        <div>
          <div style={eyebrowStyle}>How this fits TenAceIQ</div>
          <h2 style={sectionTitleStyle}>Coach sets the next step. Player carries it between lessons.</h2>
          <p style={bodyStyle}>
            The printed workbook should stand alone, but the best version links the athlete back into TenAceIQ:
            QR check-ins, assigned drills, lesson notes, tactical boards, and weekly recaps.
          </p>
        </div>
        <div style={integrationGridStyle}>
          {COACH_INTEGRATION_STEPS.map((step) => (
            <IntegrationPill key={step.label} label={step.label} value={step.value} />
          ))}
        </div>
      </>
    )
  }

  function renderStudentRecordList() {
    return (
      <div style={studentListStyle}>
        {savedStudents.length > 0
          ? savedStudents.map((student) => {
              const setupInvite = invites.find((invite) => invite.studentLinkId === student.id && invite.status === 'pending')
              return (
              <article key={student.id} style={studentCardStyle}>
                <div style={studentTopStyle}>
                  <strong>{student.playerName}</strong>
                  <span>{getStudentStatusLabel(student.status)}</span>
                </div>
                <div style={studentMetaStyle}>{getIdentityTitle(student.identitySlug)} / {student.levelLabel || 'Development path'}</div>
                {(student.playerEmail || student.playerPhone) ? (
                  <div style={studentContactStyle}>
                    {student.playerEmail ? <span>{student.playerEmail}</span> : null}
                    {student.playerPhone ? <span>{student.playerPhone}</span> : null}
                    <span>{getSetupStatusLabel(student)}</span>
                  </div>
                ) : null}
                <p style={studentNextStyle}>{student.notes || 'Create one assignment from today\'s lesson and connect it to a measurable court behavior.'}</p>
                <div style={studentActionRowStyle}>
                  <Link href={getCoachPlannerHref(student.identitySlug)} style={studentActionStyle}>Open path</Link>
                  {setupInvite ? (
                    <>
                      <a href={setupInvite.inviteHref} style={studentActionStyle}>Setup link</a>
                      {student.playerPhone ? (
                        <SmsActionLink phone={student.playerPhone} body={buildCoachSetupText(setupInvite.inviteHref)} style={studentActionStyle}>
                          Text setup
                        </SmsActionLink>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void copyCoachText(
                          buildCoachSetupText(setupInvite.inviteHref),
                          `Setup text copied for ${student.playerName}.`,
                          `Setup text for ${student.playerName}: ${buildCoachSetupText(setupInvite.inviteHref)}`,
                        )}
                        style={inlineActionButtonStyle}
                      >
                        Copy setup
                      </button>
                    </>
                  ) : null}
                  {student.playerUserId ? (
                    <>
                      <Link href={buildCoachPlayerMessageHref(student, 'Coach check-in', `Quick coach note for ${student.playerName}: `)} style={studentActionStyle}>
                        Message player
                      </Link>
                      <Link
                        href={buildCoachPlayerMessageHref(
                          student,
                          'Next lesson schedule',
                          `Let's confirm the next lesson for ${student.playerName}. Date/time:  Site:  Focus: `,
                        )}
                        style={studentActionStyle}
                      >
                        Schedule lesson
                      </Link>
                    </>
                  ) : null}
                  {student.playerPhone ? (
                    <SmsActionLink phone={student.playerPhone} body="Let's confirm your next lesson. Date/time:  Site:  Focus: " style={studentActionStyle}>
                      Text lesson
                    </SmsActionLink>
                  ) : null}
                </div>
              </article>
              )
            })
          : studentSnapshots.map((student) => (
              <article key={student.id} style={studentCardStyle}>
                <div style={studentTopStyle}>
                  <strong>{student.name}</strong>
                  <span>{student.status}</span>
                </div>
                <div style={studentMetaStyle}>{student.identity} / {student.level}</div>
                <p style={studentNextStyle}>{student.nextStep}</p>
                <Link href={getCoachPlannerHref(student.identitySlug)} style={studentActionStyle}>Open path</Link>
              </article>
            ))}
      </div>
    )
  }

  function loadLevelUpHandoffPack(pack: CoachLevelUpHandoffPack) {
    const primaryCard = LEVEL_UP_CARDS.find((card) => card.id === pack.cardIds[0])

    setAssignmentTitle(pack.assignmentTitle)
    setAssignmentFocus(pack.focus)
    setAssignmentTemplateId(CUSTOM_ASSIGNMENT_TEMPLATE_ID)
    setAssignmentPresetId('')
    setAssignmentStarterId('')
    setAssignmentLevelUpPackId(pack.id)
    setAssignmentLevelUpCardId(primaryCard?.id ?? '')
    setLessonFocus(pack.focus)
    setWorkspaceMessage(`${pack.title} loaded into the coach assignment form.`)
  }

  async function saveLevelUpHandoffPackDraft(pack: CoachLevelUpHandoffPack) {
    if (!assignmentStudentId) {
      loadLevelUpHandoffPack(pack)
      setWorkspaceMessage(`${pack.title} loaded. Choose a student, then save the draft assignment.`)
      return
    }

    await saveCoachAssignment('draft', pack)
  }

  function loadDraftAssignment(assignment: CoachAssignment) {
    const packId = typeof assignment.assignment.levelUpPackId === 'string' ? assignment.assignment.levelUpPackId : ''
    const cardId = typeof assignment.assignment.cardId === 'string' ? assignment.assignment.cardId : ''
    const packProgress = getCoachAssignmentPackProgress(assignment.assignment)

    setAssignmentEditId(assignment.id)
    setAssignmentStudentId(assignment.studentLinkId)
    setAssignmentTitle(assignment.title)
    setAssignmentFocus(assignment.focus)
    setAssignmentDueDate(assignment.dueDate ?? '')
    setAssignmentTemplateId(CUSTOM_ASSIGNMENT_TEMPLATE_ID)
    setAssignmentPresetId('')
    setAssignmentStarterId('')
    setAssignmentLevelUpPackId(packId)
    setAssignmentLevelUpCardId(cardId || packProgress?.pack.items[0]?.cardId || '')
    setLessonFocus(assignment.focus)
    setWorkspaceMessage(`${assignment.title} loaded from drafts. Update it or assign when ready.`)
  }

  if (!authResolved || role === 'public') return null

  if (!access.canUseCoachWorkflow) {
    return (
      <LockedPlanPage
        active="/coach"
        withinShell
        planId="coach"
        headline="Unlock Coach to keep player development moving."
        body="Coach Hub keeps lesson plans, Tactical Studio boards, drill assignments, player development tracking, reviews, and scheduling tied to the lesson loop."
        result="Assign the next step, review player proof, and support players between sessions without chasing scattered notes."
        ctaLabel="Unlock Coach"
        secondaryLabel="Compare Full-Court"
        secondaryHref="/pricing#full_court"
      />
    )
  }

  return (
    <main style={pageStyle}>
      {isMobile ? (
        <h1 style={visuallyHiddenStyle}>Coach Hub</h1>
      ) : (
        <>
          <section style={heroStyle}>
            <div style={heroCopyStyle}>
              <div style={eyebrowStyle}>Coach Hub</div>
              <h1 style={titleStyle}>Assign the next step. Track the player. Support the work between lessons.</h1>
              <p style={bodyStyle}>
                Coach is for private teachers, development coaches, and team coaches who need drills, proof, resources, and player follow-through between lessons.
                Team competition operations stay in Captain; Full-Court includes both.
              </p>
              <div style={heroActionsStyle}>
                <Link href="/tactics" style={primaryLinkStyle}>Open Tactical Studio</Link>
                <Link href="/player-development" style={secondaryLinkStyle}>Open development paths</Link>
              </div>
            </div>
            <div style={heroPanelStyle}>
              <TiqFeatureIcon name="scenarioBuilder" size="xl" variant="surface" />
              <strong>Player connection</strong>
              <span>Standalone guides stay useful on paper. Linked players get check-ins, assignments, reviewed proof, and progress history inside TenAceIQ.</span>
            </div>
          </section>

          <section style={coachLoopStripStyle} aria-label="Coach player loop">
            {coachLoopItems.map((item) => (
              <a key={item.label} href={item.href} style={coachLoopItemStyle}>
                <span style={coachLoopMetricStyle}>{item.label} / {item.value}</span>
                <strong>{item.title}</strong>
                <small>{item.body}</small>
              </a>
            ))}
          </section>

          <section style={coachSupportPathStyle} aria-labelledby="coach-support-path-title">
            <div style={coachSupportPathHeaderStyle}>
              <div>
                <div style={eyebrowStyle}>Coach support path</div>
                <h2 id="coach-support-path-title" style={coachSupportPathTitleStyle}>{PRODUCT_MOTTO}</h2>
              </div>
              <p style={coachSupportPathIntroStyle}>
                Start with the coaching question that keeps a player moving between sessions.
              </p>
            </div>
            <div style={coachSupportPathGridStyle}>
              {COACH_SUPPORT_PATHS.map((path) => (
                <Link
                  key={path.job}
                  href={path.href}
                  style={coachSupportPathCardStyle}
                  data-coach-path-job={path.job}
                  aria-label={`${path.cta}: ${path.question}`}
                >
                  <TiqFeatureIcon name={path.icon} size="sm" variant="ghost" />
                  <span style={coachSupportPathCopyStyle}>
                    <em>{path.question}</em>
                    <strong>{path.title}</strong>
                    <span>{path.body}</span>
                    <span style={coachSupportPathCtaStyle}>{path.cta}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section style={commandGridStyle} aria-label="Coach workflow">
            {COACH_WORKSPACE_COMMANDS.map((command) => (
              <Link key={command.title} href={command.href} style={commandCardStyle}>
                <TiqFeatureIcon name={command.icon} size="md" variant="ghost" />
                <span style={commandCopyStyle}>
                  <strong>{command.title}</strong>
                  <span>{command.detail}</span>
                  <em>{command.cta}</em>
                </span>
              </Link>
            ))}
          </section>
        </>
      )}

      {levelUpHandoffPack ? (
        <section style={levelUpCoachHandoffStyle} aria-label="Level Up coach assignment bridge">
          <div style={levelUpCoachHandoffHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Level Up handoff</div>
              <h2 style={sectionTitleStyle}>Assign {levelUpHandoffPack.title} from Coach Hub.</h2>
              <p style={bodyStyle}>{levelUpHandoffPack.detail}</p>
            </div>
            <span style={reviewBadgeStyle}>Coach assignment bridge</span>
          </div>
          <div style={levelUpCoachHandoffGridStyle}>
            {levelUpHandoffPack.cardIds.map((cardId) => {
              const card = LEVEL_UP_CARDS.find((item) => item.id === cardId)
              if (!card) return null

              return (
                <article key={card.id} style={levelUpCoachHandoffCardStyle}>
                  <strong>{card.title}</strong>
                  <span>{card.pack} / {card.durationMinutes} min</span>
                  <em>{card.proof}</em>
                </article>
              )
            })}
          </div>
          <div style={studentActionRowStyle}>
            <button type="button" onClick={() => loadLevelUpHandoffPack(levelUpHandoffPack)} style={smallPrimaryButtonStyle}>
              Load into assignment form
            </button>
            <button
              type="button"
              onClick={() => void saveLevelUpHandoffPackDraft(levelUpHandoffPack)}
              disabled={workspaceLoading}
              style={smallGhostButtonStyle}
            >
              Save draft assignment
            </button>
            <a href="#coach-lesson-frame" style={smallGhostLinkStyle}>Jump to lesson frame</a>
          </div>
        </section>
      ) : null}

      {draftAssignments.length ? (
        <section style={levelUpCoachHandoffStyle} aria-label="Coach assignment drafts">
          <div style={levelUpCoachHandoffHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Draft assignments</div>
              <h2 style={sectionTitleStyle}>Finish or assign saved Level Up packs.</h2>
              <p style={bodyStyle}>Drafts stay in Coach Hub until you assign, edit, or archive them.</p>
            </div>
            <span style={reviewBadgeStyle}>{draftAssignments.length} draft{draftAssignments.length === 1 ? '' : 's'}</span>
          </div>
          <div style={levelUpCoachHandoffGridStyle}>
            {draftAssignments.map((assignment) => {
              const packProgress = getCoachAssignmentPackProgress(assignment.assignment)
              const student = savedStudents.find((candidate) => candidate.id === assignment.studentLinkId)
              return (
                <article key={assignment.id} style={levelUpCoachHandoffCardStyle}>
                  <strong>{assignment.title}</strong>
                  <span>{student?.playerName ?? 'Student'} / {assignment.focus || 'Coach assignment'}</span>
                  {packProgress ? <em>{packProgress.pack.title}: {packProgress.total} linked cards</em> : null}
                  <div style={studentActionRowStyle}>
                    <button type="button" onClick={() => loadDraftAssignment(assignment)} style={smallGhostButtonStyle}>
                      Load draft
                    </button>
                    <button type="button" onClick={() => void updateAssignmentStatus(assignment, 'assigned')} disabled={workspaceLoading} style={smallPrimaryButtonStyle}>
                      Assign now
                    </button>
                    <button type="button" onClick={() => void updateAssignmentStatus(assignment, 'archived')} disabled={workspaceLoading} style={smallGhostButtonStyle}>
                      Archive
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ) : null}

      <section id="coach-linked-dashboard" style={linkedDashboardStyle} aria-label="Coach player bench">
        <div style={responsiveLinkedDashboardHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>Player bench</div>
            <h2 style={sectionTitleStyle}>Open a player, then move their work forward.</h2>
            <p style={bodyStyle}>
              Your bench keeps each player profile, development path, active assignment, setup link, and coach contact path in one place.
            </p>
          </div>
          <div style={responsiveLinkedMetricGridStyle}>
            <DashboardMetric label="Linked" value={linkedPlayersCount} />
            <DashboardMetric label="Pending" value={pendingInviteCount} />
            <DashboardMetric label="Review" value={assignmentsNeedingReview.length} />
            <DashboardMetric label="Due now" value={overduePlayersCount} />
            <DashboardMetric label="Level Up" value={levelUpSessions.length} />
          </div>
        </div>
        <div style={coachQueueStyle} aria-label="Coach priority queue">
          <div style={coachQueueIntroStyle}>
            <div style={eyebrowStyle}>Today&apos;s coach queue</div>
            <strong>Start with the player who needs action first.</strong>
          </div>
          <div style={coachQueueGridStyle}>
            {coachQueueActions.map((action) => (
              <a key={action.title} href={action.href} style={coachQueueCardStyle(action.tone)}>
                <span style={coachQueueToneStyle(action.tone)}>{action.label}</span>
                <strong>{action.title}</strong>
                <em>{action.detail}</em>
              </a>
            ))}
          </div>
        </div>
        {isMobile && linkedPlayerCards.length ? (
          <div style={mobileBenchShellStyle}>
            <div style={mobileBenchPickerStyle} aria-label="Choose a player from your coach bench">
              {linkedPlayerCards.map((card) => {
                const active = activeMobileBenchCard?.student.id === card.student.id
                return (
                  <button
                    key={card.student.id}
                    type="button"
                    onClick={() => chooseMobileBenchPlayer(card)}
                    aria-pressed={active}
                    style={mobileBenchPlayerButtonStyle(active)}
                  >
                    <strong>{card.student.playerName}</strong>
                    <span>{card.needsReview ? 'Review' : card.activeAssignments ? `${card.activeAssignments} active` : card.connectionLabel}</span>
                  </button>
                )
              })}
            </div>
            {activeMobileBenchCard ? renderLinkedPlayerCard(activeMobileBenchCard, true) : null}
          </div>
        ) : (
          <div style={responsiveLinkedCardsGridStyle}>
            {linkedPlayerCards.length ? linkedPlayerCards.map((card) => renderLinkedPlayerCard(card)) : (
            <article style={linkedEmptyStyle}>
              <strong>No linked players yet.</strong>
              <span>Add a student below, then send a setup link when you want the Player layer connected.</span>
            </article>
            )}
          </div>
        )}
      </section>

      <section style={workspaceGridStyle}>
        <div id="coach-student-board" style={panelStyle}>
          <PanelHeader eyebrow="Student board" title="Give each player a clear next action." />
          {isMobile && savedStudents.length > 0 ? (
            <details
              {...(hasStudentFormDraft ? { open: true } : {})}
              style={mobileStudentRecordsDisclosureStyle}
            >
              <summary style={mobileStudentRecordsSummaryStyle}>
                <span>Add or invite player</span>
                <strong>{hasStudentFormDraft ? 'Draft open' : 'Open'}</strong>
              </summary>
              <div style={mobileStudentRecordsBodyStyle}>
                {renderAddStudentForm()}
              </div>
            </details>
          ) : renderAddStudentForm()}
          {lastCreatedStudentSetup ? (
            <div style={assignmentSendPanelStyle}>
              <div>
                <div style={eyebrowStyle}>Student setup ready</div>
                <h3 style={sessionPlannerTitleStyle}>{lastCreatedStudentSetup.student.playerName}</h3>
                <p style={studentNextStyle}>
                  {lastCreatedStudentSetup.invite
                    ? 'Send the setup link now, then create the first measurable assignment.'
                    : 'Student saved. Add a cell or email any time when you want to send the setup link.'}
                </p>
              </div>
              <div style={sessionActionRowStyle}>
                {lastCreatedStudentSetup.invite ? (
                  <a href={lastCreatedStudentSetup.invite.inviteHref} style={smallGhostLinkStyle}>
                    Open setup link
                  </a>
                ) : null}
                {lastCreatedStudentSetup.invite && lastCreatedStudentSetup.student.playerPhone ? (
                  <SmsActionLink
                    phone={lastCreatedStudentSetup.student.playerPhone}
                    body={buildCoachSetupText(lastCreatedStudentSetup.invite.inviteHref)}
                    style={smallPrimaryLinkStyle}
                  >
                    Text setup now
                  </SmsActionLink>
                ) : lastCreatedStudentSetup.student.playerPhone ? (
                  <SmsActionLink
                    phone={lastCreatedStudentSetup.student.playerPhone}
                    body={`Let's confirm your next lesson. Date/time:  Site:  Focus: `}
                    style={smallGhostLinkStyle}
                  >
                    Text lesson
                  </SmsActionLink>
                ) : (
                  <span style={disabledPillStyle}>Add cell for text</span>
                )}
                {lastCreatedStudentSetup.invite ? (
                  <button
                    type="button"
                    onClick={() => void copyCoachText(
                      buildCoachSetupText(lastCreatedStudentSetup.invite!.inviteHref),
                      `Setup text copied for ${lastCreatedStudentSetup.student.playerName}.`,
                      `Setup text for ${lastCreatedStudentSetup.student.playerName}: ${buildCoachSetupText(lastCreatedStudentSetup.invite!.inviteHref)}`,
                    )}
                    style={smallGhostButtonStyle}
                  >
                    Copy setup text
                  </button>
                ) : null}
                <button type="button" onClick={() => setLastCreatedStudentSetup(null)} style={smallGhostButtonStyle}>
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
          {isMobile && savedStudents.length > 0 ? (
            <details style={mobileStudentRecordsDisclosureStyle}>
              <summary style={mobileStudentRecordsSummaryStyle}>
                <span>Saved student records</span>
                <strong>{savedStudents.length} total</strong>
              </summary>
              <div style={mobileStudentRecordsBodyStyle}>
                {renderStudentRecordList()}
              </div>
            </details>
          ) : renderStudentRecordList()}
          <div style={assignmentListStyle}>
            {invites.slice(0, 3).map((invite) => {
              const inviteStudent = savedStudents.find((student) => student.id === invite.studentLinkId)
              return (
                <article key={invite.id} style={assignmentCardStyle}>
                  <strong>{invite.inviteEmail || inviteStudent?.playerName || 'Coach invite link'}</strong>
                  <span>{getInviteStatusLabel(invite.status)}</span>
                  <div style={studentActionRowStyle}>
                    <a href={invite.inviteHref} style={studentActionStyle}>Open setup link</a>
                    {inviteStudent?.playerPhone ? (
                      <SmsActionLink
                        phone={inviteStudent.playerPhone}
                        body={buildCoachSetupText(invite.inviteHref)}
                        style={studentActionStyle}
                      >
                        Text setup link
                      </SmsActionLink>
                    ) : null}
                    {inviteStudent ? (
                      <button
                        type="button"
                        onClick={() => void copyCoachText(
                          buildCoachSetupText(invite.inviteHref),
                          `Setup text copied for ${inviteStudent.playerName}.`,
                          `Setup text for ${inviteStudent.playerName}: ${buildCoachSetupText(invite.inviteHref)}`,
                        )}
                        style={inlineActionButtonStyle}
                      >
                        Copy setup text
                      </button>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        <div id="coach-lesson-frame" style={panelStyle}>
          <PanelHeader eyebrow="Lesson frame" title="Plan the session, then assign the follow-through." />
          {renderMobilePlayerWorkspaceRail('lesson')}
          <form onSubmit={handleCreateAssignment} style={formGridStyle}>
            <label style={fieldStyle}>
              Student
              <select className="tiq-focus-ring" value={assignmentStudentId} onChange={(event) => setAssignmentStudentId(event.target.value)} style={inputStyle}>
                <option value="">Choose student</option>
                {savedStudents.map((student) => (
                  <option key={student.id} value={student.id}>{student.playerName}</option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              Template
              <select className="tiq-focus-ring" value={assignmentTemplateId} onChange={(event) => handleAssignmentTemplateChange(event.target.value)} style={inputStyle}>
                <option value={CUSTOM_ASSIGNMENT_TEMPLATE_ID}>Custom assignment</option>
                {COACH_ASSIGNMENT_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>{template.title}</option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              Assignment
              <input className="tiq-focus-ring" value={assignmentTitle} onChange={(event) => setAssignmentTitle(event.target.value)} placeholder="Example: 60 serve targets" style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              Focus
              <input className="tiq-focus-ring" value={assignmentFocus} onChange={(event) => setAssignmentFocus(event.target.value)} placeholder="Serve, return, movement..." style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              Due date
              <input className="tiq-focus-ring" type="date" value={assignmentDueDate} onChange={(event) => setAssignmentDueDate(event.target.value)} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              Lesson date / time
              <input className="tiq-focus-ring" type="datetime-local" value={lessonDateTime} onChange={(event) => setLessonDateTime(event.target.value)} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              Lesson focus note
              <input className="tiq-focus-ring" value={lessonFocus} onChange={(event) => setLessonFocus(event.target.value)} placeholder="Serve + first ball" style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              Lesson location
              <input className="tiq-focus-ring" value={lessonLocation} onChange={(event) => setLessonLocation(event.target.value)} placeholder="Court or facility" style={inputStyle} />
            </label>
            <div style={levelUpAssignmentPickerStyle}>
              <label style={fieldStyle}>
                Assign exact Level Up card
                <select
                  className="tiq-focus-ring"
                  value={assignmentLevelUpCardId}
                  onChange={(event) => setAssignmentLevelUpCardId(event.target.value)}
                  style={inputStyle}
                >
                  <option value="">Auto-match best card</option>
                  {LEVEL_UP_CARDS.filter((card) => card.assignable).map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.title} - {card.durationMinutes} min
                    </option>
                  ))}
                </select>
              </label>
              <div style={levelUpAssignmentSuggestionGridStyle}>
                {suggestedLevelUpAssignmentCards.slice(0, 4).map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setAssignmentLevelUpCardId(card.id)}
                    style={levelUpAssignmentCardButtonStyle(selectedLevelUpAssignmentCard?.id === card.id)}
                  >
                    <strong>{card.title}</strong>
                    <span>{card.pack} / {card.durationMinutes} min</span>
                    <em>{card.proof}</em>
                  </button>
                ))}
              </div>
              {selectedLevelUpAssignmentCard ? (
                <div style={levelUpAssignmentPreviewStyle}>
                  <strong>{selectedLevelUpAssignmentCard.title}</strong>
                  <span>
                    Portal match: {selectedLevelUpAssignmentModule?.title ?? 'Single card'} / Proof: {selectedLevelUpAssignmentCard.proof}
                  </span>
                  {selectedLevelUpAssignmentStandard ? (
                    <div style={levelUpAssignmentStandardStyle} aria-label="Coach assignment standard">
                      <span>Coach assignment standard</span>
                      <div style={levelUpAssignmentStandardGridStyle}>
                        <span style={levelUpAssignmentStandardItemStyle}>
                          <b style={levelUpAssignmentStandardLabelStyle}>Player sees</b>
                          {selectedLevelUpAssignmentStandard.playerSees}
                        </span>
                        <span style={levelUpAssignmentStandardItemStyle}>
                          <b style={levelUpAssignmentStandardLabelStyle}>Coach watches</b>
                          {selectedLevelUpAssignmentStandard.coachWatches}
                        </span>
                        <span style={levelUpAssignmentStandardItemStyle}>
                          <b style={levelUpAssignmentStandardLabelStyle}>Common leak</b>
                          {selectedLevelUpAssignmentStandard.commonLeak}
                        </span>
                        <span style={levelUpAssignmentStandardItemStyle}>
                          <b style={levelUpAssignmentStandardLabelStyle}>Next rep</b>
                          {selectedLevelUpAssignmentStandard.nextRep}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {selectedLevelUpAssignmentPack ? (
                <div style={levelUpAssignmentPreviewStyle}>
                  <strong>Coach assigned pack: {selectedLevelUpAssignmentPack.title}</strong>
                  <span>{selectedLevelUpAssignmentPack.cardIds.length} linked cards will appear as one My Lab assignment queue.</span>
                </div>
              ) : null}
            </div>
            <button type="submit" disabled={workspaceLoading || !assignmentStudentId || !assignmentTitle.trim()} style={primaryButtonStyle}>
              {workspaceLoading ? 'Saving...' : assignmentEditId ? 'Update assignment' : 'Create assignment'}
            </button>
          </form>
          {isMobile ? (
            <details style={mobileStudentRecordsDisclosureStyle}>
              <summary style={mobileStudentRecordsSummaryStyle}>
                <span>First assignment starters</span>
                <strong>{FIRST_ASSIGNMENT_STARTERS.length} options</strong>
              </summary>
              <div style={mobileStudentRecordsBodyStyle}>
                {renderFirstAssignmentStarter()}
              </div>
            </details>
          ) : renderFirstAssignmentStarter()}
          {workspaceMessage ? <div style={messageStyle}>{workspaceMessage}</div> : null}
          {lastCreatedAssignment && lastCreatedAssignmentStudent ? (
            <div style={assignmentSendPanelStyle}>
              <div>
                <div style={eyebrowStyle}>Assignment ready</div>
                <h3 style={sessionPlannerTitleStyle}>{lastCreatedAssignment.title}</h3>
                <p style={studentNextStyle}>
                  Send to {lastCreatedAssignmentStudent.playerName}. Player accounts can receive this inside TenAceIQ; cell numbers can use the free text shortcut.
                </p>
              </div>
              <div style={assignmentSendChecklistStyle} aria-label="Assignment send checklist">
                {lastAssignmentSendChecklist.map((item) => (
                  <span key={item.label} style={assignmentSendChecklistItemStyle}>
                    <b style={assignmentSendChecklistLabelStyle}>{item.label}</b>
                    {item.value}
                  </span>
                ))}
              </div>
              <div style={sessionActionRowStyle}>
                {lastCreatedAssignmentStudent.playerUserId ? (
                  <Link
                    href={buildCoachPlayerMessageHref(
                      lastCreatedAssignmentStudent,
                      lastCreatedAssignment.title,
                      lastAssignmentNotifyMessage,
                      {
                        assignmentId: lastCreatedAssignment.id,
                        assignmentTitle: lastCreatedAssignment.title,
                        assignmentFocus: lastCreatedAssignment.focus,
                        assignmentCardId: getCoachAssignmentCourtCardId(lastCreatedAssignment),
                      },
                    )}
                    style={smallPrimaryLinkStyle}
                  >
                    Send IM
                  </Link>
                ) : (
                  <span style={disabledPillStyle}>Link Player for IM</span>
                )}
                {lastCreatedAssignmentStudent.playerPhone ? (
                  <SmsActionLink phone={lastCreatedAssignmentStudent.playerPhone} body={lastAssignmentNotifyMessage} style={smallGhostLinkStyle}>
                    Send text
                  </SmsActionLink>
                ) : (
                  <span style={disabledPillStyle}>Add cell for text</span>
                )}
                {lastAssignmentNotifyMessage ? (
                  <button
                    type="button"
                    onClick={() => void copyCoachText(
                      lastAssignmentNotifyMessage,
                      `Assignment text copied for ${lastCreatedAssignmentStudent.playerName}.`,
                      `Assignment text for ${lastCreatedAssignmentStudent.playerName}: ${lastAssignmentNotifyMessage}`,
                    )}
                    style={smallGhostButtonStyle}
                  >
                    Copy assignment text
                  </button>
                ) : null}
                {lastAssignmentCourtHref ? (
                  <button
                    type="button"
                    onClick={() => void copyCoachAssignmentCourtLink(lastAssignmentShareHref, lastCreatedAssignmentStudent.playerName)}
                    style={smallGhostButtonStyle}
                  >
                    Copy court link
                  </button>
                ) : null}
                {lastAssignmentCourtHref ? (
                  <Link href={lastAssignmentCourtHref} style={smallGhostLinkStyle}>
                    Open court link
                  </Link>
                ) : null}
                <button type="button" onClick={() => setLastCreatedAssignment(null)} style={smallGhostButtonStyle}>
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
          <div id="coach-contact-panel" style={contactPanelStyle}>
            <div style={sessionPlannerHeaderStyle}>
              <div>
                <div style={eyebrowStyle}>Quick contact</div>
                <h3 style={sessionPlannerTitleStyle}>Confirm the next lesson.</h3>
              </div>
              <select value={contactStudentId} onChange={(event) => setContactStudentId(event.target.value)} style={compactSelectStyle}>
                <option value="">Choose student</option>
                {savedStudents.map((student) => (
                  <option key={student.id} value={student.id}>{student.playerName}</option>
                ))}
              </select>
            </div>
            {renderMobilePlayerWorkspaceRail('contact')}
            <div style={sessionStepGridStyle}>
              <label style={fieldStyle}>
                Date / time
                <input className="tiq-focus-ring" type="datetime-local" value={lessonDateTime} onChange={(event) => setLessonDateTime(event.target.value)} style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                Lesson focus
                <input className="tiq-focus-ring" value={lessonFocus} onChange={(event) => setLessonFocus(event.target.value)} placeholder="Serve + first ball" style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                Location
                <input className="tiq-focus-ring" value={lessonLocation} onChange={(event) => setLessonLocation(event.target.value)} placeholder="Court or facility" style={inputStyle} />
              </label>
            </div>
            <p style={studentNextStyle}>{lessonMessage}</p>
            <div style={sessionActionRowStyle}>
              {selectedContactStudent?.playerUserId ? (
                <Link
                  href={buildCoachPlayerMessageHref(selectedContactStudent, 'Next lesson schedule', lessonMessage)}
                  style={smallPrimaryLinkStyle}
                >
                  Send IM
                </Link>
              ) : (
                <span style={disabledPillStyle}>Link Player for IM</span>
              )}
              {selectedContactStudent?.playerPhone ? (
                <SmsActionLink phone={selectedContactStudent.playerPhone} body={lessonMessage} style={smallGhostLinkStyle}>
                  Send text
                </SmsActionLink>
              ) : (
                <span style={disabledPillStyle}>Add cell for text</span>
              )}
            </div>
          </div>
          {savedStudents.length ? (
            isMobile ? (
              <details
                {...(selectedCalendarSubscribed ? { open: true } : {})}
                style={mobileStudentRecordsDisclosureStyle}
              >
                <summary style={mobileStudentRecordsSummaryStyle}>
                  <span>Shared calendar</span>
                  <strong>{sharedLessonCalendarEvents.length ? `${sharedLessonCalendarEvents.length} events` : selectedCalendarStatusLabel}</strong>
                </summary>
                <div style={mobileStudentRecordsBodyStyle}>
                  {renderSharedLessonCalendar()}
                </div>
              </details>
            ) : renderSharedLessonCalendar()
          ) : null}
          <div style={reviewQueueStyle}>
            <div style={reviewQueueMetricStyle}>
              <span>Needs review</span>
              <strong>{assignmentsNeedingReview.length}</strong>
            </div>
            <div style={reviewQueueMetricStyle}>
              <span>Active</span>
              <strong>{activeAssignmentsCount}</strong>
            </div>
            <div style={reviewQueueMetricStyle}>
              <span>Reviewed</span>
              <strong>{reviewedAssignmentsCount}</strong>
            </div>
          </div>
          {isMobile ? (
            <details style={mobileStudentRecordsDisclosureStyle}>
              <summary style={mobileStudentRecordsSummaryStyle}>
                <span>Next lesson builder</span>
                <strong>{selectedSessionPreset.title}</strong>
              </summary>
              <div style={mobileStudentRecordsBodyStyle}>
                {renderNextLessonBuilder()}
              </div>
            </details>
          ) : renderNextLessonBuilder()}
          {isMobile ? (
            <details style={mobileStudentRecordsDisclosureStyle}>
              <summary style={mobileStudentRecordsSummaryStyle}>
                <span>Lesson rhythm</span>
                <strong>{COACH_LESSON_BLOCKS.length} blocks</strong>
              </summary>
              <div style={mobileStudentRecordsBodyStyle}>
                {renderLessonRhythmBlocks()}
              </div>
            </details>
          ) : renderLessonRhythmBlocks()}
          <details
            open={!isMobile || assignmentsNeedingReview.length > 0}
            style={isMobile ? mobileStudentRecordsDisclosureStyle : openAssignmentQueueDisclosureStyle}
          >
            <summary style={isMobile ? mobileStudentRecordsSummaryStyle : hiddenSummaryStyle}>
              <span>Assignment review queue</span>
              <strong>
                {assignmentsNeedingReview.length
                  ? `${assignmentsNeedingReview.length} review`
                  : sortedAssignments.length
                    ? `${sortedAssignments.length} saved`
                    : 'Empty'}
              </strong>
            </summary>
            <div style={isMobile ? mobileStudentRecordsBodyStyle : openAssignmentQueueBodyStyle}>
          <div style={assignmentListStyle}>
            {recentLevelUpSessions.length ? (
              <article style={assignmentCardStyle}>
                <div style={assignmentTopStyle}>
                  <strong>Recent Level Up logs</strong>
                  <span style={assignmentStatusStyle('completed')}>Player signal</span>
                </div>
                {recentLevelUpSessions.map((log) => {
                  const student = savedStudents.find((candidate) => candidate.id === log.studentLinkId)
                  return (
                    <div key={log.id} style={checkInReviewStyle}>
                      <strong>{student?.playerName || 'Linked player'} / {log.focusTitle}</strong>
                      <span>{log.drillTitle}: {log.rating}/5, {formatClock(log.elapsedSeconds)}, {log.feeling}</span>
                      {log.note ? <em>{log.note}</em> : null}
                    </div>
                  )
                })}
              </article>
            ) : null}
            {sortedAssignments.length > 0 ? (
              sortedAssignments.slice(0, 6).map((assignment) => {
                const playerCheckIn = getPlayerAssignmentCheckIn(assignment.assignment)
                const coachReview = getCoachAssignmentReview(assignment.assignment)
                const assignmentSummary = getCoachAssignmentSummary(assignment.assignment)
                const packProgress = getCoachAssignmentPackProgress(assignment.assignment)
                const dueState = getCoachAssignmentDueState(assignment.dueDate)
                const student = savedStudents.find((candidate) => candidate.id === assignment.studentLinkId)
                const levelUpProof = assignmentProofById.get(assignment.id)
                const levelUpProofs = assignmentProofsById.get(assignment.id) ?? []
                const levelUpVisibilitySteps = buildCoachAssignmentVisibilitySteps(assignment, levelUpProof, levelUpProofs)
                const reviewReady = Boolean(playerCheckIn || levelUpProof)
                const proofReviewDraft = levelUpProof ? buildLevelUpProofReviewDraft(levelUpProof, assignment) : null
                const proofReviewDecisions = levelUpProof ? buildLevelUpProofReviewDecisions(levelUpProof, assignment) : []
                const proofReviewStandard = levelUpProof ? buildCoachProofReviewStandard(assignment, levelUpProof) : null
                const lessonDateTime = getAssignmentLessonDateTime(assignment.assignment)
                const assignmentCourtHref = student ? buildCoachAssignmentCourtHref(assignment, student) : ''
                const assignmentShareHref = toAbsoluteAppHref(assignmentCourtHref, shareOrigin)
                return (
                  <article key={assignment.id} id={`coach-assignment-${assignment.id}`} style={assignmentCardStyle}>
                    <div style={assignmentTopStyle}>
                      <strong>{assignment.title}</strong>
                      <span style={assignmentStatusStyle(assignment.status)}>{getAssignmentStatusLabel(assignment.status)}</span>
                    </div>
                    <span>{student?.playerName || 'Student'} / {assignment.focus || 'Coach assignment'}</span>
                    <span style={assignmentDueStyle(dueState.tone)}>{dueState.label}</span>
                    {lessonDateTime ? (
                      <span style={assignmentDueStyle('future')}>Lesson {formatLessonDateTimeForMessage(lessonDateTime)}</span>
                    ) : null}
                    <div style={assignmentLevelUpStatusRailStyle} aria-label={`Level Up assignment visibility for ${assignment.title}`}>
                      {levelUpVisibilitySteps.map((step) => (
                        <span key={step.label} style={assignmentLevelUpStatusStepStyle(step.done)}>
                          <strong>{step.label}</strong>
                          <small>{step.detail}</small>
                        </span>
                      ))}
                    </div>
                    {student?.playerUserId ? (
                      <Link
                        href={buildCoachPlayerMessageHref(
                          student,
                          assignment.title,
                          `Quick note on ${assignment.title}: `,
                          {
                            assignmentId: assignment.id,
                            assignmentTitle: assignment.title,
                            assignmentFocus: assignment.focus,
                            assignmentCardId: getCoachAssignmentCourtCardId(assignment),
                          },
                        )}
                        style={studentActionStyle}
                      >
                        Message about this
                      </Link>
                    ) : null}
                    {student?.playerPhone ? (
                      <SmsActionLink phone={student.playerPhone} body={buildAssignmentNotifyMessage(assignment, assignmentSummary, assignmentShareHref)} style={studentActionStyle}>
                        Text court link
                      </SmsActionLink>
                    ) : null}
                    {student ? (
                      <button
                        type="button"
                        onClick={() => void copyCoachText(
                          buildAssignmentNotifyMessage(assignment, assignmentSummary, assignmentShareHref),
                          `Assignment text copied for ${student.playerName}.`,
                          `Assignment text for ${student.playerName}: ${buildAssignmentNotifyMessage(assignment, assignmentSummary, assignmentShareHref)}`,
                        )}
                        style={inlineActionButtonStyle}
                      >
                        Copy assignment text
                      </button>
                    ) : null}
                    {assignmentShareHref ? (
                      <button
                        type="button"
                        onClick={() => void copyCoachAssignmentCourtLink(assignmentShareHref, student?.playerName || 'student')}
                        style={inlineActionButtonStyle}
                      >
                        Copy court link
                      </button>
                    ) : null}
                    {assignmentCourtHref ? (
                      <Link href={assignmentCourtHref} style={studentActionStyle}>
                        Open court link
                      </Link>
                    ) : null}
                    {assignmentSummary.detail || assignmentSummary.volume || assignmentSummary.tracker.length || assignmentSummary.expectedEvidence ? (
                      <div style={assignmentSummaryStyle}>
                        {assignmentSummary.detail ? <span>{assignmentSummary.detail}</span> : null}
                        {assignmentSummary.volume ? <strong>{assignmentSummary.volume}</strong> : null}
                        {assignmentSummary.expectedEvidence ? <em>Evidence expected: {assignmentSummary.expectedEvidence}</em> : null}
                        {assignmentSummary.tracker.length ? (
                          <ul style={assignmentTrackerListStyle}>
                            {assignmentSummary.tracker.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                    {packProgress ? (
                      <div style={assignmentSummaryStyle}>
                        <div style={assignmentTopStyle}>
                          <strong>Pack progress</strong>
                          <span style={assignmentStatusStyle(packProgress.complete ? 'completed' : assignment.status)}>
                            {packProgress.label}
                          </span>
                        </div>
                        <ul style={assignmentTrackerListStyle}>
                          {packProgress.pack.items.map((item) => {
                            const proof = levelUpProofs.find((session) => session.focusId === item.cardId)
                            return (
                              <li key={item.cardId}>
                                {item.title}: {item.status}
                                {item.rating ? ` / ${item.rating}/5` : proof ? ` / ${proof.rating}/5` : ''}
                                {item.completedAt ? ` / ${formatCalendarStatusDate(item.completedAt)}` : ''}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    ) : null}
                    {levelUpProof ? (
                      <div style={levelUpProofStyle}>
                        <div style={assignmentTopStyle}>
                          <strong>Level Up proof received</strong>
                          <span style={proofScoreBadgeStyle(levelUpProof.rating)}>{levelUpProof.rating}/5</span>
                        </div>
                        <div style={proofSourceCueStyle} aria-label="Coach review proof sync cue">
                          <div style={proofSourceCueHeaderStyle}>
                            <span>Coach review proof sync cue</span>
                            <strong>Synced Level Up proof is coach-visible here.</strong>
                            <small>If the player only saved locally, it will stay off this review queue until sync succeeds.</small>
                          </div>
                          <div style={proofSourceCueGridStyle}>
                            {COACH_REVIEW_PROOF_SYNC_STEPS.map((step) => (
                              <div key={step.label} style={proofSourceCueItemStyle}>
                                <strong>{step.label}</strong>
                                <small>{step.text}</small>
                              </div>
                            ))}
                          </div>
                        </div>
                        <span>{levelUpProof.drillTitle}: {levelUpProof.focusTitle}</span>
                        <em>{formatClock(levelUpProof.elapsedSeconds)} / {levelUpProof.feeling}</em>
                        {levelUpProof.note ? <small>{levelUpProof.note}</small> : null}
                        {proofReviewStandard ? (
                          <div style={proofReviewStandardStyle} aria-label={`Coach review standard for ${assignment.title}`}>
                            <span>Review standard</span>
                            {proofReviewStandard.items.map((item) => (
                              <div key={item.label}>
                                <b>{item.label}</b>
                                <strong>{item.value}</strong>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {proofReviewDraft ? <small>Suggested coach response: {proofReviewDraft.note}</small> : null}
                        {proofReviewDecisions.length ? (
                          <div style={proofDecisionPanelStyle} aria-label="Coach proof decision panel">
                            <div style={proofDecisionHeaderStyle}>
                              <span>Review decision</span>
                              <strong>Choose the next coach move before assigning.</strong>
                            </div>
                            <div style={proofDecisionGridStyle}>
                              {proofReviewDecisions.map((decision) => (
                                <button
                                  key={decision.id}
                                  type="button"
                                  onClick={() => loadReviewDecisionFromProof(assignment, levelUpProof, decision)}
                                  style={proofDecisionButtonStyle(decision.recommended)}
                                >
                                  <span>{decision.recommended ? 'Recommended' : 'Option'}</span>
                                  <strong>{decision.label}</strong>
                                  <small>{decision.reason}</small>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {proofReviewDraft ? (
                          <div style={proofNextMoveStyle}>
                            <span>{proofReviewDraft.nextMove.label}</span>
                            <strong>{proofReviewDraft.nextMove.title}</strong>
                            <small>{proofReviewDraft.nextMove.reason}</small>
                            <div style={proofNextMoveActionRowStyle}>
                              <button
                                type="button"
                                onClick={() => loadNextAssignmentFromProof(assignment, levelUpProof, proofReviewDraft)}
                                style={smallPrimaryButtonStyle}
                              >
                                Load next assignment
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewAssignmentId(assignment.id)
                                  setReviewNote(proofReviewDraft.note)
                                  setReviewNextFocus(proofReviewDraft.nextFocus)
                                }}
                                style={smallGhostButtonStyle}
                              >
                                Use coach response
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {playerCheckIn ? (
                      <div style={checkInReviewStyle}>
                        <strong>Player recap</strong>
                        {playerCheckIn.recap ? <span>{playerCheckIn.recap}</span> : null}
                        {playerCheckIn.evidence ? <em>Evidence: {playerCheckIn.evidence}</em> : null}
                      </div>
                    ) : assignment.status === 'completed' ? (
                      <div style={checkInReviewStyle}>
                        <strong>Completed</strong>
                        <span>No recap attached yet.</span>
                      </div>
                    ) : null}
                    {coachReview ? (
                      <div style={coachResponseStyle}>
                        <strong>Coach response</strong>
                        {coachReview.note ? <span>{coachReview.note}</span> : null}
                        {coachReview.nextFocus ? <em>Next: {coachReview.nextFocus}</em> : null}
                      </div>
                    ) : reviewReady ? (
                      reviewAssignmentId === assignment.id ? (
                        <div style={reviewFormStyle}>
                          <textarea
                            value={reviewNote}
                            onChange={(event) => setReviewNote(event.target.value)}
                            placeholder="What should the player understand from this recap?"
                            style={reviewTextareaStyle}
                          />
                          <input
                            value={reviewNextFocus}
                            onChange={(event) => setReviewNextFocus(event.target.value)}
                            placeholder="Next focus before the next lesson"
                            style={reviewInputStyle}
                          />
                          <div style={reviewActionRowStyle}>
                            <button
                              type="button"
                              onClick={() => void saveAssignmentReview(assignment.id)}
                              disabled={workspaceLoading || (!reviewNote.trim() && !reviewNextFocus.trim())}
                              style={smallPrimaryButtonStyle}
                            >
                              Save review
                            </button>
                            <button type="button" onClick={() => setReviewAssignmentId('')} style={smallGhostButtonStyle}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewAssignmentId(assignment.id)
                            setReviewNote(proofReviewDraft?.note ?? '')
                            setReviewNextFocus(proofReviewDraft?.nextFocus ?? '')
                          }}
                          style={smallGhostButtonStyle}
                        >
                          Add coach review
                        </button>
                      )
                    ) : null}
                  </article>
                )
              })
            ) : (
              <article style={assignmentCardStyle}>
                <strong>No saved assignments yet.</strong>
                <span>Add a student, then create the first measurable homework item.</span>
              </article>
            )}
          </div>
            </div>
          </details>
        </div>
      </section>

      <section style={integrationStyle}>
        {isMobile ? (
          <details style={mobileStudentRecordsDisclosureStyle}>
            <summary style={mobileStudentRecordsSummaryStyle}>
              <span>How this fits TenAceIQ</span>
              <strong>Coach + Player</strong>
            </summary>
            <div style={mobileStudentRecordsBodyStyle}>
              {renderCoachIntegrationContent()}
            </div>
          </details>
        ) : renderCoachIntegrationContent()}
      </section>
    </main>
  )
}

function PanelHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={panelHeaderStyle}>
      <div style={eyebrowStyle}>{eyebrow}</div>
      <h2 style={panelTitleStyle}>{title}</h2>
    </div>
  )
}

function IntegrationPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={integrationPillStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SmsActionLink({
  phone,
  body,
  style,
  children,
}: {
  phone: string
  body: string
  style: CSSProperties
  children: ReactNode
}) {
  return (
    <a
      href={buildSmsHref(phone, body)}
      onClick={(event) => {
        event.preventDefault()
        window.location.href = buildSmsHref(phone, body, getSmsBodySeparator())
      }}
      style={style}
    >
      {children}
    </a>
  )
}

function DashboardMetric({ label, value }: { label: string; value: number }) {
  return (
    <div style={linkedMetricStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SessionStep({ label, value }: { label: string; value: string }) {
  return (
    <div style={sessionStepStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function getIdentityTitle(identitySlug: string) {
  if (identitySlug === CUSTOM_STUDENT_IDENTITY_ID) return 'Custom path'
  return getPlayerDevelopmentIdentity(identitySlug).title
}

function getStudentStatusLabel(status: CoachStudentLink['status']) {
  if (status === 'needs_assignment') return 'Needs assignment'
  if (status === 'review_notes') return 'Review notes'
  if (status === 'paused') return 'Paused'
  return 'Active'
}

function getAssignmentStatusLabel(status: CoachAssignment['status']) {
  if (status === 'assigned') return 'Assigned'
  if (status === 'completed') return 'Completed'
  if (status === 'archived') return 'Archived'
  return 'Draft'
}

function getInviteStatusLabel(status: CoachStudentInvite['status']) {
  if (status === 'accepted') return 'Accepted'
  if (status === 'revoked') return 'Revoked'
  if (status === 'expired') return 'Expired'
  return 'Pending invite'
}

type LinkedPlayerCard = {
  student: CoachStudentLink
  connection: 'linked' | 'pending' | 'manual'
  connectionLabel: string
  pendingInvite: CoachStudentInvite | null
  activeAssignments: number
  needsReview: boolean
  dueLabel: string
  dueTone: ReturnType<typeof getCoachAssignmentDueState>['tone']
  latestAssignment: CoachAssignment | null
}

type CoachQueueAction = {
  label: string
  title: string
  detail: string
  href: string
  tone: 'review' | 'due' | 'setup' | 'assign' | 'steady'
}

type LevelUpProofReviewNextMove = {
  label: string
  title: string
  focus: string
  reason: string
  cardId: string
  dueDays: number
}

type LevelUpProofReviewDraft = {
  note: string
  nextFocus: string
  nextMove: LevelUpProofReviewNextMove
}

type LevelUpProofReviewDecision = {
  id: 'scale-down' | 'repeat-cleaner' | 'add-pressure'
  label: string
  note: string
  nextFocus: string
  nextMove: LevelUpProofReviewNextMove
  reason: string
  recommended: boolean
}

type CoachLevelUpAssignmentStandard = {
  playerSees: string
  coachWatches: string
  commonLeak: string
  nextRep: string
  scoreRead: string
  tracker: string[]
}

function buildCoachLevelUpAssignmentCards(
  student: CoachStudentLink | null,
  title: string,
  focus: string,
  templateId: string,
  starterId: string,
) {
  const identitySlug = student?.identitySlug || 'default'
  const profile = getLevelUpProfileForIdentity(identitySlug)
  const searchText = `${title} ${focus} ${templateId} ${starterId}`.toLowerCase()
  const shortcutCardId = getCoachAssignmentShortcutCardId(searchText) || getFirstAssignmentStarterCardId(starterId)
  const shortcutCard = shortcutCardId ? LEVEL_UP_CARDS.find((card) => card.id === shortcutCardId) : undefined
  const profileCards = profile.starterCardIds
    .map((cardId) => LEVEL_UP_CARDS.find((card) => card.id === cardId))
    .filter((card): card is LevelUpCard => Boolean(card))
  const scoredCards = LEVEL_UP_CARDS
    .filter((card) => card.assignable)
    .map((card) => ({
      card,
      score: scoreCoachAssignmentCard(card, searchText, profile.focusTags, identitySlug),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.card)

  return uniqueLevelUpCards([
    ...(shortcutCard ? [shortcutCard] : []),
    ...profileCards,
    ...scoredCards,
    ...LEVEL_UP_CARDS.filter((card) => card.assignable && card.durationMinutes <= 10),
  ]).slice(0, 8)
}

function buildCoachLevelUpAssignmentStandard(card: LevelUpCard): CoachLevelUpAssignmentStandard {
  const coachWatches = card.qualityChecks?.[0] ?? card.proof
  const commonLeak = card.commonMiss?.miss ?? 'The player does the work but the proof behavior is hard to see.'
  const nextRep = card.commonMiss?.fix ?? card.regression ?? card.cue
  const scoreRead = card.proofAnchors?.high ?? 'The habit is visible, repeatable, and easy to score honestly.'

  return {
    playerSees: card.useWhen ?? card.routine[0] ?? card.cue,
    coachWatches,
    commonLeak,
    nextRep,
    scoreRead,
    tracker: [card.proof, coachWatches, nextRep, scoreRead].filter(Boolean).slice(0, 4),
  }
}

function scoreCoachAssignmentCard(card: LevelUpCard, searchText: string, focusTags: string[], identitySlug: string) {
  let score = 0
  if (card.identitySlugs?.includes(identitySlug)) score += 20
  if (focusTags.some((tag) => card.tags.includes(tag))) score += 10
  if (card.tags.some((tag) => searchText.includes(tag.replaceAll('-', ' ')))) score += 18
  if (searchText.includes(card.pack.toLowerCase())) score += 8
  if (card.title.toLowerCase().split(/\s+/).some((word) => word.length > 4 && searchText.includes(word))) score += 6
  if (card.durationMinutes <= 10) score += 3
  return score
}

function uniqueLevelUpCards(cards: LevelUpCard[]) {
  const seen = new Set<string>()
  return cards.filter((card) => {
    if (seen.has(card.id)) return false
    seen.add(card.id)
    return true
  })
}

function buildCoachLevelUpHandoffPack(packId: string, requestedCardId: string): CoachLevelUpHandoffPack | null {
  const pack = COACH_LEVEL_UP_HANDOFF_PACKS.find((item) => item.id === packId)
  if (!pack) return null

  if (!requestedCardId) return pack

  return {
    ...pack,
    cardIds: [requestedCardId, ...pack.cardIds.filter((cardId) => cardId !== requestedCardId)],
  }
}

function buildCoachLevelUpAssignmentPack(pack: CoachLevelUpHandoffPack | null): CoachAssignmentPack | null {
  if (!pack) return null

  const items = uniqueLevelUpCards(
    pack.cardIds
      .map((cardId) => LEVEL_UP_CARDS.find((card) => card.id === cardId))
      .filter((card): card is LevelUpCard => Boolean(card)),
  ).map((card) => ({
    cardId: card.id,
    title: card.title,
    proof: card.proof,
    status: 'assigned' as const,
  }))

  if (!items.length) return null

  return {
    id: pack.id,
    title: pack.title,
    focus: pack.focus,
    items,
  }
}

function findLevelUpModuleForCard(card: LevelUpCard): LevelUpModule | undefined {
  return LEVEL_UP_MODULES.find((module) => module.cardIds.includes(card.id))
}

function getFirstAssignmentStarterCardId(starterId: string) {
  if (starterId === 'movement') return 'split-recover-loop'
  if (starterId === 'serve') return 'serve-target-ladder'
  if (starterId === 'decision') return 'defense-neutral-attack-rally'
  return ''
}

function getCoachAssignmentShortcutCardId(text: string) {
  const normalized = text.toLowerCase()
  if (normalized.includes('return')) return 'return-shadow-split-read'
  if (normalized.includes('serve target') || normalized.includes('serve routine') || normalized.includes('serve-target')) return 'serve-target-ladder'
  if (normalized.includes('split') || normalized.includes('recover') || normalized.includes('movement')) return 'split-recover-loop'
  if (normalized.includes('attack') || normalized.includes('decision')) return 'defense-neutral-attack-rally'
  if (normalized.includes('doubles') || normalized.includes('partner') || normalized.includes('middle')) return 'serve-location-call'
  if (normalized.includes('volley') || normalized.includes('net')) return 'first-volley-decision'
  if (normalized.includes('backhand')) return 'basket-backhand-crosscourt'
  if (normalized.includes('forehand')) return 'basket-forehand-crosscourt'
  return ''
}

function buildCoachQueueActions(
  linkedPlayerCards: LinkedPlayerCard[],
  assignmentsNeedingReview: CoachAssignment[],
  studentCount: number,
): CoachQueueAction[] {
  const actions: CoachQueueAction[] = []
  const firstReview = assignmentsNeedingReview[0]
  const dueCard = linkedPlayerCards.find((card) => card.dueTone === 'overdue' || card.dueTone === 'today')
  const pendingCard = linkedPlayerCards.find((card) => card.connection === 'pending' && card.pendingInvite)
  const assignmentReadyCard = linkedPlayerCards.find((card) => !card.activeAssignments && card.connection !== 'pending')
  const activeCard = linkedPlayerCards.find((card) => card.activeAssignments > 0)

  if (firstReview) {
    const reviewCard = linkedPlayerCards.find((card) => card.student.id === firstReview.studentLinkId)
    actions.push({
      label: 'Review',
      title: `Respond to ${reviewCard?.student.playerName || 'player'} recap`,
      detail: `${firstReview.title} is ready for coach feedback and the next focus.`,
      href: `#coach-assignment-${firstReview.id}`,
      tone: 'review',
    })
  }

  if (dueCard?.latestAssignment) {
    actions.push({
      label: 'Due now',
      title: `Follow up with ${dueCard.student.playerName}`,
      detail: `${dueCard.latestAssignment.title} is ${dueCard.dueLabel.toLowerCase()}. Send a quick nudge or adjust the next lesson.`,
      href: `#coach-assignment-${dueCard.latestAssignment.id}`,
      tone: 'due',
    })
  }

  if (pendingCard?.pendingInvite) {
    actions.push({
      label: 'Setup',
      title: `Finish ${pendingCard.student.playerName}'s Player link`,
      detail: 'Send the setup link again so assignments, check-ins, and messages connect.',
      href: pendingCard.pendingInvite.inviteHref,
      tone: 'setup',
    })
  }

  if (!studentCount) {
    actions.push({
      label: 'Start',
      title: 'Add your first student',
      detail: 'Create the player record, then send the setup link when you want Player follow-through.',
      href: '#coach-student-board',
      tone: 'assign',
    })
  } else if (assignmentReadyCard) {
    actions.push({
      label: 'Assign',
      title: `Give ${assignmentReadyCard.student.playerName} the next action`,
      detail: 'Turn the last lesson into a measurable drill, reflection, or accountability item.',
      href: '#coach-lesson-frame',
      tone: 'assign',
    })
  }

  if (!actions.length && activeCard?.latestAssignment) {
    actions.push({
      label: 'Steady',
      title: 'Everything is moving',
      detail: `${activeCard.student.playerName} has active work. Use Quick contact to confirm the next lesson.`,
      href: '#coach-lesson-frame',
      tone: 'steady',
    })
  }

  if (!actions.length) {
    actions.push({
      label: 'Build',
      title: 'Create the next coaching rhythm',
      detail: 'Use a session preset, assign the follow-through, then send it to the player.',
      href: '#coach-lesson-frame',
      tone: 'steady',
    })
  }

  return actions.slice(0, 3)
}

function buildAssignmentProofMap(levelUpSessions: LevelUpSession[]) {
  const proofByAssignmentId = new Map<string, LevelUpSession>()

  for (const session of levelUpSessions) {
    if (!session.assignmentId) continue
    const existing = proofByAssignmentId.get(session.assignmentId)
    if (!existing || Date.parse(session.completedAt) > Date.parse(existing.completedAt)) {
      proofByAssignmentId.set(session.assignmentId, session)
    }
  }

  return proofByAssignmentId
}

function buildAssignmentProofListMap(levelUpSessions: LevelUpSession[]) {
  const proofByAssignmentId = new Map<string, LevelUpSession[]>()

  for (const session of levelUpSessions) {
    if (!session.assignmentId) continue
    const current = proofByAssignmentId.get(session.assignmentId) ?? []
    proofByAssignmentId.set(session.assignmentId, [...current, session].sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt)))
  }

  return proofByAssignmentId
}

function buildCoachAssignmentVisibilitySteps(assignment: CoachAssignment, proof?: LevelUpSession, proofs: LevelUpSession[] = []) {
  const proofCount = proof ? Math.max(1, proofs.length) : proofs.length
  const packProgress = getCoachAssignmentPackProgress(assignment.assignment)
  const startedPackItems = packProgress?.pack.items.filter((item) => item.status === 'started' || item.status === 'completed').length ?? 0
  const completedPackItems = packProgress?.pack.items.filter((item) => item.status === 'completed').length ?? 0
  const started = assignment.status === 'completed' || proofCount > 0 || startedPackItems > 0
  const logged = assignment.status === 'completed' || proofCount > 0 || completedPackItems > 0

  return [
    {
      label: 'Assigned',
      detail: assignment.status === 'draft' ? 'Draft not sent' : 'Visible to player',
      done: assignment.status !== 'draft',
    },
    {
      label: 'Started',
      detail: started ? `${Math.max(proofCount, startedPackItems, 1)} signal${Math.max(proofCount, startedPackItems, 1) === 1 ? '' : 's'}` : 'No player start yet',
      done: started,
    },
    {
      label: 'Logged',
      detail: logged ? `${Math.max(proofCount, completedPackItems, 1)} proof log${Math.max(proofCount, completedPackItems, 1) === 1 ? '' : 's'}` : 'Waiting on proof',
      done: logged,
    },
    {
      label: 'Shared with coach',
      detail: proof ? 'Synced to review queue' : 'Only visible after sync',
      done: Boolean(proof),
    },
  ]
}

function buildLevelUpProofReviewDraft(session: LevelUpSession, assignment: CoachAssignment) {
  const decisions = buildLevelUpProofReviewDecisions(session, assignment)
  const decision = decisions.find((candidate) => candidate.recommended) ?? decisions[1]

  return {
    note: decision.note,
    nextFocus: decision.nextFocus,
    nextMove: decision.nextMove,
  } satisfies LevelUpProofReviewDraft
}

function buildCoachProofReviewStandard(assignment: CoachAssignment, session: LevelUpSession) {
  const cardId = getAssignmentLevelUpCardId(assignment, session)
  const card = LEVEL_UP_CARDS.find((candidate) => candidate.id === cardId)
  if (!card) return null

  return {
    card,
    items: [
      {
        label: 'Player counted',
        value: card.qualityChecks?.[0] ?? card.proof,
      },
      {
        label: 'Coach checks',
        value: card.proofAnchors?.high ?? card.proof,
      },
      {
        label: 'Next rep',
        value: card.commonMiss?.fix ?? card.regression ?? card.cue,
      },
    ],
  }
}

function buildLevelUpProofReviewDecisions(
  session: LevelUpSession,
  assignment: CoachAssignment,
): [LevelUpProofReviewDecision, LevelUpProofReviewDecision, LevelUpProofReviewDecision] {
  const base = `${session.drillTitle} came back ${session.rating}/5.`
  const cardId = getAssignmentLevelUpCardId(assignment, session)
  const focus = assignment.focus || session.focusTitle

  const decisions: [LevelUpProofReviewDecision, LevelUpProofReviewDecision, LevelUpProofReviewDecision] = [
    {
      id: 'scale-down',
      label: 'Scale down',
      note: `${base} Scale this down. The next lesson should simplify the cue and rebuild confidence before speed or pressure.`,
      nextFocus: `Scale down ${focus}`,
      nextMove: {
        label: 'Scale down',
        title: `Scale down: ${session.focusTitle}`,
        focus: `Simplify ${focus}`,
        reason: 'The player scored 0-1, so the next assignment should reduce speed, volume, or decision load.',
        cardId,
        dueDays: 3,
      },
      reason: 'Use when the proof score or note says the player needs a simpler cue.',
      recommended: session.rating < 2,
    },
    {
      id: 'repeat-cleaner',
      label: 'Repeat cleaner',
      note: `${base} Keep the same assignment target and ask for one cleaner proof block before increasing difficulty.`,
      nextFocus: `Repeat ${session.focusTitle} with cleaner proof`,
      nextMove: {
        label: 'Repeat cleaner',
        title: `Repeat clean: ${session.drillTitle}`,
        focus: `Cleaner proof for ${session.focusTitle}`,
        reason: 'The player scored 2-3, so the next assignment should repeat the same card with a clearer standard before adding difficulty.',
        cardId,
        dueDays: 4,
      },
      reason: 'Use when the habit is present but not stable enough for pressure.',
      recommended: session.rating >= 2 && session.rating < 4,
    },
    {
      id: 'add-pressure',
      label: 'Add pressure',
      note: `${base} Good signal: the assigned habit is repeatable enough to test with more pressure next.`,
      nextFocus: `Add pressure to ${focus}`,
      nextMove: {
        label: 'Progress',
        title: `Add pressure: ${session.drillTitle}`,
        focus: `Pressure test ${focus}`,
        reason: 'The player scored 4-5, so keep the same habit and add scoreboard, target, or time pressure.',
        cardId,
        dueDays: 5,
      },
      reason: 'Use when the habit is repeatable and the next lesson should test transfer.',
      recommended: session.rating >= 4,
    },
  ]

  return decisions
}

function getAssignmentLevelUpCardId(assignment: CoachAssignment, session: LevelUpSession) {
  const directCardId = typeof assignment.assignment.cardId === 'string' ? assignment.assignment.cardId : ''
  if (directCardId && LEVEL_UP_CARDS.some((card) => card.id === directCardId)) return directCardId

  const shortcutCardId = getCoachAssignmentShortcutCardId(`${assignment.title} ${assignment.focus} ${session.drillTitle} ${session.focusTitle}`)
  if (shortcutCardId && LEVEL_UP_CARDS.some((card) => card.id === shortcutCardId)) return shortcutCardId

  return LEVEL_UP_CARDS[0]?.id ?? ''
}

function getCoachPlayerProfileHref(student: CoachStudentLink) {
  return student.playerId
    ? `/players/${encodeURIComponent(student.playerId)}`
    : getCoachPlannerHref(student.identitySlug)
}

function getCoachAssignmentTemplateIdForCard(cardId: string) {
  const exactTemplate = COACH_ASSIGNMENT_TEMPLATES.find((template) => template.id === cardId)
  if (exactTemplate) return exactTemplate.id

  const card = LEVEL_UP_CARDS.find((candidate) => candidate.id === cardId)
  const shortcutTemplateId = card ? getCoachAssignmentShortcutCardId(`${card.id} ${card.title} ${card.tags.join(' ')}`) : ''
  const matchingTemplate = COACH_ASSIGNMENT_TEMPLATES.find((template) => template.id === shortcutTemplateId)

  return matchingTemplate?.id ?? COACH_ASSIGNMENT_TEMPLATES[0]?.id ?? ''
}

function buildLinkedPlayerCards(
  students: CoachStudentLink[],
  assignments: CoachAssignment[],
  invites: CoachStudentInvite[],
): LinkedPlayerCard[] {
  return students.map((student) => {
    const studentAssignments = assignments.filter((assignment) => assignment.studentLinkId === student.id)
    const pendingInvite = invites.find((invite) => invite.studentLinkId === student.id && invite.status === 'pending') ?? null
    const activeAssignments = studentAssignments.filter((assignment) => assignment.status === 'assigned').length
    const needsReview = studentAssignments.some(assignmentNeedsCoachReview)
    const latestAssignment = [...studentAssignments].sort((a, b) => Date.parse(b.updatedAt || '') - Date.parse(a.updatedAt || ''))[0] ?? null
    const dueState = getHighestPressureDueState(studentAssignments)
    const connection: LinkedPlayerCard['connection'] = student.playerUserId || student.setupStatus === 'linked'
      ? 'linked'
      : pendingInvite || student.setupStatus === 'invited'
        ? 'pending'
        : 'manual'

    return {
      student,
      connection,
      connectionLabel: connection === 'linked' ? 'Linked' : connection === 'pending' ? 'Invite pending' : 'Manual',
      pendingInvite,
      activeAssignments,
      needsReview,
      dueLabel: dueState.label,
      dueTone: dueState.tone,
      latestAssignment,
    }
  }).sort((a, b) => getLinkedPlayerPriority(a) - getLinkedPlayerPriority(b))
}

function getHighestPressureDueState(assignments: CoachAssignment[]) {
  const dueStates = assignments
    .filter((assignment) => assignment.status === 'assigned')
    .map((assignment) => getCoachAssignmentDueState(assignment.dueDate))

  return dueStates.sort((a, b) => getDueTonePriority(a.tone) - getDueTonePriority(b.tone))[0] ?? { label: 'No active due date', tone: 'none' as const }
}

function getDueTonePriority(tone: ReturnType<typeof getCoachAssignmentDueState>['tone']) {
  if (tone === 'overdue') return 0
  if (tone === 'today') return 1
  if (tone === 'soon') return 2
  if (tone === 'future') return 3
  return 4
}

function getLinkedPlayerPriority(card: LinkedPlayerCard) {
  if (card.needsReview) return 0
  if (card.dueTone === 'overdue' || card.dueTone === 'today') return 1
  if (card.connection === 'pending') return 2
  if (card.activeAssignments > 0) return 3
  return 4
}

function getSetupStatusLabel(student: CoachStudentLink) {
  if (student.playerUserId || student.setupStatus === 'linked') return 'Linked Player account'
  if (student.setupStatus === 'invited') return 'Setup link sent'
  return 'Manual student'
}

function buildLessonConfirmMessage(playerName: string, dateTime: string, focus: string, location = '') {
  const formattedDateTime = formatLessonDateTimeForMessage(dateTime)
  const details = [
    formattedDateTime ? `Time: ${formattedDateTime}` : 'Time: ',
    focus.trim() ? `Focus: ${focus.trim()}` : 'Focus: ',
    location.trim() ? `Location: ${location.trim()}` : '',
  ].filter(Boolean).join('  ')
  return `Let's confirm the next lesson for ${playerName}. ${details}`
}

function getAssignmentLessonDateTime(assignment: Record<string, unknown>) {
  return typeof assignment.lessonDateTime === 'string' ? assignment.lessonDateTime.trim() : ''
}

function getCalendarEventSortKey(event: { date: string; time?: string }) {
  return `${event.date || '9999-12-31'}T${event.time || '23:59'}`
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeContactPreference(value: unknown): CoachStudentLink['contactPreference'] {
  return value === 'text' || value === 'both' || value === 'in_app' ? value : 'in_app'
}

function formatSharedCalendarEventDate(event: { date: string; time?: string }) {
  return event.time ? formatLessonDateTimeForMessage(`${event.date}T${event.time}`) : formatCalendarDate(event.date)
}

function toWebcalUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      url.protocol = 'webcal:'
      return url.toString()
    }
  } catch {
    return value
  }

  return value
}

function formatCalendarDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return value || 'Date TBD'

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(parsed)
}

function formatCalendarStatusDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value || 'recently'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed)
}

function getSharedCalendarEventDetail(event: { description?: string; studentName?: string }) {
  const focusLine = event.description
    ?.split('\n')
    .find((line) => line.startsWith('Focus: '))
    ?.replace('Focus: ', '')
    .trim()

  return focusLine || event.studentName || 'Coach/student calendar'
}

function formatLessonDateTimeForMessage(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return trimmed.replace('T', ' ')

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed)
}

function getDateInputDaysFromNow(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function buildCoachAssignmentCourtHref(assignment: CoachAssignment, student: CoachStudentLink) {
  const storedPortalHref = typeof assignment.assignment.portalHref === 'string'
    ? assignment.assignment.portalHref.trim()
    : ''
  const identitySlug = student.identitySlug || 'relentless-competitor-4-0'
  const baseHref = storedPortalHref || `/player-development/${encodeURIComponent(identitySlug)}/level-up`

  return appendCoachAssignmentCourtParams(baseHref, assignment)
}

function appendCoachAssignmentCourtParams(href: string, assignment: CoachAssignment) {
  const cardId = getCoachAssignmentCourtCardId(assignment)

  try {
    const url = new URL(href, 'https://tenaceiq.local')
    url.searchParams.set('coach', '1')
    url.searchParams.set('assignmentId', assignment.id)
    url.searchParams.set('studentLinkId', assignment.studentLinkId)
    url.searchParams.set('assignmentTitle', assignment.title)
    if (assignment.focus) url.searchParams.set('assignmentFocus', assignment.focus)
    if (cardId && !url.searchParams.has('card')) url.searchParams.set('card', cardId)
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return href
  }
}

function getCoachAssignmentCourtCardId(assignment: CoachAssignment) {
  const pack = getCoachAssignmentPackProgress(assignment.assignment)?.pack
  const packCardId = pack
    ? pack.items.find((item) => item.status !== 'completed' && item.status !== 'skipped')?.cardId ?? pack.items[0]?.cardId ?? ''
    : ''
  if (packCardId) return packCardId

  return typeof assignment.assignment.cardId === 'string' ? assignment.assignment.cardId.trim() : ''
}

function toAbsoluteAppHref(href: string, origin: string) {
  if (!href || !origin) return href

  try {
    return new URL(href, origin).toString()
  } catch {
    return href
  }
}

function buildAssignmentNotifyMessage(
  assignment: CoachAssignment,
  summary: ReturnType<typeof getCoachAssignmentSummary> | null,
  courtHref = '',
) {
  const focus = assignment.focus.trim() || 'Coach follow-through'
  const due = assignment.dueDate ? ` Due: ${assignment.dueDate}.` : ''
  const detail = summary?.detail ? ` ${summary.detail}` : ''
  const volume = summary?.volume ? ` Target: ${summary.volume}.` : ''
  const evidence = summary?.expectedEvidence ? ` Evidence: ${summary.expectedEvidence}.` : ''
  const courtLink = courtHref ? ` Open court mode: ${courtHref}` : ''
  return `New TenAceIQ assignment: ${assignment.title}. Focus: ${focus}.${due}${detail}${volume}${evidence}${courtLink}`
}

function buildCoachSetupText(inviteHref: string) {
  return `I created your TenAceIQ player setup link. Finish your account here: ${inviteHref}`
}

function buildSmsHref(phone: string, body: string, bodySeparator: '?' | '&' = '?') {
  const sanitizedPhone = phone.replace(/[^\d+]/g, '')
  return `sms:${sanitizedPhone}${bodySeparator}body=${encodeURIComponent(body)}`
}

function getPhoneDigits(phone: string) {
  return phone.replace(/\D/g, '')
}

function getSmsBodySeparator(): '?' | '&' {
  if (typeof navigator === 'undefined') return '?'

  return /iPad|iPhone|iPod/i.test(navigator.userAgent) ? '&' : '?'
}

function buildCoachPlayerMessageHref(
  student: CoachStudentLink,
  subject: string,
  body: string,
  assignmentContext?: {
    assignmentId: string
    assignmentTitle: string
    assignmentFocus: string
    assignmentCardId?: string
  },
) {
  const params = new URLSearchParams({
    compose: 'direct',
    recipientProfileId: student.playerUserId ?? '',
    recipient: student.playerName,
    subject,
    body,
    entityType: 'coach_player_link',
    entityId: student.id,
  })
  if (assignmentContext?.assignmentId) params.set('assignmentId', assignmentContext.assignmentId)
  if (assignmentContext?.assignmentTitle) params.set('assignmentTitle', assignmentContext.assignmentTitle)
  if (assignmentContext?.assignmentFocus) params.set('assignmentFocus', assignmentContext.assignmentFocus)
  if (assignmentContext?.assignmentCardId) params.set('assignmentCardId', assignmentContext.assignmentCardId)
  return `/messages?${params.toString()}`
}

const pageStyle: CSSProperties = {
  width: 'min(1220px, calc(100% - clamp(24px, 5vw, 42px)))',
  margin: '0 auto',
  padding: '18px 0 46px',
  display: 'grid',
  gap: 16,
  minWidth: 0,
}

const visuallyHiddenStyle: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

const heroStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
  gap: 16,
  alignItems: 'stretch',
  padding: 24,
  borderRadius: 28,
  border: '1px solid rgba(116,190,255,0.14)',
  background:
    'radial-gradient(circle at 84% 18%, rgba(155,225,29,0.18), transparent 30%), linear-gradient(145deg, rgba(7,17,31,0.96), rgba(5,11,22,0.92))',
  boxShadow: '0 24px 70px rgba(2, 8, 23, 0.42)',
  overflow: 'hidden',
}

const heroCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 13,
  alignContent: 'center',
  minWidth: 0,
}

const eyebrowStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(2.5rem, 6vw, 5.7rem)',
  lineHeight: 0.92,
  fontWeight: 950,
  letterSpacing: 0,
  maxWidth: 920,
}

const bodyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 15,
  lineHeight: 1.7,
  fontWeight: 760,
  maxWidth: 780,
}

const heroActionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
}

const linkBaseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 42,
  padding: '0 14px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 950,
  textDecoration: 'none',
}

const primaryLinkStyle: CSSProperties = {
  ...linkBaseStyle,
  border: '1px solid rgba(155,225,29,0.42)',
  background: 'linear-gradient(180deg, #eaff9e 0%, #9be11d 100%)',
  color: '#07111f',
}

const secondaryLinkStyle: CSSProperties = {
  ...linkBaseStyle,
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(255,255,255,0.055)',
  color: 'var(--foreground-strong)',
}

const heroPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  alignContent: 'center',
  padding: 18,
  borderRadius: 22,
  border: '1px solid rgba(223,248,194,0.14)',
  background: 'rgba(255,255,255,0.055)',
  color: 'var(--foreground-strong)',
  fontSize: 14,
  lineHeight: 1.55,
  fontWeight: 820,
}

const coachLoopStripStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const coachLoopItemStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
  minHeight: 132,
  alignContent: 'start',
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(180deg, rgba(12,28,52,0.82), rgba(7,17,34,0.94))',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
  overflowWrap: 'anywhere',
}

const coachLoopMetricStyle: CSSProperties = {
  width: 'fit-content',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.24)',
  background: 'rgba(155,225,29,0.1)',
  color: 'var(--brand-green)',
  padding: '5px 8px',
  fontSize: 11,
  fontWeight: 950,
  textTransform: 'uppercase',
}

const coachSupportPathStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
  padding: 16,
  borderRadius: 22,
  border: '1px solid rgba(155,225,29,0.18)',
  background:
    'linear-gradient(135deg, rgba(155,225,29,0.085), rgba(116,190,255,0.045)), linear-gradient(180deg, rgba(11,25,48,0.86), rgba(6,15,30,0.94))',
  boxShadow: '0 18px 46px rgba(2,10,24,0.22)',
}

const coachSupportPathHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'end',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 12,
  minWidth: 0,
}

const coachSupportPathTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.45rem, 3vw, 2.25rem)',
  lineHeight: 1.04,
  fontWeight: 950,
  letterSpacing: 0,
}

const coachSupportPathIntroStyle: CSSProperties = {
  ...bodyStyle,
  maxWidth: 470,
}

const coachSupportPathGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
  gap: 12,
  minWidth: 0,
}

const coachSupportPathCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '38px minmax(0, 1fr)',
  gap: 11,
  minWidth: 0,
  minHeight: 160,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(223,248,194,0.13)',
  background: 'linear-gradient(180deg, rgba(18,39,70,0.72), rgba(8,18,36,0.9))',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
}

const coachSupportPathCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.42,
  fontWeight: 760,
}

const coachSupportPathCtaStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
}

const commandGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))',
  gap: 12,
  minWidth: 0,
}

const commandCardStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '48px minmax(0, 1fr)',
  gap: 12,
  alignItems: 'start',
  minWidth: 0,
  padding: 15,
  borderRadius: 20,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'linear-gradient(180deg, rgba(16,34,64,0.76), rgba(8,18,36,0.88))',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  boxShadow: '0 18px 46px rgba(2,10,24,0.18)',
}

const commandCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 760,
}

const levelUpCoachHandoffStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0,
  padding: 16,
  borderRadius: 22,
  border: '1px solid rgba(155,225,29,0.22)',
  background:
    'linear-gradient(135deg, rgba(155,225,29,0.1), rgba(116,190,255,0.055)), linear-gradient(180deg, rgba(12,26,50,0.86), rgba(8,18,36,0.94))',
}

const levelUpCoachHandoffHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  gap: 12,
  minWidth: 0,
}

const levelUpCoachHandoffGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const levelUpCoachHandoffCardStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(5,11,22,0.34)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 780,
  overflowWrap: 'anywhere',
}

const linkedDashboardStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 18,
  borderRadius: 24,
  border: '1px solid rgba(155,225,29,0.18)',
  background:
    'linear-gradient(135deg, rgba(155,225,29,0.1), rgba(116,190,255,0.055)), linear-gradient(180deg, rgba(12,26,50,0.86), rgba(8,18,36,0.94))',
  minWidth: 0,
}

const linkedDashboardHeaderStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 0.5fr)',
  gap: 16,
  alignItems: 'start',
  minWidth: 0,
}

const linkedMetricGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 9,
  minWidth: 0,
}

const mobileLinkedDashboardHeaderStyle: CSSProperties = {
  ...linkedDashboardHeaderStyle,
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 12,
}

const mobileLinkedMetricGridStyle: CSSProperties = {
  ...linkedMetricGridStyle,
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
}

const linkedMetricStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.055)',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 900,
  textTransform: 'uppercase',
}

const coachQueueStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 13,
  borderRadius: 20,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(5,11,22,0.30)',
  minWidth: 0,
}

const coachQueueIntroStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 10,
  color: 'var(--foreground-strong)',
  fontSize: 14,
  fontWeight: 950,
  minWidth: 0,
}

const coachQueueGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))',
  gap: 9,
  minWidth: 0,
}

function coachQueueCardStyle(tone: CoachQueueAction['tone']): CSSProperties {
  const urgent = tone === 'review' || tone === 'due'
  const setup = tone === 'setup'
  return {
    display: 'grid',
    gap: 6,
    minWidth: 0,
    padding: 12,
    borderRadius: 16,
    border: urgent
      ? '1px solid rgba(155,225,29,0.30)'
      : setup
        ? '1px solid rgba(116,190,255,0.24)'
        : '1px solid rgba(255,255,255,0.10)',
    background: urgent
      ? 'linear-gradient(135deg, rgba(155,225,29,0.12), rgba(255,255,255,0.045))'
      : setup
        ? 'linear-gradient(135deg, rgba(116,190,255,0.10), rgba(255,255,255,0.04))'
        : 'rgba(255,255,255,0.045)',
    color: 'var(--foreground-strong)',
    textDecoration: 'none',
    fontSize: 13,
    lineHeight: 1.4,
    boxShadow: urgent ? '0 14px 30px rgba(155,225,29,0.08)' : 'none',
  }
}

function coachQueueToneStyle(tone: CoachQueueAction['tone']): CSSProperties {
  const urgent = tone === 'review' || tone === 'due'
  return {
    width: 'fit-content',
    borderRadius: 999,
    border: urgent ? '1px solid rgba(155,225,29,0.32)' : '1px solid rgba(255,255,255,0.12)',
    background: urgent ? 'rgba(155,225,29,0.14)' : 'rgba(255,255,255,0.055)',
    color: urgent ? 'var(--brand-green)' : 'var(--shell-copy-muted)',
    padding: '3px 8px',
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
  }
}

const linkedCardsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const linkedPlayerCardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.045)',
}

const linkedCardTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 10,
  minWidth: 0,
  color: 'var(--foreground-strong)',
  fontSize: 14,
  fontWeight: 950,
}

const mobileLinkedCardsGridStyle: CSSProperties = {
  ...linkedCardsGridStyle,
  display: 'flex',
  gap: 10,
  overflowX: 'auto',
  overscrollBehaviorX: 'contain',
  scrollSnapType: 'x mandatory',
  scrollPaddingLeft: 0,
  paddingBottom: 6,
  paddingRight: 6,
  marginRight: -6,
}

const mobileLinkedPlayerCardStyle: CSSProperties = {
  ...linkedPlayerCardStyle,
  flex: '0 0 min(86vw, 340px)',
  scrollSnapAlign: 'start',
}

const mobileLinkedCardTopStyle: CSSProperties = {
  ...linkedCardTopStyle,
  display: 'grid',
  gap: 8,
}

const mobileBenchShellStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
}

const mobileBenchPickerStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
  minWidth: 0,
}

function mobileBenchPlayerButtonStyle(active: boolean): CSSProperties {
  return {
    display: 'grid',
    gap: 4,
    minWidth: 0,
    minHeight: 58,
    textAlign: 'left',
    borderRadius: 15,
    border: active ? '1px solid rgba(155,225,29,0.72)' : '1px solid rgba(116,190,255,0.14)',
    background: active ? 'rgba(155,225,29,0.15)' : 'rgba(255,255,255,0.045)',
    color: 'var(--foreground-strong)',
    cursor: 'pointer',
    padding: '9px 10px',
    font: 'inherit',
    lineHeight: 1.15,
    boxShadow: active ? '0 0 0 1px rgba(155,225,29,0.14)' : 'none',
    overflow: 'hidden',
  }
}

const mobileBenchFeaturedCardStyle: CSSProperties = {
  width: '100%',
  flex: 'none',
  scrollSnapAlign: undefined,
}

const mobileStudentActionRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 9,
  width: '100%',
  minWidth: 0,
  alignItems: 'stretch',
}

const mobileBenchActionStyle: CSSProperties = {
  display: 'inline-flex',
  minHeight: 44,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 14,
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'rgba(155,225,29,0.085)',
  color: 'var(--brand-green)',
  fontSize: 12,
  lineHeight: 1.15,
  fontWeight: 950,
  textAlign: 'center',
  textDecoration: 'none',
  padding: '10px 8px',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const mobileBenchActionButtonStyle: CSSProperties = {
  ...mobileBenchActionStyle,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const mobilePlayerWorkspaceRailStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 12,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.20)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.11), rgba(116,190,255,0.055)), rgba(5,11,22,0.34)',
  minWidth: 0,
}

const mobilePlayerWorkspaceSummaryStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 10,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 900,
  textTransform: 'uppercase',
}

const mobilePlayerWorkspaceActionGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8,
  minWidth: 0,
}

const linkedBadgeRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 7,
  alignItems: 'center',
  minWidth: 0,
}

const playerProfileRouteStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(155,225,29,0.20)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.10), rgba(116,190,255,0.05))',
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 900,
  lineHeight: 1.25,
}

const playerProfileLinkStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const miniBadgeStyle: CSSProperties = {
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.055)',
  color: 'var(--shell-copy-muted)',
  padding: '4px 8px',
  fontSize: 10,
  fontWeight: 950,
  textTransform: 'uppercase',
}

const reviewBadgeStyle: CSSProperties = {
  ...miniBadgeStyle,
  border: '1px solid rgba(155,225,29,0.26)',
  background: 'rgba(155,225,29,0.12)',
  color: 'var(--brand-green)',
}

const linkedEmptyStyle: CSSProperties = {
  ...linkedPlayerCardStyle,
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.5,
  fontSize: 13,
  fontWeight: 800,
}

const workspaceGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
  gap: 14,
  minWidth: 0,
}

const panelStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
  padding: 18,
  borderRadius: 24,
  border: '1px solid rgba(116,190,255,0.13)',
  background: 'linear-gradient(180deg, rgba(12,26,50,0.82), rgba(8,18,36,0.92))',
}

const panelHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
}

const panelTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 26,
  lineHeight: 1.05,
  fontWeight: 950,
}

const formGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
  gap: 10,
  alignItems: 'end',
  minWidth: 0,
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
  color: 'var(--brand-green)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const fieldHintStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0,
  lineHeight: 1.35,
  textTransform: 'none',
}

const fieldErrorStyle: CSSProperties = {
  ...fieldHintStyle,
  color: '#ffcf7a',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  minHeight: 42,
  border: '1px solid rgba(116,190,255,0.16)',
  borderRadius: 14,
  background: 'rgba(15,23,42,0.72)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 800,
  outline: '2px solid transparent',
  outlineOffset: 2,
  padding: '0 11px',
}

const levelUpAssignmentPickerStyle: CSSProperties = {
  gridColumn: '1 / -1',
  display: 'grid',
  gap: 10,
  minWidth: 0,
  padding: 12,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.08), rgba(116,190,255,0.05))',
}

const levelUpAssignmentSuggestionGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: 8,
  minWidth: 0,
}

function levelUpAssignmentCardButtonStyle(active: boolean): CSSProperties {
  return {
    display: 'grid',
    gap: 5,
    minWidth: 0,
    textAlign: 'left',
    border: active ? '1px solid rgba(155,225,29,0.62)' : '1px solid rgba(116,190,255,0.14)',
    borderRadius: 15,
    background: active ? 'rgba(155,225,29,0.16)' : 'rgba(8,18,36,0.62)',
    color: 'var(--foreground-strong)',
    cursor: 'pointer',
    padding: 10,
    fontSize: 12,
    fontWeight: 850,
    lineHeight: 1.35,
  }
}

const levelUpAssignmentPreviewStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(5,11,22,0.35)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 820,
  lineHeight: 1.45,
}

const levelUpAssignmentStandardStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  marginTop: 6,
  padding: 10,
  borderRadius: 13,
  border: '1px solid rgba(155,225,29,0.2)',
  background: 'rgba(155,225,29,0.07)',
}

const levelUpAssignmentStandardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
  gap: 7,
}

const levelUpAssignmentStandardItemStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  minWidth: 0,
  padding: 8,
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(5,11,22,0.28)',
  color: 'var(--foreground-strong)',
}

const levelUpAssignmentStandardLabelStyle: CSSProperties = {
  color: 'var(--brand-green-3)',
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const primaryButtonStyle: CSSProperties = {
  minHeight: 42,
  border: '1px solid rgba(155,225,29,0.38)',
  borderRadius: 999,
  background: 'linear-gradient(180deg, #eaff9e 0%, #9be11d 100%)',
  color: '#07111f',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 950,
  padding: '0 14px',
}

const messageStyle: CSSProperties = {
  border: '1px solid rgba(155,225,29,0.24)',
  borderRadius: 16,
  background: 'rgba(155,225,29,0.08)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 850,
  lineHeight: 1.45,
  padding: 12,
}

const studentListStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
}

const mobileStudentRecordsDisclosureStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(255,255,255,0.04)',
  padding: 12,
}

const mobileStudentRecordsSummaryStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  minWidth: 0,
  color: 'var(--foreground-strong)',
  cursor: 'pointer',
  fontSize: 13,
  lineHeight: 1.25,
  fontWeight: 950,
}

const mobileStudentRecordsBodyStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  paddingTop: 10,
}

const openAssignmentQueueDisclosureStyle: CSSProperties = {
  display: 'contents',
}

const hiddenSummaryStyle: CSSProperties = {
  display: 'none',
}

const openAssignmentQueueBodyStyle: CSSProperties = {
  display: 'contents',
}

const studentCardStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.045)',
}

const studentTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  color: 'var(--foreground-strong)',
  fontSize: 14,
  fontWeight: 950,
}

const studentMetaStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
}

const studentContactStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 850,
}

const studentNextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 760,
}

const studentActionStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 12,
  fontWeight: 950,
  textDecoration: 'none',
}

const studentActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  alignItems: 'center',
}

const lessonListStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
}

const lessonBlockStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '54px minmax(0, 1fr)',
  gap: 12,
  alignItems: 'start',
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.045)',
}

const lessonTimeStyle: CSSProperties = {
  color: '#07111f',
  background: '#9be11d',
  borderRadius: 999,
  minHeight: 28,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 950,
}

const lessonCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 760,
}

const assignmentListStyle: CSSProperties = {
  display: 'grid',
  gap: 9,
}

const reviewQueueStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 9,
}

const reviewQueueMetricStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(155,225,29,0.15)',
  background: 'rgba(255,255,255,0.055)',
  color: 'var(--shell-copy-muted)',
  minWidth: 0,
}

const sessionPlannerStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.18)',
  background:
    'linear-gradient(135deg, rgba(155,225,29,0.09), rgba(116,190,255,0.045)), rgba(255,255,255,0.035)',
  minWidth: 0,
}

const contactPanelStyle: CSSProperties = {
  ...sessionPlannerStyle,
  border: '1px solid rgba(116,190,255,0.2)',
  background:
    'linear-gradient(135deg, rgba(116,190,255,0.1), rgba(155,225,29,0.055)), rgba(255,255,255,0.035)',
}

const sharedLessonCalendarStyle: CSSProperties = {
  ...sessionPlannerStyle,
  border: '1px solid rgba(155,225,29,0.22)',
  background:
    'linear-gradient(135deg, rgba(155,225,29,0.1), rgba(116,190,255,0.06)), rgba(255,255,255,0.035)',
}

const sharedLessonCalendarGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))',
  gap: 8,
}

const sharedLessonCalendarItemStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  padding: 11,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(5,11,22,0.3)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.35,
  minWidth: 0,
}

const assignmentSendPanelStyle: CSSProperties = {
  ...sessionPlannerStyle,
  border: '1px solid rgba(155,225,29,0.28)',
  background:
    'radial-gradient(circle at 88% 14%, rgba(155,225,29,0.18), transparent 30%), linear-gradient(135deg, rgba(155,225,29,0.11), rgba(116,190,255,0.045)), rgba(255,255,255,0.04)',
}

const assignmentSendChecklistStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const assignmentSendChecklistItemStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(8,18,32,0.5)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
}

const assignmentSendChecklistLabelStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 10,
  fontWeight: 950,
  textTransform: 'uppercase',
}

const firstAssignmentStarterStyle: CSSProperties = {
  ...sessionPlannerStyle,
  border: '1px solid rgba(155,225,29,0.22)',
  background:
    'linear-gradient(135deg, rgba(155,225,29,0.08), rgba(116,190,255,0.055)), rgba(255,255,255,0.035)',
}

const firstAssignmentStarterGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const starterButtonStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  textAlign: 'left',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 15,
  background: 'rgba(5,11,22,0.34)',
  color: 'var(--foreground-strong)',
  padding: 11,
  font: 'inherit',
  fontSize: 12,
  lineHeight: 1.35,
  fontWeight: 800,
  cursor: 'pointer',
}

const sessionPlannerHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  gap: 12,
  minWidth: 0,
}

const sessionPlannerTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 22,
  lineHeight: 1.08,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const compactSelectStyle: CSSProperties = {
  minHeight: 38,
  maxWidth: '100%',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(5,11,22,0.72)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  padding: '0 10px',
}

const sessionBestForStyle: CSSProperties = {
  margin: 0,
  color: 'var(--brand-green)',
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const sessionStepGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const sessionStepStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  padding: 11,
  borderRadius: 15,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(5,11,22,0.28)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 760,
  overflowWrap: 'anywhere',
}

const sessionActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 9,
  minWidth: 0,
}

const assignmentCardStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(155,225,29,0.13)',
  background: 'rgba(155,225,29,0.055)',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 780,
}

const assignmentTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  minWidth: 0,
}

function assignmentStatusStyle(status: CoachAssignment['status']): CSSProperties {
  const completed = status === 'completed'
  return {
    borderRadius: 999,
    border: completed ? '1px solid rgba(155,225,29,0.32)' : '1px solid rgba(116,190,255,0.22)',
    background: completed ? 'rgba(155,225,29,0.14)' : 'rgba(116,190,255,0.1)',
    color: completed ? 'var(--brand-green)' : 'var(--shell-copy-muted)',
    padding: '3px 8px',
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  }
}

function assignmentDueStyle(tone: ReturnType<typeof getCoachAssignmentDueState>['tone']): CSSProperties {
  const urgent = tone === 'overdue' || tone === 'today'
  const soon = tone === 'soon'
  return {
    width: 'fit-content',
    borderRadius: 999,
    border: urgent
      ? '1px solid rgba(255,122,122,0.32)'
      : soon
        ? '1px solid rgba(155,225,29,0.24)'
        : '1px solid rgba(255,255,255,0.12)',
    background: urgent
      ? 'rgba(255,122,122,0.12)'
      : soon
        ? 'rgba(155,225,29,0.1)'
        : 'rgba(255,255,255,0.06)',
    color: urgent ? '#ffb2b2' : soon ? 'var(--brand-green)' : 'var(--shell-copy-muted)',
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 900,
  }
}

const assignmentLevelUpStatusRailStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))',
  gap: 8,
  minWidth: 0,
  padding: 8,
  borderRadius: 14,
  border: '1px solid rgba(116, 190, 255, 0.14)',
  background: 'rgba(255, 255, 255, 0.035)',
}

function assignmentLevelUpStatusStepStyle(done: boolean): CSSProperties {
  return {
    display: 'grid',
    gap: 3,
    minWidth: 0,
    padding: '8px 9px',
    borderRadius: 12,
    border: done ? '1px solid rgba(155, 225, 29, 0.28)' : '1px solid rgba(116, 190, 255, 0.12)',
    background: done ? 'rgba(155, 225, 29, 0.09)' : 'rgba(255, 255, 255, 0.035)',
    color: 'var(--shell-copy-muted)',
    overflowWrap: 'anywhere',
  }
}

function connectionBadgeStyle(connection: LinkedPlayerCard['connection']): CSSProperties {
  const linked = connection === 'linked'
  const pending = connection === 'pending'
  return {
    borderRadius: 999,
    border: linked
      ? '1px solid rgba(155,225,29,0.34)'
      : pending
        ? '1px solid rgba(255,194,87,0.32)'
        : '1px solid rgba(255,255,255,0.12)',
    background: linked
      ? 'rgba(155,225,29,0.14)'
      : pending
        ? 'rgba(255,194,87,0.1)'
        : 'rgba(255,255,255,0.055)',
    color: linked ? 'var(--brand-green)' : pending ? '#ffc257' : 'var(--shell-copy-muted)',
    padding: '4px 8px',
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: '.05em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  }
}

function pressureBadgeStyle(tone: ReturnType<typeof getCoachAssignmentDueState>['tone']): CSSProperties {
  const urgent = tone === 'overdue' || tone === 'today'
  const soon = tone === 'soon'
  return {
    ...miniBadgeStyle,
    border: urgent
      ? '1px solid rgba(255,122,122,0.32)'
      : soon
        ? '1px solid rgba(155,225,29,0.24)'
        : '1px solid rgba(255,255,255,0.12)',
    background: urgent
      ? 'rgba(255,122,122,0.12)'
      : soon
        ? 'rgba(155,225,29,0.1)'
        : 'rgba(255,255,255,0.055)',
    color: urgent ? '#ffb2b2' : soon ? 'var(--brand-green)' : 'var(--shell-copy-muted)',
  }
}

const checkInReviewStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  marginTop: 3,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(5,11,22,0.32)',
  color: 'var(--shell-copy-muted)',
}

const levelUpProofStyle: CSSProperties = {
  ...checkInReviewStyle,
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.12), rgba(116,190,255,0.055))',
}

const proofSourceCueStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 750,
  lineHeight: 1.5,
}

const proofSourceCueHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
}

const proofSourceCueGridStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
}

const proofSourceCueItemStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  padding: 8,
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(5,11,22,0.28)',
}

const proofReviewStandardStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  marginTop: 4,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.2)',
  background: 'rgba(255,255,255,0.055)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
}

const proofNextMoveStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  marginTop: 4,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(155,225,29,0.2)',
  background: 'rgba(5,11,22,0.3)',
}

const proofDecisionPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 6,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.2)',
  background: 'rgba(5,11,22,0.32)',
}

const proofDecisionHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
}

const proofDecisionGridStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 145px), 1fr))',
}

function proofDecisionButtonStyle(recommended: boolean): CSSProperties {
  return {
    display: 'grid',
    gap: 5,
    minHeight: 118,
    alignContent: 'start',
    textAlign: 'left',
    borderRadius: 12,
    border: recommended ? '1px solid rgba(155,225,29,0.4)' : '1px solid rgba(255,255,255,0.1)',
    background: recommended ? 'rgba(155,225,29,0.13)' : 'rgba(255,255,255,0.045)',
    color: 'var(--shell-copy)',
    padding: 10,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 750,
    lineHeight: 1.4,
  }
}

const proofNextMoveActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
}

function proofScoreBadgeStyle(rating: number): CSSProperties {
  const strong = rating >= 4
  const repeat = rating >= 2 && rating < 4
  return {
    borderRadius: 999,
    border: strong
      ? '1px solid rgba(155,225,29,0.42)'
      : repeat
        ? '1px solid rgba(255,194,87,0.36)'
        : '1px solid rgba(255,122,122,0.36)',
    background: strong
      ? 'rgba(155,225,29,0.16)'
      : repeat
        ? 'rgba(255,194,87,0.12)'
        : 'rgba(255,122,122,0.12)',
    color: strong ? 'var(--brand-green)' : repeat ? '#ffc257' : '#ffb2b2',
    padding: '3px 8px',
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  }
}

const assignmentSummaryStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
}

const assignmentTrackerListStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  display: 'grid',
  gap: 3,
}

const coachResponseStyle: CSSProperties = {
  ...checkInReviewStyle,
  border: '1px solid rgba(155,225,29,0.2)',
  background: 'rgba(155,225,29,0.08)',
}

const reviewFormStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  marginTop: 4,
}

const reviewTextareaStyle: CSSProperties = {
  width: '100%',
  minHeight: 82,
  resize: 'vertical',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.08)',
  color: 'var(--foreground-strong)',
  padding: '10px 11px',
  font: 'inherit',
  boxSizing: 'border-box',
}

const reviewInputStyle: CSSProperties = {
  width: '100%',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.08)',
  color: 'var(--foreground-strong)',
  padding: '9px 11px',
  font: 'inherit',
  boxSizing: 'border-box',
}

const reviewActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
}

const smallPrimaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 999,
  background: 'var(--brand-green)',
  color: '#071226',
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 950,
  cursor: 'pointer',
}

const inlineActionButtonStyle: CSSProperties = {
  border: 0,
  background: 'transparent',
  color: 'var(--brand-green)',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 12,
  fontWeight: 950,
  padding: 0,
}

const smallPrimaryLinkStyle: CSSProperties = {
  ...smallPrimaryButtonStyle,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
}

const smallGhostButtonStyle: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--foreground-strong)',
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer',
}

const smallGhostLinkStyle: CSSProperties = {
  ...smallGhostButtonStyle,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
}

const disabledPillStyle: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--shell-copy-muted)',
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 900,
}

const integrationStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
  gap: 16,
  padding: 20,
  borderRadius: 24,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.1), rgba(13,31,58,0.78) 42%, rgba(5,11,22,0.92))',
}

const sectionTitleStyle: CSSProperties = {
  margin: '8px 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.7rem, 3vw, 3rem)',
  lineHeight: 1,
  fontWeight: 950,
}

const integrationGridStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
}

const integrationPillStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.055)',
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 850,
}
