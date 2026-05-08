import fs from 'node:fs'
import path from 'node:path'
import { DATA_ASSIST_TESSERACT_OCR_PROVIDER, type DataAssistOcrScreenshotInput } from './data-assist-ocr'

type TesseractPageSegMode = import('tesseract.js').PSM

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
      warnings: ['No stored screenshots were available for scorecard reading.'],
      screenshotSummaries: [],
    }
  }

  const { createWorker, PSM } = await import('tesseract.js')
  const cachePath = path.join(process.cwd(), '.next', 'cache', 'tesseract')
  fs.mkdirSync(cachePath, { recursive: true })
  const worker = await createWorker('eng', undefined, {
    cachePath,
    workerPath: path.join(process.cwd(), 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js'),
  })
  const orderedImages = [...images].sort((a, b) => a.uploadOrder - b.uploadOrder)
  const blocks: Array<{
    uploadOrder: number
    fileName: string
    text: string
    confidenceScore: number
  }> = []
  const confidences: number[] = []
  const warnings: string[] = [
    'Automated scorecard read. Admin verification is required before import.',
  ]

  try {
    await worker.setParameters({
      preserve_interword_spaces: '1',
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    })

    for (const image of orderedImages) {
      const result = await recognizeTennisLinkScreenshot(worker, image, PSM.SINGLE_BLOCK, PSM.SPARSE_TEXT)
      const text = normalizeOcrBlock(result.text)
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
  if (!merged.rawText) warnings.push('Scorecard read completed, but no readable scorecard text was extracted.')

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

export async function recognizeDataAssistScheduleScreenshotsWithTesseract(
  images: DataAssistTesseractImageInput[],
): Promise<DataAssistTesseractResult> {
  if (!images.length) {
    return {
      provider: DATA_ASSIST_TESSERACT_OCR_PROVIDER,
      rawText: '',
      confidenceScore: 0,
      warnings: ['No stored screenshots were available for schedule reading.'],
      screenshotSummaries: [],
    }
  }

  const { createWorker, PSM } = await import('tesseract.js')
  const cachePath = path.join(process.cwd(), '.next', 'cache', 'tesseract')
  fs.mkdirSync(cachePath, { recursive: true })
  const worker = await createWorker('eng', undefined, {
    cachePath,
    workerPath: path.join(process.cwd(), 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js'),
  })
  const orderedImages = [...images].sort((a, b) => a.uploadOrder - b.uploadOrder)
  const blocks: Array<{
    uploadOrder: number
    fileName: string
    text: string
    confidenceScore: number
  }> = []
  const confidences: number[] = []
  const warnings: string[] = ['Automated team schedule read. Review rows before importing.']

  try {
    await worker.setParameters({
      preserve_interword_spaces: '1',
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    })

    for (const image of orderedImages) {
      const result = await recognizeTennisLinkScheduleScreenshot(worker, image, PSM.SPARSE_TEXT)
      const text = normalizeOcrBlock(result.text)
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
  if (!merged.rawText) warnings.push('Schedule read completed, but no readable schedule text was extracted.')

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

export async function recognizeDataAssistTeamSummaryScreenshotsWithTesseract(
  images: DataAssistTesseractImageInput[],
): Promise<DataAssistTesseractResult> {
  if (!images.length) {
    return {
      provider: DATA_ASSIST_TESSERACT_OCR_PROVIDER,
      rawText: '',
      confidenceScore: 0,
      warnings: ['No stored screenshots were available for team summary reading.'],
      screenshotSummaries: [],
    }
  }

  const { createWorker, PSM } = await import('tesseract.js')
  const cachePath = path.join(process.cwd(), '.next', 'cache', 'tesseract')
  fs.mkdirSync(cachePath, { recursive: true })
  const worker = await createWorker('eng', undefined, {
    cachePath,
    workerPath: path.join(process.cwd(), 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js'),
  })
  const blocks: Array<{
    uploadOrder: number
    fileName: string
    text: string
    confidenceScore: number
  }> = []
  const confidences: number[] = []
  const warnings: string[] = ['Automated team summary read. Review roster names and ratings before importing.']

  try {
    await worker.setParameters({
      preserve_interword_spaces: '1',
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    })

    for (const image of [...images].sort((a, b) => a.uploadOrder - b.uploadOrder)) {
      const result = await worker.recognize(image.imageBuffer)
      const fullText = normalizeOcrBlock(result.data.text)
      const structuredRosterText = await recognizeDesktopTeamSummaryRoster(worker, image, PSM.SINGLE_BLOCK)
      const text = [structuredRosterText, fullText].filter(Boolean).join('\n\n')
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
  if (!merged.rawText) warnings.push('Team summary read completed, but no readable roster text was extracted.')

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

async function recognizeTennisLinkScheduleScreenshot(
  worker: Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>,
  image: DataAssistTesseractImageInput,
  pageSegMode: TesseractPageSegMode,
) {
  const fullPage = await worker.recognize(image.imageBuffer)
  const fullText = normalizeOcrBlock(fullPage.data.text)
  const structuredScheduleText = await recognizeDesktopTeamScheduleTable(worker, image, pageSegMode)

  return {
    data: fullPage.data,
    text: [structuredScheduleText, fullText].filter(Boolean).join('\n\n'),
  }
}

async function recognizeTennisLinkScreenshot(
  worker: Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>,
  image: DataAssistTesseractImageInput,
  structuredTablePageSegMode: TesseractPageSegMode,
  scorePageSegMode: TesseractPageSegMode,
) {
  const fullPage = await worker.recognize(image.imageBuffer)
  const fullText = normalizeOcrBlock(fullPage.data.text)
  const shouldReadScorecardArea = image.imageWidth >= 900 && image.imageHeight >= image.imageWidth * 1.2

  if (!shouldReadScorecardArea) {
    return {
      data: fullPage.data,
      text: fullText,
    }
  }

  const scorecardArea = await worker.recognize(image.imageBuffer, {
    rectangle: {
      left: Math.round(image.imageWidth * 0.12),
      top: Math.round(image.imageHeight * 0.07),
      width: Math.round(image.imageWidth * 0.63),
      height: Math.round(image.imageHeight * 0.55),
    },
  })
  const scorecardText = normalizeOcrBlock(scorecardArea.data.text)
  const structuredTableText = await recognizeDesktopScorecardTable(
    worker,
    image,
    structuredTablePageSegMode,
    scorePageSegMode,
  )

  return {
    data: {
      ...fullPage.data,
      confidence: Math.max(fullPage.data.confidence, scorecardArea.data.confidence),
    },
    text: [structuredTableText, scorecardText, fullText].filter(Boolean).join('\n\n'),
  }
}

async function recognizeDesktopTeamScheduleTable(
  worker: Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>,
  image: DataAssistTesseractImageInput,
  pageSegMode: TesseractPageSegMode,
) {
  if (image.imageWidth < 1000 || image.imageHeight < 1400) return ''

  await worker.setParameters({
    tessedit_pageseg_mode: pageSegMode,
  })

  const rows = [0.243, 0.257, 0.277, 0.31, 0.343, 0.376, 0.41, 0.443, 0.476, 0.509, 0.542, 0.575, 0.608, 0.641, 0.674]
    .map((ratio) => Math.round(image.imageHeight * ratio))
  const columns = {
    id: { left: 0.135, width: 0.065 },
    date: { left: 0.205, width: 0.075 },
    time: { left: 0.275, width: 0.08 },
    home: { left: 0.33, width: 0.13 },
    away: { left: 0.49, width: 0.18 },
    facility: { left: 0.64, width: 0.15 },
    row: { left: 0.13, width: 0.67 },
  }
  const rowHeight = Math.round(image.imageHeight * 0.034)
  const structuredRows: string[] = []
  const seenIds = new Set<string>()

  for (const top of rows) {
    const [id, date, time, home, away, facility, rowText] = await Promise.all([
      recognizeCell(worker, image, columns.id.left, top, columns.id.width, rowHeight),
      recognizeCell(worker, image, columns.date.left, top, columns.date.width, rowHeight),
      recognizeCell(worker, image, columns.time.left, top, columns.time.width, rowHeight),
      recognizeCell(worker, image, columns.home.left, top, columns.home.width, rowHeight),
      recognizeCell(worker, image, columns.away.left, top, columns.away.width, rowHeight),
      recognizeCell(worker, image, columns.facility.left, top, columns.facility.width, rowHeight),
      recognizeCell(worker, image, columns.row.left, top, columns.row.width, rowHeight),
    ])
    const matchId = normalizeStructuredScheduleMatchId(id)
    if (!matchId || seenIds.has(matchId)) continue
    seenIds.add(matchId)
    structuredRows.push([
      'Schedule row',
      matchId,
      normalizeOcrBlock(date),
      normalizeOcrBlock(time),
      normalizeOcrBlock(home),
      normalizeOcrBlock(away),
      normalizeOcrBlock(facility),
      normalizeOcrBlock(rowText),
    ].join(' | '))
  }

  return structuredRows.length
    ? ['TennisLink structured schedule read', ...structuredRows].join('\n')
    : ''
}

async function recognizeDesktopTeamSummaryRoster(
  worker: Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>,
  image: DataAssistTesseractImageInput,
  pageSegMode: TesseractPageSegMode,
) {
  if (image.imageWidth < 1000 || image.imageHeight < 1400) return ''

  await worker.setParameters({
    tessedit_pageseg_mode: pageSegMode,
  })

  const rows = [0.554, 0.566, 0.578, 0.59, 0.602, 0.614, 0.626]
    .map((ratio) => Math.round(image.imageHeight * ratio))
  const columns = [
    { nameLeft: 0.135, nameWidth: 0.14, ratingLeft: 0.255, ratingWidth: 0.05 },
    { nameLeft: 0.345, nameWidth: 0.145, ratingLeft: 0.485, ratingWidth: 0.05 },
    { nameLeft: 0.565, nameWidth: 0.14, ratingLeft: 0.675, ratingWidth: 0.05 },
  ]
  const rowHeight = Math.round(image.imageHeight * 0.014)
  const structuredRows: string[] = []
  const seen = new Set<string>()

  for (const top of rows) {
    for (const column of columns) {
      const [name, rating] = await Promise.all([
        recognizeCell(worker, image, column.nameLeft, top, column.nameWidth, rowHeight),
        recognizeCell(worker, image, column.ratingLeft, top, column.ratingWidth, rowHeight),
      ])
      const normalizedName = normalizeStructuredRosterName(name)
      const normalizedRating = normalizeStructuredRosterRating(rating)
      const key = normalizeLineKey(normalizedName)
      if (!key || seen.has(key) || !normalizedRating) continue
      seen.add(key)
      structuredRows.push(`Roster player | ${normalizedName} | ${normalizedRating}`)
    }
  }

  return structuredRows.length
    ? ['TennisLink structured team summary roster read', ...structuredRows].join('\n')
    : ''
}

async function recognizeDesktopScorecardTable(
  worker: Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>,
  image: DataAssistTesseractImageInput,
  pageSegMode: TesseractPageSegMode,
  scorePageSegMode: TesseractPageSegMode,
) {
  if (image.imageWidth < 1000 || image.imageHeight < 1400) return ''

  const rows = [0.313, 0.352, 0.39, 0.429, 0.467].map((ratio) => Math.round(image.imageHeight * ratio))
  const rect = {
    label: { left: 0.134, width: 0.1 },
    home: { left: 0.225, width: 0.19 },
    away: { left: 0.455, width: 0.2 },
    score: { left: 0.63, width: 0.1 },
    lowerScore: { left: 0.62, width: 0.13 },
  }
  const labelHeight = Math.round(image.imageHeight * 0.03)
  const playerHeight = Math.round(image.imageHeight * 0.04)
  const scoreHeight = Math.round(image.imageHeight * 0.05)
  const lowerScoreHeight = Math.round(image.imageHeight * 0.035)
  const lowerScoreOffset = Math.round(image.imageHeight * 0.003)
  const structuredLines: string[] = []
  const markerWinnerByRow = await detectTennisLinkWinnerMarkers(image, rows)

  await worker.setParameters({
    tessedit_pageseg_mode: pageSegMode,
  })

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const top = rows[rowIndex]
    const label = await recognizeCell(worker, image, rect.label.left, top, rect.label.width, labelHeight)
    const lineLabel = normalizeStructuredLineLabel(label)
    await worker.setParameters({
      tessedit_pageseg_mode: scorePageSegMode,
    })
    const [home, away] = await Promise.all([
      recognizeCell(worker, image, rect.home.left, top, rect.home.width, playerHeight),
      recognizeCell(worker, image, rect.away.left, top, rect.away.width, playerHeight),
    ])
    await worker.setParameters({
      tessedit_pageseg_mode: pageSegMode,
    })
    const score = await recognizeStructuredScoreCell({
      worker,
      image,
      lineLabel,
      top,
      defaultRect: rect.score,
      defaultHeight: scoreHeight,
      lowerRect: rect.lowerScore,
      lowerTop: top + lowerScoreOffset,
      lowerHeight: lowerScoreHeight,
      pageSegMode,
      scorePageSegMode,
    })
    const normalizedScore = normalizeStructuredScore(score)
    const homePlayers = normalizeStructuredPlayers(home, lineLabel)
    const awayPlayers = normalizeStructuredPlayers(away, lineLabel)
    const markerWinner = markerWinnerByRow[rowIndex]
    const markerText = markerWinner ? ` Winner marker: ${markerWinner}` : ''
    if (!lineLabel || (!homePlayers && !awayPlayers && !normalizedScore)) continue
    structuredLines.push(`${lineLabel} ${homePlayers} Completed Vs. ${awayPlayers}${markerText} ${normalizedScore}`.replace(/\s+/g, ' ').trim())
  }

  return structuredLines.length
    ? ['TennisLink structured table read', ...structuredLines].join('\n')
    : ''
}

function normalizeStructuredScheduleMatchId(value: string) {
  const digits = value.replace(/\D/g, '')
  if (/^1011650\d{3}$/.test(digits)) return digits
  if (/^101650\d{3}$/.test(digits)) return digits.replace(/^101650/, '1011650')
  return ''
}

async function detectTennisLinkWinnerMarkers(
  image: DataAssistTesseractImageInput,
  rows: number[],
): Promise<Array<'home' | 'away' | null>> {
  try {
    const sharp = (await import('sharp')).default
    const { data, info } = await sharp(image.imageBuffer).raw().toBuffer({ resolveWithObject: true })
    const rowCenterOffset = Math.round(image.imageHeight * 0.014)
    const markerWindow = {
      width: Math.round(image.imageWidth * 0.035),
      height: Math.round(image.imageHeight * 0.04),
    }

    return rows.map((top) => {
      const yCenter = top + rowCenterOffset
      const homeScore = scoreGreenMarkerWindow({
        data,
        imageWidth: info.width,
        imageHeight: info.height,
        channels: info.channels,
        xCenter: Math.round(image.imageWidth * 0.384),
        yCenter,
        width: markerWindow.width,
        height: markerWindow.height,
      })
      const awayScore = scoreGreenMarkerWindow({
        data,
        imageWidth: info.width,
        imageHeight: info.height,
        channels: info.channels,
        xCenter: Math.round(image.imageWidth * 0.617),
        yCenter,
        width: markerWindow.width,
        height: markerWindow.height,
      })

      const minimumMarkerPixels = 35
      const dominanceRatio = 1.8
      if (homeScore >= minimumMarkerPixels && homeScore >= awayScore * dominanceRatio) return 'home'
      if (awayScore >= minimumMarkerPixels && awayScore >= homeScore * dominanceRatio) return 'away'
      return null
    })
  } catch {
    return rows.map(() => null)
  }
}

function scoreGreenMarkerWindow({
  data,
  imageWidth,
  imageHeight,
  channels,
  xCenter,
  yCenter,
  width,
  height,
}: {
  data: Buffer
  imageWidth: number
  imageHeight: number
  channels: number
  xCenter: number
  yCenter: number
  width: number
  height: number
}) {
  const xStart = Math.max(0, xCenter - Math.round(width / 2))
  const yStart = Math.max(0, Math.round(yCenter - height * 0.15))
  const xEnd = Math.min(imageWidth, xStart + width)
  const yEnd = Math.min(imageHeight, yStart + height)
  let greenPixels = 0

  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      const offset = (y * imageWidth + x) * channels
      const red = data[offset]
      const green = data[offset + 1]
      const blue = data[offset + 2]
      if (green > 90 && red < 170 && green > red * 1.35 && green > blue * 1.15) {
        greenPixels += 1
      }
    }
  }

  return greenPixels
}

async function recognizeStructuredScoreCell({
  worker,
  image,
  lineLabel,
  top,
  defaultRect,
  defaultHeight,
  lowerRect,
  lowerTop,
  lowerHeight,
  pageSegMode,
  scorePageSegMode,
}: {
  worker: Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>
  image: DataAssistTesseractImageInput
  lineLabel: string
  top: number
  defaultRect: { left: number; width: number }
  defaultHeight: number
  lowerRect: { left: number; width: number }
  lowerTop: number
  lowerHeight: number
  pageSegMode: TesseractPageSegMode
  scorePageSegMode: TesseractPageSegMode
}) {
  if (lineLabel !== '1# Doubles') {
    return recognizeCell(worker, image, defaultRect.left, top, defaultRect.width, defaultHeight)
  }

  const defaultScore = await recognizeCell(worker, image, defaultRect.left, top, defaultRect.width, defaultHeight)
  await worker.setParameters({
    tessedit_pageseg_mode: scorePageSegMode,
  })
  const candidates = [
    defaultScore,
    await recognizeCell(worker, image, lowerRect.left, lowerTop, lowerRect.width, lowerHeight),
    await recognizeCell(worker, image, lowerRect.left, lowerTop + Math.round(image.imageHeight * 0.004), lowerRect.width, lowerHeight),
    await recognizeCell(worker, image, lowerRect.left, lowerTop - Math.round(image.imageHeight * 0.004), lowerRect.width, lowerHeight),
  ]
  await worker.setParameters({
    tessedit_pageseg_mode: pageSegMode,
  })
  return candidates.sort((a, b) => structuredScoreCandidateQuality(b) - structuredScoreCandidateQuality(a))[0] || ''
}

async function recognizeCell(
  worker: Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>,
  image: DataAssistTesseractImageInput,
  leftRatio: number,
  top: number,
  widthRatio: number,
  height: number,
) {
  const result = await worker.recognize(image.imageBuffer, {
    rectangle: {
      left: Math.round(image.imageWidth * leftRatio),
      top,
      width: Math.round(image.imageWidth * widthRatio),
      height,
    },
  })
  return normalizeOcrBlock(result.data.text)
}

function normalizeStructuredLineLabel(value: string) {
  const clean = value.toLowerCase().replace(/[^a-z0-9# ]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (/^(?:1[#8]?|18)\s*singles/.test(clean)) return '1# Singles'
  if (/^2[#8]?\s*singles/.test(clean)) return '2# Singles'
  if (/^(?:1[#8]?|18)\s*(?:doubles|doues)/.test(clean)) return '1# Doubles'
  if (/^(?:2[#6]?|26)\s*doubles/.test(clean)) return '2# Doubles'
  if (/^3[#8]?\s*doubles/.test(clean)) return '3# Doubles'
  return ''
}

function normalizeStructuredScore(value: string) {
  const tokens = value
    .replace(/[^\d]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  return tokens
    .map((token, index) => {
      if (token.length === 1) {
        const nextToken = tokens[index + 1] || ''
        return token === '6' && /^6[01]$/.test(nextToken) ? '7-6' : token
      }
      const compact = token.slice(0, 2)
      const first = compact[0] === '5' && Number(compact[1]) <= 4 ? '6' : compact[0]
      if (Number(first) > 7 || Number(compact[1]) > 7) return ''
      return `${first}-${compact[1]}`
    })
    .filter((token) => token.includes('-'))
    .join(' ')
}

function structuredScoreCandidateQuality(value: string) {
  const normalized = normalizeStructuredScore(value)
  const setCount = normalized.match(/\b\d-\d\b/g)?.length ?? 0
  const hasTiebreakishSet = /\b7-6\b/.test(normalized)
  return setCount * 10 + (hasTiebreakishSet ? 2 : 0) - (/\b[89]\b/.test(value) ? 4 : 0)
}

function normalizeStructuredPlayers(value: string, lineLabel: string) {
  const cleaned = value
    .replace(/\bcompleted\b/gi, ' ')
    .replace(/['"‘’°~©\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''

  const words = cleaned.split(' ').filter(Boolean)
  if (/Doubles/i.test(lineLabel) && words.length >= 4) {
    return [
      normalizeStructuredPlayerName(words.slice(0, 2).join(' ')),
      normalizeStructuredPlayerName(words.slice(2, 4).join(' ')),
    ].join(' / ')
  }
  return normalizeStructuredPlayerName(words.slice(0, 2).join(' '))
}

function normalizeStructuredPlayerName(value: string) {
  return value
    .replace(/\bWiliam\b/g, 'William')
    .replace(/\bShave Khosla\b/g, 'Shawn Khosla')
    .replace(/\bEdun Ema\b/g, 'Edwin Ernst')
    .replace(/\bMark Soph\b/g, 'Mark Sophir')
    .replace(/\.$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeStructuredRosterName(value: string) {
  return value
    .replace(/\bPlayer\b|\bNTRP\b/gi, ' ')
    .replace(/['"â€˜â€™Â°~Â©\[\]]/g, ' ')
    .replace(/[^A-Za-z'. -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeStructuredRosterRating(value: string) {
  const token = value.toLowerCase().replace(/[^a-z0-9.]+/g, '')
  if (!token) return ''
  if (token === '4s' || token === 'as' || token === '45') return '4.5'
  if (token === 'o' || token === '4' || token === '40') return '4.0'
  if (/^[2-5]\.[05]$/.test(token)) return token
  return ''
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
