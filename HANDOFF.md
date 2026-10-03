# Handoff

Notes for picking this project up again, by a person or by Claude.

## Where things stand

- `main` holds everything: Phase 1 (foundations) and Phase 2 (smarter opponents) of the [roadmap](ROADMAP.md) are done and merged.
- `npm test` passes (Node 18 or newer, no packages). `npm run sim` runs the tuning simulations.
- The game is a static page: open `index.html`. No build step, no dependencies.
- Nothing is in progress and no branch carries unmerged work.

## What's next

1. **Phase 3: new look, phones and accessibility.** Start with the style frame (palette, type, tokens and a mock-up of the table, wide and tall) and get it signed off before building anything. The planned order and the free assets are in [ROADMAP.md](ROADMAP.md).
2. Two small items left over from Phase 1, both decisions for the owner rather than code:
   - switch on GitHub Pages (repository Settings, Pages, deploy from `main`, root folder) for a play-in-browser link;
   - choose a licence for the game itself (the bundled Rubik font is already OFL, with `fonts/OFL.txt`).
3. Phase 4 (depth and replay value) after that.

## How the work has been run

- **One branch per phase**, opened as a pull request into `main`; `main` only changes when the owner approves the merge.
- **Each phase is split into chunks** (one or two roadmap rows each). After each chunk the `critic` agent (`.claude/agents/critic.md`) reviews it independently and scores it 0 to 10:
  - 9 or above is accepted;
  - below 9, fix what it lists and send it back, at most 3 attempts per chunk, and the 3rd is accepted whatever it scores.
- Behaviour changes to the opponents are backed by simulations, not intuition: compare against a baseline with `tools/sim.js` (or a copy of the old code) on the same seeds, and on more than one seed set, since a few hundred tournaments still carry about ±0.05 of noise in average place.
- Code style: terse vanilla JS loaded as classic scripts (no modules, no build), short comments that say why. Match the surrounding code.
- All AI randomness comes from `t.aiRng` so a seeded game replays exactly; the AI never looks at hidden cards (only `t.acts`, the board and `p.seen`).

## Phase 2 results, for reference

- Critic scores: chunk 1 (read the betting) 8.7, 8.3, then accepted as its 3rd attempt; chunk 2 (position and short stacks) 7.8, 8.6, 8.7; chunk 3 (adapt to you, mixed sizing) 7.4, 9.0; chunk 4 (difficulty and personalities) 7.8, then its fixes went in without a second review; chunk 5 (simulations) was not reviewed. Both were stopped early so the phase could be wrapped up; see "Later work".
- Head to head (`node tools/sim.js levels 400`): Easy 3.86 vs Normal 3.14 average place; Normal 3.60 vs Hard 3.40; Easy 3.97 vs Hard 3.03.
- Against leaky human-like bots, Normal and Hard both punish folding too much and calling too much harder than Easy, but Hard only slightly more than Normal. Making Hard clearly harder against a human is a good follow-up.
- Adapting to habits clearly helps against leaky players and is neutral, within noise, between the computer players themselves.

## Later work (left over from Phase 2)

- Get the critic to review chunk 4's fixes (commit 69880fe, "Chunk 4 review fixes and chunk 5 tuning") and chunk 5 (the simulation tool and tuning in 9a349e9 and 69880fe), and fix anything it finds.
- Make Hard clearly harder against a human: against leaky bots it is only slightly tougher than Normal (folder -0.42 vs -0.41, caller -1.14 vs -1.13 big blinds per hand). Levers to try: how hard it leans on habits (`exploit`), thinner value bets against callers, bigger bluffs against folders.
- Personalities are not perfectly balanced: over 1,200 tournaments John (the calling station) averages place 3.97 and David (the rock) 3.08, with win rates between 13% and 19% against a fair 16.7%. Nobody dominates, but the loose styles lose more.
- Adapting to habits is neutral to slightly negative between computer players (about +0.025 average place over 2,000 games). Worth one more large run before further tuning.

## Restarting in a new session

1. Clone or pull `main`, run `npm test`, and open `index.html` to see the game.
2. Read this file, [ROADMAP.md](ROADMAP.md) and the README's "How it's built" section.
3. Create a branch for the phase (for example `phase-3-new-look`), split the phase into chunks, and run the critic loop above on each.
