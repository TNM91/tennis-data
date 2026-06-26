import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/coach/page.tsx'), 'utf8')

describe('Coach Hub support path', () => {
  it('answers the core coach questions with practical action paths', () => {
    expect(source).toContain('COACH_SUPPORT_PATHS')
    expect(source).toContain('Coach support path')
    expect(source).toContain('PRODUCT_MOTTO')
    expect(source).toContain('Start with the coaching question that keeps a player moving between sessions.')

    expect(source).toContain("question: 'How can I assign drills?'")
    expect(source).toContain("question: 'How can I track player development?'")
    expect(source).toContain("question: 'How can I recommend resources?'")
    expect(source).toContain("question: 'How can I support players between sessions?'")

    expect(source).toContain("href: '#coach-lesson-frame'")
    expect(source).toContain("href: '#coach-linked-dashboard'")
    expect(source).toContain("href: '/resources?q=coach%20drills%20skills'")
    expect(source).toContain("href: '#coach-student-board'")
    expect(source).toContain("title: 'Open the player bench'")
    expect(source).toContain("cta: 'Open player bench'")
  })

  it('keeps the path tappable and measurable on mobile', () => {
    expect(source).toContain('gridTemplateColumns: \'repeat(auto-fit, minmax(min(100%, 230px), 1fr))\'')
    expect(source).toContain('data-coach-path-job={path.job}')
    expect(source).toContain('aria-label={`${path.cta}: ${path.question}`}')
    expect(source).toContain('id="coach-linked-dashboard"')
    expect(source).toContain('aria-label="Coach player bench"')
  })

  it('keeps linked player cards readable without creating a long phone column', () => {
    expect(source).toContain('const { isMobile } = useViewportBreakpoints()')
    expect(source).toContain('activeMobileBenchStudentId')
    expect(source).toContain('activeMobileBenchCard')
    expect(source).toContain('mobileBenchPickerStyle')
    expect(source).toContain('mobileBenchPlayerButtonStyle(active)')
    expect(source).toContain('renderMobileBenchCommandCenter(activeMobileBenchCard)')
    expect(source).toContain('Active player workspace for')
    expect(source).toContain('Mobile coach Player ID handoff for')
    expect(source).toContain('coachBenchHandoffGridStyle')
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 118px), 1fr))'")
    expect(source).toContain("gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'")
    expect(source).toContain("gridTemplateColumns: 'minmax(0, 1fr)'")
  })

  it('turns the linked-player dashboard into a direct player bench', () => {
    expect(source).toContain('<div style={eyebrowStyle}>Player bench</div>')
    expect(source).toContain('Open a player, then move their work forward.')
    expect(source).toContain('Your bench keeps each player profile, development path, active assignment, setup link, and coach contact path in one place.')
    expect(source).toContain('function getCoachPlayerProfileHref(student: CoachStudentLink)')
    expect(source).toContain("`/players/${encodeURIComponent(student.playerId)}`")
    expect(source).toContain('Open player hub')
    expect(source).toContain('Current work')
    expect(source).toContain('Development path')
    expect(source).toContain('playerProfileRouteStyle')
    expect(source).toContain('getCoachStudentIdentityRead')
    expect(source).toContain('Player ID action read for')
    expect(source).toContain('coachBenchIdentityReadStyle')
    expect(source).toContain('coachBenchIdentityLabelStyle')
    expect(source).toContain('Coach Player ID handoff for')
    expect(source).toContain('getCoachStudentIdentityHandoff')
    expect(source).toContain("label: 'Log'")
    expect(source).toContain("label: 'Ask'")
    expect(source).toContain("label: 'Try next'")
    expect(source).toContain('buildCoachPlayerIdentityMessageHref')
    expect(source).toContain('Message Player ID plan')
    expect(source).toContain('Proof target: ${identityRead.proofTarget}')
  })
})
