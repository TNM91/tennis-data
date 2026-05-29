'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import LockedPlanPage from '@/app/components/locked-plan-page'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import { buildProductAccessState } from '@/lib/access-model'
import { COACH_ASSIGNMENT_TEMPLATES, getCoachAssignmentTemplate } from '@/lib/coach-assignment-templates'
import type { CoachStudentInvite } from '@/lib/coach-invites'
import {
  assignmentNeedsCoachReview,
  getCoachAssignmentDueState,
  getCoachAssignmentReview,
  getCoachAssignmentSummary,
  getPlayerAssignmentCheckIn,
  sortCoachAssignmentsForReview,
  type CoachAssignment,
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
import { getPlayerDevelopmentIdentity } from '@/lib/player-development'

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

export default function CoachPage() {
  return (
    <SiteShell active="/coach">
      <CoachContent />
    </SiteShell>
  )
}

function CoachContent() {
  const router = useRouter()
  const { role, userId, entitlements, authResolved, session } = useAuth()
  const resolvedRole = authResolved || !userId ? role : 'member'
  const access = useMemo(() => buildProductAccessState(resolvedRole, entitlements), [entitlements, resolvedRole])
  const studentSnapshots = useMemo(() => buildCoachStudentSnapshots(), [])
  const [savedStudents, setSavedStudents] = useState<CoachStudentLink[]>([])
  const [assignments, setAssignments] = useState<CoachAssignment[]>([])
  const [studentName, setStudentName] = useState('')
  const [studentLevel, setStudentLevel] = useState('')
  const [studentIdentity, setStudentIdentity] = useState('relentless-competitor-4-0')
  const [inviteEmail, setInviteEmail] = useState('')
  const [studentPhone, setStudentPhone] = useState('')
  const [contactPreference, setContactPreference] = useState<CoachStudentLink['contactPreference']>('in_app')
  const [invites, setInvites] = useState<CoachStudentInvite[]>([])
  const [assignmentStudentId, setAssignmentStudentId] = useState('')
  const [assignmentTitle, setAssignmentTitle] = useState('')
  const [assignmentFocus, setAssignmentFocus] = useState('')
  const [assignmentDueDate, setAssignmentDueDate] = useState('')
  const [assignmentTemplateId, setAssignmentTemplateId] = useState(COACH_ASSIGNMENT_TEMPLATES[0]?.id ?? '')
  const [assignmentPresetId, setAssignmentPresetId] = useState('')
  const [assignmentStarterId, setAssignmentStarterId] = useState('')
  const [contactStudentId, setContactStudentId] = useState('')
  const [lessonDateTime, setLessonDateTime] = useState('')
  const [lessonFocus, setLessonFocus] = useState('')
  const [sessionPresetId, setSessionPresetId] = useState(COACH_SESSION_PRESETS[0]?.id ?? '')
  const [reviewAssignmentId, setReviewAssignmentId] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [reviewNextFocus, setReviewNextFocus] = useState('')
  const [workspaceMessage, setWorkspaceMessage] = useState('')
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [lastCreatedAssignment, setLastCreatedAssignment] = useState<CoachAssignment | null>(null)

  const loadCoachWorkspace = useCallback(async () => {
    if (!session?.access_token || !access.canUseCoachWorkflow) return
    setWorkspaceLoading(true)
    setWorkspaceMessage('')

    try {
      const [studentsResponse, assignmentsResponse, invitesResponse] = await Promise.all([
        fetch('/api/coach/students', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch('/api/coach/assignments', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch('/api/coach/invites', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ])

      const studentsJson = (await studentsResponse.json()) as { ok?: boolean; students?: CoachStudentLink[]; message?: string }
      const assignmentsJson = (await assignmentsResponse.json()) as { ok?: boolean; assignments?: CoachAssignment[]; message?: string }
      const invitesJson = (await invitesResponse.json()) as { ok?: boolean; invites?: CoachStudentInvite[]; message?: string }

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
      setAssignmentStudentId((current) => current || studentsJson.students?.[0]?.id || '')
      setContactStudentId((current) => current || studentsJson.students?.[0]?.id || '')
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : 'Could not load Coach workspace.')
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

  async function handleAddStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session?.access_token || !studentName.trim()) return

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
            levelLabel: studentLevel,
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

      setSavedStudents((current) => [json.student as CoachStudentLink, ...current.filter((student) => student.id !== json.student?.id)])
      setAssignmentStudentId(json.student.id)
      setContactStudentId(json.student.id)
      setStudentName('')
      setStudentLevel('')
      setInviteEmail('')
      setStudentPhone('')
      setContactPreference('in_app')
      setWorkspaceMessage('Student added. Create the first assignment while the lesson is fresh.')

      if (inviteEmail.trim() || studentPhone.trim()) {
        await createInvite(json.student.id, inviteEmail.trim())
      }
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : 'Could not add student.')
    } finally {
      setWorkspaceLoading(false)
    }
  }

  async function handleCreateAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session?.access_token || !assignmentStudentId || !assignmentTitle.trim()) return

    const template = getCoachAssignmentTemplate(assignmentTemplateId)
    const presetAssignment = assignmentPresetId ? buildSessionPresetAssignment(assignmentPresetId) : null
    const starterAssignment = assignmentStarterId
      ? FIRST_ASSIGNMENT_STARTERS.find((starter) => starter.id === assignmentStarterId) ?? null
      : null
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
            studentLinkId: assignmentStudentId,
            title: assignmentTitle,
            focus: assignmentFocus,
            dueDate: assignmentDueDate,
            status: 'assigned',
            assignment: {
              templateId: presetAssignment ? assignmentPresetId : template.id,
              detail: presetAssignment?.detail ?? template.detail,
              ...template.assignment,
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
              source: 'coach-portal',
              createdFrom: starterAssignment ? 'first-assignment-starter' : presetAssignment ? 'session-preset' : 'one-hour-lesson-frame',
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
      setLastCreatedAssignment(savedAssignment)
      setContactStudentId(savedAssignment.studentLinkId)
      setAssignmentTitle('')
      setAssignmentFocus('')
      setAssignmentDueDate('')
      setAssignmentPresetId('')
      setAssignmentStarterId('')
      setWorkspaceMessage('Assignment created. Send it now so the player knows exactly what to do next.')
    } catch (error) {
      setWorkspaceMessage(error instanceof Error ? error.message : 'Could not create assignment.')
    } finally {
      setWorkspaceLoading(false)
    }
  }

  async function createInvite(studentLinkId: string, email: string) {
    if (!session?.access_token) return

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
    setWorkspaceMessage('Student added and invite link created.')
  }

  function handleAssignmentTemplateChange(templateId: string) {
    const template = getCoachAssignmentTemplate(templateId)
    setAssignmentTemplateId(template.id)
    setAssignmentTitle(template.title)
    setAssignmentFocus(template.focus)
    setAssignmentPresetId('')
    setAssignmentStarterId('')
  }

  function useSessionPresetForAssignment() {
    const presetAssignment = buildSessionPresetAssignment(sessionPresetId)
    setAssignmentTitle(presetAssignment.title)
    setAssignmentFocus(presetAssignment.focus)
    setAssignmentPresetId(sessionPresetId)
    setAssignmentStarterId('')
    setWorkspaceMessage('Session preset loaded into the assignment form. Choose a student and due date, then create the Player+ follow-through.')
  }

  function loadFirstAssignmentStarter(starter: (typeof FIRST_ASSIGNMENT_STARTERS)[number]) {
    const template = getCoachAssignmentTemplate(starter.templateId)
    setAssignmentTemplateId(template.id)
    setAssignmentTitle(starter.title)
    setAssignmentFocus(starter.focus)
    setAssignmentDueDate(getDateInputDaysFromNow(7))
    setAssignmentPresetId('')
    setAssignmentStarterId(starter.id)
    setWorkspaceMessage(`${starter.title} loaded. Expected evidence: ${starter.evidence}`)
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
      setWorkspaceMessage('Review saved. Player+ can now see the next focus in My Lab.')
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
  const selectedContactStudent = useMemo(
    () => savedStudents.find((student) => student.id === contactStudentId) ?? savedStudents[0] ?? null,
    [contactStudentId, savedStudents],
  )
  const lessonMessage = useMemo(
    () => buildLessonConfirmMessage(selectedContactStudent?.playerName ?? 'your lesson', lessonDateTime, lessonFocus),
    [lessonDateTime, lessonFocus, selectedContactStudent?.playerName],
  )
  const lastCreatedAssignmentStudent = useMemo(
    () => (lastCreatedAssignment ? savedStudents.find((student) => student.id === lastCreatedAssignment.studentLinkId) ?? null : null),
    [lastCreatedAssignment, savedStudents],
  )
  const lastAssignmentSummary = useMemo(
    () => (lastCreatedAssignment ? getCoachAssignmentSummary(lastCreatedAssignment.assignment) : null),
    [lastCreatedAssignment],
  )
  const lastAssignmentNotifyMessage = useMemo(
    () => (lastCreatedAssignment ? buildAssignmentNotifyMessage(lastCreatedAssignment, lastAssignmentSummary) : ''),
    [lastAssignmentSummary, lastCreatedAssignment],
  )
  const assignmentsNeedingReview = useMemo(
    () => assignments.filter(assignmentNeedsCoachReview),
    [assignments],
  )
  const activeAssignmentsCount = assignments.filter((assignment) => assignment.status === 'assigned').length
  const reviewedAssignmentsCount = assignments.filter((assignment) => Boolean(getCoachAssignmentReview(assignment.assignment))).length
  const linkedPlayersCount = linkedPlayerCards.filter((card) => card.connection === 'linked').length
  const pendingInviteCount = linkedPlayerCards.filter((card) => card.connection === 'pending').length
  const overduePlayersCount = linkedPlayerCards.filter((card) => card.dueTone === 'overdue' || card.dueTone === 'today').length
  const coachQueueActions = useMemo(
    () => buildCoachQueueActions(linkedPlayerCards, assignmentsNeedingReview, savedStudents.length),
    [assignmentsNeedingReview, linkedPlayerCards, savedStudents.length],
  )

  if (!authResolved || role === 'public') return null

  if (!access.canUseCoachWorkflow) {
    return (
      <LockedPlanPage
        active="/coach"
        planId="coach"
        headline="Unlock Coach to develop players with a connected workflow."
        body="Coach brings lesson plans, Tactical Studio boards, assignments, student tracking, and scheduling into one workspace."
        result="Players can still use printed guides, but linked digital follow-through unlocks with Player+ and Coach access."
        ctaLabel="Unlock Coach"
        secondaryLabel="Compare Full-Court"
        secondaryHref="/pricing#full_court"
      />
    )
  }

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div style={heroCopyStyle}>
          <div style={eyebrowStyle}>Coach workspace</div>
          <h1 style={titleStyle}>Plan the lesson. Assign the work. Track the player.</h1>
          <p style={bodyStyle}>
            Coach is for private teachers, development coaches, and team coaches who need practical player follow-through.
            Team competition operations stay in Captain; Full-Court includes both.
          </p>
          <div style={heroActionsStyle}>
            <Link href="/tactics" style={primaryLinkStyle}>Open Tactical Studio</Link>
            <Link href="/player-development" style={secondaryLinkStyle}>Open development paths</Link>
          </div>
        </div>
        <div style={heroPanelStyle}>
          <TiqFeatureIcon name="scenarioBuilder" size="xl" variant="surface" />
          <strong>Player+ connection</strong>
          <span>Standalone guides stay useful on paper. Linked players get check-ins, assignments, and progress history inside TenAceIQ.</span>
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

      <section style={linkedDashboardStyle} aria-label="Linked players dashboard">
        <div style={linkedDashboardHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>Linked players</div>
            <h2 style={sectionTitleStyle}>Know who needs the next touch.</h2>
            <p style={bodyStyle}>
              Track setup status, Player+ connection, assignment pressure, and review needs before the next lesson.
            </p>
          </div>
          <div style={linkedMetricGridStyle}>
            <DashboardMetric label="Linked" value={linkedPlayersCount} />
            <DashboardMetric label="Pending" value={pendingInviteCount} />
            <DashboardMetric label="Review" value={assignmentsNeedingReview.length} />
            <DashboardMetric label="Due now" value={overduePlayersCount} />
          </div>
        </div>
        <div style={coachQueueStyle} aria-label="Coach priority queue">
          <div style={coachQueueIntroStyle}>
            <div style={eyebrowStyle}>Today&apos;s coach queue</div>
            <strong>Start with the highest-leverage touch.</strong>
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
        <div style={linkedCardsGridStyle}>
          {linkedPlayerCards.length ? linkedPlayerCards.map((card) => (
            <article key={card.student.id} style={linkedPlayerCardStyle}>
              <div style={linkedCardTopStyle}>
                <div>
                  <strong>{card.student.playerName}</strong>
                  <span>{getIdentityTitle(card.student.identitySlug)} / {card.student.levelLabel || 'Development path'}</span>
                </div>
                <span style={connectionBadgeStyle(card.connection)}>{card.connectionLabel}</span>
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
                    ? 'Invite pending. Send setup link, then create the first Player+ assignment.'
                    : 'Create a measurable next action from the last lesson.'}
              </p>
              <div style={studentActionRowStyle}>
                <button
                  type="button"
                  onClick={() => {
                    setAssignmentStudentId(card.student.id)
                    setAssignmentTitle('')
                    setAssignmentFocus('')
                    setWorkspaceMessage(`Assignment form is ready for ${card.student.playerName}.`)
                  }}
                  style={inlineActionButtonStyle}
                >
                  Assign work
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContactStudentId(card.student.id)
                    setWorkspaceMessage(`Quick contact is ready for ${card.student.playerName}.`)
                  }}
                  style={inlineActionButtonStyle}
                >
                  Contact
                </button>
                {card.student.playerUserId ? (
                  <Link href={buildCoachPlayerMessageHref(card.student, 'Coach check-in', `Quick coach note for ${card.student.playerName}: `)} style={studentActionStyle}>
                    Message
                  </Link>
                ) : card.pendingInvite ? (
                  <a href={card.pendingInvite.inviteHref} style={studentActionStyle}>Setup link</a>
                ) : null}
              </div>
            </article>
          )) : (
            <article style={linkedEmptyStyle}>
              <strong>No linked players yet.</strong>
              <span>Add a student below, then send a setup link when you want the Player+ layer connected.</span>
            </article>
          )}
        </div>
      </section>

      <section style={workspaceGridStyle}>
        <div id="coach-student-board" style={panelStyle}>
          <PanelHeader eyebrow="Student board" title="Coach the next action, not a vague goal." />
          <form onSubmit={handleAddStudent} style={formGridStyle}>
            <label style={fieldStyle}>
              Player name
              <input value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="Add a student" style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              Development path
              <select value={studentIdentity} onChange={(event) => setStudentIdentity(event.target.value)} style={inputStyle}>
                <option value="relentless-competitor-4-0">Relentless Competitor</option>
                <option value="smart-attacker-4-0-to-4-5">Smart Attacker</option>
              </select>
            </label>
            <label style={fieldStyle}>
              Level / group
              <input value={studentLevel} onChange={(event) => setStudentLevel(event.target.value)} placeholder="4.0, varsity, clinic..." style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              Player email
              <input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="Optional account email" style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              Cell phone
              <input inputMode="tel" value={studentPhone} onChange={(event) => setStudentPhone(event.target.value)} placeholder="Optional text setup" style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              Contact
              <select value={contactPreference} onChange={(event) => setContactPreference(event.target.value as CoachStudentLink['contactPreference'])} style={inputStyle}>
                <option value="in_app">TenAceIQ IM</option>
                <option value="text">Text</option>
                <option value="both">IM + text</option>
              </select>
            </label>
            <button type="submit" disabled={workspaceLoading || !studentName.trim()} style={primaryButtonStyle}>
              {workspaceLoading ? 'Saving...' : 'Add student'}
            </button>
          </form>
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
                            <a href={buildSmsHref(student.playerPhone, `I created your TenAceIQ player setup link. Finish your account here: ${setupInvite.inviteHref}`)} style={studentActionStyle}>
                              Text setup
                            </a>
                          ) : null}
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
                        <a href={buildSmsHref(student.playerPhone, `Let's confirm your next lesson. Date/time:  Site:  Focus: `)} style={studentActionStyle}>
                          Text lesson
                        </a>
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
                      <a
                        href={buildSmsHref(inviteStudent.playerPhone, `I created your TenAceIQ player setup link. Finish your account here: ${invite.inviteHref}`)}
                        style={studentActionStyle}
                      >
                        Text setup link
                      </a>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        <div id="coach-lesson-frame" style={panelStyle}>
          <PanelHeader eyebrow="Lesson frame" title="A repeatable one-hour coaching rhythm." />
          <form onSubmit={handleCreateAssignment} style={formGridStyle}>
            <label style={fieldStyle}>
              Student
              <select value={assignmentStudentId} onChange={(event) => setAssignmentStudentId(event.target.value)} style={inputStyle}>
                <option value="">Choose student</option>
                {savedStudents.map((student) => (
                  <option key={student.id} value={student.id}>{student.playerName}</option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              Template
              <select value={assignmentTemplateId} onChange={(event) => handleAssignmentTemplateChange(event.target.value)} style={inputStyle}>
                {COACH_ASSIGNMENT_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>{template.title}</option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              Assignment
              <input value={assignmentTitle} onChange={(event) => setAssignmentTitle(event.target.value)} placeholder="Example: 60 serve targets" style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              Focus
              <input value={assignmentFocus} onChange={(event) => setAssignmentFocus(event.target.value)} placeholder="Serve, return, movement..." style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              Due date
              <input type="date" value={assignmentDueDate} onChange={(event) => setAssignmentDueDate(event.target.value)} style={inputStyle} />
            </label>
            <button type="submit" disabled={workspaceLoading || !assignmentStudentId || !assignmentTitle.trim()} style={primaryButtonStyle}>
              {workspaceLoading ? 'Saving...' : 'Create assignment'}
            </button>
          </form>
          <div style={firstAssignmentStarterStyle}>
            <div>
              <div style={eyebrowStyle}>First assignment starter</div>
              <h3 style={sessionPlannerTitleStyle}>Answer the “what should I work on first?” message.</h3>
              <p style={studentNextStyle}>
                Load a practical first Player+ assignment, then create it and send it from the ready panel.
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
          {workspaceMessage ? <div style={messageStyle}>{workspaceMessage}</div> : null}
          {lastCreatedAssignment && lastCreatedAssignmentStudent ? (
            <div style={assignmentSendPanelStyle}>
              <div>
                <div style={eyebrowStyle}>Assignment ready</div>
                <h3 style={sessionPlannerTitleStyle}>{lastCreatedAssignment.title}</h3>
                <p style={studentNextStyle}>
                  Send to {lastCreatedAssignmentStudent.playerName}. Player+ accounts can receive this inside TenAceIQ; cell numbers can use the free text shortcut.
                </p>
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
                      },
                    )}
                    style={smallPrimaryLinkStyle}
                  >
                    Send IM
                  </Link>
                ) : (
                  <span style={disabledPillStyle}>Link Player+ for IM</span>
                )}
                {lastCreatedAssignmentStudent.playerPhone ? (
                  <a href={buildSmsHref(lastCreatedAssignmentStudent.playerPhone, lastAssignmentNotifyMessage)} style={smallGhostLinkStyle}>
                    Send text
                  </a>
                ) : (
                  <span style={disabledPillStyle}>Add cell for text</span>
                )}
                <button type="button" onClick={() => setLastCreatedAssignment(null)} style={smallGhostButtonStyle}>
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
          <div style={contactPanelStyle}>
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
            <div style={sessionStepGridStyle}>
              <label style={fieldStyle}>
                Date / time
                <input value={lessonDateTime} onChange={(event) => setLessonDateTime(event.target.value)} placeholder="Tue 4:30 PM" style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                Lesson focus
                <input value={lessonFocus} onChange={(event) => setLessonFocus(event.target.value)} placeholder="Serve + first ball" style={inputStyle} />
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
                <span style={disabledPillStyle}>Link Player+ for IM</span>
              )}
              {selectedContactStudent?.playerPhone ? (
                <a href={buildSmsHref(selectedContactStudent.playerPhone, lessonMessage)} style={smallGhostLinkStyle}>
                  Send text
                </a>
              ) : (
                <span style={disabledPillStyle}>Add cell for text</span>
              )}
            </div>
          </div>
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
              <SessionStep label="Player+ prompt" value={selectedSessionPreset.playerPlusPrompt} />
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
          <div style={assignmentListStyle}>
            {sortedAssignments.length > 0 ? (
              sortedAssignments.slice(0, 6).map((assignment) => {
                const playerCheckIn = getPlayerAssignmentCheckIn(assignment.assignment)
                const coachReview = getCoachAssignmentReview(assignment.assignment)
                const assignmentSummary = getCoachAssignmentSummary(assignment.assignment)
                const dueState = getCoachAssignmentDueState(assignment.dueDate)
                const student = savedStudents.find((candidate) => candidate.id === assignment.studentLinkId)
                return (
                  <article key={assignment.id} id={`coach-assignment-${assignment.id}`} style={assignmentCardStyle}>
                    <div style={assignmentTopStyle}>
                      <strong>{assignment.title}</strong>
                      <span style={assignmentStatusStyle(assignment.status)}>{getAssignmentStatusLabel(assignment.status)}</span>
                    </div>
                    <span>{student?.playerName || 'Student'} / {assignment.focus || 'Coach assignment'}</span>
                    <span style={assignmentDueStyle(dueState.tone)}>{dueState.label}</span>
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
                          },
                        )}
                        style={studentActionStyle}
                      >
                        Message about this
                      </Link>
                    ) : null}
                    {student?.playerPhone ? (
                      <a href={buildSmsHref(student.playerPhone, buildAssignmentNotifyMessage(assignment, assignmentSummary))} style={studentActionStyle}>
                        Text about this
                      </a>
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
                    ) : playerCheckIn ? (
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
                            setReviewNote('')
                            setReviewNextFocus('')
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
      </section>

      <section style={integrationStyle}>
        <div>
          <div style={eyebrowStyle}>How this fits TenAceIQ</div>
          <h2 style={sectionTitleStyle}>Coach creates the plan. Player+ carries it between lessons.</h2>
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
      title: `Finish ${pendingCard.student.playerName}'s Player+ link`,
      detail: 'Send the setup link again so assignments, check-ins, and messages connect.',
      href: pendingCard.pendingInvite.inviteHref,
      tone: 'setup',
    })
  }

  if (!studentCount) {
    actions.push({
      label: 'Start',
      title: 'Add your first student',
      detail: 'Create the player record, then send the setup link when you want Player+ follow-through.',
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
  if (student.playerUserId || student.setupStatus === 'linked') return 'Linked Player+ account'
  if (student.setupStatus === 'invited') return 'Setup link sent'
  return 'Manual student'
}

function buildLessonConfirmMessage(playerName: string, dateTime: string, focus: string) {
  const details = [
    dateTime.trim() ? `Time: ${dateTime.trim()}` : 'Time: ',
    focus.trim() ? `Focus: ${focus.trim()}` : 'Focus: ',
  ].join('  ')
  return `Let's confirm the next lesson for ${playerName}. ${details}`
}

function getDateInputDaysFromNow(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function buildAssignmentNotifyMessage(
  assignment: CoachAssignment,
  summary: ReturnType<typeof getCoachAssignmentSummary> | null,
) {
  const focus = assignment.focus.trim() || 'Coach follow-through'
  const due = assignment.dueDate ? ` Due: ${assignment.dueDate}.` : ''
  const detail = summary?.detail ? ` ${summary.detail}` : ''
  const volume = summary?.volume ? ` Target: ${summary.volume}.` : ''
  const evidence = summary?.expectedEvidence ? ` Evidence: ${summary.expectedEvidence}.` : ''
  return `New TenAceIQ assignment: ${assignment.title}. Focus: ${focus}.${due}${detail}${volume}${evidence}`
}

function buildSmsHref(phone: string, body: string) {
  const sanitizedPhone = phone.replace(/[^\d+]/g, '')
  return `sms:${sanitizedPhone}?body=${encodeURIComponent(body)}`
}

function buildCoachPlayerMessageHref(
  student: CoachStudentLink,
  subject: string,
  body: string,
  assignmentContext?: {
    assignmentId: string
    assignmentTitle: string
    assignmentFocus: string
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

const linkedBadgeRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 7,
  alignItems: 'center',
  minWidth: 0,
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
  outline: 'none',
  padding: '0 11px',
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

const assignmentSendPanelStyle: CSSProperties = {
  ...sessionPlannerStyle,
  border: '1px solid rgba(155,225,29,0.28)',
  background:
    'radial-gradient(circle at 88% 14%, rgba(155,225,29,0.18), transparent 30%), linear-gradient(135deg, rgba(155,225,29,0.11), rgba(116,190,255,0.045)), rgba(255,255,255,0.04)',
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
