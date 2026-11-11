import assert from 'node:assert/strict'
import test from 'node:test'
import {courtLocationPrivacyPlist} from './ios-court-location.mjs'

test('the court pilot adds only an approximate foreground purpose and can switch profiles',()=>{
 const base='<plist><dict>\n<key>CFBundleDisplayName</key><string>TenAceIQ</string>\n</dict>\n</plist>\n'
 const enabled=courtLocationPrivacyPlist(base,true)
 assert.match(enabled,/<key>NSLocationWhenInUseUsageDescription<\/key><string>[^<]+tennis courts[^<]+<\/string>/)
 assert.match(enabled,/<key>NSLocationDefaultAccuracyReduced<\/key><true\/>/)
 assert.doesNotMatch(enabled,/NSLocationAlways|UIBackgroundModes/)
 assert.equal(courtLocationPrivacyPlist(enabled,true),enabled)
 assert.equal(courtLocationPrivacyPlist(enabled,false),base)
 assert.throws(()=>courtLocationPrivacyPlist(base.replace('</dict>','<key>NSLocationAlwaysUsageDescription</key><string>Existing</string></dict>'),true))
})
