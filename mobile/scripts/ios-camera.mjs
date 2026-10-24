import assert from 'node:assert/strict'
export const cameraPurposeStrings={NSCameraUsageDescription:'Take a photo to share with your tennis team.',NSPhotoLibraryUsageDescription:'Choose a photo to share with your tennis team.',NSPhotoLibraryAddUsageDescription:'Save a team photo only when you choose to.'}
export function cameraPrivacyPlist(source){
 let result=source
 for(const [key,value] of Object.entries(cameraPurposeStrings)){
  result=result.replace(new RegExp('<key>'+key+'</key>\\s*<string>([^<]*)</string>\\s*','g'),(_match,prior)=>{assert.equal(prior,value,'Review custom camera purpose text before replacing it');return ''})
  assert.ok(!result.includes('<key>'+key+'</key>'),'Unexpected camera purpose value')
 }
 const end=result.lastIndexOf('</dict>')
 assert.ok(end>=0 && /^<\/dict>\s*<\/plist>\s*$/.test(result.slice(end)),'Expected a root plist dictionary')
 const entries=Object.entries(cameraPurposeStrings).map(([key,value])=>'<key>'+key+'</key><string>'+value+'</string>').join('\n')+'\n'
 return result.slice(0,end)+entries+result.slice(end)
}
