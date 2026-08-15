import { PLAYER_DEVELOPMENT_PLAYING_STYLES } from './player-development'

export const PLAYER_STYLE_COOKIE = 'tenaceiq_player_style_v1'
export const PLAYER_STYLE_STORAGE_KEY = 'tenaceiq:player-style:v1'
export const PLAYER_FOCUS_STORAGE_KEY = 'tenaceiq:development-focus:v1'

export function isPlayerStyleSlug(value: unknown): value is string {
  return typeof value === 'string' && PLAYER_DEVELOPMENT_PLAYING_STYLES.some((identity) => identity.slug === value)
}

export function writePlayerStyleCookie(slug: string) {
  if (typeof document === 'undefined' || !isPlayerStyleSlug(slug)) return
  document.cookie = `${PLAYER_STYLE_COOKIE}=${encodeURIComponent(slug)}; path=/; max-age=31536000; samesite=lax`
}
