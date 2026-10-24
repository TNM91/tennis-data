import {GET as getTeamRoom} from '../route'
export const runtime='nodejs'
// A separate read-only endpoint fails safely if the website is rolled back to a version
// that predates native live updates, instead of invoking its legacy mark-read GET.
export async function GET(request:Request){
 const url=new URL(request.url)
 url.searchParams.set('chatUpdates','1');url.searchParams.set('read','0')
 return getTeamRoom(new Request(url,{headers:request.headers,signal:request.signal}))
}
