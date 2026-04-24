'use client'

import { useSyncExternalStore } from 'react'

const DEFAULT_SCREEN_WIDTH = 1280

function getViewportWidth() {
  if (typeof window === 'undefined') return DEFAULT_SCREEN_WIDTH
  return window.innerWidth
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('resize', onStoreChange)
  return () => window.removeEventListener('resize', onStoreChange)
}

export function useViewportBreakpoints() {
  const screenWidth = useSyncExternalStore(subscribe, getViewportWidth, () => DEFAULT_SCREEN_WIDTH)

  return {
    screenWidth,
    isTablet: screenWidth < 1080,
    isMobile: screenWidth < 820,
    isSmallMobile: screenWidth < 560,
  }
}
