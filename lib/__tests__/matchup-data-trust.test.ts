import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const matchupSource = readFileSync(join(process.cwd(), 'app/matchup/page.tsx'), 'utf8')

describe('Matchup data trust surface', () => {
  it('shows source, freshness, confidence, status, and review actions near the public matchup flow', () => {
    expect(matchupSource).toContain("import DataTrustPanel from '@/app/components/data-trust-panel'")
    expect(matchupSource).toContain("const dataAssistMatchupHref = '/data-assist?intent=request-review&context=Matchup'")
    expect(matchupSource).toContain('href={dataAssistMatchupHref}')
    expect(matchupSource).toContain('Matchup data trust')
    expect(matchupSource).toContain('Use the edge as a preparation signal, not a guaranteed outcome.')
    expect(matchupSource).toContain("label: 'Source'")
    expect(matchupSource).toContain("label: 'Freshness'")
    expect(matchupSource).toContain("label: 'Confidence'")
    expect(matchupSource).toContain("label: 'Status'")
    expect(matchupSource).toContain('Report or request review through Data Assist')
  })
})
