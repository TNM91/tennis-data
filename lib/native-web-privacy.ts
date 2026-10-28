export const NATIVE_WEB_PARAMETER = 'tiq_app'
export const NATIVE_WEB_SESSION_KEY = 'tenaceiq-native-web-privacy-v1'

/** Only our HTML pages receive the privacy marker. External and signed API URLs stay exact. */
export function nativeWebUrl(value: string): string {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.port || url.username || url.password ||
        !['www.tenaceiq.com', 'tenaceiq.com'].includes(url.hostname) ||
        url.pathname === '/api' || url.pathname.startsWith('/api/')) return value
    url.searchParams.set(NATIVE_WEB_PARAMETER, 'ios')
    return url.href
  } catch { return value }
}

type PrivacyStorage = Pick<Storage, 'getItem' | 'setItem'>

export function nativeWebPrivacy(search: string, storage: PrivacyStorage): boolean {
  if (new URLSearchParams(search).get(NATIVE_WEB_PARAMETER) === 'ios') return true
  try { return storage.getItem(NATIVE_WEB_SESSION_KEY) === '1' }
  catch { return true }
}

export function rememberNativeWebPrivacy(search: string, storage: PrivacyStorage): boolean {
  const privateVisit = nativeWebPrivacy(search, storage)
  if (privateVisit) {
    try { storage.setItem(NATIVE_WEB_SESSION_KEY, '1') }
    catch { /* The caller also keeps this document private when storage is unavailable. */ }
  }
  return privateVisit
}
