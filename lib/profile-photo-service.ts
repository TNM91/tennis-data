'use client'

import { getClientAuthState } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

const PROFILE_PHOTO_BUCKET = 'profile-photos'
const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024
const ALLOWED_PROFILE_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

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

export async function uploadProfilePhoto(file: File): Promise<{ publicUrl: string; warning: string | null }> {
  if (!ALLOWED_PROFILE_PHOTO_TYPES.has(file.type)) {
    return { publicUrl: '', warning: 'Upload a JPG, PNG, WebP, or GIF image.' }
  }

  if (file.size > MAX_PROFILE_PHOTO_BYTES) {
    return { publicUrl: '', warning: 'Profile photos need to be 5 MB or smaller.' }
  }

  const authState = await getClientAuthState()
  const userId = cleanText(authState.user?.id)
  if (!userId) {
    return { publicUrl: '', warning: 'Sign in to upload a profile photo.' }
  }

  const path = `${userId}/profile-${Date.now()}.${getExtension(file)}`
  const { error } = await supabase.storage
    .from(PROFILE_PHOTO_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: true,
    })

  if (error) {
    return { publicUrl: '', warning: error.message || 'Unable to upload profile photo.' }
  }

  const { data } = supabase.storage.from(PROFILE_PHOTO_BUCKET).getPublicUrl(path)
  const publicUrl = data.publicUrl
  const update = await supabase.from('profiles').update({ profile_photo_url: publicUrl }).eq('id', userId)
  if (update.error) {
    return { publicUrl, warning: 'Photo uploaded, but the profile record could not be updated yet.' }
  }

  return { publicUrl, warning: null }
}
