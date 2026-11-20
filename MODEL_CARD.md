# HANDSPEAK Letter Classifier — Model Card

## Overview
- **Task:** ASL fingerspelling letter recognition (26 classes) from a single hand frame.
- **Input:** 63-float canonical hand vector (21 MediaPipe landmarks × xyz; wrist-centered, palm-scaled, rotation-canonical — see `client/src/normalize.ts`).
- **Architecture:** MLP 63 → 128 (ReLU) → 64 (ReLU) → 26 (softmax). **Trained from scratch in plain JavaScript** (`training/train.mjs`, Adam, no ML framework); inference is the same math in `client/src/classifier.ts`.
- **Training data:** 8497 real ASL alphabet photos (Marxulia/asl_sign_languages_alphabets_v03 (Hugging Face)), landmarks extracted with MediaPipe HandLandmarker. Augmentation: rotation ±0.2 rad, scale ±10%, Gaussian noise σ=0.012, left/right mirroring.
- **Split:** stratified 85/15 train/val, seed 20261119. Best epoch 36 (early stopping, patience 6).

## Results (held-out validation)
- **Top-1 accuracy: 92.08%**
- **Top-2 accuracy: 97.70%**
- Train-subset accuracy: 96.30% (2000-sample check)

### Per-letter accuracy
| Letter | Val samples | Accuracy |
|---|---|---|
| A | 52 | 94.2% |
| B | 50 | 98.0% |
| C | 48 | 93.8% |
| D | 48 | 89.6% |
| E | 49 | 100.0% |
| F | 50 | 98.0% |
| G | 48 | 97.9% |
| H | 49 | 100.0% |
| I | 47 | 89.4% |
| J | 49 | 83.7% |
| K | 51 | 90.2% |
| L | 53 | 94.3% |
| M | 51 | 96.1% |
| N | 50 | 88.0% |
| O | 43 | 88.4% |
| P | 47 | 91.5% |
| Q | 37 | 54.1% |
| R | 47 | 93.6% |
| S | 50 | 96.0% |
| T | 51 | 94.1% |
| U | 49 | 89.8% |
| V | 49 | 93.9% |
| W | 48 | 95.8% |
| X | 47 | 91.5% |
| Y | 53 | 100.0% |
| Z | 46 | 80.4% |

### Known limitations (honest)
- Weakest letters: Q (54%), Z (80%), J (84%), N (88%), O (88%) — mostly the classic ASL near-duplicates (M/N/S, A/E, U/V). The app shows top-2 candidates and requires a hold-steady before committing a letter.
- Static frames only: J and Z involve motion; v1 recognizes their static handshapes and the avatar animates the motion on output. Motion-based recognition (DTW) is roadmap.
- Dataset is photos under varied but limited conditions; live webcam accuracy depends on lighting/angle. Calibration mode + confidence threshold mitigate.
- This is fingerspelling, not full ASL (no grammar/facial markers). See OWNER_MANUAL.

## Reproduce
```bash
cd training
npm run export     # parquet → images (utf8:false — binary-safe)
npm run manifest   # image list for the browser extractor
# open client/extract.html via the dev server → writes data/dataset.json
npm run normalize  # compile shared normalization from client source
npm run train      # → client/public/models/letters.json + MODEL_CARD.md
```
