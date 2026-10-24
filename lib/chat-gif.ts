/** Inspect the bounded GIF container before any browser/native image decoding. */
export const maxChatGifBytes=2*1024*1024
export function inspectChatGif(bytes:Uint8Array){
 const fail=()=>{throw Error('Choose a GIF up to 2 MB, 1024 pixels wide or tall, 60 frames and 30 seconds.')}
 if(bytes.length<14 || bytes.length>maxChatGifBytes)return fail()
 const signature=String.fromCharCode(...bytes.subarray(0,6));if(!['GIF87a','GIF89a'].includes(signature))return fail()
 const word=(at:number)=>bytes[at]+256*bytes[at+1],width=word(6),height=word(8)
 if(!width || !height || width>1024 || height>1024)return fail()
 let at=13+(bytes[10]&128?3*(2**((bytes[10]&7)+1)):0),frames=0,duration=0,delay=100,ended=false
 const skipBlocks=()=>{while(at<bytes.length){const size=bytes[at++];if(!size)return;if(at+size>bytes.length)return fail();at+=size}return fail()}
 while(at<bytes.length){
  const kind=bytes[at++]
  if(kind===0x3b){ended=true;break}
  if(kind===0x21){
   const label=bytes[at++]
   if(label===0xf9){if(at+6>bytes.length || bytes[at]!==4 || bytes[at+5]!==0)return fail();delay=Math.max(40,word(at+2)*10);at+=6}
   else if(label===0xfe || label===0xff)skipBlocks()
   else return fail()
  }else if(kind===0x2c){
   if(at+9>bytes.length)return fail()
   const left=word(at),top=word(at+2),w=word(at+4),h=word(at+6),flags=bytes[at+8];at+=9
   if(!w || !h || left+w>width || top+h>height)return fail()
   if(flags&128)at+=3*(2**((flags&7)+1))
   if(at>=bytes.length || bytes[at]<2 || bytes[at]>8)return fail();at++;skipBlocks()
   frames++;duration+=delay;delay=100
   if(frames>60 || width*height*frames>16000000 || duration>30000)return fail()
  }else return fail()
 }
 if(!ended || at!==bytes.length || frames<1)return fail()
 return {width,height,frames,duration}
}
