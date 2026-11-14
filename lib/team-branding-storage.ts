import type { SupabaseClient } from '@supabase/supabase-js'
import { buildTeamLogoStoragePath, type TeamLogoDimensions } from './team-branding'

const bucket = 'team-room-files'
type Logo = TeamLogoDimensions & { mimeType: string; bytes: Uint8Array<ArrayBuffer> }

function storedPath(roomId: string, metadata: Record<string, unknown> | null) {
  const logo = metadata?.teamLogo as { bucket?: unknown; path?: unknown } | undefined
  const prefix = 'team-logos/' + roomId + '/'
  return logo?.bucket === bucket && typeof logo.path === 'string' && logo.path.startsWith(prefix) &&
    /^[a-f0-9-]{36}\.(?:jpg|png|webp)$/.test(logo.path.slice(prefix.length)) ? logo.path : ''
}

export async function loadTeamLogoUrls(service: SupabaseClient, roomIds: string[], roomType: 'team_room' | 'team_room_chat' | 'player_group' = 'team_room') {
  const urls = new Map<string, string>()
  if (!roomIds.length) return urls
  const { data, error } = await service.from('internal_conversations').select('id,metadata')
    .in('id', roomIds).eq('related_entity_type', roomType).eq('status', 'open').limit(roomIds.length)
  if (error || !data) return urls
  const rooms = new Map(data.flatMap(row => {
    const path = storedPath(row.id, row.metadata)
    return path ? [[path, row.id] as const] : []
  }))
  if (!rooms.size) return urls
  const signed = await service.storage.from(bucket).createSignedUrls([...rooms.keys()], 60 * 30)
  for (const entry of signed.data ?? []) {
    const roomId = entry.path && rooms.get(entry.path)
    if (roomId && entry.signedUrl) urls.set(roomId, entry.signedUrl)
  }
  return urls
}

export async function saveTeamLogo(
  service: SupabaseClient, roomId: string, previous: Record<string, unknown> | null, logo: Logo | null,
) {
  const storage = service.storage.from(bucket)
  const oldPath = storedPath(roomId, previous)
  if (!logo && !previous?.teamLogo) return 200
  const path = logo ? buildTeamLogoStoragePath(roomId, logo.mimeType, crypto.randomUUID()) : ''
  if (logo) {
    const upload = await storage.upload(path, logo.bytes, {
      cacheControl: '1800', contentType: logo.mimeType, upsert: false,
    })
    if (upload.error) return 503
  }
  const metadata = { ...previous }
  if (logo) metadata.teamLogo = { bucket, path, mimeType: logo.mimeType, width: logo.width, height: logo.height }
  else delete metadata.teamLogo
  const update = service.from('internal_conversations').update({ metadata, updated_at: new Date().toISOString() })
    .eq('id', roomId).eq('status', 'open')
  const changed = await (previous ? update.eq('metadata', JSON.stringify(previous)) : update.is('metadata', null))
    .select('id').maybeSingle()
  if (changed.error) return 503
  if (!changed.data) {
    if (path) await storage.remove([path]).catch(() => {})
    return 409
  }
  if (oldPath) await storage.remove([oldPath]).catch(() => {})
  return 200
}
