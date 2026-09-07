import { randomBytes } from 'node:crypto'
import { isShareId } from '@/lib/match-calendar-shares'
import { sharedCalendarPage } from '@/lib/shared-calendar-page'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(_request:Request,{params}:{params:Promise<{shareId:string}>}) {
  const {shareId}=await params
  if(!isShareId(shareId))return new Response('Calendar unavailable.',{status:404})
  const nonce=randomBytes(18).toString('base64')
  return new Response(sharedCalendarPage(shareId,nonce),{headers:{
    'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow, noarchive',
    'Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
  }})
}
