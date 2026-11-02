# Native premium visual pass

The native app keeps the scoreboard first, followed by the results behind it and the next training step. This pass refines that hierarchy using the existing navy, ice-blue and lime palette.

- The scoreboard has clearer rating labels, larger discipline values and a restrained status accent. USTA remains a current published level; all dynamic values remain TIQ.
- Recent form uses a lime win-rate ring, with the existing individual-court sample and scorecard actions. The result-insight controls wrap naturally at larger text sizes instead of always occupying two rows on phones.
- Rating history has more legible summary values, clearer plot labels and additional chart height. History remains opt-in and uses the existing bounded queries.
- Coach gives Tactics a featured court entry. Compete distinguishes leagues and tournaments with blue and green surfaces. Existing destinations and access checks are unchanged.
- Chats retain the same layout, draft, reading and unread behavior, with quieter message surfaces and a clearer composer/send action.
- A loading placeholder reserves scoreboard space without displaying invented ratings. Reduced Motion disables its opacity animation.

`mobile/src/premium-surfaces.css` is the final native stylesheet, included explicitly in the package by `mobile/scripts/build-bundled.mjs`. It scopes the finishing styles to native app screens. It does not change the website theme or imported brand masters.

The featured court uses the complete approved `public/brand/courts/tiq-native-ace-deuce-refined-20261031-v3.png` proportionally. No new raster assets, crop, mirror, filter or athlete alteration is introduced. Brand files are unchanged.

Verification uses the actual minified native bundle with synthetic player, result and chat data. Preview data and harnesses stay in ignored `tmp/`; they are not packaged. Phone rendering, text enlargement, overflow, navigation, chart, draft and loading checks are distinct from physical iPhone/VoiceOver acceptance.
