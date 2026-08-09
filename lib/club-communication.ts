export type ClubCommunicationItem = {
  id: string
  channelId: string
  channelType: 'team' | 'clinic'
  channelName: string
  href: string
  authorName: string
  body: string
  activityType: 'message' | 'availability_reply'
  createdAt: string
  unreadCount: number
  needsReply: boolean
}

export function getClubCommunicationSummary(items: ClubCommunicationItem[]) {
  return {
    unreadCount: items.reduce((total, item) => total + item.unreadCount, 0),
    needsReplyCount: items.filter((item) => item.needsReply).length,
    attentionCount: items.filter((item) => item.needsReply || item.unreadCount > 0).length,
  }
}

export function getClubCommunicationAttentionItems(items: ClubCommunicationItem[]) {
  return items
    .filter((item) => item.needsReply || item.unreadCount > 0)
    .sort(sortClubCommunicationItems)
}

export function sortClubCommunicationItems(left: ClubCommunicationItem, right: ClubCommunicationItem) {
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
}
