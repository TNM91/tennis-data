'use client'
import {createContext,useContext,type ComponentProps,type ReactNode} from 'react'
import NextImage from 'next/image'
import NextLink from 'next/link'
import type {TacticalScenarioSummary} from '@/lib/tactical/scenarioStorage'
import type {TacticalScenario} from '@/lib/tactical/types'

export type TacticalStudioPlatform={
 current:()=>boolean
 initialDraft:TacticalScenario|null
 initialLibrary:TacticalScenario[]
 change:(scenario:TacticalScenario)=>void
 loaded:(scenario:TacticalScenario)=>void
 saveDraft:(scenario:TacticalScenario)=>Promise<void>
 saveLocal:(scenarios:TacticalScenario[])=>Promise<void>
 loadCloud:()=>Promise<TacticalScenarioSummary[]>
 saveCloud:(scenario:TacticalScenario)=>Promise<TacticalScenarioSummary[]>
 deleteCloud:(id:string)=>Promise<TacticalScenarioSummary[]>
 copy:(text:string)=>Promise<void>
 share:(title:string,text:string)=>Promise<void>
 exportFile:(blob:Blob,name:string)=>Promise<void>
 navigate:(href:string)=>void
}
export const TacticalStudioPlatformContext=createContext<TacticalStudioPlatform|null>(null)
export const useTacticalStudioPlatform=()=>useContext(TacticalStudioPlatformContext)
export function StudioImage(props:ComponentProps<typeof NextImage>){
 const platform=useTacticalStudioPlatform()
 if(!platform)return <NextImage {...props}/>
 const {fill,priority,sizes,src,alt,width,height,className,draggable,style,onLoad}=props
 if(typeof src!=='string')throw Error('Use the approved bundled tactical artwork')
 // The app uses the same supplied PNG bytes; no remote image optimizer is involved.
 // eslint-disable-next-line @next/next/no-img-element
 return <img src={src} alt={alt} width={fill?undefined:Number(width)} height={fill?undefined:Number(height)} className={className} draggable={draggable} sizes={sizes} loading={priority?'eager':'lazy'} onLoad={onLoad} style={{...(fill?{position:'absolute',height:'100%',width:'100%',inset:0}:{}),...style}}/>
}
export function StudioLink({href,children,className}: {href:string;children:ReactNode;className?:string}){
 const platform=useTacticalStudioPlatform()
 return platform?<button type="button" className={className} onClick={()=>platform.navigate(href)}>{children}</button>:<NextLink href={href} className={className}>{children}</NextLink>
}
