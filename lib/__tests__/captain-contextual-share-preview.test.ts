import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildCaptainShareHref,
  buildCaptainShareMetadata,
  getCaptainShareConfig,
  getCaptainFinalScore,
  safeCaptainShareTarget,
} from '../captain-share-preview'

describe('captain contextual share previews', () => {
  it('puts the actual final score in both preview image URLs, including short shares', () => {
    for (const sharePath of [undefined, '/s/saved-result-token']) {
      for (const score of ['4–1', '4–2', '0–5']) {
        const metadata = buildCaptainShareMetadata({ kind: 'final-result', teamName: 'Aces', opponent: 'Levin', detail: `Aces ${score} Levin`, sharePath })
        const image = metadata.openGraph?.images as Array<{ url: string }>
        const url = new URL(image[0].url, 'https://www.tenaceiq.com')
        expect(url.pathname).toBe('/share/captain/final-result/score-image')
        expect(url.searchParams.get('score')).toBe(score)
        expect(metadata.twitter?.images).toEqual([image[0].url])
      }
    }
  })

  it('does not invent a result or confuse team names and dates with a score', () => {
    expect(getCaptainFinalScore('18-40 Aces 4-2 Levin', '18-40 Aces')).toBe('4–2')
    expect(getCaptainFinalScore('Aces won 4–1 Levin', 'Aces')).toBe('4–1')
    expect(getCaptainFinalScore('2026-10-11')).toBeNull()
    expect(getCaptainFinalScore('Result pending')).toBeNull()
    const image = buildCaptainShareMetadata({ kind: 'final-result' }).openGraph?.images as Array<{ url: string }>
    expect(new URL(image[0].url, 'https://www.tenaceiq.com').searchParams.has('score')).toBe(false)
  })
  it('builds distinct, safe share destinations for lineup and final result texts', () => {
    const target = '/team-room?team=Aces&date=2026-09-20'
    const lineup = buildCaptainShareHref({ kind: 'lineup', targetHref: target, teamName: 'Aces' })
    const result = buildCaptainShareHref({ kind: 'final-result', targetHref: target, teamName: 'Aces', detail: 'Aces 3–2 Rivals' })

    expect(lineup).toContain('/share/captain/lineup?')
    expect(result).toContain('/share/captain/final-result?')
    expect(new URL(result, 'https://www.tenaceiq.com').searchParams.get('preview')).toBe('score-v2')
    expect(lineup).not.toBe(result)
    expect(safeCaptainShareTarget('https://example.com')).toBe('/team-room')
    expect(safeCaptainShareTarget('//example.com')).toBe('/team-room')
  })

  it('uses communication-specific copy, colors, and Open Graph images', () => {
    expect(getCaptainShareConfig('lineup').title).toBe('Your lineup is ready')
    expect(getCaptainShareConfig('final-result').title).toBe('The final result is in')
    expect(getCaptainShareConfig('team-room').title).toBe('Your team conversation')
    expect(getCaptainShareConfig('team-invite').title).toBe('Join your team on TenAceIQ')
    expect(getCaptainShareConfig('lineup').accent).not.toBe(getCaptainShareConfig('final-result').accent)
    expect(buildCaptainShareMetadata({ kind: 'practice' }).openGraph?.images).toEqual([
      expect.objectContaining({ url: '/share/captain/practice/opengraph-image' }),
    ])
  })

  it('routes lineup and result messages through their matching preview cards', () => {
    const sheet = readFileSync(join(process.cwd(), 'app/captain/matchup-sheet/page.tsx'), 'utf8')
    const scorecard = readFileSync(join(process.cwd(), 'app/captain/record-result/page.tsx'), 'utf8')
    const image = readFileSync(join(process.cwd(), 'app/share/captain/[kind]/opengraph-image.tsx'), 'utf8')

    expect(sheet).toContain('createCaptainShortShareUrl({')
    expect(sheet).toContain("kind: 'lineup'")
    expect(sheet).toContain("const lineupLabel = confirmedLineup ? 'Confirmed lineup' : 'Projected lineup'")
    expect(sheet).toContain('Open ${lineupLabel.toLowerCase()}: ${lineupShareUrl}')
    expect(sheet).not.toContain("new URL(buildCaptainShareHref({")
    expect(scorecard).toContain("kind: 'final-result'")
    expect(scorecard).toContain('Open final scorecard: ${finalResultUrl}')
    expect(image).toContain('<PreviewGraphic kind={kind}')
  })

  it('keeps short share URLs clean while preserving the lineup-specific card', () => {
    const shortPage = readFileSync(join(process.cwd(), 'app/s/[token]/page.tsx'), 'utf8')
    const shortRoute = readFileSync(join(process.cwd(), 'app/api/captain/share-links/route.ts'), 'utf8')

    expect(shortRoute).toContain('shareUrl: `${new URL(request.url).origin}/s/${token}`')
    expect(shortPage).toContain('sharePath: `/s/${share.token}`')
    expect(buildCaptainShareMetadata({ kind: 'lineup', sharePath: '/s/abc123456789' }).openGraph?.images)
      .toEqual([expect.objectContaining({ url: '/share/captain/lineup/opengraph-image' })])
  })
})
