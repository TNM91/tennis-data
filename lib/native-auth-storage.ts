import { Capacitor } from '@capacitor/core'
import type { SupportedStorage } from '@supabase/auth-js'

/** Browsers retain Supabase's existing storage; native apps use OS-backed encryption. */
export function getNativeAuthStorage(): SupportedStorage | undefined {
  if (!Capacitor.isNativePlatform()) return undefined

  let ready: Promise<{ storage: typeof import('@aparajita/capacitor-secure-storage').SecureStorage }> | undefined
  function store() {
    ready ??= (async () => {
      const { SecureStorage, KeychainAccess } = await import('@aparajita/capacitor-secure-storage')
      await SecureStorage.setKeyPrefix('tenaceiq-auth_')
      await SecureStorage.setSynchronize(false)
      await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly)
      // Capacitor proxies expose a synthetic `then` method. Wrap the proxy so
      // Promise resolution cannot mistake it for a thenable and stall auth.
      return { storage: SecureStorage }
    })()
    return ready
  }

  // Do not fall back to plaintext browser storage if the native plugin fails.
  return {
    async getItem(key) { return (await store()).storage.getItem(key) },
    async setItem(key, value) { await (await store()).storage.setItem(key, value) },
    async removeItem(key) { await (await store()).storage.removeItem(key) },
  }
}
