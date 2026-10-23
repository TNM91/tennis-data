# Apple app product direction

## Destination

TenAceIQ's iPhone app is the primary product. Bring the website's useful features, account data, role-based access, and premium brand experience into an app designed for phone use. Feature parity is a tracked release goal, not a claim that the first beta already has it. Keep the existing website working throughout the transition; later retain a small public discovery, download, support, privacy, and recovery presence.

Reuse the existing backend and central tier language in `lib/product-story.ts`. Preserve existing memberships and data. Do not prompt existing subscribers to buy access they already have. Store billing, restore purchases, and entitlement reconciliation require their own implementation and verification before native purchase flows ship.

## Delivery sequence

1. My Lab and navigation: polished phone home, player identity, recent form, follows, matchup insight, loading/error states, accessibility, and session continuity.
2. Explore: players, teams, leagues, rankings, search, and public intelligence.
3. Captain: Team Room, availability, scouting, lineups, readiness, and weekly decisions.
4. Conversations: team and group sports chat as described below, with secure membership and native notification controls.
5. Coordinator/Admin: league and tournament structures, rankings, results, and practical administration adapted to phone use. These are part of the final parity goal, even if later than player/captain beta releases.
6. Release completeness: account lifecycle, purchases/restore, privacy, accessibility, real-device acceptance, App Store materials, and review.

Before each slice, inventory the matching website workflows and permissions; record what is implemented, intentionally adapted, and still missing. Avoid inactive navigation or placeholder tools that imply a feature works.

## Premium experience

Use the approved TenAceIQ navy, green, typography, artwork, and product navigation language. Build deliberate phone navigation, comfortable touch targets, safe-area handling, readable tennis information, keyboard behavior, and reliable back navigation. Carry over the website's visual quality while adapting layouts to the device.

The iOS home-screen icon uses the approved dark-background iQ mark on opaque brand navy (#06172F). Preserve the artwork and tennis-ball seam. It must remain 1024 square with no alpha channel. This packaging change appears only after a new signed build is installed.

## Team and sports conversations

The owner wants a GroupMe-like group conversation experience, rather than a copy of the website chat layout. Design around team groups, match-day conversations, and league communication. Proposed scope includes a conversation list with unread state, chronological messages, a phone-friendly composer, replies, reactions, pinned match/lineup information, and relevant notifications. Validate the feature sequence against existing messaging storage and authorization before implementation; do not create a second disconnected message system.

Preserve strict membership-based read/write access. Include reporting, blocking, moderation, notification preferences, and safe attachment handling where those capabilities ship. Avoid exposing private team conversations through public player or league views. Push notifications must respect membership changes and user preferences. Live message sends and invitations need explicit authorization during testing.

## Confirmed beta evidence

October 23, 2026: the owner installed TestFlight 1.0 (2), signed in, and reported success for player connection, recent match details, result filters, and sign-in persistence after closing/reopening the app. This is owner-reported acceptance of those flows, not full feature parity, accessibility validation, or public App Store readiness.
