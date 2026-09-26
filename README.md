# NAIN AI Interviewer — Dynamic Voice POC

Demo-first adaptive technical interviewer. **There is no fixed question list.** Every turn is generated from the candidate profile, interview history, latest answer, evidence gaps and current difficulty.

## Features

- LLM-driven interviewer/controller
- Indian English browser speech recognition (`en-IN`)
- Silence-based voice activity turn ending
- Indian English TTS preference (`en-IN`)
- Typed fallback for demos
- Adaptive actions: probe, clarify, advance, change topic, increase/decrease difficulty, finish
- Visible agent trace: topics, evidence, gaps, contradictions and decision
- Evidence trail for human review; no automated hire/reject decision

## Run

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Set `OPENAI_API_KEY`.
5. Run `npm run dev`.
6. Open the Vite URL, normally `http://localhost:5173`.
7. Use current Chrome or Edge and allow microphone access.

API runs on `http://localhost:8787`.

## Prove it is dynamic

Try: "Our API was slow so I added MongoDB indexes." The controller can probe how the bottleneck was identified.

Then: "Actually my senior told me to add the index; I didn't diagnose it." The controller receives the correction and should adapt instead of continuing a scripted sequence.

Also test "I don't know", a strong technical answer, a vague answer, an off-topic answer, and a correction that contradicts an earlier claim.

## Flow

```
Resume/profile
  -> LLM interview controller
  -> dynamic question + en-IN TTS
  -> candidate speech
  -> en-IN speech recognition + silence detection
  -> transcript
  -> evidence evaluation + next-action decision
  -> dynamically generated next question
```

## POC boundary

Sessions are in memory. For production, add durable storage, authentication, server-side audio transcription, proper neural VAD, rate limits, audit controls and a formal human-review workflow.
