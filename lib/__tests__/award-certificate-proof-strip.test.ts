import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('award certificate proof strip', () => {
  it('uses a sleek certificate watermark and compact proof states', () => {
    const source = readFileSync(join(process.cwd(), 'app/awards/[id]/page.tsx'), 'utf8')

    expect(source).toContain('awardProofItems')
    expect(source).toContain('Award proof')
    expect(source).toContain('proofGridStyle')
    expect(source).toContain('proofItemStyle')
    expect(source).toContain('certificateWatermarkStyle')
    expect(source).toContain('aspectRatio')
    expect(source).toContain('Needs profile')
    expect(source).toContain('readinessDotReadyStyle')
    expect(source).toContain('readinessDotWaitingStyle')
    expect(source).not.toContain('<div style={watermarkStyle}>TIQ</div>')
  })
})
