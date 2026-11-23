import {useMemo,type AnchorHTMLAttributes} from 'react'

// Local browser fixture only: render the real workbench without account/network access.
export function useAuth(){return {userId:'',authResolved:true,session:null}}
export function useSearchParams(){return useMemo(()=>new URLSearchParams(location.search),[])}
export const supabase={auth:{getSession:async()=>({data:{session:null},error:null})},from:()=>{throw Error('The practice-context fixture must not query account data.')}}
export default function FixtureLink({href,children,...props}:AnchorHTMLAttributes<HTMLAnchorElement>){return <a href={href} {...props}>{children}</a>}
