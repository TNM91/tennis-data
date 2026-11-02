# Native theme and icon consistency

The native app uses one navy palette for pages, cards and sheets. `mobile/src/premium-surfaces.css` owns the tokens and maps the reused website components to them:

| Role | Color |
| --- | --- |
| Page | `#041426` |
| Card | `#0b2033` |
| Raised content | `#102b40` |
| Inset controls | `#071a2c` |
| Borders | `#34576f` |
| Information accent | `#88d4ff` |
| Primary action | `#b5eb46` |

Hero cards share a restrained raised-to-card gradient. Leagues and tournaments use the same material; feature identity comes from their labels, approved glyphs and court/draw diagrams. Green, loss and warning states remain explicit in result chips and status notices.

Navigation, tool rows, shortcuts and rating-history entry points use the approved feature icon at 32px, with a 26px glyph and 9px tennis badge. The compact header uses a 26px icon with a 21px glyph. Colored icon backplates, per-feature size overrides and hover scaling are removed. Touch targets and selected-tab surfaces belong to their buttons; icons remain unboxed.

The scoreboard and Tactics court artwork stay unchanged. This pass changes native styles and theme metadata only, with no API, data, access, signing or artwork changes.

Verification uses the production native bundle with synthetic accounts and isolated network fixtures across My Lab, Explore, Chats, Compete, More and Coach. Chromium and WebKit checks cover 320px with enlarged root text and 390px at normal text, icon geometry, matching competition materials and horizontal overflow. Existing My Lab, navigation, league, tournament, Coach and captain interaction suites remain the functional regression checks. Physical iPhone and VoiceOver acceptance are separate.
