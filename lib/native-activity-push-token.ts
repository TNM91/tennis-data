/** The provider prefix keeps FCM registrations separate from existing APNs tokens. */
export const nativePushPlatformHeader = 'X-TenAceIQ-Push-Platform'
export function androidPushToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9:_-]{20,2048}$/.test(value)
}

export function nativeActivityPushToken(value: unknown): value is string {
  return typeof value === 'string' && (/^[a-f0-9]{64,256}$/.test(value) ||
    value.startsWith('fcm:') && androidPushToken(value.slice(4)))
}
