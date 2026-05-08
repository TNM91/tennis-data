import { DATA_ASSIST_TESSERACT_OCR_PROVIDER, type DataAssistOcrScreenshotInput } from './data-assist-ocr'

export type DataAssistTesseractImageInput = DataAssistOcrScreenshotInput & {
  imageBuffer: Buffer
  mimeType: string
}

export type DataAssistTesseractResult = {
  provider: typeof DATA_ASSIST_TESSERACT_OCR_PROVIDER
  rawText: string
  confidenceScore: number
  warnings: string[]
  screenshotSummaries: DataAssistTesseractScreenshotSummary[]
}

export type DataAssistTesseractScreenshotSummary = {
  uploadOrder: number
  fileName: string
  confidenceScore: number
  textLength: number
  nonEmptyLineCount: number
  duplicateLineCount: number
}

export async function recognizeDataAssistScreenshotsWithTesseract(
  images: DataAssistTesseractImageInput[],
): Promise<DataAssistTesseractResult> {
  if (!images.length) {
    return {
      provider: DATA_ASSIST_TESSERACT_OCR_PROVIDER,
      rawText: '',
      confidenceScore: 0,
      warnings: ['No stored screenshots were available for free OCR.'],
      screenshotSummaries: [],
    }
  }

  const { createWorker, PSM } = await import('tesseract.js')
  const worker = await createWorker('eng')
  const orderedImages = [...images].sort((a, b) => a.uploadOrder - b.uploadOrder)
  const blocks: Array<{
    uploadOrder: number
    fileName: string
    text: string
    confidenceScore: number
  }> = []
  const confidences: number[] = []
  const warnings: string[] = [
    'Free Tesseract OCR draft. Admin verification is required before import.',
  ]

  try {
    await worker.setParameters({
      preserve_interword_spaces: '1',
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    })

    for (const image of orderedImages) {
      const result = await worker.recognize(image.imageBuffer)
      const text = normalizeOcrBlock(result.data.text)
      const confidence = normalizeConfidence(result.data.confidence)
      confidences.push(confidence)

      if (!text) {
        warnings.push(`No OCR text detected in screenshot #${image.uploadOrder} (${image.fileName}).`)
        continue
      }

      blocks.push({
        uploadOrder: image.uploadOrder,
        fileName: image.fileName,
        text,
        confidenceScore: confidence,
      })
    }
  } finally {
    await worker.terminate()
  }

  const merged = mergeDataAssistOcrBlocks(blocks)
  if (!merged.rawText) warnings.push('Free OCR completed, but no readable scorecard text was extracted.')

  return {
    provider: DATA_ASSIST_TESSERACT_OCR_PROVIDER,
    rawText: merged.rawText,
    confidenceScore: roundConfidence(confidences.length
      ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
      : 0),
    warnings,
    screenshotSummaries: merged.screenshotSummaries,
  }
}

export function mergeDataAssistOcrBlocks(blocks: Array<{
  uploadOrder: number
  fileName: string
  text: string
  confidenceScore: number
}>): {
  rawText: string
  screenshotSummaries: DataAssistTesseractScreenshotSummary[]
} {
  const seen = new Set<string>()
  const textBlocks: string[] = []
  const screenshotSummaries: DataAssistTesseractScreenshotSummary[] = []

  for (const block of [...blocks].sort((a, b) => a.uploadOrder - b.uploadOrder)) {
    const lines = splitOcrLines(block.text)
    const uniqueLines: string[] = []
    let duplicateLineCount = 0

    for (const line of lines) {
      const key = normalizeLineKey(line)
      if (!key) continue
      if (seen.has(key)) {
        duplicateLineCount += 1
        continue
      }
      seen.add(key)
      uniqueLines.push(line)
    }

    screenshotSummaries.push({
      uploadOrder: block.uploadOrder,
      fileName: block.fileName,
      confidenceScore: roundConfidence(block.confidenceScore),
      textLength: block.text.trim().length,
      nonEmptyLineCount: lines.length,
      duplicateLineCount,
    })

    if (uniqueLines.length) {
      textBlocks.push([
        `Screenshot ${block.uploadOrder}: ${block.fileName}`,
        uniqueLines.join('\n'),
      ].join('\n'))
    }
  }

  return {
    rawText: textBlocks.join('\n\n'),
    screenshotSummaries,
  }
}

function normalizeOcrBlock(value: string) {
  return value.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function splitOcrLines(value: string) {
  return normalizeOcrBlock(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function normalizeLineKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeConfidence(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0
  return value > 1 ? value / 100 : value
}

function roundConfidence(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100))
}
