import type { SupabaseClient } from '@supabase/supabase-js'
import { buildTeamLogoStoragePath, inspectTeamLogoImage, validateTeamLogoDimensions, type TeamLogoDimensions } from './team-branding'
import { chatIconPresetValue, readChatIconPreset, type ChatIconPreset } from './chat-icon-presets'

const bucket = 'team-room-files'
type Logo = TeamLogoDimensions & { mimeType: string; bytes: Uint8Array<ArrayBuffer> }
type LogoChoice = Logo | ChatIconPreset | null

export function readTeamLogoChoice(body: Record<string, unknown>, presetsOnly: boolean): LogoChoice | undefined {
  if ('preset' in body) return 'photo' in body ? undefined : body.preset === null ? null : readChatIconPreset(body.preset)
  if (presetsOnly) return undefined
  if (body.photo === null) return null
  if (typeof body.photo !== 'string' || body.photo.length > 350_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.photo)) return undefined
  const bytes = Buffer.from(body.photo, 'base64'), mimeType = 'image/jpeg'
  const dimensions = inspectTeamLogoImage(bytes, mimeType)
  if (!dimensions || validateTeamLogoDimensions(dimensions) || Math.max(dimensions.width, dimensions.height) > 512) return undefined
  return { ...dimensions, bytes, mimeType }
}

function storedPath(roomId: string, metadata: Record<string, unknown> | null) {
  const logo = metadata?.teamLogo as { bucket?: unknown; path?: unknown } | undefined
  const prefix = 'team-logos/' + roomId + '/'
  return logo?.bucket === bucket && typeof logo.path === 'string' && logo.path.startsWith(prefix) &&
    /^[a-f0-9-]{36}\.(?:jpg|png|webp)$/.test(logo.path.slice(prefix.length)) ? logo.path : ''
}

export async function loadTeamLogoUrls(service: SupabaseClient, roomIds: string[], roomType: 'team_room' | 'team_room_chat' | 'player_group' = 'team_room', presetsOnly = false) {
  const urls = new Map<string, string>()
  if (!roomIds.length) return urls
  const { data, error } = await service.from('internal_conversations').select('id,metadata')
    .in('id', roomIds).eq('related_entity_type', roomType).eq('status', 'open').limit(roomIds.length)
  if (error || !data) return urls
  const rooms = new Map<string, string>()
  for (const row of data) {
    const preset = readChatIconPreset(row.metadata?.teamLogo?.preset)
    if (preset) urls.set(row.id, chatIconPresetValue(preset))
    else if (!presetsOnly) {
      const path = storedPath(row.id, row.metadata)
      if (path) rooms.set(path, row.id)
    }
  }
  if (!rooms.size) return urls
  const signed = await service.storage.from(bucket).createSignedUrls([...rooms.keys()], 60 * 30)
  for (const entry of signed.data ?? []) {
    const roomId = entry.path && rooms.get(entry.path)
    if (roomId && entry.signedUrl) urls.set(roomId, entry.signedUrl)
  }
  return urls
}

export async function saveTeamLogo(
  service: SupabaseClient, roomId: string, previous: Record<string, unknown> | null, logo: LogoChoice,
) {
  const storage = service.storage.from(bucket)
  const oldPath = storedPath(roomId, previous)
  if (!logo && !previous?.teamLogo) return 200
  const image = typeof logo === 'object' ? logo : null
  const path = image ? buildTeamLogoStoragePath(roomId, image.mimeType, crypto.randomUUID()) : ''
  if (image) {
    const upload = await storage.upload(path, image.bytes, {
      cacheControl: '1800', contentType: image.mimeType, upsert: false,
    })
    if (upload.error) return 503
  }
  const metadata = { ...previous }
  if (typeof logo === 'string') metadata.teamLogo = { preset: logo }
  else if (image) metadata.teamLogo = { bucket, path, mimeType: image.mimeType, width: image.width, height: image.height }
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
