'use client'

import Image from 'next/image'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useMemo } from 'react'

type Particle = {
  id: number
  size: number
  x: number
  y: number
  duration: number
  delay: number
  opacity: number
}

export default function HeroAnimated() {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const springX = useSpring(mouseX, { stiffness: 80, damping: 18, mass: 0.6 })
  const springY = useSpring(mouseY, { stiffness: 80, damping: 18, mass: 0.6 })

  const ballX = useTransform(springX, [-0.5, 0.5], [-18, 18])
  const ballY = useTransform(springY, [-0.5, 0.5], [-14, 14])

  const glowX = useTransform(springX, [-0.5, 0.5], [-30, 30])
  const glowY = useTransform(springY, [-0.5, 0.5], [-24, 24])

  const textX = useTransform(springX, [-0.5, 0.5], [-10, 10])
  const textY = useTransform(springY, [-0.5, 0.5], [-8, 8])

  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        size: 4 + ((i * 7) % 12),
        x: 58 + ((i * 11) % 34),
        y: 14 + ((i * 9) % 56),
        duration: 5 + (i % 4),
        delay: i * 0.18,
        opacity: 0.18 + (i % 5) * 0.08,
      })),
    []
  )

  function handleMouseMove(e: React.MouseEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    mouseX.set(x)
    mouseY.set(y)
  }

  function handleMouseLeave() {
    mouseX.set(0)
    mouseY.set(0)
  }

  return (
    <section
      className="hero-insane"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="hero-insane__bg" />
      <div className="hero-insane__grid" />
      <div className="hero-insane__noise" />

      <div className="hero-insane__inner">
        <motion.div
          className="hero-insane__content"
          style={{ x: textX, y: textY }}
        >
          <motion.div
            className="hero-insane__eyebrow"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Tennis intelligence platform
          </motion.div>

          <motion.h1
            className="hero-insane__title"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
          >
            <span className="hero-insane__title-white">TenAce</span>
            <span className="hero-insane__title-iq">IQ</span>
          </motion.h1>

          <motion.p
            className="hero-insane__subtitle"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.12 }}
          >
            Smarter Tennis Starts Here.
          </motion.p>

          <motion.div
            className="hero-insane__chips"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <span className="hero-chip">Ratings &amp; analytics</span>
            <span className="hero-chip">Captain tools</span>
            <span className="hero-chip">Community insights</span>
          </motion.div>
        </motion.div>

        <div className="hero-insane__visual">
          {particles.map((particle) => (
            <motion.span
              key={particle.id}
              className="hero-particle"
              style={{
                width: particle.size,
                height: particle.size,
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                opacity: particle.opacity,
              }}
              animate={{
                y: [0, -18, 0],
                x: [0, 10, 0],
                scale: [1, 1.18, 1],
                opacity: [particle.opacity, particle.opacity + 0.15, particle.opacity],
              }}
              transition={{
                duration: particle.duration,
                delay: particle.delay,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}

          <motion.div
            className="hero-insane__glow"
            style={{ x: glowX, y: glowY }}
            animate={{
              scale: [1, 1.08, 1],
              opacity: [0.55, 0.9, 0.55],
            }}
            transition={{
              duration: 4.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          <motion.div
            className="hero-insane__ball-wrap"
            style={{ x: ballX, y: ballY }}
            animate={{
              rotate: [0, 2.2, -2.2, 0],
              y: [0, -10, 0],
            }}
            transition={{
              duration: 7,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <motion.div
              className="hero-insane__ball-shadow"
              animate={{
                scaleX: [1, 1.08, 1],
                opacity: [0.22, 0.32, 0.22],
              }}
              transition={{
                duration: 7,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />

            <Image
              src="/data-ball-glow.png"
              alt="TenAceIQ data tennis ball"
              width={560}
              height={560}
              priority
              className="hero-insane__ball"
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
