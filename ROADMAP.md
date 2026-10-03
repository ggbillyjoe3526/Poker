# Roadmap

The full roadmap, with the reasoning and the code locations behind each item, is a shared document:
**[All-In Poker Roadmap](https://claude.ai/code/artifact/bf0560d8-354f-4206-965d-ed8315ba223f)**. This file is the short version and the record of what has shipped.

## Phase 1: Foundations (done)

- Split the rules from the animation: `js/engine.js` plays hands with no DOM, `js/game.js` animates what it reports.
- Engine test suite (`npm test`, Node's built-in runner, no packages).
- Fully seeded runs: the deck and the AI draw from separate seeded streams.
- Dead code removed; README and the font licence added.
- Still open: switch on GitHub Pages for a play-in-browser link (a repository setting), and choose a licence for the game itself.

## Phase 2: Smarter opponents (done)

- **Read the betting:** hand ranges built from each player's actions (`js/range.js`), with equity sampled against those ranges.
- **Use position:** opening ranges by players left to act; position-aware calls and re-raises.
- **Better short-stack play:** push/fold charts by stack, position and limpers.
- **Less readable sizing:** mixed bet sizes that do not depend on hand strength.
- **Adapt to you:** every player's habits are counted (hands played, raises, bets per chance, folds to bets) and exploited.
- **Difficulty setting:** Easy, Normal and Hard in the menu and on the title screen.
- **Distinct personalities:** eight characters with a style hint, their own lines, and a seat tip with what the table has seen of their play.
- **Tune with simulations:** `npm run sim`, plus quick seeded balance tests.

## Phase 3: New look, phones and accessibility (next)

Opens with a ground-up visual redesign: minimal and professional, in the spirit of the big online poker apps.

1. Redesign: look and style frame (palettes, type, tokens, a mock-up of the table, wide and tall) for sign-off before any build.
2. Redesign: responsive table placed from the screen's shape instead of the fixed 1600×900 stage.
3. Redesign: SVG cards with large indices, court art and a four-colour option.
4. Redesign: SVG chips and a pot that shows its chips.
5. Redesign: seat pods with avatar, stack, turn timer and clear folded, all-in and out states.
6. Redesign: controls and screens restyled into the same system, with real icons.
7. Redesign: animation pass (dealt arcs, flips, chips that settle, pot pushed to the winner).
8. Then: portrait layout, touch-friendly controls, screen reader support, a four-colour deck option, a clearer odds label (or range-aware odds), smoothness on slow phones (odds in a Web Worker), installable and offline.

Planned free assets, all CC0 or permissive: RevK SVG playing cards (CC0), Byron Knoll cards as a backup (CC0), Lucide icons (ISC), the Inter typeface (OFL), Open Peeps avatars (CC0), ambientCG felt and wood textures (CC0).

## Phase 4: Depth and replay value

Save and resume, career stats, a full hand history with replay, a daily challenge seed, tournament options (stacks, levels, table size, antes), coaching hints, and music.
