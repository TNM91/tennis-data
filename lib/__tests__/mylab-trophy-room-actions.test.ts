import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('My Lab trophy room actions', () => {
  it('links earned award records to their certificates', () => {
    const source = readFileSync(join(process.cwd(), 'app/mylab/page.tsx'), 'utf8')

    expect(source).toContain('earnedAwardCards')
    expect(source).toContain('/awards/')
    expect(source).toContain("cta: 'Certificate'")
    expect(source).toContain('trophyCardActionStyle')
    expect(source).toContain('record.href')
  })
})
