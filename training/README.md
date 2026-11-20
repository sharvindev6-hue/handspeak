# Training pipeline (Day 2)

Plan: collect → augment → train → export → evaluate. All CPU-friendly (no CUDA on the build machine).

1. **Collect** — owner records the alphabet with the in-app recorder (~26 letters × 30 frames ≈ 20 min). Bootstrap with public ASL landmark/image data if available; extract landmarks with MediaPipe (IMAGE mode) for any image datasets.
2. **Augment** — rotation jitter (±15°), scale jitter (±10%), landmark noise (σ≈0.01), mirroring for left/right hands. Target ≥10k samples.
3. **Train** — `sklearn.neural_network.MLPClassifier` (or small torch CPU net) on the 63-float vectors; stratified split; early stopping. Minutes on CPU.
4. **Export** — weights → JSON; inference is a hand-written forward pass in TypeScript (`client/src/classifier.ts`, Day 2). No runtime Python, no ONNX dependency.
5. **Evaluate** — accuracy, per-letter precision/recall, confusion matrix → `MODEL_CARD.md` (published honestly, including the M/N/S-style near-duplicates).

Status: scaffolded Day 1; implementation Day 2.
