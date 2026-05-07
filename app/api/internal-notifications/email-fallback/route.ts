import { createClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

type NotificationRow = {
  id?: string | null
  recipient_profile_id?: string | null
  actor_user_id?: string | null
  notification_type?: string | null
  conversation_id?: string | null
  href?: string | null
  email_fallback_sent_at?: string | null
}

type PreferenceRow = {
  profile_id?: string | null
  message_alerts_enabled?: boolean | null
  schedule_alerts_enabled?: boolean | null
  support_alerts_enabled?: boolean | null
  system_alerts_enabled?: boolean | null
  email_fallback_enabled?: boolean | null
}

type ProfileRow = {
  role?: string | null
}

const NOTIFICATION_SELECT =
  'id, recipient_profile_id, actor_user_id, notification_type, conversation_id, href, email_fallback_sent_at'
const PREFERENCE_SELECT =
  'profile_id, message_alerts_enabled, schedule_alerts_enabled, support_alerts_enabled, system_alerts_enabled, email_fallback_enabled'

export async function POST(request: Request) {
  const token = getBearerToken(request)
  if (!token) {
    return Response.json({ ok: false, message: 'Sign in to send notification email fallback.' }, { status: 401 })
  }

  const requester = await getRequesterUser(token)
  if (!requester.userId) {
    return Response.json({ ok: false, message: 'Sign in to send notification email fallback.' }, { status: 401 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    return Response.json({ ok: false, message: 'Email fallback needs Supabase service access.' }, { status: 500 })
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim()
  if (!resendApiKey) {
    return Response.json({ ok: false, message: 'Email fallback is not configured yet.' }, { status: 202 })
  }

  const body = await request.json().catch(() => null) as { notificationIds?: unknown } | null
  const notificationIds = Array.isArray(body?.notificationIds)
    ? Array.from(new Set(body.notificationIds.filter((id): id is string => typeof id === 'string').map((id) => id.trim()).filter(Boolean))).slice(0, 20)
    : []

  if (!notificationIds.length) {
    return Response.json({ ok: false, message: 'No notification ids were provided.' }, { status: 400 })
  }

  const supabase = createServiceSupabaseClient(serviceKey)

  const requesterIsAdmin = await isAdmin(supabase, requester.userId)
  const { data, error } = await supabase
    .from('internal_notifications')
    .select(NOTIFICATION_SELECT)
    .in('id', notificationIds)

  if (error) {
    return Response.json({ ok: false, message: error.message }, { status: 500 })
  }

  const notifications = ((data || []) as NotificationRow[]).filter((notification) => {
    if (notification.email_fallback_sent_at) return false
    if (requesterIsAdmin) return true
    return notification.actor_user_id === requester.userId || notification.recipient_profile_id === requester.userId
  })

  if (!notifications.length) return Response.json({ ok: true, sent: 0 })

  const recipientIds = Array.from(
    new Set(notifications.map((notification) => cleanText(notification.recipient_profile_id)).filter(Boolean)),
  )
  const preferenceByProfileId = await loadPreferences(supabase, recipientIds)

  let sent = 0
  for (const notification of notifications) {
    const notificationId = cleanText(notification.id)
    const recipientProfileId = cleanText(notification.recipient_profile_id)
    if (!notificationId || !recipientProfileId) continue

    const preferences = preferenceByProfileId.get(recipientProfileId)
    if (!preferences?.emailFallbackEnabled || !notificationTypeEnabled(preferences, notification.notification_type)) {
      continue
    }

    await supabase
      .from('internal_notifications')
      .update({ email_fallback_requested_at: new Date().toISOString(), email_fallback_error: '' })
      .eq('id', notificationId)

    const { data: recipientResult, error: recipientError } = await supabase.auth.admin.getUserById(recipientProfileId)
    const email = recipientResult?.user?.email?.trim()
    if (recipientError || !email) {
      await recordEmailError(supabase, notificationId, recipientError?.message || 'Recipient email was not available.')
      continue
    }

    const emailResult = await sendFallbackEmail({
      apiKey: resendApiKey,
      to: email,
      href: buildAppHref(request.url, notification.href || notification.conversation_id || ''),
      notificationType: notification.notification_type || 'message',
    })

    if (emailResult.ok) {
      sent += 1
      await supabase
        .from('internal_notifications')
        .update({ email_fallback_sent_at: new Date().toISOString(), email_fallback_error: '' })
        .eq('id', notificationId)
    } else {
      await recordEmailError(supabase, notificationId, emailResult.message)
    }
  }

  return Response.json({ ok: true, sent })
}

async function sendFallbackEmail(input: {
  apiKey: string
  to: string
  href: string
  notificationType: string
}) {
  const from = process.env.TENACEIQ_EMAIL_FROM?.trim() || 'TenAceIQ <notifications@tenaceiq.com>'
  const subject = input.notificationType === 'support'
    ? 'New TenAceIQ support alert'
    : input.notificationType === 'schedule'
      ? 'New TenAceIQ schedule alert'
      : 'New TenAceIQ message'

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject,
      html: [
        '<div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">',
        '<h1 style="font-size:20px">You have a new TenAceIQ alert.</h1>',
        '<p>Open TenAceIQ Messages to view and reply inside the platform.</p>',
        `<p><a href="${escapeAttribute(input.href)}" style="color:#2563eb;font-weight:700">Open Messages</a></p>`,
        '<p style="font-size:12px;color:#64748b">This email does not include message, billing, league, or support details.</p>',
        '</div>',
      ].join(''),
    }),
  })

  if (response.ok) return { ok: true, message: '' }
  const payload = await response.json().catch(() => null) as { message?: string; error?: { message?: string } } | null
  return { ok: false, message: payload?.error?.message || payload?.message || 'Resend could not send the fallback email.' }
}

async function getRequesterUser(token: string) {
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })
  const { data, error } = await supabase.auth.getUser(token)

  if (error) return { userId: undefined }
  return { userId: data.user?.id }
}

function createServiceSupabaseClient(serviceKey: string) {
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

async function isAdmin(supabase: ReturnType<typeof createServiceSupabaseClient>, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  return ((data || null) as ProfileRow | null)?.role === 'admin'
}

async function loadPreferences(supabase: ReturnType<typeof createServiceSupabaseClient>, profileIds: string[]) {
  const preferenceByProfileId = new Map<string, ReturnType<typeof defaultPreferences>>()
  profileIds.forEach((profileId) => preferenceByProfileId.set(profileId, defaultPreferences(profileId)))
  if (!profileIds.length) return preferenceByProfileId

  const { data } = await supabase
    .from('internal_notification_preferences')
    .select(PREFERENCE_SELECT)
    .in('profile_id', profileIds)

  for (const row of (data || []) as PreferenceRow[]) {
    const profileId = cleanText(row.profile_id)
    if (profileId) preferenceByProfileId.set(profileId, toPreferences(row, profileId))
  }

  return preferenceByProfileId
}

async function recordEmailError(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  notificationId: string,
  message: string,
) {
  await supabase
    .from('internal_notifications')
    .update({ email_fallback_error: message.slice(0, 500) })
    .eq('id', notificationId)
}

function defaultPreferences(profileId: string) {
  return {
    profileId,
    messageAlertsEnabled: true,
    scheduleAlertsEnabled: true,
    supportAlertsEnabled: true,
    systemAlertsEnabled: true,
    emailFallbackEnabled: false,
  }
}

function toPreferences(row: PreferenceRow, profileId: string) {
  const defaults = defaultPreferences(profileId)
  return {
    profileId,
    messageAlertsEnabled: row.message_alerts_enabled ?? defaults.messageAlertsEnabled,
    scheduleAlertsEnabled: row.schedule_alerts_enabled ?? defaults.scheduleAlertsEnabled,
    supportAlertsEnabled: row.support_alerts_enabled ?? defaults.supportAlertsEnabled,
    systemAlertsEnabled: row.system_alerts_enabled ?? defaults.systemAlertsEnabled,
    emailFallbackEnabled: row.email_fallback_enabled ?? defaults.emailFallbackEnabled,
  }
}

function notificationTypeEnabled(
  preferences: ReturnType<typeof defaultPreferences>,
  notificationType: string | null | undefined,
) {
  if (notificationType === 'schedule') return preferences.scheduleAlertsEnabled
  if (notificationType === 'support') return preferences.supportAlertsEnabled
  if (notificationType === 'system') return preferences.systemAlertsEnabled
  return preferences.messageAlertsEnabled
}

function buildAppHref(requestUrl: string, href: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
    new URL(requestUrl).origin
  const normalizedHref = href.startsWith('/') ? href : href ? `/messages?thread=${encodeURIComponent(href)}` : '/messages'
  return new URL(normalizedHref, baseUrl).toString()
}

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}

function escapeAttribute(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}
