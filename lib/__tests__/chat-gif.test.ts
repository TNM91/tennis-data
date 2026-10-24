import {describe,it,expect} from 'vitest'
import sharp from 'sharp'
import {inspectChatGif} from '../chat-gif'
describe('GIF container limits before decode',()=>{
 it('rejects excessive frame counts and decoded canvas work, even when compressed bytes are small',async()=>{
  for(const [width,height,frames] of [[2,2,61],[600,600,45]]){
   const input=Buffer.concat(Array.from({length:frames},(_,i)=>Buffer.alloc(width*height*3,i%2?220:20)))
   const bytes=await sharp(input,{raw:{width,height:height*frames,channels:3,pageHeight:height}}).gif({delay:100,keepDuplicateFrames:true}).toBuffer()
   expect(bytes.length).toBeLessThan(2097152);expect(()=>inspectChatGif(bytes)).toThrow()
  }
 })
})
