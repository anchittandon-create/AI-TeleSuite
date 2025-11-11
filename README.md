# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

This document reflects the v1.1 state of the application. The application features are now stable. For a complete guide to understanding and replicating this application from scratch, please refer to the detailed instructions in [REPLICATION_PROMPT.md](./REPLICATION_PROMPT.md).
# Test change for auto-deployment

## App Version Switcher

The application now supports two build targets that can be selected from the **App Version** dropdown in the top navigation bar:

1. **Completely Working Version** – ships with the full feature set and relies on paid/artificial intelligence APIs (speech-to-text, text-to-speech, LLM scoring, etc.).
2. **Free Open Source Version** – removes every paid/proprietary dependency and keeps only the UI + local utilities. Voice agents, call scoring, and any feature that would otherwise call a commercial provider are placed in read-only/demo mode.

Switching versions reloads the UI so that guards take effect immediately. The open-source banner explains which actions are disabled.

### Feature Differences

| Area | Completely Working Version | Free Open Source Version |
|------|---------------------|--------------------------|
| Voice Sales/Support Agents | Interactive calls with live ASR/TTS and scoring | UI available, but calls are disabled with an explanatory notice |
| AI Call Scoring | Upload + transcription + rubric scoring using managed AI endpoints | Disabled – instructions provided to use the paid build |
| Dashboards | Show both native voice-agent logs and backfilled call-scoring entries | Read-only; still render historical data |

### Dependency Instructions

To run the open-source build with only free libraries:

1. Remove packages that wrap paid providers (e.g., OpenAI, AssemblyAI, ElevenLabs, Google Cloud Speech/Text-to-Speech) from `package.json`, then run `npm install`.
2. Delete any paid API keys from `.env.local` (e.g., `OPENAI_API_KEY`, `ASSEMBLYAI_API_KEY`, `ELEVENLABS_API_KEY`).
3. Set the **App Version** dropdown to **Free Open Source Version** so guarded features stay disabled.

Re-enabling the commercial build simply requires reinstalling those dependencies, restoring the environment variables, and switching back to **Completely Working Version** in the dropdown.
