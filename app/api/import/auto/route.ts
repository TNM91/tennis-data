import { createServerSupabaseClient, runAutoImport, type AutoImportPageType } from '@/lib/ingestion/autoImport'

export const runtime = 'nodejs'

type AutoImportBody = {
  pageType?: unknown
  payload?: unknown
}

function isPageType(value: unknown): value is AutoImportPageType {
  return value === 'scorecard' || value === 'season_schedule' || value === 'team_summary'
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return Response.json(body, {
    ...init,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...(init?.headers ?? {}),
    },
  })
}

export async function OPTIONS() {
  return jsonResponse({ ok: true })
}

export async function POST(request: Request) {
  let body: AutoImportBody

  try {
    body = (await request.json()) as AutoImportBody
  } catch {
    return jsonResponse(
      {
        status: 'failed',
        message: 'Import failed - invalid JSON body',
      },
      { status: 400 },
    )
  }

  if (!isPageType(body.pageType)) {
    return jsonResponse(
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
    return jsonResponse(
      {
        status: 'failed',
        message: `Import failed - ${error instanceof Error ? error.message : 'server import configuration is missing'}`,
      },
      { status: 500 },
    )
  }

  const response = await runAutoImport(supabase, {
    pageType: body.pageType,
    payload: body.payload,
  })

  const statusCode = response.status === 'failed' ? 400 : 200
  return jsonResponse(response, { status: statusCode })
}
