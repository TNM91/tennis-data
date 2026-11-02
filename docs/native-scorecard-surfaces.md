# Native scorecard and competition detail refinement

Match details now lead with a recorded result and score, followed by the league, set-by-set table and participant sides. The existing match-result and score-orientation helpers remain unchanged. Neutral/public views keep their original sharing restrictions. Winner scores retain their underline as well as the new surface accent; labels and the deciding match-tiebreak explanation remain available.

League and tournament standings have visible saved list positions, clear entrant names, separate record lines and their existing match-history actions. Search preserves source positions and indices. These positions do not introduce a new ranking or a tie-break rule. Team results and individual court wins remain separate; incomplete standings stay withheld.

Tournament draw cards separate the two published opponents, round, recorded winner/score and court assignment. Pending matches retain their pending state. No bracket connections, scores, player comparisons or statistics are inferred. Competition headers, view controls, metrics, empty states and cards share the existing navy surfaces and discipline accents.

All styling is native-only in the existing final premium stylesheet. Brand artwork, calculations, endpoints, data bounds, authentication, permissions and native signing inputs are unchanged. There are no new dependencies or raster assets.

## Verification scope

The affected phone-browser fixtures now load the shipped premium stylesheet. Checks cover local standings filters, saved positions, exact entrant histories, stale/account-changed responses, incomplete samples, scorecard navigation and enlarged long names. A targeted three-set scorecard case checks correct orientation, table containment at a 24px root text size, a deciding tiebreak, long participant names and return focus at 320 and 390 pixels.

The actual minified native bundle is also reviewed with isolated synthetic match, league and tournament records; its preview blocks live network access. Physical iPhone, keyboard and VoiceOver acceptance remain device checks. Release evidence is recorded separately for the final candidate.
