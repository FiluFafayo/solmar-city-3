# Solmar City

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/FiluFafayo/solmar-city-3/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/FiluFafayo/solmar-city-3/reward.svg)](https://make.fun/c/gta6-01)

An original top-down open-world crime game in a sun-soaked coastal city of
its own. Explore Solmar on foot and by car, steal rides, outrun the Solmar
PD through a 0–5 star wanted system, and run three story jobs for Marco —
plus taxi and courier gigs that pay cash.

## Play

Serve `game/` with any static server and open `game/index.html` in desktop
Chrome. No network is needed; every file the game loads sits under `game/`.

- **WASD / arrows** — move on foot, drive in a car
- **E** — get in / out of a car (steal it if it is not yours)
- **F** — punch
- **Click or Space** — shoot (aim with the mouse)
- **Shift** — sprint
- **P / M** — pause / mute

## The city

Downtown towers, Old Town brick streets, a marina and beach, an industrial
port and quiet suburbs — traffic on the grid, pedestrians on the sidewalks,
police who chase, ram and shoot back, a HUD with a minimap and a route line
to every objective, and Web Audio synth for the engine, sirens and music.

## Entry

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to `/output` and writes `/output/dossier.json` with `buildDossier` from
`vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Built for the [make.fun GTA 6 bounty](https://make.fun/c/gta6-01).
