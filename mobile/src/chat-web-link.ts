/** Shared links never navigate automatically or accept credentials or unsafe schemes. */
export function chatWebLink(value:string){
 if(value.length>2048||/[\\\s\u0000-\u001f\u007f]/.test(value))return null
 try{const url=new URL(value);return url.protocol==='https:'&&!!url.hostname&&!url.username&&!url.password?url.href:null}catch{return null}
}
