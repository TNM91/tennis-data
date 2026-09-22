import { createServerSupabaseClient, runAutoImport, type AutoImportPageType } from '@/lib/ingestion/autoImport'
import { getAdminApiAuth } from '@/lib/server-api-auth'

export const runtime = 'nodejs'

type AutoImportBody = {
  pageType?: unknown
  payload?: unknown
}

function isPageType(value: unknown): value is AutoImportPageType {
  return value === 'scorecard' || value === 'season_schedule' || value === 'team_summary'
}

export async function POST(request: Request) {
  const adminAuth = await getAdminApiAuth(request)
  if (!adminAuth.ok) return adminAuth.response

  let body: AutoImportBody

  try {
    body = (await request.json()) as AutoImportBody
  } catch {
    return Response.json(
      {
        status: 'failed',
        message: 'Import failed - invalid JSON body',
      },
      { status: 400 },
    )
  }

  if (!isPageType(body.pageType)) {
    return Response.json(
      {
        status: 'failed',
        message: 'Import failed - invalid pageType',
      },
      { status: 400 },
    )
  }

  let supabase: ReturnType<typeof createServerSupabaseClient>
  try {
    supabase = createServerSupabaseClient()
  } catch (error) {
    console.error('Auto-import service initialization failed', error)
    return Response.json(
      {
        status: 'failed',
        message: 'Import failed because the server is not ready.',
      },
      { status: 500 },
    )
  }

  const response = await runAutoImport(supabase, {
    pageType: body.pageType,
    payload: body.payload,
  })

  const statusCode = response.status === 'failed' ? 400 : 200
  return Response.json(response, { status: statusCode })
}
