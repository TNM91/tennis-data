import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const coachLayoutSource = readFileSync(join(process.cwd(), 'app/coach/layout.tsx'), 'utf8')
const errorSource = readFileSync(join(process.cwd(), 'app/error.tsx'), 'utf8')

describe('tool language stragglers', () => {
  it('keeps Coach Hub metadata on tool language', () => {
    expect(coachLayoutSource).toContain(
      'Coach Hub is the TenAceIQ tool for lesson planning, assignments, Tactical Studio, and coach-player follow-through.',
    )
    expect(coachLayoutSource).not.toContain('TenAceIQ workspace for lesson planning')
  })

  it('keeps the global error fallback from sending users to a generic workspace', () => {
    expect(errorSource).toContain('reopen the right tennis tool from there')
    expect(errorSource).not.toContain('reopen the tennis workspace from there')
  })
})
