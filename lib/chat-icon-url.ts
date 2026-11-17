import { supabaseUrl } from './supabase-public-config'
import { chatIconFromValue, chatIconPresetValue } from './chat-icon-presets'

export function readChatIcon(value: unknown, presetsOnly = false) {
  const preset = chatIconFromValue(value)
  if (preset) return chatIconPresetValue(preset)
  return presetsOnly ? undefined : readChatIconUrl(value)
}

export function readChatIconUrl(value:unknown) {
  if (typeof value !== 'string' || value.length > 2000) return undefined
  try {
    const url = new URL(value)
    if (url.origin === supabaseUrl && !url.username && !url.password &&
      /^\/storage\/v1\/object\/sign\/team-room-files\/team-logos\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(url.pathname) &&
      url.searchParams.has('token')) return url.href
  } catch { return undefined }
}
