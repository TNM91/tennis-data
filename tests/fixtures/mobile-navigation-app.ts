const handlers=new Map<string,(event:{url:string})=>void>()
export const App={
 addListener:async(name:string,fn:(event:{url:string})=>void)=>{handlers.set(name,fn);return {remove:async()=>{handlers.delete(name)}}},
 getLaunchUrl:async()=>{const url=new URL(location.href).searchParams.get('link');return url?{url}:undefined},
 minimizeApp:async()=>{},getInfo:async()=>({version:'1.0',build:'190'}),
}
export const openSyntheticLink=(url:string)=>handlers.get('appUrlOpen')?.({url})
