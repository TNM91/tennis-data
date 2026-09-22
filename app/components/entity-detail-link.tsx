import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import styles from './entity-detail-link.module.css'

type EntityDetailLinkProps = {
  href: string
  children: ReactNode
  className?: string
  style?: CSSProperties
  title?: string
  ariaLabel?: string
  prefetch?: boolean
}

export default function EntityDetailLink({
  href,
  children,
  className,
  style,
  title,
  ariaLabel,
  prefetch,
}: EntityDetailLinkProps) {
  return (
    <Link
      href={href}
      className={[styles.link, className].filter(Boolean).join(' ')}
      style={style}
      title={title}
      aria-label={ariaLabel}
      prefetch={prefetch}
      data-entity-detail-link="true"
    >
      {children}
    </Link>
  )
}
