import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import CaptainLineupReviewShare from '@/app/components/captain-lineup-review-share'
import { buildCaptainLineupReviewText, shareCaptainLineupReview } from '@/lib/captain-lineup-review'

const lineup = { team: 'The Other Guys', opponent: 'Hodge-Kamman', date: '2026-10-18', courts: [{ label: 'Doubles 1', players: ['Alex', 'Jordan'] }, { label: 'Singles 1', players: ['Sam'] }] }

describe('Co-captain lineup review', () => {
  it('includes the exact match, every court and a draft confirmation caveat', () => {
    const text = buildCaptainLineupReviewText(lineup)
    for (const value of ['The Other Guys vs Hodge-Kamman', '2026-10-18', 'Doubles 1: Alex / Jordan', 'Singles 1: Sam', 'subject to confirmation']) expect(text).toContain(value)
    expect(buildCaptainLineupReviewText({ ...lineup, courts: [{ label: 'Singles 1', players: [''] }] })).toContain('Open spot')
  })
  it('offers review for a saved lineup', () => {
    const html = renderToStaticMarkup(createElement(CaptainLineupReviewShare, { lineup }))
    expect(html).toContain('Share with co-captain')
    expect(html).toContain('review the draft courts and pairings')
    expect(renderToStaticMarkup(createElement(CaptainLineupReviewShare, { lineup: { ...lineup, courts: [] } }))).toContain('disabled')
  })
  it('hands the draft to native share without copying or publishing to Team Chat', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const writeText = vi.fn()
    expect(await shareCaptainLineupReview('draft courts', { share, clipboard: { writeText } as unknown as Clipboard })).toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: 'Lineup for co-captain review', text: 'draft courts' })
    expect(writeText).not.toHaveBeenCalled()
  })
  it('copies when native share is unavailable and reports copy failures', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const browser = { share: undefined, clipboard: { writeText } } as unknown as Pick<Navigator, 'share' | 'clipboard'>
    expect(await shareCaptainLineupReview('draft courts', browser)).toBe('copied')
    expect(writeText).toHaveBeenCalledWith('draft courts')
    writeText.mockRejectedValueOnce(new Error('Denied'))
    await expect(shareCaptainLineupReview('draft courts', browser)).rejects.toThrow('Denied')
  })
  it('does not copy or claim success after cancellation', async () => {
    const writeText = vi.fn()
    const browser = { share: vi.fn().mockRejectedValue(new DOMException('Canceled', 'AbortError')), clipboard: { writeText } as unknown as Clipboard }
    await expect(shareCaptainLineupReview('draft courts', browser)).rejects.toMatchObject({ name: 'AbortError' })
    expect(writeText).not.toHaveBeenCalled()
  })
})
