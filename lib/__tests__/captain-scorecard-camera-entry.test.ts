import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/record-result/page.tsx'), 'utf8')

describe('Captain scorecard camera entry', () => {
  it('keeps a direct, team-aware phone capture route on the verified result form', () => {
    expect(source).toContain("const scorecardCameraHref = useMemo(() => {")
    expect(source).toContain("context: 'captain-scorecard'")
    expect(source).toContain("capture: 'camera'")
    expect(source).toContain("returnTo: `/captain/record-result?${resultParams.toString()}`")
    expect(source).toContain('Scan scorecard')
    expect(source).toContain('Scan it and review the prefilled courts.')
  })
})
