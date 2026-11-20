# HANDSPEAK — Build Log

The real engineering journal. Every decision, bug, failed approach, and fix — logged as it happens. (This is also the source material for the application essays: "problems you faced.")

---

## 001 — 2026-11-19 · Kickoff + pivot

**Decision (owner):** Pivot from LIFELINE (drone-swarm rescue sim) to HANDSPEAK (sign-language bridge). Owner's reasoning: HANDSPEAK solves a specific person's problem, and LIFELINE's scope was too complex for a first solid ship. LIFELINE parked as a possible follow-up. Engineering agrees: HANDSPEAK trades scale for depth + heart, has a clearer user, and a more emotional demo. Accessibility has precedent at this event (DDRK foot-keyboard won a prize at UofTHacks 13).

**Verified constraints (tonight):**
- Machine: Intel Core Ultra 5 225U, 24GB RAM, Intel iGPU — **no CUDA GPU**. Consequence: no heavy local training; plan = small classifiers on landmark vectors (63 floats), CPU-trainable in minutes. MediaPipe runs in-browser (WASM/WebGL).
- NVIDIA NIM API verified working (fast LLM + VLM + embeddings available) — optional later, NOT in the critical path. Core app needs zero API keys.
- GitHub: authenticated as `sharvindev6-hue` (repo + workflow scopes).
- Impact stat verified against WHO fact sheet: 430M people with disabling hearing loss, incl. 34M children.

**Architecture decisions:**
1. **Fully client-side.** No backend at all → static deploy, demo can't die on stage, free hosting. (LIFELINE would have needed a sim server; HANDSPEAK doesn't.)
2. **MediaPipe for landmarks only.** Reading letters is OUR trained classifier — this is the custom-ML core, not an API wrapper.
3. **Normalization before ML** (`normalize.ts`): wrist-centered, palm-scaled, rotation-canonical 63-float vectors → invariant to hand position/distance/rotation.
4. **Self-contained assets:** WASM runtime copied from npm into `public/`, hand model committed to repo → no CDN/runtime-download failures.
5. **Avatar plan (Day 3):** procedural stylized robot with articulated finger joints (Three.js), pose-keyframe dictionary for the alphabet + core phrases. Stylized = intentional aesthetic, dodges uncanny valley, fully controllable.
6. **Speech:** Web Speech API (free, in-browser). Chrome-only STT noted honestly in docs.

**Shipped tonight (Day 1):**
- Monorepo scaffold, CI (typecheck + build), MIT license, README with architecture.
- Live hand tracking: camera mode + image mode, skeleton overlay, GPU→CPU delegate fallback.
- Dataset recorder: per-letter sample capture (single frame or 30-frame burst), localStorage persistence, JSON export with metadata.

**Next (Day 2):** training pipeline — collect samples (owner records alphabet ~20 min) + public data bootstrap → augment → train MLP (sklearn, CPU) → export weights to JSON → hand-written TS inference → live fingerspelling with confidence + hold-steady debounce → confusion matrix + model card.

**Open risks:**
- ASL near-duplicate letters (M/N/S, A/E) → top-2 candidates + hold-steady + per-letter confidence.
- Live accuracy under varied lighting → augmentation + calibration mode + honest model card.
- Avatar handshape correctness → author poses from ASL references, validate visually.
