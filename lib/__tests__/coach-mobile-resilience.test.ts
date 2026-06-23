import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const coachSource = readFileSync(join(process.cwd(), 'app/coach/page.tsx'), 'utf8')
const shellSource = readFileSync(join(process.cwd(), 'app/components/site-shell.tsx'), 'utf8')

describe('coach mobile resilience', () => {
  it('keeps the phone coach page from stacking duplicate portal-like headers', () => {
    expect(coachSource).toContain('const { isMobile } = useViewportBreakpoints()')
    expect(coachSource).toContain('isMobile ? (')
    expect(coachSource).toContain('<h1 style={visuallyHiddenStyle}>Coach Hub</h1>')
    expect(coachSource).toContain('<section style={heroStyle}>')
    expect(coachSource).toContain('<section style={coachSupportPathStyle}')
    expect(coachSource).toContain('<section style={commandGridStyle}')
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
    expect(coachSource).toContain('mobileBenchFeaturedCardStyle')
    expect(coachSource).toContain('Open player hub')
    expect(coachSource).toContain('Current work')
    expect(coachSource).toContain('getCoachPlayerProfileHref')
  })
})
