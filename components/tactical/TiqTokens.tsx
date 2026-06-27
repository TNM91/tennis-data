import Image from 'next/image'
import { MarkerIcon } from './icons/TiqIcons'
import type { TacticalToken } from '@/lib/tactical/types'
import styles from './TiqTacticalStudio.module.css'

export default function TiqTokenIcon({ token }: { token: TacticalToken }) {
  if (token.type === 'player') {
    return (
      <span className={styles.playerTokenHead}>
        <Image alt="" fill sizes="38px" src="/tiq/logo/tiq-app-icon.png" />
      </span>
    )
  }

  return <MarkerIcon type={token.type} />
}
