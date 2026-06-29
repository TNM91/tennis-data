import Image from 'next/image'
import TiqCourtOverlay from './TiqCourtOverlay'
import type { DrillOverlay, TiqCourtVariant } from './types'

type TiqCourtProps = {
  alt?: string
  className?: string
  overlay?: DrillOverlay
  showLabels?: boolean
  variant?: TiqCourtVariant
}

const courtAssetByVariant: Record<TiqCourtVariant, string> = {
  isometric: '/tiq/courts/tiq-court-master.png',
  flat: '/tiq/courts/tiq-court-master.png',
}

export default function TiqCourt({
  alt = 'TenAceIQ tactical tennis court',
  className = '',
  overlay,
  showLabels = true,
  variant = 'isometric',
}: TiqCourtProps) {
  return (
    <div
      className={className}
      data-tiq-court={variant}
      style={{
        aspectRatio: '1448 / 1086',
        background: '#020814',
        borderRadius: 14,
        isolation: 'isolate',
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
      }}
    >
      <Image
        alt={alt}
        draggable={false}
        fill
        sizes="(max-width: 768px) 100vw, 900px"
        src={courtAssetByVariant[variant]}
        style={{
          inset: 0,
          objectFit: 'contain',
          userSelect: 'none',
        }}
      />
      <TiqCourtOverlay overlay={overlay} showLabels={showLabels} />
    </div>
  )
}
