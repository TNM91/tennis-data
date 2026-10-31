import {fileURLToPath} from 'node:url'
export function nativeWebsiteAdapters(){return {name:'native-website-adapters',setup(build){
 build.onResolve({filter:/^next\/(image|link)$/},args=>({path:fileURLToPath(new URL(args.path==='next/image'?'../src/native-website-image.tsx':'../src/native-website-link.tsx',import.meta.url))}))
}}}
