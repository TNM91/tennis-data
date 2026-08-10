# TenAceIQ Competition Format Support

TenAceIQ uses one shared competition-format registry so League, Club, Captain, lineup, messaging, and results tools read the same court structure. Imported names may select a known format automatically. Organizers can select a format directly, and unusual local formats can use an imported or custom scorecard.

## Team match formats

| Family | Supported scorecards | Typical use |
| --- | --- | --- |
| Adult | 2 singles + 3 doubles; 1 singles + 2 doubles; 1 singles + 4 doubles; 1 singles + 3 doubles | Adult 18 & Over, Adult 40 & Over, and local variants |
| Doubles | 1, 2, 3, or 4 doubles lines | Mixed, Combo, Adult 55/65/70+, ONE Doubles, local doubles, and club leagues |
| Tri-Level | Three rated doubles lines | Standard and Mixed Tri-Level with levels read from the league or flight name |
| Singles | 1, 2, 3, or 4 singles lines | Flex, singles leagues, club ladders, and TIQ team play |
| Team events | 2 singles + 1 doubles | Dominant Duo and similar two-player team events |
| Custom | Any imported or entered singles/doubles composition | Local, club, or future formats that do not match a preset |

## Tournament draw formats

- Single elimination
- Round robin
- Round robin with first-match consolation
- Modified feed-in consolation
- Compass draw
- Voluntary consolation
- First-match consolation
- Team tournament
- Feed-in consolation
- Curtis consolation
- Flighted draw

## Tool coverage

| Tool | Format behavior |
| --- | --- |
| League and Club setup | Offers every registered team scorecard and tournament draw format. |
| Data Assist | Reads league, flight, schedule, scorecard, and line-composition context. |
| Captain lineup | Builds the exact singles and doubles courts for the selected or detected format. |
| Scenario builder | Preserves saved court labels and player counts, including custom formats. |
| Availability and messaging | Carries the saved court structure into projected lineup communication. |
| Results and scorecards | Reads the same format when labeling courts and capturing match results. |
| Tournament Desk | Stores each supported draw type as a distinct format. |

## Launch regression coverage

Automated tests verify representative Adult, Mixed, Combo, Flex, ONE Doubles, Tri-Level, Dominant Duo, custom team scorecards, and every registered tournament draw. They also verify that every registry value remains allowed by the production database constraints.
