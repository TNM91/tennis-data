/** Native match writes must target the active, uncompleted plan displayed by the app. */
export function nativeMatchTargetIsCurrent(action:string,requestedId:unknown,currentId:string,metadata:Record<string,unknown>){
 return Boolean(currentId && !metadata.matchCompletedAt && (action==='ack_final_lineup' || typeof requestedId==='string' && requestedId===currentId))
}
