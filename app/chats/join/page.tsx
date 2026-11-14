import PlayerChatsEntry from '../player-chats-entry'

export default async function ChatInvitePage({searchParams}:{searchParams:Promise<{invite?:string|string[]}>}) {
  const {invite}=await searchParams
  return <PlayerChatsEntry invite={typeof invite === 'string' ? invite : ''}/>
}
