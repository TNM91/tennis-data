import type { ChatPhoto } from './chat-photos'

export function loadChatIcon(source: string, remote: boolean) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    const timer = setTimeout(() => finish(false), 12000)
    function finish(loaded: boolean) {
      clearTimeout(timer)
      image.onload = image.onerror = null
      if (loaded && image.naturalWidth && image.naturalHeight && image.naturalWidth * image.naturalHeight <= 64_000_000) {
        resolve(image)
      } else reject(Error('Photo could not be opened.'))
    }
    if (remote) image.crossOrigin = 'anonymous'
    image.referrerPolicy = 'no-referrer'
    image.onload = () => finish(true)
    image.onerror = () => finish(false)
    image.src = source
  })
}

export function drawChatIcon(
  canvas: HTMLCanvasElement, image: HTMLImageElement, frame: { zoom: number; x: number; y: number; fit: boolean },
) {
  const context = canvas.getContext('2d')
  if (!context) throw Error('Photo preview unavailable.')
  const size = canvas.width
  const ratio = (frame.fit
    ? Math.min(size / image.naturalWidth, size / image.naturalHeight)
    : Math.max(size / image.naturalWidth, size / image.naturalHeight)) * frame.zoom
  const width = image.naturalWidth * ratio, height = image.naturalHeight * ratio
  const offset = (length: number, position: number) => (size - length) / 2 - Math.max(0, length - size) * position / 2
  context.fillStyle = '#0c1d35'
  context.fillRect(0, 0, size, size)
  context.drawImage(image, offset(width, frame.x), offset(height, frame.y), width, height)
}

export function encodeChatIcon(canvas: HTMLCanvasElement): ChatPhoto {
  const preview = canvas.toDataURL('image/jpeg', 0.84)
  const base64 = preview.split(',')[1]
  if (!base64 || base64.length > 350_000) throw Error('Choose a smaller photo.')
  return { preview, base64 }
}
