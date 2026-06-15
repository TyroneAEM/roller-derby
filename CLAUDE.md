# Roller Derby Game — CLAUDE.md

Mobile browser roller derby game built for Ellie (9yo daughter of the repo owner) who plays roller derby.

**Live:** https://roller-derby-brown.vercel.app  
**Repo:** https://github.com/TyroneAEM/roller-derby  
**Stack:** Vite + React + TypeScript, HTML5 Canvas, Web Audio API (no audio files — all sounds synthesised)

---

## Teams & Theme

- Player picks 🐱 **Kitties** or 🦄 **Unicorns** at the team selection screen
- 🐶 **Dogs** are referees
- Shield power-up: **removed** — do not re-add
- Grand slam bonus: **removed** — do not re-add (it was firing every frame and giving thousands of points)

---

## Architecture

### Files

| File | Purpose |
|------|---------|
| `src/game/Game.tsx` | React component, game loop (`requestAnimationFrame` via `useRef`), touch/keyboard input |
| `src/game/physics.ts` | All movement, scoring, collision, power-ups |
| `src/game/renderer.ts` | Canvas drawing — track, characters, HUD, buttons, menus |
| `src/game/gameState.ts` | Initial state factory, `resetJam()` |
| `src/game/types.ts` | TypeScript interfaces |
| `src/game/audio.ts` | Web Audio API sound engine |
| `src/game/track.ts` | `trackToScreen()`, `trackDelta()`, `getTrackGeometry()` |

### Game loop

`requestAnimationFrame` runs inside `useRef` — state lives in `stateRef.current`, NOT in React state. React re-renders only happen on phase changes (`forceUpdate`).

### Canvas DPI

Every frame: `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` — prevents accumulation bug.

---

## Track Coordinate System

- `trackPos`: 0..1 clockwise around the oval
- `lane`: 0..1 inner → outer
- `trackToScreen(trackPos, lane, geo)` → canvas pixel coords
- `trackDelta(from, to)`: clockwise distance 0..1 — negative inputs wrapped: `d < 0 ? d + 1 : d`

---

## Scoring Rules (Roller Derby)

1. **Initial pass = 0 points.** Jammer must physically pass all 4 opposing blockers before scoring starts.
2. **1 point per opposing blocker** passed per scoring trip (2 pts with ⭐ multiplier active).
3. **Per-blocker reset via lap sensor** — when jammer's `trackPos` wraps from `> 0.85` to `< 0.15` (crosses the start line), all opposing blockers' `passedThisTrip` resets to `false`.

### Critical bugs already fixed — do NOT reintroduce

| Bug | What happened | Fix |
|-----|--------------|-----|
| Grand slam every frame | `+4` bonus fired 60×/sec when all blockers passed | Removed entirely |
| Batch reset | All blockers reset simultaneously while jammer still ahead → immediate re-score | Per-blocker reset |
| `initialPassDone` on frame 1 | `trackDelta` wrap-around gave delta ≈ 0.9 which passed the `> 0.02` check at jam start | Added `&& d < 0.5` upper bound |
| `delta > 0.65` reset never fires | Blockers chase jammer at nearly same speed — gap never reaches 0.65 | Replaced with lap sensor (trackPos wrap 0.85→0.15) |
| Power-ups not collecting | `trackDelta` is one-directional — jammer slightly past pickup registered distance ≈ 0.97 | Symmetric circular distance: `Math.min(rawD, 1 - rawD)` |

### Scoring code location

`src/game/physics.ts` — sections labelled `── Scoring ──`, `── Initial pass detection ──`, `── AI jammer scoring ──`

---

## Key Constants (physics.ts)

```
JAMMER_SPEED     = 0.000126   // player jammer full speed (per ms)
AI_JAMMER_SPEED  = 0.000100   // AI jammer (close to player base speed)
BLOCKER_SPEED    = 0.00012    // blocker max speed
```

Player base speed = `JAMMER_SPEED * 0.55` (joystick up adds boost, down brakes).  
Turbo = 2.5× speed multiplier for `TURBO_DURATION_MS`.

---

## Controls Layout (mobile)

- **Left side:** Virtual joystick (D-pad). Home position: `JOYSTICK_RADIUS + 10` from left edge (ring radius = 70px — must be fully on-screen).
- **Right side bottom:** TURBO button (left of PUSH), PUSH button (far right)
- **Right side above PUSH:** CALL OFF JAM (only shown when player is lead jammer)
- `BTN_PAD = 76` — clears Safari bottom chrome

---

## Safari / Mobile Notes

- **Layout:** App div uses `position: fixed; inset: 0` — required for Safari iOS. Do NOT use `height: 100dvh` (not supported before iOS 16).
- **Canvas size fallback:** `canvas.offsetWidth || window.innerWidth` — guards against 0 during early paint.
- **Facebook in-app browser:** Fires 5 delayed `resizeCanvas` calls after `orientationchange` (50, 150, 350, 700, 1200ms). Portrait warning screen shows "Tap here after rotating" — any tap in portrait also triggers resize burst.
- **Audio:** `audio.unlock()` called on first user gesture (required for iOS Web Audio API).

---

## Deployment

```bash
npx vercel --prod   # deploy to production
```

Always test locally at `http://192.168.1.249:5173/` (dev server) before deploying.

---

## UX Rules (user preferences)

- **No grand slam, no stars spray, no overwhelming effects** — user explicitly removed these as they made the game unplayable for a 9-year-old
- **Jammer speed is intentionally ~30% slower** than original — do not increase
- **AI jammer should be beatable** — keep `AI_JAMMER_SPEED` close to player base speed, not 2×
- Keep scoring effects minimal: show `+1` / `+2` text message only, no particle storms per point
