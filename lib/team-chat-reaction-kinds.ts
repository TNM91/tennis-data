/** Social reactions are separate from formal lineup acknowledgments. */
export const teamChatReactions=[
 {reaction:'helpful',label:'Helpful',emoji:'\u{1F44D}'},
 {reaction:'celebrate',label:'Celebrate',emoji:'\u{1F389}'},
 {reaction:'heart',label:'Love',emoji:'\u2764\uFE0F'},
 {reaction:'laugh',label:'Laugh',emoji:'\u{1F602}'},
 {reaction:'fire',label:'Fire',emoji:'\u{1F525}'},
 {reaction:'tennis',label:'Tennis',emoji:'\u{1F3BE}'},
] as const
export type TeamChatReactionKind=typeof teamChatReactions[number]['reaction']
export const isTeamChatReaction=(value:unknown):value is TeamChatReactionKind=>teamChatReactions.some(item=>item.reaction===value)
export const maxTeamChatReactionCount=1_000_000
