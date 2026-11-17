import { accountClient, accountResponse, readAccountJson, verifiedAccount } from '@/lib/mobile-account-auth'
import { readTeamLogoChoice, saveTeamLogo } from '@/lib/team-branding-storage'
import { chatIconModeHeader, chatIconModePresets } from '@/lib/chat-icon-presets'
import { teamChatMessageId } from '@/lib/team-chat-cursor'

export const runtime = 'nodejs'

const reply = (body: object, status: number) =>
  accountResponse({ ...body, releaseScope: 'first-party' }, status, { 'Referrer-Policy': 'no-referrer' })
const denied = (status: number) => reply({ ok: false }, status)

export async function POST(request: Request) {
  try {
    const account = await verifiedAccount(request)
    if (!account) return denied(401)
    const body = await readAccountJson(request, 360_000)
    if (!body || Object.keys(body).length !== 2 || !teamChatMessageId(body.room)) return denied(400)
    const { room } = body
    const logo = readTeamLogoChoice(body, request.headers.get(chatIconModeHeader) === chatIconModePresets)
    if (logo === undefined) return denied(400)
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!key) return denied(503)
    const service = accountClient(key), owner = account.user.id
    const { data, error } = await service.from('internal_conversations').select('id,metadata')
      .eq('id', room).eq('related_entity_type', 'player_group').eq('created_by_user_id', owner)
      .eq('status', 'open').maybeSingle()
    if (error) return denied(503)
    if (!data) return denied(403)
    const { data: access, error: accessError } = await service.rpc('native_player_chats_read', {
      p_owner: owner, p_room: room, p_before_at: null, p_before_id: null,
    }).retry(false)
    if (accessError) return denied(503)
    if (access?.code !== 'ok' || access.room?.manage !== true) return denied(403)

    const status = await saveTeamLogo(service, room, data.metadata, logo)
    return status === 200 ? reply({ ok: true, owner, roomId: room, hasLogo: logo !== null,
      ...('preset' in body ? { preset: logo } : {}) }, 200) : denied(status)
  } catch {
    return denied(503)
  }
}
