import {androidAppLinks} from '@/lib/android-app-links'

export const dynamic = 'force-static'

export function GET() {
  return Response.json(androidAppLinks, {headers: {'Cache-Control': 'public, max-age=3600'}})
}
