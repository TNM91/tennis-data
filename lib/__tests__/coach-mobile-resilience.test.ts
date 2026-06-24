import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const coachSource = readFileSync(join(process.cwd(), 'app/coach/page.tsx'), 'utf8')
const shellSource = readFileSync(join(process.cwd(), 'app/components/site-shell.tsx'), 'utf8')
const lockedPlanSource = readFileSync(join(process.cwd(), 'app/components/locked-plan-page.tsx'), 'utf8')

describe('coach mobile resilience', () => {
  it('keeps the phone coach page from stacking duplicate portal-like headers', () => {
    expect(coachSource).toContain('const { isMobile } = useViewportBreakpoints()')
    expect(coachSource).toContain('isMobile ? (')
    expect(coachSource).toContain('<h1 style={visuallyHiddenStyle}>Coach Hub</h1>')
    expect(coachSource).toContain('<section style={heroStyle}>')
    expect(coachSource).toContain('<section style={coachSupportPathStyle}')
    expect(coachSource).toContain('<section style={commandGridStyle}')
  })

  it('renders locked Coach and Captain previews inside the existing mobile shell', () => {
    const captainLockedPages = [
      'app/captain/practice/page.tsx',
      'app/captain/availability/page.tsx',
      'app/captain/analytics/page.tsx',
      'app/captain/lineup-projection/page.tsx',
      'app/captain/messaging/page.tsx',
      'app/captain/lineup-availability/page.tsx',
      'app/captain/lineup-builder/page.tsx',
      'app/captain/team-brief/page.tsx',
      'app/captain/scenario-builder/page.tsx',
      'app/captain/weekly-brief/page.tsx',
    ]

    expect(lockedPlanSource).toContain('withinShell?: boolean')
    expect(lockedPlanSource).toContain('withinShell = false')
    expect(lockedPlanSource).toContain('if (withinShell) return content')
    expect(lockedPlanSource).toContain('return <SiteShell active={active}>{content}</SiteShell>')
    expect(coachSource).toContain('<LockedPlanPage')
    expect(coachSource).toContain('withinShell')

    for (const page of captainLockedPages) {
      const source = readFileSync(join(process.cwd(), page), 'utf8')
      expect(source, `${page} should reuse its surrounding SiteShell`).toContain('withinShell')
    }
  })

  it('preserves in-progress student contact fields when the phone browser reloads', () => {
    expect(coachSource).toContain("const COACH_STUDENT_DRAFT_KEY = 'tenaceiq.coach.studentDraft.v1'")
    expect(coachSource).toContain('type CoachStudentDraft = {')
    expect(coachSource).toContain('const [studentDraftHydrated, setStudentDraftHydrated] = useState(false)')
    expect(coachSource).toContain('window.localStorage.getItem(COACH_STUDENT_DRAFT_KEY)')
    expect(coachSource).toContain('window.localStorage.setItem(COACH_STUDENT_DRAFT_KEY, JSON.stringify(draft))')
    expect(coachSource).toContain('window.localStorage.removeItem(COACH_STUDENT_DRAFT_KEY)')
    expect(coachSource).toContain('setStudentPhone(cleanText(draft.studentPhone))')
    expect(coachSource).toContain('function normalizeContactPreference')
  })

  it('makes phone-only student setup immediately textable on mobile', () => {
    expect(coachSource).toContain('const [lastCreatedStudentSetup, setLastCreatedStudentSetup] = useState')
    expect(coachSource).toContain("'Add student + text setup'")
    expect(coachSource).toContain('Student setup ready')
    expect(coachSource).toContain('Text setup now')
    expect(coachSource).toContain('setActiveMobileBenchStudentId(savedStudent.id)')
    expect(coachSource).toContain('if (isMobile) scrollToCoachBench()')
    expect(coachSource).toContain('const setupTextBody = card.pendingInvite ? buildCoachSetupText(card.pendingInvite.inviteHref) :')
    expect(coachSource).toContain("const mobileTextLabel = card.pendingInvite ? 'Text setup' : 'Text'")
    expect(coachSource).toContain('{mobileTextLabel}')
    expect(coachSource).toContain('function SmsActionLink')
    expect(coachSource).toContain('function buildCoachSetupText')
    expect(coachSource).toContain('Copy setup text')
    expect(coachSource).toContain('Copy setup')
    expect(coachSource).toContain('async function copyCoachText')
    expect(coachSource).toContain('Setup text copied for')
    expect(coachSource).toContain('window.location.href = buildSmsHref(phone, body, getSmsBodySeparator())')
    expect(coachSource).toContain("return /iPad|iPhone|iPod/i.test(navigator.userAgent) ? '&' : '?'")
  })

  it('prevents text contact from submitting without a usable cell number', () => {
    expect(coachSource).toContain('const textContactNeedsPhone = (contactPreference === \'text\' || contactPreference === \'both\') && !studentPhoneDigits')
    expect(coachSource).toContain("const studentPhoneLooksIncomplete = Boolean(studentPhone.trim()) && studentPhoneDigits.length < 7")
    expect(coachSource).toContain('const [addStudentSubmitAttempted, setAddStudentSubmitAttempted] = useState(false)')
    expect(coachSource).toContain("'Add a player name before saving.'")
    expect(coachSource).toContain("'Add a cell number before using Text contact.'")
    expect(coachSource).toContain("'Check the cell number before sending a text setup.'")
    expect(coachSource).toContain('const showAddStudentNameError = addStudentSubmitAttempted && Boolean(addStudentMissingNameMessage)')
    expect(coachSource).toContain('setAddStudentSubmitAttempted(true)')
    expect(coachSource).toContain('setAddStudentSubmitAttempted(false)')
    expect(coachSource).toContain('if (addStudentBlockedMessage) {')
    expect(coachSource).toContain('const addStudentDisabled = workspaceLoading')
    expect(coachSource).toContain('disabled={addStudentDisabled}')
    expect(coachSource).toContain('aria-disabled={Boolean(addStudentBlockedMessage) || addStudentDisabled}')
    expect(coachSource).toContain("aria-describedby={showAddStudentNameError ? 'coach-student-name-help' : undefined}")
    expect(coachSource).toContain('aria-describedby="coach-student-phone-help"')
    expect(coachSource).toContain('const fieldErrorStyle')
  })

  it('keeps assignment sends recoverable when mobile SMS handoff fails', () => {
    expect(coachSource).toContain('Copy assignment text')
    expect(coachSource).toContain('Assignment text copied for')
    expect(coachSource).toContain('Assignment text for')
    expect(coachSource).toContain('body={lastAssignmentNotifyMessage}')
    expect(coachSource).toContain('body={buildAssignmentNotifyMessage(assignment, assignmentSummary, assignmentShareHref)}')
  })

  it('restores the route position when a phone browser reloads or resumes the tab', () => {
    expect(shellSource).toContain('tenaceiq.shell.scroll.${pathname}')
    expect(shellSource).toContain("window.addEventListener('pagehide', persistScrollPosition)")
    expect(shellSource).toContain("document.addEventListener('visibilitychange', handleVisibilityChange)")
    expect(shellSource).toContain('window.sessionStorage.setItem')
    expect(shellSource).toContain('window.sessionStorage.getItem')
    expect(shellSource).toContain('window.location.hash')
    expect(shellSource).toContain('window.scrollTo({ top: y')
  })

  it('keeps the phone coach bench one tap away from player profile work', () => {
    const portalSource = readFileSync(join(process.cwd(), 'app/components/portal-tool-bar.tsx'), 'utf8')

    expect(portalSource).toContain("title: 'Player bench'")
    expect(portalSource).toContain("href: '/coach#coach-linked-dashboard'")
    expect(portalSource).toContain("if (title === 'Player bench') return 'Bench'")
    expect(coachSource).toContain('aria-label="Coach player bench"')
    expect(coachSource).toContain('aria-label="Choose a player from your coach bench"')
    expect(coachSource).toContain('aria-pressed={active}')
    expect(coachSource).toContain('function renderMobileBenchCommandCenter(card: LinkedPlayerCard)')
    expect(coachSource).toContain('function renderBenchMetrics()')
    expect(coachSource).toContain('function renderCoachQueue()')
    expect(coachSource).toContain('Active player')
    expect(coachSource).toContain('Active player workspace for')
    expect(coachSource).toContain('Bench snapshot')
    expect(coachSource).toContain('Today&apos;s coach queue')
    expect(coachSource).toContain('{isMobile ? null : renderBenchMetrics()}')
    expect(coachSource).toContain('{isMobile ? (')
    expect(coachSource).toContain(') : renderCoachQueue()}')
    expect(coachSource).toContain('Open player hub')
    expect(coachSource).toContain('Current work')
    expect(coachSource).toContain('getCoachPlayerProfileHref')
  })

  it('lets a coach jump from a player card into a Level Up assignment on phone', () => {
    expect(coachSource).toContain('onClick={() => loadStudentLevelUpPack(card)}')
    expect(coachSource).toContain('Level Up')
    expect(coachSource).toContain('function scrollToCoachLessonFrame()')
    expect(coachSource).toContain('function scrollToCoachSection(sectionId: string)')
    expect(coachSource).toContain('document.getElementById(sectionId)?.scrollIntoView')
    expect(coachSource).toContain('function scrollToCoachStudentBoard()')
    expect(coachSource).toContain("scrollToCoachSection('coach-student-board')")
    expect(coachSource).toContain('Add first player')
    expect(coachSource).toContain('onClick={scrollToCoachStudentBoard}')
    expect(coachSource).toContain('function prepareStudentAssignment(card: LinkedPlayerCard)')
    expect(coachSource).toContain('scrollToCoachLessonFrame()')
    expect(coachSource).toContain('function loadStudentLevelUpPack(card: LinkedPlayerCard)')
    expect(coachSource).toContain('const pack = COACH_LEVEL_UP_HANDOFF_PACKS[0]')
    expect(coachSource).toContain('loadLevelUpHandoffPack(pack)')
    expect(coachSource).toContain('Review the Level Up cards, then save a draft or create the assignment.')
    expect(coachSource).toContain('function renderLevelUpHandoffGrid(pack: (typeof COACH_LEVEL_UP_HANDOFF_PACKS)[number])')
    expect(coachSource).toContain('Level Up cards')
    expect(coachSource).toContain('{levelUpHandoffPack.cardIds.length} cards')
    expect(coachSource).toContain('{renderLevelUpHandoffGrid(levelUpHandoffPack)}')
    expect(coachSource).toContain('function renderDraftAssignmentGrid()')
    expect(coachSource).toContain('Saved drafts')
    expect(coachSource).toContain('{renderDraftAssignmentGrid()}')
  })

  it('keeps mobile player actions large, contextual, and recoverable', () => {
    expect(coachSource).toContain('onClick={() => chooseMobileBenchPlayer(card)}')
    expect(coachSource).toContain('function chooseMobileBenchPlayer(card: LinkedPlayerCard)')
    expect(coachSource).toContain('setAssignmentStudentId(card.student.id)')
    expect(coachSource).toContain('function prepareStudentContact(card: LinkedPlayerCard)')
    expect(coachSource).toContain('const [mobileContactPanelOpen, setMobileContactPanelOpen] = useState(false)')
    expect(coachSource).toContain('setMobileContactPanelOpen(true)')
    expect(coachSource).toContain('scrollToCoachContactPanel()')
    expect(coachSource).toContain('id="coach-contact-panel"')
    expect(coachSource).toContain('function renderQuickContactPanel()')
    expect(coachSource).toContain('open={mobileContactPanelOpen}')
    expect(coachSource).toContain('onToggle={(event) => setMobileContactPanelOpen(event.currentTarget.open)}')
    expect(coachSource).toContain("function renderMobilePlayerWorkspaceRail(surface: 'lesson' | 'contact')")
    expect(coachSource).toContain("renderMobilePlayerWorkspaceRail('lesson')")
    expect(coachSource).toContain("renderMobilePlayerWorkspaceRail('contact')")
    expect(coachSource).toContain('scrollToCoachBench')
    expect(coachSource).toContain('mobileBenchCommandCenterStyle')
    expect(coachSource).toContain('mobileBenchPrimaryActionGridStyle')
    expect(coachSource).toContain('mobileBenchSecondaryActionRowStyle')
    expect(coachSource).toContain('title={card.student.playerName}')
    expect(coachSource).toContain('mobileBenchPlayerNameStyle')
    expect(coachSource).toContain('mobileBenchPlayerMetaStyle')
    expect(coachSource).toContain("whiteSpace: 'nowrap'")
    expect(coachSource).toContain("textOverflow: 'ellipsis'")
    expect(coachSource).toContain('Bench top')
    expect(coachSource).toContain('mobileBenchActionStyle')
    expect(coachSource).toContain("gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'")
    expect(coachSource).toContain("gridTemplateColumns: 'repeat(4, minmax(0, 1fr))'")
    expect(coachSource).toContain("gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'")
  })

  it('collapses duplicate saved student records below the mobile bench', () => {
    expect(coachSource).toContain('function renderStudentRecordList()')
    expect(coachSource).toContain('function renderRecentSetupLinks()')
    expect(coachSource).toContain('isMobile && savedStudents.length > 0')
    expect(coachSource).toContain('<details style={mobileStudentRecordsDisclosureStyle}>')
    expect(coachSource).toContain('<summary style={mobileStudentRecordsSummaryStyle}>')
    expect(coachSource).toContain('Saved student records')
    expect(coachSource).toContain('{savedStudents.length} total')
    expect(coachSource).toContain('mobileStudentRecordsBodyStyle')
    expect(coachSource).toContain('{renderStudentRecordList()}')
    expect(coachSource).toContain('Recent setup links')
    expect(coachSource).toContain('{invites.length} saved')
    expect(coachSource).toContain('{renderRecentSetupLinks()}')
  })

  it('collapses the add-player form on mobile once the bench has players', () => {
    expect(coachSource).toContain('const hasStudentFormDraft = Boolean(')
    expect(coachSource).toContain('function renderAddStudentForm()')
    expect(coachSource).toContain('isMobile && savedStudents.length > 0')
    expect(coachSource).toContain('{...(hasStudentFormDraft ? { open: true } : {})}')
    expect(coachSource).toContain('Add or invite player')
    expect(coachSource).toContain("{hasStudentFormDraft ? 'Draft open' : 'Open'}")
    expect(coachSource).toContain('{renderAddStudentForm()}')
  })

  it('collapses optional coach helper blocks on phone', () => {
    expect(coachSource).toContain('function renderFirstAssignmentStarter()')
    expect(coachSource).toContain('function renderAssignmentOptions()')
    expect(coachSource).toContain('Assignment options')
    expect(coachSource).toContain("selectedLevelUpAssignmentCard ? 'Level Up set' : 'Optional'")
    expect(coachSource).toContain('{renderAssignmentOptions()}')
    expect(coachSource).toContain('function renderNextLessonBuilder()')
    expect(coachSource).toContain('function renderSharedLessonCalendar()')
    expect(coachSource).toContain('function renderLessonRhythmBlocks()')
    expect(coachSource).toContain('function renderOptionalPlanningHelpers()')
    expect(coachSource).toContain('First assignment starters')
    expect(coachSource).toContain('{FIRST_ASSIGNMENT_STARTERS.length} options')
    expect(coachSource).toContain('{renderFirstAssignmentStarter()}')
    expect(coachSource).toContain('Next lesson builder')
    expect(coachSource).toContain('{selectedSessionPreset.title}')
    expect(coachSource).toContain('{renderNextLessonBuilder()}')
    expect(coachSource).toContain('{...(selectedCalendarSubscribed ? { open: true } : {})}')
    expect(coachSource).toContain("{sharedLessonCalendarEvents.length ? `${sharedLessonCalendarEvents.length} events` : selectedCalendarStatusLabel}")
    expect(coachSource).toContain('{renderSharedLessonCalendar()}')
    expect(coachSource).toContain('Lesson rhythm')
    expect(coachSource).toContain('{COACH_LESSON_BLOCKS.length} blocks')
    expect(coachSource).toContain('{renderLessonRhythmBlocks()}')
    expect(coachSource.indexOf('style={isMobile ? mobileStudentRecordsDisclosureStyle : openAssignmentQueueDisclosureStyle}')).toBeLessThan(coachSource.lastIndexOf('{renderOptionalPlanningHelpers()}'))
  })

  it('keeps the assignment send panel before optional starters on phone', () => {
    expect(coachSource.indexOf('Assignment ready')).toBeGreaterThan(-1)
    expect(coachSource.indexOf('First assignment starters')).toBeGreaterThan(-1)
    expect(coachSource.indexOf('Assignment ready')).toBeLessThan(coachSource.indexOf('First assignment starters'))
  })

  it('keeps the assignment review queue compact on phone unless review is pending', () => {
    expect(coachSource).toContain('open={!isMobile || assignmentsNeedingReview.length > 0}')
    expect(coachSource).toContain('function renderReviewQueueMetrics()')
    expect(coachSource).toContain('{isMobile ? null : renderReviewQueueMetrics()}')
    expect(coachSource).toContain('{isMobile ? renderReviewQueueMetrics() : null}')
    expect(coachSource).toContain('openAssignmentQueueDisclosureStyle')
    expect(coachSource).toContain('hiddenSummaryStyle')
    expect(coachSource).toContain('openAssignmentQueueBodyStyle')
    expect(coachSource).toContain('Assignment review queue')
    expect(coachSource).toContain('`${assignmentsNeedingReview.length} review`')
    expect(coachSource).toContain('`${sortedAssignments.length} saved`')
  })

  it('keeps the TenAceIQ integration explainer out of the primary phone workspace', () => {
    expect(coachSource).toContain('function renderCoachIntegrationContent()')
    expect(coachSource).toContain('How this fits TenAceIQ')
    expect(coachSource).toContain('Coach + Player')
    expect(coachSource).toContain('{renderCoachIntegrationContent()}')
  })
})
