'use client'

import Image from 'next/image'

type BrandWordmarkProps = {
  compact?: boolean
  footer?: boolean
  top?: boolean
}

export default function BrandWordmark({
  compact = false,
  footer = false,
  top = false,
}: BrandWordmarkProps) {
  const isHeader = top
  const isFooter = footer

  const iconSize = isHeader ? (compact ? 88 : 106) : isFooter ? 82 : compact ? 66 : 72
  const fontSize = isHeader ? (compact ? 33 : 41) : isFooter ? 33 : compact ? 27 : 30

  // keep lockup spacing visually consistent across header + footer
  const imagePull = isHeader ? -21 : isFooter ? -21 : -16
  const textPull = isHeader ? -1 : isFooter ? -1 : 0

  return (
    <>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0,
          lineHeight: 1,
          minWidth: 0,
          overflow: 'visible',
        }}
      >
        <span
          className="taiq-ball-wrap"
          style={{
            width: `${iconSize}px`,
            height: `${iconSize}px`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginRight: `${imagePull}px`,
            transform: 'translateY(1px)',
            overflow: 'visible',
          }}
        >
          <Image
            src="/logo-icon.png"
            alt="TenAceIQ"
            width={iconSize}
            height={iconSize}
            priority={top}
            className="taiq-ball-spin"
            style={{
              width: `${iconSize}px`,
              height: `${iconSize}px`,
              objectFit: 'contain',
              objectPosition: 'center',
              display: 'block',
              transformOrigin: 'center center',
              filter: isHeader
                ? 'drop-shadow(0 14px 30px rgba(37,91,227,0.22))'
                : isFooter
                  ? 'drop-shadow(0 10px 22px rgba(8,17,29,0.22))'
                  : 'drop-shadow(0 8px 18px rgba(37,91,227,0.16))',
            }}
          />
        </span>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            minWidth: 0,
            fontWeight: 900,
            fontSize: `${fontSize}px`,
            letterSpacing: '-0.045em',
            lineHeight: 0.92,
            whiteSpace: 'nowrap',
            transform: `translateX(${textPull}px)`,
            paddingRight: '4px',
            overflow: 'visible',
            textRendering: 'geometricPrecision',
          }}
        >
          <span style={{ color: isFooter ? '#FFFFFF' : '#F8FBFF' }}>TenAce</span>
          <span
            style={{
              marginLeft: 0,
              paddingRight: '2px',
              background: 'linear-gradient(135deg, #9BE11D 0%, #7ED321 45%, #C7F36B 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: isFooter ? 'brightness(1.03)' : 'none',
            }}
          >
            IQ
          </span>
        </div>
      </div>

      <style jsx>{`
        .taiq-ball-wrap {
          pointer-events: none;
        }

        .taiq-ball-spin {
          animation: taiqSpin 4.8s linear infinite;
          will-change: transform;
        }

        @keyframes taiqSpin {
          from {
            transform: rotate(0deg) scale(1.1);
          }
          to {
            transform: rotate(360deg) scale(1.1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .taiq-ball-spin {
            animation: none;
            transform: scale(1.1);
          }
        }
      `}</style>
    </>
  )
}