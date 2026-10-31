import {expect,it} from 'vitest'
import {videoReviewBlob} from '../video-review-bytes'
it('decodes review bytes locally without a fetch, retaining video type',async()=>{const blob=videoReviewBlob('data:video/mp4;base64,'+btoa('synthetic video'));expect(blob.type).toBe('video/mp4');expect(await blob.text()).toBe('synthetic video')})
it('rejects remote URLs, active content and malformed data',()=>{for(const value of ['https://other.invalid/clip.mp4','data:text/html;base64,PHNjcmlwdD4=','data:video/mp4;base64,%%%%','data:video/mp4,abc'])expect(()=>videoReviewBlob(value)).toThrow()})
