
# Scripts

This directory contains utility scripts for the AI_TeleSuite application.

## `generate-samples.ts`

This is a one-time script used to pre-generate the static audio voice samples for the AI agents.

### Why use this?

To avoid hitting API quota limits for the Text-to-Speech service during development or on initial app load, we pre-generate the audio files. This script calls the Google Cloud TTS API once for each of the 8 preset voices and saves the output as `.wav` files in the `/public/voices` directory. The application then loads these static files instead of making API calls every time.

### How to Run

1.  **Install Dependencies**: If you haven't already, ensure you have `ts-node` and `dotenv` installed. You can install them as dev dependencies if they are not already in your `package.json`:
    ```bash
    npm install --save-dev ts-node dotenv
    ```

2.  **Ensure Credentials**: Make sure your `key.json` file is in the root of the project and your `.env` file contains the `GOOGLE_API_KEY`.

3.  **Run the Script**: From the root directory of your project, run the following command in your terminal:

    ```bash
    ts-node -r dotenv/config scripts/generate-samples.ts
    ```

The script will log its progress in the console and save the files to `/public/voices`. You only need to run this script once.
