import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('tournament director next move', () => {
  it('adds a state-aware next action to the director run sheet', () => {
    const source = readFileSync(join(process.cwd(), 'app/components/tournament-builder-workspace.tsx'), 'utf8')

    expect(source).toContain('buildDirectorNextMove')
    expect(source).toContain('directorNextMove')
    expect(source).toContain('Approve the waiting field')
    expect(source).toContain('Create player profiles')
    expect(source).toContain("cta: 'Create profiles'")
    expect(source).toContain('Post the court plan')
    expect(source).toContain('Create podium awards')
    expect(source).toContain('Send the recap draft')
    expect(source).toContain('nextMoveStyle')
    expect(source).toContain('nextMoveCtaStyle')
  })
})
