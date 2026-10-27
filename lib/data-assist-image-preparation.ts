import type {DataAssistImportType} from './data-assist'
const MAX_PREPARED_SCREENSHOT_WIDTH=1000,MAX_PREPARED_SCREENSHOT_HEIGHT=2000,MAX_PREPARED_TEAM_SUMMARY_WIDTH=760,MAX_PREPARED_TEAM_SUMMARY_HEIGHT=1520,PREPARED_SCREENSHOT_QUALITY=0.82
export type ImagePreparationLimits={minSide:number;maxPixels:number;timeoutMs:number;alwaysReencode?:boolean}
export async function prepareScreenshotForUpload(file: File, requestedImportType: DataAssistImportType, limits?:ImagePreparationLimits): Promise<{
  file: File
  dimensions: { width: number; height: number }
}> {
  const sourceUrl = URL.createObjectURL(file)

  try {
    const image = await loadImageElement(sourceUrl,limits?.timeoutMs)
    const originalWidth = image.naturalWidth
    const originalHeight = image.naturalHeight
    if(limits&&(!originalWidth||!originalHeight||originalWidth<limits.minSide||originalHeight<limits.minSide||originalWidth*originalHeight>limits.maxPixels))throw Error('Choose a readable scorecard photo with each side at least 280 pixels and no more than 64 megapixels.')
    if (!originalWidth || !originalHeight) {
      return { file, dimensions: { width: 0, height: 0 } }
    }

    const maxWidth = requestedImportType === 'team_summary'
      ? MAX_PREPARED_TEAM_SUMMARY_WIDTH
      : MAX_PREPARED_SCREENSHOT_WIDTH
    const maxHeight = requestedImportType === 'team_summary'
      ? MAX_PREPARED_TEAM_SUMMARY_HEIGHT
      : MAX_PREPARED_SCREENSHOT_HEIGHT
    const scale = Math.min(
      1,
      maxWidth / originalWidth,
      maxHeight / originalHeight,
    )
    if (scale >= 1 && file.type === 'image/jpeg' && !limits?.alwaysReencode) {
      return { file, dimensions: { width: originalWidth, height: originalHeight } }
    }

    const width = Math.max(1, Math.round(originalWidth * scale))
    const height = Math.max(1, Math.round(originalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {if(limits?.alwaysReencode)throw Error('Photo preview unavailable. Try another photo.');return { file, dimensions: { width: originalWidth, height: originalHeight } }}

    if(limits?.alwaysReencode){context.fillStyle='#fff';context.fillRect(0,0,width,height)}
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(image, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', PREPARED_SCREENSHOT_QUALITY)
    })
    if (!blob) {if(limits?.alwaysReencode)throw Error('Photo could not be prepared. Try another photo.');return { file, dimensions: { width: originalWidth, height: originalHeight } }}
    if(limits?.alwaysReencode&&blob.type!=='image/jpeg')throw Error('Photo could not be prepared as JPEG.')

    const compressedFile = new File([blob], buildPreparedScreenshotFileName(file.name), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    })
    const shouldUseCompressedFile = Boolean(limits?.alwaysReencode) || compressedFile.size < file.size || scale < 1

    return {
      file: shouldUseCompressedFile ? compressedFile : file,
      dimensions: shouldUseCompressedFile
        ? { width, height }
        : { width: originalWidth, height: originalHeight },
    }
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

function loadImageElement(src: string,timeoutMs?:number) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    const timer=timeoutMs?setTimeout(()=>{image.onload=null;image.onerror=null;image.src='';reject(Error('Photo could not be opened.'))},timeoutMs):undefined
    image.onload = () => {clearTimeout(timer);resolve(image)}
    image.onerror = () => {clearTimeout(timer);reject(new Error('Image could not be read.'))}
    image.src = src
  })
}

function buildPreparedScreenshotFileName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, '').trim() || 'tennislink-screenshot'
  return `${baseName}-data-assist.jpg`
}

