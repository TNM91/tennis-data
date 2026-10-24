import {describe,it,expect} from 'vitest'
import {gifBucketSettings} from '../../scripts/team-room-gif-storage.mjs'
const bucket={id:'team-room-files',public:false,file_size_limit:10485760,allowed_mime_types:['image/jpeg','image/png','image/webp','application/pdf']}
describe('narrow private GIF bucket update',()=>{
 it('adds only GIF while keeping every existing MIME, private access and the existing byte limit',()=>{
  const result=gifBucketSettings(bucket);expect(result).toEqual({public:false,fileSizeLimit:10485760,allowedMimeTypes:[...bucket.allowed_mime_types,'image/gif']});expect(bucket.allowed_mime_types).not.toContain('image/gif');expect(gifBucketSettings({...bucket,allowed_mime_types:result.allowedMimeTypes})).toEqual(result)
 })
 it('refuses unexpected access, size, wildcard, removed or extra MIME changes',()=>{
  for(const patch of [{public:true},{id:'another-bucket'},{file_size_limit:20971520},{allowed_mime_types:['image/*']},{allowed_mime_types:[...bucket.allowed_mime_types,'video/mp4']},{allowed_mime_types:null}])expect(()=>gifBucketSettings({...bucket,...patch})).toThrow('settings changed')
 })
})
