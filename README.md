# HANDSPEAK 🤟

**A real-time two-way bridge between sign language and speech.**

Sign at your webcam → HANDSPEAK speaks it out loud. Someone talks back → a 3D robot avatar signs their words. A deaf signer and a hearing speaker hold a live conversation through one screen.

> ✅ **Status: feature-complete v1** (built Nov 19, 2026 for UofTHacks 14).
> Live fingerspelling recognition (**92.1%** held-out accuracy), a signing robot interpreter, and two-way conversation — all in the browser, no backend.
> **Live demo:** https://sharvindev6-hue.github.io/handspeak/

## Results

| Metric | Value |
|---|---|
| Training samples | 8,497 real ASL photos (26 letters, ~325 each) |
| Held-out top-1 accuracy | **92.08%** |
| Held-out top-2 accuracy | **97.70%** |
| Model | MLP 63→128→64→26, trained from scratch in plain JS (Adam) |
| Runtime | 100% client-side — camera, recognition, speech, 3D avatar |

See [MODEL_CARD.md](MODEL_CARD.md) for per-letter accuracy, confusion matrix, and honest limitations.

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
- [x] Day 2 — train letter classifier (CPU), live fingerspelling, model card
- [x] Day 3 — signing robot avatar + speech output
- [x] Day 4 — two-way conversation + broadcast-console UI redesign
- [ ] Day 5 — demo video, final polish

## Credits

- Hand landmarks: [MediaPipe](https://developers.google.com/mediapipe) (Apache-2.0)
- Test image: ASL alphabet sample from `Marxulia/asl_sign_languages_alphabets_v03` (Hugging Face)
- Built by **Sharvin** · UofTHacks 14 application project · MIT License
