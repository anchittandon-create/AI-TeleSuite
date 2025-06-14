# AI_TeleSuite Project Description

This project, **AI_TeleSuite**, is a web application designed to enhance telesales productivity using Artificial Intelligence. It's built with a modern tech stack including Next.js (React framework), ShadCN UI components, and Tailwind CSS for the user interface. The AI capabilities are powered by Genkit, utilizing Google's Gemini models.

## Key Features and Modules

1.  **AI-Powered Sales Assistance:**
    *   **Pitch Generator:** Creates tailored sales pitches based on selected products (ET or TOI), customer cohorts, and information from a Knowledge Base.
    *   **Rebuttal Assistant:** Generates intelligent responses to customer objections, also leveraging the Knowledge Base.

2.  **Call & Audio Processing:**
    *   **Audio Transcription:** Transcribes audio files (like call recordings) into text, including speaker diarization (identifying different speakers like "Agent" and "User") and transliteration of Hindi to Roman script.
    *   **AI Call Scoring:** Analyzes call recordings (after transcription) to provide an overall score, categorizes call performance, and gives detailed feedback on various metrics (e.g., opening, product presentation, objection handling, agent tone, user sentiment).

3.  **Knowledge & Training Management:**
    *   **Knowledge Base Management:** Allows users to upload and manage documents and text entries (PDF, DOCX, TXT, CSV etc.) that serve as the informational backbone for AI features like pitch and rebuttal generation. Users can associate these entries with specific products (ET/TOI) and customer personas.
    *   **Training Material Creator:** Generates structured content for training decks or brochures based on selections from the Knowledge Base or direct user prompts. It includes specific frameworks for "ET Prime Sales Training" and "Telesales Data Analysis."

4.  **Data Analysis & Insights:**
    *   **AI Data Analyst:** Takes user prompts describing their data files (Excel, CSV, etc.) and their analytical goals to generate a comprehensive report. The AI simulates data cleaning and interpretation to provide insights on trends, performance, and recommendations. It does *not* directly process the internal content of large binary files but relies on the user's descriptions, file metadata, and (for text files) small samples.

5.  **Dashboards & Monitoring:**
    *   **Activity Dashboard:** Logs and displays all user activities across the various modules of the application, allowing for monitoring and review.
    *   **Transcription Dashboard:** Shows a history of transcribed audio files, allowing users to review past transcriptions.
    *   **Call Scoring Dashboard:** Displays historical call scoring analysis reports, providing insights into past call performances.
    *   **Training Material Dashboard:** Provides a view of previously generated training materials (decks/brochures outlines).
    *   **Data Analysis Dashboard:** Shows a history of generated data analysis reports for review.

**Essentially, AI_TeleSuite aims to be an intelligent assistant for telesales teams, helping them prepare for calls, analyze performance, manage their knowledge resources effectively, and derive insights from their operational data.**
