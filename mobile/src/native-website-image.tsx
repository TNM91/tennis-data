import type {ImgHTMLAttributes} from 'react'
type Props=ImgHTMLAttributes<HTMLImageElement>&{fill?:boolean;priority?:boolean;unoptimized?:boolean;quality?:number;placeholder?:string;blurDataURL?:string}
export default function NativeWebsiteImage({fill,priority,unoptimized,quality,placeholder,blurDataURL,style,alt='',...props}:Props){
 void unoptimized;void quality;void placeholder;void blurDataURL
 // eslint-disable-next-line @next/next/no-img-element
 return <img {...props} alt={alt} loading={priority?'eager':props.loading??'lazy'} style={{...(fill?{position:'absolute',height:'100%',width:'100%',inset:0}:{}),...style}}/>
}
