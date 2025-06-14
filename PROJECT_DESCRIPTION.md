AI_TeleSuite (NextJS, React, ShadCN, Tailwind) uses Genkit+Gemini.
PitchGen: UI (PitchForm) -> Genkit (pitch-generator.ts) -> AI uses KB context, user params (product, cohort) for sales script.
Rebuttal: UI (RebuttalForm) -> Genkit (rebuttal-generator.ts) -> AI uses KB for objection handling.
Transcription: UI (audio upload) -> Genkit (transcription-flow.ts) -> AI transcribes audio (diarized, Roman script).
CallScoring: UI (audio upload) -> Genkit (call-scoring.ts, calls transcription) -> AI scores transcript.
KB Mgt: UI (KBForm/Table) uses localStorage (useKnowledgeBase hook) to feed AI features.
TrainingMaterial: UI (context via prompt/upload/KB) -> Genkit (training-deck-generator.ts) -> AI creates content outlines.
DataAnalysis: UI (file metadata + detailed user prompt) -> Genkit (data-analyzer.ts) -> AI simulates analysis based on user's text, outputs report.
Dashboards: Display historical data from localStorage (useActivityLogger).