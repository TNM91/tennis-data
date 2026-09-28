import { randomBytes } from 'node:crypto'
import { getCaptainApiAuth } from '@/lib/captain-api-auth'
import { isCaptainShareKind } from '@/lib/captain-share-links'
import {
  cleanShareText,
  getCaptainShareServiceClient,
  isSafeCaptainShareTarget,
} from '@/lib/captain-share-links-server'

export const runtime = 'nodejs'

type ShareLinkBody = {
  kind?: unknown
  targetHref?: unknown
  teamName?: unknown
  opponent?: unknown
  matchDate?: unknown
  detail?: unknown
}

export async function POST(request: Request) {
  const auth = await getCaptainApiAuth(request)
  if (!auth.ok) return auth.response

  let body: ShareLinkBody
  try {
    body = await request.json() as ShareLinkBody
  } catch {
    return Response.json({ ok: false, message: 'The share preview request was invalid.' }, { status: 400 })
  }

  const targetHref = cleanShareText(body.targetHref, 1800)
  const matchDate = cleanShareText(body.matchDate, 10)
  if (!isCaptainShareKind(body.kind) || !isSafeCaptainShareTarget(targetHref)) {
    return Response.json({ ok: false, message: 'This Captain link cannot be shared.' }, { status: 400 })
  }
  if (matchDate && !/^\d{4}-\d{2}-\d{2}$/.test(matchDate)) {
    return Response.json({ ok: false, message: 'Choose a valid match date before sharing.' }, { status: 400 })
  }

  const token = randomBytes(15).toString('base64url')
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await getCaptainShareServiceClient()
    .from('captain_share_links')
    .insert({
      token,
      created_by_user_id: auth.userId,
      kind: body.kind,
      target_href: targetHref,
      team_name: cleanShareText(body.teamName),
      opponent: cleanShareText(body.opponent),
      match_date: matchDate || null,
      detail: cleanShareText(body.detail, 240),
      expires_at: expiresAt,
    })
  if (error) {
    return Response.json({ ok: false, message: 'The share preview could not be prepared.' }, { status: 500 })
  }

  const origin = new URL(request.url).origin
  return Response.json({
    ok: true,
    shareUrl: `${origin}/share/captain/${token}`,
    expiresAt,
  })
}
