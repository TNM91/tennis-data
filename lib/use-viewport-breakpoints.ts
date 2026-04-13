'use client'

import { useEffect, useState } from 'react'

const DEFAULT_SCREEN_WIDTH = 1280

export function useViewportBreakpoints() {
  const [screenWidth, setScreenWidth] = useState(DEFAULT_SCREEN_WIDTH)

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return {
    screenWidth,
    isTablet: screenWidth < 1080,
    isMobile: screenWidth < 820,
    isSmallMobile: screenWidth < 560,
  }
}
