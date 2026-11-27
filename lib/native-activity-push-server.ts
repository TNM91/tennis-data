import 'server-only'
import {androidPushConfiguration,deliverAndroidNotification} from './android-push-server'
import {nativeActivityPushToken} from './native-activity-push-token'
import {deliverAppleNotifications,nativePushConfiguration} from './native-chat-push-server'

export function nativeActivityPushConfiguration() {
  const apple = nativePushConfiguration(), android = androidPushConfiguration()
  return apple || android ? {apple,android} : null
}
type Device = {installation_id: string; profile_id: string; device_token: string; updated_at: string}
type Payload = {recipient: string; href: string; aps: {alert: {title: string; body: string}; sound: string}}
type Outcome<T> = {device: T; result: {status: number; reason?: string}; expired: boolean}
export async function deliverActivityNotifications<T extends Device>(requests: {
  device: T; href: string; collapseId: string; expiresAt: number
}[], config: NonNullable<ReturnType<typeof nativeActivityPushConfiguration>>,
payloadFor: (recipient: string,href: string) => Payload): Promise<Outcome<T>[]> {
  if (requests.length > 12 || requests.some(r => !nativeActivityPushToken(r.device.device_token))) throw Error('Invalid activity devices')
  const results: Outcome<T>[] = requests.map(({device}) => ({device,result:{status:503},expired:false}))
  const apple = requests.filter(r => !r.device.device_token.startsWith('fcm:'))
  const android = requests.map((request,index) => ({request,index})).filter(r => r.request.device.device_token.startsWith('fcm:'))
  const appleDelivery = config.apple && apple.length ? deliverAppleNotifications(apple,config.apple,payloadFor).then(outcomes => {
    for (const outcome of outcomes) { const i = requests.findIndex(r => r.device === outcome.device); if (i >= 0) results[i] = outcome }
  }) : Promise.resolve()
  let next = 0
  const deadline = Date.now()+15000
  await Promise.all([appleDelivery,...Array.from({length:config.android ? Math.min(4,android.length) : 0},async () => {
    while (next < android.length && Date.now() < deadline) {
      const {request,index} = android[next++], {device,href,collapseId,expiresAt} = request
      try {
        const result = await deliverAndroidNotification(config.android!,{
          token:device.device_token.slice(4),payload:payloadFor(device.profile_id,href),collapseId,expiresAt,
        })
        results[index] = {device,result,expired:result.status === 410}
      } catch { /* Leave the bounded attempt retryable without exposing the token. */ }
    }
  })])
  return results
}
