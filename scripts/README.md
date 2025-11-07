
# Scripts

This directory contains utility scripts for the AI_TeleSuite application.

## `check-env.js`

**Environment Variable Validation Script** - Automatically validates that all required environment variables are properly configured before starting the development server or building the application.

### Features

- ✅ Validates required environment variables (GOOGLE_API_KEY)
- ⚠️  Reports optional missing variables with helpful descriptions
- 🔍 Validates format and structure of API keys
- 📋 Loads from both `.env.local` and `.env` files
- 🎨 Color-coded terminal output for easy reading
- 🚫 Prevents build/dev if critical variables are missing

### Auto-runs

This script automatically runs before:
- `npm run dev` (via `predev` hook)
- `npm run build` (via `prebuild` hook)

You can also run it manually:
```bash
npm run check-env
```

### Example Output

**Success:**
```
============================================================
  Environment Variable Validation
============================================================
✓ GOOGLE_API_KEY: OK
  Value: AIzaSyBBL3roRt5nqsiX...

============================================================
  Summary
============================================================
✓ All required environment variables are properly configured!
✓ Your application should work correctly.
```

**Error:**
```
✗ GOOGLE_API_KEY: MISSING
  Description: Google Gemini API key for AI operations
  Example: AIzaSy...

⚠ Application will NOT work correctly!
⚠ Please fix the issues above and try again.
```

### Adding New Variables

To add new required or optional environment variables, edit the `ENV_CONFIG` object in `scripts/check-env.js`:

```javascript
const ENV_CONFIG = {
  required: [
    {
      name: 'YOUR_VAR_NAME',
      description: 'Description of what this variable does',
      example: 'example-value',
      validate: (value) => {
        // Optional: Custom validation logic
        if (!value.startsWith('expected-prefix')) {
          return 'Should start with "expected-prefix"';
        }
        return null; // null = valid
      },
    },
  ],
  optional: [
    // Optional variables here
  ],
};
```

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
