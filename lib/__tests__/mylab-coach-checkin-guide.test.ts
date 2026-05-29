import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const myLabSource = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')

describe('My Lab coach check-in guide', () => {
  it('keeps Player+ assignment recaps tied to the coach evidence target', () => {
    expect(myLabSource).toContain('Player+ recap guide')
    expect(myLabSource).toContain('buildPlayerAssignmentCheckInDraft')
    expect(myLabSource).toContain('Use guided draft')
    expect(myLabSource).toContain('summary?.expectedEvidence')
    expect(myLabSource).toContain('Question for coach')
  })
})
