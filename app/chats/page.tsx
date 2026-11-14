import PlayerChatsEntry from './player-chats-entry'

export default async function ChatsPage({searchParams}:{searchParams:Promise<{room?:string|string[]}>}) {
  const {room}=await searchParams
  return <PlayerChatsEntry room={typeof room === 'string' ? room : undefined}/>
}
