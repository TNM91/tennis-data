// Review files carry video bytes, never a fetchable URL. Decode bounded chunks locally.
export function videoReviewBlob(dataUrl:string,fallbackType='video/webm'){
 const comma=dataUrl.indexOf(','),header=dataUrl.slice(0,comma)
 if(comma<0||!/^data:video\/(mp4|webm|quicktime|x-m4v)(?:;[^,]*)?;base64$/i.test(header))throw Error('Choose a video review file')
 const type=header.slice(5).split(';')[0]||fallbackType,raw=dataUrl.slice(comma+1)
 if(raw.length>700*1024*1024||raw.length%4!==0||/[^A-Za-z0-9+/=]/.test(raw))throw Error('Use a smaller supported review file')
 const parts:Uint8Array<ArrayBuffer>[]=[]
 for(let offset=0;offset<raw.length;offset+=1048576){const bytes=atob(raw.slice(offset,offset+1048576)),part=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)part[i]=bytes.charCodeAt(i);parts.push(part)}
 return new Blob(parts,{type})
}
