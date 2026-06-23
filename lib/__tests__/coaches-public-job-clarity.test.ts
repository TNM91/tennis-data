import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/coaches/page.tsx'), 'utf8')

describe('public coaches job clarity', () => {
  it('connects the coach page to the platform motto without adding internal language', () => {
    expect(source).toContain("import { PRODUCT_MOTTO } from '@/lib/product-story'")
    expect(source).toContain("import TrackedProductLink from '@/app/components/tracked-product-link'")
    expect(source).toContain('${PRODUCT_MOTTO} for coaching means goals, drills, lesson notes, progress, and follow-through stay connected')
    expect(source).toContain('Help every player leave with a next step.')
    expect(source).not.toContain('complicated analytics dashboard')
  })

  it('gives coaches and players a fast public quick path', () => {
    expect(source).toContain('Coach quick path')
    expect(source).toContain('What does the player need next?')
    expect(source).toContain('Start with the player in front of you, then open the smallest action that keeps development moving.')
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
    expect(source).not.toContain('Workspace action')
    expect(source).not.toContain('post-lesson job')
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
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 175px), 1fr))'")
    expect(source).toContain('const coachQuickPathCardStyle')
    expect(source).toContain('minHeight: 104')
    expect(source).toContain('ariaLabel={`${path.cta}: ${path.question}`}')
    expect(source).toContain('const coachLoopQuestionStyle')
    expect(source).toContain("fontSize: 12")
    expect(source).toContain("lineHeight: 1.35")
    expect(source).toContain("overflowWrap: 'anywhere'")
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))'")
    expect(source).toContain('minWidth: 0')
  })
})
