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
  const iconSize = top ? (compact ? 86 : 104) : footer ? 76 : compact ? 64 : 68
  const fontSize = top ? (compact ? 32 : 40) : footer ? 31 : compact ? 26 : 28

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
        <div
          className="data-ball-spin-wrap"
          style={{
            width: `${iconSize}px`,
            height: `${iconSize}px`,
            flexShrink: 0,
            marginRight: '-21px',
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
            className="data-ball-spin"
            style={{
              width: `${iconSize}px`,
              height: `${iconSize}px`,
              objectFit: 'contain',
              display: 'block',
              filter: top
                ? 'drop-shadow(0 14px 30px rgba(37,91,227,0.22))'
                : 'drop-shadow(0 6px 14px rgba(37,91,227,0.14))',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            fontWeight: 900,
            fontSize: `${fontSize}px`,
            letterSpacing: '-0.045em',
            lineHeight: 0.92,
            whiteSpace: 'nowrap',
            transform: 'translateX(-1px)',
            paddingRight: '4px',
            overflow: 'visible',
          }}
        >
          <span style={{ color: footer ? '#FFFFFF' : '#F8FBFF' }}>TenAce</span>

          <span
            style={{
              marginLeft: '0px',
              background: 'linear-gradient(135deg, #9BE11D 0%, #7ED321 45%, #C7F36B 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontWeight: 900,
              paddingRight: '2px',
            }}
          >
            IQ
          </span>
        </div>
      </div>

      <style jsx>{`
        .data-ball-spin-wrap {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .data-ball-spin {
          transform-origin: center center;
          animation: tenaceiq-ball-spin 3.8s linear infinite;
          will-change: transform;
        }

        @keyframes tenaceiq-ball-spin {
          from {
            transform: rotate(0deg) scale(1.08);
          }
          to {
            transform: rotate(360deg) scale(1.08);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .data-ball-spin {
            animation: none;
            transform: scale(1.08);
          }
        }
      `}</style>
    </>
  )
}