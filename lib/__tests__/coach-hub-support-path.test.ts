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
  })

  it('keeps the path tappable and measurable on mobile', () => {
    expect(source).toContain('gridTemplateColumns: \'repeat(auto-fit, minmax(min(100%, 230px), 1fr))\'')
    expect(source).toContain('data-coach-path-job={path.job}')
    expect(source).toContain('aria-label={`${path.cta}: ${path.question}`}')
    expect(source).toContain('id="coach-linked-dashboard"')
  })

  it('keeps linked player cards readable without creating a long phone column', () => {
    expect(source).toContain('const { isMobile } = useViewportBreakpoints()')
    expect(source).toContain('responsiveLinkedCardsGridStyle')
    expect(source).toContain('mobileLinkedCardsGridStyle')
    expect(source).toContain("overflowX: 'auto'")
    expect(source).toContain("scrollSnapType: 'x mandatory'")
    expect(source).toContain("flex: '0 0 min(86vw, 340px)'")
    expect(source).toContain("gridTemplateColumns: 'minmax(0, 1fr)'")
  })
})
