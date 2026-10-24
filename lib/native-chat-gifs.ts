import sharp from 'sharp'
import {createHash} from 'node:crypto'
import {inspectChatGif,maxChatGifBytes} from './chat-gif'
export async function normalizeChatGif(value:unknown){
 if(typeof value!=='string' || value.length>Math.ceil(maxChatGifBytes/3)*4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value))throw Error('Choose a GIF up to 2 MB.')
 const input=Buffer.from(value,'base64');if(input.toString('base64')!==value)throw Error('Invalid GIF.')
 inspectChatGif(input)
 // Re-encode every frame, removing comments/metadata while preserving timing and looping.
 const image=sharp(input,{animated:true,limitInputPixels:16000000}),metadata=await image.metadata()
 const bytes=await image.timeout({seconds:5}).gif({effort:3,loop:metadata.loop || 0,delay:metadata.delay?.map(delay=>Math.max(40,delay))}).toBuffer()
 inspectChatGif(bytes)
 return {bytes,sha256:createHash('sha256').update(bytes).digest('hex')}
}
