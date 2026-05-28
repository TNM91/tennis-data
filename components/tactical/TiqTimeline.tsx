'use client'

import type { TacticalPath } from '@/lib/tactical/types'
import styles from './TiqTacticalStudio.module.css'

export default function TiqTimeline({ paths, activeIndex, onStep }: { paths: TacticalPath[]; activeIndex: number; onStep: (index: number) => void }) {
  return (
    <div className={styles.timeline}>
      <button className={`${styles.button} ${activeIndex >= paths.length ? styles.active : ''}`} onClick={() => onStep(paths.length)} type="button">
        All
      </button>
      {paths.map((path, index) => (
        <button className={`${styles.button} ${activeIndex === index ? styles.active : ''}`} key={path.id} onClick={() => onStep(index)} type="button">
          {index + 1}. {path.label || path.kind}
        </button>
      ))}
    </div>
  )
}
