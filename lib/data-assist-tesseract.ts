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
    }
  }

  const { createWorker, PSM } = await import('tesseract.js')
  const worker = await createWorker('eng')
  const orderedImages = [...images].sort((a, b) => a.uploadOrder - b.uploadOrder)
  const textBlocks: string[] = []
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

      textBlocks.push([
        `Screenshot ${image.uploadOrder}: ${image.fileName}`,
        text,
      ].join('\n'))
    }
  } finally {
    await worker.terminate()
  }

  const rawText = textBlocks.join('\n\n')
  if (!rawText) warnings.push('Free OCR completed, but no readable scorecard text was extracted.')

  return {
    provider: DATA_ASSIST_TESSERACT_OCR_PROVIDER,
    rawText,
    confidenceScore: roundConfidence(confidences.length
      ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
      : 0),
    warnings,
  }
}

function normalizeOcrBlock(value: string) {
  return value.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function normalizeConfidence(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0
  return value > 1 ? value / 100 : value
}

function roundConfidence(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100))
}
