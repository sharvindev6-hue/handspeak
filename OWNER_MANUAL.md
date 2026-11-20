# HANDSPEAK — Owner's Manual

You (Sharvin) own this project. This manual explains every part in plain language so you can demo it, answer questions, and tell its story cold. It grows every build day.

## The one-paragraph story

A deaf person and a hearing person meet. Neither can understand the other. HANDSPEAK is a screen between them: the deaf person signs at the camera, the computer reads the hand shapes and speaks them out loud; the hearing person talks, and a robot on screen signs the words back. It starts with fingerspelling (the ASL alphabet — the universal fallback signers use for names and new words) plus common phrases.

## The three parts

1. **The eyes** (`hands.ts`) — Google's MediaPipe finds your hand in the video and marks 21 points on it (wrist, each finger joint, fingertips). It does NOT know letters. It just says "here is the hand skeleton."
2. **The brain** (`normalize.ts` + our classifier, Day 2) — we turn the skeleton into a standard 63-number "fingerprint" of the hand shape (same letter = same fingerprint, no matter where your hand is or how far from the camera). Then a small neural network WE trained reads the fingerprint and says "that's the letter B." This is the part that's genuinely ours.
3. **The voice & the robot** (Day 3) — the browser's built-in speech reads recognized text aloud; a 3D robot with bendable fingers signs back what the hearing person says.

## Why it's impressive (talking points)

- **Custom ML, not a wrapper:** we collect our own dataset, train our own model, and publish its real accuracy (confusion matrix + model card). Most hackathon projects call an API; we built the reader.
- **Runs entirely in your browser:** no server, no API keys, no install. The demo can't break on stage.
- **A real user's problem:** 430M people with disabling hearing loss (WHO), 34M of them children. Fingerspelling is the bridge when two people share no language.
- **Honest scope:** alphabet + ~15 phrases first. Full ASL grammar is the sequel we'd build AT UofTHacks.

## Demo script (grows with the build)

*Day 1 version:* "This is the eyes. Watch — I hold up my hand, and it tracks all 21 joints live, in the browser, no internet needed. This recorder is how we build our training set: I sign each letter, it saves the hand's fingerprint. Tomorrow we train the brain on these."

## Likely questions & answers

- **"Isn't this just MediaPipe?"** — MediaPipe only locates the hand. Reading letters is our own trained classifier on normalized landmark vectors; Day 2 shows the training pipeline and accuracy numbers.
- **"Why a robot instead of a human avatar?"** — deliberate: a stylized robot is honest about being a machine interpreter, avoids the uncanny valley, and lets us control every finger joint exactly.
- **"Does it know full ASL?"** — not yet, and we say so. Fingerspelling + core phrases is the v1 bridge; full ASL (grammar, facial markers, regional dialects) is the roadmap.

## Glossary

- **Landmark:** one of the 21 tracked points on a hand.
- **Fingerspelling:** spelling words letter-by-letter with the ASL alphabet.
- **Normalization:** rewriting the hand's numbers so position/size/rotation don't matter.
- **MLP:** a small neural network — layers of simple math that learn patterns from examples.
- **DTW (Day 4):** "dynamic time warping" — comparing two movements even if done at different speeds.
- **Confusion matrix:** a chart showing which letters the model mixes up — published honestly.
