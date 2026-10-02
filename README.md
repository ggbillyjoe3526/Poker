# All-In Poker

A No-Limit Texas Hold'em tournament you play in the browser against five computer opponents. Everyone starts with 1,500 chips, the blinds go up every 6 hands, and the last player with chips wins.

## Play

Open `index.html` in any modern browser. There is nothing to install and no build step.

| Key | Action |
| --- | --- |
| F | Fold |
| C | Check or call |
| Space | Check (never calls a bet) |
| R | Bet or raise the amount on the slider |
| A | All in (press twice to confirm with a big stack) |
| ↑ ↓ ← → | Change the bet size (or scroll on the slider) |
| P | Pause |
| H | How to play |
| Esc | Close menus |

The menu (top right) has the light/dark theme, sound, game speed, win-odds display and a reduced-motion option. Only these preferences are saved; a game in progress is not.

## How it's built

Plain HTML, CSS and JavaScript loaded as classic scripts, in this order:

| File | What it does |
| --- | --- |
| `js/util.js` | Seeded random numbers, card helpers, the hand evaluator and win-odds simulations |
| `js/data.js` | Tournament settings, blind levels and the opponent roster with each opponent's play style |
| `js/engine.js` | The rules, with no DOM: blinds and the dealer button, dealing, betting rounds, side pots, showdowns and eliminations |
| `js/ai.js` | How opponents decide what to do |
| `js/portrait.js` | Silhouette avatars, or a picture if a player has one |
| `js/audio.js` | Sound effects synthesized with WebAudio |
| `js/ui.js` | Everything on screen: table layout, cards, chips, the action panel, menus and the end-of-game recap |
| `js/game.js` | Runs the engine in the browser and animates each step it reports |

The engine plays a hand through `playHand(table, io)`. Every step (a card dealt, an action, a pot paid) is reported to an `io` hook and awaited, which is where `game.js` animates. Only `io.decide` is required, so tests and simulations run hands with no page at all.

Each game has one seed. The deck and the AI draw from separate seeded streams, so "Same opponents again" deals the same cards whatever anyone does, and an AI-only game with the same seed replays exactly.

The table is drawn on a fixed 1600×900 stage that is scaled to fit the window.

## Tests

The tests use Node's built-in test runner (Node 18 or newer) and need no packages:

```bash
npm test
```

They cover hand ranking, blinds and the dead button, betting rules such as minimum and incomplete raises, side pots and split pots, eliminations, and full AI-only tournaments that check chips are conserved and seeds replay exactly.

## Custom avatars

See [portraits/README.txt](portraits/README.txt) to give any player, including you, a picture instead of a silhouette.

## Credits

The [Rubik](https://github.com/googlefonts/rubik) font is used under the SIL Open Font License; see [fonts/OFL.txt](fonts/OFL.txt).
