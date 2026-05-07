'use client'

import { supabase } from '@/lib/supabase'
import type { InternalNotificationType } from '@/lib/internal-notifications'

export type InternalNotificationPreferences = {
  profileId: string
  messageAlertsEnabled: boolean
  scheduleAlertsEnabled: boolean
  supportAlertsEnabled: boolean
  systemAlertsEnabled: boolean
  emailFallbackEnabled: boolean
  preferencesAvailable: boolean
}

type PreferenceRow = {
  profile_id?: string | null
  message_alerts_enabled?: boolean | null
  schedule_alerts_enabled?: boolean | null
  support_alerts_enabled?: boolean | null
  system_alerts_enabled?: boolean | null
  email_fallback_enabled?: boolean | null
}

export type InternalNotificationPreferencePatch = Partial<
  Pick<
    InternalNotificationPreferences,
    | 'messageAlertsEnabled'
    | 'scheduleAlertsEnabled'
    | 'supportAlertsEnabled'
    | 'systemAlertsEnabled'
    | 'emailFallbackEnabled'
  >
>

function defaultPreferences(profileId: string, preferencesAvailable = true): InternalNotificationPreferences {
  return {
    profileId,
    messageAlertsEnabled: true,
    scheduleAlertsEnabled: true,
    supportAlertsEnabled: true,
    systemAlertsEnabled: true,
    emailFallbackEnabled: false,
    preferencesAvailable,
  }
}

function toPreferences(row: PreferenceRow | null | undefined, profileId: string): InternalNotificationPreferences {
  const defaults = defaultPreferences(profileId)
  if (!row) return defaults

  return {
    profileId,
    messageAlertsEnabled: row.message_alerts_enabled ?? defaults.messageAlertsEnabled,
    scheduleAlertsEnabled: row.schedule_alerts_enabled ?? defaults.scheduleAlertsEnabled,
    supportAlertsEnabled: row.support_alerts_enabled ?? defaults.supportAlertsEnabled,
    systemAlertsEnabled: row.system_alerts_enabled ?? defaults.systemAlertsEnabled,
    emailFallbackEnabled: row.email_fallback_enabled ?? defaults.emailFallbackEnabled,
    preferencesAvailable: true,
  }
}

function toPreferencePatch(profileId: string, patch: InternalNotificationPreferencePatch) {
  return {
    profile_id: profileId,
    ...(patch.messageAlertsEnabled !== undefined ? { message_alerts_enabled: patch.messageAlertsEnabled } : {}),
    ...(patch.scheduleAlertsEnabled !== undefined ? { schedule_alerts_enabled: patch.scheduleAlertsEnabled } : {}),
    ...(patch.supportAlertsEnabled !== undefined ? { support_alerts_enabled: patch.supportAlertsEnabled } : {}),
    ...(patch.systemAlertsEnabled !== undefined ? { system_alerts_enabled: patch.systemAlertsEnabled } : {}),
    ...(patch.emailFallbackEnabled !== undefined ? { email_fallback_enabled: patch.emailFallbackEnabled } : {}),
  }
}

export function notificationTypeEnabled(
  preferences: InternalNotificationPreferences,
  notificationType: InternalNotificationType,
) {
  if (notificationType === 'schedule') return preferences.scheduleAlertsEnabled
  if (notificationType === 'support') return preferences.supportAlertsEnabled
  if (notificationType === 'system') return preferences.systemAlertsEnabled
  return preferences.messageAlertsEnabled
}

export async function getInternalNotificationPreferences(profileId: string) {
  const normalizedProfileId = profileId.trim()
  if (!normalizedProfileId) return defaultPreferences('', false)

  const { data, error } = await supabase
    .from('internal_notification_preferences')
    .select('profile_id, message_alerts_enabled, schedule_alerts_enabled, support_alerts_enabled, system_alerts_enabled, email_fallback_enabled')
    .eq('profile_id', normalizedProfileId)
    .maybeSingle()

  if (error) return defaultPreferences(normalizedProfileId, false)
  return toPreferences((data ?? null) as PreferenceRow | null, normalizedProfileId)
}

export async function getInternalNotificationPreferencesForProfiles(profileIds: string[]) {
  const ids = Array.from(new Set(profileIds.map((id) => id.trim()).filter(Boolean)))
  const preferences = new Map<string, InternalNotificationPreferences>()
  ids.forEach((id) => preferences.set(id, defaultPreferences(id)))
  if (!ids.length) return preferences

  const { data, error } = await supabase
    .from('internal_notification_preferences')
    .select('profile_id, message_alerts_enabled, schedule_alerts_enabled, support_alerts_enabled, system_alerts_enabled, email_fallback_enabled')
    .in('profile_id', ids)

  if (error) {
    ids.forEach((id) => preferences.set(id, defaultPreferences(id, false)))
    return preferences
  }

  for (const row of (data || []) as PreferenceRow[]) {
    const profileId = row.profile_id?.trim()
    if (profileId) preferences.set(profileId, toPreferences(row, profileId))
  }

  return preferences
}

export async function saveInternalNotificationPreferences(
  profileId: string,
  patch: InternalNotificationPreferencePatch,
) {
  const normalizedProfileId = profileId.trim()
  if (!normalizedProfileId) throw new Error('Sign in to update notification preferences.')

  const { data, error } = await supabase
    .from('internal_notification_preferences')
    .upsert(toPreferencePatch(normalizedProfileId, patch), { onConflict: 'profile_id' })
    .select('profile_id, message_alerts_enabled, schedule_alerts_enabled, support_alerts_enabled, system_alerts_enabled, email_fallback_enabled')
    .single()

  if (error) throw new Error(error.message)
  return toPreferences(data as PreferenceRow, normalizedProfileId)
}
