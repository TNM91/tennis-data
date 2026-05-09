import { createClient } from '@supabase/supabase-js'
import { supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

const DATA_ASSIST_SCREENSHOT_BUCKET = 'data-assist-screenshots'

type ScreenshotStorageRow = {
  storage_bucket?: string | null
  storage_path?: string | null
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ batchId?: string }> },
) {
  const token = getBearerToken(request)
  if (!token) {
    return Response.json({ ok: false, message: 'Sign in required.' }, { status: 401 })
  }

  const batchId = cleanText((await context.params).batchId)
  if (!batchId) {
    return Response.json({ ok: false, message: 'Missing Data Assist draft.' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    return Response.json(
      { ok: false, message: 'Data Assist draft removal is not configured.' },
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

  const { data: requesterData, error: requesterError } = await supabase.auth.getUser(token)
  if (requesterError || !requesterData.user?.id) {
    return Response.json({ ok: false, message: requesterError?.message || 'Sign in required.' }, { status: 401 })
  }
  const userId = requesterData.user.id

  const { data: batch, error: batchError } = await supabase
    .from('data_assist_batches')
    .select('submitted_by_user_id, status')
    .eq('id', batchId)
    .maybeSingle()

  if (batchError) return Response.json({ ok: false, message: batchError.message }, { status: 500 })
  const batchRow = batch as { submitted_by_user_id?: string | null; status?: string | null } | null
  if (!batchRow) {
    return Response.json({ ok: false, message: 'Data Assist draft was not found.' }, { status: 404 })
  }
  if (cleanText(batchRow.submitted_by_user_id) !== userId) {
    return Response.json({ ok: false, message: 'You can only remove your own Data Assist drafts.' }, { status: 403 })
  }
  if (batchRow.status === 'imported') {
    return Response.json(
      { ok: false, message: 'Imported scorecards stay in your history because they already updated TenAceIQ.' },
      { status: 400 },
    )
  }

  const { data: screenshots, error: screenshotError } = await supabase
    .from('data_assist_screenshots')
    .select('storage_bucket, storage_path')
    .eq('batch_id', batchId)
  if (screenshotError) return Response.json({ ok: false, message: screenshotError.message }, { status: 500 })

  const pathsByBucket = ((screenshots || []) as ScreenshotStorageRow[]).reduce<Record<string, string[]>>((acc, row) => {
    const bucket = cleanText(row.storage_bucket) || DATA_ASSIST_SCREENSHOT_BUCKET
    const storagePath = cleanText(row.storage_path)
    if (!storagePath) return acc
    acc[bucket] = [...(acc[bucket] || []), storagePath]
    return acc
  }, {})

  for (const [bucket, paths] of Object.entries(pathsByBucket)) {
    if (!paths.length) continue
    await supabase.storage.from(bucket).remove(paths)
  }

  const { error: deleteError } = await supabase
    .from('data_assist_batches')
    .delete()
    .eq('id', batchId)
  if (deleteError) return Response.json({ ok: false, message: deleteError.message }, { status: 500 })

  return Response.json({ ok: true, message: 'Data Assist draft removed.' })
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
