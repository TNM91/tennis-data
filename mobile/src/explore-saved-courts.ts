export type SavedCourts={home:string;favorites:string[]}
export type CourtPreference='home'|'favorite'

const storageKey=(owner:string)=>`tiq.explore.saved-courts:${owner}`

export function readSavedCourts(owner?:string):SavedCourts{
 if(owner){
  try{
   const saved=JSON.parse(localStorage.getItem(storageKey(owner))??'null')
   return {
    home:typeof saved?.home==='string'?saved.home:'',
    favorites:Array.isArray(saved?.favorites)?[...new Set<string>(saved.favorites.filter((id:unknown):id is string=>typeof id==='string'))]:[],
   }
  }catch{ /* The court picker remains available when storage fails. */ }
 }
 return {home:'',favorites:[]}
}

export function toggleSavedCourt(owner:string,id:string,preference:CourtPreference){
 const current=readSavedCourts(owner)
 const home=preference==='home'
 const wasSaved=home?current.home===id:current.favorites.includes(id)
 const saved=home?{...current,home:wasSaved?'':id}:
  {...current,favorites:wasSaved?current.favorites.filter(favorite=>favorite!==id):[...current.favorites,id]}
 localStorage.setItem(storageKey(owner),JSON.stringify(saved))
 const message=home?(wasSaved?'Home court cleared.':'Home court saved on this device.'):
  (wasSaved?'Court removed from favorites.':'Court added to favorites on this device.')
 return {saved,message}
}
