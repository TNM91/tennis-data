import {expect,it,vi} from 'vitest'
import {renderToString} from 'react-dom/server'
import React from 'react'
vi.mock('@/app/components/auth-provider',async()=>{const React=await import('react');const Context=React.createContext<{userId:string}|null>(null);return {AuthProvider:({children}:{children:React.ReactNode})=>React.createElement(Context.Provider,{value:{userId:'synthetic-admin'}},children),useAuth:()=>{const value=React.useContext(Context);if(!value)throw Error('Missing AuthProvider');return value}}})
vi.mock('@/app/components/site-shell',async()=>{const React=await import('react');const {AuthProvider}=await import('@/app/components/auth-provider');return {default:({children}:{children:React.ReactNode})=>React.createElement(AuthProvider,null,React.createElement('main',null,children))}})
vi.mock('@/app/components/admin-gate',()=>({default:({children}:{children:React.ReactNode})=>children}))
vi.mock('@/lib/supabase',()=>({supabase:{auth:{getSession:()=>{throw Error('No Auth request during prerender')}}}}))
import Page from '../../app/admin/account-deletions/page'
it('renders account context below the shell provider without loading private requests or nesting main landmarks',()=>{const output=renderToString(<Page/>);expect(output).toContain('Account deletion requests');expect(output).toContain('Load deletion requests');expect(output.match(/<main/g)).toHaveLength(1);expect(output).not.toContain('synthetic-admin')})
