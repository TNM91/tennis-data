import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/coaches/page.tsx'), 'utf8')
const globalsSource = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')

function styleBlock(name: string) {
  const marker = `const ${name}: CSSProperties = {`
  const start = source.indexOf(marker)
  expect(start, `${name} style should exist`).toBeGreaterThanOrEqual(0)

  const end = source.indexOf('\n}', start)
  expect(end, `${name} style should close`).toBeGreaterThan(start)

  return source.slice(start, end)
}

describe('public coaches job clarity', () => {
  it('connects the coach page to direct player-development language without adding internal language', () => {
    expect(source).toContain("import TrackedProductLink from '@/app/components/tracked-product-link'")
    expect(source).toContain('Keep goals, drills, lesson notes, progress, and follow-through connected')
    expect(source).toContain('Help every player leave with a next step.')
    expect(source).not.toContain("import { PRODUCT_MOTTO } from '@/lib/product-story'")
    expect(source).not.toContain('complicated analytics dashboard')
  })

  it('gives coaches and players a fast public quick path', () => {
    expect(source).toContain('Coach quick path')
    expect(source).toContain('What does the player need next?')
    expect(source).toContain('Start with the player in front of you, then open the smallest action that keeps development moving.')
    expect(source).toContain('className="coachQuickPath"')
    expect(source).toContain('className="coachQuickPathGrid"')
    expect(source).toContain('className="coachQuickPathCard"')
    expect(source).toContain('className="coachQuickPathQuestion"')
    expect(source).toContain('className="coachQuickPathCta"')
    expect(source).not.toContain('What coaching job needs attention?')
    expect(source).not.toContain('What coaching need needs attention?')
    expect(source).toContain('coachQuickPaths.map((path)')
    expect(source).toContain('How can I assign drills?')
    expect(source).toContain('How can I track player development?')
    expect(source).toContain('How can I recommend resources?')
    expect(source).toContain('How can I support players between sessions?')
    expect(source).toContain('How can I find coaching support?')
    expect(source).toContain("href: '/coach'")
    expect(source).toContain("href: '/resources?q=coach%20tools'")
    expect(source).toContain("href: '/resources?q=find%20a%20coach'")
    expect(source).toContain('showSearchResults={false}')
    expect(source).toContain('showBoard={false}')
  })

  it('frames coach loop cards around questions coaches and players can understand', () => {
    expect(source).toContain('What should this player work on next?')
    expect(source).toContain('What drill should leave the lesson?')
    expect(source).toContain('Is the player improving between sessions?')
    expect(source).toContain('What resource or note keeps support moving?')
    expect(source).toContain('<p style={coachLoopQuestionStyle}>{step.question}</p>')
  })

  it('keeps public coach actions on toolkit language instead of workspace language', () => {
    expect(source).toContain("{ label: 'Status', value: 'Coach action', tone: 'good' }")
    expect(source).toContain('Coach Hub keeps the post-lesson handoff simple')
    expect(source).toContain('Coach Hub makes the next coaching move obvious')
    expect(source).toContain('Use coach profiles to compare location, player fit, availability, provided credentials, and clear verification labels.')
    expect(source).not.toContain('Workspace action')
    expect(source).not.toContain('post-lesson job')
    expect(source).not.toContain('Coach Hub should make')
    expect(source).not.toContain('Coach profiles should')
    expect(source).not.toContain('Future coach profiles')
  })

  it('tracks coach jobs from public CTAs', () => {
    expect(source).toContain("location: 'coaches_quick_path'")
    expect(source).toContain("job: 'assign_drills'")
    expect(source).toContain("job: 'track_development'")
    expect(source).toContain("job: 'recommend_resources'")
    expect(source).toContain("job: 'support_between_sessions'")
    expect(source).toContain("job: 'find_coaching_support'")
    expect(source).toContain("job: 'review_students'")
    expect(source).toContain("location: 'coaches_preview'")
  })

  it('keeps the question treatment compact and mobile-safe', () => {
    expect(source).toContain('const coachQuickPathStyle')
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 330px), 1fr))'")
    expect(source).toContain('const coachQuickPathGridStyle')
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 128px), 1fr))'")
    expect(source).toContain('const coachQuickPathCardStyle')
    expect(source).toContain('minHeight: 84')
    expect(source).toContain('className="coachQuickPathText"')
    expect(source).toContain('ariaLabel={`${path.cta}: ${path.question}`}')
    expect(source).toContain('const coachLoopQuestionStyle')
    expect(source).toContain("fontSize: 12")
    expect(source).toContain("lineHeight: 1.35")
    expect(source).toContain("overflowWrap: 'anywhere'")
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))'")
    expect(source).toContain('minWidth: 0')
  })

  it('keeps optional coach guidance collapsed by default', () => {
    const detailsStyle = styleBlock('detailsSectionStyle')
    const summaryStyle = styleBlock('detailsSummaryStyle')
    const titleStyle = styleBlock('detailsSummaryTitleStyle')
    const cueStyle = styleBlock('detailsSummaryCueStyle')

    expect(detailsStyle).toContain("display: 'block'")
    expect(detailsStyle).not.toContain("display: 'grid'")
    expect(summaryStyle).toContain("flexWrap: 'wrap'")
    expect(titleStyle).toContain('flex: \'1 1 100%\'')
    expect(cueStyle).toContain("marginLeft: 'auto'")
    expect(source).toContain('className="coachDetailsSection"')
    expect(source).toContain('className="coachDetailsSummary"')
    expect(source).toContain('className="coachDetailsSummaryTitle"')
    expect(source).toContain('className="coachDetailsBody"')
    expect(globalsSource).toContain('.coachDetailsSection:not([open]) > .coachDetailsBody')
    expect(globalsSource).toContain('@media (max-width: 1024px)')
    expect(globalsSource).toContain('.coachQuickPathText')
    expect(globalsSource).toContain('.coachDetailsSummary')
    expect(globalsSource).toContain('.coachDetailsSummaryTitle')
    expect(globalsSource).toContain('@media (max-width: 767px)')
    expect(globalsSource).toContain('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;')
    expect(globalsSource).toContain('display: none !important;')
  })
})
