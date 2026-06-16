import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/coaches/page.tsx'), 'utf8')

describe('public coaches job clarity', () => {
  it('connects the coach page to the platform motto without adding internal language', () => {
    expect(source).toContain("import { PRODUCT_MOTTO } from '@/lib/product-story'")
    expect(source).toContain('${PRODUCT_MOTTO} for coaching means goals, drills, lesson notes, progress, and follow-through stay connected')
    expect(source).toContain('Help every player leave with a next step.')
    expect(source).not.toContain('complicated analytics dashboard')
  })

  it('frames coach loop cards around questions coaches and players can understand', () => {
    expect(source).toContain('What should this player work on next?')
    expect(source).toContain('What drill should leave the lesson?')
    expect(source).toContain('Is the player improving between sessions?')
    expect(source).toContain('What resource or note keeps support moving?')
    expect(source).toContain('<p style={coachLoopQuestionStyle}>{step.question}</p>')
  })

  it('tracks coach jobs from public CTAs', () => {
    expect(source).toContain("job: 'assign_drills'")
    expect(source).toContain("job: 'track_development'")
    expect(source).toContain("job: 'recommend_resources'")
    expect(source).toContain("job: 'support_between_sessions'")
    expect(source).toContain("job: 'review_students'")
    expect(source).toContain("location: 'coaches_preview'")
  })

  it('keeps the question treatment compact and mobile-safe', () => {
    expect(source).toContain('const coachLoopQuestionStyle')
    expect(source).toContain("fontSize: 12")
    expect(source).toContain("lineHeight: 1.35")
    expect(source).toContain("overflowWrap: 'anywhere'")
    expect(source).toContain("gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))'")
    expect(source).toContain('minWidth: 0')
  })
})
