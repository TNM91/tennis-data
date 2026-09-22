export const TEAM_LOGO_MAX_BYTES = 8 * 1024 * 1024
export const TEAM_LOGO_MAX_DIMENSION = 6000
export const TEAM_LOGO_MAX_PIXELS = 24_000_000
export const TEAM_LOGO_MAX_ASPECT_RATIO = 8

const TEAM_LOGO_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export type TeamLogoDimensions = {
  width: number
  height: number
}

export function validateTeamLogoFile(file: Pick<File, 'size' | 'type'>) {
  if (!TEAM_LOGO_EXTENSIONS[file.type]) return 'Use a JPG, PNG, or WebP team logo.'
  if (file.size < 1) return 'Choose a team logo first.'
  if (file.size > TEAM_LOGO_MAX_BYTES) return 'Team logos must be 8 MB or smaller.'
  return ''
}

export function buildTeamLogoStoragePath(conversationId: string, mimeType: string, uploadId: string) {
  const extension = TEAM_LOGO_EXTENSIONS[mimeType] || 'jpg'
  return `team-logos/${conversationId}/${uploadId}.${extension}`
}

export function inspectTeamLogoImage(bytes: Uint8Array, mimeType: string): TeamLogoDimensions | null {
  if (!hasValidTeamLogoSignature(bytes, mimeType)) return null
  if (mimeType === 'image/png') return readPngDimensions(bytes)
  if (mimeType === 'image/jpeg') return readJpegDimensions(bytes)
  if (mimeType === 'image/webp') return readWebpDimensions(bytes)
  return null
}

export function validateTeamLogoDimensions(dimensions: TeamLogoDimensions | null) {
  if (!dimensions) return 'That file does not appear to be a valid team logo image.'
  const { width, height } = dimensions
  if (width < 32 || height < 32) return 'Choose a team logo that is at least 32 pixels on each side.'
  if (width > TEAM_LOGO_MAX_DIMENSION || height > TEAM_LOGO_MAX_DIMENSION || width * height > TEAM_LOGO_MAX_PIXELS) {
    return 'Choose a team logo no larger than 6,000 pixels or 24 megapixels.'
  }
  const aspectRatio = Math.max(width / height, height / width)
  if (aspectRatio > TEAM_LOGO_MAX_ASPECT_RATIO) {
    return 'Choose a square or wide team logo without an extra-long banner shape.'
  }
  return ''
}

export function hasValidTeamLogoSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mimeType === 'image/png') {
    return bytes[0] === 0x89
      && bytes[1] === 0x50
      && bytes[2] === 0x4e
      && bytes[3] === 0x47
      && bytes[4] === 0x0d
      && bytes[5] === 0x0a
      && bytes[6] === 0x1a
      && bytes[7] === 0x0a
  }
  if (mimeType === 'image/webp') return ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP'
  return false
}

function readPngDimensions(bytes: Uint8Array): TeamLogoDimensions | null {
  if (bytes.length < 24 || ascii(bytes, 12, 16) !== 'IHDR') return null
  return validDimensions(readUint32BigEndian(bytes, 16), readUint32BigEndian(bytes, 20))
}

function readJpegDimensions(bytes: Uint8Array): TeamLogoDimensions | null {
  let offset = 2
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = bytes[offset + 1]
    offset += 2
    if (marker === 0xd8 || marker === 0xd9) continue
    if (marker === 0xda) break
    if (offset + 1 >= bytes.length) return null
    const segmentLength = readUint16BigEndian(bytes, offset)
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null
    if (isJpegStartOfFrame(marker) && segmentLength >= 7) {
      return validDimensions(
        readUint16BigEndian(bytes, offset + 5),
        readUint16BigEndian(bytes, offset + 3),
      )
    }
    offset += segmentLength
  }
  return null
}

function readWebpDimensions(bytes: Uint8Array): TeamLogoDimensions | null {
  let offset = 12
  while (offset + 8 <= bytes.length) {
    const chunkType = ascii(bytes, offset, offset + 4)
    const chunkLength = readUint32LittleEndian(bytes, offset + 4)
    const payload = offset + 8
    if (payload + chunkLength > bytes.length) return null

    if (chunkType === 'VP8X' && chunkLength >= 10) {
      return validDimensions(1 + readUint24LittleEndian(bytes, payload + 4), 1 + readUint24LittleEndian(bytes, payload + 7))
    }
    if (chunkType === 'VP8L' && chunkLength >= 5 && bytes[payload] === 0x2f) {
      const b1 = bytes[payload + 1]
      const b2 = bytes[payload + 2]
      const b3 = bytes[payload + 3]
      const b4 = bytes[payload + 4]
      return validDimensions(1 + (b1 | ((b2 & 0x3f) << 8)), 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10)))
    }
    if (
      chunkType === 'VP8 '
      && chunkLength >= 10
      && bytes[payload + 3] === 0x9d
      && bytes[payload + 4] === 0x01
      && bytes[payload + 5] === 0x2a
    ) {
      return validDimensions(
        readUint16LittleEndian(bytes, payload + 6) & 0x3fff,
        readUint16LittleEndian(bytes, payload + 8) & 0x3fff,
      )
    }

    offset = payload + chunkLength + (chunkLength % 2)
  }
  return null
}

function validDimensions(width: number, height: number): TeamLogoDimensions | null {
  return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 ? { width, height } : null
}

function isJpegStartOfFrame(marker: number) {
  return (marker >= 0xc0 && marker <= 0xc3)
    || (marker >= 0xc5 && marker <= 0xc7)
    || (marker >= 0xc9 && marker <= 0xcb)
    || (marker >= 0xcd && marker <= 0xcf)
}

function readUint16BigEndian(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] || 0) << 8) | (bytes[offset + 1] || 0)
}

function readUint16LittleEndian(bytes: Uint8Array, offset: number) {
  return (bytes[offset] || 0) | ((bytes[offset + 1] || 0) << 8)
}

function readUint24LittleEndian(bytes: Uint8Array, offset: number) {
  return (bytes[offset] || 0) | ((bytes[offset + 1] || 0) << 8) | ((bytes[offset + 2] || 0) << 16)
}

function readUint32BigEndian(bytes: Uint8Array, offset: number) {
  return (((bytes[offset] || 0) * 0x1000000)
    + ((bytes[offset + 1] || 0) << 16)
    + ((bytes[offset + 2] || 0) << 8)
    + (bytes[offset + 3] || 0)) >>> 0
}

function readUint32LittleEndian(bytes: Uint8Array, offset: number) {
  return (((bytes[offset] || 0))
    + ((bytes[offset + 1] || 0) << 8)
    + ((bytes[offset + 2] || 0) << 16)
    + ((bytes[offset + 3] || 0) * 0x1000000)) >>> 0
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end))
}
