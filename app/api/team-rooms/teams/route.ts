import { GET as getTeamRoom } from '../route'

export async function GET(request: Request) {
  const url = new URL(request.url)
  url.search = '?teamsOnly=1&read=0'
  return getTeamRoom(new Request(url, { headers: request.headers }))
}
