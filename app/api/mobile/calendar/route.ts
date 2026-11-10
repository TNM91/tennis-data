import { handleNativeCalendar } from '@/lib/native-calendar-route'

export const runtime = 'nodejs'
export const maxDuration = 30

export const GET = (request: Request) => handleNativeCalendar(request, false)
export const POST = (request: Request) => handleNativeCalendar(request, true)
