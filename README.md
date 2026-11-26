# Merapi Dawn Run

A flight game for the make.fun bounty
[Make the best flight game](https://make.fun/bounty/best-flight-game-20261126-0057)
($500, free entry, closes 2026-11-28 00:57 UTC).

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/endog-ai/merapi-dawn-run/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/endog-ai/merapi-dawn-run/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

You are a bush pilot flying the dawn mail run across a volcanic Indonesian
archipelago in the mail plane **PK-MRP**. Take off from Pulau Landas,
thread eight glowing rings over rice terraces, villages and the smoking
volcano, then land gently on the short island strip at Pulau Dermaga.

- **Rings** pay 500 points each (up to +200 for dead centre) and add
  12 seconds. Miss one and you can turn back for it.
- **Landing** pays up to 1,800 for a smooth, centred touchdown, plus
  time and fuel bonuses. Land too hard, too fast or banked and you crash.
- **Fuel** drains with throttle; run dry and you glide. Stall below
  about 70 km/h with a warning. Flaps slow you for landing.

## Play

Open `game/index.html` in desktop Chrome. It plays offline from its own
files — no network request, no libraries.

| Key | Action |
| --- | ------ |
| W / S | Throttle up / down |
| Arrow keys | Pitch (climb / dive), bank and turn |
| Mouse | Steer (move), hold click for throttle |
| F | Flaps |
| C | Chase view / cockpit view (lit instruments) |
| P | Pause · M · Sound · R · Fly again |

The HUD shows speed, vertical speed, altitude and height above ground,
a compass strip, throttle and fuel, score, countdown, rings flown, a
next-ring pointer with distance, and a live minimap. The cockpit view
adds an attitude indicator, airspeed and altimeter dials, fuel and
throttle gauges, and stall / low-fuel warning lights.

## Files

- `game/` — the playable game: `index.html`, `game.js`, `style.css`
  (plain Canvas 2D, custom perspective renderer, synthesised WebAudio)
- `screenshots/` — four real renders of the game's own code
- `dossier.txt` — the game, controls and goal in plain text
- `main.ts` — the program that hands the game in (needs the kit's
  `vendor/makefun-game.ts`, copied unchanged, before it can run)

## Build notes

Built from scratch for this competition; play-tested in headless Chrome
with real keyboard input (takeoff, rings 1–2 flown for 644 points; a
full scripted run flew all 8 rings and landed for 9,066). No console
errors, no failed requests. See `dossier.txt` for the full write-up.

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=v6hdjfv5&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
