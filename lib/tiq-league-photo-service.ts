'use client'

import { getClientAuthState } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

const TIQ_LEAGUE_PHOTO_BUCKET = 'tiq-league-photos'
const MAX_LEAGUE_PHOTO_BYTES = 5 * 1024 * 1024
const ALLOWED_LEAGUE_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}

function getExtension(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fromName)) return fromName
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/gif') return 'gif'
  return 'jpg'
}

function buildSafeSlug(value: string) {
  return (
    cleanText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'league'
  )
}

export async function uploadTiqLeaguePhoto(input: {
  file: File
  leagueName: string
  existingLeagueId?: string | null
}): Promise<{ publicUrl: string; warning: string | null }> {
  const { file } = input

  if (!ALLOWED_LEAGUE_PHOTO_TYPES.has(file.type)) {
    return {
      publicUrl: '',
      warning: 'Upload a JPG, PNG, WebP, or GIF image.',
    }
  }

  if (file.size > MAX_LEAGUE_PHOTO_BYTES) {
    return {
      publicUrl: '',
      warning: 'League photos need to be 5 MB or smaller.',
    }
  }

  const authState = await getClientAuthState()
  const userId = cleanText(authState.user?.id)
  if (!userId) {
    return {
      publicUrl: '',
      warning: 'Sign in to upload league photos.',
    }
  }

  const leagueSlug = buildSafeSlug(input.existingLeagueId || input.leagueName)
  const path = `${userId}/${leagueSlug}-${Date.now()}.${getExtension(file)}`

  const { error } = await supabase.storage
    .from(TIQ_LEAGUE_PHOTO_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: true,
    })

  if (error) {
    return {
      publicUrl: '',
      warning: error.message || 'Unable to upload league photo.',
    }
  }

  const { data } = supabase.storage.from(TIQ_LEAGUE_PHOTO_BUCKET).getPublicUrl(path)

  return {
    publicUrl: data.publicUrl,
    warning: null,
  }
}
