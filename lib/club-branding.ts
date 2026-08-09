export const CLUB_BRANDING_BUCKET = 'club-branding'
export const MAX_CLUB_LOGO_BYTES = 5 * 1024 * 1024

const CLUB_LOGO_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function validateClubLogoFile(file: Pick<File, 'size' | 'type'>) {
  if (!CLUB_LOGO_EXTENSIONS[file.type]) return 'Upload a JPG, PNG, or WebP image.'
  if (file.size < 1) return 'Choose a club logo first.'
  if (file.size > MAX_CLUB_LOGO_BYTES) return 'Club logos need to be 5 MB or smaller.'
  return ''
}

export function buildClubLogoStoragePath(clubId: string, mimeType: string, uploadId: string) {
  const extension = CLUB_LOGO_EXTENSIONS[mimeType] || 'jpg'
  return `${clubId}/logo-${uploadId}.${extension}`
}

export function hasValidClubLogoSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mimeType === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  if (mimeType === 'image/webp') {
    return ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP'
  }
  return false
}

export function getManagedClubLogoPath(url: string, clubId: string) {
  const marker = `/storage/v1/object/public/${CLUB_BRANDING_BUCKET}/`
  const markerIndex = url.indexOf(marker)
  if (markerIndex < 0) return ''
  const path = url.slice(markerIndex + marker.length).split('?')[0]
  try {
    const decodedPath = decodeURIComponent(path)
    return decodedPath.startsWith(`${clubId}/logo-`) ? decodedPath : ''
  } catch {
    return ''
  }
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end))
}
