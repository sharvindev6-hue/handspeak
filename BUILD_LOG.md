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


---

## 002 — 2026-11-19 (night) · Day 2: data pipeline + classifier + avatar

**Owner directive:** "continue building until done — I need the perfect project." Autonomous build; owner away.

**Avatar (Day 3 work, pulled forward):** procedural Three.js robot with articulated fingers (3 joints × 4 fingers + thumb), face screen, idle life. Authored all 26 ASL alphabet poses as joint-angle data + 9 whole-word sign tracks (HELLO, THANK-YOU, PLEASE, SORRY, YES, NO, ILY, GOOD, BAD). **Visual QA:** rendered a 26-pose contact sheet, verified against ASL references — 26/26 correct (F was misread at thumbnail resolution; zoom confirmed the index–thumb circle). J/Z get motion paths.

**Dataset pipeline — three real bugs, found and fixed:**
1. **Parquet binary corruption.** hyparquet defaults to `utf8:true`, which decoded JPEG bytes as text — every byte ≥0x80 became `EF BF BD` (U+FFFD). Caught by hexdump (`ff d8 ff e0` expected, `ef bf bd…` found) after the browser rejected every image ("source image cannot be decoded"). Fix: `parquetReadObjects({file, utf8:false})`. Lesson: never trust a parquet reader's default string coercion on binary columns.
2. **MediaPipe needs a DOM.** tasks-vision `createFromOptions` throws `document is not defined` in Node; a minimal DOM shim got further but hung (unsettled top-level await). Decision: extract in the browser (GPU delegate, ~17 img/s), which is already proven.
3. **Browser daemon dies under sustained load** (~3.5–5 min of continuous WASM+WebGL). Designed a burst+resume protocol: per-sample manifest index, incremental JSONL collection after each poll, state file with nextIdx, `?from=N` resume. No data lost across crashes.

**Normalization bug caught by our own tests:** z (depth) was re-centered on the wrist but NOT divided by palm length → not scale-invariant, while x/y were. Unit test failed → fixed (`z/palm`) → **re-extracted the full dataset** so training and inference use identical math. Consistency over convenience.

**Classifier:** 63→128→64→26 MLP, ReLU+softmax, Adam, written from scratch in plain JS (`training/train.mjs`) — same forward pass runs in the browser (`classifier.ts`). Augmentation: rotation ±0.2 rad, scale ±10%, noise σ=0.012, left/right mirroring. Stratified 85/15 split, early stopping, exports weights JSON + MODEL_CARD.md with per-letter accuracy and confusion matrix.

**Fingerspelling UX:** hold-to-lock (550 ms steady, conf ≥0.72, smoothed over 6 frames), pause-to-send (1.3 s hands-down), top-2 candidates shown, manual commit buttons for image mode/accessibility.

**Tests:** 13 unit tests passing (normalization invariances, speller state machine, classifier forward pass/ReLU/softmax). CI: typecheck + build + test.

**Data:** 10,873 real ASL alphabet photos (HF `Marxulia/asl_sign_languages_alphabets_v03`, ~420/letter), ~80% hand-detection yield → ~8.5k training samples.


---

## 003 — 2026-11-19 (late night) · Trained brain + UI redesign

**Classifier trained:** 8,497 samples (10,873 photos processed, ~78% detection yield), stratified 85/15, 40 epochs with early stopping (best epoch 36). **Val top-1 92.08%, top-2 97.70%.** Weakest letters are the classic near-duplicates (see MODEL_CARD.md). Live smoke test: dataset photo of "B" → B at 99%.

**Owner feedback:** "the UI looks absolutely disgusting… look cheap." Fair. The first UI was a debug dashboard, not a product.

**Design skills installed from GitHub (owner request):** `design-taste-frontend` (Leonxlnx/taste-skill 2.5.1, the anti-slop skill) and `frontend-design` (anthropics/skills). Applied both plus impeccable's craft floor.

**Committed direction — "two channels, one conversation":** a broadcast interpretation console. Sign channel = signal teal; voice channel = warm amber (two speakers, two temperatures — color carries information). Deep obsidian-blue ground, Space Grotesk display + Instrument Sans body + JetBrains Mono for data only, self-hosted variable fonts. One memorable moment: the giant live letter with its lock ring and word tiles popping in. Everything else quiet.

**Bugs found in review:**
- `[hidden]` overridden by `display:flex/grid` rules → loading hint ghosted over the video and both views could render. Fixed with a global `[hidden]{display:none!important}`.
- Wrist torus read as a floating artifact → replaced with a proper wrist joint ball.
- Column heights unbalanced → flex columns + telemetry strip (letters locked / words sent / session time).
- Test photo ambiguous → swapped to a clear letter B.

**Detector pass (impeccable detect):** removed decorative colored glow halos (brand mark, letter, ring, dots), tightened stage shadows, flattened telemetry cards into one segmented console bar. Remaining warnings are intentional overlays (HUD on video), not content card-nesting.

**Verified:** typecheck ✓, 13 tests ✓, production build ✓, visual review at 1440×900 scored 9/10 (was 6), robot signs HELLO end-to-end with transcript bubble.
