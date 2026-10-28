# 🎅🧪 Scientist Santa vs. the Superbugs

A polished 2D Christmas endless runner for the **BI Christmas AI Challenge**. It runs entirely in a desktop web browser: no backend, no API keys and no internet connection required at runtime.

> It is Christmas Eve. Scientist Santa, wearing a white lab coat over his red suit, must deliver the last presents, and tonight his route runs straight through the **North Pole Pharma Labs**. The Grumpus wants to stop Christmas, so he hovers above the lab benches lobbing **Gram-positive**, **Gram-negative** and the occasional **multidrug-resistant (MDR)** superbug at Santa. Santa carries one dose of each antibiotic… but nothing works on MDR.

---

## Table of contents

- [Gameplay](#gameplay)
- [Controls](#controls)
- [Bacteria and antibiotics](#bacteria-and-antibiotics)
- [Scoring](#scoring)
- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Deploying to GitHub Pages](#deploying-to-github-pages)
- [Replacing placeholder art and audio](#replacing-placeholder-art-and-audio)
- [Balancing guide](#balancing-guide)
- [Testing and quality checks](#testing-and-quality-checks)
- [AI assistance](#ai-assistance)
- [About the microbiology](#about-the-microbiology)
- [Known limitations and future ideas](#known-limitations-and-future-ideas)
- [Attribution and license](#attribution-and-license)

---

## Gameplay

- Santa **runs automatically** from left to right while the laboratory scrolls past in layered parallax: snowy windows, bioreactors, incubators, glassware, monitors, Christmas trees, garlands and gift piles.
- The **Grumpus** appears from time to time on a hover platform in the background, throws bacteria, taunts Santa and gives a loud warning before releasing an MDR superbug. You never fight him directly.
- **Jump**, **duck**, fast-fall or change levels to dodge bacteria and virus torpedoes. The lower floor remains a fallback route; raised lab shelves are optional alternatives.
- **Competition** is the default: threats arrive within seconds and every 0.65 s at the physics limit. Mechanics are introduced in order: normal bacteria and both actions, lab walkways and fast-fall (~4 s), the first virus torpedo (~20 s), then MDR. After that, authored platform sections make up roughly half of the run. **Training** keeps the same mechanics with longer reaction windows, longer torpedo warnings, more antibiotics and a slower ramp.
- Hold **↓ while airborne** to tuck and fall faster. Torpedoes are separate, always-lethal projectiles with a warning at the right edge (showing the targeted level and the needed action); antibiotics and post-hit invulnerability do not protect against them.
- Press **H** during a run to toggle the one-time gameplay hints on or off.
- Collect **gingerbread cookies** for bonus points and **antibiotic pickups** to refill empty slots.
- Every **500 m**, Santa passes a *Present Dispatch* station and automatically delivers a present (+500 points, confetti, no interruption).
- Difficulty rises quickly with distance (speed, spawn rate, pattern complexity and MDR probability) up to a finite speed cap. Brief preparation, surge and breathing phases vary the rhythm.

Game flow: **Boot → Main menu → (How to Play) → Intro cutscene (skippable) → Run → Pause → Game over → Restart / Main menu**.

## Controls

| Action | Keys |
| --- | --- |
| Jump (hold for full height) | `Space` or `↑` (also `W`) |
| Duck while grounded (hold to stay low; tap ducks briefly) | `↓` (also `S`) |
| Fast-fall while airborne | Hold `↓` (also `S`) |
| Toggle first-time gameplay hints | `H` |
| Pause / resume | `Esc` (also `P`) |
| Mute / unmute | `M`, or the speaker icon in the HUD |
| Menus | `↑` `↓` (or `←` `→` on the game-over screen), `Enter` / `Space` to select, mouse works too |
| Intro | `Enter` / `Space` / click to advance, `Esc` to skip |

Optional touch support: tap the right half of the screen to jump and hold the left half to duck. The game also pauses automatically when the browser window loses focus.

## Bacteria and antibiotics

Bacteria are identified by **shape, outline, symbol and animation**, not by colour alone:

| Threat | Look | How to survive |
| --- | --- | --- |
| **Gram-positive** | Round grape-like cluster, very thick outline, **“+”** symbol, gentle wobble | Dodge it, or touch it while your **Gram+ antibiotic** is READY (the dose is used up) |
| **Gram-negative** | Rod (capsule) shape, double dashed outline, wiggly flagella, **“−”** symbol | Dodge it, or touch it while your **Gram− antibiotic** is READY (the dose is used up) |
| **MDR superbug** | Large spiky mutated silhouette, red hazard ring, **⚠** triangle with “MDR”, spins | **Always dodge it.** No antibiotic works. An off-screen warning tells you to **JUMP!** or **DUCK!** |
| **Virus torpedo** | Fast pointed projectile with a red level-warning indicator | **Always dodge it.** Jump, duck or change routes; antibiotics and invulnerability do not work. |

Bacteria travel in three lanes, each with exactly one correct response:

- **Floor level:** jump over it.
- **Head height:** duck under it.
- **High flyer:** keep running and *don't* jump.
- **Lab walkways and top shelves:** hold jump to climb a level, run off an edge or fast-fall to drop. Santa can run under a walkway, but some sections block the floor (or the walkway) with MDR, so no single level is always safe. Every section is checked for at least one survivable route before it spawns.

**Antibiotic rules**

- Santa starts each run with **one Gram+ and one Gram− dose**. Each slot holds **at most one** dose.
- Touching a normal bacterium with the matching dose READY **consumes** it, grants a short invulnerability window and deducts points. Skilled players can dodge normal bacteria to preserve doses.
- Without the matching dose the run ends. MDR always ends the run.
- MDR bacteria and virus torpedoes are lethal even while invulnerable.
- Antibiotic pickups match the visual language of the bacteria they counter: a purple/white **capsule with “+”** and a pink **vial with “−”**, both with a white glow and a green medical cross so they read as medicine.
- A pickup only refills its **own, empty** slot.
- **Design choice for full slots:** if you touch a pickup whose slot is already READY, it is **left in place** (dimmed) with a small “Already stocked” hint. Pickups have a minimum cooldown, are less likely to match an empty slot than before, and some appear on a riskier—but always survivable—jump or crouch path.
- The HUD always shows both slots: **`GRAM+ ANTIBIOTIC: READY / EMPTY`** and **`GRAM− ANTIBIOTIC: READY / EMPTY`**.

## Scoring

| Source | Points (configurable) |
| --- | --- |
| Distance | 1 per metre |
| Gingerbread cookie | 100 each |
| Present delivery (every 500 m) | 500 each |
| Protected collision | −125 in Competition; −75 in Training |

The game-over screen shows the cause of defeat (with a cause-specific, family-friendly message), distance, cookies, presents, final score and the **best score for this browser**. The best score is stored in `localStorage`; if storage is unavailable (private mode, blocked cookies), the game falls back to in-memory storage and keeps working.

## Technology stack

- **TypeScript** (strict mode, no `any`)
- **Phaser 3.90** with **Arcade Physics**
- **Vite 8** for development and static builds
- **Vitest** for unit tests and **ESLint** (typescript-eslint) for linting
- Web Audio API for synthesized placeholder sound effects and music

All artwork in this version is **procedurally generated** at runtime with the Canvas 2D API. No external images or audio files are required.

## Project structure

```
├── index.html                  # Page shell (canvas container, small-screen hint)
├── public/
│   ├── favicon.svg
│   └── assets/                 # Optional replacement assets (see below)
│       ├── asset-manifest.json
│       ├── characters/ enemies/ pickups/ environment/ ui/ audio/
├── src/
│   ├── main.ts                 # Phaser game config (FIT scaling, key capture, scenes)
│   ├── style.css
│   ├── config/
│   │   ├── balance.ts          # ⚖️ All gameplay and balancing values
│   │   ├── layout.ts           # Resolution, lane heights, hitboxes, depths
│   │   └── theme.ts            # Colours and fonts
│   ├── logic/                  # Pure, Phaser-free game rules (unit tested)
│   │   ├── AntibioticInventory.ts
│   │   ├── collisionRules.ts   # Contact outcome + defeat messages
│   │   ├── difficulty.ts       # Speed / spawn / unlock progression with caps
│   │   ├── fastFall.ts         # Bounded aerial fast-fall physics helpers
│   │   ├── IntensityWave.ts    # Preparation, active, surge and breathing phases
│   │   ├── PlatformPlanner.ts  # Section validation, eligibility and selection
│   │   ├── platformPatterns.ts # 14 authored platform sections with explicit routes
│   │   ├── routeSimulator.ts   # Replays routes with the real movement/collision rules
│   │   ├── RunState.ts         # Distance, cookies, presents, score, defeat
│   │   ├── scoring.ts          # Score + delivery checkpoint maths
│   │   ├── SpawnPlanner.ts     # Fair obstacle/collectable pattern generation
│   │   └── torpedoRules.ts     # Safe simultaneous-action selection
│   ├── entities/               # Player, bacteria, torpedoes, collectables and Grumpus
│   ├── systems/                # Spawn/platform/torpedo directors, warnings, input, save, settings
│   ├── scenes/                 # Boot, Menu, HowToPlay, Intro, Game, Pause, GameOver
│   ├── ui/                     # HUD, menu buttons/lists, toasts, text styles
│   ├── graphics/               # Procedural art, texture keys, asset manifest parsing
│   ├── audio/                  # AudioManager + sound recipes
│   ├── types/                  # Shared domain types
│   └── utils/                  # Math, seeded RNG, Escape-key helper
├── tests/                      # Vitest unit tests for the pure logic
└── .github/workflows/deploy-pages.yml
```

**Architecture in short:** game rules live in `src/logic` and know nothing about Phaser. `GameScene` composes them with Phaser systems (spawn director, parallax, effects, HUD, audio). Entities only reference texture *keys*, so placeholder art can be swapped without touching gameplay code. Shared services (save, settings, audio, balance) are stored in the Phaser registry rather than in global variables, and every scene removes its listeners on shutdown, so restarting never duplicates listeners or leaks objects.

## Getting started

### Prerequisites

- **Node.js 20.19+ or 22.12+** (Node 22 LTS or 24 LTS recommended)
- **npm** (bundled with Node.js)
- A modern desktop browser (Chrome, Edge, Firefox or Safari)

### Install

```bash
npm install
```

### Local development

```bash
npm run dev
```

Open the printed URL (usually http://localhost:5173). Changes hot-reload.

### Production build

```bash
npm run build
```

This type-checks the project and writes a static site to `dist/`.

### Preview the production build

```bash
npm run preview
```

### Useful URL flags

- `?hitboxes` shows Arcade Physics hitboxes.
- `?debug` exposes the Phaser instance as `window.santaGame` and, in development builds, shows an overlay with mode, difficulty, speed, platform section, current level, valid route IDs, spawn interval, antibiotic cooldown, MDR/torpedo probability, warnings, wave phase and fast-fall state.
- `?pattern=MDR_ROUTE_BLOCK` (development builds only) repeats one platform section from the start of a run for playtesting. Any ID from `platformPatterns.ts` works.

> The npm scripts call each tool's JavaScript entry point through `node` (for example `node ./node_modules/vite/bin/vite.js`) instead of the `.bin` shims. Node.js itself must still be installed and permitted by local security policy.

## Deploying to GitHub Pages

The Vite config uses a **relative base path** (`base: './'`), so the build works under any repository sub-path (`https://<user>.github.io/<repository>/`) without hardcoding the repository name. Runtime assets are loaded relative to the page as well.

### Option A: GitHub Actions (recommended)

The repository includes `.github/workflows/deploy-pages.yml`, which on every push to `main` (or when run manually):

1. installs dependencies with `npm ci`,
2. runs type checking, linting and unit tests,
3. builds the game, and
4. uploads `dist/` and deploys it with the official `actions/upload-pages-artifact` and `actions/deploy-pages` actions. Deployment only runs after a successful build.

One-time setup: go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**. Push to `main`; the URL appears in the workflow summary.

### Option B: manual deployment

1. `npm run build`
2. Publish the **contents** of `dist/` to the branch or folder GitHub Pages serves (for example, push them to a `gh-pages` branch and select it under **Settings → Pages → Deploy from a branch**).

## Replacing placeholder art and audio

Every texture is generated procedurally **unless an asset with the same key is loaded first**. To use final art:

1. Put files under `public/assets/` (suggested folders: `characters/`, `enemies/`, `pickups/`, `environment/`, `ui/`, `audio/`).
2. Declare them in `public/assets/asset-manifest.json` using the texture or sound keys below. Paths are relative to `public/assets/`.

```json
{
  "images": {
    "santa-run-0": "characters/santa-run-0.png",
    "bacterium-gram-positive": "enemies/gram-positive.png",
    "env-wall": "environment/lab-wall.png"
  },
  "spritesheets": {
    "santa-run": { "path": "characters/santa-run-sheet.png", "frameWidth": 96, "frameHeight": 112, "frameRate": 12 }
  },
  "audio": {
    "jump": "audio/jump.ogg",
    "music": ["audio/music.ogg", "audio/music.mp3"]
  }
}
```

Missing or broken files only log a warning and fall back to the procedural placeholder, so the game is always playable.

**Texture keys** (see `src/graphics/textureKeys.ts`):

| Group | Keys | Notes |
| --- | --- | --- |
| Santa | `santa-run-0..3`, `santa-jump`, `santa-fall`, `santa-crouch`, `santa-fast-fall`, `santa-hit`, `santa-defeat` | 96×112 frames, feet at the bottom centre. A `santa-run` sprite sheet replaces the run frames. |
| Grumpus | `grumpus-idle`, `grumpus-throw`, `grumpus-warn`, `grumpus-platform` | 120×150 figure, 180×64 platform |
| Bacteria | `bacterium-gram-positive`, `bacterium-gram-negative`, `bacterium-mdr` | Hitboxes are centred circles (`HAZARD_HITBOX_RADIUS` in `layout.ts`) |
| Hazards | `hazard-virus-torpedo` | Separate always-lethal projectile; its warning communicates the required dodge action |
| Pickups | `antibiotic-gram-positive`, `antibiotic-gram-negative`, `cookie-gingerbread`, `present-box` | |
| Environment | `env-night`, `env-snow`, `env-wall`, `env-equipment`, `env-benches`, `env-floor`, `env-delivery-station`, `env-lab-building`, `env-moon`, `env-lab-platform` | Parallax layers tile horizontally; the wall needs transparent windows |
| Particles / UI | `particle-dot`, `particle-star`, `particle-confetti`, `particle-ring`, `particle-crumb`, `ui-warning`, `ui-shield`, `ui-sound-on`, `ui-sound-off` | |

If replacement art uses different proportions, adjust `PLAYER_FRAME`, `PLAYER_BODY` and the lane heights in `src/config/layout.ts`.

**Sound keys** (see `src/audio/soundKeys.ts`): `jump`, `crouch`, `cookie`, `antibiotic-pickup`, `already-stocked`, `protected`, `delivery`, `mdr-warning`, `torpedo-warning`, `torpedo-impact`, `grumpus-throw`, `defeat`, `ui-move`, `ui-select`, `pause`, plus `music` for the background loop. Without files, short original tones are synthesized with Web Audio. Sound is optional and every event also has a visual cue.

## Balancing guide

All tuning values live in **`src/config/balance.ts`** (`COMPETITION_BALANCE`, `TRAINING_BALANCE`, and `DEFAULT_BALANCE`, which aliases Competition), with units documented on each field. The main-menu difficulty option persists the selected preset:

| Area | Competition / Training values |
| --- | --- |
| Player | Competition starts at 540 px/s (Training 380); capped at 900 (760), with progression of 1.0 (0.14) px/s per metre. Fast-fall acceleration, target speed and terminal speed, jump physics and bounded crouch timings live under `player`. |
| Spawning | Competition interval 0.65 s from the start (was 0.98 s initial / 0.82 s minimum); this is the physics floor, i.e. one 0.6 s jump flight plus `actionTransitionBufferSeconds` 0.05 s. Training 2.1→1.2 s. Breathing windows 0.6–1.2 s (Training 2–4 s). `patternWeights` controls each pattern's unlock distance, minimum difficulty, early/late weight and repeat cooldown. |
| Reaction fairness | Normal spawns keep the physics floor between threats. Platform sections are replayed by `routeSimulator.ts` (jump/coyote/buffer, bounded crouch, fast-fall, one-way shelves, real hitboxes) at the speeds they will be played at, with every input `routeTimingToleranceSeconds` early or late (40 ms Competition, 70 ms Training). |
| Platforms | Shelves unlock at 60 m (Training 140 m); 20–45 m of normal play between sections (Training 90–150 m). Levels are 118 px apart with 16 px shelves (10 px headroom below, ~18 px below the real jump apex). Entry/exit clearances, input spacing, pool size and per-section unlocks, weights, cooldowns and speed ranges live under `platforms`. |
| MDR | Unlocks at 340 m (600 m), right after the first torpedo; probability ramps from 0.24 to a capped 0.40 (0.10 to 0.25), with 135 m minimum spacing, 1.9 s clearance, and configurable warning duration. Mixed MDR/torpedo sections need both threats met separately and 600 m (1100 m). |
| Virus torpedoes | Competition unlocks at 300 m (Training 480 m); the first launch follows after 1.5 s (≈20 s into a run). Relative speed 760 px/s (1300–1660 px/s on screen vs 540–900 px/s for bacteria). Warning 1.05 s shortening to 0.9 s (Training 1.6→1.3 s), probability 0.55→0.80 (0.35→0.58), every 4.5–7 s (10–14 s). Random torpedoes never fire inside platform sections or before nearby bacteria are known. |
| Antibiotics | Competition interval 480–760 m, 42 s cooldown, 0.62 chance and at most one per 520 m: measured ~6.9 pickups per 10 km vs ~18.5 with the previous settings (−63%). Training 210–340 m, 16 s, 0.9 chance, two per 500 m (~24 per 10 km). Walkway "medicine" routes use the same budget. An empty slot only slightly raises the chance of its type (`preferMissingChance` 0.08). |
| Cookies | `chancePerPattern`, `riskPlacementChance`, `riskOffsetSeconds`, jump-arc chance, crouch-path placement, row spacing, score and maximum row length. Risky paths are filtered against nearby hazards. |
| Scoring / deliveries | `pointsPerMeter`, `deliveries.intervalMeters`, `deliveries.score`, and configurable protected-collision score penalty. |
| Collision / effects | `invulnerabilityMs`, `protectedRecoveryMs`, `protectedCollisionPenalty`, `screenShakeIntensity`, `screenShakeDurationMs` |

Tips:

- Speed is clamped to `maxWorldSpeed`; reaching the cap also caps the distance-based difficulty level (0–1), which drives spawn intervals, pattern weights and MDR probability.
- The catalogue includes low→high, high→low, Gram switches, resource/cookie temptations, false rhythms, mixed-height chains, MDR warning variants and delivery rushes. Recent-pattern cooldowns reduce repetition; surges weight multi-step patterns more heavily.
- Platform sections (`platformPatterns.ts`) place shelves, bacteria, torpedoes and rewards in one pixel coordinate system, so they stay aligned at any speed. Each declares required mechanics, entry/exit levels, reaction window, warning time, pickup and MDR eligibility, speed range, cooldown, weight and explicit input routes. A section is only spawned when a route survives at its expected speeds; it reserves its stretch of the world so normal bacteria and random torpedoes stay out of it.
- Keep the physics-derived reaction window and MDR clearance above the required action-transition timing. The planner uses a larger gap after an MDR sequence so a protected hit never removes the next dodge opportunity.
- Cookies and some antibiotic pickups can use the configured risky jump or crouch path. Pickup cooldowns prevent spam, and the planner rejects placements that conflict with an obstacle. Torpedoes are lethal regardless of inventory and do not consume antibiotics.
- Run `npm test` after tuning: seeded fairness tests exercise thousands of metres of generated patterns.
- Lane heights in `layout.ts` were derived from the jump arc and hitboxes. If you change `gravity` or `jumpVelocity` significantly, re-check that the high lane is still reachable by a jump.

## Testing and quality checks

```bash
npm run typecheck   # strict TypeScript
npm run lint        # ESLint + typescript-eslint
npm test            # Vitest unit tests
npm run build       # type check + production build
```

The unit tests cover antibiotic capacity and restocking, correct and missing antibiotic outcomes, MDR and torpedo lethality, fast-fall activation and clamping, route simulation, platform-section validation across each preset's full speed range, entry/exit and unlock gating, repeat prevention, seeded section selection, torpedo unlock timing and warning/probability progression, antibiotic scarcity, difficulty clamping, delivery checkpoints, asset-manifest validation, the best-score storage fallback and **spawn fairness**. Seeded normal-spawn timelines are also replayed through the movement simulator with ±40 ms timing errors.

The game was also played in the browser by a scripted bot that executes each section's validated route in the real Phaser physics: all sections were cleared without a hit, across all three levels, and five consecutive restarts kept collider, body and pool counts constant. After changing physics or sections, recheck landings, warnings and both modes in the browser as well.

## AI assistance

This project was created for an AI development competition and was built with heavy AI assistance:

- **AI-generated (with human direction):** the architecture, all TypeScript source code, procedural artwork, synthesized sound design, the original background loop, unit tests, the GitHub Actions workflow and this README were produced by an AI coding assistant working from a detailed design brief written by the team.
- **Human-defined:** the game concept, story, rules (Gram-positive/Gram-negative/MDR mechanics, inventory limits, scoring), the acceptance criteria and the review of the result.
- **Planned next step:** replacing the procedural placeholders with final AI-generated character and environment art through the asset manifest described above.

## About the microbiology

The mechanics are **intentionally simplified for entertainment and educational awareness**. Real infections, antibiotic choice and resistance are far more complex, and nothing in this game is medical advice. The game simply plays with three real ideas: bacteria are often grouped as Gram-positive or Gram-negative, different antibiotics target different bacteria, and multidrug-resistant bacteria are a serious problem that is better avoided than treated.

## Known limitations and future ideas

**Limitations**

- Placeholder art and synthesized audio are procedural; final illustrated sprites, music and recorded sound effects are still to come.
- Designed for desktop keyboards. Touch controls are basic and there is no on-screen button overlay.
- Best score is stored per browser only (no online leaderboard, by design: no backend).
- The production bundle is about 1.3 MB (≈350 kB gzipped), mostly Phaser itself.

**Future enhancements**

- Final AI-generated sprite sheets for Santa, the Grumpus, bacteria and the lab, plus original music.
- More obstacle patterns (moving lab equipment, conveyor belts), power-ups and seasonal events.
- Accessibility extras: remappable keys, a high-contrast mode and a colour-blind palette toggle.
- Gamepad support and an optional on-screen touch overlay.
- Localisation (e.g. Spanish/Catalan).

## Attribution and license

- **Code and procedural assets:** © 2026 *[Team / author names]*. License: *[choose a license, e.g. MIT]*.
- **Third-party libraries:** [Phaser](https://phaser.io/) (MIT), [Vite](https://vitejs.dev/) (MIT), [Vitest](https://vitest.dev/) (MIT), [TypeScript](https://www.typescriptlang.org/) (Apache-2.0), [ESLint](https://eslint.org/) (MIT).
- **Art and audio:** all current visuals and sounds are original and generated in code. List any future asset sources and their licenses here: *[asset, author, license]*.
- **Characters:** Scientist Santa and the green antagonist **The Grumpus** are original characters created for this project.
