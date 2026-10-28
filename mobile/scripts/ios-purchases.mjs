import assert from 'node:assert/strict'
export function iosPurchaseSources(project,storyboard){
 const file='TenAceIQPurchases.swift',ref='715100012026102800000001',build='715100012026102800000002'
 if(!project.includes(file)){
  for(const marker of ['/* Begin PBXBuildFile section */','/* Begin PBXFileReference section */','504EC3061FED79650016851F /* App */ = {','504EC3001FED79650016851F /* Sources */ = {'])assert.equal(project.split(marker).length,2,'Unknown iOS template; review before adding StoreKit')
  project=project.replace('/* Begin PBXBuildFile section */',`/* Begin PBXBuildFile section */
		${build} /* ${file} in Sources */ = {isa = PBXBuildFile; fileRef = ${ref} /* ${file} */; };`)
  project=project.replace('/* Begin PBXFileReference section */',`/* Begin PBXFileReference section */
		${ref} /* ${file} */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ${file}; sourceTree = "<group>"; };`)
  project=project.replace(/(504EC3061FED79650016851F \/\* App \*\/ = \{\s+isa = PBXGroup;\s+children = \()/,`$1
				${ref} /* ${file} */,`)
  project=project.replace(/(504EC3001FED79650016851F \/\* Sources \*\/ = \{\s+isa = PBXSourcesBuildPhase;[\s\S]*?files = \()/,`$1
				${build} /* ${file} in Sources */,`)
 }
 assert.equal((project.match(new RegExp(build+' /\\* '+file.replace('.','\\.')+' in Sources \\*/','g'))||[]).length,2,'StoreKit source registration differs')
 assert.equal(project.split(ref).length,4,'StoreKit file registration differs')
 if(!storyboard.includes('customClass="TenAceIQBridgeViewController"')){
  assert.equal(storyboard.split('customClass="CAPBridgeViewController" customModule="Capacitor"').length,2,'Unknown bridge controller; review before replacing')
  storyboard=storyboard.replace('customClass="CAPBridgeViewController" customModule="Capacitor"','customClass="TenAceIQBridgeViewController" customModule="App" customModuleProvider="target"')
 }
 assert.equal(storyboard.split('customClass="TenAceIQBridgeViewController" customModule="App" customModuleProvider="target"').length,2,'StoreKit controller registration differs')
 return {project,storyboard}
}
