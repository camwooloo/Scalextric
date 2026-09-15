# Slot Club · Scalextric

A complete local-first, single-player browser slot-car game built with Three.js and Vite. Warm motorsport menus surround a live miniature circuit. No account, backend, paid assets, or API keys required.

## Run

Requires Node.js 22.12+.

```sh
npm install
npm run dev
```

Open http://localhost:5173. To play on a phone connected to the same Wi-Fi, use the Network URL printed by Vite. Your Mac must be awake and the dev server running.

```sh
npm run build       # production files in dist/
npm run preview     # preview the production build
npm test            # physics and storage unit tests
npm run test:e2e    # browser interaction tests
```

Install the test browser once with `npx playwright install chromium`.

## Play

- **Classic slot:** a camera follows your car from above; squeeze the virtual controller and release before bends.
- **Driver view:** chase, cockpit, and bumper cameras; the car remains constrained to its slot, as in a real slot-car set.
- **Grand Prix:** race an AI opponent over 3, 5, or 10 laps.
- **Time trial:** finish the selected laps and save your fastest lap.
- **Free run:** unlimited practice.
- Cars lose their slot when lateral force exceeds their grip. They leave along the tangent, tumble, and must be re-slotted. Braking and coasting help avoid crashes.

| Control | Keyboard | Touch |
| --- | --- | --- |
| Accelerate | W / ↑ / Space | Hold orange trigger |
| Precise throttle | On-screen slider | On-screen slider |
| Brake | S / ↓ | Hold Brake |
| Change camera | C | Camera button |
| Re-slot after crash | R | Reset button |
| Pause | Esc / P | Pause button |

The race pauses when the browser loses focus or becomes hidden.

## Track studio

Three ready-to-race presets: Club Circuit, Classic Oval, and the elevated Crossover. Drag control handles on the top-down editor; insert straight, curved, or chicane sections, toggle borders, and add a raised bridge. Undo, name, save, and test your circuit. Tracks form a continuous closed spline through the handles, with visible modular seams, twin guide slots, metal rails, kerbs, and bridge supports. The editor is a creative spline builder, not a dimensionally accurate catalogue of physical Scalextric parts. Keep unrelated sections apart except for the raised crossing.

## Garage

Six free original, stylised car models inspired by Porsche 911 GT3, Ford Mustang, McLaren 720S, Mini Cooper S, Aston Martin Vantage, and BMW M3 E30. Cars differ in maximum speed, acceleration, and grip. Collect and select them in the car shop.

## Saves and a future backend

`src/storage.js` owns the versioned storage boundary (`slot-club:v1` in localStorage). Cars, selected car, custom tracks, last circuit, best laps, race count, and preferences persist in the same browser and origin. Settings includes JSON export/import for backup and transfer. Clearing site data removes local saves. The storage functions can later be replaced by an authenticated database adapter; rendering and physics do not access the storage mechanism directly.

## Rendering and mobile

Responsive layouts include a mobile bottom navigation bar, a touch track editor, touch throttle/brake, safe-area spacing, and portrait/landscape race HUDs. Static track geometry is batched by material, pixel ratio is capped, and adaptive quality disables shadows and lowers resolution on smaller/slower devices. Rendering is skipped for hidden scenes and background tabs. HUD updates are throttled. Fonts and all game assets are bundled locally.

Tested with automated desktop and emulated mobile Chromium. Real-device Safari/Android performance depends on hardware and should be verified before a public launch; no universal frame-rate guarantee is implied.

## Structure

- `src/main.js` — menus, editor interactions, race state, controls, audio, HUD
- `src/scene.js` — Three.js track, cars, scenery, lighting, camera rigs, static batching
- `src/data.js` — cars, circuit presets, pure handling functions
- `src/storage.js` — versioned local saves
- `src/style.css` — responsive interface and animations
- `tests/` — physics and end-to-end regression tests

Independent fan project, not affiliated with Scalextric, Hornby, or vehicle manufacturers. Original procedural models and illustrations; no official logos or proprietary model assets are included. Reference: https://uk.scalextric.com/ .
