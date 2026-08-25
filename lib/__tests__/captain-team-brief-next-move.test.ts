import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/team-brief/page.tsx'), 'utf8')

function styleBlock(styleName: string) {
  const start = source.indexOf(`const ${styleName}:`)
  expect(start).toBeGreaterThanOrEqual(0)
  const nextStyle = source.indexOf('\nconst ', start + 1)
  return source.slice(start, nextStyle === -1 ? undefined : nextStyle)
}

describe('Captain Team Brief next move', () => {
  it('prioritizes the single next action required to make a match plan send-ready', () => {
    expect(source).toContain('const nextMove = !team || !league || !flight')
    expect(source).toContain("title: 'Choose the team week'")
    expect(source).toContain("title: 'Build the current courts'")
    expect(source).toContain("title: 'Resolve availability'")
    expect(source).toContain("title: 'Add match logistics'")
    expect(source).toContain("title: 'Share the match plan'")
    expect(source).toContain('aria-label="Next match-day action"')
  })

  it('keeps the next action card safe on small screens', () => {
    expect(styleBlock('nextMoveCardStyle')).toContain('minWidth: 0')
    expect(styleBlock('nextMoveCardStyle')).toContain("flexWrap: 'wrap'")
    expect(styleBlock('nextMoveCopyStyle')).toContain('minWidth: 0')
    expect(styleBlock('nextMoveTitleStyle')).toContain("overflowWrap: 'anywhere'")
    expect(styleBlock('nextMoveDetailStyle')).toContain("overflowWrap: 'anywhere'")
  })
})
