import type { CSSProperties } from 'react'
import { buildLocationDirectionsHref } from '@/lib/location-directions'

export default function LocationDirectionsLink({
  location,
  label = 'Get directions',
  className,
  style,
}: {
  location?: string | null
  label?: string
  className?: string
  style?: CSSProperties
}) {
  const href = buildLocationDirectionsHref(location)
  if (!href) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 40,
        width: 'fit-content',
        padding: '0 14px',
        border: '1px solid currentColor',
        borderRadius: 999,
        color: 'inherit',
        fontSize: 13,
        fontWeight: 850,
        lineHeight: 1.1,
        textDecoration: 'none',
        ...style,
      }}
      aria-label={`${label} to ${location?.trim()}`}
    >
      <span aria-hidden="true" style={{ marginRight: 7 }}>⌖</span>
      {label}
    </a>
  )
}
