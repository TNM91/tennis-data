'use client'

import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from 'react'

export type ThemeMode = 'dark'

type ThemeContextValue = {
  theme: ThemeMode
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const DARK_THEME_VALUE: ThemeContextValue = { theme: 'dark' }

function applyDarkTheme() {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = 'dark'
  document.documentElement.style.colorScheme = 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyDarkTheme()
  }, [])

  return <ThemeContext.Provider value={DARK_THEME_VALUE}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }

  return context
}
