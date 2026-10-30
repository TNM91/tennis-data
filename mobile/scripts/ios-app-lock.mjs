import assert from 'node:assert/strict'
export const faceIDPurpose='Unlock TenAceIQ on this iPhone while keeping your signed-in account private.'
export function appLockPrivacyPlist(source){
 const key='<key>NSFaceIDUsageDescription</key>'
 let result=source.replace(/<key>NSFaceIDUsageDescription<\/key>\s*<string>([^<]*)<\/string>\s*/g,(_match,prior)=>{assert.equal(prior,faceIDPurpose,'Review custom Face ID purpose before replacing it');return ''})
 assert.ok(!result.includes(key),'Unexpected Face ID purpose value')
 const end=result.lastIndexOf('</dict>')
 assert.ok(end>=0&&/^<\/dict>\s*<\/plist>\s*$/.test(result.slice(end)),'Expected a root plist dictionary')
 result=result.slice(0,end)+`${key}<string>${faceIDPurpose}</string>\n`+result.slice(end)
 return result
}
