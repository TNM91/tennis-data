import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {}
  return Object.fromEntries(
    readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([^#=]+)=(.*)$/))
      .filter(Boolean)
      .map((match) => [match[1].trim(), match[2].trim().replace(/^['"]|['"]$/g, '')]),
  )
}

function readSupabaseConstants() {
  const source = readFileSync(path.join(process.cwd(), 'lib', 'supabase.ts'), 'utf8')
  return {
    url: source.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/)?.[1] || '',
    key: source.match(/supabaseKey\s*=\s*['"]([^'"]+)['"]/)?.[1] || '',
  }
}

function requireValue(env, key) {
  const value = env[key]?.trim()
  if (!value) throw new Error(`Missing ${key}.`)
  return value
}

function formatError(error) {
  return [error?.code, error?.message].filter(Boolean).join(' ')
}

async function assertQuery(label, query) {
  const { error } = await query
  if (error) throw new Error(`${label}: ${formatError(error)}`)
}

async function main() {
  const env = {
    ...readEnvFile(path.join(process.cwd(), '.env')),
    ...readEnvFile(path.join(process.cwd(), '.env.local')),
    ...process.env,
  }
  const constants = readSupabaseConstants()
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || constants.url
  const publicKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || constants.key
  const serviceRoleKey = requireValue(env, 'SUPABASE_SERVICE_ROLE_KEY')
  const email = requireValue(env, 'TENACEIQ_QA_FREE_EMAIL')
  const password = requireValue(env, 'TENACEIQ_QA_FREE_PASSWORD')

  if (!supabaseUrl || !publicKey) throw new Error('Missing the Supabase URL or public key.')

  const client = createClient(supabaseUrl, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const authResult = await client.auth.signInWithPassword({ email, password })
  if (authResult.error || !authResult.data.user) {
    throw new Error(`QA sign-in failed: ${formatError(authResult.error)}`)
  }

  const userId = authResult.data.user.id
  let conversationId = ''

  try {
    const conversationResult = await client
      .from('internal_conversations')
      .insert({
        conversation_type: 'support',
        subject: 'RLS recursion smoke',
        status: 'waiting_on_admin',
        created_by_user_id: userId,
        related_entity_type: 'system',
        related_entity_id: 'rls-smoke',
        metadata: { source: 'automated-rls-smoke' },
      })
      .select('id')
      .single()
    if (conversationResult.error || !conversationResult.data) {
      throw new Error(`create support conversation: ${formatError(conversationResult.error)}`)
    }
    conversationId = conversationResult.data.id

    await assertQuery(
      'add support participant',
      client.from('internal_conversation_participants').insert({
        conversation_id: conversationId,
        profile_id: userId,
        participant_role: 'member',
      }),
    )

    const messageResult = await client
      .from('internal_messages')
      .insert({
        conversation_id: conversationId,
        sender_user_id: userId,
        body: 'Temporary production smoke message.',
        message_kind: 'message',
      })
      .select('id')
      .single()
    if (messageResult.error || !messageResult.data) {
      throw new Error(`create support message: ${formatError(messageResult.error)}`)
    }

    const scheduleResult = await client
      .from('internal_schedule_events')
      .insert({
        conversation_id: conversationId,
        event_type: 'captain_practice',
        title: 'RLS recursion smoke',
        scheduled_date: new Date().toISOString().slice(0, 10),
        created_by_user_id: userId,
      })
      .select('id')
      .single()
    if (scheduleResult.error || !scheduleResult.data) {
      throw new Error(`create schedule event: ${formatError(scheduleResult.error)}`)
    }

    await assertQuery(
      'create schedule response',
      client.from('internal_schedule_event_responses').insert({
        event_id: scheduleResult.data.id,
        profile_id: userId,
        response_status: 'in',
      }),
    )

    await assertQuery(
      'create linked notification',
      client.from('internal_notifications').insert({
        recipient_profile_id: userId,
        actor_user_id: userId,
        notification_type: 'support',
        title: 'RLS recursion smoke',
        body: 'Temporary production smoke notification.',
        href: `/messages?thread=${conversationId}`,
        conversation_id: conversationId,
      }),
    )

    const protectedReads = [
      ['conversations', client.from('internal_conversations').select('id').eq('id', conversationId)],
      ['participants', client.from('internal_conversation_participants').select('conversation_id').eq('conversation_id', conversationId)],
      ['messages', client.from('internal_messages').select('id').eq('conversation_id', conversationId)],
      ['schedule events', client.from('internal_schedule_events').select('id').eq('conversation_id', conversationId)],
      ['schedule responses', client.from('internal_schedule_event_responses').select('event_id').eq('event_id', scheduleResult.data.id)],
      ['notifications', client.from('internal_notifications').select('id').eq('conversation_id', conversationId)],
      ['notification preferences', client.from('internal_notification_preferences').select('profile_id').eq('profile_id', userId)],
      ['Team Room match replies', client.from('team_room_message_responses').select('id').eq('conversation_id', conversationId)],
      ['Team Room lineup acknowledgments', client.from('team_room_lineup_acknowledgments').select('id').eq('conversation_id', conversationId)],
      ['Team Room reminders', client.from('team_room_reminder_schedules').select('id').eq('conversation_id', conversationId)],
      ['Team Room member preferences', client.from('team_room_member_preferences').select('conversation_id').eq('conversation_id', conversationId)],
      ['Team Room reactions', client.from('team_room_message_reactions').select('conversation_id').eq('conversation_id', conversationId)],
    ]
    for (const [label, query] of protectedReads) await assertQuery(`read ${label}`, query)

    await assertQuery(
      'update participant read state',
      client
        .from('internal_conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('profile_id', userId),
    )

    console.log(`Internal messaging RLS smoke passed (${protectedReads.length} protected reads plus support write flow).`)
  } finally {
    if (conversationId) {
      const cleanup = await serviceClient.from('internal_conversations').delete().eq('id', conversationId)
      if (cleanup.error) throw new Error(`cleanup support conversation: ${formatError(cleanup.error)}`)
      const verification = await serviceClient.from('internal_conversations').select('id').eq('id', conversationId).maybeSingle()
      if (verification.error || verification.data) throw new Error('Temporary support conversation cleanup could not be verified.')
      console.log('Temporary support smoke data removed.')
    }
    await client.auth.signOut()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Internal messaging RLS smoke failed.')
  process.exitCode = 1
})
