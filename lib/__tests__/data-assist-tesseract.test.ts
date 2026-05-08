import { describe, expect, it } from 'vitest'
import { mergeDataAssistOcrBlocks } from '../data-assist-tesseract'

describe('Data Assist Tesseract OCR merge helpers', () => {
  it('preserves screenshot order while removing duplicate overlap lines', () => {
    const merged = mergeDataAssistOcrBlocks([
      {
        uploadOrder: 2,
        fileName: 'scorecard-bottom.png',
        confidenceScore: 0.72,
        text: `
          2D Mary Lane / Sara Cross def. Kim North / Ana West 7-6(4) 6-2
          1S Jane Ace def. Molly Baseline 6-1 6-0
        `,
      },
      {
        uploadOrder: 1,
        fileName: 'scorecard-top.png',
        confidenceScore: 0.78,
        text: `
          Match ID: USTA-123456789
          Home Team: Dallas Indoor Aces
          2D Mary Lane / Sara Cross def. Kim North / Ana West 7-6(4) 6-2
        `,
      },
    ])

    expect(merged.rawText).toContain('Screenshot 1: scorecard-top.png')
    expect(merged.rawText.indexOf('Screenshot 1')).toBeLessThan(merged.rawText.indexOf('Screenshot 2'))
    expect(merged.rawText.match(/2D Mary Lane/g)).toHaveLength(1)
    expect(merged.screenshotSummaries).toEqual([
      {
        uploadOrder: 1,
        fileName: 'scorecard-top.png',
        confidenceScore: 0.78,
        textLength: expect.any(Number),
        nonEmptyLineCount: 3,
        duplicateLineCount: 0,
      },
      {
        uploadOrder: 2,
        fileName: 'scorecard-bottom.png',
        confidenceScore: 0.72,
        textLength: expect.any(Number),
        nonEmptyLineCount: 2,
        duplicateLineCount: 1,
      },
    ])
  })

  it('normalizes punctuation and spacing when detecting duplicate lines', () => {
    const merged = mergeDataAssistOcrBlocks([
      {
        uploadOrder: 1,
        fileName: 'one.png',
        confidenceScore: 0.9,
        text: 'Match Date: 05/01/2026',
      },
      {
        uploadOrder: 2,
        fileName: 'two.png',
        confidenceScore: 0.8,
        text: 'Match Date - 05 01 2026',
      },
    ])

    expect(merged.rawText.match(/Match Date/g)).toHaveLength(1)
    expect(merged.screenshotSummaries[1].duplicateLineCount).toBe(1)
  })
})
