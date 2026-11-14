'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import { supabase } from '@/lib/supabase'
import { playerChatAppDownload,playerChatInvitePath,playerChatPath,validPlayerChatInvite } from '@/lib/player-chats-contract'
import { teamChatMessageId } from '@/lib/team-chat-cursor'
import { NATIVE_WEB_PARAMETER } from '@/lib/native-web-privacy'
import { openPlayerChats } from '../../mobile/src/player-chats-view'
import styles from './player-chats.module.css'

export default function PlayerChatsEntry({invite,room}:{invite?:string;room?:string}) {
  const { authResolved,session } = useAuth()
  const owner = authResolved ? session?.user.id : undefined
  const code = validPlayerChatInvite(invite) ? invite : ''
  const roomId = teamChatMessageId(room) ? room : undefined
  const trigger = useRef<HTMLButtonElement>(null)
  const controller = useRef<ReturnType<typeof openPlayerChats>|null>(null)

  useEffect(() => {
    if (!owner) return
    let active = true
    const button = trigger.current
    if (!button) return
    const open = () => {
      if (controller.current?.isOpen()) return
      controller.current = openPlayerChats(supabase,owner,()=>active,()=>{
        controller.current = null
        button.focus()
      },{token:code,room:roomId,browser:true,className:styles.dialog})
    }
    button.addEventListener('click',open)
    if (code || roomId) open()
    return () => {active=false;button.removeEventListener('click',open);controller.current?.dispose();controller.current=null}
  },[code,owner,roomId])

  const validInvite = invite === undefined || Boolean(code)
  const next = code ? playerChatInvitePath+'?invite='+code : roomId ? playerChatPath+'?room='+roomId : playerChatPath
  const privateVisit = NATIVE_WEB_PARAMETER+'=ios&next='+encodeURIComponent(next)
  return <section className={styles.card}>
    <p className={styles.label}>TenAceIQ</p>
    <h1>{invite===undefined?'Players & groups':'You’re invited to chat'}</h1>
    {!validInvite ? <p>Ask the person who invited you for a fresh TenAceIQ link.</p> :
      !authResolved ? <p role="status">Checking your account…</p> :
      owner ? <button className={styles.primary} type="button" ref={trigger}>{code?'Review invitation':'Open chats'}</button> :
      <><p>Use your TenAceIQ account or create a free account to continue.</p>
      <div className={styles.actions}><Link className={styles.primary} prefetch={false} href={'/join?plan=free&'+privateVisit}>Create free account</Link>
      <Link className={styles.secondary} prefetch={false} href={'/login?'+privateVisit}>Sign in</Link></div></>}
    <a className={styles.download} href={playerChatAppDownload}>View on the App Store</a>
  </section>
}
