import { createHash, randomBytes } from 'node:crypto'

export function createCalendarFeedToken() {
  return randomBytes(32).toString('base64url')
}

export function hashCalendarFeedToken(token: string) {
  return createHash('sha256').update(token.trim()).digest('hex')
}
