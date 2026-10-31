import assert from 'node:assert/strict'
export const faceIDPurpose='Use Face ID to sign in to TenAceIQ with the account you save on this iPhone.'
const retiredPurpose='Unlock TenAceIQ on this iPhone while keeping your signed-in account private.'
export function appLockPrivacyPlist(source){
 const key='<key>NSFaceIDUsageDescription</key>'
 let result=source.replace(/<key>NSFaceIDUsageDescription<\/key>\s*<string>([^<]*)<\/string>\s*/g,(_match,prior)=>{assert.ok([faceIDPurpose,retiredPurpose].includes(prior),'Review custom Face ID purpose before replacing it');return ''})
 assert.ok(!result.includes(key),'Unexpected Face ID purpose value')
 const end=result.lastIndexOf('</dict>')
 assert.ok(end>=0&&/^<\/dict>\s*<\/plist>\s*$/.test(result.slice(end)),'Expected a root plist dictionary')
 result=result.slice(0,end)+`${key}<string>${faceIDPurpose}</string>\n`+result.slice(end)
 return result
}

export function appLockPrivacyResource(project){
 const file='PrivacyInfo.xcprivacy',ref='715100012026103000000011',build='715100012026103000000012'
 if(!project.includes(file)){
  for(const marker of ['/* Begin PBXBuildFile section */','/* Begin PBXFileReference section */','504EC3061FED79650016851F /* App */ = {'])assert.equal(project.split(marker).length,2,'Review unknown app resource template')
  assert.equal((project.match(/isa = PBXResourcesBuildPhase;/g)||[]).length,1,'Review multiple resource targets')
  project=project.replace('/* Begin PBXBuildFile section */',`/* Begin PBXBuildFile section */\n\t\t${build} /* ${file} in Resources */ = {isa = PBXBuildFile; fileRef = ${ref} /* ${file} */; };`)
  project=project.replace('/* Begin PBXFileReference section */',`/* Begin PBXFileReference section */\n\t\t${ref} /* ${file} */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = ${file}; sourceTree = "<group>"; };`)
  project=project.replace(/(504EC3061FED79650016851F \/\* App \*\/ = \{\s+isa = PBXGroup;\s+children = \()/,`$1\n\t\t\t\t${ref} /* ${file} */,`)
  project=project.replace(/(isa = PBXResourcesBuildPhase;[\s\S]*?files = \()/,`$1\n\t\t\t\t${build} /* ${file} in Resources */,`)
 }
 assert.equal(project.split(ref).length,4,'Review privacy manifest file registration')
 assert.equal(project.split(build).length,3,'Review privacy manifest resource registration')
 return project
}
