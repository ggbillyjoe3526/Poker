# All-In Poker

A No-Limit Texas Hold'em tournament you play in the browser against five computer opponents. Everyone starts with 1,500 chips, the blinds go up every 6 hands, and the last player with chips wins.

## Features

- **A full tournament, played by the real rules:** blinds with a dead button, heads-up order, minimum and incomplete raises, short all-in blinds, side pots, split pots with odd chips paid by position, and eliminations with final placings.
- **Opponents that read the betting.** Each opponent works out what the others probably hold from how they have bet this hand, and judges its own hand against that range rather than against random cards. A tight player's re-raise means more than a wild player's limp.
- **Position and short stacks.** Opening ranges depend on how many players are left to act, and short stacks shove or fold by a push/fold chart scaled to their stack.
- **Opponents that adapt to you.** They count how often each player (you included) plays a hand, raises, bets and folds to a bet, then bluff players who fold too much and value-bet thinner against players who call too much. Bet sizes are mixed and do not depend on hand strength, so the size never gives a hand away.
- **Eight personalities** with their own style and table talk: Emma, Lisa, Grace, John, Andrew, David, Michael and Tom. Point at (or Tab to) an opponent's name to see their style and what the table has seen of their play so far. Five of the eight sit down each game.
- **Three difficulty levels:** Easy opponents ignore your habits, judge hands roughly and call too much; Hard ones think longer, lean harder on your habits and shove tighter.
- **Seeded games.** Each game has one seed; "Same opponents again" deals the same cards whatever anyone does, and a computer-only game with the same seed replays exactly.
- **End-of-game recap** with hands won, biggest pot, best hand, best bluff, knockouts and final standings.
- Light and dark themes, sound effects, four game speeds, win odds for your hand, and a reduced-motion mode.

## Install and play

There is nothing to install and no build step. Download or clone the repository and open `index.html` in any modern browser (Chrome, Edge, Firefox or Safari):

```bash
git clone https://github.com/ggbillyjoe3526/Poker.git
cd Poker
open index.html        # macOS; on Windows double-click index.html, on Linux use xdg-open
```

You can also serve the folder with any static web server (for example `python3 -m http.server`) and open the address it prints.

Press **Start game**. When it is your turn the action panel (bottom right) lights up: fold, check or call, or set a bet with the slider or the preset buttons and raise. The title screen and the menu (top right) let you pick how strong the opponents are.

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

The menu (top right) has the opponents' difficulty (Easy, Normal or Hard, from the next game), the light/dark theme, sound, game speed, win-odds display and a reduced-motion option. Only these preferences are saved; a game in progress is not.

## How it's built

Plain HTML, CSS and JavaScript loaded as classic scripts, in this order:

| File | What it does |
| --- | --- |
| `js/util.js` | Seeded random numbers, card helpers, the hand evaluator and win-odds simulations |
| `js/data.js` | Tournament settings, blind levels and the opponent roster with each opponent's play style |
| `js/engine.js` | The rules, with no DOM: blinds and the dealer button, dealing, betting rounds, side pots, showdowns and eliminations |
| `js/range.js` | Hand ranges: what each opponent probably holds, read from how they have bet this hand and how they have played so far |
| `js/ai.js` | How opponents decide what to do, and the Easy, Normal and Hard settings |
| `js/portrait.js` | Silhouette avatars, or a picture if a player has one |
| `js/audio.js` | Sound effects synthesized with WebAudio |
| `js/ui.js` | Everything on screen: table layout, cards, chips, the action panel, menus and the end-of-game recap |
| `js/game.js` | Runs the engine in the browser and animates each step it reports |

Outside the page: `tests/` holds the Node tests and `tools/sim.js` the tuning simulations; both load the same DOM-free scripts (`util`, `data`, `engine`, `range`, `ai`) through `tests/load.js`.

The engine plays a hand through `playHand(table, io)`. Every step (a card dealt, an action, a pot paid) is reported to an `io` hook and awaited, which is where `game.js` animates. Only `io.decide` is required, so tests and simulations run hands with no page at all.

Each game has one seed. The deck and the AI draw from separate seeded streams, so "Same opponents again" deals the same cards whatever anyone does, and an AI-only game with the same seed replays exactly.

The table is drawn on a fixed 1600×900 stage that is scaled to fit the window.

## Tests

The tests use Node's built-in test runner (Node 18 or newer) and need no packages:

```bash
npm test
```

They cover hand ranking, blinds and the dead button, betting rules such as minimum and incomplete raises and short all-in blinds, side pots and split pots, eliminations, how opponents read ranges from the betting, position and push/fold play, the habit counts and how opponents exploit them, the difficulty levels and personalities, and full AI-only tournaments that check chips are conserved and seeds replay exactly. A few short seeded simulations (`tests/balance.test.js`) check that Hard beats Easy and that each personality plays the way its style hint says.

## Simulations

`tools/sim.js` plays whole computer-only tournaments with no page, which is how the opponents were tuned:

```bash
npm run sim                     # all three reports, 200 tournaments each
node tools/sim.js styles 1200   # how each personality places, and how it plays, on Normal
node tools/sim.js levels 400    # Easy, Normal and Hard head to head, same personalities on both sides
node tools/sim.js leaks 400     # how hard each level punishes a player who folds too much or calls too much
```

Results are seeded, so the same count always gives the same numbers.

## Roadmap

Phases 1 (foundations) and 2 (smarter opponents) are done. Next up is Phase 3, a ground-up visual redesign that also brings a phone (portrait) layout, touch controls and accessibility, then Phase 4, depth and replay value. See [ROADMAP.md](ROADMAP.md) for the summary and a link to the full roadmap, and [HANDOFF.md](HANDOFF.md) to pick the work up again.

## Custom avatars

See [portraits/README.txt](portraits/README.txt) to give any player, including you, a picture instead of a silhouette.

## Credits

The [Rubik](https://github.com/googlefonts/rubik) font is used under the SIL Open Font License; see [fonts/OFL.txt](fonts/OFL.txt).
