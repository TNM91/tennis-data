import { createClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import {
  assessDataAssistScorecardDraft,
  buildDataAssistOcrQualitySummary,
  buildScorecardOcrDraftFromText,
  getServerDataAssistOcrReadiness,
  type DataAssistOcrScreenshotInput,
} from '@/lib/data-assist-ocr'
import { recognizeDataAssistScreenshotsWithTesseract, type DataAssistTesseractImageInput } from '@/lib/data-assist-tesseract'

export const runtime = 'nodejs'
export const maxDuration = 60

const DATA_ASSIST_SCREENSHOT_BUCKET = 'data-assist-screenshots'

type OcrRequestBody = {
  batchId?: unknown
  draftId?: unknown
}

type ScreenshotRow = {
  upload_order?: number | null
  file_name?: string | null
  mime_type?: string | null
  image_width?: number | null
  image_height?: number | null
  confidence_score?: number | null
  visual_signals?: unknown
  storage_bucket?: string | null
  storage_path?: string | null
}

type StorageDownloadClient = {
  storage: {
    from: (bucket: string) => {
      download: (path: string) => Promise<{
        data: Blob | null
        error: { message?: string } | null
      }>
    }
  }
}

export async function POST(request: Request) {
  const token = getBearerToken(request)
  if (!token) {
    return Response.json({ ok: false, message: 'Sign in required.' }, { status: 401 })
  }

  const requesterCheck = await getRequester(token)
  if (!requesterCheck.ok) {
    return Response.json({ ok: false, message: requesterCheck.message }, { status: requesterCheck.status })
  }

  const readiness = getServerDataAssistOcrReadiness()
  if (!readiness.canRun || readiness.provider !== 'tesseract') {
    return Response.json({ ok: false, message: readiness.reason }, { status: 400 })
  }

  let body: OcrRequestBody
  try {
    body = (await request.json()) as OcrRequestBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid OCR request body.' }, { status: 400 })
  }

  const batchId = cleanText(body.batchId)
  const draftId = cleanText(body.draftId)
  if (!batchId || !draftId) {
    return Response.json({ ok: false, message: 'Missing Data Assist batch or draft id.' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    return Response.json(
      { ok: false, message: 'SUPABASE_SERVICE_ROLE_KEY is required for private screenshot OCR.' },
      { status: 500 },
    )
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  const [batchResult, screenshotResult] = await Promise.all([
    supabase
      .from('data_assist_batches')
      .select('requested_import_type, status, submitted_by_user_id')
      .eq('id', batchId)
      .maybeSingle(),
    supabase
      .from('data_assist_screenshots')
      .select('upload_order, file_name, mime_type, image_width, image_height, confidence_score, visual_signals, storage_bucket, storage_path')
      .eq('batch_id', batchId)
      .order('upload_order', { ascending: true }),
  ])

  if (batchResult.error) return Response.json({ ok: false, message: batchResult.error.message }, { status: 500 })
  if (screenshotResult.error) return Response.json({ ok: false, message: screenshotResult.error.message }, { status: 500 })

  const batch = batchResult.data as {
    requested_import_type?: string | null
    status?: string | null
    submitted_by_user_id?: string | null
  } | null
  if (!batch) {
    return Response.json({ ok: false, message: 'Data Assist batch was not found.' }, { status: 404 })
  }
  if (!requesterCheck.isAdmin && cleanText(batch.submitted_by_user_id) !== requesterCheck.userId) {
    return Response.json({ ok: false, message: 'You can only OCR your own Data Assist uploads.' }, { status: 403 })
  }
  if (batch?.requested_import_type !== 'scorecard') {
    return Response.json(
      { ok: false, message: 'Free OCR is currently scoped to TennisLink scorecard batches.' },
      { status: 400 },
    )
  }

  const screenshots = ((screenshotResult.data || []) as ScreenshotRow[]).map(toScreenshotInput)
  let ocrResult: Awaited<ReturnType<typeof recognizeDataAssistScreenshotsWithTesseract>>
  try {
    const imageInputs = await downloadScreenshotImages(supabase, screenshots)
    ocrResult = await recognizeDataAssistScreenshotsWithTesseract(imageInputs)
  } catch (error) {
    return Response.json(
      { ok: false, message: error instanceof Error ? error.message : 'Free OCR could not process these screenshots.' },
      { status: 500 },
    )
  }
  const parsedDraftBase = buildScorecardOcrDraftFromText(ocrResult.rawText, screenshots, ocrResult.provider)
  const parsedDraft = {
    ...parsedDraftBase,
    parserWarnings: uniqueText([...ocrResult.warnings, ...parsedDraftBase.parserWarnings]),
    confidenceScore: Math.max(parsedDraftBase.confidenceScore, ocrResult.confidenceScore),
  }
  parsedDraft.ocrQuality = buildDataAssistOcrQualitySummary({
    provider: parsedDraft.provider,
    rawText: ocrResult.rawText,
    parserWarnings: parsedDraft.parserWarnings,
    parsedLineCount: parsedDraft.lineCount,
    ocrConfidenceScore: ocrResult.confidenceScore,
    parserConfidenceScore: parsedDraftBase.confidenceScore,
    duplicateLineCount: ocrResult.screenshotSummaries.reduce((sum, screenshot) => sum + screenshot.duplicateLineCount, 0),
    screenshotSummaries: ocrResult.screenshotSummaries,
  })
  const autoAssessment = assessDataAssistScorecardDraft(parsedDraft)
  parsedDraft.ocrQuality.autoAssessment = autoAssessment
  const screenshotConfidence = screenshots.length
    ? screenshots.reduce((sum, screenshot) => sum + screenshot.confidenceScore, 0) / screenshots.length
    : 0
  const confidenceScore = roundConfidence(Math.max(parsedDraft.confidenceScore, ocrResult.confidenceScore, screenshotConfidence))
  const processedAt = new Date().toISOString()

  const { data: job, error: jobError } = await supabase
    .from('data_assist_ocr_jobs')
    .insert({
      batch_id: batchId,
      draft_id: draftId,
      requested_by_user_id: requesterCheck.userId,
      provider: parsedDraft.provider,
      status: 'completed',
      screenshot_count: screenshots.length,
      confidence_score: confidenceScore,
      warnings: parsedDraft.parserWarnings,
      result_payload: parsedDraft,
      processed_at: processedAt,
    })
    .select('id')
    .single()

  if (jobError) return Response.json({ ok: false, message: jobError.message }, { status: 500 })
  const jobId = cleanText((job as { id?: string | null } | null)?.id)
  if (!jobId) return Response.json({ ok: false, message: 'OCR verification job could not be created.' }, { status: 500 })

  const draftUpdate = await supabase
    .from('data_assist_drafts')
    .update({
      status: autoAssessment.decision === 'blocked' ? 'blocked' : 'ready_for_verification',
      confidence_score: confidenceScore,
      ocr_status: 'processed',
      ocr_job_id: jobId,
      ocr_provider: parsedDraft.provider,
      ocr_processed_at: processedAt,
      parsed_payload: parsedDraft,
      external_match_id: parsedDraft.externalMatchId,
      home_team: parsedDraft.homeTeam,
      away_team: parsedDraft.awayTeam,
      match_date: parsedDraft.matchDate,
      line_count: parsedDraft.lineCount,
      parser_warnings: parsedDraft.parserWarnings,
      validation_summary: {
        message: autoAssessment.detail,
        autoAssessment,
        importLocked: autoAssessment.importLocked,
        sourceScreenshotCount: screenshots.length,
        ocrConfidenceScore: ocrResult.confidenceScore,
      },
    })
    .eq('id', draftId)

  if (draftUpdate.error) return Response.json({ ok: false, message: draftUpdate.error.message }, { status: 500 })

  const batchStatus = autoAssessment.decision === 'auto_ready' || autoAssessment.decision === 'member_confirm'
    ? 'ready_to_import'
    : autoAssessment.decision === 'blocked'
      ? 'needs_review'
      : 'needs_review'
  const batchReviewNote = autoAssessment.adminReviewRequired
    ? autoAssessment.detail
    : autoAssessment.decision === 'blocked'
      ? autoAssessment.detail
      : ''
  const batchUpdate = await supabase
    .from('data_assist_batches')
    .update({
      status: batchStatus,
      review_note: batchReviewNote,
      reviewed_by_user_id: autoAssessment.adminReviewRequired ? null : requesterCheck.userId,
      reviewed_at: autoAssessment.adminReviewRequired ? null : processedAt,
    })
    .eq('id', batchId)

  if (batchUpdate.error) return Response.json({ ok: false, message: batchUpdate.error.message }, { status: 500 })

  return Response.json({
    ok: true,
    jobId,
    parsedDraft,
    autoAssessment,
  })
}

async function getRequester(token: string): Promise<
  | { ok: true; userId: string; isAdmin: boolean }
  | { ok: false; status: number; message: string }
> {
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser(token)

  if (userError || !userData.user) {
    return { ok: false, status: 401, message: 'Sign in required.' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileError) {
    return { ok: false, status: 500, message: profileError.message }
  }

  return {
    ok: true,
    userId: userData.user.id,
    isAdmin: (profile as { role?: string } | null)?.role === 'admin',
  }
}

function toScreenshotInput(row: ScreenshotRow): DataAssistOcrScreenshotInput & {
  storageBucket: string
  storagePath: string
  mimeType: string
} {
  return {
    uploadOrder: row.upload_order ?? 0,
    fileName: cleanText(row.file_name),
    mimeType: cleanText(row.mime_type) || 'image/png',
    imageWidth: row.image_width ?? 0,
    imageHeight: row.image_height ?? 0,
    confidenceScore: row.confidence_score ?? 0,
    visualSignals: normalizeSignals(row.visual_signals),
    storageBucket: cleanText(row.storage_bucket) || DATA_ASSIST_SCREENSHOT_BUCKET,
    storagePath: cleanText(row.storage_path),
  }
}

async function downloadScreenshotImages(
  supabase: StorageDownloadClient,
  screenshots: Array<DataAssistOcrScreenshotInput & { storageBucket: string; storagePath: string; mimeType: string }>,
): Promise<DataAssistTesseractImageInput[]> {
  const images: DataAssistTesseractImageInput[] = []

  for (const screenshot of screenshots) {
    if (!screenshot.storagePath) {
      throw new Error(`Screenshot #${screenshot.uploadOrder} is missing private storage path.`)
    }

    const { data, error } = await supabase.storage
      .from(screenshot.storageBucket)
      .download(screenshot.storagePath)

    if (error || !data) {
      throw new Error(error?.message || `Could not download screenshot #${screenshot.uploadOrder}.`)
    }

    images.push({
      ...screenshot,
      imageBuffer: Buffer.from(await data.arrayBuffer()),
    })
  }

  return images
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}

function normalizeSignals(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => cleanText(item)).filter(Boolean)
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function uniqueText(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function roundConfidence(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100))
}
