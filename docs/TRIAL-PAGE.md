# Trial Page (`/trial`)

Reached from the homepage's top-left **Legends · Trial** button (`src/components/LegendsPanel.tsx`).

A campfire character-select screen, modelled on World of Warcraft's: three League of Legends legends and one empty slot stand around a fire. You can hover a legend, click it to focus, read its info and switch its skin. The background is built entirely in TSX and has a day/night toggle.

---

## Files

| File | Role |
| --- | --- |
| `src/app/trial/page.tsx` | Page state (hover, focus, skins, time of day), HUD, loading overlay |
| `src/app/trial/layout.tsx` | Cinzel font (`font-lol`), metadata |
| `src/app/trial/trial.css` | Theme: gold text, WoW buttons, panel, themed scrollbars |
| `src/config/trial.ts` | **All content**: legends, skins, slots, camera + mobile layout constants |
| `src/components/trial/TrialScene.tsx` | Canvas contents: slots, camera rig, post-processing |
| `src/components/trial/TrialCharacter.tsx` | One legend: rig, skin swap, animations, fade, hit capsule, label |
| `src/components/trial/TrialEmptySlot.tsx` | Empty slot (summoning circle + crystal) |
| `src/components/trial/IntroClouds.tsx` | Cloud bank the first-load intro camera dives through |
| `src/components/trial/TrialLegendPanel.tsx` | Info panel: thumbnail, skin picker, skin facts, lore, abilities |
| `src/components/trial/CampEnvironment.tsx` | Sky, fog, lights, camp props, day/night blending |
| `src/lib/skinSwap.ts` | Shared skin swapping (also used by `/legends/miss-fortune`) |
| `public/models/{miss_fortune,ezreal,kayle}/` | GLB models (4 per legend) |
| `public/trial/` | Thumbnails: `.webm` + `.jpg` poster per legend |

Dependencies added for this page: `@react-three/postprocessing` and `postprocessing`.

---

## Interactions

- **First load:** while the GLBs download, a loading overlay covers the screen and the camera waits high above the camp. Once loading is done the camera dives down to the overview over 3.4 s, flying through a cloud bank (`IntroClouds`, white by day, lavender at night). About 2.3 s in, the legends start spawning one after another, 280 ms apart. Each plays its `spawnClip` (`Respawn`) and fades in over 1.4 s. Labels and the HUD appear when the camera lands. Timings are in `TRIAL_INTRO` and `TRIAL_SPAWN_STAGGER`.
- **Returning to the tab** (`visibilitychange`): the legends vanish and spawn again (no intro).

- **Hover:** a gold, slowly pulsing outline (`Outline` effect). Clearing the hover is debounced by 80ms so the outline doesn't flicker at the hit capsule's edge.
- **Click:** the camera flies to the legend and the legend plays its `focusClip`. The other legends fade to 12% opacity and stop casting shadows, and `DepthOfField` blurs everything but the focused legend.
- **Back:** the Back button or the `Esc` key. The dimmed legends snap straight back to their authored materials instead of fading in, because fading in through the transparent state showed skinned meshes' inner faces.
- **Skin picker** (in the panel): a skin is downloaded only when it is picked. The current skin stays visible while the new one loads (spinner in the picker). On swap the legend plays that skin's `swapClip`.
- **Day/night toggle** (top right): defaults to the local clock (06:00–18:00 is day) and re-checks every minute until the visitor flips the toggle.

### Layout

On portrait screens the overview camera sits further back (`portraitPosition`), so all four slots and their labels fit the frame.

| Viewport | Focus view |
| --- | --- |
| `sm` and up (≥ 640px) | Camera pans right, so the legend sits at `focusScreenX` (−0.42 in NDC, about 29% from the left); the panel floats on the right |
| Below `sm` (mobile) | Stacked: the panel fills the bottom 56dvh and the legend is framed in the strip between the header and the panel |

On mobile the camera backs off until the legend fills `modelFill` (82%) of the strip. It then shifts the view with `camera.setViewOffset` (a lens shift) instead of moving the camera down, which would sink it below the ground. The constants are in `TRIAL_MOBILE`. **`panelFraction` must match the panel's `h-[56dvh]` class.**

### Gotchas

- `Outline` only renders with `<EffectComposer autoClear={false}>`; without it the mask comes out blank.
- Every legend has an invisible hit capsule. Raycasting skinned meshes on every pointer move is too expensive.
- GLB scenes are cached and shared with other pages. `TrialCharacter` measures the rig in its own space, forces an identity transform on it, and restores material opacity when it unmounts.
- The React Compiler lint forbids mutating values returned from hooks (`actions`, `useMemo` results, props). Per-frame mutation goes through refs or module-level helpers.
- `trial.css` is unlayered, so it beats Tailwind v4 utilities. Keep `position` and `border-radius` out of it. A `position: relative` on `.trial-button` once overrode `fixed` and pushed the Back/Portfolio buttons out of the viewport.
- `<main>` uses `overflow-clip`, not `overflow-hidden`. A hidden overflow is still a scroll container, and focusing a button scrolled it, shifting the canvas up.
- drei `<Html>` labels stay mounted and are hidden with CSS. Unmounting them mid-render tears down their React root. React still logs one "synchronously unmount a root" warning on load in dev (StrictMode double-mounting drei's Html); it is dev-only.
- R3F only raycasts on pointer events, so while the camera glides back to the overview, `CameraRig` calls `events.update()` to keep hover in sync.

---

## Legends

All skins of a legend share one rig: same bones, same clips, one skinned mesh each. The first skin is loaded as the rig, and later skins only swap meshes onto it.

### Miss Fortune — Gun Goddess

| | |
| --- | --- |
| Title / region / role | the Bounty Hunter · Bilgewater · Marksman |
| Skin | Gun Goddess Miss Fortune — Ultimate, released 22 Mar 2018, 2775 RP |
| Abilities | P Love Tap · Q Double Up · W Strut · E Make It Rain · R Bullet Time |
| Clips | idle `Idle1_Base`, focus `Taunt`, swap `Equip` |
| Thumbnail | Official animated splash (`MissFortune_Skin16_centered.webm`) |

In-game, the four exosuits are swapped at the fountain:

| File | Exosuit | Evidence |
| --- | --- | --- |
| `gun_goddess_miss_fortune_base.glb` | Scarlet Fair (default) | Blue/dark weapon texture `Weapon0` |
| `gun_goddess_miss_fortune_purple.glb` | Zero Hour (dark matter) | Purple weapon texture `Weapon3` |
| `gun_goddess_miss_fortune_red.glb` | Starswarm (sunborn creatures) | Red weapon texture `Weapon1` |
| `gun_goddess_miss_fortune_yellow.glb` | Royal Arms (antimatter warheads) | Gold/white weapon texture `Weapon2` |

> The file → exosuit mapping is inferred from the embedded weapon textures. Check it against the game if exact naming matters.

### Ezreal — Pulsefire

| | |
| --- | --- |
| Title / region / roles | the Prodigal Explorer · Piltover · Marksman, Mage |
| Skin | Pulsefire Ezreal — Ultimate, released 29 Jun 2012, 3250 RP (the first skin at that price) |
| Evolution | The armor upgrades each time Ezreal ranks up Trueshot Barrage: levels 1, 6, 11, 16 |
| Abilities | P Rising Spell Force · Q Mystic Shot · W Essence Flux · E Arcane Shift · R Trueshot Barrage |
| Clips | idle `Idle_Base`, focus `Laugh`, swap `Ezreal_Skin5_transform.anm` |
| Thumbnail | Official animated splash (`Ezreal_Skin5_centered.webm`) |

| File | Picker label |
| --- | --- |
| `pulsefire_ezreal.glb` | Level 1 |
| `pulsefire_ezreal_2nd.glb` | Level 6 |
| `pulsefire_ezreal_3rd.glb` | Level 11 |
| `pulsefire_ezreal_max.glb` | Final (Level 16) |

### Kayle — Aether Wing

| | |
| --- | --- |
| Title / region / roles | the Righteous · Demacia · Fighter, Marksman |
| Skin | Aether Wing Kayle — Legendary, released 18 Jan 2013, 1820 RP |
| Evolution | Follows Kayle's Divine Ascent (levels 1, 6, 11, 16) |
| Abilities | P Divine Ascent · Q Radiant Blast · W Celestial Blessing · E Starfire Spellblade · R Divine Judgment |
| Clips | idle `Idle1_Base`, focus `Taunt`, swap `Idle_In` / `Evolve1` / `Evolve2` / `Evolve3` |
| Thumbnail | Divine Ascent ability preview (gameplay clip); Aether Wing has no animated splash |

| File | Picker label | Swap clip |
| --- | --- | --- |
| `aether_wing_kayle.glb` | Level 1 | `Idle_In` |
| `aether_wing_kayle_2nd.glb` | Level 6 | `Evolve1` |
| `aether_wing_kayle_3rd.glb` | Level 11 | `Evolve2` |
| `aether_wing_kayle_final.glb` | Final (Level 16) | `Evolve3` |

> Kayle keeps `Idle1_Base` in every form. The GLB also has `Idle2_Base` and `IdlePassive`, which may suit the higher forms better.

### Clip inventory

The clip names come from the GLBs:

- **Miss Fortune**: 42 clips (also listed in `src/config/missFortune.ts`).
- **Ezreal**: 65 clips. Useful ones: `Idle_Base`, `Dance_Windup` → `Dance_Loop`, `Laugh`, `Taunt`, `Joke`, `Recall` (`Ezreal_Skin05_Recall.anm`), `Ezreal_Skin5_transform.anm` → `Ezreal_Skin5_transform_to_idle.anm`, `Respawn`.
- **Kayle**: 96 clips. Useful ones: `Idle1_Base`, `Idle2_Base`, `IdlePassive`, `Evolve1`–`Evolve4` (each with `_ToIdle`), `Dance_IN.anm` → `Dance_Loop.anm`, `Laugh`, `Taunt`, `Recall`, `Respawn`.

---

## Thumbnails

| File | Source | Processing |
| --- | --- | --- |
| `public/trial/miss-fortune.webm` | CommunityDragon `characters/missfortune/skins/skin16/animatedsplash/missfortune_skin16_centered.webm` | VP9, 640px, 24fps, no audio (2.8MB → 340KB) |
| `public/trial/ezreal.webm` | CommunityDragon `characters/ezreal/skins/skin05/animatedsplash/ezreal_skin5_centered.webm` | same (4.7MB → 805KB) |
| `public/trial/kayle.webm` | Riot CDN `d28xe8vt774jo5.cloudfront.net/champion-abilities/0010/ability_0010_P1.webm` | same (9.4MB → 684KB) |
| `public/trial/*.jpg` | Frame at 1s of each video | Used as the `poster` |

Re-encode command:

```bash
ffmpeg -i src.webm -an -vf "scale=640:-2,fps=24" -c:v libvpx-vp9 -b:v 0 -crf 40 -row-mt 1 out.webm
ffmpeg -ss 1 -i src.webm -frames:v 1 -vf "scale=640:-2" -q:v 4 out.jpg
```

To find animated splashes for other skins, open the champion JSON on CommunityDragon (`/v1/champions/{id}.json`) and look for `splashVideoPath`, `collectionSplashVideoPath` or `collectionCardHoverVideoPath` on the skin. Usually only Ultimate skins have them.

> These are Riot Games assets. A non-commercial portfolio generally falls under Riot's "Legal Jibber Jabber" fan-content policy; review it before publishing.

---

## Adding a legend or skin

1. Put the GLBs in `public/models/<legend>/`. Every skin must share the rig: same bone names and the same clips.
2. List the clip names, for example by reading the GLB's JSON chunk: `animations[].name`.
3. Add an entry to `LEGENDS` in `src/config/trial.ts`: text, `skins[]` (with `swapClip`), `idleClip`, `focusClip` and `thumbnail`. Add its id to the `LegendId` union and to `INITIAL_SKINS` in `page.tsx`.
4. Point a slot in `TRIAL_SLOTS` at it; setting `legend: null` makes that slot empty.
5. Put the thumbnail `.webm` and `.jpg` in `public/trial/`.

---

## Day / night

`CampEnvironment` keeps a `daylight` value (0 = night, 1 = day) that eases toward the toggle. Every element reads it from context in `useFrame`:

| Element | Night | Day |
| --- | --- | --- |
| Sky gradient (top / mid / glow) | indigo / purple / coral | blue / sky / warm cream |
| Fog colour, range | `#4a3566`, 9–32 | `#bfe0f0`, 12–46 |
| Key light | Moonlight from back-left, 1.1 | Sunlight from front-right, 2.4 |
| Extras | Moon, stars, fireflies | Sun, drifting clouds |
| Campfire / string lights | Full strength | Dimmed |
| Shadows | The campfire's point light casts them (radiating from the fire); moon shadows are faint (`shadow.intensity` 0.25) | Sun shadows only |

The fog range is pushed back by however far the camera sits behind the landscape overview (portrait overview, mobile focus, intro), so far-away legends don't sink into the fog.

Palette pairs live in `PALETTE` at the top of `CampEnvironment.tsx`. The fog colour and the sky's horizon colour are kept identical so the treeline melts into the sky.

---

## Sources

- Riot client data via CommunityDragon: champion JSON for Ezreal (81), Kayle (10) and Miss Fortune (21), covering titles, bios, ability names, skin rarity and video paths.
- League of Legends Wiki: [Miss Fortune skins](https://wiki.leagueoflegends.com/en-us/Miss_Fortune/Skins), [Ezreal skins](https://wiki.leagueoflegends.com/en-us/Ezreal/Skins), [Kayle skins](https://wiki.leagueoflegends.com/en-us/Kayle/Skins).
- [Pulsefire Ezreal reveal (PCGamesN)](https://www.pcgamesn.com/leagueoflegends/pulsefire-ezreal-revealed)
- [Gun Goddess Miss Fortune (Inven Global)](https://www.invenglobal.com/articles/4460/gun-goddess-miss-fortune-lols-newest-ultimate-skin-to-be-unrevealed)
- [Aether Wing Kayle (Nerfplz)](https://www.nerfplz.com/lol-skins/kayle/aether-wing-kayle/)
