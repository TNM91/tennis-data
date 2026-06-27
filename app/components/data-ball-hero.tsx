'use client'

import Image from 'next/image'
import { useMemo } from 'react'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

type Particle = {
  id: number
  size: number
  angle: number
  radius: number
  speed: number
  delay: number
  opacity: number
}

export default function DataBallHero() {
  const { isMobile } = useViewportBreakpoints()

  const particles = useMemo<Particle[]>(
    () => [
      { id: 1, size: 8, angle: 8, radius: 152, speed: 10, delay: 0, opacity: 0.95 },
      { id: 2, size: 6, angle: 42, radius: 176, speed: 14, delay: 0.6, opacity: 0.82 },
      { id: 3, size: 10, angle: 88, radius: 168, speed: 12, delay: 1.1, opacity: 0.88 },
      { id: 4, size: 7, angle: 128, radius: 194, speed: 16, delay: 0.3, opacity: 0.74 },
      { id: 5, size: 9, angle: 170, radius: 156, speed: 11, delay: 0.9, opacity: 0.92 },
      { id: 6, size: 6, angle: 212, radius: 186, speed: 15, delay: 1.5, opacity: 0.72 },
      { id: 7, size: 8, angle: 256, radius: 172, speed: 13, delay: 0.2, opacity: 0.86 },
      { id: 8, size: 10, angle: 302, radius: 198, speed: 17, delay: 1.8, opacity: 0.7 },
      { id: 9, size: 7, angle: 336, radius: 164, speed: 9, delay: 1.2, opacity: 0.84 },
    ],
    [],
  )

  const heroSize = isMobile ? 200 : 260
  const ballSize = isMobile ? 150 : 200
  const shellSize = isMobile ? 280 : 420

  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: isMobile ? '28px 0 20px' : '44px 0 28px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: `${shellSize}px`,
          height: `${shellSize}px`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          borderRadius: '50%',
          transformStyle: 'preserve-3d',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '12%',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(37,91,227,0.28) 0%, rgba(74,163,255,0.14) 30%, rgba(155,225,29,0.12) 48%, rgba(11,26,43,0) 74%)',
            filter: 'blur(34px)',
            opacity: 0.95,
            animation: 'heroPulse 6.2s ease-in-out infinite',
          }}
        />

        <div
          style={{
            position: 'absolute',
            width: isMobile ? '220px' : '320px',
            height: isMobile ? '220px' : '320px',
            borderRadius: '50%',
            border: '1px solid rgba(74,163,255,0.18)',
            boxShadow:
              '0 0 0 1px rgba(255,255,255,0.02) inset, 0 0 60px rgba(37,91,227,0.10)',
            animation: 'spinSlow 24s linear infinite',
          }}
        />

        <div
          style={{
            position: 'absolute',
            width: isMobile ? '196px' : '284px',
            height: isMobile ? '196px' : '284px',
            borderRadius: '50%',
            border: '1px dashed rgba(155,225,29,0.22)',
            opacity: 0.8,
            transform: 'rotate(12deg)',
            animation: 'spinReverse 20s linear infinite',
          }}
        />

        <div
          style={{
            position: 'absolute',
            width: isMobile ? '176px' : '236px',
            height: isMobile ? '176px' : '236px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(74,163,255,0.08) 22%, rgba(11,26,43,0) 70%)',
            filter: 'blur(12px)',
            opacity: 0.9,
            animation: 'haloShift 7s ease-in-out infinite',
          }}
        />

        <div
          style={{
            position: 'absolute',
            width: isMobile ? '188px' : '270px',
            height: isMobile ? '188px' : '270px',
            borderRadius: '50%',
            backgroundImage: `
              linear-gradient(rgba(74,163,255,0.10) 1px, transparent 1px),
              linear-gradient(90deg, rgba(74,163,255,0.10) 1px, transparent 1px)
            `,
            backgroundSize: isMobile ? '18px 18px' : '22px 22px',
            maskImage: 'radial-gradient(circle, rgba(0,0,0,1) 34%, rgba(0,0,0,0) 78%)',
            WebkitMaskImage:
              'radial-gradient(circle, rgba(0,0,0,1) 34%, rgba(0,0,0,0) 78%)',
            opacity: 0.48,
            transform: 'rotate(8deg)',
          }}
        />

        {particles.map((particle) => (
          <div
            key={particle.id}
            style={{
              position: 'absolute',
              width: `${particle.radius * 2}px`,
              height: `${particle.radius * 2}px`,
              animation: `orbit ${particle.speed}s linear ${particle.delay}s infinite`,
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 0,
                left: '50%',
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                marginLeft: `${-particle.size / 2}px`,
                borderRadius: '50%',
                background:
                  particle.id % 3 === 0
                    ? 'radial-gradient(circle, rgba(199,243,107,1) 0%, rgba(155,225,29,0.82) 55%, rgba(155,225,29,0.12) 100%)'
                    : 'radial-gradient(circle, rgba(116,190,255,1) 0%, rgba(74,163,255,0.82) 58%, rgba(74,163,255,0.08) 100%)',
                boxShadow:
                  particle.id % 3 === 0
                    ? '0 0 14px rgba(155,225,29,0.5), 0 0 30px rgba(155,225,29,0.24)'
                    : '0 0 14px rgba(74,163,255,0.48), 0 0 30px rgba(74,163,255,0.22)',
                opacity: particle.opacity,
                transform: `rotate(${particle.angle}deg)`,
                animation: 'particlePulse 3.8s ease-in-out infinite',
              }}
            />
          </div>
        ))}

        <div
          style={{
            position: 'absolute',
            bottom: isMobile ? '54px' : '88px',
            width: isMobile ? '144px' : '220px',
            height: isMobile ? '34px' : '46px',
            borderRadius: '999px',
            background:
              'radial-gradient(circle, rgba(37,91,227,0.34) 0%, rgba(74,163,255,0.14) 40%, rgba(11,26,43,0.02) 70%, transparent 100%)',
            filter: 'blur(12px)',
            opacity: 0.9,
          }}
        />

        <div
          style={{
            position: 'relative',
            width: `${heroSize}px`,
            height: `${heroSize}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transformStyle: 'preserve-3d',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: isMobile ? '15%' : '13%',
              borderRadius: '50%',
              background:
                'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 14%, rgba(255,255,255,0) 34%)',
              filter: 'blur(6px)',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          />

          <Image
            src="/tiq/logo/tiq-mark-light.png"
            alt="TenAceIQ"
            width={1800}
            height={844}
            priority
            style={{
              width: `${ballSize}px`,
              height: 'auto',
              objectFit: 'contain',
              display: 'block',
              position: 'relative',
              zIndex: 3,
            }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes spinSlow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes spinReverse {
          from {
            transform: rotate(12deg);
          }
          to {
            transform: rotate(-348deg);
          }
        }

        @keyframes orbit {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes particlePulse {
          0%,
          100% {
            transform: scale(0.92);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.18);
            opacity: 1;
          }
        }

        @keyframes heroPulse {
          0%,
          100% {
            transform: scale(0.96);
            opacity: 0.76;
          }
          50% {
            transform: scale(1.05);
            opacity: 1;
          }
        }

        @keyframes haloShift {
          0%,
          100% {
            transform: scale(0.98);
            opacity: 0.72;
          }
          50% {
            transform: scale(1.08);
            opacity: 1;
          }
        }
      `}</style>
    </section>
  )
}
