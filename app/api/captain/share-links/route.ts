import { randomBytes } from 'node:crypto'
import { getCaptainApiAuth } from '@/lib/captain-api-auth'
import { cleanAvailabilityText, getCaptainAvailabilityServiceClient } from '@/lib/captain-availability-request-server'
import { isCaptainShareKind, safeCaptainShareTarget } from '@/lib/captain-share-preview'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const auth = await getCaptainApiAuth(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const kind = cleanAvailabilityText(body?.kind, 40)
  const requestedTarget = cleanAvailabilityText(body?.targetHref, 2000)
  if (!isCaptainShareKind(kind) || !requestedTarget.startsWith('/') || requestedTarget.startsWith('//')) {
    return Response.json({ ok: false, message: 'Choose a valid TiQ share destination.' }, { status: 400 })
  }

  const matchDate = cleanAvailabilityText(body?.matchDate, 10)
  if (matchDate && !/^\d{4}-\d{2}-\d{2}$/.test(matchDate)) {
    return Response.json({ ok: false, message: 'Choose a valid match date.' }, { status: 400 })
  }

  const token = randomBytes(9).toString('base64url')
  const expiresAt = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString()
  const service = getCaptainAvailabilityServiceClient()
  const { error } = await service.from('captain_share_links').insert({
    token,
    created_by_user_id: auth.userId,
    kind,
    target_href: safeCaptainShareTarget(requestedTarget),
    team_name: cleanAvailabilityText(body?.teamName, 160),
    opponent: cleanAvailabilityText(body?.opponent, 160),
    match_date: matchDate || null,
    detail: cleanAvailabilityText(body?.detail, 280),
    expires_at: expiresAt,
  })

  if (error) {
    console.error('[api/captain/share-links] insert failed', { code: error.code })
    return Response.json({ ok: false, message: 'The short lineup link could not be created. Please try again.' }, { status: 500 })
  }

  return Response.json({
    ok: true,
    shareUrl: `${new URL(request.url).origin}/s/${token}`,
    expiresAt,
  })
}
