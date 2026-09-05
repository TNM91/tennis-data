import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CAPTAIN_PILOT_FLYER } from '../captain-pilot-flyer'
import { CAPTAIN_PILOT_PRICE_LABEL, CAPTAIN_PILOT_TRIAL_MONTHS } from '../captain-pilot'

describe('Captain pilot flyer', () => {
  it('keeps the exported PDF offer synchronized with the live pricing source', () => {
    const exported = JSON.parse(readFileSync(join(process.cwd(), 'public/media/captain-pilot/fall-2026-flyer.json'), 'utf8'))
    expect(exported).toEqual(CAPTAIN_PILOT_FLYER)
    expect(exported.offer).toBe(`${CAPTAIN_PILOT_TRIAL_MONTHS} months of Captain free`)
    expect(exported.duration).toContain('from activation')
    expect(exported.renewal).toContain(CAPTAIN_PILOT_PRICE_LABEL)
    const pdf = readFileSync(join(process.cwd(), 'public', CAPTAIN_PILOT_FLYER.pdfPath))
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.toString('latin1')).toContain('/Count 1')
    expect(pdf.toString('latin1')).toContain('/MediaBox [ 0 0 612 792 ]')
  })

  it('keeps the mobile flyer rules out of print and offers a direct PDF action', () => {
    const css = readFileSync(join(process.cwd(), 'app/captain-pilot/flyer/flyer.module.css'), 'utf8')
    const page = readFileSync(join(process.cwd(), 'app/captain-pilot/flyer/page.tsx'), 'utf8')
    expect(css).not.toMatch(/@media\s*\(max-width/)
    expect(css).toContain('@media screen and (max-width: 680px)')
    expect(page).toContain('href={CAPTAIN_PILOT_FLYER.pdfPath}')
    expect(page).toContain('Print / save PDF')
    expect(page).toContain('CAPTAIN_PILOT_FLYER.terms')
  })
})
