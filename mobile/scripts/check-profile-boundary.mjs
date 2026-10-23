import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const config = await readFile(new URL('../../lib/supabase-public-config.ts', import.meta.url), 'utf8')
const url = config.match(/supabaseUrl = '([^']+)'/)[1]
const key = config.match(/supabaseKey = '([^']+)'/)[1]
const client = createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}})
const anonymous = await client.from('profiles').select('linked_player_name').limit(1)
assert.ok(anonymous.error || anonymous.data?.length === 0, 'Anonymous profiles must not be readable')
const {data, error} = await client.auth.signInWithPassword({
  email: process.env.TENACEIQ_QA_FREE_EMAIL, password: process.env.TENACEIQ_QA_FREE_PASSWORD,
})
assert.ok(!error && data.user, 'Synthetic QA sign-in failed')
try {
  const own = await client.from('profiles').select('linked_player_name').eq('id', data.user.id).maybeSingle()
  assert.ok(!own.error && own.data, 'Own profile should be readable')
  const other = await client.from('profiles').select('linked_player_name').neq('id', data.user.id).limit(1)
  assert.ok(other.error || other.data?.length === 0, 'Other account profiles must not be readable')
  console.log('Profile boundary passed: anonymous denied, own readable, other accounts denied.')
} finally { await client.auth.signOut({scope: 'local'}) }
