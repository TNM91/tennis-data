import {fileURLToPath} from 'node:url'
import {resolve} from 'node:path'

export function nativeMembershipAdapter(android){
 return {name:'native-membership-platform',setup(builder){
  builder.onResolve({filter:/^\.\/store-memberships$/},args=>android&&resolve(args.resolveDir)===fileURLToPath(new URL('../src/',import.meta.url)).replace(/[\\/]$/,'')?{path:fileURLToPath(new URL('../src/store-memberships-android.ts',import.meta.url))}:null)
 }}
}
