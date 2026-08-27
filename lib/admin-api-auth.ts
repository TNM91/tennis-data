import { createClient } from '@supabase/supabase-js'
import { cacheServerAccountRole, readCachedServerAccountRole } from '@/lib/server-account-role-cache'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export async function getAdminApiAuth(request: Request) {
  const token = getBearerToken(request)
  if (!token) return adminAuthFailure(401, 'Admin sign-in required.')

  const requester = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  // This remains a verified token check. `getClaims` avoids a second remote
  // Auth lookup on every Admin status refresh, which was blocking the actual
  // operational read during a database-heavy import.
  const { data: claimData, error: claimError } = await requester.auth.getClaims(token)
  const userId = typeof claimData?.claims.sub === 'string' ? claimData.claims.sub : ''
  if (claimError || !userId) return adminAuthFailure(401, 'Admin sign-in required.')

  const cachedRole = await readCachedServerAccountRole(userId)
  if (cachedRole !== 'admin') {
    const { data: profile, error: profileError } = await requester
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()
    if (profileError) return adminAuthFailure(500, 'Admin access could not be checked.')
    if ((profile as { role?: string } | null)?.role !== 'admin') {
      return adminAuthFailure(403, 'Admin access required.')
    }
    void cacheServerAccountRole(userId, 'admin')
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) return adminAuthFailure(503, 'Admin club tools are not configured yet.')

  return {
    ok: true as const,
    userId,
    service: createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  }
}

function adminAuthFailure(status: number, message: string) {
  return {
    ok: false as const,
    response: Response.json({ ok: false, message }, { status }),
  }
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}
