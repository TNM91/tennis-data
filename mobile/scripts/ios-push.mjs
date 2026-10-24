import assert from 'node:assert/strict'
export const pushEntitlements = environment => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>aps-environment</key><string>${environment}</string></dict></plist>
`
export function iosPushSources(project,delegate){
 const marker='    // TenAceIQ APNs registration bridge'
 if(!delegate.includes(marker)){
  assert.doesNotMatch(delegate,/didRegisterForRemoteNotificationsWithDeviceToken|didFailToRegisterForRemoteNotificationsWithError/,'Review an existing APNs bridge')
  assert.match(delegate,/class AppDelegate:/)
  assert.ok(delegate.trimEnd().endsWith('}'))
  const last=delegate.lastIndexOf('}')
  delegate=delegate.slice(0,last)+`${marker}
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
`+delegate.slice(last)
 }
 if(!project.includes('CODE_SIGN_ENTITLEMENTS')){
  assert.equal((project.match(/INFOPLIST_FILE = App\/Info.plist;/g) || []).length,2)
  project=project.replaceAll('INFOPLIST_FILE = App/Info.plist;','INFOPLIST_FILE = App/Info.plist;\n\t\t\t\tCODE_SIGN_ENTITLEMENTS = App/Push.entitlements;')
 }
 assert.equal((project.match(/CODE_SIGN_ENTITLEMENTS = App\/Push.entitlements;/g) || []).length,2)
 return {project,delegate}
}
