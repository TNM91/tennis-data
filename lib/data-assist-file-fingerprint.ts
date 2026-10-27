export async function buildFileFingerprint(file: File) {
  const head = await file.slice(0, Math.min(file.size, 512 * 1024)).arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', head)
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  return `${hash.slice(0, 24)}-${file.size}`
}

