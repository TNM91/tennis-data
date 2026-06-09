# Level Up Sync Audit

Use this during Player and Coach journey testing. The typed source of truth is `lib/level-up/level-up-sync-contract.ts`.

## Sync Principle

Level Up should always be useful on court. It saves locally first so the player does not lose work. When the player is connected through a coach invite or Player+ access, proof history should sync through the backend. Favorites and manual coach-update sent markers are local-only in v1.

## Sync Matrix

| Area | Status | Source of truth | Backend/API | Local fallback | Pass signal | Fail-fast signal |
| --- | --- | --- | --- | --- | --- | --- |
| Coach assignments | backend-backed | `coach_assignments` linked through `coach_player_links` | `/api/coach/assignments`, `/api/player/coach-assignments` | Local coach assignment previews only | Coach-created assignment appears to the linked player and not to unrelated players. | Player sees assignment not tied to their coach-player link. |
| Level Up proof history | hybrid | `level_up_sessions` for signed-in coach-invited or Player+ users | `/api/player/level-up-sessions`, `/api/coach/level-up-sessions` | `tiq-level-up-completions`, `tenaceiq:level-up:<identitySlug>` | Coach-invited proof reaches coach review; Player+ proof returns as player history; Free preview stays local. | UI says synced when proof only exists in localStorage. |
| Favorites | local-only | `localStorage` | none | `tiq-level-up-favorites` | Favorite persists after refresh on the same device. | Tester expects favorites to follow the user across devices. |
| Coach update copy status | manual-copy | Manual copy text plus local sent markers | none | `tiq-level-up-coach-sent`, `tiq-level-up-coach-sent-at` | Copy/manual fallback works and sent markers survive refresh. | UI implies the update was automatically delivered to a coach. |
| Live workbench session | hybrid | `level_up_sessions` when sync succeeds | `/api/player/level-up-sessions` | `tenaceiq:level-up:<identitySlug>`, `tiq-level-up-completions` | Local-first save shows correct synced/local/error status. | Free preview work is presented as cloud history or coach-visible proof. |

## Access Modes

| Mode | Meaning | Expected sync behavior |
| --- | --- | --- |
| `coach_invited` | Player is linked to a coach through a coach invite or coach-player link. | Proof can sync to `level_up_sessions`, mark linked assignment complete, and become coach-visible when shared. |
| `player_plus` | Player has Player+ access without relying on a coach invite. | Proof can sync to player history across devices, but is not coach-visible by default. |
| `free_preview` | Player is using the preview experience without Player+ or coach invite. | Proof stays local on the device. UI must not imply cloud history or coach review. |

## Manual Test Script

1. Open Level Up as a signed-out or Free preview user.
2. Confirm the Level Up local sync proof cue names saved-first proof, connected sync, and local-only v1 items.
3. Complete one card and confirm the status says local, not synced.
4. Refresh and confirm the local proof remains.
5. Sign in as `player_plus_linked`.
6. Complete one self-guided card.
7. Confirm the status says synced to Level Up history.
8. Refresh or use another browser session if available and confirm remote history is pulled back.
9. Sign in through the coach-invited player fixture.
10. Complete an assigned coach card with sharing enabled.
11. Confirm the assignment completion and proof appear to the coach.
12. Favorite a card.
13. Confirm the favorite survives refresh on the same device.
14. Do not treat favorites as cross-device until backend persistence exists.
15. Copy a coach update.
16. Confirm the UI says copied/manual, not automatically delivered.

## What To Record

| Field | Value |
| --- | --- |
| Account/mode | free_preview / player_plus / coach_invited |
| Card/module |  |
| Assignment id |  |
| Proof rating |  |
| Local storage key observed |  |
| API route observed |  |
| UI status text |  |
| Level Up local sync proof cue | seen / missing |
| Coach-visible? | yes / no / not expected |
| Result | pass / fail / sync gap / fixture gap |
| Notes |  |

## Closeout Decision Rules

- If proof sync works for coach-invited and Player+ users, keep Level Up marked as hybrid until favorites are backend-backed.
- If coach assignments sync but proof does not appear in Coach Hub, mark `proof review gap`.
- If proof syncs but assignment status does not complete, mark `assignment completion gap`.
- If favorites are expected to sync across devices, that is new backend scope.
- If manual coach update copy is not enough for launch, define a messaging/sent-update backend workflow before changing the UI language.
