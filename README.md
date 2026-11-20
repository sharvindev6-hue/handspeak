# HANDSPEAK 🤟

**A real-time two-way bridge between sign language and speech.**

Sign at your webcam → HANDSPEAK speaks it out loud. Someone talks back → a 3D robot avatar signs their words. A deaf signer and a hearing speaker hold a live conversation through one screen.

> 🚧 **Status: Day 1 of 5** (Nov 19–24, 2026 build sprint for UofTHacks 14).
> Hand tracking + dataset recorder are live. Letter classifier lands Day 2, signing avatar Day 3, two-way conversation Day 4.

## Why

Over **430 million people** live with disabling hearing loss, including **34 million children** (WHO, World Report on Hearing). Most hearing people can't sign; most deaf signers can't rely on spoken conversation being accessible. Fingerspelling is the universal fallback in ASL — and it's learnable by a machine. HANDSPEAK starts there: a bridge for the exact moment two people can't understand each other.

## How it works (architecture)

```
 ┌─────────────── CLIENT (browser, zero backend) ───────────────┐
 │                                                              │
 │  webcam ──► MediaPipe HandLandmarker ──► 21 landmarks/hand   │
 │                     │                                        │
 │                     ▼                                        │
 │        normalize.ts (position/scale/rotation invariant)      │
 │                     │                                        │
 │                     ▼                                        │
 │        OUR classifier (trained in-house, Day 2)              │
 │          static letters: MLP on 63-float vectors             │
 │          dynamic phrases: DTW on landmark sequences (Day 4)  │
 │                     │                                        │
 │                     ▼                                        │
 │        text ──► Web Speech synthesis (voice out)             │
 │                                                              │
 │  mic ──► Web Speech recognition ──► text ──► sign dictionary │
 │                     │                                        │
 │                     ▼                                        │
 │        Three.js robot avatar (articulated fingers, Day 3)    │
 └──────────────────────────────────────────────────────────────┘
```

**Design rules:** fully client-side (bulletproof live demo, free hosting) · custom ML at the core (MediaPipe only *locates* the hand; *reading* it is our model) · honest accuracy reporting (model card with confusion matrix).

## Run it

```bash
npm install     # also copies MediaPipe WASM into client/public
npm run dev     # → http://localhost:5173
```

The hand model (`client/public/models/hand_landmarker.task`) is committed, so the app runs with no external downloads.

## Repo layout

| Path | What |
|---|---|
| `client/src/hands.ts` | MediaPipe wrapper + skeleton rendering |
| `client/src/normalize.ts` | Canonical hand vectors (the ML input) |
| `client/src/main.ts` | App shell, camera/image modes, dataset recorder |
| `training/` | Day 2: data → train → export → evaluate pipeline |
| `BUILD_LOG.md` | Engineering journal — every bug and fix, as it happens |
| `OWNER_MANUAL.md` | Plain-language guide to every subsystem |

## Roadmap

- [x] Day 1 — hand tracking, normalization, dataset recorder
- [ ] Day 2 — train letter classifier (CPU), live fingerspelling, model card
- [ ] Day 3 — signing robot avatar + speech output
- [ ] Day 4 — two-way conversation + dynamic phrases + demo video
- [ ] Day 5 — deploy, tests, docs, metrics

## Credits

- Hand landmarks: [MediaPipe](https://developers.google.com/mediapipe) (Apache-2.0)
- Test image: ASL alphabet sample from `Marxulia/asl_sign_languages_alphabets_v03` (Hugging Face)
- Built by **Sharvin** · UofTHacks 14 application project · MIT License
