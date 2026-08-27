import 'server-only'

import { getCache } from '@vercel/functions'
import { normalizeUserRole, type UserRole } from '@/lib/roles'

const ACCOUNT_ROLE_CACHE_TTL_SECONDS = 300

type CachedAccountRole = {
  role?: unknown
}

function getAccountRoleCache() {
  return getCache({ namespace: 'account-role' })
}

function getAccountRoleCacheKey(userId: string) {
  return `role:${userId}`
}

/**
 * Server routes still verify every JWT before calling this cache. The cache
 * only avoids repeating the same indexed profile role read during a short
 * mobile navigation session; it is never a substitute for authentication.
 */
export async function readCachedServerAccountRole(userId: string): Promise<UserRole | null> {
  try {
    const cached = await getAccountRoleCache().get(getAccountRoleCacheKey(userId)) as CachedAccountRole | undefined
    if (!cached) return null
    const role = normalizeUserRole(cached.role)
    return role === 'public' ? null : role
  } catch {
    return null
  }
}

export async function cacheServerAccountRole(userId: string, role: UserRole) {
  try {
    await getAccountRoleCache().set(getAccountRoleCacheKey(userId), { role }, {
      ttl: ACCOUNT_ROLE_CACHE_TTL_SECONDS,
      tags: [`account-role:${userId}`],
      name: 'account-role',
    })
  } catch {
    // A cache miss only costs an indexed profile read; access remains safe.
  }
}
