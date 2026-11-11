import assert from 'node:assert/strict'

const purpose = '<key>NSLocationWhenInUseUsageDescription</key><string>TenAceIQ uses your approximate location when you ask to find tennis courts near you.</string>'
const reduced = '<key>NSLocationDefaultAccuracyReduced</key><true/>'

export function courtLocationPrivacyPlist(source, enabled) {
 const result = source.replace(purpose+'\n','').replace(reduced+'\n','')
 if(!enabled)return result
 assert.doesNotMatch(result, /<key>NSLocation[^<]*<\/key>/, 'Review existing location permissions before preparing the court pilot')
 const end = result.lastIndexOf('</dict>')
 assert.ok(end >= 0 && /^<\/dict>\s*<\/plist>\s*$/.test(result.slice(end)), 'Expected a root plist dictionary')
 return result.slice(0,end)+purpose+'\n'+reduced+'\n'+result.slice(end)
}
