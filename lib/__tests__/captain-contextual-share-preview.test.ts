import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildCaptainShareHref,
  buildCaptainShareMetadata,
  getCaptainShareConfig,
  safeCaptainShareTarget,
} from '../captain-share-preview'

describe('captain contextual share previews', () => {
  it('builds distinct, safe share destinations for lineup and final result texts', () => {
    const target = '/team-room?team=Aces&date=2026-09-20'
    const lineup = buildCaptainShareHref({ kind: 'lineup', targetHref: target, teamName: 'Aces' })
    const result = buildCaptainShareHref({ kind: 'final-result', targetHref: target, teamName: 'Aces', detail: 'Aces 3–2 Rivals' })

    expect(lineup).toContain('/share/captain/lineup?')
    expect(result).toContain('/share/captain/final-result?')
    expect(lineup).not.toBe(result)
    expect(safeCaptainShareTarget('https://example.com')).toBe('/team-room')
    expect(safeCaptainShareTarget('//example.com')).toBe('/team-room')
  })

  it('uses communication-specific copy, colors, and Open Graph images', () => {
    expect(getCaptainShareConfig('lineup').title).toBe('Your lineup is ready')
    expect(getCaptainShareConfig('final-result').title).toBe('The final result is in')
    expect(getCaptainShareConfig('lineup').accent).not.toBe(getCaptainShareConfig('final-result').accent)
    expect(buildCaptainShareMetadata({ kind: 'practice' }).openGraph?.images).toEqual([
      expect.objectContaining({ url: '/share/captain/practice/opengraph-image' }),
    ])
  })

  it('routes lineup and result messages through their matching preview cards', () => {
    const sheet = readFileSync(join(process.cwd(), 'app/captain/matchup-sheet/page.tsx'), 'utf8')
    const scorecard = readFileSync(join(process.cwd(), 'app/captain/record-result/page.tsx'), 'utf8')
    const image = readFileSync(join(process.cwd(), 'app/share/captain/[kind]/opengraph-image.tsx'), 'utf8')

    expect(sheet).toContain("kind: 'lineup'")
    expect(sheet).toContain('Open lineup: ${lineupShareUrl}')
    expect(scorecard).toContain("kind: 'final-result'")
    expect(scorecard).toContain('Open final scorecard: ${finalResultUrl}')
    expect(image).toContain('<PreviewGraphic kind={kind}')
  })
})
