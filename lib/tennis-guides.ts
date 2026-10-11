export type TennisGuide = {
  slug: string
  title: string
  description: string
  published: string
  sections: Array<{ title: string; paragraphs: string[] }>
  nextHref: string
  nextLabel: string
}

// Examples explain the method; they are not player records or official USTA calculations.
export const TENNIS_GUIDES: TennisGuide[] = [
  {
    slug: 'read-your-tennis-rating',
    title: 'How to read your tennis rating beyond wins and losses',
    description: 'Use game share, opponent strength, and separate singles and doubles history to understand what a result says about your game.',
    published: '2026-10-10',
    sections: [
      { title: 'Start with the question the number answers', paragraphs: [
        'Your official USTA level and your TiQ rating serve different purposes. Use the official designation when checking league eligibility. Use TiQ as a competitive signal built from reviewed results. A TiQ movement is not an official promotion, demotion, or eligibility decision.',
        'Before comparing numbers, check the format and track. Singles evidence tells you about singles; doubles evidence includes a partner and two opponents. Overall combines competitive evidence. The USTA-proximity track uses eligible USTA results, while the TiQ track can include other reviewed competition. Comparing different tracks or formats can create a trend that the underlying results do not support.',
      ] },
      { title: 'Worked example: a close loss can beat expectation', paragraphs: [
        'Consider a hypothetical singles player rated 3.50 facing an opponent rated 4.00. The TiQ expected-game-share formula is 1 / (1 + 10 ^ ((opponent rating − your rating) / 1.6)). These inputs give the lower-rated player an expected share of about 32.8% of games. This is a game-share expectation, not a 32.8% chance of winning.',
        'Suppose the player loses 4–6, 4–6. They won 8 of 20 games, or 40%. That is about 7.2 percentage points above expectation. The score-aware part of TiQ therefore reads the performance positively despite the loss. A 1–6, 1–6 loss gives the player 2 of 14 games, about 14.3%, below the same expectation.',
        'Those figures explain the direction of the score signal, not the final rating change. Calibration, recency, rating protections, and other engine adjustments also matter. These examples assume ordinary completed sets; retirements, incomplete scores, and deciding tiebreaks require the correct score handling.',
      ] },
      { title: 'Read several matches before changing your plan', paragraphs: [
        'Open the recent results behind the rating. Look for the same format, recent dates, and several different opponents. Three strong doubles results with one partner may reflect a successful partnership; they do not establish the same improvement in singles. A small change supported by varied, complete results can be more useful than a larger change built on little history.',
        'Choose one court action from the evidence. If you repeatedly lose close sets to stronger opponents, track whether return games or service games decide those sets. If results vary sharply by partner, work on positioning and the first two shots together before treating the rating as a verdict on individual ability.',
      ] },
      { title: 'Check the record when a result looks wrong', paragraphs: [
        'Confirm the player identity, score, date, format, and opponents before interpreting an unexpected movement. A duplicate match or a result assigned to the wrong player is a data problem. Use Data Assist to request review of the factual record. Correcting the evidence lets the rating be recalculated; editing the number alone would hide the cause.',
      ] },
    ],
    nextHref: '/rankings', nextLabel: 'Compare ratings',
  },
  {
    slug: 'read-doubles-results',
    title: 'What a doubles result tells you about a partnership',
    description: 'Read all four players, the score, and repeated partnership evidence before choosing a doubles pair.',
    published: '2026-10-10',
    sections: [
      { title: 'Begin with all four players', paragraphs: [
        'A doubles result belongs to a matchup between two pairs. Your partner affects the expectation, just as both opponents do. A win-loss record without partner and opponent context can make a player look stronger or weaker than the evidence warrants. Start with doubles ratings and actual pairings rather than substituting singles strength.',
        'TiQ assesses doubles at the team level and maintains a separate doubles signal. Its engine also protects a stronger player from a speculative negative adjustment in qualifying close-loss situations with a materially weaker partner. That protection does not prove who played well or caused the loss. Scores cannot identify individual shot quality.',
      ] },
      { title: 'Worked example: equal records, different evidence', paragraphs: [
        'Imagine Pair A has won three matches together: 6–1, 6–2 against weaker opposition, then two deciding-tiebreak wins against comparable pairs. Pair B is also 3–0, with three straight-set wins against comparable opposition. These are hypothetical records, not actual TenAceIQ profiles.',
        'Both pairs are unbeaten. Pair A has shown it can finish tight matches, but its easiest result tells you less about readiness for stronger opponents. Pair B has more consistent evidence against a similar field. Neither record guarantees the next result. Check whether the same players appeared together, whether scores are complete, and how recently they played.',
        'Do not add deciding-tiebreak points to ordinary games yourself. A 10–8 deciding tiebreak is not ten service games won and eight lost. Preserve the score format so the engine can apply its score rules. Otherwise a close finish can overwhelm the meaning of the preceding sets.',
      ] },
      { title: 'Separate individual strength from pair fit', paragraphs: [
        'Ratings do not tell you whether two players communicate well, cover the middle, prefer the same return side, or recover calmly after a missed volley. Add those observations from practice and matches. A familiar pair with a clear serve-plus-one plan may be a better practical choice than higher-rated players who have never played together.',
        'For a short practice test, play a set with the proposed pair and record first-serve return quality, confusion over middle balls, and how often the server’s partner gets a playable first volley. Agree on one correction, then repeat. Keep observations separate from the rating so a small sample does not become a sweeping claim.',
      ] },
      { title: 'Make the lineup decision with the available evidence', paragraphs: [
        'Confirm availability and competition rules, then compare recent doubles history, shared matches, and opponent context. When a pairing has little history, call it uncertain rather than weak. Balance upside with the reliability your team needs on that court.',
        'Afterward, review the decision using what you knew beforehand. An unexpected loss does not automatically make the lineup choice wrong, and a narrow win does not prove the pair was safest. Use the new result and court observations to improve the next decision.',
      ] },
    ],
    nextHref: '/teams', nextLabel: 'Explore teams',
  },
  {
    slug: 'matchup-confidence',
    title: 'How much should you trust a tennis matchup estimate?',
    description: 'Check freshness, match coverage, format, and uncertainty before using a matchup estimate to prepare for a match.',
    published: '2026-10-10',
    sections: [
      { title: 'An estimate starts with the available record', paragraphs: [
        'A matchup estimate summarizes the evidence a model has. It cannot observe today’s injury, a new serve, a surface change, or partnership disagreement unless that information is represented in its inputs. Use the estimate to organize preparation, then add what you know about the players and conditions.',
        'A confidence label is not a guarantee that a prediction is correct. Rating calibration and match coverage explain how settled a signal is; prediction accuracy is a different question. Assessing accuracy requires predictions saved before matches and the outcomes that followed, rather than explanations produced after the result.',
      ] },
      { title: 'Worked example: the same gap, different uncertainty', paragraphs: [
        'Imagine two hypothetical matchups with the same 0.20 rating gap. In the first, both players have recent singles results against several opponents. In the second, one player has only two old results and most of the other player’s activity is doubles. The gap looks identical, but the supporting evidence is not.',
        'The first comparison offers a better basis for a singles decision because the evidence matches the format and is more current. In the second, missing singles history should make you cautious. It does not prove the less-documented player is worse. Look for recent, relevant results before relying on the apparent edge.',
        'Time away can reduce confidence in how current a rating is without reducing demonstrated playing strength. Do not interpret an inactive player’s old number as a complete picture of their current game, or assume inactivity itself is evidence of decline.',
      ] },
      { title: 'Check four things before acting', paragraphs: [
        'Check identity: is this the correct player, including location and team history? Check format: are you comparing singles evidence for singles, and the actual four players for doubles? Check freshness: how old are the supporting matches? Check coverage: are scores, opponents, and dates present, with enough variety to avoid relying on one unusual result?',
        'Head-to-head history adds context, but one meeting is a small sample. A previous result with different doubles partners answers a different question. If the record includes a retirement or incomplete score, read that limitation before treating it as a normal completed match.',
      ] },
      { title: 'Turn uncertainty into a preparation plan', paragraphs: [
        'When evidence is strong, choose a realistic match plan and an alternative if the opening games contradict your read. When evidence is sparse, use the warm-up and early games to check return depth, movement, and preferred patterns. Prepare for more than one style instead of inventing certainty from a precise-looking number.',
        'Keep a brief note before the match: expected challenge, planned response, and what would make you change tactics. Afterward, compare the note with what happened. This helps distinguish useful scouting from assumptions and gives you a practical reason to revisit the evidence.',
      ] },
    ],
    nextHref: '/matchup', nextLabel: 'Open matchups',
  },
]

export function getTennisGuide(slug: string) {
  return TENNIS_GUIDES.find((guide) => guide.slug === slug)
}
