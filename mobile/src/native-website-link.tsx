import {useState,type ReactNode} from 'react'
export default function NativeWebsiteLink({href,children,className}: {href:string;children:ReactNode;className?:string}){
 const [failed,setFailed]=useState(false)
 const open=()=>{const event=new CustomEvent('tenaceiq:navigate',{detail:{href},cancelable:true});document.dispatchEvent(event);setFailed(!event.defaultPrevented)}
 return <><button type="button" className={className} onClick={open}>{children}</button>{failed?<span role="status">This tool could not be opened. Return to Coach tools and try again.</span>:null}</>
}
