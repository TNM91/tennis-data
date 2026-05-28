import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/profile/page.tsx'), 'utf8')

describe('profile identity first actions', () => {
  it('keeps unlinked users on a create-and-start flow', () => {
    expect(source).toContain('Set profile')
    expect(source).toContain('Start your TIQ')
    expect(source).toContain('Save your name, then add the first verified tennis signal.')
    expect(source).toContain('{profileComplete ? (')
  })

  it('keeps the self-rated profile path and first tennis moves visible', () => {
    expect(source).toContain('Self-rated profiles show an S until verified data replaces it.')
    expect(source).toContain('Create new self-rated profile')
    expect(source).toContain('Start with your name. Existing records appear only when they look relevant.')
    expect(source).toContain('matches.some((player) => player.id === selected.id)')
    expect(source).toContain('return merged.slice(0, 8)')
    expect(source).not.toContain('Choose existing record')
    expect(source).toContain('Upload scorecard')
    expect(source).toContain('Local leagues')
    expect(source).toContain('Create TIQ league')
    expect(source).toContain('Find players')
  })

  it('keeps completed profiles on a useful next-move path', () => {
    expect(source).toContain('const profileNextMoves = [')
    expect(source).toContain("title: 'Open My Lab'")
    expect(source).toContain("title: 'Improve data'")
    expect(source).toContain("title: 'Prep matchup'")
    expect(source).toContain("title: 'Review messages'")
    expect(source).toContain('Self-rated is live. Add a scorecard or match signal when you are ready.')
    expect(source).toContain('Your player identity is ready across the portal.')
    expect(source).toContain('const nextMovePathStyle')
  })
})
