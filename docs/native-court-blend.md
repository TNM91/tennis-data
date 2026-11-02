# Native court and surface refinement

The My Lab court scene now fades into the scoreboard at the top, sides and bottom. Its original image remains complete and proportional, while the overall, singles and doubles numbers retain their existing order and data.

The same surface treatment reaches the Coach Tactics entry and the background court on secondary pages. The Tactics image keeps its own aspect-ratio container, so its bottom fade follows the image even when larger text makes the card taller.

Compete's league and tournament cards have separate decorative court and draw illustrations. They contain no players, scores, results or simulated analytics. Explore gains a court-line heading; shortcuts, rating-history entry, next-band, training and chat-inbox surfaces share restrained light and accent colors. Decoration is hidden from assistive technology and ignores pointer input. Focus indicators remain visible and reduced-motion preferences disable the new control transitions.

## Verification

- Real minified native bundle reviewed in the in-app browser using synthetic local data; preview connections to the live backend are blocked.
- My Lab, Explore, Coach and Compete checked at 390px and at 320px with a 24px root text size. Scoreboard stays first; no horizontal page overflow observed.
- Enlarged Tactics copy and its action remain inside the naturally growing card. Full-screen Tactics opens and closes through the native navigation.
- Chat inbox keeps its unread count; conversation composer and unsent draft remain within the phone viewport.
- Approved brand image bytes, court geometry, rating calculation, sign-in, purchase, notification and database behavior are unchanged. No new image downloads or dependencies.

Full release checks are recorded separately for the final commit. Physical iPhone, keyboard and VoiceOver acceptance remain device checks; browser screenshots do not claim those results.
