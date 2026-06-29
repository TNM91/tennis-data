import Image from 'next/image'
import { MarkerIcon } from './icons/TiqIcons'
import type { TacticalToken } from '@/lib/tactical/types'
import styles from './TiqTacticalStudio.module.css'

export default function TiqTokenIcon({ token }: { token: TacticalToken }) {
  if (token.type === 'player') {
    return (
      <span className={styles.playerTokenHead}>
        <Image alt="" draggable={false} fill sizes="38px" src="/tiq/logo/tiq-app-icon.png" />
      </span>
    )
  }

  if (token.type === 'ball') {
    return (
      <span className={styles.ballTokenImage}>
        <Image alt="" draggable={false} fill sizes="42px" src="/tiq/tokens/tennis-ball-reference.png" />
      </span>
    )
  }

  return <MarkerIcon type={token.type} />
}
