import {stLouisHittingClubs,type ExploreCourt} from '../../lib/hitting-clubs'
import type {SavedCourts} from './explore-saved-courts'
import {html} from './html'

export function hittingClubOptions(saved:SavedCourts,selected:string){
 const option=(club:ExploreCourt)=>`<option value="${html(club.id)}"${club.id===selected?' selected':''}>${html(club.name)}</option>`
 const home=stLouisHittingClubs.filter(club=>club.id===saved.home)
 const favorites=stLouisHittingClubs.filter(club=>club.id!==saved.home&&saved.favorites.includes(club.id))
 if(!home.length&&!favorites.length)return stLouisHittingClubs.map(option).join('')
 const others=stLouisHittingClubs.filter(club=>club.id!==saved.home&&!saved.favorites.includes(club.id))
 const groups:[string,ExploreCourt[]][]=[['Home court',home],['Favorites',favorites],['Other clubs',others]]
 return groups.filter(([,clubs])=>clubs.length).map(([label,clubs])=>`<optgroup label="${label}">${clubs.map(option).join('')}</optgroup>`).join('')
}
