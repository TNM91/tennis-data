import test from 'node:test'
import assert from 'node:assert/strict'
import {iosPushSources,pushEntitlements} from './ios-push.mjs'
test('APNs bridge and signing entitlements are idempotent and refuse unknown templates',()=>{
 const project='INFOPLIST_FILE = App/Info.plist;\n'.repeat(2),delegate='import UIKit\nimport Capacitor\nclass AppDelegate: UIResponder, UIApplicationDelegate {\n}\n'
 const first=iosPushSources(project,delegate)
 assert.deepEqual(iosPushSources(first.project,first.delegate),first)
 assert.match(first.delegate,/capacitorDidRegisterForRemoteNotifications/)
 assert.match(first.delegate,/capacitorDidFailToRegisterForRemoteNotifications/)
 assert.match(pushEntitlements('production'),/<string>production<\/string>/)
 assert.throws(()=>iosPushSources('unknown',delegate))
 assert.throws(()=>iosPushSources(project,delegate.replace('class AppDelegate:', 'class Unknown:')))
})
